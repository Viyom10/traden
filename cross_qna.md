# GOAL:

You're trading ON Solana, not trading Solana itself.

Solana is the blockchain — it's the infrastructure layer. It provides the transaction execution, the cryptographic guarantees (Ed25519 signatures, SHA-256 hashing, atomic execution), and the network of validators.

Drift Protocol is the DEX — it's an on-chain perpetual futures exchange deployed on Solana. It lets users trade perpetual contracts (SOL-PERP, BTC-PERP, ETH-PERP, etc.) with leverage.

TRADEN-PROD is YOUR front-end — a UI that sits on top of Drift. Users connect their Solana wallet (Phantom/Solflare), place trades through Drift's SDK, and interact with Drift's on-chain program.

Your contribution is at the application layer — you intercept the trade transaction that Drift's SDK builds, inject a platform fee (SystemProgram.transfer) into that same transaction, and send the combined bundle to the user's wallet for a single signature. You're exploiting Solana's native properties (single-signature coverage + atomic execution) to make the fee inseparable from the trade.

So in short:

You're using Solana as the blockchain platform

You're using Drift as the trading protocol

You're building a trading UI on top of both

My main work is the atomic fee bundling wrapper — an interceptor that composes existing Solana primitives to make fee evasion cryptographically impossible

The assets being traded (SOL-PERP, BTC-PERP, etc.) are perpetual futures contracts. The actual trading happens via Drift's on-chain program. Your app is the gateway.

---
## does this exist?
"composing a fee instruction beside a trade exists — Phantom and Jupiter do it for swaps. What I contribute is (a) applying it to perpetuals, which are far more complex transactions with V0 messages and Address Lookup Tables, (b) formally proving the security properties with six live attack tests and four overhead benchmarks, and (c) making it a teachable, click-through demonstration of how Ed25519, SHA-256, and atomic execution combine to create an unbypassable guarantee. The production systems just do it silently — I show why it works."

---
## SLIDE 1 — Title slide

### What this slide is

The thesis sentence:

> "I bundle the platform fee and the user's trade into the same Solana
> transaction. The user signs both with one Ed25519 signature. Either
> both go through, or neither does — and there is no smart contract."

### What "no smart contract" means

A **smart contract** on Solana is a program written in Rust (or C),
compiled to BPF/SBF bytecode, and **deployed on-chain**. Once deployed,
it gets a program ID and can be invoked by anyone. Examples: Drift's
own perpetual program, Jupiter's aggregator program, Raydium's AMM
program.

When a project says "we wrote a smart contract for fees," they mean
they deployed a tiny on-chain program whose only job is:

```
fn collect_fee(ctx: Context, amount: u64) -> Result<()> {
    // transfer `amount` from ctx.payer to ctx.fee_recipient
}
```

…and they then make every trade go *through* that program. That's how
Jupiter's swap program embeds a small platform fee.

