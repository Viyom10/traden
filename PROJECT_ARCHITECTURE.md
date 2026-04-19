# Atomic Fee Enforcement in Decentralized Perpetual Trading
## Complete Architecture, Workflows & Visual Documentation

> **Project**: Traden — A Solana-based Decentralized Perpetual Futures Trading Platform  
> **Course**: BITS F452 — Blockchain Technology, BITS Pilani Goa  
> **Author**: Viyom Gupta (2023A7PS0413G)

---

# 1. THE PROBLEM WE SOLVE

## 1.1 Current DEX Vulnerability

```
┌─────────────────────────────────────────────────────────────────┐
│                    CURRENT DEX MODEL (BROKEN)                   │
│                                                                 │
│   User clicks "Trade"                                           │
│        │                                                        │
│        ▼                                                        │
│   ┌──────────┐        ┌──────────┐                              │
│   │ TX #1:   │        │ TX #2:   │                              │
│   │ Execute  │───?───▶│ Collect  │   ← Two SEPARATE txns       │
│   │ Trade    │        │ Fee      │                              │
│   └──────────┘        └──────────┘                              │
│        │                   │                                    │
│        ▼                   ▼                                    │
│   ✅ Succeeds         ❌ May Fail!                              │
│                                                                 │
│   RESULT: User gets the trade, platform loses the fee.          │
│                                                                 │
│   Vulnerabilities:                                              │
│   • Fee Evasion — user drops fee TX before it hits network      │
│   • Partial Execution — fee fails but trade succeeds            │
│   • Race Conditions — MEV bots reorder transactions             │
└─────────────────────────────────────────────────────────────────┘
```

## 1.2 Our Solution: Atomic Fee Enforcement

```
┌─────────────────────────────────────────────────────────────────┐
│                     OUR MODEL (ATOMIC)                          │
│                                                                 │
│   User clicks "Trade"                                           │
│        │                                                        │
│        ▼                                                        │
│   ┌──────────────────────────────────────┐                      │
│   │         SINGLE TRANSACTION           │                      │
│   │  ┌────────────┐  ┌────────────────┐  │                      │
│   │  │ Instruction │  │ Instruction    │  │                      │
│   │  │ #1: Pay Fee │  │ #2: Execute    │  │                      │
│   │  │ (5 bps)     │  │ Trade (Drift)  │  │                      │
│   │  └────────────┘  └────────────────┘  │                      │
│   │                                      │                      │
│   │  ┌──────────────────────────────┐    │                      │
│   │  │  ONE Ed25519 Signature       │    │                      │
│   │  │  covers BOTH instructions    │    │                      │
│   │  └──────────────────────────────┘    │                      │
│   └──────────────────────────────────────┘                      │
│        │                                                        │
│        ▼                                                        │
│   BOTH succeed ✅  OR  BOTH fail ❌                             │
│   Fee evasion is MATHEMATICALLY IMPOSSIBLE                      │
└─────────────────────────────────────────────────────────────────┘
```

---

# 2. SYSTEM ARCHITECTURE

## 2.1 High-Level Architecture

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                              USER'S BROWSER                                   │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                     FRONTEND (Next.js 15 + React 19)                   │  │
│  │                                                                         │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────┐ ┌──────┐ ┌─────────┐ ┌─────────┐  │  │
│  │  │  Perps   │ │  Spot    │ │ User │ │ Data │ │ Creator │ │  Admin  │  │  │
│  │  │  Page    │ │  Page    │ │ Page │ │ Page │ │  Page   │ │  Page   │  │  │
│  │  └────┬─────┘ └────┬─────┘ └──┬───┘ └──┬───┘ └────┬────┘ └────┬────┘  │  │
│  │       │             │          │        │          │            │       │  │
│  │  ┌────▼─────────────▼──────────▼────────▼──────────▼────────────▼────┐  │  │
│  │  │                    ZUSTAND STATE STORES                           │  │  │
│  │  │  ┌───────────┐ ┌────────────┐ ┌───────────┐ ┌───────────────┐   │  │  │
│  │  │  │ DriftStore│ │OraclePrice │ │ MarkPrice │ │UserAccountData│   │  │  │
│  │  │  │           │ │  Store     │ │  Store    │ │    Store      │   │  │  │
│  │  │  └─────┬─────┘ └─────┬──────┘ └─────┬─────┘ └──────┬───────┘   │  │  │
│  │  └────────┼──────────────┼──────────────┼──────────────┼───────────┘  │  │
│  │           │              │              │              │              │  │
│  │  ┌────────▼──────────────▼──────────────▼──────────────▼───────────┐  │  │
│  │  │              ATOMIC FEE ENFORCEMENT LAYER                       │  │  │
│  │  │  ┌─────────────────────────────────────────────────────────┐    │  │  │
│  │  │  │  DriftClientWrapper.ts — Transaction Interceptor        │    │  │  │
│  │  │  │  ┌──────────────┐    ┌──────────────────────────────┐   │    │  │  │
│  │  │  │  │ tradingFee.ts│───▶│ Prepend fee instruction to   │   │    │  │  │
│  │  │  │  │ (5 bps calc) │    │ every trade transaction      │   │    │  │  │
│  │  │  │  └──────────────┘    └──────────────────────────────┘   │    │  │  │
│  │  │  └─────────────────────────────────────────────────────────┘    │  │  │
│  │  └────────────────────────────────┬───────────────────────────────┘  │  │
│  └───────────────────────────────────┼─────────────────────────────────┘  │
│                                      │                                    │
└──────────────────────────────────────┼────────────────────────────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
              ▼                        ▼                        ▼
┌──────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│  PHANTOM WALLET  │  │   SOLANA BLOCKCHAIN  │  │     MONGODB          │
│  (Ed25519 Keys)  │  │   (Devnet/Mainnet)   │  │   (Audit Trail)     │
│                  │  │                      │  │                      │
│ • Private Key    │  │ • Transaction        │  │ • Fee records        │
│ • Public Key     │  │   Processing         │  │ • Trade records      │
│ • Sign Txns      │  │ • Proof of History   │  │ • Signal records     │
│                  │  │ • Validator Network   │  │ • Fee Claims         │
└──────────────────┘  │ • Drift Program      │  └──────────────────────┘
                      │ • System Program     │
                      │ • Pyth Oracle        │
                      │ • Switchboard Oracle │
                      └──────────────────────┘
