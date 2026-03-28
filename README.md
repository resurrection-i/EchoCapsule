<div align="center">

# ⚗️ EchoCapsule

### *On-chain emotional resonance for the creator economy*

**A living “mood capsule” NFT** — dynamic SVG, idol-driven state, and fan **Super comfort** on **Sepolia** — closed with **Reactive Network** so rewards are **Origin → Lasna → Destination**, not a black-box server.

<br/>

[![Reactive Network](https://img.shields.io/badge/Reactive_Network-Vibe_Coding-8b5cf6?style=for-the-badge)](https://dev.reactive.network/)
[![Track](https://img.shields.io/badge/Hackathon-Custom_dApp_+_Reactive-ec4899?style=for-the-badge)](https://github.com/resurrection-i/EchoCapsule)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Solidity](https://img.shields.io/badge/Solidity-Hardhat-363636?style=for-the-badge&logo=solidity&logoColor=white)](https://hardhat.org/)
[![Foundry](https://img.shields.io/badge/Reactive_contracts-Foundry-1a1a1a?style=for-the-badge)](https://book.getfoundry.sh/)
[![Go](https://img.shields.io/badge/Backend-Go-00ADD8?style=for-the-badge&logo=go&logoColor=white)](https://go.dev/)

<br/>

**[📖 Reactive runbook](reactive/README.md)** ·
**[🚀 Quick start](#local-dev)** ·
**[🏗️ Architecture](#architecture)** ·
**[✅ Proof (tx hashes)](#tx-proof)** ·
**[🎞️ Story deck](#demo-media)**

<br/>

---

</div>

<a id="demo-media"></a>

## 🎬 Demo & media

| | |
| :--- | :--- |
| **🎥 Demo video (≤ 5 min)** | *Coming soon — add your **YouTube / Loom / Drive** link here after upload.* |
| **📽️ Story deck (HTML)** | Open [`docs/demo-video-intro.html`](docs/demo-video-intro.html) fullscreen. Use **← / →** or the dots: **Phase 01 → 02 → EchoCapsule → Architecture** (terminal-style hashes animate on the last slide). |

**Repository:** [github.com/resurrection-i/EchoCapsule](https://github.com/resurrection-i/EchoCapsule)

---

## 📖 The story (for judges in a hurry)

Fans vote, tip, and lose sleep for people they love — and platforms turn that into **rows in someone else’s database**. Accounts vanish; **receipts don’t**. Web3 promised **ownership**, yet many “fan NFTs” are still **JPEGs that never answer back**.

**EchoCapsule** pushes back: a **living** capsule (**on-chain SVG** + mood-linked media) that **syncs** when the idol updates state, plus **Super comfort** — a paid, **verifiable** fan signal on-chain.

The hackathon punchline: **who automates the reward?** We use **Reactive Network** so **Sepolia** hears the fan, **Lasna** runs the reactive step, and **Sepolia** settles **points** again — **code in the trust path**, not a fragile cron + hot wallet.

---

## 🎯 Hackathon compliance (Reactive Network)

Built for the **Vibe Coding** track (**custom dApp + Reactive Contracts**). **Not** the separate **Demo Runner** track ([`reactive-smart-contract-demos`](https://github.com/Reactive-Network/reactive-smart-contract-demos/tree/main/src/demos)).

| Requirement | How this repo satisfies it |
|-------------|------------------------------|
| **Reactive Contracts** listen to EVM events and trigger follow-up txs | `SuperComfortReactive` subscribes to `SuperComfortSent` on Sepolia and emits a Reactive Network callback. |
| **Reactive + Destination** source in repo | `reactive/src/SuperComfortReactive.sol`, `reactive/src/ComfortPointsCallback.sol` |
| **Origin** (custom) in repo | `contracts/contracts/CapsuleNFT.sol` (emits `SuperComfortSent`) |
| **Deployment / runbook** | [`reactive/README.md`](reactive/README.md) |
| **Deployed addresses** | [Deployed contract addresses](#deployed-contract-addresses) |
| **Problem & solution** | [Problem & solution](#problem-solution) |
| **Post-deploy workflow** | [Workflow after deployment](#workflow-after-deployment) |
| **Tx hashes** | [Verified workflow (tx hashes)](#tx-proof) |

---

<a id="problem-solution"></a>

## 🔧 Problem & solution

**Problem:** A paid fan action on **Sepolia** (`superComfort`) must **automatically** produce **on-chain rewards** (e.g. `points[fan]`) on Sepolia in one **judge-verifiable** loop: **Origin → Reactive → Destination**.

**Without Reactive:** you typically run an **off-chain indexer + hot wallet** watching `SuperComfortSent` and signing `awardPoints`. That **re-centralizes trust** (keys, uptime, retries) and **does not demonstrate** Reactive’s **event-driven on-chain automation** — what this track evaluates.

**With Reactive:** a contract on **Lasna** **subscribes** to the Sepolia log; the network runs **react** and delivers a **protocol callback** to `ComfortPointsCallback`, updating `points[fan]` with **idempotency** on `originTxHash`. The “listener + signer” lives in **Reactive’s execution model**, not our private backend.

---

<a id="architecture"></a>

## 🏗️ Architecture (Origin → Reactive → Destination)

1. **Origin — Ethereum Sepolia**  
   `CapsuleNFT.superComfort(string message)` with `msg.value >= 0.0001 ether`  
   → emits `SuperComfortSent(address indexed fan, string message, uint256 amount)`.

2. **Reactive — Reactive Lasna Testnet**  
   `SuperComfortReactive` observes that log and emits a Reactive **callback** toward the destination.

3. **Destination — Ethereum Sepolia**  
   `ComfortPointsCallback.awardPoints(...)` (via the official **callback proxy**) updates `points[fan]`, emits `PointsAwarded`, **idempotent** on `originTxHash`.

---

<a id="deployed-contract-addresses"></a>

## 📜 Deployed contract addresses

| Role | Network | Contract | Address |
|------|---------|----------|---------|
| Origin | Sepolia (chain ID `11155111`) | `CapsuleNFT` | `0x10F3C83cce0c30B651aF9E96fB7AcA3Ded34b3B7` |
| Reactive | Lasna (chain ID `5318007`) | `SuperComfortReactive` | `0x34c1e52D3bfa279b9Bb1FD79CD9Ffac1aB3169F1` |
| Destination | Sepolia | `ComfortPointsCallback` | `0xB1bC8cb3b71B5F6B846461998Dc61667932a73fa` |

**Explorers:** [Etherscan Sepolia](https://sepolia.etherscan.io/) · [Reactscan Lasna](https://lasna.reactscan.net/)

**Sepolia callback proxy** (constructor arg for `ComfortPointsCallback`):  
`0xc9f36411C9897e7F959D99ffca2a0Ba7ee0D7bDA` ([Origins & Destinations](https://dev.reactive.network/origins-and-destinations))

---

<a id="tx-proof"></a>

## ✅ Verified workflow (tx hashes)

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

<a id="workflow-after-deployment"></a>

## 🔄 Workflow after deployment

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

## 📁 Repository layout

```
EchoCapsule/
├── contracts/          # Hardhat — Origin NFT (CapsuleNFT, SVGRenderer)
├── reactive/           # Foundry — SuperComfortReactive + ComfortPointsCallback + runbook
├── backend/            # Go API, worker, optional indexer (not required for Reactive proof)
├── frontend/           # Next.js 14 + Wagmi / RainbowKit
└── docs/               # demo-video-intro.html (4-slide story deck)
```

---

## 📎 Reactive runbook

Deployment, env vars, and Foundry commands: **[`reactive/README.md`](reactive/README.md)**.

---

<a id="local-dev"></a>

## 🚀 Local development

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

Open [http://localhost:3000](http://localhost:3000). Set `NEXT_PUBLIC_CONTRACT_ADDRESS` and `NEXT_PUBLIC_API_BASE` in `frontend/.env.local`.

**Wallet:** must be on **Sepolia** (chain ID `11155111`) for contract calls.

**🎵 Mood audio:** MP3s in `frontend/public/audio/` are **gitignored**. Copy files locally — filenames must match [`frontend/public/audio/README.md`](frontend/public/audio/README.md).

### Tests & coverage

```bash
cd contracts
npx hardhat test
npx hardhat coverage
```

---

## 📝 Dynamic NFT note (for judges)

All minted tokens read shared **`globalState`** in `CapsuleNFT`. When the idol updates emotion/media, **every** token’s on-chain `tokenURI` reflects the latest state — intentional product design.

---

## 🔗 References

- Reactive docs: [dev.reactive.network](https://dev.reactive.network/)  
- Lasna RPC / chain ID: [reactive-mainnet](https://dev.reactive.network/reactive-mainnet)  
- Official demos: [reactive-smart-contract-demos](https://github.com/Reactive-Network/reactive-smart-contract-demos)

<div align="center">

<br/>

**Built with 💜 for the Reactive Network hackathon**

<br/>

</div>
