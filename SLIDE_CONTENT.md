# SLIDE_CONTENT.md

Copy-paste-ready content for every slide of the deck. Each block matches
the read-aloud lines in `PRESENTATION_SCRIPT.md` — what's on the slide
is short and visual, what you say is the longer explanation.

How to use:

1. Open the slide in Gamma.
2. Replace the existing text on that slide with the content below.
3. Keep the diagram / table / icon layouts as described.
4. Move on to the next slide.

The on-slide text is deliberately **short**. Don't paste the script
itself on the slide — the slide is the visual, your voice is the story.

---

## Slide 1 — Title

**Title (line 1, large):**
```
TRADEN-PROD
```

**Title (line 2, smaller):**
```
Atomic Fee Enforcement in Decentralized Perpetual Trading on Solana
```

**Body (one short paragraph in the centre, white text):**
```
I bundle the platform fee and the user's trade into the same Solana
transaction. The user signs both with one Ed25519 signature. Either
both go through, or neither does — and there is no smart contract.
```

**Bottom credits (two small lines):**
```
Solo project · Viyom Gupta (2023A7PS0413G)
Stack: Solana · Drift Protocol · Next.js 15 · TypeScript · Ed25519 · MongoDB
```

---

## Slide 2 — The problem

**Title:**
```
Today's DEX Fees Are Easy to Bypass
```

**Left box — "How DEXs do it today" (red / amber tint):**
```
TX 1:  Trade        ✅ lands
TX 2:  Fee          ❌ can be dropped, reordered, or censored
```
Below: `Two transactions = two ways to fail.`

**Right box — "How I do it" (green tint):**
```
ONE transaction:  [ Fee  +  Trade ]
ONE Ed25519 signature covers BOTH
Solana runs them together — or not at all
```
Below: `One transaction · one signature · zero trust.`

**Three short cards along the bottom:**

```
1. The second TX is too easy to drop
   Users can refuse to sign it. Bots can reorder it.
   Middlemen can censor it.

2. Custom fee programs are expensive
   Audit costs, vendor lock-in, works for only one DEX.

3. My approach is structural
   The fee is part of the message the user signs.
   You can't un-sign half a signature.
```

---

## Slide 3 — How it works

**Title:**
```
How a Single Signature Locks the Fee to the Trade
```

**Left side — vertical 10-step numbered pipeline:**

```
1.  User clicks "Place Order" on /perps
2.  Drift SDK builds a V0 transaction
3.  DriftClientWrapper catches it before the wallet
4.  Resolves every Address Lookup Table
5.  Decompiles the V0 message
6.  Prepends SystemProgram.transfer (the fee)
7.  Recompiles with same payer / blockhash / ALTs
8.  Browser computes SHA-256 hash of the message
9.  Phantom signs the hash with the user's Ed25519 key
10. Validators verify the signature and run all instructions atomically
```

**Outcome banner below step 10 (full width):**
```
✅ both succeed   |   ❌ both revert
```

**Right side — three small cards stacked vertically:**

```
Ed25519 covers the WHOLE message
Change one byte → signature breaks.

Solana never runs half a transaction
All instructions go through, or none do.

The fee is now part of the signed hash
Removing it, changing it, or moving it
all break the signature.
```

---

## Slide 4 — Architecture

**Title:**
```
Five-Layer Architecture
```

**Subtitle:**
```
All my contribution is in Layer 3
```

**Five stacked blocks, top to bottom (highlight Layer 3 with a star and a brighter colour):**

```
1.  Presentation
    Next.js 15 · React 19 · Tailwind · 13 routes total

2.  State & Live Data
    Zustand stores + websocket streams (oracle, mark price, accounts)

3.  ⭐  ATOMIC FEE ENFORCEMENT
    DriftClientWrapper.ts catches the trade and bundles the fee.
    tradingFee.ts computes the 5-bps amount.

4.  Protocol & Wallet
    Drift SDK · @solana/web3.js · Wallet Adapter · tweetnacl

5.  Persistence & APIs
    Next.js API routes · MongoDB audit trail · Pyth + Switchboard
```

**Caption below the stack:**
```
Only Layer 3 is new work. Everything else is standard Solana / Next.js code.
```

---

## Slide 5 — Code inventory