```

## 2.2 Component Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         APP LAYOUT (layout.tsx)                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  QueryProvider > WalletProvider > TooltipProvider             │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │  AppSetup (useGlobalSyncs → useSetupDrift)              │  │  │
│  │  ├─────────────────────────────────────────────────────────┤  │  │
│  │  │  HEADER                                                  │  │  │
│  │  │  ┌──────┬──────┬──────┬──────┬────────┬───────┐         │  │  │
│  │  │  │Perps │Signal│ User │ Spot │Creator │ Admin │         │  │  │
│  │  │  └──────┴──────┴──────┴──────┴────────┴───────┘         │  │  │
│  │  │  [UserAccountSelector] [EnvironmentToggle] [WalletBtn]  │  │  │
│  │  ├─────────────────────────────────────────────────────────┤  │  │
│  │  │  MAIN CONTENT (page routes)                              │  │  │
│  │  ├─────────────────────────────────────────────────────────┤  │  │
│  │  │  TOASTER (sonner - bottom right)                         │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## 2.3 Pages & What They Do

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ALL APPLICATION PAGES                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  /perps ──────── Main Trading Interface                             │
│  │               ├── Market Selector (40+ perpetual markets)        │
│  │               ├── Mark Price & Oracle Price display              │
│  │               ├── Candlestick Chart (WebSocket streaming)        │
│  │               ├── Trade Form (market/limit/TP/SL/oracle)         │
│  │               ├── Orderbook (WebSocket live data)                │
│  │               ├── Positions Table                                │
│  │               └── Open Orders Table                              │
│  │                                                                  │
│  /signals ────── Trading Signals                                    │
│  │               ├── View active signals from creator               │
│  │               └── Execute signals (auto-calculates size)         │
│  │                                                                  │
│  /user ────────── Account Management                                │
│  │               ├── Connected wallet info                          │
│  │               ├── Create Drift sub-accounts                      │
│  │               ├── Initial deposit form                           │
│  │               ├── Builder Code setup (RevenueShare)              │
│  │               └── Delete accounts                                │
│  │                                                                  │
│  /spot ────────── Spot Operations                                   │
│  │               ├── Deposit tokens into Drift                      │
│  │               ├── Withdraw tokens from Drift                     │
│  │               ├── Swap between tokens                            │
│  │               └── Spot balance table                             │
│  │                                                                  │
│  /creator ────── Creator Dashboard (admin-only)                     │
│  │               ├── Revenue earned from fees                       │
│  │               ├── Claim fee earnings                             │
│  │               ├── Create trading signals                         │
│  │               └── Manage signals                                 │
│  │                                                                  │
│  /admin ──────── Platform Admin (wallet-gated)                      │
│  │               ├── Fee statistics (total/today/week/month)        │
│  │               ├── RevenueShare account management                │
│  │               ├── Pending claim requests                         │
│  │               └── Payment history                                │
│  │                                                                  │
│  /data ────────── Market Data                                       │
│                  ├── All perp & spot market prices                   │
│                  ├── Oracle vs Mark price comparison                 │
│                  └── Spread, bid/ask data                           │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  EDUCATION & VERIFICATION PAGES (✅ Implemented)                    │
│                                                                     │
│  /blockchain ─── Course Concepts → Code Mapping                     │
│  │              ├── 7 expandable concept groups                     │
│  │              ├── Theory + file ref + live-demo links             │
│  │              └── Bitcoin / Ethereum / Solana comparison rows     │
│  │                                                                  │
│  /verify ──────── SHA-256 & Ed25519 Live Demos                      │
│  │              ├── 10-step transaction-integrity wizard            │
│  │              ├── Atomicity proof — multi-tamper matrix           │
│  │              ├── Avalanche-effect hash visualisation             │
│  │              └── Merkle proof builder + tamper test (NEW)        │
│  │                                                                  │
│  /security ────── Attack Resistance Tests                           │
│  │              ├── Replay  /  Signature Forgery                    │
│  │              ├── Fee Bypass  /  Fee Amount Manipulation          │
│  │              ├── Instruction Reorder  /  MITM Recipient Swap     │
│  │              └── "Run All" button → 6× PASS with byte-level diff │
│  │                                                                  │
│  /benchmarks ──── Performance Measurements                          │
│  │              ├── Tx-size overhead (bytes & %)                    │
│  │              ├── Sign latency (100-iter avg/min/max)             │
│  │              ├── Compute-unit estimate vs 200K budget            │
│  │              └── Construction-time delta                         │
│  │                                                                  │
│  /explorer ────── On-Chain Transaction Verifier                     │
│  │              ├── Paste signature → getParsedTransaction          │
│  │              ├── Highlights fee-instr + Drift-instr atomicity    │
│  │              ├── Renders the full CPI tree (NEW) — every nested  │
│  │              │   CPI from meta.innerInstructions, indented under │
│  │              │   its parent, with friendly program labels        │
│  │              └── Recent fees & trades from Mongo (clickable)     │
│  │                                                                  │
│  /receipt/[sig] ─ Per-Transaction Receipt (dynamic route)           │
│                  ├── Status, block, timestamp, blockhash            │
│                  ├── Fee details + recipient + percentage           │
│                  ├── Trade details (market, side, size)             │
│                  ├── Cryptographic proof block                      │
│                  └── Solscan deep-link (env aware)                  │
└─────────────────────────────────────────────────────────────────────┘
```

## 2.4 Education / Verification Layer File Map

```
ui/src/
├── app/
│   ├── blockchain/page.tsx          ← syllabus → codebase mapping
│   ├── verify/page.tsx              ← live SHA-256 + Ed25519 demos
│   ├── security/page.tsx            ← 6× attack simulations
│   ├── benchmarks/page.tsx          ← overhead measurements
│   ├── explorer/page.tsx            ← signature lookup + recent activity
│   └── receipt/[signature]/page.tsx ← per-tx receipt route
└── lib/
    ├── solscan.ts                   ← env-aware Solscan URL helpers
    │                                  (getSolscanTxUrl, getSolscanAddressUrl, shortSig)
    ├── merkle.ts                    ← SHA-256 Merkle tree + proof gen/verify
    │                                  (buildMerkleTree, getProof, verifyProof)
    │                                  — backs Section 4 of /verify
    └── cpi.ts                       ← CPI tree extractor
                                       (extractCpiTree, programLabel, friendly
                                       labels for System/SPL Token/Drift/Pyth/
                                       Switchboard/Compute Budget/ALT) — backs
                                       the Instruction & CPI tree on /explorer

External libs added (browser-only crypto):
  • tweetnacl ^1.0.3   — Ed25519 sign/verify in the browser
  • Web Crypto API     — built-in, used for SHA-256
```

---

# 3. CORE FLOW: HOW A TRADE HAPPENS (STEP BY STEP)

## 3.1 The Complete Trade Flow

