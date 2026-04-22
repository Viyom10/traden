# RUN_COMMANDS.md

Every command you need to run the TRADEN-PROD app on this Mac, in
copy-paste form.

---

## ⚡ TL;DR — three commands to start the app

If everything is already set up (it is, on this machine), just run:

```bash
export PATH="$HOME/.bun/bin:$PATH"
cd /Users/vikhyat/Desktop/traden/ui
bun dev
```

Then open **http://localhost:3000** in your browser.

To stop: hit `Ctrl + C` in the same terminal.

---

## 🔧 One-time PATH fix (so plain `bun` works in any terminal)

Bun is installed at `~/.bun/bin/bun` but isn't on your shell's PATH by
default. Run this **once** and you'll never have to think about it
again:

```bash
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

After this, you can simply run:

```bash
cd /Users/vikhyat/Desktop/traden/ui
bun dev
```

---

## 📋 Full first-time setup (only needed on a fresh Mac)

You don't need any of this on the current machine — it's already done.
Listed for completeness in case you set up on a new laptop.

### 1. Install Bun (the package manager + runtime)

```bash
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"
```

Verify:

```bash
bun --version
```

### 2. Clone the repo

```bash
cd ~/Desktop
git clone https://github.com/Viyom10/traden.git
cd traden
```

### 3. Install dependencies

```bash
cd ui
bun install
```

This pulls every package from `ui/package.json` (Drift SDK, Next.js,
Solana web3.js, etc.). Takes about 1–2 minutes the first time.

### 4. Create the local environment file

```bash
cat > .env.local <<'EOF'
# Solana RPC endpoints
NEXT_PUBLIC_SOLANA_DEVNET_RPC_ENDPOINT=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_MAINNET_RPC_ENDPOINT=https://api.mainnet-beta.solana.com

# Wallet that receives the 5-bps platform fee
NEXT_PUBLIC_BUILDER_AUTHORITY=11111111111111111111111111111111

# Optional — leave blank to skip the off-chain audit trail
MONGODB_URI=

# Optional — Whop integration
NEXT_PUBLIC_WHOP_APP_ID=
WHOP_API_KEY=
EOF
```

### 5. Start the dev server

```bash
bun dev
```

---

## ▶️ Day-to-day commands

```bash
# start the app
cd /Users/vikhyat/Desktop/traden/ui && bun dev

# stop the app
Ctrl + C   # in the same terminal where it's running

# build for production
bun run build

# run the production build
bun run start

# linter
bun run lint
```

---

## 🌐 URLs the dev server prints

When `bun dev` starts, it prints two URLs:

| URL                       | What it is                                   | Use this when                    |
|---------------------------|----------------------------------------------|----------------------------------|
| `http://localhost:3000`   | The Whop proxy URL                           | Default. Use this for the demo.  |
| `http://localhost:57979`  | The direct Next.js URL (Whop proxy bypassed) | If `:3000` ever misbehaves       |

(The bypass port number can change between runs — read it from the
terminal output.)

---

## 🗺️ Routes to visit (5-minute tour)

| Route                | What it does                                              | Wallet needed?       |
|----------------------|-----------------------------------------------------------|----------------------|
| `/`                  | Homepage                                                  | No                   |
| `/blockchain`        | Concept-to-source map of every primitive used             | No                   |
| `/verify`            | Four in-browser cryptographic demos                       | No                   |
| `/security`          | Six attack tests — click "Run all attack tests"           | No                   |
| `/benchmarks`        | Live overhead measurements (size, latency, CU, total)     | No                   |
| `/explorer`          | Paste any Solana signature → render the CPI tree          | No                   |
| `/perps`             | Real perpetual trading on Drift devnet                    | **Yes (devnet)**     |
| `/spot`              | Spot deposit / withdraw / swap                            | **Yes (devnet)**     |
| `/receipt/<sig>`     | Per-trade receipt page                                    | No                   |
| `/admin`             | Admin dashboard (fees, claims) — needs MongoDB to populate| Wallet-gated         |
| `/creator`           | Creator dashboard (earnings, claims)                      | Wallet-gated         |
| `/signals`           | Trading signal marketplace                                | No (yes to copy)     |
| `/user`              | Drift sub-account create / delete / balance               | **Yes (devnet)**     |

