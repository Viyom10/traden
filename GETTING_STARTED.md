# TRADEN-PROD — Getting Started, Tour & Capabilities

> A single self-contained reference for the **Atomic Fee Enforcement in Decentralized Perpetual Trading** project (BITS F452).
> Read this if you want to (a) run the app, (b) know which screens to open during a demo, and (c) understand exactly what the project achieves and how.

---

## Table of contents

1. [What this project is, in one paragraph](#1-what-this-project-is-in-one-paragraph)
2. [Prerequisites](#2-prerequisites)
3. [Installation & running](#3-installation--running)
4. [Environment variables](#4-environment-variables)
5. [Route map — every page in the app](#5-route-map--every-page-in-the-app)
6. [Demo script — the 7 screens you must show](#6-demo-script--the-7-screens-you-must-show)
7. [Main features the project is built upon](#7-main-features-the-project-is-built-upon)
8. [What the project accomplishes (vs. existing DEXes)](#8-what-the-project-accomplishes-vs-existing-dexes)
9. [Project structure cheat-sheet](#9-project-structure-cheat-sheet)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. What this project is, in one paragraph

TRADEN-PROD is a Solana-based decentralized perpetual futures trading UI (built on top of Drift Protocol) that introduces **atomic fee enforcement**: every trade transaction is intercepted client-side, a `SystemProgram.transfer` fee instruction is *prepended into the same transaction*, and the user's wallet signs the combined message with one Ed25519 signature. The single signature covers a SHA-256 hash of the entire serialized message, so the fee and the trade are cryptographically inseparable — both succeed, or both revert. Fee evasion becomes mathematically impossible without invalidating the signature.

---

## 2. Prerequisites

| Tool | Version | Why |
|------|---------|-----|
| **Node.js** | 18+ (or **Bun** 1.1+) | runtime |
| **Bun** | 1.1+ (recommended) | the lockfile is `bun.lock` |
| **MongoDB** | local 6.x or Atlas URI | persists fees/trades for the dashboards |
| **Solana wallet** | Phantom / Solflare browser extension | for signing |
| A Solana RPC URL | devnet & (optionally) mainnet | use Helius / Triton / QuickNode for stability |

> The repo's `ui/package.json` was generated with Bun. You *can* install with npm/yarn — the lockfile just won't be honoured.

---

## 3. Installation & running

```bash
# 1. clone
git clone https://github.com/Viyom10/traden.git
cd traden

# 2. install (the app lives in ui/)
cd ui
bun install        # OR: npm install / yarn install / pnpm install

# 3. configure env (see §4)
cp .env.local.example .env.local   # then fill values
# (if no example exists, create .env.local with the keys in §4)

# 4. run the dev server
bun run dev        # OR: npm run dev
# → app at http://localhost:3000
```

The `dev` script is `whop-proxy --command 'next dev --turbopack'`. The Whop proxy is harmless if you're not deploying as a Whop experience — it just forwards to Next.js.

Production:

```bash
bun run build
bun run start
```

---

## 4. Environment variables

Create `ui/.env.local`:

```env
# ── Solana RPCs (REQUIRED) ─────────────────────────────────────────
NEXT_PUBLIC_SOLANA_DEVNET_RPC_ENDPOINT=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_MAINNET_RPC_ENDPOINT=https://api.mainnet-beta.solana.com

# ── Atomic-fee recipient (REQUIRED for fees to attach) ─────────────
# Public key of the wallet that will receive the 5-bps platform fee.
NEXT_PUBLIC_BUILDER_AUTHORITY=YOUR_BUILDER_PUBKEY_BASE58

# ── MongoDB (REQUIRED for dashboards) ──────────────────────────────
MONGODB_URI=mongodb://localhost:27017/traden

# ── Optional: Whop experience integration ──────────────────────────
WHOP_API_KEY=
NEXT_PUBLIC_WHOP_APP_ID=
NEXT_PUBLIC_WHOP_AGENT_USER_ID=
NEXT_PUBLIC_WHOP_COMPANY_ID=
```

If `NEXT_PUBLIC_BUILDER_AUTHORITY` is missing the interceptor logs a warning and the trade goes through *without* a fee — useful for first-run smoke tests, but you must configure it before showing the atomic-fee story.

---

## 5. Route map — every page in the app

| Route | Purpose | Audience |
|-------|---------|----------|
| `/perps` | 40+ market perpetual trading (orderbook, candles, 5 order types) | end-user |
| `/spot` | Deposit / withdraw / swap | end-user |
| `/signals` | Browse trading signals from creators | end-user |
| `/user` | Drift sub-account create/delete, balance, revenue share | end-user |
| `/admin` | Fee statistics, claim approvals, payment history | wallet-gated admin |
| `/creator` | Creator earnings, claim history, fee history | wallet-gated creator |
| **`/blockchain`** | Concept-to-source map of every primitive used (Ed25519, SHA-256, Merkle, atomic execution, CPI, oracles) → file in this repo | demo / evaluator |
| **`/verify`** | **Four in-browser cryptographic demos** — 10-step Ed25519+SHA-256 wizard, hash properties, multi-tamper matrix, **Merkle proof builder + tamper test** | demo / evaluator |
| **`/security`** | Six attacks (Replay, Forgery, Fee-Strip, Fee-Tamper, Reorder, MITM recipient swap) run as on-page tests with PASS/FAIL and "Run all attack tests" button | demo / evaluator |
| **`/benchmarks`** | Tx-size overhead, sign latency (100-iter), CU estimate, construction time | demo / evaluator |
| **`/explorer`** | Paste any signature → renders the **full CPI tree** from `meta.innerInstructions`; verifies fee + trade are in the same atomic envelope | demo / evaluator |
| **`/receipt/[signature]`** | Beautiful per-transaction receipt with crypto-proof block | end-user / share link |

The five **bold** routes are the verification surface that proves the cryptographic thesis.

---

## 6. Demo script — the 7 screens you must show

Use this order during a presentation. Each step takes ~30–60 s.

1. **`/blockchain`** — open the *Cryptographic Foundations* and *Atomic Transaction Execution* groups. Every primitive (Ed25519, SHA-256, Merkle trees, atomicity, replay protection, CPI) is mapped to the exact file in the repo where it is implemented. Sets the technical frame.
2. **`/verify` → "Step-by-step transaction integrity"** — click *Next Step* through all 10 stages. The audience watches a SHA-256 hash and an Ed25519 signature get computed live in their browser, then sees the signature go ❌ INVALID after a 1-lamport tamper. This is *the* money shot.
3. **`/verify` → "Atomicity proof" and "Merkle proof builder"** — the multi-tamper matrix flips every kind of post-signing edit (remove fee, change recipient, change amount, reorder) and shows all six rows turn red. Then the Merkle section builds a tree from a list of leaves, generates an inclusion proof for any leaf, and shows the proof failing after a 1-character tamper.
4. **`/security`** — click *Run all attack tests*. Six attacks are simulated client-side with `tweetnacl` + `Keypair.generate()`. All six show ✅ PROTECTED with byte-level diffs. Frames the project as a security-first contribution.
5. **`/benchmarks`** — click *Run Benchmarks*. Numbers come back showing **+64 B / < 1 ms / ~150 of 200,000 CU / ~0.07 %** total relative overhead — well under 1 % on every metric. Quantitative proof that atomic fees are not just correct, they're cheap.
6. **`/perps`** — connect Phantom on devnet, place a small SOL-PERP order. Once it confirms, the toast surfaces the signature. Open `/explorer`, paste the signature, and **see your own transaction on-chain**: the full CPI tree shows `SystemProgram.transfer` (the fee) and the Drift instruction at depth 0 in the same envelope, with Drift's own cross-program calls (System, SPL Token, Pyth, Switchboard) indented under it.
7. **`/receipt/<sig>`** or **`/admin`** / **`/creator`** — open the per-transaction receipt or the fee tables. Each row's signature is a Solscan link **and** a link to the in-app `/receipt` page. End-to-end audit trail.

---

## 7. Main features the project is built upon

### 7.1 Atomic fee enforcement (the core innovation)

`ui/src/lib/DriftClientWrapper.ts` installs a wrapper around `drift.driftClient.sendTransaction`. For every outgoing perp order:

1. Decompile the V0 `VersionedTransaction` (resolving Address Lookup Tables).
2. Build a fresh `SystemProgram.transfer` instruction sized to **5 bps** of the trade (`ui/src/lib/tradingFee.ts`), recipient = `NEXT_PUBLIC_BUILDER_AUTHORITY`.
3. Prepend the fee instruction.
4. Recompile to a new V0 message and forward to the wallet for a single Ed25519 signature.
5. Best-effort write a `Fee` row to MongoDB so dashboards stay live.

Cryptographic guarantee: the wallet signs SHA-256 over the serialized message; the lamport amount, the recipient pubkey, and the trade instruction are all inside that hash. Any post-signing mutation flips the digest (avalanche) and Ed25519 verification fails on-chain — the validator rejects the transaction.

### 7.2 Drift Protocol perpetuals UI

40+ markets, candlestick chart (`lightweight-charts`), live orderbook over Drift's WebSocket, five order types (market, limit, take-profit, stop-loss, oracle-limit), reduce-only / post-only / Swift toggles, leverage management, position closing.

### 7.3 Real-time data plane

Three Zustand stores (`OraclePriceStore`, `MarkPriceStore`, `UserAccountDataStore`) are subscribed to Drift's push streams in `ui/src/hooks/globalSyncs/useSetupDrift.ts`. The UI re-renders on every price tick without polling.

### 7.4 Off-chain audit & monetization layer

MongoDB schemas (`Fee`, `Trade`, `Signal`, `FeeClaim`) mirror on-chain events keyed by `txSignature`. APIs at `/api/fee`, `/api/trade`, `/api/signal`, `/api/fee-claim`, `/api/admin/stats`, `/api/admin/claims`, `/api/user`. Drives:
* Admin dashboard (totals, pending claims, payment history)
* Creator dashboard (earnings, 50/50 revenue share, claim flow)
* Signal marketplace (creators publish, customers execute with one click)

### 7.5 Cryptographic & blockchain verification layer (NEW)

The five educational routes (`/blockchain`, `/verify`, `/security`, `/benchmarks`, `/explorer`) plus `/receipt/[signature]` make the underlying cryptography tangible:
* In-browser Ed25519 signing & verification via `tweetnacl`
* Web Crypto SHA-256 with avalanche visualisation
* Live tampering matrix
* From-scratch SHA-256 Merkle tree (`src/lib/merkle.ts`) with proof builder + tamper test
* Six attack simulations with byte-level diffs and a "Run all attack tests" button
* Quantitative overhead measurements (+64 B / < 1 ms / ~150 of 200,000 CU / ~0.07 %)
* On-chain CPI tree rendering via `connection.getParsedTransaction` + `src/lib/cpi.ts`

### 7.6 Wallet & multi-environment plumbing

Phantom / Solflare / generic Wallet Adapter, devnet ↔ mainnet toggle (`useDriftStore.environment`), env-aware Solscan links via `ui/src/lib/solscan.ts`, fallback connections when Drift isn't subscribed yet.

---

## 8. What the project accomplishes (vs. existing DEXes)

| Concern | Typical DEX | TRADEN-PROD |
|---------|-------------|-------------|
| Platform fee collection | Off-chain or separate transaction | **Same transaction as the trade — one signature** |
| Fee bypass possible? | Yes (drop the fee tx) | **No** (signature invalidates) |
| Fee amount tamperable? | Yes if relayed | **No** (covered by SHA-256 → Ed25519) |
| Recipient swap MITM | Possible with stale relays | **No** (recipient is in the signed message) |
| Trade confirmation surface | Block explorer only | Solscan + in-app **`/receipt/[sig]`** + dashboards |
| Demonstrability of the claims | None | Six interactive screens prove every claim live |
| Overhead | n/a | **~0.07 %** total relative overhead — < 1 % on size, latency, and compute |

In short, the project converts an *operational policy* ("please pay the fee") into a *cryptographic invariant* ("you cannot trade without paying the fee"), and ships the proofs as live demos rather than slides.

---

## 9. Project structure cheat-sheet

```
traden/
├── README.md                 ← original Drift template README
├── PROJECT_ARCHITECTURE.md   ← deep architecture document
├── IMPLEMENTATION_GUIDE.md   ← task plan that was executed
├── GETTING_STARTED.md        ← THIS FILE
├── docs/                     ← course PDFs (Bitcoin, Consensus, Crypto, …)
└── ui/                       ← Next.js 15 app (everything is here)
    ├── package.json          ← bun.lock; React 19, Drift SDK, web3.js, tweetnacl
    ├── src/
    │   ├── app/
    │   │   ├── perps/  spot/  user/  signals/  admin/  creator/  data/
    │   │   ├── blockchain/   ← syllabus map (NEW)
    │   │   ├── verify/       ← SHA-256 / Ed25519 live demo (NEW)
    │   │   ├── security/     ← six attack simulations (NEW)
    │   │   ├── benchmarks/   ← overhead measurements (NEW)
    │   │   ├── explorer/     ← on-chain tx verifier (NEW)
    │   │   ├── receipt/[signature]/  ← per-tx receipt (NEW)
    │   │   └── api/          ← fee, trade, signal, admin, fee-claim, user
    │   ├── lib/
    │   │   ├── DriftClientWrapper.ts   ★ atomic fee interceptor
    │   │   ├── tradingFee.ts           ★ fee instruction builder
    │   │   ├── solscan.ts              ← env-aware explorer URL helpers (NEW)
    │   │   ├── db.ts  tradeApi.ts  spot.ts  whop-sdk.ts  utils.ts
    │   ├── components/  ← layout/ perps/ spot/ user/ wallet/ creator/ ui/
    │   ├── hooks/       ← globalSyncs/  perps/  signals/  admin/  creator/  …
    │   ├── schemas/     ← Fee  Trade  Signal  FeeClaim  (Mongoose)
    │   ├── stores/      ← Drift  OraclePrice  MarkPrice  UserAccountData  User
    │   └── providers/   ← WalletProvider  QueryProvider
    └── public/
```

The two ⭐ files are the heart of the system; everything else is plumbing or UI.

---

## 10. Troubleshooting

**`Cannot find module 'react'` (or hundreds of similar TS errors).** Dependencies aren't installed. Run `bun install` (or `npm install`) inside `ui/`.

**`NEXT_PUBLIC_BUILDER_AUTHORITY not set in environment variables`.** Add it to `ui/.env.local` and restart the dev server. Without it the interceptor still works but skips the fee.

**Wallet won't connect on devnet.** Switch the wallet to *Devnet* in its settings, not just the app. Drift devnet markets need devnet SOL — get some from `https://faucet.solana.com`.

**`/explorer` returns "transaction not found".** Either the signature is from a different cluster (check the devnet/mainnet toggle in the header) or the RPC you configured rate-limited the request. Try a Helius/Triton URL.

**MongoDB errors in `/admin` or `/creator`.** The dashboards depend on `MONGODB_URI`. Either start `mongod` locally or paste an Atlas URI. The trading flow itself does **not** need MongoDB — only the dashboards do.

**Lint shows ~480 errors but the app runs fine.** Same root cause as the first item: `node_modules` is missing in the editor's workspace. The errors all reduce to "Cannot find module 'react' / 'next' / '@solana/web3.js'" plus their cascades. Install deps and they vanish.

---

*Last updated: this doc supersedes any "running" instructions in `ui/README.md` (which is the boilerplate Next.js readme).*
