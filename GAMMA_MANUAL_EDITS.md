# GAMMA_MANUAL_EDITS.md

A focused, manual-edit checklist for the rendered deck
`Atomic-Fee-Enforcement-in-Decentralized-Perpetual-Trading-on-Solana.pdf`.

Open the deck in Gamma, work top-to-bottom through this file, and skip the
slides marked "no edits needed". Total time: ~15–20 minutes.

---

## Slides that need NO edits

- **Slide 2** — broken status quo vs my model + 3 paragraphs are all correct
- **Slide 5** — code inventory (5 modules + 6 routes + bottom counter) all correct
- **Slide 6** — trading platform vs verification surface columns all correct
- **Slide 8** — 6-row attack table + hash visualisation all correct

---

## Slide 1 — Title

**Two issues**

- The title is wrapping onto 6 lines:
  `TRADEN-PROD / Atomic / Fee / Enforcement in / Decentralized / Perpetual Trading on / Solana`.
- The credits line at the bottom never rendered.

**Edits**

1. Click the title text box → set wrap to **two lines max**:
   - Line 1 (large): `TRADEN-PROD`
   - Line 2 (smaller): `Atomic Fee Enforcement in Decentralized Perpetual Trading on Solana`
2. Add a small text block at the very bottom of the slide:

   ```
   Solo project · Viyom Gupta (2023A7PS0413G)
   Stack: Solana · Drift Protocol · Next.js 15 · TypeScript · Ed25519 · MongoDB
   ```

---

## Slide 3 — Mechanism flow (biggest fix)

**The problem.** The flow diagram shows only 5 chips and they are in
**reversed** order:
`Decompile & Prepend → Resolve ALTs → Intercept Send → Build V0 → Place Order`.
Half the steps are missing entirely (no SHA-256 digest, no Phantom signing,
no validator verify, no outcome banner).

**Edits.** Delete the 5-chip diagram. Replace it with a vertical numbered
list of 10 steps in this exact order:

```
1.  User clicks "Place order" on /perps
2.  Drift SDK builds a VersionedTransaction (V0)
3.  DriftClientWrapper intercepts driftClient.sendTransaction
4.  Resolves every Address Lookup Table referenced by the message
5.  Decompiles the V0 message into a TransactionMessage
6.  Prepends SystemProgram.transfer(payer → builderAuthority, feeLamports)
7.  Recompiles with the same payer / blockhash / ALTs
8.  crypto.subtle.digest("SHA-256", message) → 32-byte digest
9.  Phantom signs the digest with the user's Ed25519 secret key
10. Validators verify the signature over the FULL message and execute atomically
```

Then below step 10, add a full-width banner:

```
✅ both succeed   |   ❌ both revert
```

The three "why this works" paragraphs on the right side of the slide are
already correct — leave them.

---

## Slide 4 — Architecture (cosmetic only, optional)

Each layer block shows the layer number twice — once as a left-margin
numeral (`1`) and once in the heading (`1. Presentation`). It's harmless
but ugly. Delete either the left-margin numerals OR the leading
`1. / 2. / 3. ...` from each heading. Pick one.

---

## Slide 7 — Live Demo (second-biggest fix)

**The problem.** The thumbnail strip across the top shows only 5 routes in
scrambled order with wrong captions:

| What's shown now | Caption now (wrong)             |
|------------------|---------------------------------|
| 1. /receipt      | Show single signature popup     |
| 2. /verify       | Confirm on-chain status         |
| 3. /perps        | Connect Phantom and place order |
| 4. /security     | Validate signature integrity    |
| 5. /explorer     | View transaction details        |

`/benchmarks` is missing entirely. The numbered narration blocks 01–06
below the strip ARE in the correct order, so the strip and the body don't
agree with each other.

**Edits.** Reorder the strip to **6 tabs**, left-to-right, with these
exact captions:

| # | Route                       | Caption                              |
|--:|-----------------------------|--------------------------------------|
| 1 | `/perps`                    | Connect Phantom & place market order |
| 2 | `/receipt/<sig>`            | Show single-signature on-chain proof |
| 3 | `/explorer`                 | Render the CPI tree for that signature |
| 4 | `/verify`                   | Run Ed25519 + Merkle integrity demos |
| 5 | `/security`                 | Run all 6 attack tests               |
| 6 | `/benchmarks → /blockchain` | Show overhead + concept map          |

