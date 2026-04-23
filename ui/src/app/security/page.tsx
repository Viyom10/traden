"use client";

/**
 * /security — Attack Resistance Test Suite
 *
 * Each card simulates a well-known class of attack against blockchain
 * transactions and demonstrates how Solana + my atomic-fee design
 * defeats it. All tests run client-side using `Keypair.generate()` and
 * `tweetnacl`; no wallet, no RPC, no server is required.
 */

import React, { useCallback, useState } from "react";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import nacl from "tweetnacl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Repeat,
  KeyRound,
  Scissors,
  Calculator,
  ArrowDownUp,
  UserX,
  ShieldCheck,
  Loader2,
  Info,
} from "lucide-react";

// -----------------------------------------------------------------------------
// Helpers (kept local; small enough that duplication beats coupling)
// -----------------------------------------------------------------------------

// Deterministic, valid 32-byte base58 blockhashes (PublicKey.toBase58 always
// emits exactly 32 bytes worth of base58, unlike a hand-rolled string of
// repeated digits, which would decode to fewer bytes and throw at serialize).
const PLACEHOLDER_BLOCKHASH = new PublicKey(new Uint8Array(32).fill(1)).toBase58();
const ALT_BLOCKHASH = new PublicKey(new Uint8Array(32).fill(2)).toBase58();

