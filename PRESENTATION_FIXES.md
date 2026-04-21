# PRESENTATION_FIXES.md

A slide-by-slide audit of what Gamma rendered correctly in
`Atomic-Fee-Enforcement-in-Decentralized-Perpetual-Trading-on-Solana.pdf`
versus what needs to be fixed before the final evaluation.

Use this file as the checklist when editing the deck inside Gamma.

────────────────────────────────────────────────────────────────────────────────

## Quick summary

| Slide | Status         | Action required                                          |
|------:|----------------|----------------------------------------------------------|
| 1     | Needs fix      | Title broken across 6 lines; stack/credits line missing  |
| 2     | OK             | None                                                     |
| 3     | Needs major fix| Flow diagram has 5 of 10 steps and they are out of order |
| 4     | OK (cosmetic)  | Optionally remove duplicated layer-number prefixes       |
| 5     | OK             | None                                                     |
| 6     | OK             | None                                                     |
| 7     | Needs major fix| Demo tabs are scrambled and `/benchmarks` is missing     |
| 8     | OK             | None                                                     |
| 9     | Needs major fix| Primitive captions are jumbled; "Digital Signatures" missing |
| 10    | Needs fix      | Future-work card details truncated; closing banner duplicates title |

────────────────────────────────────────────────────────────────────────────────

## Slide 1 — Title

**What Gamma rendered**

> The title `TRADEN-PROD / Atomic Fee Enforcement in Decentralized Perpetual Trading on Solana` was broken across six lines. The "Solo project · Viyom Gupta (2023A7PS0413G)" + tech-stack line never appeared on the slide.

**Fix in Gamma**

1. Click the title block, set it to wrap on **two lines max**:
   - Line 1: `TRADEN-PROD`
   - Line 2: `Atomic Fee Enforcement in Decentralized Perpetual Trading on Solana`
2. Add a small text block at the very bottom of the slide:
   - `Solo project · Viyom Gupta (2023A7PS0413G)`
   - `Stack: Solana · Drift Protocol · Next.js 15 · TypeScript · Ed25519 · MongoDB`

────────────────────────────────────────────────────────────────────────────────

## Slide 3 — Mechanism flow

**What Gamma rendered**

A 5-node diagram with these labels in this order (visually, top to bottom):

1. Decompile & Prepend
2. Resolve ALTs
3. Intercept Send
4. Build V0
5. Place Order

The order is reversed and **half of the steps are missing** (no SHA-256
digest, no Phantom signature, no validator verify, no atomic-outcome node).

**Fix in Gamma**

Replace the flow diagram with a single vertical 10-step pipeline,
top-to-bottom, in this exact order:

| #  | Step                                                                                  |
|----|---------------------------------------------------------------------------------------|
| 1  | User clicks "Place order" on `/perps`                                                 |
| 2  | Drift SDK builds a `VersionedTransaction` (V0)                                        |
| 3  | `DriftClientWrapper` intercepts `driftClient.sendTransaction`                         |
| 4  | Resolves every Address Lookup Table referenced by the message                         |
| 5  | Decompiles the V0 message into a `TransactionMessage`                                 |
| 6  | Prepends `SystemProgram.transfer(payer → builderAuthority, feeLamports)`              |
| 7  | Recompiles with the same payer / blockhash / ALTs                                     |
| 8  | Browser computes `crypto.subtle.digest("SHA-256", message)` → 32-byte digest          |
| 9  | Phantom signs the digest with the user's Ed25519 secret key                           |
| 10 | Validators verify the signature over the **full** message and execute atomically      |

Place the outcome banner at the bottom: **`✅ both succeed   |   ❌ both revert`**

The three "why this works" paragraphs on the right of the slide are
correct — keep them.

────────────────────────────────────────────────────────────────────────────────

## Slide 4 — Architecture (cosmetic)

Each layer block currently shows the layer number twice (once as the
left-margin numeral and again as the heading prefix, e.g. `1` and
`1. Presentation`). Either delete the left-margin numerals or strip
the leading "1. / 2. / 3. ..." from the headings — pick one.

────────────────────────────────────────────────────────────────────────────────

## Slide 7 — Live Demo (most visible issue)

**What Gamma rendered**

The thumbnail strip across the top of the slide shows the routes in this
(wrong) order, with mislabeled captions, and `/benchmarks` is missing
entirely:

| Order rendered | Route       | Caption rendered (wrong)        |
|---------------:|-------------|---------------------------------|
| 1              | `/receipt`  | Show single signature popup     |
| 2              | `/verify`   | Confirm on-chain status         |
| 3              | `/perps`    | Connect Phantom and place order |
| 4              | `/security` | Validate signature integrity    |
| 5              | `/explorer` | View transaction details        |

The numbered step blocks below it (01–06) are correct. The mismatch
between the thumbnail strip and the numbered steps is what is confusing.

**Fix in Gamma**

Reorder and relabel the thumbnail strip across the top to **six tabs**,
in this exact left-to-right sequence, with these short captions:

