# TRADEN-PROD — Course Project Pitch

> A speak-it-as-it-is script.
> Total spoken time: about **6 minutes** at a comfortable pace.
> Designed for the BITS F452 final evaluation panel.
> Single-presenter script: Viyom Gupta (2023A7PS0413G).

---

## OPENING — 30 seconds

Good [morning / afternoon], professor. I am Viyom Gupta (2023A7PS0413G), and my project for BITS F452 is called **TRADEN-PROD — Atomic Fee Enforcement in Decentralized Perpetual Trading on Solana**.

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

The project is a full perpetual-futures trading platform on top of Drift Protocol — Solana's largest perp DEX. Forty-plus markets, candlestick charts, an orderbook, five order types, leverage, take-profit and stop-loss.

But the part that matters academically is what happens *between* the user clicking "Place Order" and the wallet popup appearing.

I installed an **interceptor** — `DriftClientWrapper.ts` — around the Drift SDK's `sendTransaction`. For every perp order:

1. I capture the order parameters.
2. I compute a 5-basis-point platform fee — and if the trade is in USDC I convert that fee into SOL using a live oracle price.
3. I **decompile** the Drift transaction message, **prepend** a `SystemProgram.transfer` instruction for the fee, **recompile** to a Solana V0 message, and forward it to the wallet.
4. The wallet now sees one transaction with two instructions, and signs it with **one** Ed25519 signature.

The Solana validator does the rest — verifies the signature against the SHA-256 hash, executes both instructions atomically. If the user's account is too low to pay the fee, the trade reverts. If the trade reverts, the fee reverts. The two are now cryptographically welded.

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

## 5. HOW I PROVED IT WORKS — 60 seconds

I didn't want to *say* the system is secure — I wanted any reviewer to be able to *click and verify*.

So I built five educational pages that ship with the app:

* **`/verify`** runs a 10-step in-browser wizard that generates a fresh Ed25519 keypair, builds a transaction message, signs it, then tampers with one byte of the fee and shows the signature fails. There's also a tamper-matrix that flips every kind of edit — remove the fee, change the recipient, change the amount, reorder the instructions — and shows all six rows turning red.

* **`/security`** simulates **six classes of blockchain attacks** — replay, signature forgery, fee bypass, fee-amount manipulation, instruction reordering, and a man-in-the-middle recipient swap — using `tweetnacl` in the browser. All six pass with byte-level diffs.

* **`/benchmarks`** measures the actual cost of our atomic bundling: extra transaction size, signing latency, compute units, construction time. Across all four metrics, the overhead is **well under 1 %**.

* **`/explorer`** lets anyone paste a Solana transaction signature and verify the **on-chain** atomicity — both the fee instruction and the Drift instruction are visible in the same transaction.

* **`/blockchain`** is a syllabus map: every cryptographic and blockchain concept from BITS F452 — Ed25519, SHA-256, hash chains, wallets, transactions, atomicity, replay protection, oracles, smart contracts, consensus — is mapped to the exact file in the repo where it is implemented.

Plus a per-trade **`/receipt/[signature]`** page that turns any transaction into a beautiful shareable receipt.

---

## 6. RESULTS & RELEVANCE — 30 seconds

Concretely, I proved:

* **Mathematically:** six classes of attacks fail; tampering with any field invalidates the signature.
* **Quantitatively:** ~64 bytes of overhead, sub-millisecond extra signing latency, ≤ 1 % of Solana's compute budget per tx.
* **Practically:** every fee that goes through the system is recorded in MongoDB **and** independently verifiable on Solscan, with the explorer link surfaced inside the app.

In terms of the syllabus, the project exercises **almost every block of the course** — symmetric and asymmetric cryptography, hashing, digital signatures, wallets, transactions, atomicity, replay protection, smart contracts, consensus, identity management, and decentralised oracles.

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