Don't touch the 01–06 narration below the strip — those are already correct.

If the side-panel click-order reminder isn't visible, add it back somewhere
small:

```
Click order: /perps → /receipt → /explorer → /verify → /security → /benchmarks → /blockchain
```

---

## Slide 9 — Primitives grid (third-biggest fix)

**The problem.** The bottom-half grid has only **8 tiles** instead of 9
(the `Digital Signatures` tile is missing entirely), and several captions
have shifted into the wrong tile.

**Edits.** Rebuild the grid as a clean **3 × 3** (nine tiles total). Use
these title → caption pairs verbatim.

**Row 1**

- 🔑 **Asymmetric Crypto** → `Ed25519 over Curve25519 — used by every Phantom signature`
- \#️⃣ **SHA-256 + Merkle** → `merkle.ts + /verify §3–4`
- ✍️ **Digital Signatures** → `One Ed25519 sig covers every instruction in the tx`
  ← **add this whole tile, currently missing**

**Row 2**

- 🪙 **Wallets & Addresses** → `Phantom · base58 public keys`
  *(currently has a misplaced "— Drift in 1 tx" tail — delete it)*
- 🧾 **Transactions** → `V0 messages + Address Lookup Tables`  ← already correct
- ⚛️ **Atomic Execution** → `SystemProgram.transfer + Drift in a single tx`
  *(currently has a misplaced "cpi.ts + /explorer tree" — replace with this)*

**Row 3**

- ⏱ **Replay Protection** → `recentBlockhash window (~150 blocks / ~60 s)`  ← already correct
- 📡 **Decentralised Oracles** → `Pyth + Switchboard drive USDC → SOL conversion`  ← already correct
- 🛡 **Programs + CPI** → `cpi.ts + /explorer renders meta.innerInstructions`
  *(currently just says "verified live" — replace)*

The four metric cards on the top half of the slide
(`+64 bytes` / `<1 ms` / `~150 CU` / `~0.07 %`) are correct — don't touch them.

---

## Slide 10 — Conclusion

**Two issues**

1. The "What's Next" cards lost their technical descriptions:
   - `Mainnet Deployment` shows just `Production builder` (caption truncated)
   - `Cross-chain Port` shows just `Sui / Aptos / Sei`
   - `Dynamic Fee Engine` shows a mashed-up `DAO-governed authority + signed tier-aware fees`
2. The closing banner just repeats the slide's own title
   (`Monetisation Without Trust / Trading Without Compromise`) — visual duplication.

**Edits**

1. Restore the captions on the three future-work cards:
   - **Mainnet Deployment** → `Production builder authority + signed fee receipts`
   - **Cross-chain Port** → `Sui / Aptos / Sei using the same composition idea`
   - **Dynamic Fee Engine** → `DAO-governed, tier-aware fees, still atomic`
2. Delete the duplicated closing banner. In its place, drop a small QR code
   in the bottom-right corner pointing to `https://github.com/Viyom10/traden`,
   with the caption `Live demo + repo` underneath.
3. The three top takeaway cards
   (Cryptographic Guarantee / Zero On-Chain Footprint / Empirically Verified)
   and the footer line are correct — leave them.

---

## Final verification (after all edits)

Re-export the deck as PDF and visually confirm:

- **Slide 1** — title is on 2 lines; credits + stack line is visible at the bottom.
- **Slide 3** — 10 numbered steps in the correct order, ending with the
  `✅ both succeed | ❌ both revert` banner.
- **Slide 7** — thumbnail strip reads
  `/perps → /receipt → /explorer → /verify → /security → /benchmarks`
  (left to right) and matches the 01–06 narration below.
- **Slide 9** — exactly **nine** tiles in a 3×3 grid; `Digital Signatures`
  tile is present; no caption is misplaced.
- **Slide 10** — three future-work cards each have a one-line description;
  the closing banner is replaced by the QR code.

Then overwrite
`Atomic-Fee-Enforcement-in-Decentralized-Perpetual-Trading-on-Solana.pdf`
with the new export.
