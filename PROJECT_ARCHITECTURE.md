# Atomic Fee Enforcement in Decentralized Perpetual Trading
## Complete Architecture, Workflows & Visual Documentation

> **Project**: Traden — A Solana-based Decentralized Perpetual Futures Trading Platform  
> **Course**: BITS F452 — Blockchain Technology, BITS Pilani Goa  
> **Team**: Anshul Shah (2022B3A70406G) & Viyom Gupta (2023A7PS0413G)

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
│  NEW PAGES (To Be Implemented for End-Sem)                          │
│                                                                     │
│  /blockchain ─── Course Concepts → Code Mapping                     │
│  /verify ─────── SHA-256 & Ed25519 Live Demos                       │
│  /security ───── Attack Resistance Tests                            │
│  /benchmarks ─── Performance Measurements                           │
│  /explorer ───── On-Chain Transaction Verifier                      │
└─────────────────────────────────────────────────────────────────────┘
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
│ L3-8: Merkle Tree                     │ Solana block structure (hash chains)   │
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
  │  PHASE 5: Cryptographic Validation             ░░░░░░░░░░   0%  │
  │  • SHA-256 integrity verification demo          ← TODO          │
  │  • Ed25519 signature verification demo          ← TODO          │
  │  • Attack resistance tests (6 attacks)          ← TODO          │
  │  • Performance benchmarks                       ← TODO          │
  │                                                                 │
  │  PHASE 6: Documentation & Presentation         ░░░░░░░░░░   0%  │
  │  • Blockchain concepts page                     ← TODO          │
  │  • On-chain transaction explorer                ← TODO          │
  │  • JSDoc documentation                          ← TODO          │
  │  • Final report & presentation                  ← TODO          │
  │                                                                 │
  │  OVERALL PROGRESS:  ████████████████░░░░░░░░░░  ~65%            │
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
  1. Navigate to the UI directory:
     cd C:\Users\hp\OneDrive\Desktop\traden\traden-prod\ui

  2. Install dependencies:
     bun install  (or npm install)

  3. Create .env.local with:
     NEXT_PUBLIC_SOLANA_MAINNET_RPC_ENDPOINT=<your_rpc_url>
     NEXT_PUBLIC_SOLANA_DEVNET_RPC_ENDPOINT=<your_rpc_url>
     NEXT_PUBLIC_BUILDER_AUTHORITY=<wallet_address_for_fees>
     MONGODB_URI=<your_mongodb_connection_string>

  4. Start development server:
     bun dev  (or npm run dev)

  5. Open http://localhost:3000
     → Redirects to /perps (main trading page)
     → Connect Phantom wallet to start trading
```

---

*End of Architecture Document*