If you're demoing without a wallet, `/verify` and `/security` alone
prove the whole cryptographic thesis.

---

## 🦊 Wallet setup (only needed for `/perps`, `/spot`, `/user`)

1. Install **Phantom** wallet:  https://phantom.app/download
2. Open Phantom → Settings → Developer Settings → enable **Testnet Mode**.
3. Switch network to **Solana Devnet**.
4. Get free devnet SOL:
   ```bash
   solana airdrop 2 <your-phantom-address> --url devnet
   ```
   Or use the in-Phantom faucet button.
5. Connect on `/perps` using the "Connect Wallet" button.

---

## 🧪 Quick smoke tests

After `bun dev` is up, verify in another terminal:

```bash
# every page should return 200
for r in / /blockchain /verify /security /benchmarks /explorer /perps /spot /signals /user /admin /creator; do
  printf "%-15s → " "$r"
  curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000$r"
done
```

Expected output: all `200`.

---

## ❌ Troubleshooting

### `bun: command not found` (exit code 127)

Bun isn't on PATH. Run:

```bash
export PATH="$HOME/.bun/bin:$PATH"
```

Permanent fix: see the "One-time PATH fix" section above.

### "Found multiple lockfiles" warning

Benign. Both `yarn.lock` (repo root) and `bun.lock` (`ui/`) exist; Next
picks the root one. To clean it up:

```bash
rm /Users/vikhyat/Desktop/traden/yarn.lock
```

### `Port 3000 is in use`

Another process owns the port. Find and kill it:

```bash
lsof -ti :3000 | xargs kill
```

Then re-run `bun dev`.

### Admin / creator dashboard shows empty tables

`MONGODB_URI` is unset in `.env.local`. That's intentional — the off-
chain audit trail is optional. The on-chain `SystemProgram.transfer`
is still the canonical fee record. To enable the dashboard:

1. Get a free MongoDB Atlas connection string from
   https://www.mongodb.com/cloud/atlas
2. Paste it into `ui/.env.local`:
   ```
   MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/traden
   ```
3. Restart `bun dev`.

### `EADDRINUSE` from the Whop proxy on the bypass port (57979)

Same as port 3000 — find the offending process and kill it:

```bash
lsof -ti :57979 | xargs kill
```

### A page fails to load with a runtime error

Stop the server with `Ctrl + C`, clear the Next.js cache, and restart:

```bash
rm -rf .next
bun dev
```

### Dev server hot-reload stops working

Same fix as above — kill the cache and restart.

---

## 🔁 Stop / restart cheatsheet

```bash
# stop  (in the running terminal)
Ctrl + C

# stop  (from a different terminal — find PID and kill)
lsof -ti :3000 | xargs kill

# restart cleanly
cd /Users/vikhyat/Desktop/traden/ui
rm -rf .next   # only if something feels stuck
bun dev
```

---

## 🔄 Pulling fresh code from GitHub

```bash
cd /Users/vikhyat/Desktop/traden
git pull origin main
cd ui
bun install   # only needed if package.json changed
bun dev
```

---

## 📦 Pushing changes back to GitHub

```bash
cd /Users/vikhyat/Desktop/traden
git status                        # see what changed
git add .
git commit -m "your message here"
git push origin main
```

If push asks for a username/password:
* **Username:** your GitHub username (`Viyom10` or `Vikhyat-Shastri`)
* **Password:** a Personal Access Token from
  https://github.com/settings/tokens (NOT your GitHub password)

macOS will offer to save the PAT to Keychain — accept that and you
won't be prompted again.