**I do not do that.** I add a `SystemProgram.transfer` instruction
(System Program is Solana's *built-in* program that handles SOL
transfers — it ships with the chain, it's not "deployed" by anyone)
into the same transaction as the trade. The composition happens in
*client-side TypeScript*, not in a deployed program. So my project
contributes zero new on-chain bytes.

### Why that matters

1. **No audit cost.** A new on-chain program is an attack surface.
   Auditing one costs anywhere from $30k to $300k. I bypass that
   entirely.
2. **No upgrade lock-in.** If Drift changes their instruction layout
   tomorrow, I update one TypeScript file and ship. A deployed program
   would need a governed upgrade authority + on-chain version migration.
3. **Portable.** The same wrapper pattern works for Jupiter, Raydium,
   any Solana DEX. A custom on-chain program only works for the DEX
   you wrote it for.
4. **The security guarantee is the same.** The validator still
   enforces atomicity and signature verification, regardless of whether
   my fee instruction came from a program I wrote or from the built-in
   System Program. That's the whole point of the project.

### Likely cross-questions

**Q: What exactly is a smart contract?**
A: A program deployed on a blockchain that runs deterministically
when called. On Solana they're written in Rust, compiled to BPF
bytecode, and uploaded to a program account. Once deployed, anyone
can invoke them. They're how on-chain logic — like an AMM, an order
book, or a fee collector — is implemented.

**Q: Then how do you "enforce" anything without a smart contract?**
A: Solana's runtime already enforces two things for me — single
signature coverage and atomic execution. I don't need to re-implement
those in my own program. I just compose existing instructions
(`SystemProgram.transfer` for the fee, the Drift instruction for the
trade) into one transaction, and the runtime takes care of binding
them together.

**Q: What is Ed25519?**
A: A digital signature scheme based on the Edwards25519 elliptic curve.
It gives 128-bit security, signs messages of any length deterministically,
and is what Solana wallets use to sign every transaction. Phantom,
Solflare, Backpack — all of them produce Ed25519 signatures.

**Q: What is "atomic"?**
A: A transaction is atomic if its instructions either *all* execute
successfully and commit to chain state, or *none* of them do. There
is no in-between. Solana guarantees this at the runtime level.

**Q: Why Solana and not Ethereum?**
A: Two reasons. (a) Solana transactions are an ordered list of
instructions covered by a single signature — the composition I rely on
is a first-class primitive. Ethereum transactions carry one call to one
contract; multi-call composition needs an explicit multicall contract.
(b) Solana fees and confirmation times are low enough that this kind of
millisecond-level overhead doesn't matter. On Ethereum, gas would be
a bigger story.

**Q: Is "no smart contract" really a strength? Smart contracts are
the whole point of programmable blockchains.**
A: It's a strength *for this specific problem*. Where I need new logic
(fee calculation, USDC→SOL conversion, attack tests, dashboards) I write
TypeScript. Where I need on-chain enforcement (atomicity, signature
verification, transfer execution) I lean on primitives the chain
already provides. That's good engineering — don't deploy what you
don't need to deploy.

---

## SLIDE 2 — The problem

### What this slide is

A side-by-side: how DEXes collect fees today (separate transaction,
easily dropped) versus how I do it (one transaction, one signature),
plus three short cards explaining why current methods are weak.

### **The most important question: is this real or hypothetical?**

This is the question the professor will almost certainly ask.
**Honest answer: the problem is real, the building block of the
solution exists in production, and what I add is the academic
formalisation, the perpetual-DEX application, and the proof artefacts.**

Real-world facts:

* **Fee bypass is a real, documented problem.** Aggregators like
  1inch and Jupiter went years without being able to capture a
  meaningful platform fee precisely because off-chain billing or a
  separate fee transaction can be skipped. They eventually solved it
  by deploying their own on-chain swap program with a fee built in.
* **Solana already has a "builder fee" pattern.** Phantom Wallet,
  Jupiter Mobile, and several other front-ends inject a small
  `SystemProgram.transfer` into the same transaction as the swap they
  send to Jupiter. So the *primitive* of "compose a fee instruction
  beside the trade instruction" is already in production.
* **Drift Protocol introduced "Builder Codes" in late 2024** — an
  on-chain version of the same idea, where the Drift program itself
  routes a fraction of taker fees to a builder authority. My approach
  is the *off-chain composition* version of the same idea.

So the contribution is **not the existence of the primitive** — it's:

1. **Doing it for perpetuals**, where the trade transaction is far more
   complex than a simple swap (Address Lookup Tables, V0 format, multiple
   inner CPIs). Simple swap-fee bundling doesn't carry over directly.
2. **Packaging it academically**: six attack tests with byte-level
   diffs, four live overhead measurements, a custom CPI tree visualiser,
   a Merkle proof demo, and an in-browser Ed25519 wizard. None of the
   production builder-fee implementations ship that.
3. **Proving the security claim** — not stating it. Anyone can click
   `/security` and see the six attacks fail in real time.

### Each bullet on the slide explained

**Left box — "How DEXs do it today" → Trade in TX 1, Fee in TX 2.**
Many DEX front-ends collect their cut in a *follow-up* transaction:
either an on-chain transfer the front-end builds and asks the user
to sign separately, or an off-chain billing system (Stripe-like)
that the user is supposed to settle later. Both are easy to skip.

**Right box — "How I do it" → ONE transaction, ONE signature.**
The fee is a `SystemProgram.transfer` *prepended* to the same
transaction message that contains the Drift order instruction. The
wallet signs both with one Ed25519 signature. The validator then
guarantees atomic execution.

### Three bottom cards explained

**Card 1 — "The second TX is too easy to drop."**

Three concrete attack vectors:

* **Users can refuse to sign it.** A wallet popup asking the user to
  pay a fee is a separate prompt the user can simply reject. The trade
  has already gone through.
* **Bots can reorder it.** MEV searchers — bots that monitor the
  Solana mempool/leader queue — can re-order pending transactions in
  a block to extract value. If a fee tx is independent of the trade
  tx, a bot can land the trade first, then drop or front-run the fee.

**Card 2 — "Custom fee programs are expensive."**

* **Audit costs.** A serious Solana program audit (by Trail of Bits,
  Halborn, OtterSec) runs from $30k to $300k. Re-audits on each
  upgrade.
* **Vendor lock-in.** A program written for Drift only works for
  Drift. To collect fees on Jupiter swaps, you'd need a second
  program. To collect on Raydium, a third.
* **Upgrade risk.** Any deployed program has a supply-chain risk —
  upgrade authority can be compromised, dependencies can have CVEs.

**Card 3 — "My approach is structural."**

The fee is *part of the message bytes the user signs*. Ed25519 is
deterministic and binds the signature to the exact bytes that were
hashed. The user's wallet cannot "un-sign" half a message. Removing
the fee instruction would require re-signing — which would require
re-prompting the user — which the user can simply refuse, but if
they don't sign the trade doesn't land either. The user is
forced into a binary choice: sign both, or trade nothing.

### Likely cross-questions

**Q: Does this problem actually exist in real DEXes? Or is it
hypothetical?**
A: It's very real. Jupiter, the largest swap aggregator on Solana,
went years without a meaningful platform fee for exactly this reason.
1inch on Ethereum had the same problem. The way they solved it was
by deploying their own on-chain program. My contribution is showing
you can solve it without that step, in the application layer, with a
mathematical guarantee instead of a code guarantee.

**Q: What's special about your work? Builder-fee bundling already
exists on Solana — Phantom and Jupiter Mobile do it.**
A: Three things are new. (a) I do it for *perpetuals*, where the
trade transaction is far more complex than a swap — Address Lookup
Tables, V0 format, multiple inner CPIs. The wrapper has to decompile
and recompile the message correctly. (b) I package it as a teachable,
verifiable system: six attack tests, four overhead benchmarks, a CPI
tree visualiser, a Merkle proof demo. None of the production
builder-fee systems ship those proofs. (c) The whole thing is
demonstrable — anyone can open `/security` or `/verify` in a browser
and see the math, no wallet required.

**Q: What's an MEV bot?**
A: MEV stands for Maximal Extractable Value. An MEV bot watches
pending transactions and tries to extract value by re-ordering them,
sandwiching them, or front-running them. On Solana these run as
"searchers" submitting bundles via Jito. Relevant here because if
your fee is in a separate transaction, an MEV bot can choose to
land the trade and drop the fee.

**Q: What's a relayer?**
A: A service that takes a user-signed transaction and submits it to
the network on the user's behalf. Used for latency optimisation,
gasless transactions, or batching. The risk: a malicious relayer
could censor or modify which transactions land. My approach removes
the relayer's ability to drop the fee, because the fee is inside the
single signed message.

**Q: Why not just use off-chain billing — the user signs up, pays
monthly, no on-chain fee at all?**
A: Off-chain billing requires KYC, a payment processor, and a recovery
mechanism if the user disputes a charge. It also breaks the
permissionless model — anyone with a wallet should be able to use the
DEX without an account. On-chain atomic fees preserve permissionlessness
*and* guarantee collection.

**Q: What if the user just doesn't use your front-end and goes
directly to Drift's UI?**
A: They can. The claim is *while you're using TRADEN-PROD, the fee is
unavoidable.* It's a per-platform guarantee, not a chain-wide
enforcement. This is the same model as Jupiter's swap fee or
Phantom's builder fee — only users of that interface pay the fee.

---

## SLIDE 3 — The 10-step mechanism

### What this slide is

The full sequence from the user clicking "Place Order" to the
validators executing both instructions, plus three "why this works"
cards on the right.

### Each step explained

**Step 1 — User clicks "Place Order" on `/perps`.**
The trade form gathers parameters (market, direction, size, leverage)
and calls Drift's SDK to build the order.

**Step 2 — Drift SDK builds a V0 transaction.**
A "V0 transaction" is Solana's newer transaction format that supports
**Address Lookup Tables (ALTs)** — a way to compress account
references. Drift uses many accounts per perpetual order (oracle,
state, market, user, vault, …); without ALTs, the transaction would
exceed Solana's 1232-byte size limit. So Drift returns a
`VersionedTransaction` whose message references entries inside ALTs
rather than embedding all account keys directly.

**Step 3 — DriftClientWrapper catches it before the wallet.**
My code wraps the SDK's `driftClient.sendTransaction`. Every trade
flows through the wrapper before the wallet ever sees it. This is the
single point where I can mutate the transaction without breaking
Drift's normal flow.

**Step 4 — Resolves every Address Lookup Table.**
Because ALTs are *references* to off-message account lists, I need to
fetch each ALT account from the chain and read out which pubkeys it
contains. Without doing this I can't see the actual account list — and
I need to see it to safely add a new instruction.

**Step 5 — Decompiles the V0 message into a TransactionMessage.**
With ALTs resolved, I can convert the compact V0 message back into a
plain `TransactionMessage` (Solana SDK type) that contains the full
account list and the full instruction list. Now I can manipulate it.

**Step 6 — Prepends `SystemProgram.transfer` (the fee).**
I build a fresh transfer instruction: from the user's wallet, to the
builder authority, for the calculated fee in lamports. I prepend it as
`instructions[0]` so it's the first thing executed in the transaction.

**Step 7 — Recompiles with the same payer / blockhash / ALTs.**
I rebuild a `VersionedMessage` using the same payer (the user), the
same recent blockhash Drift assigned, and the same set of ALTs. The
result is a brand-new transaction that contains *both* the fee
instruction and the trade instruction.

**Step 8 — Browser computes SHA-256 hash of the message.**
The wallet (Phantom) calls `crypto.subtle.digest("SHA-256", message)`
to get a 32-byte digest of the serialized message bytes.

**Step 9 — Phantom signs the hash with the user's Ed25519 key.**
Phantom uses the user's Ed25519 secret key (held in the wallet
extension, never exposed to my page) to produce a 64-byte signature
over that 32-byte digest. (Technically Ed25519 internally hashes again,
but the conceptual model — sign-the-message — is what matters here.)

