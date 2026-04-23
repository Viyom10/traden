# `/verify` — How to Explain & What to Show

> One-line pitch: **"This page proves the cryptographic foundation of the
> entire project, in your browser, without a wallet, without an RPC, without
> a server. Pure math. Live."**

The page now has **3 sections** (the old "Atomicity Proof Matrix" was removed
because it could freeze the UI — the same six tamper attacks live on
`/security` with per-attack Run buttons).

---

## What to say at the top of the page

> "This is the live cryptographic proof of my project's core thesis:
> a single Ed25519 signature, applied to a single SHA-256 digest of a
> single Solana transaction, makes the platform fee and the user's trade
> an indivisible unit. Everything below runs entirely in the browser —
> no wallet, no RPC, no server. So if devnet is down, this still works."

---

## Section 1 — Transaction Integrity Demo (the 10-step wizard)

**What it does:** walks you through the full
*generate keypair → build tx → sign → tamper → verify* pipeline using a
freshly-minted Ed25519 keypair in your browser.

**What to demonstrate (≈ 60 sec):**

| Step | What to point at | What to say |
|------|------------------|-------------|
| 1 | The 32-byte public key shown in base58 | "This is what a Solana address actually is — a 32-byte Ed25519 public key, encoded in base58. Phantom calls this your wallet address." |
| 2-3 | Two `SystemProgram.transfer` instructions (fee + trade) | "I bundle two instructions into one V0 message: the fee transfer first, then the trade." |
| 4 | The serialized message bytes + the SHA-256 of those bytes | "This is the entire signed payload — every byte the validator will check. Below it is the SHA-256 digest." |
| 5 | The 64-byte Ed25519 signature | "The user signs the *digest*, not the bytes directly. One signature covers everything." |
| 6 | Verifier returns `true` | "Validator verifies the signature against the original message — passes." |
| 7 | **Tamper:** change the fee from 5,000 lamports → 1 lamport | "Now I act as a malicious relayer and lower the fee to 1 lamport." |
| 8 | The new SHA-256 — visibly half the bits flip | "Avalanche effect — a tiny edit completely changes the hash." |
| 9 | **Verifier returns `false`** | "Signature verification → FALSE. Tamper detected. The validator drops the transaction." |
| 10 | Summary card | "This is why the fee is unbypassable — it's not enforced by a contract, it's enforced by the math of Ed25519 + SHA-256." |

**Money line for this section:** *"No on-chain code. No audit. Just
cryptography — and the validator does the policing."*

---

## Section 2 — Hash Properties (avalanche, pre-image, collision)

**What it does:** lets you type any text and watch the SHA-256 output.
Then it flips one bit of the input and shows the second hash plus the
"% of bits flipped" counter.

**What to demonstrate (≈ 30 sec):**

1. Show the input box with `Atomic Fee Enforcement` already in it.
2. Point at the **"128 / 256 bits flipped (50.0 %)"** card.

> "This is the avalanche property of SHA-256: flip ONE bit of the input,
> and ~50 % of the output bits change. Cryptographically secure hash
> functions target exactly this 50 % threshold. This is why an attacker
> can't 'tweak' a fee instruction — even a 1-lamport change makes the
> SHA-256 unrecognisable, which makes the Ed25519 signature invalid."

3. Then point at the two side cards:

   - **Pre-image resistance** — "Given the hash, you can't recover the
     input — that's why the validator can publish the hash but never
     recover the message."
   - **Collision resistance** — "2^128 operations to find any two
     messages with the same hash. So two different transactions can't
     share a hash and therefore can't share a signature."

**Money line:** *"Avalanche is what makes tamper detection deterministic
— there's no 'small' edit possible."*

---

## Section 3 — Merkle proofs (logarithmic membership verification)

**What it does:** builds a SHA-256 Merkle tree over 8 sample
transactions, computes the root, lets you pick a leaf, and shows the
3-hash inclusion proof. Then a tamper test where you can edit one
character of a leaf and watch the proof break.

**What to demonstrate (≈ 30 sec):**

1. Point at the **MERKLE ROOT** field (32-byte hex).

> "This single 32-byte root commits to all 8 transactions. Anyone with
> just this root can verify any leaf without ever seeing the other 7."

2. Click **leaf #0** (`alice → bob: 1.0 SOL`). Show the **3-hash
   proof path** (3 hashes = 96 bytes — `log₂(8)`).

> "To prove leaf #0 is in this tree, I only need 3 hashes — that's
> log₂(8). For a million leaves it would still only be 20 hashes.
> This is exactly how Solana validators commit to the entire account
> state per slot, and how Bitcoin SPV clients verify transactions
> without downloading full blocks."

3. Point at the green **"Proof verification: VALID"** card.

4. Then the **tamper test** — edit `1.0` to `1000000` in the bottom
   input and click **"Verify tampered leaf against the same proof"**.
   Watch it turn red.

> "Even a one-character change to a leaf produces a completely
> different leaf hash, which propagates up to a different root. The
> original proof no longer terminates at the published root —
> mathematically detectable, no trust required."

**Money line:** *"Same primitive — SHA-256 — used in two different
ways: hashing a transaction to bind a signature, and chaining hashes
to prove inclusion."*

---

## What to skip / what to gloss

- **Don't read the hex.** Just point at it. "These are SHA-256 digests."
- **Don't explain Box-Muller, base58 alphabets, or CSPRNG.** They're in
  the code but invisible to the slide.
- **If the wizard's "Next step" gets stuck**, refresh — the new keypair
  generates instantly. There is no network call to fail.

---

## Total time

| Section | Time |
|---------|------|
| Top intro paragraph | 10 sec |
| Section 1 — wizard (skip through steps 2-3, 6) | ~60 sec |
| Section 2 — avalanche + side cards | ~30 sec |
| Section 3 — Merkle root + proof + tamper | ~30 sec |
| **Total** | **~2 min 10 sec** |

That's the budget you set in the master demo script for `/verify`.

---

## The single sentence to leave the audience with

> *"Six attack tests on `/security`, but THIS page is where you can
> see, byte by byte, why those attacks have to fail. This is the math
> doing the policing."*
