# EchoCapsule

**On-chain emotional resonance for the creator economy** — a dynamic NFT “mood capsule” where fans meet idols without surrendering proof of devotion to an opaque Web2 ledger. Built for the **Reactive Network · Vibe Coding** hackathon: the same story you’d tell a friend, backed by **three verifiable transactions** (Origin → Reactive → Destination).

---

## Demo

| | |
| :--- | :--- |
| **Demo video (≤5 min)** | *Coming soon — paste your YouTube / Loom / Google Drive link here after upload.* |
| **Story deck (HTML)** | Open [`docs/demo-video-intro.html`](docs/demo-video-intro.html) in a browser (fullscreen recommended). Use **← / →** or the bottom dots to advance **Phase 01 → 02 → EchoCapsule → Architecture**. |

---

## The story (for judges in a hurry)

Fans today vote, tip, and stay up all night for people they love — and platforms turn that love into **traffic rows in someone else’s database**. Accounts vanish; receipts don’t. **Web3** promised ownership, but many “fan NFTs” are still **JPEGs that don’t answer back**.

**EchoCapsule** is our counter-narrative: a **living** capsule (on-chain SVG + mood-driven media) that **syncs** when the idol updates state, and a **Super comfort** path where a fan’s paid message is **real on-chain signal** — not a cron job whispering from a server.

The twist for this submission: **who automates the reward?** We don’t ask you to trust our backend. We use **Reactive Network** so that **Sepolia** hears the fan, **Lasna** reacts in the protocol model, and **Sepolia** settles **points** again — **code in the trust path, not a black-box script.**

---

## Hackathon compliance (Reactive Network)