**Title:**
```
The Files That Do the Work
```

**Left column — Core libraries (`src/lib/`):**

```
DriftClientWrapper.ts
   Catches every trade and prepends the fee.

tradingFee.ts
   Computes 5 bps. Converts USDC → SOL via live oracle.

cpi.ts
   Parses any transaction into a call tree.

merkle.ts
   SHA-256 Merkle tree, built from scratch.

solscan.ts
   Explorer links for every signature.
```

**Right column — New routes:**

```
/blockchain   → every concept → real file
/verify       → 4 in-browser crypto demos
/security     → 6 attack tests
/benchmarks   → overhead measured live
/explorer     → CPI tree for any signature
/receipt/[s]  → per-trade receipt page
```

**Bottom strip (single line, monospace):**
```
6 new lib files  ·  6 new routes  ·  6 API routes hardened  ·  ~9k LoC added
```

---

## Slide 6 — Features

**Title:**
```
A Real Trading App, With a Built-In Verification Surface
```

**Left column — Trading Platform:**

```
✅ 40+ perpetual markets, live oracle + mark prices
✅ Candlestick charts + websocket orderbook
✅ 5 order types: market, limit, TP, SL, oracle-limit
✅ Spot deposit / withdraw / swap
✅ Phantom + Solflare wallet support
✅ Signal marketplace with copy-execution
✅ Creator revenue sharing (50/50)
✅ Admin & creator dashboards
```

**Right column — Verification Surface:**

```
✅ /blockchain   — every concept → file in the repo
✅ /verify       — Ed25519 + SHA-256 + Merkle, live in browser
✅ /security     — 6 attacks, all defeated
✅ /benchmarks   — bytes / latency / CU measured
✅ /explorer     — on-chain CPI tree
✅ /receipt      — per-tx proof card
```

**Caption below both columns:**
```
Six pages let anyone click and verify the math themselves.
```

---

## Slide 7 — Live demo

**Title:**
```
Live Demo — 6 Steps That Prove the Whole Idea
```

**Thumbnail strip across the top (6 tabs, left to right):**

```
1. /perps                       — Connect Phantom + place market order
2. /receipt/<sig>               — Show the on-chain proof
3. /explorer                    — Render the CPI tree
4. /verify                      — Run the integrity wizard + Merkle demo
5. /security                    — Run all 6 attack tests
6. /benchmarks → /blockchain    — Show overhead + concept map
```

**Numbered narration blocks below the strip:**

```
01 — /perps
     Connect Phantom on devnet → SOL-PERP → 0.01-SOL market order.
     Wallet asks for ONE signature.

02 — /receipt
     Open the receipt page for that signature.
     Fee row + trade row both point to the same transaction.

03 — /explorer
     Paste the same signature. Three green checks:
     fee found, trade found, both in same atomic tx.
     Then the full CPI tree.

04 — /verify
     10-step integrity wizard.
     Merkle proof builder — tamper one leaf, proof breaks.
     No wallet needed.

05 — /security
     Click "Run all attack tests". All six turn green:
     replay, fake sig, fee strip, fee tamper, reorder, recipient swap.

06 — /benchmarks → /blockchain
     < 1 % overhead on every metric.
     Every concept → a real file.
```

**Footer caption:**
```
If devnet is slow, /verify and /security alone prove the whole idea —
no wallet, no RPC, no server.
```

---

## Slide 8 — Security

**Title:**
```
Six Attacks Implemented as Live Tests — All Defeated
```

**Six-row table (4 columns):**

| Attack                  | Why it fails                                      | How my test runs it                                          | ✓  |
|-------------------------|---------------------------------------------------|--------------------------------------------------------------|----|
| Fee removed             | Hash changes → Ed25519 verify fails               | Build `[fee, trade]`; rebuild without `ix[0]`; verify old sig | ✅ |
| Fee amount changed      | SHA-256 avalanche flips ~50 % of digest bits      | Flip 1 lamport; count differing bits in the two hashes        | ✅ |
| Recipient swapped (MITM)| Account keys are part of the signed message       | Replace recipient pubkey; verify old sig                      | ✅ |
| Replay                  | `recentBlockhash` window expires (~60 s)          | Sign with blockhash A; rebroadcast after blockhash B          | ✅ |
| Fake signature          | Ed25519 = 128-bit security on Curve25519          | Sign with key A; verify with key B; flip a sig byte           | ✅ |
| Instructions reordered  | Message bytes change → different SHA-256 digest   | Swap `ix[0]` and `ix[1]`; verify old sig                      | ✅ |

