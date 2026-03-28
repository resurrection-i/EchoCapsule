# EchoCapsule — Reactive Network add-on

This folder completes the hackathon **Origin → Reactive → Destination** workflow:

- **Origin (Sepolia):** your deployed `CapsuleNFT`; fans call `superComfort()` → `SuperComfortSent`
- **Reactive (Reactive Lasna Testnet):** `SuperComfortReactive` subscribes to that event and emits a callback
- **Destination (Sepolia):** `ComfortPointsCallback` receives the callback and credits `points[fan]`

> Hackathons require **effective use of Reactive Contracts** (listen to EVM logs, then trigger follow-up transactions). This add-on moves the “listen + execute” path from an optional Go indexer to **Reactive Network**.

---

## What you need

- **Sepolia ETH** — to call `superComfort` (origin) and deploy the destination contract  
- **lREACT on Lasna** — to deploy the reactive contract (fund via official Sepolia → Lasna faucet flow)  
- **Foundry** (`forge`, `cast`) — compile and deploy

> Use a **dedicated test wallet**. Never commit private keys.

---

## 1) Install Foundry (once)

```bash
curl -L https://foundry.paradigm.xyz | bash
source ~/.bashrc
foundryup
forge --version && cast --version
```

On **Windows**, WSL2 + Ubuntu is recommended; native PowerShell may need [Foundry book](https://book.getfoundry.sh/getting-started/installation) steps.

---

## 2) Deploy `CapsuleNFT` (Origin) on Sepolia

If you do not have an address yet:

```bash
cd ../contracts
npm install
npx hardhat compile
npx hardhat run scripts/deploy.js --network sepolia
```

Note the printed `CapsuleNFT` address → `ORIGIN_ADDR`.

---

## 3) Fund Lasna (lREACT)

Per [Reactive docs](https://dev.reactive.network/reactive-mainnet), send Sepolia ETH to the faucet contract on **Sepolia**:

`0x9b9BB25f1A81078C544C829c5EB7822d747Cf434`

Ratio **1 Sepolia ETH → 100 lREACT**; do **not** send more than **5 ETH** per request.

Explorer: [Reactscan Lasna](https://lasna.reactscan.net/)

---

## Contracts

| File | Role |
|------|------|
| `src/SuperComfortReactive.sol` | Lasna — subscribes to `SuperComfortSent`, emits callback |
| `src/ComfortPointsCallback.sol` | Sepolia — `awardPoints`, `PointsAwarded`, idempotent by `originTxHash` |

**Points rule (example):** `pointsToAdd = amount / 1e14` → `0.0001 ETH` → **1** point.

---

## Install `reactive-lib`

From this directory:

```bash
forge install Reactive-Network/reactive-lib --no-git
```

If `git clone` fails on `/mnt/c` (Windows mount), use a zip/tarball into `lib/reactive-lib` (see root `README.md` / project notes). Imports use `lib/reactive-lib/src/...`.

---

## Environment variables

| Variable | Example / note |
|----------|----------------|
| `ORIGIN_RPC` | Sepolia HTTPS RPC |
| `ORIGIN_CHAIN_ID` | `11155111` |
| `ORIGIN_ADDR` | Deployed `CapsuleNFT` |
| `DESTINATION_RPC` | Same as Sepolia for this demo |
| `DESTINATION_CHAIN_ID` | `11155111` |
| `REACTIVE_RPC` | `https://lasna-rpc.rnk.dev/` |
| `REACTIVE_CHAIN_ID` | `5318007` |
| `DESTINATION_CALLBACK_PROXY_ADDR` | Sepolia proxy: `0xc9f36411C9897e7F959D99ffca2a0Ba7ee0D7bDA` ([docs](https://dev.reactive.network/origins-and-destinations)) |
| `DESTINATION_PRIVATE_KEY` | Deployer key (Sepolia) |
| `REACTIVE_PRIVATE_KEY` | Same or other key with lREACT |

**PowerShell example:**

```powershell
$env:ORIGIN_RPC="https://ethereum-sepolia-rpc.publicnode.com"
$env:DESTINATION_RPC=$env:ORIGIN_RPC
$env:ORIGIN_CHAIN_ID="11155111"
$env:DESTINATION_CHAIN_ID="11155111"
$env:REACTIVE_RPC="https://lasna-rpc.rnk.dev/"
$env:REACTIVE_CHAIN_ID="5318007"
$env:DESTINATION_CALLBACK_PROXY_ADDR="0xc9f36411C9897e7F959D99ffca2a0Ba7ee0D7bDA"
# $env:ORIGIN_ADDR="0x..."
# $env:DESTINATION_PRIVATE_KEY="0x..."
# $env:REACTIVE_PRIVATE_KEY="0x..."
```

---

## Step 1 — Deploy destination (`ComfortPointsCallback`)

Dry run is default in some setups; **broadcast** with:

```bash
cd /path/to/reactive

forge create \
  --broadcast \
  --rpc-url "$DESTINATION_RPC" \
  --private-key "$DESTINATION_PRIVATE_KEY" \
  src/ComfortPointsCallback.sol:ComfortPointsCallback \
  --constructor-args "$DESTINATION_CALLBACK_PROXY_ADDR" \
  --value 0.02ether
```

Save **`Deployed to`** → `DESTINATION_CALLBACK_ADDR`.

**Windows script (optional):** `scripts/deploy-sepolia.ps1` — set env vars first, then run from `reactive/`.

---

## Step 2 — Event topic0

```bash
cast keccak "SuperComfortSent(address,string,uint256)"
```

Save output → `SUPERCOMFORT_TOPIC0`.

---

## Step 3 — Deploy reactive (`SuperComfortReactive`)

```bash
forge create \
  --broadcast \
  --rpc-url "$REACTIVE_RPC" \
  --private-key "$REACTIVE_PRIVATE_KEY" \
  --chain-id "$REACTIVE_CHAIN_ID" \
  src/SuperComfortReactive.sol:SuperComfortReactive \
  --value 0.1ether \
  --constructor-args \
    "$ORIGIN_CHAIN_ID" \
    "$DESTINATION_CHAIN_ID" \
    "$ORIGIN_ADDR" \
    "$SUPERCOMFORT_TOPIC0" \
    "$DESTINATION_CALLBACK_ADDR"
```

Save **`Deployed to`** → `REACTIVE_ADDR`.

---

## Step 4 — Run the workflow (three tx hashes)

### 4.1 Origin (Sepolia)

**Option A — dApp / MetaMask:** connect to Sepolia, call `superComfort("Hello Reactive!")` with **≥ 0.0001 ETH**.

**Option B — `cast`:**

```bash
DATA=$(cast calldata "superComfort(string)" "Hello Reactive!")
cast send "$ORIGIN_ADDR" \
  --rpc-url "$ORIGIN_RPC" \
  --private-key "$ORIGIN_PRIVATE_KEY" \
  --value 0.0001ether \
  --data "$DATA"
```

Confirm **`SuperComfortSent`** in the tx logs on [Sepolia Etherscan](https://sepolia.etherscan.io/).

### 4.2 Reactive (Lasna)

Open [Reactscan](https://lasna.reactscan.net/) → search **`REACTIVE_ADDR`** → find a **“React to event”** (or RVM) tx **after** the origin tx.

### 4.3 Destination (Sepolia)

Open [Etherscan](https://sepolia.etherscan.io/) → **`DESTINATION_CALLBACK_ADDR`** → **Events** → **`PointsAwarded`** → copy that **transaction hash**.

### Check `points` (optional)

```powershell
$env:DESTINATION_CALLBACK_ADDR="0x..."
$env:FAN_ADDR="0x..."
cd reactive
.\scripts\check-points.ps1
```

Or:

```bash
cast call "$DESTINATION_CALLBACK_ADDR" "points(address)(uint256)" "$FAN_ADDR" --rpc-url "$DESTINATION_RPC"
```

---

## Submission line (template)

```text
Demo: SuperComfort → Points / [origin tx] / [reactive tx] / [destination tx]
```

Fill with your verified hashes; deployed addresses are listed in the repository root **`README.md`**.

---

## References

- [Reactive docs](https://dev.reactive.network/)
- [Lasna / RPC](https://dev.reactive.network/reactive-mainnet)
- [Official demos](https://github.com/Reactive-Network/reactive-smart-contract-demos)