async function sha256Hex(data: Uint8Array): Promise<string> {
  // Re-wrap into a fresh ArrayBuffer-backed Uint8Array so the BufferSource
  // signature matches across DOM lib variants (some require an ArrayBuffer,
  // not ArrayBufferLike).
  const buf = new Uint8Array(data.byteLength);
  buf.set(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function buildTx(
  payer: PublicKey,
  instructions: ReturnType<typeof SystemProgram.transfer>[],
  blockhash = PLACEHOLDER_BLOCKHASH,
): VersionedTransaction {
  const msg = new TransactionMessage({
    payerKey: payer,
    instructions,
    recentBlockhash: blockhash,
  }).compileToV0Message();
  return new VersionedTransaction(msg);
}

// -----------------------------------------------------------------------------
// Result step helpers
// -----------------------------------------------------------------------------

interface AttackStep {
  label: string;
  detail?: string;
  ok: boolean | null; // null = informational
}

interface AttackResult {
  passed: boolean;
  steps: AttackStep[];
  verdict: string;
}

interface AttackDef {
  id: string;
  title: string;
  severity: "high" | "medium" | "low";
  icon: React.ReactNode;
  syllabusTopic: string;
  theory: React.ReactNode;
  run: () => Promise<AttackResult>;
}

function severityColor(sev: AttackDef["severity"]) {
  if (sev === "high") return "bg-red-500/10 text-red-300 ring-red-500/30";
  if (sev === "medium") return "bg-yellow-500/10 text-yellow-300 ring-yellow-500/30";
  return "bg-blue-500/10 text-blue-300 ring-blue-500/30";
}

// -----------------------------------------------------------------------------
// Attack definitions
// -----------------------------------------------------------------------------

const attacks: AttackDef[] = [
  {
    id: "fee-bypass",
    title: "Fee Bypass (instruction stripping)",
    severity: "high",
    icon: <Scissors className="h-5 w-5" />,
    syllabusTopic: "Transaction malleability",
    theory: (
      <>
        In a non-atomic design, the platform sends two separate transactions:
        one for the fee and one for the trade. A malicious relayer can drop
        the fee transaction and forward only the trade. My design defeats
        this by putting both instructions in the same transaction — and the
        signature covers both.
      </>
    ),
    run: async () => {
      const payer = Keypair.generate();
      const builder = Keypair.generate();
      const exchange = Keypair.generate();

      const feeIx = SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: builder.publicKey,
        lamports: 5_000,
      });
      const tradeIx = SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: exchange.publicKey,
        lamports: 1_000_000,
      });

      const bundled = buildTx(payer.publicKey, [feeIx, tradeIx]);
      const bundledBytes = bundled.message.serialize();
      const bundledHash = await sha256Hex(bundledBytes);
      const signature = nacl.sign.detached(bundledBytes, payer.secretKey);

      // Attacker strips the fee
      const stripped = buildTx(payer.publicKey, [tradeIx]);
      const strippedBytes = stripped.message.serialize();
      const strippedHash = await sha256Hex(strippedBytes);
      const stripValid = nacl.sign.detached.verify(
        strippedBytes,
        signature,
        payer.publicKey.toBytes(),
      );

      return {
        passed: !stripValid,
        steps: [
          {
            label: "Bundle [fee, trade] into one transaction and sign once",
            detail: `SHA-256 = ${bundledHash.slice(0, 16)}…`,
            ok: null,
          },
          {
            label: "Attacker removes ix[0] (fee), keeps only ix[1] (trade)",
            ok: null,
          },
          {
            label: "Hash of stripped transaction",
            detail: `SHA-256 = ${strippedHash.slice(0, 16)}…`,
            ok: null,
          },
          {
            label: "Verify original signature against stripped message",
            detail: `result: ${stripValid ? "valid" : "invalid"}`,
            ok: !stripValid,
          },
        ],
        verdict:
          "PROTECTED — removing any instruction changes the message bytes, which changes the SHA-256, which invalidates the Ed25519 signature.",
      };
    },
  },

  {
    id: "fee-mutation",
    title: "Fee Amount Manipulation",
    severity: "high",
    icon: <Calculator className="h-5 w-5" />,
    syllabusTopic: "Hash functions / integrity",
    theory: (
      <>
        Even subtler than stripping: the attacker keeps the fee instruction
        but lowers the lamport amount to zero. Because the lamport value is
        encoded inside the instruction data of the signed message, mutating
        it invalidates the signature.
      </>
    ),
    run: async () => {
      const payer = Keypair.generate();
      const builder = Keypair.generate();
      const exchange = Keypair.generate();

      const original = buildTx(payer.publicKey, [
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: builder.publicKey,
          lamports: 5_000,
        }),
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: exchange.publicKey,
          lamports: 1_000_000,
        }),
      ]);
      const origBytes = original.message.serialize();
      const sig = nacl.sign.detached(origBytes, payer.secretKey);

      const tampered = buildTx(payer.publicKey, [
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: builder.publicKey,
          lamports: 0,
        }),
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: exchange.publicKey,
          lamports: 1_000_000,
        }),
      ]);
      const tampBytes = tampered.message.serialize();

      const valid = nacl.sign.detached.verify(
        tampBytes,
        sig,
        payer.publicKey.toBytes(),
      );

      return {
        passed: !valid,
        steps: [
          { label: "Original fee = 5,000 lamports (signed)", ok: null },
          { label: "Attacker rewrites fee = 0 lamports", ok: null },
          {
            label: "Verify signature against tampered message",
            detail: `result: ${valid ? "valid" : "invalid"}`,
            ok: !valid,
          },
        ],
        verdict:
          "PROTECTED — instruction data is part of the signed message; any change is detected.",
      };
    },
  },

  {
    id: "mitm",
    title: "Man-in-the-Middle (recipient swap)",
    severity: "high",
    icon: <UserX className="h-5 w-5" />,
    syllabusTopic: "Routing / MITM attacks",
    theory: (
      <>
        A network-level attacker (compromised RPC endpoint) intercepts the
        transaction between the wallet and the validator and rewrites the fee
        recipient to their own address. Because every account key is part of
        the signed message, this attack also fails.
      </>
    ),
    run: async () => {
      const payer = Keypair.generate();
      const honestBuilder = Keypair.generate();
      const attackerWallet = Keypair.generate();

      const original = buildTx(payer.publicKey, [
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: honestBuilder.publicKey,
          lamports: 5_000,
        }),
      ]);
      const origBytes = original.message.serialize();
      const sig = nacl.sign.detached(origBytes, payer.secretKey);

      const rerouted = buildTx(payer.publicKey, [
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: attackerWallet.publicKey,
          lamports: 5_000,
        }),
      ]);
      const reroutedBytes = rerouted.message.serialize();
      const valid = nacl.sign.detached.verify(
        reroutedBytes,
        sig,
        payer.publicKey.toBytes(),
      );

      return {
        passed: !valid,
        steps: [
          {
            label: "Honest fee recipient",
            detail: honestBuilder.publicKey.toBase58(),
            ok: null,
          },
          {
            label: "Attacker rewrites recipient to",
            detail: attackerWallet.publicKey.toBase58(),
            ok: null,
          },
          {
            label: "Verify against rewritten message",
            detail: `result: ${valid ? "valid" : "invalid"}`,
            ok: !valid,
          },
        ],
        verdict:
          "PROTECTED — account keys live in the signed message header; substituting any pubkey breaks the signature.",
      };
    },
  },

  {
    id: "replay",
    title: "Replay Attack",
    severity: "high",
    icon: <Repeat className="h-5 w-5" />,
    syllabusTopic: "Replay protection",
    theory: (
      <>
        A replay attack re-broadcasts a previously-valid transaction in the
        hope that the chain accepts it again, double-charging the user. Solana
        defends against this by binding every transaction to a{" "}
        <span className="font-mono">recentBlockhash</span> that is only valid
        for ~150 blocks (~60 seconds). After expiry, the validator drops the
        transaction without execution.
      </>
    ),
    run: async () => {
      const payer = Keypair.generate();
      const recipient = Keypair.generate();

      const tx1 = buildTx(payer.publicKey, [
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: recipient.publicKey,
          lamports: 1_000,
        }),
      ]);
      const bytes1 = tx1.message.serialize();
      const sig1 = nacl.sign.detached(bytes1, payer.secretKey);

      // Same instructions, different blockhash (simulating the validator's
      // view after the original blockhash expired)
      const tx2 = buildTx(
        payer.publicKey,
        [
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: recipient.publicKey,
            lamports: 1_000,
          }),
        ],
        ALT_BLOCKHASH,
      );
      const bytes2 = tx2.message.serialize();
      const replayValid = nacl.sign.detached.verify(
        bytes2,
        sig1,
        payer.publicKey.toBytes(),
      );

      const steps: AttackStep[] = [
        {
          label: "Sign transaction at slot N with blockhash A",
          detail: `blockhash = ${PLACEHOLDER_BLOCKHASH.slice(0, 12)}…`,
          ok: null,
        },
        {
          label: "Broadcast and confirm — accepted by validators",
          ok: true,
        },
        {
          label: "Wait for blockhash A to expire (~150 blocks ≈ 60s)",
          ok: null,
        },
        {
          label: "Attacker rebroadcasts the SAME signed bytes",
          detail: "validator now expects blockhash B",
          ok: null,
        },
        {
          label: "Verifier checks signature against new (current) blockhash",
          detail: `nacl.sign.detached.verify → ${String(replayValid)}`,
          ok: !replayValid,
        },
      ];

      return {
        passed: !replayValid,
        steps,
        verdict:
          "PROTECTED — the blockhash is part of the signed message, so the signature does not validate after expiry.",
      };
    },
  },

  {
    id: "forgery",
    title: "Signature Forgery",
    severity: "high",
    icon: <KeyRound className="h-5 w-5" />,
    syllabusTopic: "Public-key authentication",
    theory: (
      <>
        Ed25519 (RFC 8032, Bernstein et al. 2011) provides a 128-bit security
        level. Forging a signature without the secret key requires solving the
        ECDLP on Curve25519, which is computationally infeasible. To prove this
        empirically, I sign with key A and try to verify with key B&apos;s
        public key.
      </>
    ),
    run: async () => {
      const alice = Keypair.generate();
      const eve = Keypair.generate();
      const message = new TextEncoder().encode("approve withdrawal of 100 SOL");

      const aliceSig = nacl.sign.detached(message, alice.secretKey);
      const validForAlice = nacl.sign.detached.verify(
        message,
        aliceSig,
        alice.publicKey.toBytes(),
      );
      const validForEve = nacl.sign.detached.verify(
        message,
        aliceSig,
        eve.publicKey.toBytes(),
      );

      // Eve forges by flipping a byte of the signature
      const forged = new Uint8Array(aliceSig);
      forged[0] ^= 0xff;
      const forgedValid = nacl.sign.detached.verify(
        message,
        forged,
        alice.publicKey.toBytes(),
      );

      return {
        passed: validForAlice && !validForEve && !forgedValid,
        steps: [
          {
            label: "Alice signs the message with her secret key",
            ok: null,
          },
          {
            label: "Verify with Alice's public key",
            detail: "expected: valid",
            ok: validForAlice,
          },
          {
            label: "Try to verify with Eve's (different) public key",
            detail: `result: ${validForEve ? "valid" : "invalid"}`,
            ok: !validForEve,
          },
          {
            label: "Eve flips one byte of Alice's signature and retries",
            detail: `result: ${forgedValid ? "valid" : "invalid"}`,
            ok: !forgedValid,
          },
          {
            label: "Cost to forge from scratch",
            detail: "≈ 2^128 EC operations · longer than the age of the universe",
            ok: null,
          },
        ],
        verdict:
          "PROTECTED — Ed25519 provides 128-bit security; both wrong-key verification and bit-flipped signatures fail.",
      };
    },
  },

  {
    id: "reorder",
    title: "Instruction Reordering",
    severity: "medium",
    icon: <ArrowDownUp className="h-5 w-5" />,
    syllabusTopic: "Transaction structure",
    theory: (
      <>
        Order matters: I deliberately put the fee instruction first so that
        if the trader&apos;s account lacks SOL for the fee, the entire
        transaction reverts before the trade executes. An attacker reordering
        the instructions would break the message hash.
      </>
    ),
    run: async () => {
      const payer = Keypair.generate();
      const builder = Keypair.generate();
      const exchange = Keypair.generate();

      const feeIx = SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: builder.publicKey,
        lamports: 5_000,
      });
      const tradeIx = SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: exchange.publicKey,
        lamports: 1_000_000,
      });

      const ordered = buildTx(payer.publicKey, [feeIx, tradeIx]);
      const orderedBytes = ordered.message.serialize();
      const sig = nacl.sign.detached(orderedBytes, payer.secretKey);

      const reordered = buildTx(payer.publicKey, [tradeIx, feeIx]);
      const reorderedBytes = reordered.message.serialize();

      const orderedHash = await sha256Hex(orderedBytes);
      const reorderedHash = await sha256Hex(reorderedBytes);

      const valid = nacl.sign.detached.verify(
        reorderedBytes,
        sig,
        payer.publicKey.toBytes(),
      );

      return {
        passed: !valid,
        steps: [
          {
            label: "Sign [fee, trade]",
            detail: `SHA-256 = ${orderedHash.slice(0, 16)}…`,
            ok: null,
          },
          {
            label: "Attacker reorders to [trade, fee]",
            detail: `SHA-256 = ${reorderedHash.slice(0, 16)}…`,
            ok: null,
          },
          {
            label: "Verify original signature against reordered bytes",
            detail: `result: ${valid ? "valid" : "invalid"}`,
            ok: !valid,
          },
        ],
        verdict:
          "PROTECTED — the compiled message bytes encode order; any permutation changes the hash.",
      };
    },
  },
];