**Bottom visual — two hashes side by side:**

```
Original SHA-256:    a3f2c1e4b5d6...7890
Tampered SHA-256:    x9p8q7r6s5t4...1234
```

**Caption under hashes:**
```
1-lamport change → ~50 % of the digits change. That's the avalanche effect.
```

---

## Slide 9 — Performance + concepts

**Title:**
```
~0.07 % Overhead — and Every Concept Is in the Code
```

**Top half — four metric cards (2 × 2 grid):**

```
+64 bytes                          < 1 ms
per fee instruction                extra signing latency
(serialized V0 message)            (100-iter avg in browser)

~150 / 200,000 CU                  ~0.07 %
compute cost of one                total relative overhead
SystemProgram transfer             vs the unbundled trade
```

**Caption under metric cards:**
```
All measured live in the browser. Cheap because I deploy
no new on-chain code — just one extra instruction.
```

**Bottom half — 3 × 3 primitives grid (9 tiles total):**

```
Row 1
  🔑  Asymmetric Crypto      Ed25519 over Curve25519 — every Phantom signature
  #️⃣  SHA-256 + Merkle       merkle.ts + /verify §3–4
  ✍️  Digital Signatures     One Ed25519 sig covers every instruction

Row 2
  🪙  Wallets & Addresses    Phantom · base58 public keys
  🧾  Transactions           V0 messages + Address Lookup Tables
  ⚛️  Atomic Execution       SystemProgram.transfer + Drift in a single tx

Row 3
  ⏱  Replay Protection      recentBlockhash window (~150 blocks / ~60 s)
  📡  Decentralized Oracles  Pyth + Switchboard drive USDC → SOL
  🛡  Programs + CPI         cpi.ts + /explorer renders meta.innerInstructions
```

---

## Slide 10 — Closing

**Title:**
```
Monetization Without Trust. Trading Without Compromise.
```

**Top half — three takeaway cards:**

```
🔐  Cryptographic Guarantee
    Ed25519 + SHA-256 + Solana's atomic execution
    = an unbypassable fee. No new on-chain code.

🚀  Zero On-Chain Footprint
    All client-side TypeScript. Zero audit cost.
    Portable to any Solana DEX SDK.

🔬  Empirically Verified
    6 attacks tested live. 4 overhead metrics measured.
    Every claim links to a working demo.
```

**Bottom half — three "What's Next" cards:**

```
🌐  Mainnet Deployment
    Production builder authority + signed fee receipts.

⚙️  Cross-chain Port
    Sui / Aptos / Sei — same composition idea.

🤖  Dynamic Fee Engine
    DAO-governed, tier-aware fees, still atomic.
```

**Bottom-right corner:**
```
[QR code →  github.com/Viyom10/traden]
Caption: Live demo + repo
```

**No closing banner.** The slide title already says
"Monetization Without Trust. Trading Without Compromise." — don't repeat it.

---

## Footer (every slide)

```
Viyom Gupta · 2023A7PS0413G · github.com/Viyom10/traden
```

---

## Quick checklist after pasting

- [ ] Slide 1 title is on **two lines**, not six.
- [ ] Slide 1 has the credits + stack line at the bottom.
- [ ] Slide 3 has **10 numbered steps** in the order shown above, ending with the green/red outcome banner.
- [ ] Slide 7's tab strip and 01–06 narration blocks are in the **same order** (`/perps → /receipt → /explorer → /verify → /security → /benchmarks`).
- [ ] Slide 8's table has all 6 rows with green ticks.
- [ ] Slide 9's bottom grid has **9 tiles** (3 × 3), including `Digital Signatures`.
- [ ] Slide 10's "What's Next" cards each have a one-line caption.
- [ ] Slide 10 has no duplicated closing banner — just the title at the top and the QR code at the bottom-right.

Once those eight items are checked, the deck and the read-aloud script
in `PRESENTATION_SCRIPT.md` will line up perfectly.