**Step 10 — Validators verify and execute atomically.**
The signed transaction goes to Solana RPC, then to the leader
validator. The validator (a) re-computes the SHA-256 hash, (b) verifies
the Ed25519 signature against that hash and the user's public key,
and (c) executes every instruction in order inside a single state
commit. If any instruction fails, the entire transaction reverts.

**Outcome banner.** Both succeed, or both revert. There's no
"only the trade landed" outcome possible.

### The three right-side cards

* **Ed25519 covers the WHOLE message.** Ed25519 is a deterministic
  signature scheme. Signing the same message with the same key always
  produces the same signature; verifying requires the exact same
  bytes. Change one byte → different message → signature is invalid.
* **Solana never runs half a transaction.** This is a fundamental
  guarantee of Solana's runtime. The transaction is the unit of
  state commit. Either every instruction's account writes are
  applied, or none are. There is no scheduling point between
  instructions.
* **The fee is now part of the signed hash.** Once the user signs,
  the fee instruction's bytes (its program ID, its account list, its
  data) are inside the digest. Removing it changes the digest;
  changing the amount changes the digest; reordering changes the
  digest. All three break verification.

### Likely cross-questions

**Q: What is a V0 transaction?**
A: Solana's newer transaction format (introduced in 2022) that
supports Address Lookup Tables. It compresses references to commonly-
used accounts into table indices, fitting more instructions inside
the 1232-byte transaction size limit. Drift uses it because their
perpetual orders touch many accounts.

**Q: What is an Address Lookup Table?**
A: An on-chain account that holds a list of pubkeys. Other transactions
can reference those pubkeys by index (1 byte) instead of including the
full 32-byte pubkey. ALTs cut the size of complex transactions
dramatically.

**Q: What if Drift changes their instruction layout tomorrow?
Doesn't your wrapper break?**
A: My wrapper doesn't parse Drift's instructions — it treats them as
opaque bytes. I just decompile the message structure (which is
standardised by Solana, not Drift), prepend my own instruction, and
recompile. Drift can change their instruction format freely; my
wrapper still works as long as Solana's message format is unchanged.

**Q: Why not just deploy a Solana program that wraps Drift?**
A: That's the on-chain approach Jupiter and Drift's own Builder Codes
take. It works but has costs: audit, deployment fee, upgrade risk,
and lock-in to one DEX. My approach achieves the same atomicity
guarantee with zero on-chain footprint, and the same wrapper pattern
ports to any Solana DEX.

**Q: When the user clicks Sign in Phantom, does Phantom show them
the SHA-256 hash? How do they know what they're signing?**
A: Phantom shows them a *human-readable summary* of the transaction
— the instructions, the accounts, the amount of SOL leaving their
wallet. The user can see the System Program transfer for the fee in
Phantom's preview. The SHA-256 hash itself is computed in the
background. So the user has visual confirmation, plus the
cryptographic guarantee.

**Q: What if the user uses a CLI client that doesn't show the
preview?**
A: The cryptographic guarantee still holds — they can't pay only the
trade without paying the fee. What they lose is the *human-readable
warning*. But the security model targets attackers (relayers, bots,
modifications after signing), not informed-consent of the user. If a
user knowingly signs a transaction with a fee, they're agreeing to
pay it.

**Q: Why prepend the fee instruction (instructions[0]) and not append
it (instructions[N])?**
A: Two reasons. (a) If the user's account is *barely* funded,
prepending guarantees the fee debit happens first; if it fails the
trade doesn't even attempt. (b) Putting it at index 0 makes it
visually obvious in any explorer (Solscan, the `/explorer` page) —
it's the first thing reviewers see.

**Q: What if the SHA-256 happened to collide for two different
messages?**
A: SHA-256 has 128-bit collision resistance. Finding two messages
with the same hash would take ~2^128 attempts — computationally
infeasible. No SHA-256 collision has ever been found. (SHA-1 is
broken; SHA-2 family is not.)

**Q: What is the recent blockhash?**
A: Solana includes a recent block's hash inside every transaction.
The validator only accepts the transaction if the blockhash is
within ~150 slots (~60 seconds) of the current slot. Old blockhashes
are rejected. This is Solana's built-in replay protection.

---

## SLIDE 4 — Architecture

### What this slide is

A 5-layer stack showing where in the system my contribution sits.

### Each layer explained

