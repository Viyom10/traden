"use client";

/**
 * /blockchain — Concept → codebase map
 *
 * An expandable, browseable reference that ties every blockchain and
 * cryptography concept used by this project to a concrete file/function
 * in the codebase. The goal is to make the project legible by surfacing
 * how each topic is realized in code or in the user-facing flow.
 *
 * No data is fetched and nothing is signed; this page is pure documentation.
 */

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronRight,
  Lock,
  Hash,
  Key,
  Shield,
  Globe,
  FileCode,
  Zap,
  Search,
  CheckCircle2,
  ExternalLink,
  BookOpen,
  Network,
} from "lucide-react";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Status = "implemented" | "partial" | "theoretical";

interface ImplRef {
  file: string;
  description: string;
  snippet?: string;
}

interface ComparisonRow {
  feature: string;
  bitcoin: string;
  ethereum: string;
  solana: string;
}

interface Concept {
  id: string;
  title: string;
  status: Status;
  syllabus: string;
  theory: string;
  implementations: ImplRef[];
  liveDemo?: { label: string; href: string };
  comparison?: ComparisonRow[];
}

interface Group {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  concepts: Concept[];
}

// -----------------------------------------------------------------------------
// Concept data
// -----------------------------------------------------------------------------

const groups: Group[] = [
  {
    id: "crypto",
    title: "Cryptographic Foundations",
    icon: <Key className="h-5 w-5" />,
    description: "Symmetric/asymmetric crypto, hash, MAC, ECC, signatures",
    concepts: [
      {
        id: "ed25519",
        title: "Ed25519 Digital Signatures (RFC 8032)",
        status: "implemented",
        syllabus: "Public-key authentication",
        theory:
          "Ed25519 is an EdDSA signature scheme over the twisted Edwards curve Curve25519. It produces deterministic 64-byte signatures with 128-bit security, is resistant to many side-channel attacks, and is the only signature scheme natively used by Solana.",
        implementations: [
          {
            file: "src/lib/DriftClientWrapper.ts",
            description:
              "Every transaction I send (including the bundled fee + trade) is Ed25519-signed by the trader's wallet. Phantom calls into TweetNaCl/libsodium under the hood.",
          },
          {
            file: "src/app/verify/page.tsx",
            description:
              "Live demo: generates a fresh keypair in-browser via Keypair.generate(), signs a real Solana transaction message, and verifies with tweetnacl.",
          },
        ],
        liveDemo: { label: "Open Verify demo →", href: "/verify" },
        comparison: [
          {
            feature: "Signature scheme",
            bitcoin: "ECDSA over secp256k1",
            ethereum: "ECDSA over secp256k1 (with EIP-2 malleability fix)",
            solana: "Ed25519 over Curve25519",
          },
          {
            feature: "Signature size",
            bitcoin: "71–72 bytes (DER)",
            ethereum: "65 bytes (r || s || v)",
            solana: "64 bytes",
          },
          {
            feature: "Determinism",
            bitcoin: "RFC 6979 (deterministic-k)",
            ethereum: "RFC 6979",
            solana: "Native — no nonce reuse class of bug",
          },
        ],
      },
      {
        id: "sha256",
        title: "SHA-256 Hashing (FIPS 180-4)",
        status: "implemented",
        syllabus: "Cryptographic hash functions",
        theory:
          "SHA-256 is a Merkle–Damgård 256-bit hash with collision resistance ≈ 2^128, pre-image resistance ≈ 2^256, and the avalanche property: any 1-bit input change flips ≈ 50% of output bits.",
        implementations: [
          {
            file: "Solana validator (consensus layer)",
            description:
              "Every TransactionMessage is SHA-256 hashed before Ed25519 signing. The signature commits to the digest, which commits to every byte of every instruction.",
          },
          {
            file: "src/app/verify/page.tsx",
            description:
              "Section 3 of the Verify page demonstrates the avalanche effect interactively using the browser's Web Crypto API (crypto.subtle.digest).",
          },
        ],
        liveDemo: { label: "Avalanche demo →", href: "/verify" },
      },
      {
        id: "merkle",
        title: "Merkle Trees (block & PoH proofs)",
        status: "implemented",
        syllabus: "Hash chains & Merkle trees",
        theory:
          "A Merkle tree compresses many leaf hashes into a single 32-byte root. A logarithmic-size inclusion proof (⌈log₂ N⌉ sibling hashes) lets any verifier check that a specific item is in the set without seeing the rest. Solana validators use this exact construction to commit to per-slot account state changes (the bank hash); Bitcoin SPV uses it for block verification without the full chain.",
        implementations: [
          {
            file: "src/lib/merkle.ts",
            description:
              "Pure-browser SHA-256 Merkle tree library: buildMerkleTree, getProof, verifyProof. Uses domain-separated leaf/node hashing (LEAF_PREFIX = 0x00, NODE_PREFIX = 0x01) to defeat the second-preimage attack where an internal-node hash could be passed off as a leaf.",
          },
          {
            file: "src/app/verify/page.tsx",
            description:
              "MerkleProofDemo component (Section 4 of /verify): edit a list of leaves, pick one, see its O(log N) inclusion proof, and try to forge it by tampering — the proof immediately stops verifying against the published root.",
          },
          {
            file: "Solana runtime (external)",
            description:
              "Each Solana slot's bank hash is a Merkle root over account state changes; vote accounts attest to it. My library implements the same primitive at the application layer.",
          },
        ],
        liveDemo: { label: "Merkle proof demo →", href: "/verify" },
      },
      {
        id: "keys",
        title: "Wallet & Key Derivation",
        status: "implemented",
        syllabus: "Bitcoin wallets & key derivation",
        theory:
          "A wallet is a key manager. Solana uses 32-byte Ed25519 secret keys and derives addresses by base58-encoding the public key directly (no hashing step).",
        implementations: [
          {
            file: "src/providers/WalletProvider.tsx",
            description:
              "Wires up @solana/wallet-adapter-react with Phantom, Solflare, etc. Phantom internally uses BIP-44 path m/44'/501'/0'/0' for Solana.",
          },
          {
            file: "src/components/wallet/WalletButton.tsx",
            description: "User-facing connect / disconnect flow.",
          },
        ],
        comparison: [
          {
            feature: "Address derivation",
            bitcoin: "RIPEMD160(SHA256(pubkey)) → base58check",
            ethereum: "last 20 bytes of Keccak256(pubkey) → hex",
            solana: "base58(pubkey) directly",
          },
          {
            feature: "Address length",
            bitcoin: "26–35 chars",
            ethereum: "42 chars (0x + 40 hex)",
            solana: "32–44 chars (base58 of 32 bytes)",
          },
        ],
      },
    ],
  },
  {
    id: "tx",
    title: "Transaction Architecture",
    icon: <FileCode className="h-5 w-5" />,
    description: "Inputs/outputs, fees, atomicity, smart-contract execution",
    concepts: [
      {
        id: "atomic",
        title: "Atomic Fee Bundling (project core contribution)",
        status: "implemented",
        syllabus: "Transactions · Verification",
        theory:
          "Solana transactions execute atomically: all instructions land or none do. By prepending a SystemProgram.transfer fee instruction into the same transaction as the Drift trade, I make fee evasion cryptographically infeasible.",
        implementations: [
          {
            file: "src/lib/DriftClientWrapper.ts",
            description:
              "Intercepts driftClient.sendTransaction(), decompiles the v0 message, prepends the fee instruction, recompiles, and sends. The user signs the entire bundle once.",
            snippet: `const allInstructions = [feeInstruction, ...decompiled.instructions];
const modifiedMessage = new TransactionMessage({
  payerKey: decompiled.payerKey,
  instructions: allInstructions,
  recentBlockhash: decompiled.recentBlockhash,
}).compileToV0Message(addressLookupTableAccounts || []);
const modifiedTx = new VersionedTransaction(modifiedMessage);`,
          },
          {
            file: "src/lib/tradingFee.ts",
            description:
              "Pure helpers that compute the 5 bps fee and build the SystemProgram.transfer instruction. Quote-asset orders are converted to SOL using a live oracle price.",
          },
        ],
        liveDemo: { label: "Atomicity proof →", href: "/verify" },
      },
      {
        id: "v0",
        title: "Versioned Transactions (V0) & Address Lookup Tables",
        status: "implemented",
        syllabus: "Scalable transaction encodings",
        theory:
          "V0 transactions reference accounts via Address Lookup Tables (ALTs), compressing per-account overhead from 32 bytes (full pubkey) to 1 byte (table index). This is essential for Drift's complex DeFi operations that touch many accounts.",
        implementations: [
          {
            file: "src/lib/DriftClientWrapper.ts",
            description:
              "Resolves all addressTableLookups via connection.getAddressLookupTable() before decompiling, and re-passes them to compileToV0Message().",
          },
        ],
      },
      {
        id: "fees",
        title: "Transaction Fees & Compute Budget",
        status: "implemented",
        syllabus: "Transaction fees & priority",
        theory:
          "Solana charges a static signature fee (5,000 lamports / sig) plus compute-unit-priced priority. Compute units (CUs) are a deterministic budget for instruction execution, capped at 1.4M per tx.",
        implementations: [
          {
            file: "src/app/benchmarks/page.tsx",
            description:
              "Quantifies the CU and byte overhead added by my atomic fee instruction relative to the 200k typical CU and ~1232-byte tx limit.",
          },
        ],
        liveDemo: { label: "Open Benchmarks →", href: "/benchmarks" },
      },
    ],
  },
  {
    id: "wallet",
    title: "Wallet & Key Management",
    icon: <Key className="h-5 w-5" />,
    description: "Custody, addresses, signing",
    concepts: [
      {
        id: "non-custodial",
        title: "Non-custodial signing",
        status: "implemented",
        syllabus: "Wallets & custody",
        theory:
          "The user's secret key never leaves their wallet (hardware or browser extension). The dApp constructs unsigned transactions; the wallet signs and returns them.",
        implementations: [
          {
            file: "src/providers/WalletProvider.tsx",
            description:
              "Configures Phantom, Solflare, and other adapters. Sign requests are dispatched through the adapter's RPC.",
          },
          {
            file: "src/components/wallet/WalletButton.tsx",
            description: "UI affordance for connect / disconnect.",
          },
        ],
      },
      {
        id: "subaccounts",
        title: "Drift sub-accounts (logical wallets)",
        status: "implemented",
        syllabus: "Bonus · Account model design",
        theory:
          "Drift partitions a single Solana wallet into multiple isolated trading sub-accounts. Each has its own collateral, positions, and PnL.",
        implementations: [
          {
            file: "src/components/user/UserAccountSelector.tsx",
            description: "Switch between sub-accounts in the header.",
          },
          {
            file: "src/hooks/user/useUserManagement.ts",
            description: "Create / delete sub-account flows.",
          },
        ],
      },
    ],
  },
  {
    id: "oracle",
    title: "Oracle Networks & Decentralized Data",
    icon: <Globe className="h-5 w-5" />,
    description: "Bonus · External-data design (Pyth, Switchboard)",
    concepts: [
      {
        id: "pyth",
        title: "Pyth & Switchboard price feeds",
        status: "implemented",
        syllabus: "Bonus · Oracle design",
        theory:
          "On-chain DeFi cannot trust a single price source. Pyth aggregates signed quotes from ~80 institutional publishers; Switchboard runs a decentralized oracle network. Drift consumes both for mark/oracle prices.",
        implementations: [
          {
            file: "src/stores/OraclePriceStore.ts",
            description:
              "Live Zustand store of oracle prices, updated via AuthorityDrift.onOraclePricesUpdate.",
          },
          {
            file: "src/hooks/globalSyncs/useSetupDrift.ts",
            description:
              "Subscribes to oracle and mark price streams when Drift initializes.",
          },
          {
            file: "src/lib/DriftClientWrapper.ts",
            description:
              "Uses the SOL oracle price to convert quote-asset (USDC) fees into lamports for the SystemProgram.transfer.",
          },
        ],
      },
    ],
  },
  {
    id: "smartcontract",
    title: "Smart Contracts on Solana",
    icon: <FileCode className="h-5 w-5" />,
    description: "Programs, deterministic execution, access control",
    concepts: [
      {
        id: "programs",
        title: "Solana Programs (eBPF) vs EVM contracts",
        status: "implemented",
        syllabus: "Smart contract platforms",
        theory:
          "Solana programs are stateless eBPF binaries. State lives in separate Account structs, passed in by the transaction. EVM contracts hold their own storage. Solana's separation enables cheap parallel execution (Sealevel).",
        implementations: [
          {
            file: "@drift-labs/sdk",
            description:
              "Builds Drift program instructions for openPerpOrder, deposit, withdraw, etc. My wrapper composes these with my fee transfer.",
          },
        ],
        comparison: [
          {
            feature: "Bytecode",
            bitcoin: "Script (non-Turing-complete)",
            ethereum: "EVM bytecode (Turing-complete)",
            solana: "BPF / eBPF (Turing-complete + parallelizable)",
          },
          {
            feature: "State location",
            bitcoin: "UTXO set",
            ethereum: "Per-contract storage trie",
            solana: "Separate Account objects, passed in",
          },
          {
            feature: "Parallelism",
            bitcoin: "n/a",
            ethereum: "Sequential per block",
            solana: "Parallel via Sealevel (declared accounts)",
          },
        ],
      },
      {
        id: "cpi",
        title: "Cross-Program Invocation (CPI)",
        status: "implemented",
        syllabus: "Smart contract composability",
        theory:
          "A Solana program can invoke another program in the same transaction (a Cross-Program Invocation). Solana surfaces these nested calls in transaction metadata as `meta.innerInstructions`, indexed by the parent instruction. My atomic-fee bundle exercises this end-to-end: at the top level I sit a SystemProgram.transfer (the platform fee) next to a Drift order instruction, and Drift in turn CPIs into SystemProgram (SOL movement), SPL Token (collateral / quote-token transfers) and the oracle programs (Pyth / Switchboard) — all inside the same atomic envelope, signed once.",
        implementations: [
          {
            file: "src/lib/DriftClientWrapper.ts",
            description:
              "Composes the parent instruction list (fee + Drift trade) that triggers the CPI graph below — a single Ed25519 signature covers the whole tree.",
          },
          {
            file: "src/lib/cpi.ts",
            description:
              "Pure-TS CPI tree extractor: turns a ParsedTransactionWithMeta into a renderable tree of {parent → inner CPI} nodes, with friendly labels for System / SPL Token / Drift / Pyth / Switchboard / Compute Budget / ALT programs and counts of CPI hops + unique programs touched.",
          },
          {
            file: "src/app/explorer/page.tsx",
            description:
              "CpiNodeRow component renders the actual on-chain CPI tree for any signature you paste: the fee transfer sits at depth 0, the Drift order sits at depth 0, and each Drift inner CPI (SystemProgram.transfer, SPL Token transfer, oracle reads) appears indented under it with a CPI badge.",
          },
        ],
        liveDemo: { label: "Inspect CPI tree →", href: "/explorer" },
      },
    ],
  },
  {
    id: "consensus",
    title: "Consensus & Network",
    icon: <Network className="h-5 w-5" />,
    description: "PoH, leader rotation, finality",
    concepts: [
      {
        id: "poh",
        title: "Proof of History",
        status: "implemented",
        syllabus: "Solana consensus",
        theory:
          "PoH is a verifiable delay function (sequential SHA-256 hashes) that creates a cryptographic clock, letting validators agree on time without round-trip messaging. Tower BFT votes on this clock for finality.",
        implementations: [
          {
            file: "Solana consensus layer",
            description:
              "Every recentBlockhash I attach to a transaction is a position on the PoH chain. Used as freshness proof and replay protection.",
          },
        ],
      },
      {
        id: "envs",
        title: "Devnet vs Mainnet-beta",
        status: "implemented",
        syllabus: "Networks & deployment",
        theory:
          "Devnet is a free, faucet-funded test network with the same tooling but throwaway state. Mainnet-beta is real value. My app supports switching between them at runtime.",
        implementations: [
          {
            file: "src/stores/DriftStore.ts",
            description:
              "environment is a persisted Zustand value; setEnvironment swaps RPC endpoints and reinitializes Drift.",
          },
          {
            file: "src/components/layout/Header.tsx",
            description:
              "Network switcher dropdown (visible only when NEXT_PUBLIC_ENVIRONMENT === 'development').",
          },
        ],
      },
    ],
  },
  {
    id: "security",
    title: "Security Properties",
    icon: <Shield className="h-5 w-5" />,
    description: "Replay, MITM, malleability, integrity",
    concepts: [
      {
        id: "replay",
        title: "Replay protection (recentBlockhash)",
        status: "implemented",
        syllabus: "Replay attacks",
        theory:
          "A recentBlockhash inside the signed message expires after ~150 blocks (~60s). Validators reject any transaction whose blockhash is no longer recent.",
        implementations: [
          {
            file: "Solana runtime",
            description:
              "Built-in. My wrapper preserves the original blockhash when recompiling the message after fee injection.",
          },
        ],
        liveDemo: { label: "See attack test →", href: "/security" },
      },
      {
        id: "tamper",
        title: "Tamper resistance (single-signature envelope)",
        status: "implemented",
        syllabus: "Tx integrity & malleability",
        theory:
          "Because the Ed25519 signature commits to the SHA-256 of the entire serialized message, no in-flight party (relayer, MEV searcher, RPC operator) can change anything without invalidating the signature.",
        implementations: [
          {
            file: "src/app/security/page.tsx",
            description:
              "Six concrete attack simulations (strip, mutate, reroute, reorder, replay, forge) with pass/fail per attack.",
          },
        ],
        liveDemo: { label: "Open Security tests →", href: "/security" },
      },
      {
        id: "audit",
        title: "On-chain audit trail",
        status: "implemented",
        syllabus: "Transaction transparency",
        theory:
          "Every fee+trade transaction is permanently recorded on Solana. Anyone can verify the fee was paid by inspecting the transaction's instructions on Solscan.",
        implementations: [
          {
            file: "src/schemas/FeeSchema.ts",
            description:
              "MongoDB record links each off-chain row to its on-chain txSignature for cross-verification.",
          },
          {
            file: "src/app/explorer/page.tsx",
            description:
              "Paste any tx signature; the page fetches the on-chain transaction and confirms the fee instruction is present alongside the trade instruction.",
          },
        ],
        liveDemo: { label: "Open Explorer →", href: "/explorer" },
      },
    ],
  },
  {
    id: "limits",
    title: "Limitations & Trade-offs",
    icon: <Zap className="h-5 w-5" />,
    description: "Scalability, privacy, cost, energy",
    concepts: [
      {
        id: "scalability",
        title: "Throughput & latency",
        status: "implemented",
        syllabus: "Scalability",
        theory:
          "Solana targets 50k+ TPS via Sealevel parallelism, PoH, Gulfstream tx-forwarding, and Turbine block propagation. Real-world TPS is lower due to vote traffic.",
        implementations: [
          {
            file: "src/app/benchmarks/page.tsx",
            description:
              "Measures the additional bytes / CUs / signing latency my atomic-fee design adds.",
          },
        ],
      },
      {
        id: "privacy",
        title: "Privacy: pseudonymous, not anonymous",
        status: "theoretical",
        syllabus: "Privacy",
        theory:
          "Wallet addresses are pseudonymous but every transaction is public. Cluster-analysis tools can deanonymize repeat users.",
        implementations: [
          {
            file: "design discussion",
            description:
              "I've documented this in the project report (docs/Group2_Report.pdf).",
          },
        ],
      },
    ],
  },
];

