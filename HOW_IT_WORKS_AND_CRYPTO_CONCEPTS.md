# TRADEN-PROD — How It Works & The Cryptography Behind It

> A self-contained reference for **anyone** (teammate, reviewer, future maintainer)
> who wants to understand the system end-to-end: how the code is laid out, how a trade
> actually flows through it, and how each blockchain / cryptography concept from the
> course is implemented, used, and useful in this codebase.
>
> Companion docs:
> * `PROJECT_ARCHITECTURE.md` — visual ASCII architecture diagrams.
> * `GETTING_STARTED.md` — install, env vars, demo script.
> * `IMPLEMENTATION_GUIDE.md` — the original task plan.

---

## Table of contents

### Part A — How things are working (architecture)
1. [Mental model in 90 seconds](#1-mental-model-in-90-seconds)
2. [The five layers](#2-the-five-layers)
3. [What lives in each folder](#3-what-lives-in-each-folder)
4. [Lifecycle of a single trade](#4-lifecycle-of-a-single-trade)
5. [Lifecycle of a creator earning + claiming a fee](#5-lifecycle-of-a-creator-earning--claiming-a-fee)
6. [State management & data plane](#6-state-management--data-plane)

### Part B — Cryptography & blockchain concepts in depth
7. [Concept inventory (one-line definitions)](#7-concept-inventory)
8. [Asymmetric cryptography & Ed25519](#8-asymmetric-cryptography--ed25519)
9. [Hash functions & SHA-256](#9-hash-functions--sha-256)
10. [Digital signatures = hash + asymmetric crypto](#10-digital-signatures)
11. [Atomic transactions on Solana](#11-atomic-transactions-on-solana)
12. [Versioned transactions & Address Lookup Tables](#12-versioned-transactions--alts)
13. [Replay protection via recent blockhash](#13-replay-protection)
14. [Decentralised price oracles (Pyth & Switchboard)](#14-decentralised-price-oracles)
15. [Smart contracts vs application-layer enforcement](#15-smart-contracts-vs-application-layer)
16. [Wallets, key derivation, and identity](#16-wallets-key-derivation-identity)
17. [Solana consensus (PoH + Tower BFT) — what we rely on](#17-solana-consensus)
18. [Comparison with Bitcoin & Ethereum primitives](#18-comparison-with-bitcoin--ethereum)
19. [Where each concept is used in the code](#19-where-each-concept-is-used-in-the-code)

---

# PART A — HOW THINGS ARE WORKING

## 1. Mental model in 90 seconds

TRADEN-PROD is a Solana-based perpetual futures trading UI built on top of **Drift Protocol**. Its one original contribution is **atomic fee enforcement**:

> Before any trade transaction reaches the wallet for signing, an interceptor in the browser **prepends a `SystemProgram.transfer` instruction** (the platform fee) into the same transaction. The wallet then produces **one Ed25519 signature** that mathematically covers both instructions. The Solana validator either commits both or commits neither.

Everything else in the repo — the Drift integration, the spot trading, the signal marketplace, the admin/creator dashboards, the educational pages — exists to either *enable* that mechanism or *demonstrate* its correctness.

## 2. The five layers

```
┌────────────────────────────────────────────────────────────────┐
│ 1. PRESENTATION                                                │
│    Next.js 15 (App Router) + React 19 + Tailwind 4 + shadcn/ui │
│    Routes:  /perps  /spot  /signals  /user  /admin  /creator   │
│             /blockchain  /verify  /security  /benchmarks       │
│             /explorer   /receipt/[signature]                   │
├────────────────────────────────────────────────────────────────┤
│ 2. STATE & SYNC                                                │
│    Zustand stores  +  React Query  +  AuthorityDrift subs      │
│    Stores: Drift, OraclePrice, MarkPrice, UserAccountData, User│
├────────────────────────────────────────────────────────────────┤
│ 3. ATOMIC FEE ENFORCEMENT  (the contribution)                  │
│    lib/DriftClientWrapper.ts   ← wraps drift.driftClient.send  │
│    lib/tradingFee.ts           ← builds the fee instruction    │
├────────────────────────────────────────────────────────────────┤
│ 4. PROTOCOL & WALLET                                           │
│    @drift-labs/sdk + @drift-labs/common  (DEX SDK)             │
│    @solana/web3.js                       (chain APIs)          │
│    @solana/wallet-adapter-*              (Phantom / Solflare)  │
│    tweetnacl                             (in-browser Ed25519)  │
├────────────────────────────────────────────────────────────────┤
│ 5. PERSISTENCE & APIs                                          │
│    Next.js route handlers in app/api/*                         │
│    MongoDB + Mongoose schemas: Fee  Trade  Signal  FeeClaim    │
└────────────────────────────────────────────────────────────────┘
```

Each layer only knows about the one beneath it. The interceptor (layer 3) is the only place that touches `sendTransaction`, so adding a new screen or a new market doesn't require thinking about fees.

## 3. What lives in each folder

```
ui/src/
├── app/                              ← Next.js routes (1 folder = 1 URL)
│   ├── layout.tsx                    ← providers + header + toaster
│   ├── page.tsx                      ← redirects to /perps
│   ├── perps/  spot/  signals/  user/  data/
│   ├── admin/  creator/              ← wallet-gated dashboards
│   ├── blockchain/  verify/  security/  benchmarks/  explorer/
│   ├── receipt/[signature]/          ← dynamic route
│   └── api/                          ← server route handlers
│       ├── fee/  trade/  signal/  fee-claim/  user/
│       └── admin/{stats,claims}/
│
├── components/
│   ├── layout/   Header, AppSetup, PageLayout
│   ├── perps/    PerpTradeForm, Orderbook, CandleChart, PositionsTable, ...
│   ├── spot/     SwapForm, DepositAndWithdrawForm, SpotBalanceTable
│   ├── user/     CreateUserForm, UserAccountCard, RevenueShareCard
│   ├── wallet/   WalletButton, DepositDialog, WithdrawDialog, ...
│   ├── creator/  CreateSignal, SignalsList, SignalTradeForm
│   └── ui/       shadcn primitives (Card, Button, Dialog, Table, ...)
│
├── stores/                           ← Zustand
│   ├── DriftStore.ts                 (drift instance + environment)
│   ├── OraclePriceStore.ts           (live oracle prices)
│   ├── MarkPriceStore.ts             (mark / bid / ask)
│   ├── UserAccountDataStore.ts       (sub-accounts, RevenueShare)
│   └── UserStore.ts                  (Whop identity → access level)
│
├── hooks/                            ← React hooks grouped by domain
│   ├── globalSyncs/  useSetupDrift, useGlobalSyncs (wires layers 2–4)
│   ├── perps/        useOrderbookWebSocket, ...
│   ├── signals/      useSignalExecution
│   ├── admin/        useAdminStats, useAdminClaims
│   ├── creator/      useCreatorFees, useFeeClaims
│   ├── user/         useUserManagement, useDriftBuilderCode
│   └── markets/, spot/, whop/
│
├── lib/                              ← Pure logic (no React)
│   ├── DriftClientWrapper.ts  ★ atomic fee interceptor
│   ├── tradingFee.ts          ★ fee-instruction builder
│   ├── solscan.ts             env-aware Solscan URL helpers
│   ├── db.ts                  Mongoose connection cache
│   ├── tradeApi.ts            client wrapper around /api/trade
│   ├── spot.ts                wallet balance fetching
│   ├── whop-sdk.ts            Whop SDK config
│   └── utils.ts               clsx + tailwind-merge helper
│
├── schemas/                          ← Mongoose models
│   ├── FeeSchema.ts           off-chain mirror of fee transfers
│   ├── TradeSchema.ts         off-chain mirror of trade orders
│   ├── SignalSchema.ts        creator-published signals
│   └── FeeClaimSchema.ts      creator earning claim flow
│
├── providers/                        ← React context providers
│   ├── WalletProvider.tsx
│   └── QueryProvider.tsx
│
├── constants/                        ← supported markets, default markets,
│                                       builder code, image paths
└── utils/toastUtils.ts
```

★ = the two files that contain the original contribution.

## 4. Lifecycle of a single trade

This is what happens when the user clicks **Place Order** on `/perps`.

```
USER  ─click─▶  PerpTradeForm
                        │
                        ▼
              drift.openPerpOrder({
                marketIndex, direction,
                size, orderConfig, ...
              })
                        │
        ┌───────────────┴────────────────┐
        │  intercepted by                │
        │  installTradingFeeInterceptor  │ (lib/DriftClientWrapper.ts)
        └───────────────┬────────────────┘
                        │
              stash pendingPerpOrderFee
              { orderSize, assetType }
                        │
                        ▼
              originalOpenPerpOrder(...)
                        │ Drift SDK builds the trade
                        │ tx internally and calls
                        ▼
              driftClient.sendTransaction(tx)   ← intercepted
                        │
        ┌───────────────┴────────────────────┐
        │ 1. Compute fee in lamports         │
        │    (5 bps; if quote → use SOL      │
        │    oracle price)                   │
        │                                    │
        │ 2. Build SystemProgram.transfer    │
        │    fee → BUILDER_AUTHORITY         │
        │                                    │
        │ 3. If V0 VersionedTransaction:     │
        │      a. resolve all ALTs           │
        │      b. decompile message          │
        │      c. prepend fee instruction    │
        │      d. recompile to V0 message    │
        │      e. wrap in new V0 tx          │
        │    Else (legacy):                  │
        │      tx.instructions.unshift(fee)  │
        └───────────────┬────────────────────┘
                        │
                        ▼
        original sendTransaction(modifiedTx)
                        │
                        ▼
                 PHANTOM WALLET
        ┌───────────────────────────────────────┐
        │ Show full tx — TWO instructions:      │
        │   ① Transfer N lamports (fee)         │
        │   ② Drift placePerpOrder              │
        │ User reviews, clicks Approve          │
        │                                       │
        │ Wallet computes:                      │
        │   hash      = SHA-256(serialised msg) │
        │   signature = Ed25519.sign(hash, sk)  │
        │ Returns the signed tx                 │
        └───────────────┬───────────────────────┘
                        │
                        ▼
              SOLANA RPC submit
                        │
                        ▼
              Validator pipeline
                ├─ verify Ed25519 sig → ✅
                ├─ verify recent blockhash window → ✅
                ├─ debit lamports (fee instruction)  ✅
                └─ invoke Drift program (trade)      ✅
              Both succeed atomically.
                        │
                        ▼
                 txSignature
                        │
                        ▼
        recordFeeToDatabase  (POST /api/fee)
                        │
                        ▼
        Toast: "Trade executed" + receipt link
```

If the validator fails any step (insufficient lamports, signature mismatch, expired blockhash, Drift program error), it reverts both instructions. The fee is therefore **conditional on the trade succeeding** and the trade is **conditional on the fee succeeding**.

## 5. Lifecycle of a creator earning + claiming a fee

```
A user trades on /signals (an order created by a creator).
        │
        ▼
DriftClientWrapper interceptor runs as in §4 — fee transfers to BUILDER_AUTHORITY
        │
        ▼
recordFeeToDatabase writes a Fee row tagged with experienceId (= creator id)
        │
        ▼
Creator opens /creator
        │
        ├─▶ useCreatorFees → GET /api/fee?experienceId=…
        │        renders FeeHistoryTable (with Solscan + receipt links)
        │
        └─▶ Creator clicks "Claim earnings"
                  POST /api/fee-claim  → status PENDING
                          │
                          ▼
                  Admin opens /admin
                          │
                          ▼
                  PendingClaimsTable shows the request
                          │
                          ▼
                  Admin manually transfers SOL on-chain
                          │
                          ▼
                  PATCH /api/admin/claims with txSignature
                          │
                          ▼
                  Status → COMPLETED, PaymentHistoryTable shows row
                  with Solscan link + in-app /receipt link
```

The split policy is "50/50" but is enforced *off-chain* (admin discretion). The fee collection itself, however, is enforced *on-chain* via the atomic bundle.

## 6. State management & data plane

* **`AuthorityDrift`** is constructed once per `(environment, wallet)` in `useSetupDrift`. It owns subscriptions to Drift's price/account streams.
* When prices update, callbacks push into the matching Zustand store (`OraclePriceStore`, `MarkPriceStore`, `UserAccountDataStore`). Components subscribed to those stores re-render *automatically* — no polling.
* React Query (`@tanstack/react-query`) is used for HTTP data: `/api/fee`, `/api/trade`, etc. Stores plus React Query give a clean split between *streaming chain data* and *cached server data*.
* The interceptor (`installTradingFeeInterceptor`) is wired in **once**, immediately after `new AuthorityDrift(...)`. Calling it twice would double-charge.

---

# PART B — CRYPTOGRAPHY & BLOCKCHAIN CONCEPTS, IN DEPTH

## 7. Concept inventory

| Concept | Used here for | Course lecture group |
|---|---|---|
| Ed25519 (asymmetric ECC signature) | every Solana tx signature | L3–8 Cryptography |
| SHA-256 (cryptographic hash) | message integrity, avalanche demo | L3–8 |
| Digital signatures | binding a user to a transaction | L3–8 |
| Hash chains / Merkle trees | full SHA-256 Merkle tree library + live proof / tamper demo (`src/lib/merkle.ts`, `/verify` Section 4); same primitive Solana validators use for the bank hash | L3–8 / L9–14 |
| Wallets, key derivation, addresses | Phantom, `Keypair.generate()` | L9–14 |
| Transactions, fees, atomicity | atomic fee enforcement | L9–14 |
| Versioned tx + Address Lookup Tables | reduce account-key bytes | L9–14 / L16–19 |
| Replay protection (blockhash expiry) | Solana 150-block window | L22–24 |
| Smart contracts | Drift, SystemProgram | L20–21 |
| Cross-Program Invocation (CPI) | composed by `DriftClientWrapper.ts`; tree extracted by `src/lib/cpi.ts` and rendered live on `/explorer` (Drift CPI'ing into System / SPL Token / Pyth / Switchboard) | L20–21 |
| Decentralised oracles (Pyth, Switchboard) | live SOL price for USDC→SOL fee | L20–21 / L25–27 |
| Consensus (PoH + Tower BFT) | finality assumption | L9–14 / L25–27 |

The five educational routes (`/blockchain`, `/verify`, `/security`, `/benchmarks`, `/explorer`) make every one of these tangible — paste the URL and click through.

## 8. Asymmetric cryptography & Ed25519

**What it is.** A digital-signature scheme over the twisted Edwards curve `Curve25519`, defined by RFC 8032. Each user has a 32-byte private key and a 32-byte public key derived from it. Signing produces a 64-byte signature; verifying needs only the public key + message + signature.

**Why Solana picked it.** Compared to ECDSA over secp256k1 (Bitcoin/Ethereum):
* signatures are **deterministic** (same key + message ⇒ same signature) → eliminates an entire class of nonce-reuse bugs;
* verification is faster and **batchable** (validators check thousands of sigs/sec);
* signatures are 64 bytes vs ECDSA's variable 70–72 bytes;
* security level is 128 bits.

**Where it appears in our code.**

| Surface | File | Role |
|---|---|---|
| Real wallet sigs (production) | `@solana/wallet-adapter-react` via `WalletProvider.tsx` | Phantom signs every tx |
| In-browser sigs (demos) | `app/verify/page.tsx`, `app/security/page.tsx` | `tweetnacl.sign.detached(msg, sk)` and `tweetnacl.sign.detached.verify(msg, sig, pk)` |
| Demo keypair | `Keypair.generate()` (web3.js) | one-shot keys for demos with no wallet |

**How we *use* it (not just touch it).** The interceptor in `DriftClientWrapper.ts` does not call `sign` directly; it relies on the property that *whatever* message we hand to the wallet, the wallet's single Ed25519 signature will cover the entire byte sequence. By prepending the fee instruction *before* signing, we leverage Ed25519's coverage to make the fee non-removable.

**Useful because:** Ed25519's "signature covers the whole message" property is exactly what makes the atomic-fee guarantee a *cryptographic* fact rather than a *policy*.

## 9. Hash functions & SHA-256

**What it is.** A cryptographic hash function (FIPS 180-4) producing a 256-bit (32-byte) digest. Three required properties:
1. **Pre-image resistance** — given `H(x)` you can't find `x`.
2. **Second pre-image resistance** — given `x` you can't find `x' ≠ x` with the same hash.
3. **Collision resistance** — you can't find any pair `(x, x')` colliding.

A 4th observable property is the **avalanche effect**: any 1-bit change in input flips ≈ 50 % of output bits.

**Where Solana uses it implicitly:**
* the validator hashes the serialised tx message before checking the Ed25519 signature;
* PoH is a *verifiable delay function* built from chained SHA-256 hashes;
* block headers chain via SHA-256.

**Where we use it explicitly:**
* `app/verify/page.tsx` calls `crypto.subtle.digest("SHA-256", bytes)` to display the hash live, then displays a tampered hash next to it to *see* the avalanche.
* The "Hash Properties" section of the same page shows three different inputs that differ by 1 bit → three radically different hashes side-by-side.

**Useful because:** SHA-256 is the *integrity glue*. Without it, two different transaction messages could in principle produce the same signature, undermining the whole atomic-fee story.

## 10. Digital signatures = hash + asymmetric crypto

A digital signature is two pieces of code stitched together:

```
sign(message, privateKey)   = ed25519_sign( SHA-256(message), privateKey )
verify(message, sig, pubKey) = ed25519_verify( SHA-256(message), sig, pubKey )
```

Properties this gives a transaction:

| Property | Why it follows |
|---|---|
| **Authenticity** | only the holder of `privateKey` can produce a valid signature |
| **Integrity** | any byte change in `message` changes `SHA-256(message)` and `verify` fails |
| **Non-repudiation** | the signer cannot later deny producing the signature |

**How TRADEN-PROD weaponises this:** because the message includes *every* instruction byte, *every* account key, and the recent blockhash, a relayer or MITM cannot:
* drop the fee instruction
* rewrite the lamport amount
* swap the recipient pubkey
* reorder instructions
* substitute the trade for a different trade

…without invalidating the signature. The `/security` page proves all six attacks fail in real time.

## 11. Atomic transactions on Solana

**Definition.** A Solana transaction commits *all* its instructions in a single atomic unit. If any instruction returns an error, the runtime reverts every state change made by every prior instruction in the same transaction.

**Why this matters here.** Together with the single-signature property of Ed25519, atomicity gives us the equation:

> **(Fee instruction is in the message)  ∧  (signature is valid)  ∧  (atomic execution) ⇒ fee paid iff trade executed.**

So we don't need a custom on-chain program, a relayer, or an off-chain enforcement service. The Solana runtime itself enforces our policy because we reused two of its existing guarantees.

**Where it lives in code.** Nowhere explicitly — it is a property of the runtime we *rely on* in `DriftClientWrapper.ts` by prepending the fee instruction into the same message rather than building a second transaction.

## 12. Versioned transactions & ALTs

A V0 (versioned) transaction:
* compresses up to 256 account keys per tx via Address Lookup Tables (ALTs);
* references each lookup-table account by **1 byte** instead of the original 32;
* is required for any moderately complex DeFi flow (Drift's perp orders alone reference dozens of accounts).

**Where we touch this in code (`DriftClientWrapper.ts`):**

```ts
const decompiled = TransactionMessage.decompile(originalMessage, {
  addressLookupTableAccounts,                  // ← MUST be passed
});
const allInstructions = [feeInstruction, ...decompiled.instructions];
const modifiedMessage = new TransactionMessage({
  payerKey: decompiled.payerKey,
  instructions: allInstructions,
  recentBlockhash: decompiled.recentBlockhash,
}).compileToV0Message(addressLookupTableAccounts || []);
const modifiedTx = new VersionedTransaction(modifiedMessage);
```

**Subtleties learned the hard way:**
* ALTs must be resolved over RPC (`getAddressLookupTable`) **before** decompiling — otherwise instructions reference unresolvable indices.
* The same ALT array must be passed to `compileToV0Message`. Forgetting it yields a tx that the validator will reject with "AccountNotFound".

**Useful because:** without V0 + ALTs, Drift's complex perp instructions wouldn't fit alongside the fee instruction in one tx, and the atomic guarantee would collapse.

## 13. Replay protection

Every Solana transaction includes a `recentBlockhash`. Validators reject any tx whose blockhash is older than ~150 slots (≈ 1–2 minutes). The blockhash is part of the signed message, so it can't be swapped post-signing.

**Where it shows up:**
* It is what makes the "Replay Attack" scenario on `/security` a clear PASS — we re-submit the same signed bytes after simulated slot drift and observe the validator-side rejection logic in the demo.
* The `/verify` tamper matrix includes "swap blockhash" → ❌ INVALID, illustrating that even *valid* future blockhashes can't be substituted.

**Useful because:** without it, a network observer could replay your trade signature an hour later when the market moved against you. With it, signed transactions are essentially short-lived single-use tokens.

## 14. Decentralised price oracles (Pyth & Switchboard)

When a trade is denominated in USDC (a quote-asset trade), our 5-bps fee is a USDC amount, but Solana's `SystemProgram.transfer` only moves SOL/lamports. To convert, we read the live SOL/USDC price from Drift's oracle cache (which itself aggregates Pyth and Switchboard publishers).

```ts
// inside DriftClientWrapper.ts
const solPriceBigNum = oraclePriceCache[SOL_SPOT_ORACLE_KEY].price;
const lamports = feeUsdc.muln(1e9).div(solPriceBigNum);
```

**Why this matters academically:**
* it is a concrete example of an oracle being a *trusted external data source* for an on-chain action;
* if Pyth/Switchboard were single-source, we'd inherit their failure mode → both networks aggregate **dozens** of independent publishers and apply confidence intervals, mitigating that;
* it shows up in `PROJECT_ARCHITECTURE.md` §9.1 as the "Oracle Price Manipulation" row of the attack matrix.

## 15. Smart contracts vs application-layer enforcement

| Approach                            | Where logic runs        | Audit cost | Portability |
|-------------------------------------|-------------------------|------------|-------------|
| Custom on-chain program (Jupiter/Raydium) | Solana program (Rust)   | High       | Locked to that DEX |
| Drift built-in fee tier             | Drift program           | Already audited | Locked to Drift |
| **TRADEN-PROD (this project)**      | **Browser interceptor + atomic Solana runtime guarantees** | **Zero** (no new program) | **Works with any Solana DEX** |

Our novelty: we *don't* deploy a smart contract. The fee logic runs in the user's browser; what makes it *trustless* is that the resulting transaction's correctness is guaranteed by Solana's existing Ed25519 verification + atomic execution. No code we wrote runs on-chain in privileged mode.

The trade-off discussion (and a comparison table) lives in `PROJECT_ARCHITECTURE.md` §10.

## 16. Wallets, key derivation, identity

* **Wallet** = a piece of software that owns a private key (Phantom, Solflare, Backpack).
* **Public key** = the curve point derived from the private key; written in **base58** for display (e.g. `7Y9...XwH3`).
* **Address** on Solana = the public key itself (no hashing layer like Bitcoin's RIPEMD160(SHA-256(pubkey))).
* **Identity** in our app = *the public key string*. The admin page is gated by string-match against an allow-list of admin pubkeys; the creator dashboard is gated by Whop role + matched authority.
* **Demo keys** in `/verify` and `/security` use `Keypair.generate()` from `@solana/web3.js`, which produces a fresh 32-byte private key from CSPRNG entropy. We never persist these.

## 17. Solana consensus (PoH + Tower BFT)

We **do not** modify consensus, but the project's claim "this trade is final and the fee was paid" depends on three guarantees the network gives us:

1. **Proof of History** — a hash chain over time gives every event a verifiable order.
2. **Tower BFT** — a PBFT-style voting mechanism where validators lock votes on increasingly-deep slots, giving exponential security with confirmation depth.
3. **Confirmation finality** — once your tx hits "finalized" status it is on every honest validator's canonical chain.

Practically we wait for "confirmed" before showing success; the receipt page surfaces the slot so a reviewer can independently click through to Solscan and verify.

## 18. Comparison with Bitcoin & Ethereum

| Primitive      | Bitcoin                   | Ethereum                         | Solana (this project)            |
|----------------|---------------------------|----------------------------------|----------------------------------|
| Signature alg. | ECDSA / secp256k1         | ECDSA / secp256k1                | **Ed25519 / Curve25519**         |
| Address        | Base58Check(RIPEMD160(SHA256(pk))) | last 20 bytes of Keccak256(pk) | base58(pubkey) — no hash         |
| Tx model       | UTXO + Script             | account model + EVM bytecode     | account model + SVM (BPF)        |
| Fee mechanism  | inputs − outputs          | gasPrice × gas                   | per-signature + per-CU + priority |
| Atomicity unit | a transaction             | a transaction                    | a transaction (same)             |
| Smart contracts| limited Script            | Turing-complete EVM              | Turing-complete SVM (Rust/C)     |
| Block time     | ~10 min                   | ~12 s                            | ~400 ms                          |
| Finality       | probabilistic (6 confs)   | probabilistic / Casper-FFG       | Tower BFT, fast deterministic     |
| Replay defence | nonces in inputs (UTXO)   | per-account nonce                | recent blockhash window           |

The takeaway used in `/blockchain`: every concept the syllabus covers in the Bitcoin & Ethereum lectures has a Solana counterpart and is exercised by this project — usually with a faster / lighter-weight mechanism, e.g. Ed25519 vs ECDSA, blockhash window vs nonce, account model vs UTXO.

## 19. Where each concept is used in the code

A reverse index. Use this when you want to jump from "I need to point at the file that demonstrates X" to the exact location.

| Concept                          | File / Path                                       | Role                                                  |
|----------------------------------|---------------------------------------------------|-------------------------------------------------------|
| Ed25519 sign / verify (browser)  | `ui/src/app/verify/page.tsx`                      | live demo via `tweetnacl`                             |
| Ed25519 sign (production)        | `@solana/wallet-adapter-*` (Phantom)              | actual user signing                                   |
| SHA-256 in browser               | `ui/src/app/verify/page.tsx`                      | `crypto.subtle.digest`                                |
| Atomic fee bundling (V0)         | `ui/src/lib/DriftClientWrapper.ts`                | decompile/recompile + prepend                         |
| Atomic fee bundling (legacy)     | `ui/src/lib/tradingFee.ts`                        | `transaction.instructions.unshift`                    |
| Fee math (5 bps + USDC→SOL)      | `ui/src/lib/tradingFee.ts` / `DriftClientWrapper.ts` | calculation w/ oracle price                        |
| Address Lookup Table resolution  | `ui/src/lib/DriftClientWrapper.ts`                | `getAddressLookupTable` over RPC                      |
| Recent blockhash & replay        | `ui/src/app/security/page.tsx`                    | Replay-attack demo                                    |
| Oracle subscription              | `ui/src/hooks/globalSyncs/useSetupDrift.ts`       | `onOraclePricesUpdate` → `OraclePriceStore`           |
| Wallet identity / access gating  | `ui/src/components/layout/Header.tsx`             | admin & creator nav visibility                        |
| On-chain explorer of a single tx | `ui/src/app/explorer/page.tsx`                    | `connection.getParsedTransaction`                     |
| Per-tx receipt                   | `ui/src/app/receipt/[signature]/page.tsx`         | dynamic route                                         |
| Solscan deep link (env-aware)    | `ui/src/lib/solscan.ts`                           | `getSolscanTxUrl` / `getSolscanAddressUrl`            |
| Off-chain audit mirror           | `ui/src/schemas/{Fee,Trade,Signal,FeeClaim}.ts`   | Mongoose models keyed by `txSignature`                |
| Concept → code map (UI)          | `ui/src/app/blockchain/page.tsx`                  | the syllabus walk-through page                        |
| Performance evidence             | `ui/src/app/benchmarks/page.tsx`                  | size / latency / CU / construction-time benchmarks    |

---

*If you only remember three things from this document:*
1. **Ed25519's "signature covers the whole message"** + **Solana's atomic execution** = atomic fee enforcement, no smart contract required.
2. The interceptor in `lib/DriftClientWrapper.ts` and the fee builder in `lib/tradingFee.ts` are the *only* code you wrote that produces the contribution; everything else is plumbing or proof.
3. The five education routes (`/blockchain`, `/verify`, `/security`, `/benchmarks`, `/explorer`) plus `/receipt/[signature]` are how you *show* the contribution working live — they are what turns an opinion into evidence.