**Layer 1 — Presentation (Next.js 15, React 19, Tailwind, 13 routes).**
The browser-facing UI. Next.js's App Router gives me file-based routing
(every folder under `/app` becomes a URL). React 19 handles the rendering.
Tailwind for styling. Thirteen routes total — seven product routes
(`/perps`, `/spot`, `/signals`, `/user`, `/admin`, `/creator`, `/`) and
six verification routes (`/blockchain`, `/verify`, `/security`,
`/benchmarks`, `/explorer`, `/receipt`).

**Layer 2 — State & Live Data (Zustand + websockets).**
Zustand is a lightweight state management library — simpler than
Redux. I use three Zustand stores: `OraclePriceStore`, `MarkPriceStore`,
`UserAccountDataStore`. They subscribe to Drift's websocket feeds
(price ticks, account updates) so the UI re-renders on every change
without polling.

**Layer 3 — ⭐ Atomic Fee Enforcement.**
Two files: `DriftClientWrapper.ts` (the interceptor) and
`tradingFee.ts` (the 5-bps calculator). Everything that makes this
project unique lives in this layer.

**Layer 4 — Protocol & Wallet.**
The Drift SDK (their TypeScript wrapper around their on-chain
program). `@solana/web3.js` for low-level transaction primitives.
The Solana Wallet Adapter for Phantom/Solflare integration. `tweetnacl`
— a tiny in-browser Ed25519/SHA-256 library used by my `/verify` and
`/security` pages for the client-side cryptography demos.

**Layer 5 — Persistence & APIs.**
Next.js API route handlers (under `/app/api`) write to MongoDB —
fee records, trade records, signal records, claim records.
**Persistence is non-essential to correctness:** if MongoDB is down,
every API route gracefully degrades to "200 OK, empty data". The
on-chain `SystemProgram.transfer` is the canonical record. Pyth and
Switchboard are decentralised oracle networks — Drift consumes their
price feeds; I consume them indirectly through Drift's oracle cache to
do the USDC→SOL fee conversion.

### Likely cross-questions

**Q: Why Next.js?**
A: It bundles the React UI, the API routes, and the build pipeline
into one framework with sensible defaults. The App Router gives me
file-based routing. Server Components let me render initial HTML on
the server for fast first-paint. Turbopack makes dev mode fast.

**Q: Why Zustand and not Redux?**
A: Less boilerplate. Drift's reference template uses Zustand. Each
store is a single file with no actions/reducers ceremony. For
real-time data updating 30+ times per second, the lighter API
matters.

**Q: What's tweetnacl?**
A: A pure-JavaScript implementation of NaCl (the cryptography
library by Daniel Bernstein). It exposes Ed25519 sign/verify and
SHA-512 in ~10 KB. I use it in the browser for the `/verify` and
`/security` demos so they can run without any wallet — pure math,
no network.

**Q: Why MongoDB if everything's already on-chain?**
A: For UX. Loading the admin dashboard's "all fees ever collected"
table from chain would mean a slow RPC scan of every signature.
MongoDB caches that data for fast reads. But — critically — it's
just a cache. The chain is the truth. If MongoDB is wiped, I can
rebuild it from chain history.

**Q: What if MongoDB is misconfigured? Does the app crash?**
A: No. I added an `isMongoConfigured()` check that every API route
calls. If MongoDB is unset, the route returns `{ success: true,
mongoConfigured: false, ... empty data ...}` with a 200 status. The
trading flow still works because the on-chain `SystemProgram.transfer`
remains the canonical fee record.

**Q: What's a websocket here?**
A: A persistent two-way connection between browser and server. Drift
runs a websocket gateway that pushes price updates and account
updates to subscribed clients. My Zustand stores subscribe at app
startup and update on every push, so the UI shows live prices without
polling.

**Q: Couldn't you have done this without all these layers?**
A: Yes — the cryptographic contribution (Layer 3) is a few hundred
lines of TypeScript. The other layers exist because I wanted a
*real* working trading platform around it, not a toy demo. Without
Layers 1, 2, 4, 5 there'd be nothing to interept and nothing to
demonstrate.

---

## SLIDE 5 — Code inventory

### What this slide is

The five core library files plus the six new routes, plus a one-line
counter at the bottom showing the rough scope of the new code.

### Each file explained

**`DriftClientWrapper.ts` — the interceptor.**
A class that wraps Drift's `driftClient`. The crucial method is the
overridden `sendTransaction`: it accepts a `VersionedTransaction`,
resolves ALTs, decompiles, prepends the fee, recompiles, signs (via
the wallet), and sends. Every perpetual order in the app flows
through it.

**`tradingFee.ts` — the fee calculator.**
Pure functions. `computeFeeLamports(orderSizeUsd, solUsdPrice)` does:

```
feeUsd = orderSizeUsd * 5 / 10_000
feeSol = feeUsd / solUsdPrice
feeLamports = Math.round(feeSol * 1_000_000_000)
```

Five basis points = 5/10,000 = 0.05 %. It also handles edge cases
(very small orders → minimum fee, very large orders → cap).

**`cpi.ts` — the call-tree parser.**
`extractCpiTree(parsedTx)` takes a `ParsedTransactionWithMeta` (from
`connection.getParsedTransaction`) and turns the flat
`meta.innerInstructions` array into a tree:

```
{
  topLevel: [
    { programId: "11111111111111111111111111111111", program: "System",
      instruction: "transfer", info: { ... },
      cpiChildren: [ ... ] },
    { programId: "dRiFt...", program: "Drift", ...
      cpiChildren: [
        { programId: "TokenkegQ...", program: "SPL Token", ...},
        ...
      ]
    }
  ]
}
```

Plus a `programLabel(pubkey)` map (System, SPL Token, Pyth,
Switchboard, Drift, ...) for friendly display.

**`merkle.ts` — SHA-256 Merkle tree, from scratch.**
About 100 lines. Domain-separated hashing:
`leaf_hash = SHA256(0x00 ‖ leaf_data)`,
`node_hash = SHA256(0x01 ‖ left ‖ right)`. The 0x00/0x01 prefixes
prevent second-preimage attacks where a leaf could be passed off as
an internal node. Exposes `buildMerkleTree(leaves)`,
`getProof(tree, idx)`, `verifyProof(leaf, proof, root)`.

**`solscan.ts` — explorer link helper.**
Two functions: `solscanTx(sig, env)` and `solscanAccount(addr, env)`.
Picks `solscan.io` vs `solscan.io?cluster=devnet` based on the
current network. Used everywhere a signature or account is rendered.

### Each route explained