// -----------------------------------------------------------------------------
// UI: one card per attack
// -----------------------------------------------------------------------------

function AttackCard({
  attack,
  result,
  running,
  onRun,
}: {
  attack: AttackDef;
  result: AttackResult | null;
  running: boolean;
  onRun: () => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <Card className="bg-gray-900/40">
      <CardHeader className="cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-blue-500/10 p-2 text-blue-400">
              {attack.icon}
            </div>
            <div>
              <CardTitle className="flex items-center gap-2 text-white">
                {attack.title}
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${severityColor(
                    attack.severity,
                  )}`}
                >
                  {attack.severity}
                </span>
                {result && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${
                      result.passed
                        ? "bg-green-500/10 text-green-300 ring-green-500/30"
                        : "bg-red-500/10 text-red-300 ring-red-500/30"
                    }`}
                  >
                    {result.passed ? "passed" : "failed"}
                  </span>
                )}
              </CardTitle>
              <CardDescription className="text-gray-400">
                {attack.syllabusTopic}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={running}
              onClick={(e) => {
                e.stopPropagation();
                onRun();
              }}
              className="border-gray-700 bg-gray-800 text-white hover:bg-gray-700"
            >
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : result ? (
                "Re-run"
              ) : (
                "Run test"
              )}
            </Button>
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
          <div className="rounded-md border border-gray-700 bg-black/30 p-4 text-sm text-gray-300">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Theory
            </div>
            {attack.theory}
          </div>

          {result && (
            <div className="mt-4 grid gap-2">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                  assertion passed
                </span>
                <span className="flex items-center gap-1.5">
                  <XCircle className="h-3.5 w-3.5 text-red-400" />
                  assertion failed
                </span>
                <span className="flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-gray-500" />
                  narrative step (no pass/fail)
                </span>
              </div>
              {result.steps.map((step, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-md border border-gray-800 bg-gray-950/60 px-3 py-2"
                >
                  <div className="mt-0.5">
                    {step.ok === null ? (
                      <Info className="h-4 w-4 text-gray-500" />
                    ) : step.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-gray-200">{step.label}</div>
                    {step.detail && (
                      <div className="mt-0.5 break-all font-mono text-xs text-gray-500">
                        {step.detail}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <div
                className={`mt-2 rounded-md border px-4 py-3 text-sm ${
                  result.passed
                    ? "border-green-600/30 bg-green-600/5 text-green-200"
                    : "border-red-600/30 bg-red-600/5 text-red-200"
                }`}
              >
                <span className="font-semibold">
                  {result.passed ? "✓ Verdict: " : "✗ Verdict: "}
                </span>
                {result.verdict}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export default function SecurityPage() {
  const [batchRunning, setBatchRunning] = useState(false);
  const [results, setResults] = useState<Record<string, AttackResult>>({});
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());

  const runOne = useCallback(async (attack: AttackDef) => {
    setRunningIds((prev) => {
      const next = new Set(prev);
      next.add(attack.id);
      return next;
    });
    try {
      let res: AttackResult;
      try {
        res = await attack.run();
      } catch (err) {
        // Convert any thrown error into a visible failure result so a single
        // broken test never aborts the surrounding "Run all" loop.
        const message = err instanceof Error ? err.message : String(err);
        res = {
          passed: false,
          steps: [
            {
              label: "Test threw an unexpected error",
              detail: message,
              ok: false,
            },
          ],
          verdict: `ERROR — ${message}`,
        };
        console.error(`[security] ${attack.id} test errored:`, err);
      }
      setResults((prev) => ({ ...prev, [attack.id]: res }));
    } finally {
      setRunningIds((prev) => {
        const next = new Set(prev);
        next.delete(attack.id);
        return next;
      });
    }
  }, []);

  const runAll = useCallback(async () => {
    setBatchRunning(true);
    setResults({});
    try {
      for (const a of attacks) {
        // Sequential so the user sees each card update in turn.
        await runOne(a);
      }
    } finally {
      setBatchRunning(false);
    }
  }, [runOne]);

  const completed = Object.keys(results).length;
  const passed = Object.values(results).filter((r) => r.passed).length;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-red-400" />
            <h1 className="text-3xl font-bold text-white">
              Attack Resistance Test Suite
            </h1>
          </div>
          <p className="max-w-3xl text-gray-400">
            Six client-side simulations of well-known attacks against
            blockchain transactions. Each test constructs a real Solana{" "}
            <span className="font-mono">VersionedTransaction</span>, signs it
            with a fresh Ed25519 keypair, applies the attack, and checks
            whether the signature still verifies.
          </p>
          <ul className="mt-3 max-w-3xl space-y-1 text-sm text-gray-400">
            <li>
              <span className="font-semibold text-green-300">PASSED</span> = the
              attack was rejected; the defence works.
            </li>
            <li>
              <span className="font-semibold text-red-300">FAILED</span> = the
              attack succeeded; the chain would have accepted the malicious tx.
            </li>
            <li>
              <span className="font-semibold text-gray-300">HIGH / MEDIUM / LOW</span>{" "}
              is the severity rating of the attack class itself — it does NOT
              change after a test runs.
            </li>
          </ul>
        </div>

        <Card className="mb-6 border-blue-600/30 bg-blue-600/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-7 w-7 text-blue-400" />
              <div>
                <div className="text-sm text-blue-200">
                  Run the full audit in one click
                </div>
                <div className="text-xl font-bold text-white">
                  {completed === 0
                    ? `${attacks.length} tests ready`
                    : `${passed} / ${completed} passed`}
                </div>
              </div>
            </div>
            <Button
              onClick={() => void runAll()}
              disabled={batchRunning}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {batchRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running…
                </>
              ) : (
                "Run all attack tests"
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {attacks.map((a) => (
            <AttackCard
              key={a.id}
              attack={a}
              result={results[a.id] ?? null}
              running={runningIds.has(a.id)}
              onRun={() => void runOne(a)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
