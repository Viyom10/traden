# PRESENTATION_SCRIPT.md

A simple, read-aloud script for the deck
`Atomic-Fee-Enforcement-in-Decentralized-Perpetual-Trading-on-Solana.pdf`.

* Each slide block tells you what to point at on the slide and exactly
  what to say.
* Short sentences. Plain English. Read it as it is.
* Total speaking time at a normal pace: about **6 to 7 minutes**.
* If you have only 4–5 minutes, you can skip the lines marked
  `(skip if short on time)`.

There are five small things in the deck that need a quick manual fix
before this script reads cleanly — see the **"Fix the deck first"**
checklist at the bottom of this file. They take about 10 minutes inside
Gamma.

---

## Slide 1 — Title slide

What's on the slide: the project title, the one-line idea, your name.

Say:

> Hi sir. I'm Viyom Gupta, and my project is called **TRADEN-PROD**.
> The full name is **Atomic Fee Enforcement in Decentralized
> Perpetual Trading on Solana**.
>
> The big idea is on the slide. I take the platform's trading fee and
> the user's trade, and I put them inside the same Solana transaction.
> The user's wallet signs them together with one signature. Because of
> how Solana works, that means the fee and the trade can never come
> apart — they either both go through, or neither one does. And I do
> all of this without writing a single smart contract.

---

## Slide 2 — The problem

What's on the slide: a "Broken" box on the left, "My Model" box on the right, three small notes at the bottom.

Say:

> Let me start with the problem.
>
> Today, almost every decentralized exchange collects its platform fee
> in a **separate transaction** from the trade. You can see that on the
> left side. First the trade goes through. Then a second transaction
> tries to collect the fee. That second transaction is very easy to
> skip. The user can just refuse to sign it. A trading bot can re-order
> it. A middleman can drop it. So the platform keeps losing revenue.
>
> On the right is what I do instead. One single transaction. One
> signature. The fee and the trade sit inside the same package. They
> cannot be split.
>
> The three small notes at the bottom say the same thing in three
> different ways: the second transaction is too easy to drop;
> building your own on-chain fee program is expensive and locks you to
> one exchange; and my approach is different because the fee is part
> of the message the user signs — and the user cannot un-sign half of
> a signature.

---

## Slide 3 — How it actually works

What's on the slide: a vertical 10-step flow on the left, three "why this works" boxes on the right.

Say:

> Now let me walk through how it works. The flow on the left shows the
> steps in order, top to bottom.
>
> The user clicks "Place Order" on the trading page. Drift's SDK builds
> the trade transaction. My code — a small wrapper called
> `DriftClientWrapper` — catches that transaction before it reaches
> the wallet. I open it up, add a small **fee transfer instruction** at
> the front, and close it back up.
>
> Then the wallet takes a **SHA-256 hash** of the whole thing and asks
> the user to sign that hash with their **Ed25519** key. The wallet
> sends it to Solana. The validators check the signature against the
> full message and run every instruction together. Either both the fee
> and the trade succeed, or both fail.
>
> The three boxes on the right explain why this can't be broken.
> First — Ed25519 signs the **whole** message. If you change even one
> byte, the signature breaks. Second — Solana never runs half a
> transaction. It's all or nothing. Third — so the fee is now part of
> the hash the user already signed. Removing it, changing it, or even
> just moving it all break the signature.

---

## Slide 4 — Architecture

What's on the slide: five stacked layer blocks, with Layer 3 highlighted with a star.

Say:

> Here's the architecture, top to bottom.
>
> Layer 1 is the user interface — Next.js, with thirteen pages in total.
>
> Layer 2 handles live data — Zustand stores and websocket streams
> for prices and account info.
>
> Layer 3, the one with the star, is where my whole contribution lives.
> This is the wrapper that catches the trade and adds the fee.
>
> Layer 4 is the protocol layer — Drift's SDK, the Solana library,
> the wallet adapter.
>
> Layer 5 is storage — MongoDB for an audit trail, plus Pyth and
> Switchboard for live prices.
>
> The main point of this slide is that only Layer 3 is new work. Every
> other layer is normal app code. The new idea is concentrated in one
> small wrapper file.

---

## Slide 5 — Code inventory

What's on the slide: a left column with five `.ts` files, a right column with six new routes, and a small bottom counter.

Say:

> These are the actual files I wrote. On the left are the five core
> library files.
>
> `DriftClientWrapper` is the interceptor. Every trade goes through it
> and gets the fee bundled in.
>
> `tradingFee.ts` calculates the fee — five basis points of the trade,
> and if the trade is in USDC it converts the fee into SOL using a
> live oracle price.
>
> `cpi.ts` is a parser I wrote that takes any Solana transaction and
> shows the full tree of which program called which.
>
> `merkle.ts` is a SHA-256 Merkle tree I built from scratch with safety
> against tampering.
>
> `solscan.ts` gives explorer links so anyone can verify a transaction
> on chain.
>
> On the right are the six new pages I added — `/blockchain`, `/verify`,
> `/security`, `/benchmarks`, `/explorer`, and `/receipt`. Each one
> proves a different part of the design.
>
> In total: six new library files, six new pages, six API routes
> hardened, about nine thousand lines of new code.

---

## Slide 6 — Features

What's on the slide: two columns side by side — "Trading Platform" on the left, "Verification Surface" on the right.

Say:

> This slide shows the two halves of the project.
>
> On the left is the actual trading platform. Forty plus perpetual
> markets, real candlestick charts, an order book, five order types,
> leverage, spot deposits and withdrawals, wallet support for Phantom
> and Solflare, a signal marketplace where creators can share trades,
> and admin and creator dashboards.
>
> On the right are the six pages I built specifically to **prove** the
> cryptography works. Anyone can click through them and check the math
> themselves. I'll show those pages live in the next slide.

---

## Slide 7 — Live demo

What's on the slide: a row of six route tabs at the top, then six numbered steps below.

Say:

> This is the live demo. Six steps in order. I'll explain each one
> quickly, then switch to the actual app.
>
> **Step 1, `/perps`.** I connect Phantom on devnet and place a small
> SOL-PERP order. The wallet asks for **one** signature.
>
> **Step 2, `/receipt`.** I open the receipt page for that signature.
> You'll see the fee row and the trade row both pointing to the same
> transaction.
>
> **Step 3, `/explorer`.** I paste the same signature here. Three green
> checks appear — fee found, trade found, both inside the same atomic
> transaction. Below that, the full call tree.
>
> **Step 4, `/verify`.** This runs fully in the browser. No wallet
> needed. I'll show the ten-step integrity wizard, then the Merkle
> proof builder. I tamper with one leaf and the proof breaks.
>
> **Step 5, `/security`.** I click "Run all attack tests". All six
> attacks turn green — replay, fake signature, fee removed, fee
> changed, instructions reordered, and recipient swapped.
>
> **Step 6, `/benchmarks` and `/blockchain`.** Numbers come back
> showing **less than one percent overhead** on every metric. Then on
> `/blockchain` you'll see every concept linked to a real file.
>
> *(skip if short on time)* One quick note before I switch — if the
> wallet or the network gives any trouble, `/verify` and `/security`
> alone work without any wallet at all. So they prove the whole idea
> by themselves.

---

## Slide 8 — Security

What's on the slide: a six-row table of attacks, with green ticks. Below it, two example SHA-256 hashes side by side.

Say:

> This slide goes deeper into the six attacks. Quick walk through the
> rows.
>
> **One — fee removed.** If anyone strips out the fee instruction, the
> message hash changes and the signature stops verifying.
>
> **Two — fee amount changed.** If anyone changes even one lamport in
> the fee, SHA-256 flips about half the bits of the hash. You can see
> that at the bottom of the slide — same input, change one lamport,
> and roughly half the digits change. That's called the avalanche
> effect.
>
> **Three — recipient swapped.** If anyone changes who receives the
> fee, the signature breaks because the recipient address is part of
> the signed message.
>
> **Four — replay attack.** If anyone tries to broadcast the same
> signed transaction again later, Solana rejects it. The recent
> blockhash inside the message expires after about a minute.
>
> **Five — fake signature.** Ed25519 has 128-bit security. Faking a
> signature would take 2 to the power 128 tries.
>
> **Six — instructions reordered.** If anyone swaps the order of the
> two instructions, the bytes change, the hash changes, and the
> signature breaks again.
>
> All six attacks are implemented as live tests — they actually run in
> the browser. Every one fails to bypass the system.

---

## Slide 9 — Performance and concepts

What's on the slide: four metric cards at the top, then a 3 by 3 grid of blockchain concepts at the bottom.

