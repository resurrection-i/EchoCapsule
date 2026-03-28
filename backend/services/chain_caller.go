package services

import (
	"context"
	"crypto/ecdsa"
	"encoding/hex"
	"fmt"
	"log"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

// updateIdolState ABI — 只包含我们需要调用的函数
const capsuleABIFragment = `[
  {
    "inputs": [
      {"internalType":"uint8",   "name":"emotionId",  "type":"uint8"},
      {"internalType":"string",  "name":"photoCid",   "type":"string"},
      {"internalType":"uint8",   "name":"musicId",    "type":"uint8"},
      {"internalType":"string",  "name":"moodText",   "type":"string"},
      {"internalType":"uint256", "name":"deadline",   "type":"uint256"},
      {"internalType":"bytes",   "name":"signature",  "type":"bytes"}
    ],
    "name": "updateIdolState",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
]`

// ChainCaller 封装 go-ethereum 合约调用
type ChainCaller struct {
	rpcURL          string
	contractAddress common.Address
	privateKey      *ecdsa.PrivateKey
	chainID         *big.Int
	parsedABI       abi.ABI
}

// NewChainCaller 创建并初始化 ChainCaller
// privateKeyHex: 64 位十六进制私钥（不含 0x 前缀）
func NewChainCaller(rpcURL, contractAddr, privateKeyHex string, chainID int64) (*ChainCaller, error) {
	// 解析私钥
	rawKey := strings.TrimPrefix(privateKeyHex, "0x")
	privKey, err := crypto.HexToECDSA(rawKey)
	if err != nil {
		return nil, fmt.Errorf("invalid private key: %w", err)
	}

	// 解析 ABI
	parsed, err := abi.JSON(strings.NewReader(capsuleABIFragment))
	if err != nil {
		return nil, fmt.Errorf("ABI parse error: %w", err)
	}

	return &ChainCaller{
		rpcURL:          rpcURL,
		contractAddress: common.HexToAddress(contractAddr),
		privateKey:      privKey,
		chainID:         big.NewInt(chainID),
		parsedABI:       parsed,
	}, nil
}

// CallResult 链上调用结果
type CallResult struct {
	TxHash string
	Err    error
}

// UpdateIdolState 调用合约 updateIdolState，返回真实 txHash
func (cc *ChainCaller) UpdateIdolState(
	ctx context.Context,
	emotionID uint8,
	photoCID string,
	musicID uint8,
	moodText string,
	deadline uint64,
	signatureHex string, // 来自任务记录，前端已签名
) (string, error) {
	// 1. 连接 RPC
	client, err := ethclient.DialContext(ctx, cc.rpcURL)
	if err != nil {
		return "", fmt.Errorf("RPC dial: %w", err)
	}
	defer client.Close()

	// 2. 解码签名
	rawSig := strings.TrimPrefix(signatureHex, "0x")
	sigBytes, err := hex.DecodeString(rawSig)
	if err != nil {
		return "", fmt.Errorf("signature decode: %w", err)
	}

	// 3. 打包 calldata
	data, err := cc.parsedABI.Pack(
		"updateIdolState",
		emotionID,
		photoCID,
		musicID,
		moodText,
		new(big.Int).SetUint64(deadline),
		sigBytes,
	)
	if err != nil {
		return "", fmt.Errorf("ABI pack: %w", err)
	}

	// 4. 获取发送方地址和 nonce
	fromAddr := crypto.PubkeyToAddress(cc.privateKey.PublicKey)
	nonce, err := client.PendingNonceAt(ctx, fromAddr)
	if err != nil {
		return "", fmt.Errorf("nonce: %w", err)
	}

	// 5. 估算 Gas
	gasLimit, err := client.EstimateGas(ctx, ethereum.CallMsg{
		From: fromAddr,
		To:   &cc.contractAddress,
		Data: data,
	})
	if err != nil {
		// 如果估算失败（可能是合约 revert），给一个安全上限
		log.Printf("[ChainCaller] EstimateGas failed: %v — using 200000", err)
		gasLimit = 200000
	}
	gasLimit = gasLimit * 12 / 10 // +20% buffer

	// 6. 建议 Gas Price（EIP-1559 感知）
	gasPrice, err := client.SuggestGasPrice(ctx)
	if err != nil {
		return "", fmt.Errorf("gas price: %w", err)
	}

	// 7. 构造并签名交易
	tx := types.NewTransaction(
		nonce,
		cc.contractAddress,
		big.NewInt(0), // value = 0
		gasLimit,
		gasPrice,
		data,
	)

	signer := types.NewLondonSigner(cc.chainID)
	signedTx, err := types.SignTx(tx, signer, cc.privateKey)
	if err != nil {
		return "", fmt.Errorf("sign tx: %w", err)
	}

	// 8. 广播交易
	if err := client.SendTransaction(ctx, signedTx); err != nil {
		return "", fmt.Errorf("send tx: %w", err)
	}
	txHash := signedTx.Hash().Hex()
	log.Printf("[ChainCaller] Tx sent: %s", txHash)

	// 9. 等待 Receipt（最多 3 分钟）
	receiptCtx, cancel := context.WithTimeout(ctx, 3*time.Minute)
	defer cancel()

	receipt, err := waitForReceipt(receiptCtx, client, signedTx.Hash())
	if err != nil {
		// 交易已发出但 receipt 超时：返回 txHash 让 Worker 记录，后续可查询
		log.Printf("[ChainCaller] Receipt timeout for %s: %v", txHash, err)
		return txHash, nil
	}

	if receipt.Status == types.ReceiptStatusFailed {
		return txHash, fmt.Errorf("tx reverted on-chain: %s", txHash)
	}

	log.Printf("[ChainCaller] Confirmed in block #%d, gas used: %d", receipt.BlockNumber, receipt.GasUsed)
	return txHash, nil
}

// waitForReceipt 轮询等待交易 receipt
func waitForReceipt(ctx context.Context, client *ethclient.Client, hash common.Hash) (*types.Receipt, error) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-ticker.C:
			receipt, err := client.TransactionReceipt(ctx, hash)
			if err != nil {
				// not mined yet — keep polling
				continue
			}
			return receipt, nil
		}
	}
}

// GetTransactOpts 辅助：生成 bind.TransactOpts（供未来扩展使用）
func (cc *ChainCaller) GetTransactOpts(ctx context.Context, client *ethclient.Client) (*bind.TransactOpts, error) {
	opts, err := bind.NewKeyedTransactorWithChainID(cc.privateKey, cc.chainID)
	if err != nil {
		return nil, err
	}
	opts.Context = ctx
	return opts, nil
}