```
 USER                    BROWSER (React App)                PHANTOM WALLET           SOLANA BLOCKCHAIN
  │                            │                                │                         │
  │  1. Clicks "Place Order"   │                                │                         │
  │ ──────────────────────────▶│                                │                         │
  │                            │                                │                         │
  │                    2. openPerpOrder()                        │                         │
  │                    called on AuthorityDrift                  │                         │
  │                            │                                │                         │
  │                    3. INTERCEPTED by our                     │                         │
  │                    DriftClientWrapper!                       │                         │
  │                            │                                │                         │
  │                    4. Stores pending fee info                │                         │
  │                    {orderSize, assetType, marketIndex}       │                         │
  │                            │                                │                         │
  │                    5. Drift SDK builds the                   │                         │
  │                    trade transaction internally              │                         │
  │                            │                                │                         │
  │                    6. sendTransaction() called               │                         │
  │                    → ALSO INTERCEPTED!                       │                         │
  │                            │                                │                         │
  │                    7. Fee Calculation:                       │                         │
  │                    fee = orderSize × 5/10000                 │                         │
  │                    (if USDC → convert to SOL via Oracle)     │                         │
  │                            │                                │                         │
  │                    8. Create fee instruction:                │                         │
  │                    SystemProgram.transfer(                   │                         │
  │                      from: user,                             │                         │
  │                      to: builderAuthority,                   │                         │
  │                      lamports: feeAmount                     │                         │
  │                    )                                         │                         │
  │                            │                                │                         │
  │                    9. BUNDLE:                                │                         │
  │                    Decompile original tx message             │                         │
  │                    Prepend fee instruction                   │                         │
  │                    Recompile to V0 message                   │                         │
  │                    Create new VersionedTransaction           │                         │
  │                            │                                │                         │
  │                            │  10. Send bundled tx for       │                         │
  │                            │      signing                    │                         │
  │                            │ ──────────────────────────────▶│                         │
  │                            │                                │                         │
  │  ┌─────────────────────────────────────────────────────┐    │                         │
  │  │            PHANTOM WALLET POPUP                      │    │                         │
  │  │                                                      │    │                         │
  │  │  "Approve Transaction"                               │    │                         │
  │  │                                                      │    │                         │
  │  │  Instruction 1: Transfer 0.005 SOL (fee)             │    │                         │
  │  │  Instruction 2: Drift Place Order                    │    │                         │
  │  │                                                      │    │                         │
  │  │  [Approve]  [Reject]                                 │    │                         │
  │  └─────────────────────────────────────────────────────┘    │                         │
  │                            │                                │                         │
  │  11. User clicks Approve   │                                │                         │
  │ ──────────────────────────▶│                                │                         │
  │                            │                                │                         │
  │                            │                   12. Phantom signs     │                │
  │                            │                   ENTIRE tx message     │                │
  │                            │                   with Ed25519 key      │                │
  │                            │                                │                         │
  │                            │                   SHA-256(message)      │                │
  │                            │                        │                │                │
  │                            │                        ▼                │                │
  │                            │                   Ed25519.sign(         │                │
  │                            │                     hash,               │                │
  │                            │                     privateKey          │                │
  │                            │                   ) = signature         │                │
  │                            │                                │                         │
  │                            │  13. Return signed tx          │                         │
  │                            │ ◀──────────────────────────────│                         │
  │                            │                                │                         │
  │                            │  14. Submit to Solana RPC      │                         │
  │                            │ ────────────────────────────────────────────────────────▶│
  │                            │                                │                         │
  │                            │                                │    15. Validator checks: │
  │                            │                                │    • Signature valid?    │
  │                            │                                │    • Blockhash recent?   │
  │                            │                                │    • Sufficient balance? │
  │                            │                                │                         │
  │                            │                                │    16. Execute ATOMICALLY│
  │                            │                                │    • Instruction 1: fee  │
  │                            │                                │      transfer ✅         │
  │                            │                                │    • Instruction 2: trade│
  │                            │                                │      execution ✅        │
  │                            │                                │                         │
  │                            │                                │    (If EITHER fails,    │
  │                            │                                │     BOTH revert ❌)     │
  │                            │                                │                         │
  │                            │  17. Return txSignature + slot │                         │
  │                            │ ◀────────────────────────────────────────────────────────│
  │                            │                                │                         │
  │                    18. Record fee to MongoDB                 │                         │
  │                    POST /api/fee                             │                         │
  │                            │                                │                         │
  │  19. Show success toast    │                                │                         │
  │  "Trade executed! Fee: X"  │                                │                         │
  │ ◀──────────────────────────│                                │                         │
  │                            │                                │                         │
```

## 3.2 Simplified Flow Diagram

```
  ┌──────────┐     ┌───────────────┐     ┌─────────────┐     ┌──────────────┐
  │  User    │     │  Fee Engine   │     │   Phantom   │     │   Solana     │
  │  Places  │────▶│  Calculates   │────▶│   Signs     │────▶│  Executes   │
  │  Order   │     │  & Bundles    │     │   Atomically│     │  Atomically │
  └──────────┘     └───────────────┘     └─────────────┘     └──────────────┘
                          │                                         │
                          │                                         │
                   ┌──────▼──────┐                           ┌──────▼──────┐
                   │  fee = size │                           │ If fee fails │
                   │  × 0.05%   │                           │ trade reverts│
                   └─────────────┘                           └─────────────┘
```

---

# 4. CRYPTOGRAPHIC CONCEPTS — HOW THEY WORK IN OUR SYSTEM

## 4.1 Ed25519 Digital Signature Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Ed25519 SIGNING PROCESS                          │
│                                                                     │
│  TRANSACTION MESSAGE (all instructions serialized)                  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Header: num_signers, num_readonly, num_accounts            │    │
│  │  Account Keys: [payer, fee_recipient, drift_program, ...]   │    │
│  │  Recent Blockhash: 5YJk...3mN8                              │    │
│  │  Instructions:                                               │    │
│  │    [0] SystemProgram.transfer(fee: 5000 lamports)           │    │
│  │    [1] DriftProgram.placePerpOrder(SOL-PERP, LONG, 1.5)    │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                              │                                      │
│                    ┌─────────▼─────────┐                            │
│                    │    SHA-256 HASH    │                            │
│                    │                   │                            │
│                    │  message_bytes    │                            │
│                    │       ↓           │                            │
│                    │  SHA-256(bytes)   │                            │
│                    │       ↓           │                            │
│                    │  hash = a3f8...   │  ← 32 bytes (256 bits)    │
│                    └─────────┬─────────┘                            │
│                              │                                      │
│                    ┌─────────▼─────────┐                            │
│                    │  Ed25519 SIGNING  │                            │
│                    │                   │                            │
│                    │  sign(hash,       │                            │
│                    │    privateKey)    │                            │
│                    │       ↓           │                            │
│                    │  signature =      │  ← 64 bytes               │
│                    │  b7e2c1...        │                            │
│                    └─────────┬─────────┘                            │
│                              │                                      │
│                    ┌─────────▼─────────┐                            │
│                    │   VERIFICATION    │                            │
│                    │                   │                            │
│                    │  verify(          │                            │
│                    │    message,       │                            │
│                    │    signature,     │                            │
│                    │    publicKey      │                            │
│                    │  ) = ✅ VALID     │                            │
│                    └───────────────────┘                            │
│                                                                     │
│  KEY PROPERTY: Change ANY byte in the message → hash changes       │
│                → signature becomes INVALID                          │
│                → transaction REJECTED by validators                 │
└─────────────────────────────────────────────────────────────────────┘
```

## 4.2 Why Atomic Bundling Works (Cryptographic Proof)

```
  SCENARIO 1: Normal transaction (both instructions present)
  ┌────────────────────────────────────────┐
  │ Message = [Fee Instr] + [Trade Instr]  │
  │ Hash    = SHA-256(Message) = H₁        │
  │ Sig     = Ed25519.sign(H₁, key) = S₁  │
  │ Verify  = verify(H₁, S₁, pubkey) ✅   │
  └────────────────────────────────────────┘

  SCENARIO 2: Attacker removes fee instruction
  ┌────────────────────────────────────────┐
  │ Message = [Trade Instr] only           │  ← Fee removed!
  │ Hash    = SHA-256(Message) = H₂        │  ← H₂ ≠ H₁
  │ Verify  = verify(H₂, S₁, pubkey) ❌   │  ← INVALID!
  │                                        │
  │ Even though the trade instruction is   │
  │ identical, the MESSAGE changed, so     │
  │ the hash changed, so the signature     │
  │ doesn't match. Solana REJECTS this.    │
  └────────────────────────────────────────┘

  SCENARIO 3: Attacker changes fee amount
  ┌────────────────────────────────────────┐
  │ Message = [Fee: 0 lamports] + [Trade]  │  ← Fee zeroed!
  │ Hash    = SHA-256(Message) = H₃        │  ← H₃ ≠ H₁
  │ Verify  = verify(H₃, S₁, pubkey) ❌   │  ← INVALID!
  └────────────────────────────────────────┘

  SCENARIO 4: Attacker changes fee recipient
  ┌────────────────────────────────────────┐
  │ Message = [Fee to attacker] + [Trade]  │  ← Recipient swapped!
  │ Hash    = SHA-256(Message) = H₄        │  ← H₄ ≠ H₁
  │ Verify  = verify(H₄, S₁, pubkey) ❌   │  ← INVALID!
  └────────────────────────────────────────┘

  ∴ Fee evasion is MATHEMATICALLY IMPOSSIBLE
