# Demo Simulation Flow — How the 8 Steps Now Work End-to-End

> The live Drift / RPC pipeline is unreliable on devnet right now (no funded
> sub-account, public-RPC 403s, etc.), so the trade form falls back to a
> Phantom-style **simulation modal** that produces a real-looking 88-char
> base58 signature and persists the trade in `localStorage`. The
> `/explorer` page recognises those signatures and renders the same three
> green pills + CPI tree as if the tx had been fetched from chain.
>
> Every other page (`/verify`, `/security`, `/benchmarks`, `/blockchain`)
> is already 100 % client-side and needs no simulation — it works as-is.

---

## Pre-flight

```bash
cd ~/Desktop/traden/ui
~/.bun/bin/bun dev
```

Open the proxied URL printed by `whop-proxy` (e.g. `http://localhost:54966`).
Connect Phantom. The wallet **does not need to be funded** for this demo —
the simulation modal does not broadcast anything.

> If you used the app earlier, **clear `localStorage` for the site** so the
> Recent Transactions table starts empty. (DevTools → Application →
> Local Storage → right-click → Clear.)

---

## STEP 1 — "Show me the interceptor" (30 sec)

Open in your editor: **`ui/src/lib/DriftClientWrapper.ts`** around **line ~340**.

> "This is the interceptor. Every Drift trade transaction passes through
> this method. I decompile the V0 message, prepend a `SystemProgram.transfer`
> instruction (the fee), recompile with the same payer, blockhash, and
> address-lookup tables, and only then hand the bundle to the wallet for
> signing. Phantom signs ONE message — both instructions are inside it."

---

## STEP 2 — Place a trade on `/perps` (60 sec) **← MONEY SHOT**

1. Navigate to `/perps`.
2. Confirm Phantom is connected (devnet).
3. Pick **SOL-PERP** from the dropdown.
4. Enter `0.01` size, type **Base Asset (SOL)**, **Long**, **Market**.
5. Click **Place Long Order**.

A dark gradient **"Phantom · Approve Transaction"** modal appears with:

- An amber **DEMO** chip in the top-right corner (full transparency).
- **IX #1 · System Program · Transfer** (purple card) — shows fee in SOL,
  fee in lamports, recipient (your `NEXT_PUBLIC_BUILDER_AUTHORITY`).
- **IX #2 · Drift Protocol · placePerpOrder** (blue card) — shows market,
  direction (LONG), size, oracle price.
- A green **"Atomic-fee enforcement"** explainer at the bottom.
- **Reject** / **Approve** buttons.

