# TRADEN-PROD — Final Project Pitch

> A speak-it-as-it-is script.
> Total spoken time: about **6 minutes** at a comfortable pace.
> Single presenter: Viyom Gupta (2023A7PS0413G).

---

## OPENING — 30 seconds

Good [morning / afternoon], professor. I am Viyom Gupta (2023A7PS0413G), and my project is called **TRADEN-PROD — Atomic Fee Enforcement in Decentralized Perpetual Trading on Solana**.

In one sentence: I use Solana's existing cryptographic primitives — **Ed25519 signatures** and **SHA-256 hashing** — to make it **mathematically impossible for a user to trade on the platform without paying the platform fee**. No new smart contract, no relayer, no trust — just the math the blockchain already provides.

---

## 1. THE PROBLEM — 45 seconds

Every decentralized exchange today faces the same monetisation problem.

The platform builds the UI and the matching infrastructure, but the actual swap or perp order is just an interaction with an on-chain protocol. The platform's **fee** is then collected in a *separate* transaction — sometimes on-chain, sometimes off-chain. And because it is separate, it can be **dropped, delayed, or bypassed**:

* a savvy user disables the fee call before signing,
* an MEV bot reorders the two transactions and the fee fails,
* or a third-party relayer modifies the fee recipient.

The result is **revenue leakage** for the platform and a **trust assumption** for the protocol. The "fee" is really just a polite request.

---

## 2. THE INSIGHT — 30 seconds

The insight behind this project is that on Solana, **two existing properties of the runtime are enough to fix this without any new on-chain code**.

* **Property 1 — Single-signature coverage.** A Solana transaction is a *list of instructions* signed by a *single Ed25519 signature* over a SHA-256 hash of the entire serialised message. If you change *any byte* — one instruction, one account key, one lamport amount — the hash changes, and the signature is no longer valid.
* **Property 2 — Atomic execution.** A Solana transaction either commits *every* instruction or *none*. The validator never executes "instruction 2 only".

Combine these two and you get: **a transaction that contains the fee instruction *plus* the trade instruction is a single indivisible unit. Either both happen, or neither does.** The user cannot keep the trade and skip the fee, because the version of the message *without* the fee has a different hash, and the signature won't verify.

---

## 3. WHAT I BUILT — 60 seconds

The project is a full perpetual-futures trading platform on top of Drift Protocol — Solana's largest perp DEX. Forty-plus markets, candlestick charts, an orderbook, five order types, leverage, take-profit and stop-loss. It runs end-to-end with a Phantom wallet on devnet.

But the part that matters technically is what happens *between* the user clicking "Place Order" and the wallet popup appearing.

I installed an **interceptor** — `DriftClientWrapper.ts` — around the Drift SDK's `sendTransaction`. For every perp order:

1. I capture the order parameters and compute a 5-basis-point platform fee. If the trade is in USDC, I convert the fee into SOL using a live oracle price (Pyth + Switchboard).
2. I **decompile** Drift's V0 transaction message — resolving every Address Lookup Table it references — into a plain `TransactionMessage`.
3. I **prepend** a `SystemProgram.transfer` instruction for the fee, then **recompile** with the same payer, blockhash, and ALTs.
4. The wallet now sees one transaction with two instructions, and signs it with **one** Ed25519 signature.

The Solana validator does the rest — verifies the signature against the SHA-256 hash, then executes both instructions atomically. If the user's account is too low to pay the fee, the trade reverts. If the trade reverts, the fee reverts. The two are now cryptographically welded.

---

## 4. WHY THIS IS NEW — 45 seconds

The crucial point is that **I did not deploy a smart contract**.

* Jupiter, Raydium, and even Drift Native enforce fees through their *own on-chain programs*. This costs tens of thousands of dollars in audits, locks the fee logic to one DEX, and only works for *that* protocol's users.
* **My approach lives entirely in the application layer**. The on-chain enforcement comes from re-using two primitives the chain already has — Ed25519 signature coverage, and atomic execution.

This means:

* **Zero audit cost** — there is no new program to attack.
* **Portable** — the same interceptor pattern works for *any* Solana DEX, not just Drift.
* **Security model is mathematical**, not "trust this code". A change of even one bit in the message invalidates the signature; SHA-256's avalanche effect makes that statistically certain.

---

## 5. HOW I PROVED IT WORKS — 75 seconds

I didn't want to *say* the system is secure — I wanted any reviewer to be able to *click and verify*. So I built six routes that ship with the app and turn every claim into a live demo.

* **`/verify`** — four in-browser cryptographic demos. Section 1 is a 10-step wizard that generates a fresh Ed25519 keypair, builds a transaction message, signs it, then tampers with one byte of the fee and shows Ed25519 verification fail. Section 4 is a **Merkle proof builder** — I construct a SHA-256 Merkle tree from a list of leaves with domain-separated hashing (0x00 for leaves, 0x01 for nodes), generate an inclusion proof for any leaf, then let the audience tamper a leaf and watch the proof fail against the published root.

* **`/security`** simulates **six classes of blockchain attacks** — replay, signature forgery, fee strip, fee-amount tamper, instruction reorder, and a man-in-the-middle recipient swap — using `tweetnacl` in the browser. There's a "Run all attack tests" button. All six attacks pass with byte-level diffs that show *which* bytes the attack flipped and *why* the signature no longer verifies.

