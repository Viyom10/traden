"use client";

/**
 * /receipt/[signature] — Pretty receipt for a single fee + trade transaction
 *
 * After a trade is placed, the user can land here to see a fully detailed
 * receipt: the on-chain status, the fee that was atomically charged, the
 * Drift instruction, the cryptographic proof (SHA-256 of the message), and a
 * link to Solscan.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Connection,
  ParsedTransactionWithMeta,
  ParsedInstruction,
  PartiallyDecodedInstruction,
  VersionedMessage,
  Message,
} from "@solana/web3.js";
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
  ExternalLink,
  Loader2,
  Copy,
  ReceiptText,
  Hash,
  ShieldCheck,
  Clock,
  CircleDollarSign,
  Search,
} from "lucide-react";
import { useDriftStore } from "@/stores/DriftStore";
import { getSolscanTxUrl, shortSig } from "@/lib/solscan";
import { toast } from "sonner";

const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";
const DRIFT_PROGRAM_ID = "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH";

interface FeeIxView {
  recipient: string;
  lamports: number;
}
interface TradeIxView {
  programId: string;
  ixIndex: number;
}
interface ReceiptData {
  signature: string;
  status: "success" | "failed";
  errorMessage?: string;
  slot: number;
  blockhash: string;
  blockTime: string;
  feePayerAddress: string;
  networkFeeLamports: number;
  messageBytes: number;
  messageSha256?: string;
  feeIx?: FeeIxView;
  tradeIxs: TradeIxView[];
  numInstructions: number;
}

function isParsedIx(
  ix: ParsedInstruction | PartiallyDecodedInstruction,
): ix is ParsedInstruction {
  return (ix as ParsedInstruction).parsed !== undefined;
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getMessageBytes(
  tx: ParsedTransactionWithMeta,
): Uint8Array | undefined {
  const msg = tx.transaction.message as unknown as
    | (VersionedMessage & { serialize?: () => Uint8Array })
    | (Message & { serialize?: () => Buffer });
  try {
    if (typeof (msg as { serialize?: unknown }).serialize === "function") {
      const out = (msg as { serialize: () => Uint8Array | Buffer }).serialize();
      return out instanceof Uint8Array ? out : new Uint8Array(out);
    }
  } catch {
    // ParsedTransactionWithMeta exposes a JSON-shaped message; serialize is
    // not always available. Tolerate this and skip the on-page hash.
  }
  return undefined;
}

function parseReceipt(
  tx: ParsedTransactionWithMeta,
  signature: string,
  builderAuthority: string | null,
): Omit<ReceiptData, "messageSha256"> {
  const msg = tx.transaction.message;
  const ixs = msg.instructions;

  let feeIx: FeeIxView | undefined;
  const tradeIxs: TradeIxView[] = [];

  ixs.forEach((ix, i) => {
    const programId = ix.programId.toBase58();
    if (programId === DRIFT_PROGRAM_ID) {
      tradeIxs.push({ programId, ixIndex: i });
      return;
    }
    if (programId !== SYSTEM_PROGRAM_ID) return;
    if (!isParsedIx(ix)) return;
    const parsed = ix.parsed as { type?: string; info?: Record<string, unknown> };
    if (parsed?.type !== "transfer") return;
    const dest = parsed.info?.destination as string | undefined;
    const lamports = parsed.info?.lamports as number | undefined;
    if (lamports == null) return;
    // First SystemProgram.transfer to the configured builder authority is the fee.
    if (
      !feeIx &&
      ((builderAuthority && dest === builderAuthority) || !builderAuthority)
    ) {
      feeIx = { recipient: dest ?? "", lamports };
    }
  });

  const messageBytes = getMessageBytes(tx);
  const blockhash =
    (msg as { recentBlockhash?: string }).recentBlockhash ?? "unknown";

  // Derive feePayer
  const accountKeys = (msg as { accountKeys?: Array<{ pubkey: { toBase58: () => string } }> })
    .accountKeys;
  const feePayer = accountKeys?.[0]?.pubkey.toBase58() ?? "unknown";

  return {
    signature,
    status: tx.meta?.err ? "failed" : "success",
    errorMessage: tx.meta?.err ? JSON.stringify(tx.meta.err) : undefined,
    slot: tx.slot,
    blockhash,
    blockTime: tx.blockTime
      ? new Date(tx.blockTime * 1000).toLocaleString()
      : "unknown",
    feePayerAddress: feePayer,
    networkFeeLamports: tx.meta?.fee ?? 0,
    messageBytes: messageBytes?.length ?? 0,
    feeIx,
    tradeIxs,
    numInstructions: ixs.length,
  };
}

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export default function ReceiptPage() {
  const params = useParams<{ signature: string }>();
  const signature = decodeURIComponent(params.signature);

  const drift = useDriftStore((s) => s.drift);
  const environment = useDriftStore((s) => s.environment);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ReceiptData | null>(null);

  const builderAuthority = useMemo(
    () => process.env.NEXT_PUBLIC_BUILDER_AUTHORITY || null,
    [],
  );

  const connection = useMemo(() => {
    if (drift?.driftClient?.connection) return drift.driftClient.connection;
    const url =
      environment === "mainnet-beta"
        ? process.env.NEXT_PUBLIC_SOLANA_MAINNET_RPC_ENDPOINT
        : process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_ENDPOINT;
    if (!url) return null;
    return new Connection(url, "confirmed");
  }, [drift, environment]);

  const fetchReceipt = useCallback(async () => {
    if (!connection) {
      setError("No Solana RPC connection available.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const tx = await connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });
      if (!tx) {
        setError(
          "Transaction not found on this cluster. Try switching networks or wait for confirmation.",
        );
        return;
      }
      const partial = parseReceipt(tx, signature, builderAuthority);
      const messageBytes = getMessageBytes(tx);
      const sha = messageBytes ? await sha256Hex(messageBytes) : undefined;
      setData({ ...partial, messageSha256: sha });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to fetch receipt.");
    } finally {
      setLoading(false);
    }
  }, [connection, signature, builderAuthority]);

  useEffect(() => {
    void fetchReceipt();
  }, [fetchReceipt]);

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 py-16 text-gray-400">
          <Loader2 className="h-8 w-8 animate-spin" />
          <div>Fetching receipt for {shortSig(signature)}…</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-3xl">
          <Card className="border-red-600/30 bg-red-600/5">
            <CardContent className="py-8 text-center">
              <XCircle className="mx-auto mb-3 h-10 w-10 text-red-400" />
              <h2 className="text-lg font-bold text-white">
                Could not load receipt
              </h2>
              <p className="mt-1 text-sm text-red-300">{error}</p>
              <p className="mt-3 break-all font-mono text-xs text-gray-500">
                {signature}
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Button
                  onClick={() => void fetchReceipt()}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                >
                  Retry
                </Button>
                <Link href={`/explorer`}>
                  <Button
                    variant="outline"
                    className="border-gray-700 bg-gray-800 text-white hover:bg-gray-700"
                  >
                    Open Explorer
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <Card
          className={`border ${
            data.status === "success"
              ? "border-green-600/30 bg-green-600/5"
              : "border-red-600/30 bg-red-600/5"
          }`}
        >
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-white">
                  <ReceiptText className="h-6 w-6 text-blue-400" />
                  Transaction receipt
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Atomic fee + trade · {environment}
                </CardDescription>
              </div>
              <span
                className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold uppercase ${
                  data.status === "success"
                    ? "bg-green-500/10 text-green-300"
                    : "bg-red-500/10 text-red-300"
                }`}
              >
                {data.status === "success" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                {data.status}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Signature */}
            <Field
              label="Transaction signature"
              icon={<Hash className="h-3.5 w-3.5" />}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="break-all font-mono text-sm text-white">
                  {data.signature}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-gray-300 hover:bg-gray-700"
                  onClick={() => copy(data.signature)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <a
                  href={getSolscanTxUrl(data.signature, environment)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 border-gray-700 bg-gray-800 text-white hover:bg-gray-700"
                  >
                    <ExternalLink className="mr-1 h-3 w-3" /> Solscan
                  </Button>
                </a>
              </div>
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Block / slot"
                icon={<Clock className="h-3.5 w-3.5" />}
              >
                <div className="text-sm text-white">
                  {data.slot.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">{data.blockTime}</div>
              </Field>
              <Field
                label="Network fee paid"
                icon={<CircleDollarSign className="h-3.5 w-3.5" />}
              >
                <div className="text-sm text-white">
                  {(data.networkFeeLamports / 1e9).toFixed(9)} SOL
                </div>
                <div className="text-xs text-gray-500">
                  {data.networkFeeLamports.toLocaleString()} lamports
                </div>
              </Field>
            </div>

            {/* Fee details */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Platform fee instruction
              </div>
              {data.feeIx ? (
                <div className="rounded-md border border-purple-600/30 bg-purple-600/5 p-4">
                  <div className="grid gap-2 text-sm">
                    <Row
                      k="Amount"
                      v={`${(data.feeIx.lamports / 1e9).toFixed(9)} SOL`}
                      mono
                    />
                    <Row
                      k="Recipient"
                      v={data.feeIx.recipient}
                      mono
                      copy={() => copy(data.feeIx!.recipient)}
                    />
                    <Row k="Rate" v="5 bps (0.05%) of order size" />
                    <Row
                      k="Builder authority match"
                      v={
                        builderAuthority &&
                        data.feeIx.recipient === builderAuthority
                          ? "✓ matches NEXT_PUBLIC_BUILDER_AUTHORITY"
                          : "best-effort detection"
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-yellow-600/30 bg-yellow-600/5 p-4 text-xs text-yellow-200">
                  No SystemProgram.transfer to the builder authority was
                  detected. This may be an ordinary on-chain transaction or a
                  Swift order (which executes outside the atomic-fee path).
                </div>
              )}
            </div>

            {/* Trade details */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Trade instruction
              </div>
              {data.tradeIxs.length ? (
                <div className="rounded-md border border-blue-600/30 bg-blue-600/5 p-4 text-sm">
                  <Row
                    k="Program"
                    v={`Drift v2 (${shortSig(data.tradeIxs[0].programId)})`}
                  />
                  <Row
                    k="Drift instructions"
                    v={`${data.tradeIxs.length} found in this transaction`}
                  />
                </div>
              ) : (
                <div className="rounded-md border border-gray-700 bg-black/30 p-4 text-xs text-gray-400">
                  No Drift program instruction found in the top-level message.
                </div>
              )}
            </div>

            {/* Cryptographic proof */}
            <div className="rounded-md border border-blue-600/30 bg-blue-600/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                <ShieldCheck className="h-4 w-4 text-blue-300" />
                Cryptographic proof
              </div>
              <ul className="space-y-1.5 text-sm text-gray-300">
                <li>
                  • This transaction carries{" "}
                  <span className="font-mono text-blue-300">
                    {data.numInstructions}
                  </span>{" "}
                  instructions, signed atomically with one Ed25519 signature.
                </li>
                <li>
                  • The fee instruction and the trade instruction share the
                  same compiled message ⇒ the fee cannot be removed without
                  breaking the signature.
                </li>
                <li>
                  • Recent blockhash:{" "}
                  <span className="break-all font-mono text-xs text-gray-300">
                    {data.blockhash}
                  </span>
                </li>
                {data.messageSha256 && (
                  <li>
                    • SHA-256(message) ={" "}
                    <span className="break-all font-mono text-xs text-blue-200">
                      {data.messageSha256}
                    </span>
                  </li>
                )}
              </ul>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href={`/explorer`}>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-gray-700 bg-gray-800 text-white hover:bg-gray-700"
                >
                  <Search className="mr-1.5 h-3.5 w-3.5" /> Open in Explorer
                </Button>
              </Link>
              <a
                href={getSolscanTxUrl(data.signature, environment)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  size="sm"
                  variant="outline"
                  className="border-gray-700 bg-gray-800 text-white hover:bg-gray-700"
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> View on Solscan
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}

function Row({
  k,
  v,
  mono,
  copy,
}: {
  k: string;
  v: string;
  mono?: boolean;
  copy?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800/40 py-1 last:border-0">
      <div className="text-xs text-gray-500">{k}</div>
      <div
        className={`flex items-center gap-1.5 break-all text-right text-sm text-white ${
          mono ? "font-mono" : ""
        }`}
      >
        <span>{v}</span>
        {copy && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-gray-300 hover:bg-gray-700"
            onClick={copy}
          >
            <Copy className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