const STATUS_BADGE: Record<Status, { label: string; cls: string }> = {
  implemented: {
    label: "Implemented",
    cls: "bg-green-500/10 text-green-300 ring-1 ring-green-500/30",
  },
  partial: {
    label: "Partial",
    cls: "bg-yellow-500/10 text-yellow-300 ring-1 ring-yellow-500/30",
  },
  theoretical: {
    label: "Theoretical",
    cls: "bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/30",
  },
};

// -----------------------------------------------------------------------------
// UI
// -----------------------------------------------------------------------------

function ConceptCard({ concept }: { concept: Concept }) {
  const [open, setOpen] = useState(false);
  const status = STATUS_BADGE[concept.status];
  return (
    <div className="rounded-md border border-gray-800 bg-gray-950/40">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-900/40"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-white">
              {concept.title}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${status.cls}`}
            >
              {status.label}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-gray-500">
            {concept.syllabus}
          </div>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />
        )}
      </button>

      {open && (
        <div className="space-y-4 border-t border-gray-800 px-4 py-4">
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <BookOpen className="h-3.5 w-3.5" /> Theory
            </div>
            <p className="text-sm text-gray-300">{concept.theory}</p>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <FileCode className="h-3.5 w-3.5" /> Implementation
            </div>
            <div className="grid gap-2">
              {concept.implementations.map((impl, i) => (
                <div
                  key={i}
                  className="rounded-md border border-gray-800 bg-black/30 p-3"
                >
                  <div className="mb-1 font-mono text-xs text-blue-300">
                    {impl.file}
                  </div>
                  <div className="text-sm text-gray-300">
                    {impl.description}
                  </div>
                  {impl.snippet && (
                    <pre className="mt-2 overflow-x-auto rounded border border-gray-800 bg-black/60 p-2 font-mono text-[11px] text-gray-300">
                      {impl.snippet}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>

          {concept.comparison && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <Network className="h-3.5 w-3.5" /> Bitcoin / Ethereum / Solana
              </div>
              <div className="overflow-x-auto rounded-md border border-gray-800">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-900/60 text-left text-[11px] uppercase tracking-wider text-gray-500">
                      <th className="px-3 py-2">Feature</th>
                      <th className="px-3 py-2">Bitcoin</th>
                      <th className="px-3 py-2">Ethereum</th>
                      <th className="px-3 py-2">Solana (this project)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {concept.comparison.map((row) => (
                      <tr
                        key={row.feature}
                        className="border-t border-gray-800 text-gray-300"
                      >
                        <td className="px-3 py-2 font-medium text-white">
                          {row.feature}
                        </td>
                        <td className="px-3 py-2">{row.bitcoin}</td>
                        <td className="px-3 py-2">{row.ethereum}</td>
                        <td className="px-3 py-2">{row.solana}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {concept.liveDemo && (
            <div>
              <Link href={concept.liveDemo.href}>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-blue-700 bg-blue-600/10 text-blue-300 hover:bg-blue-600/20"
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  {concept.liveDemo.label}
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GroupSection({ group, query }: { group: Group; query: string }) {
  const [open, setOpen] = useState(true);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return group.concepts;
    return group.concepts.filter((c) =>
      [c.title, c.theory, c.syllabus, ...c.implementations.map((i) => i.file)]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [group.concepts, query]);

  if (query && filtered.length === 0) return null;

  return (
    <Card>
      <CardHeader
        className="cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-purple-500/10 p-2 text-purple-300">
              {group.icon}
            </div>
            <div>
              <CardTitle className="text-white">{group.title}</CardTitle>
              <CardDescription className="text-gray-400">
                {group.description}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-gray-800 px-2.5 py-0.5 text-xs text-gray-400">
              {filtered.length}
            </span>
            {open ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            )}
          </div>
        </div>
      </CardHeader>
      {open && (
        <CardContent>
          <div className="grid gap-2">
            {filtered.map((c) => (
              <ConceptCard key={c.id} concept={c} />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export default function BlockchainPage() {
  const [query, setQuery] = useState("");

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-3">
            <Hash className="h-8 w-8 text-purple-400" />
            <h1 className="text-3xl font-bold text-white">
              Blockchain Concepts in this Project
            </h1>
          </div>
          <p className="max-w-3xl text-gray-400">
            A concept map showing where each blockchain and cryptography
            topic used by this project is realized in my codebase. Click
            any concept to expand its theory, code references, and live
            demo links.
          </p>
        </div>

        {/* Flow diagram + thesis */}
        <Card className="mb-6 bg-gradient-to-br from-blue-600/10 via-purple-600/5 to-transparent">
          <CardContent className="py-6">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <Lock className="h-4 w-4 text-blue-400" />
              The cryptographic chain that makes the fee atomic
            </div>
            <div className="grid gap-2 text-sm md:grid-cols-5 md:gap-0">
              {[
                "Instructions\n[fee, trade]",
                "TransactionMessage\n(serialized)",
                "SHA-256\n(message)",
                "Ed25519.sign\n(hash, secretKey)",
                "Signature\n(64 bytes)",
              ].map((node, i, arr) => (
                <div
                  key={node}
                  className="flex flex-1 items-center"
                >
                  <div className="flex-1 rounded-md border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-center text-xs font-mono text-blue-200 whitespace-pre-line">
                    {node}
                  </div>
                  {i < arr.length - 1 && (
                    <div className="hidden px-2 text-blue-400 md:block">→</div>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-400">
              Modify ANY byte of any instruction and the SHA-256 changes ⇒ the
              signature no longer verifies ⇒ the validator rejects the tx.
              That&apos;s why the fee cannot be removed, reduced, or rerouted.
            </p>
          </CardContent>
        </Card>

        {/* Approach comparison */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-white">
              My approach vs other DEXs
            </CardTitle>
            <CardDescription className="text-gray-400">
              Where on the cryptographic stack each platform enforces its fee.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border border-gray-800">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-900/60 text-left text-[11px] uppercase tracking-wider text-gray-500">
                    <th className="px-3 py-2">DEX</th>
                    <th className="px-3 py-2">Fee enforcement layer</th>
                    <th className="px-3 py-2">Atomic with trade?</th>
                    <th className="px-3 py-2">Removable by relayer?</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-t border-gray-800">
                    <td className="px-3 py-2 font-medium text-white">
                      Jupiter
                    </td>
                    <td className="px-3 py-2">Inside swap CPI</td>
                    <td className="px-3 py-2 text-green-300">yes</td>
                    <td className="px-3 py-2 text-green-300">no</td>
                  </tr>
                  <tr className="border-t border-gray-800">
                    <td className="px-3 py-2 font-medium text-white">
                      Drift native
                    </td>
                    <td className="px-3 py-2">Inside Drift program</td>
                    <td className="px-3 py-2 text-green-300">yes</td>
                    <td className="px-3 py-2 text-green-300">no</td>
                  </tr>
                  <tr className="border-t border-gray-800">
                    <td className="px-3 py-2 font-medium text-white">
                      Many wrapper UIs
                    </td>
                    <td className="px-3 py-2">Separate transaction (off-chain bookkeeping)</td>
                    <td className="px-3 py-2 text-red-300">no</td>
                    <td className="px-3 py-2 text-red-300">yes</td>
                  </tr>
                  <tr className="border-t border-gray-800 bg-blue-500/5">
                    <td className="px-3 py-2 font-bold text-white">
                      This project
                    </td>
                    <td className="px-3 py-2">
                      SystemProgram.transfer prepended into the same v0 tx as the Drift CPI
                    </td>
                    <td className="px-3 py-2 text-green-300">yes</td>
                    <td className="px-3 py-2 text-green-300">no</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
              I achieve native-level atomicity without modifying the Drift
              on-chain program.
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="mb-4 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter concepts… (e.g. ed25519, oracle, replay)"
              className="w-full rounded-md border border-gray-700 bg-black/40 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid gap-4">
          {groups.map((g) => (
            <GroupSection key={g.id} group={g} query={query} />
          ))}
        </div>
      </div>
    </div>
  );
}