Say:

> Now the performance side. Four numbers, all measured live in the
> browser.
>
> The fee instruction adds **64 bytes** to the transaction. Signing it
> takes **less than one millisecond** extra. It uses about **150
> compute units** out of Solana's 200,000 unit budget. In total, the
> overhead is about **0.07 percent**. It's almost free.
>
> The reason it's so cheap is that I don't deploy any new on-chain
> code. I just add one extra instruction to a transaction that was
> going to land anyway.
>
> Below the numbers is the grid of blockchain concepts the project
> actually uses. Asymmetric crypto — Ed25519. SHA-256 and a custom
> Merkle tree. Digital signatures that cover every instruction.
> Wallets and base58 addresses. Versioned transactions with Address
> Lookup Tables. Atomic execution. Replay protection through the
> recent blockhash window. Decentralized oracles, Pyth and Switchboard.
> And cross-program invocation, shown live on the explorer page.
>
> Every one of these concepts is connected to a real file in the
> repository — not just a slide bullet.

---

## Slide 10 — Closing

What's on the slide: three takeaway cards on top, three "What's Next" cards in the middle, a small QR code in the corner.

Say:

> To wrap up, three takeaways.
>
> **One — the cryptographic guarantee.** Ed25519, SHA-256, and Solana's
> atomic execution combine into a fee model that cannot be bypassed.
> No new on-chain code needed.
>
> **Two — zero on-chain footprint.** Nothing new is deployed. The whole
> contribution is just client-side TypeScript. Zero audit cost. And
> the same pattern can move to any Solana DEX.
>
> **Three — everything is checked in code.** Six attacks tested live.
> Four overhead numbers measured in the browser. Every claim links to
> a working demo in the app.
>
> Three things I would build next. A mainnet launch with signed fee
> receipts. A port of the same idea to other chains like Sui and Aptos.
> And a dynamic fee engine governed by a DAO.
>
> Thank you, sir. The QR code in the corner takes you straight to the
> repository. I'm happy to take questions, and I have the live demo
> ready on my laptop.

---

## Quick Q&A backup answers (in plain words)

If the professor asks one of these, here's a one-line answer in simple language:

* **"Why didn't you write a Solana program?"**
  Because I didn't need to. Solana already runs every instruction in a
  transaction together. Adding a smart contract would only mean more
  audit cost.

* **"Could the user just skip your wrapper?"**
  Yes — but then they're not using my platform. The promise is *while
  you're using TRADEN-PROD, you cannot skip the fee.* It's not a
  chain-wide rule.

* **"What if devnet is slow during the demo?"**
  `/verify` and `/security` run fully in the browser. No wallet, no
  network needed. They prove the whole idea by themselves.

* **"Why a Merkle tree if every fee is already on chain?"**
  Useful if I later want to bundle many off-chain receipts and prove
  any one of them with a small 32-byte root.

* **"What's the security level?"**
  Ed25519 gives 128-bit security. SHA-256 gives 128-bit collision
  resistance. Both are way beyond brute-force.

---

## Fix the deck first (do these inside Gamma before reading the script)

This script assumes the deck has been cleaned up. The full list of fixes
is in `GAMMA_MANUAL_EDITS.md`. The five must-do items for the script to
make sense are:

1. **Slide 3** — replace the broken 5-chip flow with a proper top-to-
   bottom **10-step numbered list** (it's currently in reversed order
   with half the steps missing).
2. **Slide 7** — re-order the row of route tabs at the top so it reads
   left-to-right: `/perps → /receipt → /explorer → /verify → /security
   → /benchmarks`. Right now it's in the wrong order and `/benchmarks`
   is missing entirely.
3. **Slide 9** — add the missing **Digital Signatures** tile to the
   bottom grid (so it becomes a proper 3 by 3, nine tiles total). Also
   un-jumble the captions for `Wallets`, `Atomic Execution`, and
   `Programs + CPI`.
4. **Slide 10** — restore the one-line description under each
   "What's Next" card. Right now `Cross-chain Port` just says
   "Sui / Aptos / Sei" with no caption.
5. **Slide 1** — make the title wrap on **two lines** (it's currently
   on six). Add the small credits line at the bottom of the slide.

The other fixes in `GAMMA_MANUAL_EDITS.md` are nice-to-have but won't
break the script.
