# Traden — Usage Guide

A page-by-page walkthrough of the running app. For every page you'll get:

- **What it is** — one-line purpose.
- **How to open** — the exact URL.
- **What you need** — wallet / network requirements (most pages need none).
- **What to click** — the buttons that actually do something.
- **What you should see** — expected output so you know it worked.

> **Author:** Viyom Gupta · 2023A7PS0413G

---

## 0. Start the app

```bash
cd ui
bun install        # only the first time
bun run dev        # serves http://localhost:3000
```

If port 3000 is busy, Next will auto-pick the next free port and print it. Open the URL in your browser.

The top navigation bar is your remote control. Every page below is one tab in that nav.

---

## 1. `/` — Home

- **What it is:** The marketing / landing page. Just a "Home Page" stub right now — it's the entry point that proves the app boots.
- **How to open:** click the **Signals** logo top-left, or visit `http://localhost:3000/`.
- **What you need:** nothing.
- **What to click:** any nav tab to leave.
- **What you should see:** the dark theme with the **Connect Wallet** button on the top-right and the nav bar.

---

## 2. `/perps` — Perpetuals trading

- **What it is:** The full Drift Protocol perpetual-futures interface. This is the production trading surface.
- **How to open:** click **Perps** in the nav.
- **What you need:**
  - A Solana wallet (Phantom / Backpack / Solflare) installed in your browser.
  - A funded wallet on **devnet** (free) — get SOL/USDC from the [Drift devnet faucet](https://app.drift.trade/?network=devnet) or [solfaucet.com](https://solfaucet.com).
- **What to click (in order):**
  1. **Connect Wallet** (top-right). Approve in your wallet popup.
  2. Pick a market on the left (e.g. `SOL-PERP`).
  3. Choose **Long** or **Short** in the order ticket on the right.
  4. Type a size (or pick a leverage preset).
  5. Click **Place Order**. Approve the transaction in your wallet.
- **What you should see:**
  - Live order book + price chart.
  - Your order in the **Open Orders** panel after a few seconds.
  - A toast at the bottom-right with a Solscan link to the on-chain transaction.
  - A **5 bps** platform fee deducted from your wallet (this is the on-chain SOL transfer to `BUILDER_AUTHORITY` — the canonical record).

---

## 3. `/spot` — Spot trading

- **What it is:** Same Drift interface but for spot markets (no leverage).
- **How to open:** **Spot** tab.
- **What you need:** same wallet setup as `/perps`.
- **What to click:** identical flow — pick a spot market, set size, **Place Order**.
- **What you should see:** an instant settlement (no funding payments).

---

## 4. `/signals` — Copy-trading signals

- **What it is:** Lets a creator publish a "trade signal" (e.g. "long SOL 5x for 2 h") that followers can mirror with one click.
- **How to open:** **Signals** tab.
- **What you need:**
  - To **publish** a signal: a wallet recognised as a creator (Whop integration). Without `WHOP_API_KEY` set, you'll see the public read-only view.
  - To **follow**: just a connected wallet.
- **What to click:**
  - **Browse** active signals in the list.
  - Click a signal card → **Mirror trade** button on the right → approve in wallet.
- **What you should see:** the trade appears on `/perps` under your open orders, identical to the creator's, sized to your wallet.

---

## 5. `/blockchain` — Concept map (educational)

- **What it is:** A browsable map of the cryptography & blockchain concepts the project demonstrates, each linked to the actual source files that implement them.
- **How to open:** **Blockchain** tab. **No wallet needed.**
- **What you need:** nothing.
- **What to click:**
  - Each concept card has an **Open file** link → opens the implementing source file in a new tab.
  - Hover over the **status badge** (`implemented` / `partial`) to see coverage.
- **What you should see:** seven category sections (Cryptographic Foundations, Transactions, Wallets, Oracles, Smart Contracts, Consensus, Security, Limitations). Use this page when you want to point at "where in the code" something is.

---

## 6. `/verify` — SHA-256 & Ed25519 demos

- **What it is:** A hands-on cryptographic playground. Proves the chain's integrity primitives work without needing a connected wallet.
- **How to open:** **Verify** tab. **No wallet, no RPC.**
- **What to click:**
  1. **Section 1 · Atomic Fee Integrity** card → step through the 10-step walkthrough (build tx → hash → sign → tamper → re-verify) with the **Next** button.
  2. **Section 2 · Atomicity Proof** card → fixed-size table showing why a 1-lamport edit to the fee fully invalidates the trade signature.
  3. **Section 3 · Hash Properties (avalanche)** card → type any text → flip a single character → watch ~50% of the SHA-256 output bits flip.
  4. **Section 4 · Merkle proofs** card →
     - Edit the textarea to add / remove leaves (one per line).
     - Click any leaf — its **inclusion proof** appears as `step / position / sibling-hash` rows. Notice the proof length is `⌈log₂ N⌉` no matter how big N is.
     - Read the green "Proof verification: VALID" panel — that's the verifier accepting the proof against the published root.
     - Edit the **Tamper test** input (try changing the SOL amount) → click **Verify tampered leaf against the same proof** → it must turn red ("Rejected — root no longer matches"). That's the cryptographic guarantee in action.
- **What you should see:** every demo runs in the browser in milliseconds. Green badges = valid. Red badges = tampered / invalid.

---

## 7. `/security` — Attack-resistance demos

- **What it is:** Six classic attacks against blockchain transactions, each with a **Run test** button that demonstrates Solana's defence in your browser.
- **How to open:** **Security** tab. **No wallet needed** (uses ephemeral generated keypairs).
- **What to click — for each attack card:**
  - Click the row to expand the explanation.
  - Click **Run test** on the right.
  - Wait ~1 second; a green `passed` or red `failed` badge appears with the technical proof underneath.
- **The six attacks:**
  | Attack                  | What "passed" means                                      |
  | ----------------------- | -------------------------------------------------------- |
  | **Replay Attack**       | A re-broadcast tx is rejected because the blockhash expired |
  | **Forgery (signature)** | A fake signature fails Ed25519 verification              |
  | **Transaction malleability** | The signature commits to the message; tampering breaks it |
  | **Hash collision**      | Two different inputs never produce the same SHA-256      |
  | **Account substitution**| Swapping a recipient pubkey invalidates the signature    |
  | **Routing / MITM**      | A modified payload fails verification at the validator   |
- **What you should see:** all six should turn green. If any goes red, the on-page expander explains what would have to break for an attacker to succeed (which is the whole point of the demo).

---

## 8. `/benchmarks` — Performance metrics

- **What it is:** Live in-browser micro-benchmarks of the cryptographic primitives the chain relies on.
- **How to open:** **Benchmarks** tab. **No wallet needed.**
- **What to click:**
  - **Run benchmark** on each card. Tests run for ~3 seconds and report ops/sec.
  - **Run all** at the top runs every benchmark sequentially.
- **What you should see:**
  - SHA-256: ~1–3 M ops/sec
  - Ed25519 sign: ~10–20 K ops/sec
  - Ed25519 verify: ~3–5 K ops/sec
  - Numbers vary by your CPU. The point is to demonstrate that "expensive crypto" is actually cheap on commodity hardware.

---

## 9. `/explorer` — On-chain transaction explorer + CPI tree

- **What it is:** Two things in one page —
  1. A **signature inspector**: paste any base58 signature, the page calls `connection.getParsedTransaction` and renders the full **CPI tree** (every cross-program invocation the transaction triggered, indented under its parent).
  2. A **recent transactions** table sourced from the local MongoDB audit log.
- **How to open:** **Explorer** tab. **No wallet needed** to view.
- **What you need:**
  - For the inspector: nothing — paste any mainnet/devnet signature.
  - For the recent table: `MONGODB_URI` set in `ui/.env.local` plus at least one trade made via `/perps` or `/spot`. Without Mongo (the default), the table shows "No transactions yet" — that's the expected empty state.
- **What to click:**
  - Paste a signature in the **Verify a transaction** box → click **Verify** → see:
    - **Atomic-fee enforcement check** (3 green pills if fee + trade landed in the same atomic envelope).
    - **Instruction & CPI tree** — top-level instructions are at depth 0; everything indented with the green `↳ cpi` arrow is a cross-program invocation read from `meta.innerInstructions` (e.g. Drift CPI'ing into SystemProgram, SPL Token, Pyth, Switchboard).
    - Counters: top-level instructions, total CPI hops, distinct programs touched.
  - Click any **Verify** row in the recent table to inspect that signature in place.
  - Click the external-link icon → opens [Solscan](https://solscan.io).
- **What you should see:** a clean nested call graph showing exactly which programs your trade touched, with the fee and trade instructions tagged.

---

## 10. `/receipt/[signature]` — Per-transaction receipt

- **What it is:** A printable receipt for any single transaction signature. Verifies the tx exists on-chain and shows the fee breakdown.
- **How to open:** click any signature on `/explorer`, **or** visit `http://localhost:3000/receipt/<any-base58-signature>` directly.
- **What you need:** a real Solana signature. Try one from devnet, e.g. paste any signature you got after placing an order on `/perps`.
- **What to click:**
  - **View on Solscan** to see the canonical on-chain record.
  - Browser **Print** for a paper / PDF copy.
- **What you should see:** signature, slot, blockTime, instructions list, and the 5 bps fee broken down. If the signature isn't found, you'll see a clear "Transaction not found" panel.

---

## 11. `/admin` — Platform admin dashboard

- **What it is:** The control panel for the platform operator (you). Shows total fees earned, today/week/month breakdowns, and the queue of creator-claim requests to approve.
- **How to open:** **/admin** in the URL bar (not in the nav by default — it's intentionally hidden).
- **What you need:**
  - `MONGODB_URI` set if you want real numbers; otherwise everything reads `0` and the claims queue is empty (and that's fine).
- **What to click:**
  - **Stats cards** at the top — read-only.
  - **Pending claims** table → **Approve** → enter the on-chain payout signature → **Submit**. The claim flips to `completed`.
- **What you should see:** if Mongo isn't configured, four `0 SOL` cards and an empty claims table. With Mongo + activity, real numbers appear.

---

## 12. `/creator` — Creator dashboard

- **What it is:** Where signal creators view their share (50%) of fees earned and submit a withdrawal request.
- **How to open:** **/creator** in the URL bar.
- **What you need:** a connected wallet to be paid out; otherwise read-only.
- **What to click:**
  - **Connect Wallet** → your earned & claimable SOL appears.
  - **Claim** → fills in the request; admin must approve it on `/admin`.
- **What you should see:** "Total earned", "Already claimed", "Available to claim" cards plus a history of past claims.

---

## 13. `/user` — User dashboard

- **What it is:** A stub right now (`User API endpoint` placeholder). Reserved for a per-user activity feed.
- **How to open:** **User** tab.
- **What to expect:** an almost-empty page. This is wired up, just intentionally minimal.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Connect Wallet` does nothing | Install Phantom / Backpack / Solflare browser extension and refresh. |
| Trade fails with "insufficient SOL" | Get devnet SOL from a faucet (see `/perps` section). |
| `/explorer` shows "No transactions yet" | Either you haven't traded, or `MONGODB_URI` isn't set. Both are fine. |
| Issue overlay (red `N issues` pill) keeps growing | Should be fixed — every API route degrades gracefully when Mongo isn't configured. If it returns, check `ui/.env.local` for syntax errors. |
| Page is blank / stuck on "Loading…" | Check the terminal running `bun run dev` for compile errors. Hot-reload usually recovers in 2–5 s. |
| Wrong network / want mainnet | Edit `NEXT_PUBLIC_SOLANA_DEVNET_RPC_ENDPOINT` and `NEXT_PUBLIC_SOLANA_MAINNET_RPC_ENDPOINT` in `ui/.env.local`, restart `bun run dev`. |

---

## TL;DR — recommended demo order

If you only have 5 minutes to show this off:

1. `/verify` — prove cryptography works (no wallet needed).
2. `/security` — click "Run test" on Replay Attack and Forgery.
3. `/benchmarks` — click "Run all" so the audience sees the numbers.
4. `/blockchain` — point at one concept card to show the source-code links.
5. `/perps` — connect a devnet wallet, place a tiny SOL-PERP order, then open `/explorer` and `/receipt/<sig>` to show the audit trail.

That's the full story: theory → defence → speed → code → live trade → on-chain receipt.