Submission targets the **Vibe Coding** track (custom dApp + Reactive Contracts). It is **not** the separate **Demo Runner** track (three deployments from [reactive-smart-contract-demos](https://github.com/Reactive-Network/reactive-smart-contract-demos/tree/main/src/demos)).

| Requirement | How this repo satisfies it |
|-------------|----------------------------|
| **Reactive Contracts** listen to EVM events and trigger follow-up txs | `SuperComfortReactive` subscribes to `SuperComfortSent` on Sepolia and emits a Reactive Network callback. |
| **Reactive + Destination** source in repo | `reactive/src/SuperComfortReactive.sol`, `reactive/src/ComfortPointsCallback.sol` |
| **Origin** (custom) in repo | `contracts/contracts/CapsuleNFT.sol` (emits `SuperComfortSent`) |
| **Deployment / runbook** | [`reactive/README.md`](reactive/README.md) |
| **Deployed addresses** | [Deployed contract addresses](#deployed-contract-addresses) |
| **Problem & solution** | [Problem & solution](#problem--solution) |
| **Post-deploy workflow** | [Workflow after deployment](#workflow-after-deployment) |
| **Tx hashes (Origin / Reactive / Destination)** | [Verified workflow (tx hashes)](#verified-workflow-tx-hashes) |

---

## Problem & solution

**Problem:** A paid fan action on **Sepolia** (`superComfort`) should **automatically** produce **on-chain rewards** (e.g. `points[fan]`) on Sepolia in one **judge-verifiable** loop: **Origin → Reactive → Destination**.

**Without Reactive:** you almost always fall back to an **off-chain indexer + hot wallet** watching `SuperComfortSent` and signing `awardPoints`. That **re-centralizes trust** (keys, uptime, retries) and **does not showcase** Reactive’s **event-driven on-chain automation** — the thing this track is meant to evaluate.

**With Reactive:** a contract on **Lasna** **subscribes** to the Sepolia log; the network runs the **react** step and delivers a **protocol callback** to `ComfortPointsCallback`, updating `points[fan]` with **idempotency** on `originTxHash`. The “listener + signer” moves into **Reactive’s execution model**, not our private cron.

---

## Architecture (Origin → Reactive → Destination)

1. **Origin — Ethereum Sepolia**  
   `CapsuleNFT.superComfort(string message)` with `msg.value >= 0.0001 ether`  
   → emits `SuperComfortSent(address indexed fan, string message, uint256 amount)`.

2. **Reactive — Reactive Lasna Testnet**  
   `SuperComfortReactive` observes that log and emits a Reactive **callback** toward the destination.

3. **Destination — Ethereum Sepolia**  
   `ComfortPointsCallback.awardPoints(...)` (via the official **callback proxy**) updates `points[fan]`, emits `PointsAwarded`, **idempotent** on `originTxHash`.

---

## Deployed contract addresses

| Role | Network | Contract | Address |
|------|---------|----------|---------|
| Origin | Sepolia (chain ID `11155111`) | `CapsuleNFT` | `0x10F3C83cce0c30B651aF9E96fB7AcA3Ded34b3B7` |
| Reactive | Lasna (chain ID `5318007`) | `SuperComfortReactive` | `0x34c1e52D3bfa279b9Bb1FD79CD9Ffac1aB3169F1` |
| Destination | Sepolia | `ComfortPointsCallback` | `0xB1bC8cb3b71B5F6B846461998Dc61667932a73fa` |

**Explorers:** [Etherscan Sepolia](https://sepolia.etherscan.io/) · [Reactscan Lasna](https://lasna.reactscan.net/)

**Sepolia callback proxy** (constructor arg for `ComfortPointsCallback`):  
`0xc9f36411C9897e7F959D99ffca2a0Ba7ee0D7bDA` ([Origins & Destinations](https://dev.reactive.network/origins-and-destinations))

---

## Verified workflow (tx hashes)

One end-to-end run (paid `superComfort` → Reactive “React to event” → destination callback):

```text
Demo: SuperComfort → Points /
0x9eb3306ff198d0531459097b3ed178faa119e5ad1bcc06d70fe6d443b45e21f8 /
0x1fbd2b75ae54edbbb1b6bd13e7846f5318441adb29d190ebd1949b39267ab6e1 /
0xe9375f3944148bf72f6cea1c2f9aa803e864fedf0d004b5812ecc6d7e4f34692
```

| Step | Chain | Tx hash | Notes |
|------|--------|---------|--------|
| Origin | Sepolia | `0x9eb3306ff198d0531459097b3ed178faa119e5ad1bcc06d70fe6d443b45e21f8` | `superComfort` on `CapsuleNFT` |
| Reactive | Lasna | `0x1fbd2b75ae54edbbb1b6bd13e7846f5318441adb29d190ebd1949b39267ab6e1` | Type: **React to event** (Reactscan) |
| Destination | Sepolia | `0xe9375f3944148bf72f6cea1c2f9aa803e864fedf0d004b5812ecc6d7e4f34692` | Callback into `ComfortPointsCallback`; `PointsAwarded` / `originTxHash` |

---

## Workflow after deployment

### A. One-time setup (done for this submission)

1. Deploy **Origin** on Sepolia: `CapsuleNFT` (+ `SVGRenderer`) via Hardhat (`contracts/scripts/deploy.js`).  
2. Deploy **Destination** on Sepolia: `ComfortPointsCallback` with the official **callback proxy** address.  
3. Deploy **Reactive** on Lasna: `SuperComfortReactive` with constructor args wiring origin chain, origin contract, event topic0, and destination callback — see [`reactive/README.md`](reactive/README.md).  
4. Reactive deployer needs **lREACT** on Lasna (official faucet flow).

### B. Runtime (each full demo)

1. **Fan** on **Sepolia**: `CapsuleNFT.superComfort("message")` with `msg.value >= 0.0001 ether` → **`SuperComfortSent`** → save **Origin** tx hash.  
2. **Reactive** on **Lasna**: **React to event** for `SuperComfortReactive` → save **Reactive** tx hash.  
3. **Callback** on **Sepolia** into `ComfortPointsCallback` → **`PointsAwarded`** → save **Destination** tx hash.  
4. **Verify** on Etherscan: destination **Events** / `points(fan)` as in `reactive/README.md`.

---

## Repository layout

```
hks1/
├── contracts/          # Hardhat — Origin NFT (CapsuleNFT, SVGRenderer)
├── reactive/           # Foundry — SuperComfortReactive + ComfortPointsCallback + runbook
├── backend/            # Go API, worker, optional indexer (not required for Reactive proof)
├── frontend/           # Next.js + Wagmi
└── docs/               # demo-video-intro.html (4-slide story deck)
```

---

## Local development

### Contracts (Sepolia)

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat run scripts/deploy.js --network sepolia
```

### Backend

```bash
mysql -u root -p123456 -e "CREATE DATABASE IF NOT EXISTS idol_capsule CHARACTER SET utf8mb4;"
cd backend
go mod tidy
go run main.go
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Set `NEXT_PUBLIC_CONTRACT_ADDRESS` and `NEXT_PUBLIC_API_BASE` in `frontend/.env.local`. **Wallet must be on Sepolia** (chain ID `11155111`) for contract calls.

### Tests & coverage

```bash
cd contracts
npx hardhat test
npx hardhat coverage
```

---

## Dynamic NFT note (for judges)

All minted tokens read shared **`globalState`** in `CapsuleNFT`. When the idol updates emotion/media, **every** token’s on-chain `tokenURI` reflects the latest state — intentional product design.

---

## References

- Reactive docs: [https://dev.reactive.network/](https://dev.reactive.network/)  
- Lasna RPC / chain ID: [https://dev.reactive.network/reactive-mainnet](https://dev.reactive.network/reactive-mainnet)  
- Official demos: [https://github.com/Reactive-Network/reactive-smart-contract-demos](https://github.com/Reactive-Network/reactive-smart-contract-demos)