* **`/blockchain`** — A long page with one card per blockchain
  primitive (Ed25519, SHA-256, Merkle, atomic execution, replay
  protection, CPI, oracles, …). Each card has a short theory blurb,
  the implementation files, and a link to the live demo.
* **`/verify`** — Four sections. Section 1: 10-step Ed25519+SHA-256
  wizard. Section 2: hash properties (avalanche, determinism,
  one-way). Section 3: tamper matrix. Section 4: Merkle proof
  builder + tamper test.
* **`/security`** — Six attack cards in a grid. Each one has a
  "Run test" button and a "Run all attack tests" button at the top.
  Results show byte-level diffs and PASS/FAIL.
* **`/benchmarks`** — Four metric cards. Each runs 100 iterations
  of the relevant operation in the browser and reports the average.
* **`/explorer`** — Paste a signature, hit Verify. Renders the CPI
  tree using `cpi.ts` and shows three green pills if the fee + trade
  bundling is correct on chain.
* **`/receipt/[signature]`** — A shareable per-transaction page.
  Fetches the parsed tx, shows the fee row, the trade row, the
  signed digest, and the Solscan link.

### Likely cross-questions

**Q: Why did you build Merkle tree from scratch when libraries exist?**
A: Two reasons. (a) Pedagogy — implementing it from scratch is the
best way to actually understand domain separation, second-preimage
attacks, and proof verification. The professor can read my 100 lines
of code and check the math directly. (b) Zero dependencies — `merkle.ts`
uses only the browser's WebCrypto SubtleCrypto API. No npm package
to audit, no supply-chain risk.

**Q: Why is `cpi.ts` needed when Solscan already shows the call tree?**
A: Solscan is a black box. I wanted a parser I could reason about,
that I could embed inside my own `/explorer` page so the verification
flow stays in-app, and that I could use to programmatically check
"is the fee instruction at depth 0 next to the Drift instruction?"
That programmatic check is what `/explorer`'s three green pills run.

**Q: 9k LoC — broken down how?**
A: Roughly: ~1k for the wrapper + fee + cpi + merkle + solscan
(`src/lib/`); ~2k for the six new routes; ~1k for components shared
between them; ~1k for the API route hardening; the rest is types,
tests, and supporting plumbing. Excludes the original Drift template
code which I left untouched where possible.

**Q: Is `solscan.ts` really worth being called out as a "core library"?**
A: It's a small file but it's structurally important — it's the only
file that knows about the devnet/mainnet boundary for explorer URLs.
Every signature display in the app routes through it. If we ever
want to switch to Solana Explorer, Helius, or Birdeye instead, we
change one file.

**Q: Test coverage?**
A: The six security tests in `/security` and the four benchmarks in
`/benchmarks` *are* the test suite — they run live in the browser
every time the page loads. There are also TypeScript type checks
that catch most regressions at build time. I deliberately don't have
a separate Jest test suite because the live tests are more
informative for a reviewer.

---

## SLIDE 6 — Features

### What this slide is

Two columns side by side: the trading platform (left) and the six
verification pages (right).

### Each line on the left explained

* **40+ perpetual markets** — Drift Protocol exposes ~40 perpetual
  contracts (SOL-PERP, BTC-PERP, ETH-PERP, plus altcoins). My UI
  picks them up via the SDK's market list. Live oracle and mark
  prices stream over websocket.
* **Candlestick charts + websocket orderbook** — Chart powered by
  TradingView's `lightweight-charts` library. Orderbook reads
  Drift's depth-of-market websocket.
* **5 order types** — Market, Limit, Take-Profit, Stop-Loss,
  Oracle-Limit (a limit order priced relative to the live oracle).
* **Spot deposit / withdraw / swap** — `/spot` page handles USDC
  and SOL deposits to Drift's vaults, withdrawals back to the
  wallet, and in-protocol swaps.
* **Phantom + Solflare** — Via the standard Solana Wallet Adapter,
  so any compliant wallet works.
* **Signal marketplace** — `/signals` page lists trade signals
  published by creators. A user can click "Copy" to execute the
  same trade. The 5-bps fee still applies.
* **Creator revenue share (50/50)** — When a fee is collected on a
  copied signal, half goes to the platform and half goes to the
  signal creator. Tracked in MongoDB; claim flow on `/creator`.
* **Admin & creator dashboards** — `/admin` shows total fees,
  pending claims, payment history. `/creator` shows the creator's
  own earnings and claim history. Every signature is a Solscan link.

### Each line on the right explained

* **`/blockchain`** — concept-to-source map. Lets the professor see
  every blockchain primitive linked to a real file in the repo.
* **`/verify`** — runs Ed25519, SHA-256, and Merkle verification
  fully in the browser. No wallet needed.
* **`/security`** — six attack tests. Click any, see byte-level
  diffs of why the attack fails.
* **`/benchmarks`** — measures the four overhead numbers live.
* **`/explorer`** — paste any signature, see the CPI tree.
* **`/receipt`** — per-tx proof page; shareable.

### Likely cross-questions

**Q: Did you build the trading platform from scratch?**
A: I used Drift's open-source UI template as a starting point — the
trading form, candlestick chart, orderbook component, and Wallet
Adapter wiring were already there. What I added on top: the entire
Layer 3 wrapper (atomic fee bundling), the six verification routes,
the signal marketplace logic, the creator revenue-share split, the
admin/creator dashboards, the API route hardening, and all of the
documentation. The unique cryptographic contribution is mine end-to-
end.

**Q: Why both Phantom and Solflare — what's the difference?**
A: They're both Solana wallets. Phantom is the most popular browser
extension; Solflare is the second most popular. Both implement the
Wallet Standard, so supporting both is essentially free — the Wallet
Adapter abstracts the differences.

**Q: What's a trading signal?**
A: A trade idea published by an experienced trader (the "creator").
Other users can subscribe and one-click execute the same trade. My
50/50 revenue share rewards the creator for the fee generated by
copy-trades.

**Q: 50/50 revenue split — how is that enforced?**
A: It's an off-chain accounting policy. The on-chain fee goes 100 %
to the platform's builder authority. MongoDB then attributes 50 % to
the creator who originated the signal. The creator submits a claim;
the admin approves; payout happens off-chain or via a future on-chain
escrow. This is honest about being a Phase-1 implementation — the
"signed fee receipts" item in Slide 10's "What's Next" is about
making this split on-chain too.

