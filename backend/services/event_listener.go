package services

import (
	"context"
	"log"
	"math/big"
	"strings"
	"time"

	"idol-capsule-backend/models"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
	"gorm.io/gorm"
)

// SuperComfortSent event ABI fragment
const superComfortABI = `[{
	"anonymous": false,
	"inputs": [
		{"indexed": true,  "internalType": "address", "name": "fan",     "type": "address"},
		{"indexed": false, "internalType": "string",  "name": "message", "type": "string"},
		{"indexed": false, "internalType": "uint256", "name": "amount",  "type": "uint256"}
	],
	"name": "SuperComfortSent",
	"type": "event"
}]`

// EventListener polls for SuperComfortSent events and syncs them into MySQL.
type EventListener struct {
	DB              *gorm.DB
	RPCURL          string
	ContractAddress string
	PollInterval    time.Duration
}

func NewEventListener(db *gorm.DB, rpcURL, contractAddress string) *EventListener {
	return &EventListener{
		DB:              db,
		RPCURL:          rpcURL,
		ContractAddress: contractAddress,
		PollInterval:    15 * time.Second,
	}
}

// Start begins the polling loop in a goroutine-friendly way.
func (el *EventListener) Start(ctx context.Context) {
	log.Println("[EventListener] Starting SuperComfortSent listener on", el.ContractAddress)
	el.poll(ctx)
	ticker := time.NewTicker(el.PollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("[EventListener] Shutting down")
			return
		case <-ticker.C:
			el.poll(ctx)
		}
	}
}

func (el *EventListener) poll(ctx context.Context) {
	client, err := ethclient.DialContext(ctx, el.RPCURL)
	if err != nil {
		log.Println("[EventListener] RPC connect error:", err)
		return
	}
	defer client.Close()

	latest, err := client.BlockNumber(ctx)
	if err != nil {
		log.Println("[EventListener] BlockNumber error:", err)
		return
	}

	// Only scan a bounded window ending at `latest`. Public RPCs reject or time out
	// eth_getLogs over huge ranges; widening `fromBlock` using the oldest DB row
	// could span millions of blocks and silently break syncing (no new SuperComfort rows).
	const lookback = uint64(3000)
	var fromBlock uint64
	if latest > lookback {
		fromBlock = latest - lookback
	}

	toBlock := latest

	contractABI, err := abi.JSON(strings.NewReader(superComfortABI))
	if err != nil {
		log.Println("[EventListener] ABI parse error:", err)
		return
	}

	contractAddr := common.HexToAddress(el.ContractAddress)
	eventSig := contractABI.Events["SuperComfortSent"].ID

	query := ethereum.FilterQuery{
		FromBlock: big.NewInt(int64(fromBlock)),
		ToBlock:   big.NewInt(int64(toBlock)),
		Addresses: []common.Address{contractAddr},
		Topics:    [][]common.Hash{{eventSig}},
	}

	logs, err := client.FilterLogs(ctx, query)
	if err != nil {
		log.Printf("[EventListener] FilterLogs error (blocks %d-%d): %v\n", fromBlock, toBlock, err)
		return
	}

	for _, vLog := range logs {
		el.processLog(contractABI, vLog)
	}

	if len(logs) > 0 {
		log.Printf("[EventListener] Synced %d SuperComfortSent events (blocks %d-%d)\n", len(logs), fromBlock, toBlock)
	}
}

func (el *EventListener) processLog(contractABI abi.ABI, vLog types.Log) {
	txHash := vLog.TxHash.Hex()

	// Idempotency — skip if already stored
	var existing models.SuperComfort
	if err := el.DB.Where("tx_hash = ?", txHash).First(&existing).Error; err == nil {
		return
	}

	// fan address is the indexed topic[1]
	if len(vLog.Topics) < 2 {
		return
	}
	fanAddr := common.HexToAddress(vLog.Topics[1].Hex()).Hex()

	// Decode non-indexed fields (message, amount)
	type SuperComfortEvent struct {
		Message string
		Amount  *big.Int
	}
	var event SuperComfortEvent
	if err := contractABI.UnpackIntoInterface(&event, "SuperComfortSent", vLog.Data); err != nil {
		log.Println("[EventListener] Unpack error:", err)
		return
	}

	record := models.SuperComfort{
		WalletAddress: fanAddr,
		Message:       event.Message,
		Amount:        event.Amount.String(),
		TxHash:        txHash,
		BlockNumber:   vLog.BlockNumber,
	}

	if err := el.DB.Create(&record).Error; err != nil {
		log.Println("[EventListener] DB insert error:", err)
	} else {
		log.Printf("[EventListener] Saved SuperComfort from %s: %q (block %d)\n",
			fanAddr, event.Message, vLog.BlockNumber)
	}
}