```

## 4.3 SHA-256 Avalanche Effect

```
  Input 1:  "Transfer 5000 lamports to builder"
  SHA-256:  a3f8e2b1c4d5... (64 hex chars)

  Input 2:  "Transfer 5001 lamports to builder"  ← just 1 lamport difference
  SHA-256:  7c19d4a8f3e6... (64 hex chars)       ← completely different!

  ┌────────────────────────────────────────────────────┐
  │  Bit comparison:                                    │
  │                                                    │
  │  Hash 1: 1010 0011 1111 1000 1110 0010 1011 0001   │
  │  Hash 2: 0111 1100 0001 1001 1101 0100 1010 1000   │
  │  Diff:   ▲▲▲▲ ▲▲▲▲ ▲▲▲▲ ▲▲▲▲ ▲▲▲▲ ▲▲▲▲ ▲▲▲▲ ▲▲▲▲   │
  │                                                    │
  │  ~50% of bits changed = AVALANCHE EFFECT           │
  │  This makes it impossible to predict what input    │
  │  produces a desired output (pre-image resistance)  │
  └────────────────────────────────────────────────────┘
```

---

# 5. DATA FLOW & STATE MANAGEMENT

## 5.1 Zustand Store Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        ZUSTAND STORES                                │
│                                                                      │
│  ┌─────────────────────┐    ┌──────────────────────┐                │
│  │     DriftStore       │    │   OraclePriceStore   │                │
│  │                     │    │                      │                │
│  │ • drift: AuthDrift  │    │ • lookup: {          │                │
│  │ • environment       │    │     "SOL-PERP":      │                │
│  │ • walletSpotBals    │    │       { price: BN }, │                │
│  │ • spotMarketConfigs │    │     "BTC-PERP":      │                │
│  │ • perpMarketConfigs │    │       { price: BN }  │                │
│  │                     │    │   }                  │                │
│  │ Persisted: env only │    │                      │                │
│  └──────────┬──────────┘    └──────────┬───────────┘                │
│             │                          │                            │
│             │         ┌────────────────┘                            │
│             │         │                                             │
│  ┌──────────▼─────────▼──┐    ┌─────────────────────────────────┐  │
│  │    MarkPriceStore     │    │    UserAccountDataStore          │  │
│  │                       │    │                                  │  │
│  │ • lookup: {           │    │ • lookup: { accounts... }        │  │
│  │     "SOL-PERP":       │    │ • activeSubAccountId             │  │
│  │       { markPrice,    │    │ • revenueShareEscrow             │  │
│  │         bestBid,      │    │ • revenueShareAccount            │  │
│  │         bestAsk }     │    │ • getCurrentAccount()            │  │
│  │   }                   │    │                                  │  │
│  └───────────────────────┘    └─────────────────────────────────┘  │
│                                                                      │
│  ┌───────────────────────┐                                          │
│  │      UserStore        │    Source: Whop authentication            │
│  │                       │                                          │
│  │ • whopUser            │                                          │
│  │ • userId              │                                          │
│  │ • accessLevel         │  ← "admin" | "customer" | "no_access"   │
│  │ • experienceId        │                                          │
│  └───────────────────────┘                                          │
└──────────────────────────────────────────────────────────────────────┘

         DATA FLOW:
         AuthorityDrift.subscribe()
              │
              ├──▶ onOraclePricesUpdate() ──▶ OraclePriceStore
              ├──▶ onMarkPricesUpdate()   ──▶ MarkPriceStore
              └──▶ onUserAccountUpdate()  ──▶ UserAccountDataStore
```

## 5.2 API Routes & Database