* **`/benchmarks`** measures the actual cost of our atomic bundling: **+64 bytes** of extra transaction size, **under 1 ms** of extra signing latency, **~150 of Solana's 200,000 compute units** (so about 0.07 % of the budget). All four metrics are well under 1 %.

* **`/explorer`** lets anyone paste a Solana transaction signature and renders the **full CPI call tree** straight from `meta.innerInstructions` on chain. The audience can see the `SystemProgram.transfer` (the fee) and the Drift instruction sitting at depth 0 in the same envelope, with Drift's own cross-program calls (System, SPL Token, Pyth, Switchboard) indented under it.

* **`/receipt/[signature]`** turns any transaction into a shareable receipt that prints the signed digest and links to Solscan for independent verification.

* **`/blockchain`** is a concept-to-source map: every primitive the project exercises — Ed25519, SHA-256, Merkle trees, atomic execution, replay protection, CPI, oracles — is mapped to the exact file in the repo where it is implemented.

---

## 6. RESULTS — 30 seconds

Concretely, I proved:

* **Mathematically:** six classes of attacks fail; tampering with any field invalidates the signature.
* **Quantitatively:** **+64 bytes** of overhead, **< 1 ms** extra signing latency, **~150 of 200,000 compute units** per transaction — about **0.07 % total relative overhead** versus the unbundled trade.
* **Practically:** every fee that goes through the system is recorded in MongoDB **and** independently verifiable on Solscan, with the explorer link surfaced inside the app. The on-chain `SystemProgram.transfer` is the canonical record; MongoDB is just a convenience mirror.

The primitives the project exercises end-to-end are **asymmetric cryptography** (Ed25519 over Curve25519), **hashing** (SHA-256, including a from-scratch Merkle tree), **digital signatures**, **wallets and base58 addresses**, **V0 transactions with Address Lookup Tables**, **atomic execution**, **replay protection** via `recentBlockhash`, **decentralised oracles** (Pyth + Switchboard), and **cross-program invocation** rendered live from `meta.innerInstructions`.

---

## 7. WHAT'S NEXT — 20 seconds

Future work falls into three buckets:

1. **Mainnet deployment** with a production builder authority and signed fee receipts.
2. **Cross-chain port** — the same idea works on any chain whose runtime guarantees signature coverage and atomicity (Sui, Aptos, Sei, …).
3. A **dynamic fee engine** governed by a DAO and tier-aware (volume-based discounts), still enforced by the same atomic bundle.

---

## CLOSE — 15 seconds

TRADEN-PROD shows that you can solve a real-world DeFi business problem — fee evasion — **without** writing a smart contract, **without** trusting a relayer, and **without** asking the user to behave well. You only need to compose Solana's existing cryptography correctly.

> **Monetisation without trust. Trading without compromise.**

Thank you. I am happy to take questions, and I have a live demo of all of this ready on the laptop.

---

## ANTICIPATED Q&A — quick-reference cheat sheet

* **"Why didn't you write a Solana program?"**
  Because we didn't need to. The atomicity guarantee already exists in the runtime; layering a custom program would only add audit surface.

* **"Could the user simply *not* go through your interceptor?"**
  Yes — but then they're not using the platform. The claim is *while you're using TRADEN-PROD, you cannot evade the fee*; it's not a chain-wide enforcement.

* **"What about Swift orders?"**
  Drift's Swift orders bypass `driftClient.sendTransaction` (off-chain matching). I acknowledge and document this — there is a UI toggle to disable Swift, and the interceptor only enforces fees on the standard path.

* **"How do you handle USDC fees?"**
  USDC → SOL conversion uses Drift's oracle cache (Pyth + Switchboard), so the fee instruction can use `SystemProgram.transfer` (which only moves lamports). The conversion is in `lib/tradingFee.ts` / `DriftClientWrapper.ts`.

* **"What is the security level?"**
  Ed25519 gives 128-bit security; SHA-256 gives 128-bit collision resistance. Forging or finding a colliding tampered message is computationally infeasible — 2¹²⁸ operations.

* **"How is this different from EIP-7702 / account abstraction?"**
  EIP-7702 changes how Ethereum accounts authorise transactions; I don't change how Solana accounts work at all. The interceptor just *composes* existing instructions inside one transaction. The approach is portable to any chain with single-signature, atomic transactions — including chains that don't have account abstraction.

* **"Where do the fees actually go?"**
  To a builder-authority wallet configured by the platform via `NEXT_PUBLIC_BUILDER_AUTHORITY`. The admin and creator dashboards then split earnings 50/50 (off-chain policy) and provide a claim flow.

* **"Why a Merkle tree if every fee already lands on chain?"**
  Chain confirmation is the canonical record for *one* transaction. The Merkle tree on `/verify` lets a creator commit to a *batch* of off-chain receipts with a single 32-byte root, then prove inclusion of any individual receipt later — useful for the planned signed-receipt fee model.

* **"What does the CPI tree on `/explorer` actually show?"**
  Solana's runtime records every cross-program call inside `meta.innerInstructions`. My `cpi.ts` parser turns that flat list into a tree. The professor can paste any signature and see, with depth indentation, that the fee `SystemProgram.transfer` and the Drift instruction are siblings inside the *same* transaction envelope — that's the on-chain proof of atomicity.

* **"What if devnet is down during the demo?"**
  `/verify` and `/security` run entirely in the browser — no wallet, no RPC, no server. They alone prove the cryptographic thesis end-to-end.