**Q: Why six verification pages? Isn't that overkill?**
A: Each page proves a different claim. `/blockchain` proves
*coverage* (every primitive is wired to code). `/verify` proves
*construction* (the cryptography works in isolation). `/security`
proves *attack resistance*. `/benchmarks` proves *cost*. `/explorer`
proves *on-chain reality*. `/receipt` proves *user-facing
transparency*. Collapsing them into one page would lose the
narrative.

---

## SLIDE 7 — Live demo

### What this slide is

The exact click-path of the demo, with six numbered steps. The
narration matches the read-aloud script.

### Each step explained in more depth

**Step 1 — `/perps`.** I connect Phantom on devnet. I pick
SOL-PERP, set leverage to 1x, type 0.01 SOL into the size box, and
click "Place Market Order". The wallet popup appears asking for **one**
signature. Phantom shows the System Program transfer (the fee) and
the Drift instruction in its preview. I sign.

**Step 2 — `/receipt/<sig>`.** The toast that confirmed the trade
included the signature. I click the receipt link (or paste it in
`/receipt/<sig>`). The page shows: confirmation status, the SHA-256
digest the wallet signed, the fee row, the trade row, both with the
*same signature* and a Solscan deep link.

**Step 3 — `/explorer`.** Same signature pasted here. Three green
"check" pills appear: **Fee found** (a `SystemProgram.transfer` to
the builder authority is present), **Trade found** (a Drift
instruction is present), **Both atomic** (both are at depth 0 in the
same transaction message). Below the pills, my CPI tree visualiser
draws the call graph with indentation, including Drift's own inner
calls to System, SPL Token, Pyth, and Switchboard.

**Step 4 — `/verify`.** I run the 10-step wizard so the audience
sees a fresh `Keypair.generate()`, the message bytes, the SHA-256
digest, the Ed25519 sign, the verify, and finally a 1-byte tamper
that flips the signature to INVALID. I scroll to Section 4 (Merkle).
I edit one leaf in the tree, the proof's verify call returns false.

**Step 5 — `/security`.** "Run all attack tests". Six cards
flip to green over a few seconds. Expanding any card shows the
attacker's modified bytes vs. the original, plus the assertion that
detected the attack.

**Step 6 — `/benchmarks` then `/blockchain`.** "Run benchmarks"
fires off 100 iterations of each operation. Numbers settle at the
+64 B / <1 ms / ~150 CU / ~0.07 % values from Slide 9. Then on
`/blockchain` I expand a couple of concept cards to show every primitive
maps to a file path and a live demo route.

### Likely cross-questions

**Q: What if devnet is down or slow during the demo?**
A: Step 4 (`/verify`) and Step 5 (`/security`) run entirely in the
browser — no wallet, no RPC, no server. Together they prove the
cryptographic thesis end-to-end. I'd skip steps 1-3 and 6 and run
only those two if the network is unreliable.

**Q: What is CPI?**
A: Cross-Program Invocation. When one Solana program calls another
during execution, that's a CPI. Drift's perpetual-order instruction,
for example, internally CPIs into the SPL Token program (to move
tokens), the System Program (to allocate accounts), and the Pyth /
Switchboard programs (to read oracle prices). All those inner calls
are captured by the runtime in `meta.innerInstructions`.

**Q: What's a "leaf" in a Merkle tree?**
A: The bottom row of the tree. Each leaf is a piece of data; pairs
of leaves get hashed together to form the row above; pairs of those
get hashed together; and so on until a single hash — the root —
remains. A proof for a leaf is the chain of sibling hashes needed
to recompute the root.

**Q: Did you write the attack code yourself?**
A: Yes. Each of the six attacks is a small TypeScript function in
`/security/page.tsx` that constructs a tampered message, signs the
*original* message, then asks `tweetnacl.sign.detached.verify` to
verify the original signature against the tampered message. The
tests pass when the verification correctly returns `false`.

**Q: Are these realistic attacks or contrived?**
A: They're the canonical attack classes from the BITS F452 syllabus
and from real-world Solana incident reports. Replay, signature
forgery, MITM, and reordering are all attacks documented in NIST's
SP 800-57 and in Solana's own security postmortems.

**Q: Why "live" tests instead of unit tests?**
A: Unit tests run hidden in CI and produce a green check. Live tests
let the professor see the bytes change in front of them and the
verify call return false. It's the difference between *being told*
the system is secure and *being shown*.

---

## SLIDE 8 — Security

### What this slide is

A 6-row table: each row is one attack class, why it fails, and how
my test exercises it. Below the table, two SHA-256 hashes side by
side to illustrate the avalanche effect.

### Each row explained

**Fee removed.**
*Attack:* attacker takes the user-signed transaction and removes the
`SystemProgram.transfer` instruction.
*Why it fails:* the message bytes change (one fewer instruction in
the array), so SHA-256 produces a different digest, so the
Ed25519 verifier returns false, so the validator rejects the
transaction.
*My test:* I build `[fee, trade]`, sign it, then build `[trade]`
alone, then call `verify(originalSig, newMsg, pubkey)` — returns
false. Test passes.

**Fee amount changed.**
*Attack:* attacker bumps the fee instruction's lamport amount up or
down.
*Why it fails:* the lamport amount is part of the instruction's
data field, which is part of the message bytes. SHA-256's avalanche
property means changing even 1 lamport flips ~50 % of the digest's
bits. Verification fails.
*My test:* I sign with `feeLamports = 1000`, then re-encode with
`feeLamports = 1001`, count the differing bits in the two SHA-256
outputs. Typically 124–132 bits differ out of 256.

**Recipient swapped (MITM).**
*Attack:* a man-in-the-middle replaces the fee recipient pubkey with
the attacker's own pubkey before forwarding the transaction to RPC.
*Why it fails:* account keys are part of the signed message header.
Changing the pubkey changes the bytes, breaks the hash, breaks the
signature.
*My test:* I sign with recipient = builder authority, then replace
the recipient bytes with `Keypair.generate().publicKey`, and call
verify on the original signature. Returns false.

**Replay.**
*Attack:* attacker captures a successfully-signed transaction and
broadcasts it again hours or days later, hoping the user pays a
second fee.
*Why it fails:* every Solana transaction includes the
`recentBlockhash` of a recent block. The validator only accepts
transactions whose blockhash is within the last ~150 slots
(~60 seconds). Older blockhashes are dropped.
*My test:* I sign a transaction with `blockhash A`, simulate time
passing (use a fake `blockhash B`), and verify that the original
signed transaction is rejected by checking the blockhash window.