```
┌────────────────────────────────────────────────────────────────────┐
│                      NEXT.JS API ROUTES                            │
│                                                                    │
│  POST /api/fee ────────────────┐                                   │
│  GET  /api/fee                 │     ┌──────────────────────────┐  │
│                                ├────▶│  MongoDB: Fee Collection │  │
│  POST /api/trade ──────────────┤     │                          │  │
│  GET  /api/trade               │     │  • userId                │  │
│                                │     │  • experienceId          │  │
│  POST /api/signal ─────────────┤     │  • feeAmount (SOL)       │  │
│  GET  /api/signal              │     │  • feeInLamports         │  │
│  PATCH /api/signal             │     │  • orderSize             │  │
│  DELETE /api/signal            │     │  • assetType             │  │
│                                │     │  • txSignature           │  │
│  POST /api/fee-claim ──────────┤     │  • timestamp             │  │
│  GET  /api/fee-claim           │     └──────────────────────────┘  │
│  DELETE /api/fee-claim         │                                   │
│                                │     ┌──────────────────────────┐  │
│  GET  /api/admin/stats ────────┤     │ MongoDB: Trade           │  │
│  GET  /api/admin/claims ───────┤     │ MongoDB: Signal          │  │
│  PATCH /api/admin/claims ──────┘     │ MongoDB: FeeClaim        │  │
│                                      └──────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

---

# 6. FEE ENFORCEMENT ENGINE — DETAILED INTERNALS

## 6.1 Transaction Interceptor Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│            installTradingFeeInterceptor(drift)                     │
│                                                                    │
│  Called once during useSetupDrift initialization                    │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  STEP 1: Save original methods                               │  │
│  │                                                              │  │
│  │  originalSendTransaction = driftClient.sendTransaction       │  │
│  │  originalOpenPerpOrder   = drift.openPerpOrder               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  STEP 2: Override openPerpOrder                              │  │
│  │                                                              │  │
│  │  drift.openPerpOrder = async (params) => {                   │  │
│  │    if (isSwiftOrder) → skip fee, call original               │  │
│  │    else → store pendingPerpOrderFee = {                      │  │
│  │              orderSize, assetType, marketIndex                │  │
│  │           }                                                  │  │
│  │    call originalOpenPerpOrder(params)                         │  │
│  │    clear pendingPerpOrderFee                                  │  │
│  │  }                                                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  STEP 3: Override sendTransaction                            │  │
│  │                                                              │  │
│  │  driftClient.sendTransaction = async (tx, ...) => {          │  │
│  │    if (pendingPerpOrderFee exists) {                          │  │
│  │      → Calculate fee (5 bps)                                  │  │
│  │      → If quote asset → convert via Oracle                    │  │
│  │      → Create SystemProgram.transfer instruction              │  │
│  │      → If VersionedTransaction:                               │  │
│  │          → Resolve Address Lookup Tables                      │  │
│  │          → Decompile message                                  │  │
│  │          → Prepend fee instruction                            │  │
│  │          → Recompile to V0 message                            │  │
│  │          → Create new VersionedTransaction                    │  │
│  │      → If Legacy Transaction:                                 │  │
│  │          → Unshift fee instruction                            │  │
│  │      → Send modified transaction                              │  │
│  │      → Record fee to MongoDB (async, non-blocking)            │  │
│  │    } else {                                                   │  │
│  │      → Send original transaction (no fee)                     │  │
│  │    }                                                          │  │
│  │  }                                                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

## 6.2 Fee Calculation Logic

```
┌────────────────────────────────────────────────────────────────────┐
│                    FEE CALCULATION FLOW                             │
│                                                                    │
│  Input: orderSize (BigNum), assetType ("base" | "quote")           │
│                                                                    │
│  ┌─────────────────────────────────┐                               │
│  │ fee = orderSize × 5 ÷ 10000    │  ← 5 basis points = 0.05%    │
│  └──────────────┬──────────────────┘                               │
│                 │                                                   │
│         ┌───────▼───────┐                                          │
│         │  Asset Type?   │                                          │
│         └───┬───────┬───┘                                          │
│             │       │                                              │
│        BASE │       │ QUOTE                                         │
│        (SOL)│       │ (USDC)                                        │
│             │       │                                              │
│             ▼       ▼                                              │
│  ┌──────────────┐  ┌────────────────────────────────────────┐      │
│  │ feeInLamports│  │ Convert USDC fee to SOL:               │      │
│  │ = feeAmount  │  │                                        │      │
│  │ (already in  │  │ Get SOL oracle price from Pyth         │      │
│  │  lamports)   │  │ feeInLamports = feeUSDC * 1e9 / price  │      │
│  └──────────────┘  │                                        │      │
│                    │ Example:                                │      │
│                    │  feeUSDC = 0.50 USDC                    │      │
│                    │  SOL price = $150                        │      │
│                    │  feeSOL = 0.50/150 = 0.00333 SOL        │      │
│                    │  feeLamports = 3,333,333                 │      │
│                    └────────────────────────────────────────┘      │
│                                                                    │
│  Output: SystemProgram.transfer({                                  │
│            from: userWallet,                                       │
│            to: BUILDER_AUTHORITY,  ← from env variable             │
│            lamports: feeInLamports                                 │
│          })                                                        │
└────────────────────────────────────────────────────────────────────┘
```

---

# 7. REVENUE SHARE MODEL

## 7.1 Fee Split Flow

```
                         EVERY TRADE
                             │
                             ▼
                    ┌─────────────────┐
                    │  Platform Fee   │
                    │  = 0.05% of    │
                    │  order size    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │    50% / 50%    │
                    │     SPLIT      │
                    └───┬────────┬───┘
                        │        │
              ┌─────────▼──┐  ┌──▼─────────┐
              │  PLATFORM  │  │  CREATOR   │
              │  (Admin)   │  │  (Exp.     │
              │            │  │   Owner)   │
              │  Viewed in │  │            │
              │  /admin    │  │  Viewed in │
              │  stats     │  │  /creator  │
              │            │  │  dashboard │
              └────────────┘  └──────┬─────┘
                                     │
                              ┌──────▼─────┐
                              │ Creator    │
                              │ Claims Fee │
                              │ via        │
                              │ /creator   │
                              └──────┬─────┘
                                     │
                              ┌──────▼─────┐
                              │ Admin      │
                              │ Processes  │
                              │ Claim in   │
                              │ /admin     │
                              └──────┬─────┘
                                     │
                              ┌──────▼─────┐
                              │ Creator    │
                              │ Receives   │
                              │ SOL        │
                              └────────────┘
```

## 7.2 Fee Claim Workflow

```
  Status Flow:

  ┌──────────┐     ┌────────────┐     ┌───────────┐     ┌───────────┐
  │ PENDING  │────▶│ PROCESSING │────▶│ COMPLETED │     │  FAILED   │
  │          │     │            │     │           │     │           │
  │ Creator  │     │ Admin      │     │ SOL sent  │     │ Payment   │
  │ submits  │     │ reviews    │     │ to creator│     │ failed    │
  │ claim    │     │ & pays     │     │           │     │           │
  └──────────┘     └────────────┘     └───────────┘     └───────────┘
       │                                                      ▲
       │                                                      │
       └──────────── DELETE (cancel) ─────────────────────────┘
                    (only if pending)
```

---

# 8. SIGNAL SYSTEM FLOW

```
  ┌──────────────┐                               ┌──────────────┐
  │   CREATOR    │                               │   CUSTOMER   │
  │   (/creator) │                               │   (/signals) │
  └──────┬───────┘                               └──────┬───────┘
         │                                              │
  1. Creates Signal                              5. Sees active signals
     • Market: SOL-PERP                                 │
     • Direction: LONG                                  │
     • Leverage: 2x                              6. Clicks "Execute"
     • Take Profit: +5%                                 │
     • Stop Loss: -3%                                   │
     • Expiry: 30 min                            7. System auto-calculates:
         │                                          • Position size =
  2. POST /api/signal                                account balance × 2x
         │                                          • Base size =
         ▼                                           positionUSD / price
  ┌──────────────┐                                  • TP price =
  │   MongoDB    │                                   current × 1.05
  │   signals    │◀──── 3. Stored ────────────      • SL price =
  │   collection │                                   current × 0.97
  └──────┬───────┘                                      │
         │                                        8. drift.openPerpOrder()
  4. GET /api/signal ─────────────────────────▶         │
     (active, non-expired)                        9. Fee interceptor adds
                                                     5 bps fee atomically
                                                        │
                                                  10. Transaction signed
                                                      & submitted
