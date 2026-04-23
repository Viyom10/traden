"use client";

/**
 * /verify — SHA-256 & Ed25519 Integrity Verification Page
 *
 * Provides live, in-browser cryptographic demonstrations of the integrity
 * guarantees that underpin atomic fee enforcement on Solana.
 *
 * No wallet is required: a fresh Ed25519 keypair is generated for each demo
 * via `Keypair.generate()` and signature verification is done in-browser
 * using `tweetnacl` (the same Ed25519 implementation that @solana/web3.js
 * uses internally for signing).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  Hash,
  Key,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  Zap,
  Lock,
  TreePine,
} from "lucide-react";
import {
  buildMerkleTree,
  getProof,
  shortHex,
  toHex,
  verifyProof,
  type MerkleProofStep,
  type MerkleTree,
} from "@/lib/merkle";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const PLACEHOLDER_BLOCKHASH = "11111111111111111111111111111111";

async function sha256Hex(data: Uint8Array): Promise<string> {
  // Re-wrap as a fresh ArrayBuffer-backed Uint8Array so it satisfies the
  // BufferSource signature on all DOM lib variants (some emit
  // `Uint8Array<ArrayBufferLike>` which isn't structurally assignable to
  // BufferSource under strict TS).
  const view = new Uint8Array(data.byteLength);
  view.set(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", view.buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToHex(bytes: Uint8Array, max = 64): string {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (hex.length <= max * 2) return hex;
  return `${hex.slice(0, max * 2)}…`;
}

function bytesToBitString(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(2).padStart(8, "0"))
    .join("");
}

function countDifferingBits(a: Uint8Array, b: Uint8Array): number {
  const len = Math.min(a.length, b.length);
  let diff = 0;
  for (let i = 0; i < len; i++) {
    let xor = a[i] ^ b[i];
    while (xor) {
      diff += xor & 1;
      xor >>= 1;
    }
  }
  return diff;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

function buildBundledTx(opts: {
  payer: PublicKey;
  feeRecipient: PublicKey;
  feeLamports: number;
  tradeRecipient: PublicKey;
  tradeLamports: number;
  blockhash?: string;
}): VersionedTransaction {
  const feeIx = SystemProgram.transfer({
    fromPubkey: opts.payer,
    toPubkey: opts.feeRecipient,
    lamports: opts.feeLamports,
  });
  const tradeIx = SystemProgram.transfer({
    fromPubkey: opts.payer,
    toPubkey: opts.tradeRecipient,
    lamports: opts.tradeLamports,
  });
  const message = new TransactionMessage({
    payerKey: opts.payer,
    instructions: [feeIx, tradeIx],
    recentBlockhash: opts.blockhash ?? PLACEHOLDER_BLOCKHASH,
  }).compileToV0Message();
  return new VersionedTransaction(message);
}

// -----------------------------------------------------------------------------
// Reusable visual primitives
// -----------------------------------------------------------------------------

function Mono({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <code
      className={`block w-full break-all rounded-md border border-gray-700 bg-black/50 px-3 py-2 font-mono text-xs text-gray-200 ${className}`}
    >
      {children}
    </code>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        ok
          ? "bg-green-500/10 text-green-400 ring-1 ring-green-500/30"
          : "bg-red-500/10 text-red-400 ring-1 ring-red-500/30"
      }`}
    >
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <XCircle className="h-3.5 w-3.5" />
      )}
      {label}
    </span>
  );
}

function StepHeader({
  step,
  total,
  title,
  icon,
}: {
  step: number;
  total: number;
  title: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/40">
        {icon}
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-gray-500">
          Step {step} / {total}
        </div>
        <div className="text-base font-semibold text-white">{title}</div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Section 1 — Step-by-step Integrity Demo
//
// (Section 2 of the original layout — "Atomicity Proof Matrix" — was removed
//  because its on-mount async work could freeze the UI on slower devices.
//  Sections were renumbered: old Section 3 is now Section 2, old Section 4
//  is now Section 3.)
// -----------------------------------------------------------------------------

interface IntegrityState {
  payer: Keypair;
  feeRecipient: Keypair;
  tradeRecipient: Keypair;
  feeLamports: number;
  tradeLamports: number;
  bundledTx: VersionedTransaction;
  messageBytes: Uint8Array;
  messageHashHex: string;
  signature: Uint8Array;
  // Tampered version
  tamperedTx: VersionedTransaction;
  tamperedMessageBytes: Uint8Array;
  tamperedHashHex: string;
  tamperedHashDifferingBits: number;
  signatureValidOriginal: boolean;
  signatureValidTampered: boolean;
}

const TOTAL_INTEGRITY_STEPS = 10;

function IntegrityDemo() {
  const [state, setState] = useState<IntegrityState | null>(null);
  const [revealedStep, setRevealedStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const buildState = useCallback(async (): Promise<IntegrityState> => {
    const payer = Keypair.generate();
    const feeRecipient = Keypair.generate();
    const tradeRecipient = Keypair.generate();
    const feeLamports = 5_000;
    const tradeLamports = 1_000_000;

    const bundledTx = buildBundledTx({
      payer: payer.publicKey,
      feeRecipient: feeRecipient.publicKey,
      feeLamports,
      tradeRecipient: tradeRecipient.publicKey,
      tradeLamports,
    });
    const messageBytes = bundledTx.message.serialize();
    const messageHashHex = await sha256Hex(messageBytes);

    // Sign the SHA-256 hash with Ed25519
    const signature = nacl.sign.detached(messageBytes, payer.secretKey);

    // Tamper: build identical transaction but change fee by 1 lamport
    const tamperedTx = buildBundledTx({
      payer: payer.publicKey,
      feeRecipient: feeRecipient.publicKey,
      feeLamports: feeLamports - 1,
      tradeRecipient: tradeRecipient.publicKey,
      tradeLamports,
    });
    const tamperedMessageBytes = tamperedTx.message.serialize();
    const tamperedHashHex = await sha256Hex(tamperedMessageBytes);

    const originalHashBytes = hexToBytes(messageHashHex);
    const tamperedHashBytes = hexToBytes(tamperedHashHex);
    const tamperedHashDifferingBits = countDifferingBits(
      originalHashBytes,
      tamperedHashBytes,
    );

    const signatureValidOriginal = nacl.sign.detached.verify(
      messageBytes,
      signature,
      payer.publicKey.toBytes(),
    );
    const signatureValidTampered = nacl.sign.detached.verify(
      tamperedMessageBytes,
      signature,
      payer.publicKey.toBytes(),
    );

    return {
      payer,
      feeRecipient,
      tradeRecipient,
      feeLamports,
      tradeLamports,
      bundledTx,
      messageBytes,
      messageHashHex,
      signature,
      tamperedTx,
      tamperedMessageBytes,
      tamperedHashHex,
      tamperedHashDifferingBits,
      signatureValidOriginal,
      signatureValidTampered,
    };
  }, []);

  const reset = useCallback(async () => {
    setBusy(true);
    try {
      const next = await buildState();
      setState(next);
      setRevealedStep(1);
    } finally {
      setBusy(false);
    }
  }, [buildState]);

  useEffect(() => {
    void reset();
  }, [reset]);

  const advance = () =>
    setRevealedStep((s) => Math.min(TOTAL_INTEGRITY_STEPS, s + 1));

  const renderedSteps = useMemo(() => {
    if (!state) return null;
    const steps: React.ReactNode[] = [];

    // Step 1 — Generate keypair
    if (revealedStep >= 1) {
      steps.push(
        <Card key="s1" className="bg-gray-900/60">
          <CardContent className="pt-6">
            <StepHeader
              step={1}
              total={TOTAL_INTEGRITY_STEPS}
              title="Generate an Ed25519 keypair (browser-only, no wallet)"
              icon={<Key className="h-4 w-4" />}
            />
            <p className="mb-3 text-sm text-gray-400">
              I use <span className="font-mono">Keypair.generate()</span> to
              create a fresh 32-byte Ed25519 secret key and derive its 32-byte
              public key. In production this would be your Phantom wallet.
            </p>
            <div className="grid gap-2">
              <div>
                <div className="mb-1 text-xs text-gray-500">
                  Public key (Solana address, base58)
                </div>
                <Mono>{state.payer.publicKey.toBase58()}</Mono>
              </div>
              <div>
                <div className="mb-1 text-xs text-gray-500">
                  Public key bytes (32 bytes, hex)
                </div>
                <Mono>{bytesToHex(state.payer.publicKey.toBytes(), 32)}</Mono>
              </div>
            </div>
          </CardContent>
        </Card>,
      );
    }

    // Step 2 — Build fee instruction
    if (revealedStep >= 2) {
      steps.push(
        <Card key="s2" className="bg-gray-900/60">
          <CardContent className="pt-6">
            <StepHeader
              step={2}
              total={TOTAL_INTEGRITY_STEPS}
              title="Build the fee instruction (SystemProgram.transfer)"
              icon={<Sparkles className="h-4 w-4" />}
            />
            <p className="mb-3 text-sm text-gray-400">
              The fee is a plain SOL transfer from the trader to the platform
              builder authority. In production this is created in{" "}
              <span className="font-mono">tradingFee.ts</span> at 5 bps of the
              order size.
            </p>
            <Mono>
              SystemProgram.transfer({"{"}
              <br />
              &nbsp;&nbsp;fromPubkey: {state.payer.publicKey.toBase58().slice(0, 8)}…,
              <br />
              &nbsp;&nbsp;toPubkey: {state.feeRecipient.publicKey.toBase58().slice(0, 8)}…,
              <br />
              &nbsp;&nbsp;lamports: {state.feeLamports.toLocaleString()}
              <br />
              {"}"})
            </Mono>
          </CardContent>
        </Card>,
      );
    }

    // Step 3 — Build trade instruction
    if (revealedStep >= 3) {
      steps.push(
        <Card key="s3" className="bg-gray-900/60">
          <CardContent className="pt-6">
            <StepHeader
              step={3}
              total={TOTAL_INTEGRITY_STEPS}
              title="Build the simulated trade instruction"
              icon={<Sparkles className="h-4 w-4" />}
            />
            <p className="mb-3 text-sm text-gray-400">
              For demo purposes I simulate the Drift place-order instruction
              with another transfer. In production this is the actual Drift
              perpetual order CPI.
            </p>
            <Mono>
              SystemProgram.transfer({"{"}
              <br />
              &nbsp;&nbsp;fromPubkey: {state.payer.publicKey.toBase58().slice(0, 8)}…,
              <br />
              &nbsp;&nbsp;toPubkey: {state.tradeRecipient.publicKey.toBase58().slice(0, 8)}…,
              <br />
              &nbsp;&nbsp;lamports: {state.tradeLamports.toLocaleString()}
              <br />
              {"}"})
            </Mono>
          </CardContent>
        </Card>,
      );
    }

    // Step 4 — Bundle into a v0 transaction
    if (revealedStep >= 4) {
      steps.push(
        <Card key="s4" className="bg-gray-900/60">
          <CardContent className="pt-6">
            <StepHeader
              step={4}
              total={TOTAL_INTEGRITY_STEPS}
              title="Bundle both instructions into a single v0 TransactionMessage"
              icon={<Lock className="h-4 w-4" />}
            />
            <p className="mb-3 text-sm text-gray-400">
              Both instructions are placed in the SAME transaction. Solana
              executes a transaction atomically: either every instruction
              succeeds, or none of them are committed. This is the foundation of
              atomic fee enforcement.
            </p>
            <div className="mb-3 grid gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="rounded bg-purple-500/15 px-2 py-0.5 font-mono text-purple-300">
                  ix[0]
                </span>
                <span className="text-gray-300">
                  fee transfer · {state.feeLamports.toLocaleString()} lamports
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-blue-500/15 px-2 py-0.5 font-mono text-blue-300">
                  ix[1]
                </span>
                <span className="text-gray-300">
                  trade transfer · {state.tradeLamports.toLocaleString()} lamports
                </span>
              </div>
            </div>
            <div className="mb-1 text-xs text-gray-500">
              Compiled message size:{" "}
              <span className="font-mono text-gray-300">
                {state.messageBytes.length} bytes
              </span>
            </div>
            <Mono>{bytesToHex(state.messageBytes, 96)}</Mono>
          </CardContent>
        </Card>,
      );
    }

    // Step 5 — SHA-256 hash
    if (revealedStep >= 5) {
      steps.push(
        <Card key="s5" className="bg-gray-900/60">
          <CardContent className="pt-6">
            <StepHeader
              step={5}
              total={TOTAL_INTEGRITY_STEPS}
              title="Compute SHA-256 of the serialized message"
              icon={<Hash className="h-4 w-4" />}
            />
            <p className="mb-3 text-sm text-gray-400">
              SHA-256 (FIPS 180-4) compresses the message into a 256-bit
              fingerprint. Ed25519 signs this fingerprint, not the raw message.
              I use the browser&apos;s Web Crypto API (
              <span className="font-mono">crypto.subtle.digest</span>).
            </p>
            <div className="mb-1 text-xs text-gray-500">
              SHA-256(message) — 32 bytes / 64 hex chars
            </div>
            <Mono className="text-green-300">{state.messageHashHex}</Mono>
          </CardContent>
        </Card>,
      );
    }

    // Step 6 — Ed25519 signature
    if (revealedStep >= 6) {
      steps.push(
        <Card key="s6" className="bg-gray-900/60">
          <CardContent className="pt-6">
            <StepHeader
              step={6}
              total={TOTAL_INTEGRITY_STEPS}
              title="Sign the message with Ed25519"
              icon={<Key className="h-4 w-4" />}
            />
            <p className="mb-3 text-sm text-gray-400">
              Ed25519 (RFC 8032) produces a deterministic 64-byte signature.
              This single signature covers the ENTIRE serialized message —
              every account key, every instruction, every byte of data.
            </p>
            <div className="mb-1 text-xs text-gray-500">
              Signature (64 bytes, hex)
            </div>
            <Mono className="text-blue-300">
              {bytesToHex(state.signature, 64)}
            </Mono>
            <div className="mt-3">
              <StatusPill
                ok={state.signatureValidOriginal}
                label="Signature verifies against ORIGINAL message"
              />
            </div>
          </CardContent>
        </Card>,
      );
    }

    // Step 7 — Tamper
    if (revealedStep >= 7) {
      steps.push(
        <Card key="s7" className="border-yellow-600/30 bg-yellow-600/5">
          <CardContent className="pt-6">
            <StepHeader
              step={7}
              total={TOTAL_INTEGRITY_STEPS}
              title="Tamper: change the fee by exactly 1 lamport"
              icon={<AlertTriangle className="h-4 w-4 text-yellow-400" />}
            />
            <p className="mb-3 text-sm text-gray-400">
              An attacker (a relayer, an MEV searcher, a man-in-the-middle)
              modifies the in-flight transaction to lower the fee by{" "}
              <span className="font-mono text-yellow-300">1 lamport</span>.
              Just one lamport — almost imperceptible. Let&apos;s see what
              happens to the cryptographic chain.
            </p>
            <div className="grid gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="rounded bg-green-500/15 px-2 py-0.5 font-mono text-green-300">
                  before
                </span>
                <span className="text-gray-300">
                  fee = {state.feeLamports.toLocaleString()} lamports
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-yellow-500/15 px-2 py-0.5 font-mono text-yellow-300">
                  after
                </span>
                <span className="text-gray-300">
                  fee = {(state.feeLamports - 1).toLocaleString()} lamports
                </span>
              </div>
            </div>
          </CardContent>
        </Card>,
      );
    }

    // Step 8 — New hash
    if (revealedStep >= 8) {
      steps.push(
        <Card key="s8" className="bg-gray-900/60">
          <CardContent className="pt-6">
            <StepHeader
              step={8}
              total={TOTAL_INTEGRITY_STEPS}
              title="Recompute SHA-256 of the tampered message"
              icon={<Hash className="h-4 w-4" />}
            />
            <p className="mb-3 text-sm text-gray-400">
              Avalanche effect: a single-bit change in the input flips
              approximately half of the output bits. The new hash is
              statistically indistinguishable from a fresh random 256-bit
              string.
            </p>
            <div className="mb-1 text-xs text-gray-500">
              Original SHA-256 (green)
            </div>
            <Mono className="text-green-300">{state.messageHashHex}</Mono>
            <div className="mb-1 mt-3 text-xs text-gray-500">
              Tampered SHA-256 (red)
            </div>
            <Mono className="text-red-300">{state.tamperedHashHex}</Mono>
            <div className="mt-3 rounded-md border border-yellow-600/30 bg-yellow-600/10 px-3 py-2 text-xs text-yellow-300">
              Differing bits:{" "}
              <span className="font-mono">
                {state.tamperedHashDifferingBits}
              </span>{" "}
              / 256 (
              {((state.tamperedHashDifferingBits / 256) * 100).toFixed(1)}% of
              the output flipped from a 1-lamport change in the input)
            </div>
          </CardContent>
        </Card>,
      );
    }

    // Step 9 — Verify against tampered
    if (revealedStep >= 9) {
      steps.push(
        <Card key="s9" className="bg-gray-900/60">
          <CardContent className="pt-6">
            <StepHeader
              step={9}
              total={TOTAL_INTEGRITY_STEPS}
              title="Try to verify the original signature against the tampered message"
              icon={<ShieldCheck className="h-4 w-4" />}
            />
            <p className="mb-3 text-sm text-gray-400">
              The Solana validator runs exactly this check before executing
              any transaction. If even one byte of the message changed after
              signing, the verification deterministically fails.
            </p>
            <Mono>
              nacl.sign.detached.verify(
              <br />
              &nbsp;&nbsp;tamperedMessageBytes,
              <br />
              &nbsp;&nbsp;originalSignature,
              <br />
              &nbsp;&nbsp;publicKey
              <br />
              ) →{" "}
              <span
                className={
                  state.signatureValidTampered
                    ? "text-green-400"
                    : "text-red-400"
                }
              >
                {String(state.signatureValidTampered)}
              </span>
            </Mono>
            <div className="mt-3">
              <StatusPill
                ok={!state.signatureValidTampered}
                label={
                  state.signatureValidTampered
                    ? "FAIL: signature still valid?!"
                    : "Tampered message REJECTED — atomicity preserved"
                }
              />
            </div>
          </CardContent>
        </Card>,
      );
    }

    // Step 10 — Conclusion
    if (revealedStep >= 10) {
      steps.push(
        <Card
          key="s10"
          className="border-green-600/30 bg-green-600/5"
        >
          <CardContent className="pt-6">
            <StepHeader
              step={10}
              total={TOTAL_INTEGRITY_STEPS}
              title="Conclusion: the fee cannot be removed, reduced, or rerouted"
              icon={<ShieldCheck className="h-4 w-4 text-green-400" />}
            />
            <p className="text-sm text-gray-300">
              The Ed25519 signature acts as a cryptographic seal binding the
              fee instruction and the trade instruction into a single
              indivisible unit. Any modification — to amounts, recipients,
              ordering, or instruction data — produces a different SHA-256
              digest, which the original signature does not validate. Solana
              rejects the transaction before any state changes occur.
            </p>
            <div className="mt-4 grid gap-2">
              <StatusPill ok label="Atomic bundling — preserved" />
              <StatusPill ok label="Fee tamper-resistance — preserved" />
              <StatusPill ok label="Recipient integrity — preserved" />
            </div>
          </CardContent>
        </Card>,
      );
    }

    return steps;
  }, [state, revealedStep]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-white">
              <Lock className="h-5 w-5 text-blue-400" />
              Section 1 · Transaction Integrity Demo
            </CardTitle>
            <CardDescription className="text-gray-400">
              Step through the full sign → tamper → verify pipeline using a
              freshly-generated Ed25519 keypair in your browser.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void reset()}
              className="border-gray-700 bg-gray-800 text-white hover:bg-gray-700"
            >
              <RefreshCw className="mr-1.5 h-4 w-4" />
              New keypair
            </Button>
            <Button
              size="sm"
              disabled={!state || revealedStep >= TOTAL_INTEGRITY_STEPS}
              onClick={advance}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              Next step →
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center justify-between text-xs text-gray-400">
          <span>
            Progress: {Math.min(revealedStep, TOTAL_INTEGRITY_STEPS)} /{" "}
            {TOTAL_INTEGRITY_STEPS}
          </span>
          <div className="h-1.5 w-48 overflow-hidden rounded-full bg-gray-800">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{
                width: `${(revealedStep / TOTAL_INTEGRITY_STEPS) * 100}%`,
              }}
            />
          </div>
        </div>
        <div className="grid gap-4">{renderedSteps}</div>
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Section 2 — Avalanche / Hash properties
//
// NOTE: the previous "Section 2 · Atomicity Proof Matrix" was removed because
// its on-mount `useEffect` could freeze the UI on slower devices. The same
// six tamper attacks are demonstrated interactively on /security with
// per-attack Run buttons, so this page now jumps directly to hash properties.
// -----------------------------------------------------------------------------

function HashPropertiesDemo() {
  const [input, setInput] = useState("Atomic Fee Enforcement");
  const [hash, setHash] = useState("");
  const [flippedHash, setFlippedHash] = useState("");
  const [bitsFlipped, setBitsFlipped] = useState(0);

  useEffect(() => {
    const run = async () => {
      const enc = new TextEncoder();
      const a = enc.encode(input);
      const b = new Uint8Array(a);
      if (b.length > 0) b[0] ^= 0x01;
      const ha = await sha256Hex(a);
      const hb = await sha256Hex(b);
      setHash(ha);
      setFlippedHash(hb);
      setBitsFlipped(countDifferingBits(hexToBytes(ha), hexToBytes(hb)));
    };
    void run();
  }, [input]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Zap className="h-5 w-5 text-yellow-400" />
          Section 2 · Hash Properties (avalanche, pre-image, collision)
        </CardTitle>
        <CardDescription className="text-gray-400">
          Type something and watch ~half of the SHA-256 output bits flip when
          one bit of the input is flipped.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-gray-500">
              Input
            </label>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full rounded-md border border-gray-700 bg-black/40 px-3 py-2 font-mono text-sm text-white outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <div className="mb-1 text-xs text-gray-500">SHA-256(input)</div>
            <Mono className="text-green-300">{hash || "—"}</Mono>
          </div>

          <div>
            <div className="mb-1 text-xs text-gray-500">
              SHA-256(input with bit 0 of byte 0 flipped)
            </div>
            <Mono className="text-yellow-300">{flippedHash || "—"}</Mono>
          </div>

          <div className="rounded-md border border-yellow-600/30 bg-yellow-600/10 px-4 py-3">
            <div className="text-xs text-yellow-200">Avalanche effect</div>
            <div className="text-2xl font-bold text-white">
              {bitsFlipped} / 256 bits flipped (
              {((bitsFlipped / 256) * 100).toFixed(1)}%)
            </div>
            <div className="mt-1 text-xs text-yellow-200/80">
              Cryptographically secure hash functions target ≈ 50% bit-flip
              probability on any input change.
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-gray-700 bg-gray-900/60 p-4">
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
                <Hash className="h-4 w-4 text-blue-400" /> Pre-image resistance
              </div>
              <p className="text-xs text-gray-400">
                Given <span className="font-mono">h = SHA-256(m)</span> there
                is no known method materially faster than brute-force
                (2<sup>256</sup> attempts) to find <span className="font-mono">m</span>.
                This is why the validator can publish the hash but never recover
                the message from it.
              </p>
            </div>
            <div className="rounded-md border border-gray-700 bg-gray-900/60 p-4">
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
                <Hash className="h-4 w-4 text-purple-400" /> Collision
                resistance
              </div>
              <p className="text-xs text-gray-400">
                The birthday bound for SHA-256 is{" "}
                <span className="font-mono">2^128</span> operations to find any
                two messages with the same hash — far beyond the reach of any
                attacker. So two distinct transactions cannot share a hash and
                therefore cannot share a signature.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Section 3 — Merkle proofs
// -----------------------------------------------------------------------------

const DEFAULT_LEAVES = [
  "alice → bob: 1.0 SOL",
  "carol → dave: 2.5 SOL",
  "erin → frank: 0.75 SOL",
  "grace → heidi: 4.2 SOL",
  "ivan → judy: 12.0 SOL",
  "kim → leo: 0.05 SOL",
  "mia → noah: 8.8 SOL",
  "olivia → peter: 3.3 SOL",
];

interface MerkleDemoState {
  tree: MerkleTree;
  selectedIndex: number;
  proof: MerkleProofStep[];
  proofValid: boolean;
  tamperedValid: boolean | null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function MerkleProofDemo() {
  const [leavesText, setLeavesText] = useState(DEFAULT_LEAVES.join("\n"));
  const [tamperText, setTamperText] = useState("alice → bob: 1000000 SOL");
  const [state, setState] = useState<MerkleDemoState | null>(null);
  const [busy, setBusy] = useState(false);

  const leaves = useMemo(() => {
    const enc = new TextEncoder();
    return leavesText
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => ({ text: s, bytes: enc.encode(s) }));
  }, [leavesText]);

  const rebuild = useCallback(
    async (preferIndex?: number) => {
      if (leaves.length === 0) {
        setState(null);
        return;
      }
      setBusy(true);
      try {
        const tree = await buildMerkleTree(leaves.map((l) => l.bytes));
        const idx = Math.min(
          Math.max(preferIndex ?? state?.selectedIndex ?? 0, 0),
          leaves.length - 1,
        );
        const proof = getProof(tree, idx);
        const proofValid = await verifyProof(
          leaves[idx].bytes,
          proof,
          tree.root,
        );
        setState({
          tree,
          selectedIndex: idx,
          proof,
          proofValid,
          tamperedValid: null,
        });
      } finally {
        setBusy(false);
      }
    },
    [leaves, state?.selectedIndex],
  );

  useEffect(() => {
    void rebuild();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leavesText]);

  const onSelect = useCallback(
    async (idx: number) => {
      if (!state) return;
      setBusy(true);
      try {
        const proof = getProof(state.tree, idx);
        const proofValid = await verifyProof(
          leaves[idx].bytes,
          proof,
          state.tree.root,
        );
        setState({
          ...state,
          selectedIndex: idx,
          proof,
          proofValid,
          tamperedValid: null,
        });
      } finally {
        setBusy(false);
      }
    },
    [state, leaves],
  );

  const onTamper = useCallback(async () => {
    if (!state) return;
    setBusy(true);
    try {
      const enc = new TextEncoder();
      const fakeLeaf = enc.encode(tamperText);
      const ok = await verifyProof(fakeLeaf, state.proof, state.tree.root);
      setState({ ...state, tamperedValid: ok });
    } finally {
      setBusy(false);
    }
  }, [state, tamperText]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <TreePine className="h-5 w-5 text-emerald-400" />
          Section 3 · Merkle proofs (logarithmic membership verification)
        </CardTitle>
        <CardDescription className="text-gray-400">
          A Merkle tree commits to a list of items as a single 32-byte root.
          Anyone with the root can verify that a specific item is in the list
          using only ⌈log₂ N⌉ extra hashes — without seeing the rest of the
          list. This is exactly how Solana validators commit to account state
          changes per slot, and how Bitcoin SPV clients verify transactions
          without downloading full blocks.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-gray-500">
            Leaves (one per line · {leaves.length} total)
          </label>
          <textarea
            value={leavesText}
            onChange={(e) => setLeavesText(e.target.value)}
            rows={Math.min(10, Math.max(4, leaves.length))}
            className="w-full rounded-md border border-gray-700 bg-black/40 px-3 py-2 font-mono text-xs text-white outline-none focus:border-emerald-500"
          />
        </div>

        {state && (
          <>
            <div className="rounded-md border border-emerald-600/30 bg-emerald-600/5 px-4 py-3">
              <div className="text-xs uppercase tracking-wider text-emerald-300">
                Merkle root (commits to all {leaves.length} leaves)
              </div>
              <Mono className="mt-1 text-emerald-200">
                {toHex(state.tree.root)}
              </Mono>
              <div className="mt-1 text-xs text-emerald-200/70">
                Tree depth: {state.tree.levels.length - 1} · Proof size for any
                leaf: {state.proof.length}{" "}
                {state.proof.length === 1 ? "hash" : "hashes"} (
                {state.proof.length * 32} bytes)
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs uppercase tracking-wider text-gray-500">
                Pick a leaf to generate its inclusion proof
              </div>
              <div className="grid gap-2">
                {leaves.map((leaf, i) => {
                  const selected = i === state.selectedIndex;
                  return (
                    <button
                      key={`${i}-${leaf.text}`}
                      type="button"
                      onClick={() => void onSelect(i)}
                      disabled={busy}
                      className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                        selected
                          ? "border-emerald-500/60 bg-emerald-500/10 text-white"
                          : "border-gray-700 bg-gray-900/40 text-gray-300 hover:border-gray-500"
                      }`}
                    >
                      <span className="truncate font-mono">{leaf.text}</span>
                      <span className="ml-3 shrink-0 font-mono text-[11px] text-gray-500">
                        leaf #{i}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs uppercase tracking-wider text-gray-500">
                Proof path (sibling hashes from leaf #{state.selectedIndex} up
                to root)
              </div>
              <div className="space-y-1">
                {state.proof.length === 0 ? (
                  <div className="rounded-md border border-gray-700 bg-gray-900/40 px-3 py-2 text-xs text-gray-400">
                    Tree has only one leaf — no sibling hashes needed.
                  </div>
                ) : (
                  state.proof.map((step, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-md border border-gray-700 bg-gray-900/40 px-3 py-1.5 text-xs"
                    >
                      <span className="w-12 shrink-0 text-gray-500">
                        step {i + 1}
                      </span>
                      <span
                        className={`w-12 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-bold uppercase ${
                          step.position === "left"
                            ? "bg-blue-500/20 text-blue-200"
                            : "bg-purple-500/20 text-purple-200"
                        }`}
                      >
                        {step.position}
                      </span>
                      <Mono className="text-gray-300">
                        {shortHex(step.sibling, 8, 8)}
                      </Mono>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div
              className={`rounded-md border px-4 py-3 ${
                state.proofValid
                  ? "border-green-600/30 bg-green-600/5"
                  : "border-red-600/30 bg-red-600/5"
              }`}
            >
              <div className="flex items-center gap-2">
                {state.proofValid ? (
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-400" />
                )}
                <div className="text-sm font-semibold text-white">
                  Proof verification: {state.proofValid ? "VALID" : "INVALID"}
                </div>
              </div>
              <div className="mt-1 text-xs text-gray-300">
                Re-hashed leaf #{state.selectedIndex} with the {state.proof.length}{" "}
                sibling{state.proof.length === 1 ? "" : "s"} above and got the
                same root the producer published. Anyone holding only the root
                can run this check; they never need to see the other leaves.
              </div>
            </div>

            <div className="rounded-md border border-yellow-600/30 bg-yellow-600/5 px-4 py-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-yellow-200">
                <AlertTriangle className="h-4 w-4" />
                Tamper test — try to swap leaf #{state.selectedIndex} for a
                different value
              </div>
              <input
                value={tamperText}
                onChange={(e) => setTamperText(e.target.value)}
                className="w-full rounded-md border border-gray-700 bg-black/40 px-3 py-2 font-mono text-xs text-white outline-none focus:border-yellow-500"
              />
              <div className="mt-2 flex items-center gap-3">
                <Button
                  size="sm"
                  onClick={() => void onTamper()}
                  disabled={busy}
                  className="bg-yellow-600 text-white hover:bg-yellow-700"
                >
                  Verify tampered leaf against the same proof
                </Button>
                {state.tamperedValid !== null && (
                  <span
                    className={`flex items-center gap-1.5 text-xs font-semibold ${
                      state.tamperedValid ? "text-red-300" : "text-green-300"
                    }`}
                  >
                    {state.tamperedValid ? (
                      <>
                        <XCircle className="h-4 w-4" /> ATTACK SUCCEEDED
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" /> Rejected — root
                        no longer matches
                      </>
                    )}
                  </span>
                )}
              </div>
              <div className="mt-2 text-xs text-yellow-200/70">
                Even a one-character change to the leaf produces a completely
                different leaf hash, which propagates up to a different root —
                so the original proof no longer terminates at the published
                root.
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export default function VerifyPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-blue-400" />
            <h1 className="text-3xl font-bold text-white">
              Cryptographic Integrity Verification
            </h1>
          </div>
          <p className="max-w-3xl text-gray-400">
            This page is the live cryptographic proof of my project&apos;s
            core thesis: <strong className="text-white">a single Ed25519 signature</strong>{" "}
            applied to <strong className="text-white">a single SHA-256 digest</strong> of
            <strong className="text-white"> a single Solana transaction</strong> makes
            the platform fee and the user&apos;s trade an indivisible unit.
            Everything below runs entirely in your browser — no wallet, no RPC,
            no server.
          </p>
        </div>

        <div className="grid gap-6">
          <IntegrityDemo />
          <HashPropertiesDemo />
          {/*
            Merkle proof section hidden from the live demo — kept in the
            codebase (see `MerkleProofDemo` below) so we can re-enable it
            later by uncommenting the line below.
          */}
          {/* <MerkleProofDemo /> */}
        </div>
      </div>
    </div>
  );
}