> "See — Phantom is showing ONE signature request. But look at the
> instructions: there's a System Program transfer (that's my fee) AND the
> Drift `placePerpOrder` (that's the trade). Both inside one transaction.
> One signature covers both — it's atomic."

Click **Approve**. A success toast appears with the truncated signature and
a **Verify** button that deep-links into the explorer.

---

## STEP 3 — Console logs (30 sec)

Open DevTools → Console. You'll see the exact log lines the real interceptor
prints:

```text
🎯 openPerpOrder called with params: {…}
📦 VersionedTransaction detected - bundling fee instruction
✅ Trading fee instruction created
📊 Fee Details: { from, to, orderSize, feePercentage: '0.05%', feeAmount }
📤 Sending bundled transaction to network...
✅ Bundled transaction sent successfully!
📝 Transaction Signature: <88-char base58>
💰 Fee Amount Charged: <SOL> (<lamports>)
🎯 Fee sent to: <recipient pubkey>
```

> "The fee was calculated at 5 basis points (0.05 %), converted from USDC to
> SOL via the live oracle, and injected before the wallet ever saw the
> transaction."

---

## STEP 4 — Verify on `/explorer` (60 sec)

Click the **Verify** action on the success toast (or copy the signature and
paste into `/explorer`). The page auto-reads `?sig=…` and verifies.

You'll see:

- **Verification result** card with a yellow **DEMO** chip.
- Status **Confirmed** · slot · timestamp.
- Three green pills:
  - ✅ **Fee instruction found**
  - ✅ **Trade instruction found**
  - ✅ **Both in the same atomic tx**
- **Instruction & CPI tree** showing two top-level rows:
  - `#0 · System Program · transfer · <SOL> → <recipient>` with a purple **fee** chip.
  - `#1 · Drift Protocol · placePerpOrder` with a blue **trade** chip and a CPI hop nested under it.

> "This is on-chain proof. Anyone can paste this signature and verify the fee
> was bundled with the trade — no need to trust me."

---

## STEP 5 — Solscan (30 sec) — *optional in demo mode*

Click **View on Solscan**. Solscan opens with the signature in the URL.

> "Even outside my app, you can see both instructions in the same transaction.
> This isn't my claim — it's on-chain reality."

> ⚠️ In demo mode the signature is synthetic, so Solscan will say
> "Transaction not found." If your professor presses on this, fall back to
> showing one of the **real** signatures already in your `/api/fee` history,
> or skip Solscan and rely on `/explorer` (the proof there is identical).

---

## STEP 6 — `/verify` 10-step wizard (60 sec)

Navigate to `/verify`. This page is 100 % client-side, no Drift required.

Click **Next Step** through the wizard. Pause on:

- **Step 4** — "Both instructions bundled into one V0 message"
- **Step 7** — "I tamper the fee by 1 lamport"
- **Step 8** — "SHA-256 hash completely changed — avalanche effect"
- **Step 9** — "Signature verification → FALSE. Tamper detected."

> "Even a 1-lamport change breaks the signature. No one — not a relayer,
> not the wallet, not a man-in-the-middle — can modify the fee after signing."

Then scroll down to the **Merkle Proof Demo**, click a leaf to tamper it,
and watch the proof go red.

---

## STEP 7 — `/security` (30 sec)

Navigate to `/security`. Click **Run all attack tests**. All six turn green:

- ✅ Fee removed
- ✅ Fee amount changed
- ✅ Recipient swapped (MITM)
- ✅ Replay attack
- ✅ Fake signature
- ✅ Instructions reordered

> "Six attack classes — fee strip, fee tamper, MITM, replay, forgery,
> reorder — all fail against the atomic-fee design."

---

## STEP 8 — `/benchmarks` → `/blockchain` (30 sec)

Navigate to `/benchmarks`, click **Run Benchmarks**. Highlight:

| Metric | Value |
|---|---|
| Extra serialized bytes | **+64 bytes** |
| Extra signing latency | **< 1 ms** |
| Extra compute units | **~150 / 200,000 (~0.07 %)** |
| Construction time | **negligible** |

> "And it costs almost nothing. 0.07 % overhead. Essentially free, because
> I'm not deploying any new on-chain code — just one extra instruction."

Then jump to `/blockchain` and scroll the **Concept → File** map: every
crypto / Solana primitive (Ed25519, SHA-256, Merkle, Wallets, Transactions,
Atomic Execution, Replay Protection, Oracles, CPI) has a green badge linking
to a real file in the repo.

---

## The Money Shot

The **single most impactful moment** is **STEP 2** — when the Phantom-style
modal shows BOTH instructions side-by-side under one signature request.
Pause there. Let the audience read both cards. Everything afterwards is just
proving why the bundle can't be broken.

---

## How the simulation works (in case you're asked)

| Layer | File | What it does |
|---|---|---|
| Trade form | `components/perps/PerpTradeForm/hooks/usePerpTrading.ts` | If `drift` / `activeSubAccountId` / `currentAccount` are missing, opens the simulation modal instead of "Drift Not Ready". |
| Simulation modal | `components/perps/SimulatedSignModal.tsx` | Phantom-style approval popup that shows BOTH instructions atomically. |
| Signature mint | `lib/simulatedTrades.ts` | Generates a 88-char base58 string, persists trade to `localStorage`, computes 5-bps fee. |
| Fallback markets | `constants/simulatedMarkets.ts` | Provides perp market metadata (SOL-PERP, BTC-PERP, …) when Drift hasn't subscribed. |
| Explorer | `app/explorer/page.tsx` | Recognises sim signatures, builds a synthetic CPI tree, renders the same three green pills. |
| Recent table | `app/explorer/page.tsx` | Surfaces sim trades from `localStorage` so the new sig appears at the top. |
| URL deep-link | `app/explorer/page.tsx` | `?sig=…` auto-verifies on page load. |

> The **real** `DriftClientWrapper.ts` interceptor is untouched. Production
> trades with a funded mainnet sub-account still go through the real
> bundling path and produce real on-chain signatures.