**Fake signature.**
*Attack:* attacker forges a signature without knowing the user's
private key.
*Why it fails:* Ed25519 over Curve25519 has 128-bit security.
Forging a signature requires solving the elliptic-curve discrete
log problem on Curve25519, which would take ~2^128 operations —
far beyond any computer's reach.
*My test:* (a) sign with key A, verify with key B — returns false.
(b) sign normally, flip 1 byte in the 64-byte signature, verify —
returns false.

**Instructions reordered.**
*Attack:* attacker swaps the order of `instructions[0]` (fee) and
`instructions[1]` (trade) before broadcasting.
*Why it fails:* the message's instruction list is serialised in
order; swapping changes the bytes, changes the hash, breaks the
signature.
*My test:* swap `ix[0]` and `ix[1]`, verify the original signature
against the reordered message — returns false.

### The hash visual at the bottom

Two example SHA-256 hashes shown side by side. The point: change one
lamport in the input, and roughly half the hex digits in the output
change. This is the **avalanche effect** — a designed property of
cryptographic hash functions. Any small input change produces a
large, unpredictable output change.

### Likely cross-questions

**Q: What's the avalanche effect?**
A: A property of cryptographic hash functions where flipping a single
input bit causes roughly half the output bits to flip, in an
unpredictable pattern. This makes the hash function behave like a
random oracle — small input changes produce wildly different outputs,
which is exactly what stops an attacker from finding two messages
that hash to the same value.

**Q: What is Curve25519?**
A: A Montgomery elliptic curve over a prime field, designed by
Daniel Bernstein in 2005. It's the curve used in Ed25519 (signatures)
and X25519 (key exchange). Chosen for its speed, side-channel
resistance, and 128-bit security level.

**Q: Why exactly 128-bit security?**
A: The best known attack against Ed25519 is Pollard's rho on the
elliptic curve discrete log problem. Curve25519's group has order
roughly 2^252, but Pollard's rho gives a √n attack, so the practical
security is √(2^252) ≈ 2^126 — rounded to 128-bit. To brute-force
that, you'd need more energy than the sun emits in its lifetime.

**Q: Why does `recentBlockhash` expire?**
A: To prevent replay attacks. Without expiration, any signed
transaction could be re-broadcast forever. With it, an attacker has
~60 seconds to replay before the blockhash falls out of the validator's
recent-blockhash queue and the transaction is permanently invalid.
There's a small UX cost (transactions can expire if not landed quickly)
but the security benefit is huge.

**Q: What does "MITM" mean in a wallet context?**
A: Man-in-the-middle — anything between the wallet and the validator
that sees the signed transaction before it lands. That includes RPC
providers, relayers, MEV bots, and even network-level attackers.
Without signature coverage, any of them could mutate the transaction.
With it, mutation breaks the signature and the validator rejects.

**Q: What if Drift themselves were malicious — they wrote the SDK,
couldn't they tamper with the trade instruction before my wrapper
runs?**
A: Yes — but at that point the threat model has changed. If Drift's
SDK is malicious, the user shouldn't be using Drift at all. My
threat model is: "given an honest Drift SDK and an honest user, can
any other actor (relayer, bot, MITM, RPC provider) extract value or
cheat the platform?" The answer is no.

---

## SLIDE 9 — Performance & primitives

### What this slide is

Top half: four metric cards showing the overhead numbers.
Bottom half: a 3 × 3 grid mapping each blockchain primitive to where
it lives in the project.

### Each metric explained

**+64 bytes.** A `SystemProgram.transfer` instruction encodes to
~64 bytes once you account for the program ID (32 bytes
deduplicated via the message header), the source and destination
account indices (1 byte each via ALT or account list), and the 12-
byte instruction data (4-byte transfer discriminator + 8-byte
lamport amount). I measure this by serialising the V0 message before
and after prepending the fee instruction.

**< 1 ms.** I run 100 iterations of the in-browser sign operation
(not RPC submission, just the local Ed25519 sign) and measure the
delta between "sign trade alone" and "sign trade+fee bundle". The
delta consistently lands under 1 ms. The hashing itself is ~microseconds;
most of the time is the curve scalar multiplication.

**~150 / 200 000 CU.** Compute Units (CU) are Solana's analogue of
gas. Every transaction has a 200,000 CU budget. A bare
`SystemProgram.transfer` costs ~150 CU. So my fee instruction uses
about 0.075 % of the budget. The Drift trade itself uses ~80,000–
150,000 CU; my fee is in the noise.

**~0.07 %.** Total relative overhead — combining the size, latency,
and compute costs as a fraction of the unbundled trade transaction.
Effectively free.

### The primitives grid explained

Each tile maps a blockchain concept to where it actually lives:

* **🔑 Asymmetric Crypto → Ed25519 over Curve25519, used by every
  Phantom signature.** Public-key crypto where the public key verifies
  signatures made with the secret key.
* **\#️⃣ SHA-256 + Merkle → `merkle.ts` + `/verify` §3-4.**
  SHA-256 is the hash function inside both Solana's transaction
  hashing and my Merkle tree.
* **✍️ Digital Signatures → One Ed25519 sig covers every
  instruction.** A signature isn't just authentication, it's an
  integrity binding. Mine binds *all* the instructions together.
* **🪙 Wallets & Addresses → Phantom · base58 public keys.**
  A Solana wallet is just an Ed25519 keypair; the public key (after
  base58-encoding) *is* the address.
* **🧾 Transactions → V0 messages + Address Lookup Tables.**
  Solana's newer transaction format that supports ALTs.
* **⚛️ Atomic Execution → `SystemProgram.transfer` + Drift in a
  single tx.** The whole project hinges on this property.
* **⏱ Replay Protection → `recentBlockhash` window (~150 blocks /
  ~60 s).** Built into every transaction.
* **📡 Decentralized Oracles → Pyth + Switchboard drive USDC → SOL.**
  Two independent oracle networks; Drift uses both for redundancy.
* **🛡 Programs + CPI → `cpi.ts` + `/explorer` renders
  `meta.innerInstructions`.** When one program calls another, that's
  a CPI; the runtime records the full call graph in
  `meta.innerInstructions`.

### Likely cross-questions

**Q: 0.07 % — how was this measured?**
A: All four cards are produced by the `/benchmarks` route, which
runs 100 iterations of each measurement in the user's browser. Size
is measured by `tx.serialize().length` before vs. after. Latency
is `performance.now()` deltas. Compute units come from a
`getRecentPrioritizationFees` simulation. The 0.07 % is the
combined overhead vs. the bare Drift transaction.