```

---

# 9. SECURITY ARCHITECTURE

## 9.1 Attack Resistance Summary

```
┌────────────────────┬────────────────────────┬──────────────────────────────┐
│     ATTACK          │  PROTECTION            │  HOW IT WORKS                │
├────────────────────┼────────────────────────┼──────────────────────────────┤
│                    │                        │                              │
│  Fee Evasion       │  Atomic Bundling       │  Fee + Trade in ONE tx       │
│  (remove fee tx)   │  + Ed25519 Signature   │  Single signature covers     │
│                    │                        │  both → can't separate       │
│                    │                        │                              │
├────────────────────┼────────────────────────┼──────────────────────────────┤
│                    │                        │                              │
│  Fee Amount        │  SHA-256 Integrity     │  Any byte change in fee      │
│  Manipulation      │                        │  amount changes message      │
│                    │                        │  hash → sig invalid          │
│                    │                        │                              │
├────────────────────┼────────────────────────┼──────────────────────────────┤
│                    │                        │                              │
│  Replay Attack     │  Recent Blockhash      │  Each tx has a blockhash     │
│  (resubmit old tx) │  Expiry                │  that expires in ~2 min      │
│                    │                        │  Old tx rejected by validators│
│                    │                        │                              │
├────────────────────┼────────────────────────┼──────────────────────────────┤
│                    │                        │                              │
│  Signature         │  Ed25519               │  128-bit security level      │
│  Forgery           │  (Curve25519 ECC)      │  2¹²⁸ ops to forge          │
│                    │                        │  Computationally infeasible  │
│                    │                        │                              │
├────────────────────┼────────────────────────┼──────────────────────────────┤
│                    │                        │                              │
│  Instruction       │  SHA-256 over          │  Reordering changes the     │
│  Reordering        │  entire message        │  serialized message bytes    │
│                    │                        │  → different hash → sig      │
│                    │                        │  invalid                     │
│                    │                        │                              │
├────────────────────┼────────────────────────┼──────────────────────────────┤
│                    │                        │                              │
│  Recipient Swap    │  Account keys in       │  Fee recipient (builder     │
│  (redirect fee)    │  signed message        │  authority) is part of the   │
│                    │                        │  signed message. Changing    │
│                    │                        │  it invalidates signature    │
│                    │                        │                              │
├────────────────────┼────────────────────────┼──────────────────────────────┤
│                    │                        │                              │
│  Oracle Price      │  Decentralized         │  Pyth + Switchboard use     │
│  Manipulation      │  Oracle Networks       │  multiple validators.        │
│                    │                        │  Single source can't fake    │
│                    │                        │  price data.                 │
│                    │                        │                              │
└────────────────────┴────────────────────────┴──────────────────────────────┘
```

---

# 10. COMPARISON WITH OTHER APPROACHES

```
┌──────────────┬───────────────────┬───────────────┬───────────────┬────────────────────┐
│              │ Jupiter           │ Raydium       │ Drift Native  │ OUR APPROACH       │
│              │ (Solana DEX)      │ (Solana AMM)  │ (RevenueShare)│ (Atomic Bundling)  │
├──────────────┼───────────────────┼───────────────┼───────────────┼────────────────────┤
│ Fee Layer    │ Inside swap       │ Inside AMM    │ Inside Drift  │ Transaction layer  │
│              │ program           │ math          │ program       │ (application)      │
├──────────────┼───────────────────┼───────────────┼───────────────┼────────────────────┤
│ Atomicity    │ Program-level     │ Program-level │ Protocol-level│ Transaction-level  │
├──────────────┼───────────────────┼───────────────┼───────────────┼────────────────────┤
│ Requires     │ Yes (on-chain     │ Yes (on-chain │ Yes (protocol │ NO (no on-chain    │
│ Custom       │ program)          │ program)      │ integration)  │ program needed!)   │
│ Program?     │                   │               │               │                    │
├──────────────┼───────────────────┼───────────────┼───────────────┼────────────────────┤
│ Portable?    │ No (Jupiter only) │ No (Raydium   │ No (Drift     │ YES (works with    │
│              │                   │ only)         │ only)         │ ANY Solana DEX!)   │
├──────────────┼───────────────────┼───────────────┼───────────────┼────────────────────┤
│ Audit Cost   │ $100K+            │ $100K+        │ $0 (built-in) │ $0 (no smart       │
│              │                   │               │               │ contract to audit) │
├──────────────┼───────────────────┼───────────────┼───────────────┼────────────────────┤
│ Security     │ Program bugs      │ Program bugs  │ Protocol bugs │ Math guarantees    │
│ Model        │                   │               │               │ (Ed25519 + SHA-256)│
└──────────────┴───────────────────┴───────────────┴───────────────┴────────────────────┘

  Our approach is UNIQUE because:
  • No smart contract deployment needed
  • Works with ANY DEX protocol on Solana
  • Security comes from MATH, not code correctness
  • Zero audit costs
  • Portable across the ecosystem
```

---

# 11. COURSE SYLLABUS → PROJECT MAPPING

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  BITS F452 SYLLABUS TOPIC              │  WHERE IN OUR PROJECT                  │
├────────────────────────────────────────┼────────────────────────────────────────┤
│ L1-2: Blockchain Types, DLT           │ Solana = permissionless, public        │
│                                        │ blockchain with distributed ledger     │
├────────────────────────────────────────┼────────────────────────────────────────┤
│ L3-8: Symmetric Crypto                │ N/A (not needed for this use case)     │
├────────────────────────────────────────┼────────────────────────────────────────┤
│ L3-8: Asymmetric Crypto (ECC)         │ Ed25519 key pairs via Phantom wallet   │
│                                        │ → every transaction signing            │
├────────────────────────────────────────┼────────────────────────────────────────┤
│ L3-8: Hash Functions                  │ SHA-256 in transaction signing pipeline │
│                                        │ → integrity of atomic bundle           │
├────────────────────────────────────────┼────────────────────────────────────────┤
│ L3-8: Digital Signatures              │ Ed25519 signature = single sig covers  │
│                                        │ fee + trade atomically                 │
├────────────────────────────────────────┼────────────────────────────────────────┤
│ L3-8: Merkle Tree                     │ src/lib/merkle.ts (full SHA-256 tree   │
│                                        │ + proof gen/verify) demoed live on     │
│                                        │ /verify Section 4. Same primitive that │
│                                        │ Solana validators use for bank-hash.   │
├────────────────────────────────────────┼────────────────────────────────────────┤
│ L9-14: Wallets & Addresses            │ Phantom wallet, PublicKey.toBase58()   │
├────────────────────────────────────────┼────────────────────────────────────────┤
│ L9-14: Transactions                   │ VersionedTransaction, V0 format,       │
│                                        │ instructions, Account keys             │
├────────────────────────────────────────┼────────────────────────────────────────┤
│ L9-14: Transaction Fees               │ Our 5 bps fee + Solana gas fees        │
├────────────────────────────────────────┼────────────────────────────────────────┤
│ L9-14: Mining & Consensus             │ Solana: Proof of History + Tower BFT   │
├────────────────────────────────────────┼────────────────────────────────────────┤
│ L16-19: Ethereum vs Solana            │ Comparison: EVM vs SVM, accounts model │
├────────────────────────────────────────┼────────────────────────────────────────┤
│ L20-21: Smart Contracts               │ Drift Program, SystemProgram = on-chain│
│                                        │ programs; our fee logic = app-layer    │
│                                        │ "contract"                             │
├────────────────────────────────────────┼────────────────────────────────────────┤
│ L20-21: Cross-Program Invocation      │ src/lib/cpi.ts (extractCpiTree) +      │
│                                        │ /explorer renders the live CPI tree    │
│                                        │ from meta.innerInstructions for any    │
│                                        │ signature (Drift → System / SPL Token /│
│                                        │ Pyth / Switchboard)                    │
├────────────────────────────────────────┼────────────────────────────────────────┤
│ L22-24: Replay Attacks                │ Blockhash expiry prevents replay       │
├────────────────────────────────────────┼────────────────────────────────────────┤
│ L22-24: Transaction Malleability      │ Ed25519 deterministic signatures       │
│                                        │ prevent malleability                   │
├────────────────────────────────────────┼────────────────────────────────────────┤
│ L22-24: Identity & Authentication     │ Wallet public key = identity           │
│                                        │ Admin gating by wallet address         │
├────────────────────────────────────────┼────────────────────────────────────────┤
│ L25-27: Scalability                   │ Solana's 65K TPS, minimal fee          │
│                                        │ overhead proven by benchmarks          │
├────────────────────────────────────────┼────────────────────────────────────────┤
│ L28-29: Applications (Finance)        │ DeFi perpetual futures trading         │
│                                        │ with real money on Solana mainnet      │
└────────────────────────────────────────┴────────────────────────────────────────┘
```

---

# 12. TECH STACK VISUAL