| # | Route                       | Short caption                        |
|--:|-----------------------------|--------------------------------------|
| 1 | `/perps`                    | Connect Phantom & place market order |
| 2 | `/receipt/<sig>`            | Show single-signature on-chain proof |
| 3 | `/explorer`                 | Render the CPI tree for that signature |
| 4 | `/verify`                   | Run Ed25519 + Merkle integrity demos |
| 5 | `/security`                 | Run all 6 attack tests               |
| 6 | `/benchmarks` → `/blockchain` | Show overhead + concept map        |

The numbered narration blocks (01–06) below the strip are already in the
correct order — leave them.

Add the side-panel reminder back in if Gamma dropped it:

> Click order: `/perps  →  /receipt  →  /explorer  →  /verify  →  /security  →  /benchmarks  →  /blockchain`

────────────────────────────────────────────────────────────────────────────────

## Slide 9 — Primitives grid (captions are scrambled)

**What Gamma rendered**

| Tile title          | Caption rendered (often wrong)                      |
|---------------------|-----------------------------------------------------|
| Asymmetric Crypto   | `Ed25519 / Curve25519 — One Ed25519 sig used by every wallet` |
| SHA-256 + Merkle    | `merkle.ts + /verify §3–4 — sig covers all ix`      |
| Wallets & Addresses | `Phantom · base58 keys — Drift in 1 tx`             |
| Transactions        | `V0 messages + Address Lookup Tables`               |
| Atomic Execution    | `SystemProgram + cpi.ts + /explorer tree`           |
| Replay Protection   | `recentBlockhash window (~150 blocks / ~60 s)`      |
| Decentralised Oracles | `Pyth + Switchboard drive USDC→SOL conversion`    |
| Programs + CPI      | `meta.innerInstructions — verified live`            |

Two problems:

1. The "ONE Ed25519 sig covers all instructions" line is for a
   **`Digital Signatures`** tile that Gamma omitted entirely.
2. Captions for `Wallets & Addresses`, `Atomic Execution`, and
   `Programs + CPI` got crossed.

**Fix in Gamma**

Rebuild the grid as exactly **9 tiles in a 3×3 layout**, with these
title → caption pairs (verbatim):

| Tile title              | Caption                                                   |
|-------------------------|-----------------------------------------------------------|
| Asymmetric Crypto       | Ed25519 over Curve25519 — used by every Phantom signature |
| SHA-256 + Merkle        | `merkle.ts` + `/verify` §3–4                              |
| Digital Signatures      | One Ed25519 sig covers every instruction in the tx        |
| Wallets & Addresses     | Phantom · base58 public keys                              |
| Transactions            | V0 messages + Address Lookup Tables                       |
| Atomic Execution        | `SystemProgram.transfer` + Drift in a single tx           |
| Replay Protection       | `recentBlockhash` window (~150 blocks / ~60 s)            |
| Decentralised Oracles   | Pyth + Switchboard drive USDC → SOL conversion            |
| Programs + CPI          | `cpi.ts` + `/explorer` renders `meta.innerInstructions`   |

────────────────────────────────────────────────────────────────────────────────

## Slide 10 — Conclusion

**What Gamma rendered**

* The closing banner repeats the slide's own title verbatim
  (`Monetisation Without Trust` / `Trading Without Compromise`).
* The "What's Next" cards lost their one-line technical descriptions
  (e.g. "Cross-chain Port" is now just `Sui / Aptos / Sei`).

**Fix in Gamma**

1. Restore the captions under each future-work card:
   * **Mainnet Deployment** — Production builder authority + signed fee receipts
   * **Cross-chain Port** — Sui / Aptos / Sei using the same composition idea
   * **Dynamic Fee Engine** — DAO-governed, tier-aware fees, still atomic
2. Replace the duplicated closing banner with a small **QR code** in the
   bottom-right pointing to `https://github.com/Viyom10/traden`. Caption:
   `Live demo + repo`.

────────────────────────────────────────────────────────────────────────────────

## After applying the fixes

Re-export the deck as PDF and overwrite
`Atomic-Fee-Enforcement-in-Decentralized-Perpetual-Trading-on-Solana.pdf`.
Verify visually:

* Slide 3 has 10 numbered steps in the correct order, ending with the
  `✅ both succeed | ❌ both revert` banner.
* Slide 7's thumbnail strip is `/perps → /receipt → /explorer → /verify
  → /security → /benchmarks` (left to right), and matches the 01–06
  narration below.
* Slide 9 shows nine tiles in a 3×3 grid, with the captions paired
  exactly as listed above and a `Digital Signatures` tile present.
* Slide 10's three future-work cards each have a one-line description
  and the closing banner is replaced by the QR code.

────────────────────────────────────────────────────────────────────────────────

## Why these errors happened (so you can avoid them next time)

* Slide 3 had a 10-arrow ASCII pipeline written prose-style. Gamma
  truncated it into 5 floating chips and reversed the order.
* Slide 7 had a "browser mock + 6 numbered tabs" instruction in prose;
  Gamma's text-to-deck pipeline picked 5 routes from the body and
  invented its own captions instead of using the per-step "Say" lines.
* Slide 9's primitive list was rendered as a single table where the
  caption column was visually adjacent to the *next* row's title;
  Gamma's parser shifted captions by one row.

These three patterns have been hardened in `gaama_prompt.txt` (see the
"CRITICAL RENDERING CONSTRAINTS" callouts on slides 3, 7, and 9). If
you ever regenerate the deck from scratch, re-paste the updated prompt.