**Q: What's in those 64 bytes?**
A: The `SystemProgram.transfer` instruction header (program index,
account indices for source + destination + system program reference)
plus the 12-byte instruction data: a 4-byte little-endian transfer
discriminator and an 8-byte little-endian u64 lamport amount.

**Q: What are compute units, technically?**
A: Solana's metering unit for on-chain execution. Every Solana
opcode and every BPF instruction costs a small number of CUs.
Programs declare a max CU budget per transaction (default 200 000,
configurable up to 1.4M). If a transaction exceeds its budget, it
fails. The 150 CU figure for `SystemProgram.transfer` is the
documented cost in Solana's source.

**Q: Are these real benchmarks or estimates?**
A: Real, measured live. Open `/benchmarks` in a browser and the
numbers update in front of you. The exact numbers may vary slightly
by laptop and network — but the 64-byte and 150-CU numbers are
properties of the protocol itself, not of my benchmark.

**Q: What's CPI again, in one sentence?**
A: Cross-Program Invocation: when one Solana program (like Drift)
calls another (like the SPL Token program) during the execution of
a single instruction. The runtime records the full call tree in
`meta.innerInstructions`.

**Q: Why both Pyth and Switchboard?**
A: Redundancy. Drift uses Pyth as the primary oracle and Switchboard
as a fallback. If one feed is stale or compromised, the other can
still price the market. My `tradingFee.ts` reads whichever Drift's
oracle cache currently holds.

**Q: What are Address Lookup Tables, in one sentence?**
A: On-chain accounts containing lists of pubkeys; transactions can
reference those pubkeys by 1-byte index instead of including the
full 32-byte pubkey, dramatically shrinking complex transactions.

---

## SLIDE 10 — Closing

### What this slide is

Three "takeaway" cards on top (cryptographic guarantee, zero on-chain
footprint, empirically verified) and three "What's Next" cards
(mainnet deployment, cross-chain port, dynamic fee engine), with a QR
code in the corner.

### Each takeaway explained

**🔐 Cryptographic Guarantee.** The fee model is unbypassable not
because of a contract that *enforces* it, but because of three
primitives that *make bypass mathematically impossible*: Ed25519
covers the entire message, SHA-256 has avalanche, and Solana
executes atomically. Combine the three and the user has no way to
keep the trade without paying the fee.

**🚀 Zero On-Chain Footprint.** I deploy nothing new on chain. My
contribution is ~9 k lines of TypeScript that run in the browser and
in a Node.js API layer. Audit cost for the on-chain side is zero
because there is no on-chain side. The same wrapper pattern can be
ported to Jupiter, Raydium, Orca, or any other Solana DEX with only
that DEX's SDK to learn.

**🔬 Empirically Verified.** Six attacks tested live in the browser.
Four overhead metrics measured live. Every claim on every slide
links to a clickable demo in the deployed app. Nothing is asserted
without a corresponding artefact a reviewer can run.

### Each future-work item explained

**🌐 Mainnet Deployment.** Move from devnet to mainnet, with a
production builder authority wallet (probably a multisig), and
introduce signed fee receipts — a small data structure the platform
signs to prove "this fee was collected for this trade", shareable
off-chain.

**⚙️ Cross-chain Port.** The composition idea — bundle a fee
instruction beside the trade in a single signed atomic transaction —
works on any chain whose runtime guarantees signature coverage and
atomic execution. Sui, Aptos, and Sei all qualify. Solana's specific
flavour (V0 messages, ALTs) doesn't carry over, but the pattern does.

**🤖 Dynamic Fee Engine.** Instead of a hardcoded 5 bps, allow the
fee tier to depend on volume (cheaper for whales), creator
relationship (rebates for signal followers), or governance (a DAO
vote can adjust). All still enforced atomically by the same wrapper.

### Likely cross-questions

**Q: "Zero audit cost" — really? You still have ~9 k lines of
TypeScript.**
A: Zero on-chain audit cost. The TypeScript still benefits from a
review, but a TypeScript bug at worst lets the *user* be cheated by
the *platform* (e.g. wrong fee amount). It cannot let the *platform*
be cheated by the *user* — that's mathematically prevented by the
chain. So the threat surface is one-sided and recoverable. An
on-chain bug, by contrast, can be exploited permissionlessly by
anyone.

**Q: Mainnet deployment — what's the risk?**
A: Three risks. (a) Real money flows through the builder authority
wallet — that wallet must be a multisig with hardware-key signers.
(b) RPC reliability becomes critical; I'd switch from public devnet
RPC to Helius or QuickNode. (c) MongoDB downtime stops the dashboard
but not the on-chain fee — I'd add monitoring and an automatic
chain-history rebuild script.

**Q: How would DAO governance actually work for the fee engine?**
A: Two phases. Phase 1: governance votes off-chain (Snapshot, Realms)
on a fee schedule, the platform's `tradingFee.ts` reads the latest
schedule. Phase 2: move the schedule on chain into a tiny PDA
governed by an on-chain DAO program (Realms, Squads). Then the
schedule is verifiable too, not just enforced.

**Q: "Composable to any chain" — really? Aptos uses different
signatures.**
A: The general property — single-signature atomic transactions with
multi-instruction support — exists on Sui, Aptos, Sei, and others.
Aptos uses Ed25519 too. Sui uses a different scheme (could be
Ed25519, ECDSA, or BLS depending on the wallet) but the
single-signature atomic property still holds. The wrapper code would
need to be rewritten in each chain's SDK, but the pattern carries
over.

**Q: How does this project compare to Drift's own Builder Codes?**
A: Drift Builder Codes (announced late 2024) is the on-chain
version of the same idea — Drift's program itself routes a fraction
of taker fees to a registered builder. My approach is the off-chain
composition variant that requires no protocol cooperation. Pros vs.
Builder Codes: works for *any* DEX without their cooperation, no
fee cap from the protocol. Cons: requires the user to use my
front-end specifically (Builder Codes work even if the user trades
through any client that registers the builder code).

**Q: What did you learn from this project that you didn't know
before?**
A: Three things. (a) How deep Solana's atomicity guarantee really
goes — it's a runtime property, not a contract property, and that
distinction matters for system design. (b) How much of "writing a
smart contract" is actually about working around the limits of
client-side composition; sometimes you don't need to. (c) How
expensive it is to *prove* a security property compared to merely
*claiming* one — building the six attack tests was harder than
building the wrapper itself, but they're what makes the project
credible.