```
  ┌──────────────────────────────────────────────────────┐
  │                   PRESENTATION LAYER                  │
  │  ┌──────────────────────────────────────────────────┐│
  │  │  Next.js 15 (App Router) + React 19 + TypeScript ││
  │  │  Tailwind CSS 4 + shadcn/ui + Lucide Icons       ││
  │  │  Zustand 5 (State) + React Query 5 (Server)      ││
  │  └──────────────────────────────────────────────────┘│
  ├──────────────────────────────────────────────────────┤
  │                   BUSINESS LOGIC LAYER                │
  │  ┌────────────────┐  ┌───────────────────────────┐   │
  │  │ DriftClient    │  │ Fee Calculation Engine     │   │
  │  │ Wrapper        │  │ • 5 bps computation        │   │
  │  │ (Interceptor)  │  │ • Oracle price conversion  │   │
  │  └────────────────┘  └───────────────────────────┘   │
  ├──────────────────────────────────────────────────────┤
  │                   BLOCKCHAIN LAYER                    │
  │  ┌──────────┐  ┌──────────┐  ┌────────────────────┐ │
  │  │ Solana   │  │ Drift    │  │ Wallet Adapter     │ │
  │  │ web3.js  │  │ SDK      │  │ (Phantom/Solflare) │ │
  │  │ v1.98    │  │ v2.143   │  │                    │ │
  │  └──────────┘  └──────────┘  └────────────────────┘ │
  ├──────────────────────────────────────────────────────┤
  │                   CRYPTOGRAPHIC LAYER                 │
  │  ┌──────────────────┐  ┌───────────────────────────┐ │
  │  │ Ed25519          │  │ SHA-256                    │ │
  │  │ (Signatures)     │  │ (Transaction Hashing)     │ │
  │  │ 128-bit security │  │ Avalanche effect          │ │
  │  │ 64-byte sigs     │  │ Pre-image resistance      │ │
  │  └──────────────────┘  └───────────────────────────┘ │
  ├──────────────────────────────────────────────────────┤
  │                   DATA LAYER                          │
  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
  │  │ MongoDB      │  │ Pyth Oracle  │  │ Switchboard│ │
  │  │ (Audit Trail)│  │ (Prices)     │  │ (Prices)   │ │
  │  └──────────────┘  └──────────────┘  └────────────┘ │
  ├──────────────────────────────────────────────────────┤
  │                   NETWORK LAYER                       │
  │  ┌──────────────────────────────────────────────────┐│
  │  │  Solana Blockchain (Devnet / Mainnet-Beta)       ││
  │  │  Proof of History + Tower BFT Consensus          ││
  │  │  ~400ms block time, 65K TPS capacity             ││
  │  └──────────────────────────────────────────────────┘│
  └──────────────────────────────────────────────────────┘
```

---

# 13. WHAT'S DONE vs WHAT'S REMAINING

```
  ┌─────────────────────────────────────────────────────────────────┐
  │                    PROJECT COMPLETION STATUS                     │
  │                                                                 │
  │  PHASE 1: Wallet & Blockchain Interaction      ██████████ 100%  │
  │  • Phantom wallet integration                                   │
  │  • Dual-environment (devnet/mainnet)                             │
  │  • Oracle price subscriptions                                    │
  │  • Drift SDK initialization                                     │
  │                                                                 │
  │  PHASE 2: Transaction & Fee Construction       ██████████ 100%  │
  │  • Transaction interceptor                                      │
  │  • Atomic fee bundling (V0 + Legacy)                             │
  │  • Fee calculation (5 bps)                                       │
  │  • Oracle-based USDC→SOL conversion                              │
  │                                                                 │
  │  PHASE 3: Trading Frontend                     ██████████ 100%  │
  │  • Perps trading (40+ markets)                                   │
  │  • Chart, orderbook, trade form                                  │
  │  • Positions & orders tables                                     │
  │  • Spot, User, Admin, Creator, Signals pages                     │
  │                                                                 │
  │  PHASE 4: Data Persistence & Revenue           ██████████ 100%  │
  │  • MongoDB schemas (Fee, Trade, Signal, Claim)                   │
  │  • API routes (6 endpoints)                                      │
  │  • 50/50 revenue split                                          │
  │  • Admin & Creator dashboards                                    │
  │                                                                 │
  │  PHASE 5: Cryptographic Validation             ██████████ 100%  │
  │  • SHA-256 integrity verification demo  (/verify)  ✅           │
  │  • Ed25519 signature verification demo  (/verify)  ✅           │
  │  • Attack resistance tests (6 attacks)  (/security) ✅          │
  │  • Performance benchmarks               (/benchmarks) ✅        │
  │                                                                 │
  │  PHASE 6: Documentation & Presentation         ██████████ 100%  │
  │  • Blockchain concepts page             (/blockchain) ✅        │
  │  • On-chain transaction explorer        (/explorer)  ✅         │
  │  • Per-transaction receipt route        (/receipt)   ✅         │
  │  • Solscan links across admin/creator tables         ✅         │
  │  • JSDoc on DriftClientWrapper / tradingFee /                   │
  │    useSetupDrift / FeeSchema / TradeSchema           ✅         │
  │  • Architecture, getting-started, and pitch docs     ✅         │
  │                                                                 │
  │  OVERALL PROGRESS:  ██████████████████████████  100%            │
  └─────────────────────────────────────────────────────────────────┘
```

---

# 14. QUICK GLOSSARY

| Term | Meaning |
|------|---------|
| **Atomic** | All-or-nothing. Either ALL instructions execute, or NONE do. |
| **Ed25519** | Elliptic curve digital signature algorithm. Solana's signing standard. |
| **SHA-256** | Secure Hash Algorithm producing 256-bit hash. Used in transaction pipeline. |
| **Lamports** | Smallest unit of SOL (1 SOL = 1,000,000,000 lamports). Like satoshis for Bitcoin. |
| **BPS (Basis Points)** | 1 bps = 0.01%. Our fee = 5 bps = 0.05%. |
| **VersionedTransaction (V0)** | Solana's modern transaction format supporting Address Lookup Tables. |
| **Address Lookup Table (ALT)** | Compressed account references to fit more instructions per transaction. |
| **Oracle** | Decentralized price feed (Pyth, Switchboard) providing real-time market prices. |
| **DriftClient** | SDK client for interacting with Drift Protocol (Solana's largest perp DEX). |
| **AuthorityDrift** | Simplified wrapper around DriftClient for easier integration. |
| **Builder Authority** | The wallet address that receives platform fees. |
| **RevenueShare** | Drift's on-chain account for tracking builder fee earnings. |
| **SystemProgram.transfer** | Solana's native instruction for transferring SOL between accounts. |
| **Prepend** | Insert an instruction BEFORE all other instructions (fee executes first). |
| **Interceptor** | Our code that modifies transactions before they're signed and sent. |
| **Zustand** | Lightweight React state management library (replaces Redux). |

---

# 15. HOW TO RUN THE PROJECT

```
  1. Clone & enter the UI directory:
     git clone https://github.com/Viyom10/traden.git
     cd traden/ui

  2. Install dependencies (the lockfile is bun.lock):
     bun install     # or: npm install / yarn install / pnpm install

  3. Create ui/.env.local with:
     NEXT_PUBLIC_SOLANA_MAINNET_RPC_ENDPOINT=<your_rpc_url>
     NEXT_PUBLIC_SOLANA_DEVNET_RPC_ENDPOINT=<your_rpc_url>
     NEXT_PUBLIC_BUILDER_AUTHORITY=<wallet_address_for_fees>
     MONGODB_URI=<your_mongodb_connection_string>

  4. Start development server:
     bun run dev     # or: npm run dev

  5. Open http://localhost:3000
     → Redirects to /perps (main trading page)
     → Connect Phantom wallet to start trading

  See GETTING_STARTED.md for the full demo script (the seven screens
  to show during a presentation, in order).
```

---

# 16. EDUCATION & VERIFICATION LAYER — INTERNALS

This is the layer that turns the project from "a working DEX" into
"a defensible academic artefact". Every page below runs entirely in
the browser using `Keypair.generate()` + `tweetnacl` + Web Crypto, so
it works without a wallet, without an RPC, and without MongoDB —
which makes it perfect for a live demo on any laptop.

## 16.1 `/verify` — SHA-256 + Ed25519 Wizard

```
┌────────────────────────────────────────────────────────────────────┐
│  10-STEP TRANSACTION INTEGRITY WIZARD                              │
│                                                                    │
│  Step 1.  Generate fresh Ed25519 keypair  (Keypair.generate)       │
│  Step 2.  Build "fee" instruction         (SystemProgram.transfer) │
│  Step 3.  Build "trade" instruction       (SystemProgram.transfer) │
│  Step 4.  Compile to TransactionMessage   (V0)                     │
│  Step 5.  Show SHA-256 of serialized message (hex)                 │
│  Step 6.  Sign hash with Ed25519 (tweetnacl.sign.detached)         │
│  Step 7.  Verify signature → ✅                                    │
│  Step 8.  Tamper: bump fee by 1 lamport, rebuild & re-hash         │
│  Step 9.  Diff old vs new hash (avalanche visible inline)          │
│  Step 10. Verify OLD signature against NEW hash → ❌ INVALID       │
│                                                                    │
│  TAMPER MATRIX (separate section)                                  │
│  ┌────────────────────────────┬────────────────────────────────┐   │
│  │ Tamper                     │ Signature still valid?         │   │
│  ├────────────────────────────┼────────────────────────────────┤   │
│  │ Remove fee instruction     │ ❌ INVALID                     │   │
│  │ Change fee amount          │ ❌ INVALID                     │   │
│  │ Change fee recipient       │ ❌ INVALID                     │   │
│  │ Reorder instructions       │ ❌ INVALID                     │   │
│  │ Swap recent blockhash      │ ❌ INVALID                     │   │
│  │ (control) untouched        │ ✅ VALID                       │   │
│  └────────────────────────────┴────────────────────────────────┘   │
│                                                                    │
│  MERKLE PROOF DEMO (Section 4)                                     │
│  • Edit a list of N leaves (free-form text, one per line).         │
│  • Page builds a SHA-256 Merkle tree using src/lib/merkle.ts       │
│    (domain-separated leaf/node hashing → second-preimage safe).    │
│  • Pick any leaf → see its ⌈log₂ N⌉ inclusion proof rendered as    │
│    {step, position, sibling-hash} rows.                            │
│  • Tamper input → reuse the same proof against the modified leaf   │
│    → verifier rejects ("root no longer matches").                  │
│  • Same primitive Solana validators use to commit to per-slot      │
│    account state changes via the bank hash.                        │
└────────────────────────────────────────────────────────────────────┘
```

## 16.2 `/security` — Six Attacks, All Run Live

```
┌─────────────────────────────────┬────────────────────────────────┐
│ Attack                          │ Test mechanism                 │
├─────────────────────────────────┼────────────────────────────────┤
│ Replay Attack                   │ Show recent-blockhash window;  │
│                                 │ simulate slot drift past 150   │
├─────────────────────────────────┼────────────────────────────────┤
│ Signature Forgery               │ Verify with WRONG pubkey → ❌  │
├─────────────────────────────────┼────────────────────────────────┤
│ Fee Bypass (remove instr)       │ Remove instr[0], reverify → ❌ │
├─────────────────────────────────┼────────────────────────────────┤
│ Fee Amount Manipulation         │ Zero-out lamports, reverify    │
├─────────────────────────────────┼────────────────────────────────┤
│ Instruction Reordering          │ Swap instr[0]/instr[1]         │
├─────────────────────────────────┼────────────────────────────────┤
│ MITM Recipient Swap             │ Replace toPubkey, reverify     │
└─────────────────────────────────┴────────────────────────────────┘

Each card emits PASS/FAIL plus the original-vs-tampered byte diff.
```

## 16.3 `/benchmarks` — Quantitative Proof

```
┌─────────────────────────────┬──────────────────────────────────┐
│ Metric                      │ What we measure                  │
├─────────────────────────────┼──────────────────────────────────┤
│ Transaction size            │ tx.serialize().length            │
│                             │ (no-fee vs fee-bundled)          │
├─────────────────────────────┼──────────────────────────────────┤
│ Signing latency             │ performance.now() × 100 iters,   │
│                             │ avg / min / max                  │
├─────────────────────────────┼──────────────────────────────────┤
│ Compute units               │ ~150 CU per System.transfer      │
│                             │ vs 200,000 CU budget = ~0.075%   │
├─────────────────────────────┼──────────────────────────────────┤
│ Construction time           │ end-to-end build time delta      │
└─────────────────────────────┴──────────────────────────────────┘

Take-away (rendered as a summary card):
  "Total overhead: ~64 bytes, sub-millisecond latency, ≤ 1% of CU
   budget — atomic fee enforcement is essentially free."
```

## 16.4 `/explorer` & `/receipt/[signature]` — On-Chain Truth

```
USER INPUT (signature)
        │
        ▼
   getParsedTransaction(sig, { maxSupportedTransactionVersion: 0 })
        │
        ├─▶ Status, slot, blockhash, fee paid (lamports)
        ├─▶ Instructions[]
        │     └─▶ Identify SystemProgram.transfer to BUILDER_AUTHORITY
        │     └─▶ Identify Drift program instruction
        │     └─▶ ✅ "Both present in same tx" → ATOMIC
        ├─▶ Solscan deep-link (?cluster=devnet on devnet)
        └─▶ Cross-reference with /api/fee + /api/trade rows for context

/receipt/[signature] adds: copy-buttons, beautiful card layout,
short-sig display, and a permanent shareable URL per trade.
```

## 16.5 Why This Layer Matters

It converts every claim in the report from prose into something a
reviewer can click and verify *during the presentation*:

| Claim                                            | Where to show it   |
| ------------------------------------------------ | ------------------ |
| "We use Ed25519 + SHA-256."                      | `/verify` step 5–6 |
| "Tampering invalidates the signature."           | `/verify` step 9   |
| "Merkle proofs verify membership in O(log N)."   | `/verify` Section 4|
| "Solana programs compose via CPI."               | `/explorer` (paste any sig) |
| "Six classes of attacks are blocked."            | `/security`        |
| "Overhead is negligible."                        | `/benchmarks`      |
| "Every fee is independently verifiable on-chain."| `/explorer`        |
| "Each trade has a shareable receipt."            | `/receipt/<sig>`   |
| "Concepts map to the BITS F452 syllabus."        | `/blockchain`      |

---

*End of Architecture Document*
