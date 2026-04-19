"use client";

/**
 * /explorer — On-chain transaction inspector
 *
 * Lets a user paste any Solana transaction signature and verify on-chain that
 * the platform fee instruction and the Drift trade instruction were committed
 * together inside a single atomic transaction. This is the on-chain
 * complement to the in-browser cryptographic proof on /verify.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Connection,
  type ParsedTransactionWithMeta,
} from "@solana/web3.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  AlertTriangle,
  FileSearch,
  ListChecks,
  Copy,
  GitBranch,
  CornerDownRight,
} from "lucide-react";
import { useDriftStore } from "@/stores/DriftStore";
import { getSolscanTxUrl, shortSig } from "@/lib/solscan";
import {
  extractCpiTree,
  formatLamports,
  DRIFT_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  type CpiTree,
  type InstructionNode,
} from "@/lib/cpi";
import { toast } from "sonner";

interface RecentRow {
  signature: string;
  feeAmount?: string;
  feeInLamports?: string;
  timestamp: string;
  source: "fee" | "trade";
}

interface ParsedView {
  signature: string;
  status: "success" | "failed";
  slot: number;
  blockTime: string;
  feePaidLamports: number;
  numInstructions: number;
  cpiTree: CpiTree;
  hasFeeInstruction: boolean;
  hasTradeInstruction: boolean;
  hasBothInSameTx: boolean;
  builderAuthority: string | null;
  errorMessage?: string;
}

function isFeeNode(node: InstructionNode, builderAuthority: string | null): boolean {
  return Boolean(
    builderAuthority &&
      node.programId === SYSTEM_PROGRAM_ID &&
      node.type === "transfer" &&
      node.info?.destination === builderAuthority,
  );
}

function isTradeNode(node: InstructionNode): boolean {
  return node.programId === DRIFT_PROGRAM_ID;
}

function parseTx(
  tx: ParsedTransactionWithMeta,
  signature: string,
  builderAuthority: string | null,
): ParsedView {
  const cpiTree = extractCpiTree(tx);

  const allNodes: InstructionNode[] = [];
  for (const top of cpiTree.topLevel) {
    allNodes.push(top);
    allNodes.push(...top.innerInstructions);
  }

  const hasFee = allNodes.some((n) => isFeeNode(n, builderAuthority));
  const hasTrade = allNodes.some(isTradeNode);

  const status: "success" | "failed" = tx.meta?.err ? "failed" : "success";

  return {
    signature,
    status,
    slot: tx.slot,
    blockTime: tx.blockTime
      ? new Date(tx.blockTime * 1000).toLocaleString()
      : "unknown",
    feePaidLamports: tx.meta?.fee ?? 0,
    numInstructions: cpiTree.topLevel.length,
    cpiTree,
    hasFeeInstruction: hasFee,
    hasTradeInstruction: hasTrade,
    hasBothInSameTx: hasFee && hasTrade,
    builderAuthority,
    errorMessage: tx.meta?.err ? JSON.stringify(tx.meta.err) : undefined,
  };
}

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export default function ExplorerPage() {
  const drift = useDriftStore((s) => s.drift);
  const environment = useDriftStore((s) => s.environment);

  const [signature, setSignature] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ParsedView | null>(null);
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

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

  const loadRecent = useCallback(async () => {
    setRecentLoading(true);
    try {
      const [feeRes, tradeRes] = await Promise.all([
        fetch("/api/fee?limit=10").then((r) =>
          r.ok ? r.json() : { fees: [] },
        ),
        fetch("/api/trade?limit=10").then((r) =>
          r.ok ? r.json() : { trades: [] },
        ),
      ]);

      const rows: RecentRow[] = [];
      for (const f of feeRes.fees ?? []) {
        if (f.txSignature) {
          rows.push({
            signature: f.txSignature,
            feeAmount: f.feeAmount,
            feeInLamports: f.feeInLamports,
            timestamp: f.timestamp,
            source: "fee",
          });
        }
      }
      for (const t of tradeRes.trades ?? []) {
        if (t.txSignature && !rows.some((r) => r.signature === t.txSignature)) {
          rows.push({
            signature: t.txSignature,
            timestamp: t.timestamp,
            source: "trade",
          });
        }
      }

      rows.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
      setRecent(rows.slice(0, 10));
    } catch (err) {
      console.warn("Failed to load recent txs", err);
    } finally {
      setRecentLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  const verify = useCallback(
    async (sig: string) => {
      const trimmed = sig.trim();
      if (!trimmed) {
        setError("Please paste a transaction signature.");
        return;
      }
      if (!connection) {
        setError("No Solana RPC connection available.");
        return;
      }
      setError(null);
      setLoading(true);
      setView(null);
      try {
        const tx = await connection.getParsedTransaction(trimmed, {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        });
        if (!tx) {
          setError(
            "Transaction not found. It may be too old, dropped, or on a different cluster.",
          );
          return;
        }
        setView(parseTx(tx, trimmed, builderAuthority));
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch transaction.",
        );
      } finally {
        setLoading(false);
      }
    },
    [connection, builderAuthority],
  );

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-3">
            <FileSearch className="h-8 w-8 text-blue-400" />
            <h1 className="text-3xl font-bold text-white">
              On-Chain Transaction Verifier
            </h1>
          </div>
          <p className="max-w-3xl text-gray-400">
            Paste any Solana signature to confirm — on-chain — that the
            platform fee and the Drift trade landed together inside a single
            atomic transaction. The page validates instruction-by-instruction
            using <span className="font-mono">connection.getParsedTransaction</span>.
          </p>
          {!builderAuthority && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-yellow-700/40 bg-yellow-700/10 px-3 py-2 text-xs text-yellow-200">
              <AlertTriangle className="h-4 w-4" />
              <span>
                <span className="font-mono">NEXT_PUBLIC_BUILDER_AUTHORITY</span>{" "}
                is not set in <span className="font-mono">.env.local</span>;
                fee-instruction detection will be best-effort.
              </span>
            </div>
          )}
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-white">Verify a transaction</CardTitle>
            <CardDescription className="text-gray-400">
              Enter a base58 signature ({environment}).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void verify(signature);
              }}
            >
              <Input
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="3v8a…   (paste full transaction signature)"
                className="flex-1 min-w-[260px] border-gray-700 bg-black/40 font-mono text-sm text-white"
              />
              <Button
                type="submit"
                disabled={loading}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Search className="mr-1.5 h-4 w-4" /> Verify
                  </>
                )}
              </Button>
            </form>

            {error && (
              <div className="mt-3 flex items-center gap-2 rounded-md border border-red-700/40 bg-red-700/10 px-3 py-2 text-sm text-red-300">
                <XCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {view && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-white">Verification result</CardTitle>
                  <CardDescription className="text-gray-400">
                    Slot {view.slot.toLocaleString()} · {view.blockTime}
                  </CardDescription>
                </div>
                <a
                  href={getSolscanTxUrl(view.signature, environment)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-700 bg-gray-800 text-white hover:bg-gray-700"
                  >
                    <ExternalLink className="mr-1.5 h-4 w-4" /> View on Solscan
                  </Button>
                </a>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-md border border-gray-700 bg-black/30 p-3">
                  <div className="text-xs text-gray-500">Status</div>
                  <div
                    className={`mt-1 text-lg font-bold ${
                      view.status === "success"
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {view.status === "success" ? "Confirmed" : "Failed"}
                  </div>
                  {view.errorMessage && (
                    <div className="mt-1 text-xs text-red-300">
                      {view.errorMessage}
                    </div>
                  )}
                </div>
                <div className="rounded-md border border-gray-700 bg-black/30 p-3">
                  <div className="text-xs text-gray-500">Network fee</div>
                  <div className="mt-1 text-lg font-bold text-white">
                    {(view.feePaidLamports / 1e9).toFixed(9)} SOL
                  </div>
                  <div className="text-xs text-gray-500">
                    {view.feePaidLamports.toLocaleString()} lamports
                  </div>
                </div>
                <div className="rounded-md border border-gray-700 bg-black/30 p-3">
                  <div className="text-xs text-gray-500">Instructions</div>
                  <div className="mt-1 text-lg font-bold text-white">
                    {view.numInstructions}
                  </div>
                  <div className="text-xs text-gray-500">
                    in the top-level message
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                  <ListChecks className="h-4 w-4 text-purple-400" /> Atomic-fee
                  enforcement check
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  <Pill ok={view.hasFeeInstruction} label="Fee instruction found" />
                  <Pill ok={view.hasTradeInstruction} label="Trade instruction found" />
                  <Pill
                    ok={view.hasBothInSameTx}
                    label="Both in the same atomic tx"
                  />
                </div>
                {view.hasBothInSameTx && (
                  <div className="mt-2 text-xs text-green-300">
                    ✓ This transaction satisfies the atomic-fee enforcement
                    contract: the fee transfer and the Drift order were
                    cryptographically bound by a single Ed25519 signature.
                  </div>
                )}
              </div>

              <div className="mt-6">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                  <GitBranch className="h-4 w-4 text-emerald-400" />
                  Instruction & CPI tree
                </div>
                <div className="mb-3 grid gap-2 text-xs text-gray-400 md:grid-cols-3">
                  <div className="rounded-md border border-gray-800 bg-black/30 px-3 py-2">
                    <span className="text-gray-500">Top-level instructions:</span>{" "}
                    <span className="font-mono text-white">
                      {view.cpiTree.topLevel.length}
                    </span>
                  </div>
                  <div className="rounded-md border border-gray-800 bg-black/30 px-3 py-2">
                    <span className="text-gray-500">CPI hops:</span>{" "}
                    <span className="font-mono text-white">
                      {view.cpiTree.totalCpiHops}
                    </span>
                  </div>
                  <div className="rounded-md border border-gray-800 bg-black/30 px-3 py-2">
                    <span className="text-gray-500">Programs touched:</span>{" "}
                    <span className="font-mono text-white">
                      {view.cpiTree.uniqueProgramsTouched.length}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  {view.cpiTree.topLevel.map((node, i) => (
                    <CpiNodeRow
                      key={i}
                      node={node}
                      index={i}
                      depth={0}
                      builderAuthority={view.builderAuthority}
                    />
                  ))}
                </div>
                <div className="mt-3 text-[11px] text-gray-500">
                  Indented rows are{" "}
                  <span className="font-semibold text-emerald-300">
                    cross-program invocations
                  </span>{" "}
                  — programs that the parent instruction called from inside the
                  same atomic transaction (read from{" "}
                  <span className="font-mono">meta.innerInstructions</span>).
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white">Recent transactions</CardTitle>
                <CardDescription className="text-gray-400">
                  Most recent fees and trades recorded in my database. Click a
                  signature to verify it on-chain.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void loadRecent()}
                disabled={recentLoading}
                className="border-gray-700 bg-gray-800 text-white hover:bg-gray-700"
              >
                {recentLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Refresh"
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-500">
                No recorded transactions yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 text-left text-xs uppercase tracking-wider text-gray-500">
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Source</th>
                      <th className="py-2 pr-4">Fee</th>
                      <th className="py-2 pr-4">Signature</th>
                      <th className="py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300">
                    {recent.map((r) => (
                      <tr
                        key={r.signature}
                        className="border-b border-gray-800 last:border-0"
                      >
                        <td className="py-2 pr-4">
                          {new Date(r.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2 pr-4">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              r.source === "fee"
                                ? "bg-purple-500/15 text-purple-300"
                                : "bg-blue-500/15 text-blue-300"
                            }`}
                          >
                            {r.source}
                          </span>
                        </td>
                        <td className="py-2 pr-4 font-mono">
                          {r.feeAmount
                            ? `${parseFloat(r.feeAmount).toFixed(9)} SOL`
                            : "—"}
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs">
                          {shortSig(r.signature)}
                        </td>
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-blue-300 hover:bg-blue-500/10"
                              onClick={() => {
                                setSignature(r.signature);
                                void verify(r.signature);
                              }}
                            >
                              <Search className="mr-1 h-3 w-3" /> Verify
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-gray-300 hover:bg-gray-700"
                              onClick={() => copy(r.signature)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <a
                              href={getSolscanTxUrl(r.signature, environment)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-gray-300 hover:bg-gray-700"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CpiNodeRow({
  node,
  index,
  depth,
  builderAuthority,
}: {
  node: InstructionNode;
  index: number;
  depth: number;
  builderAuthority: string | null;
}) {
  const isFee = isFeeNode(node, builderAuthority);
  const isTrade = isTradeNode(node);
  const indentPx = depth * 20;
  return (
    <div>
      <div
        className={`flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-xs ${
          depth === 0
            ? "border-gray-700 bg-gray-900/50"
            : "border-emerald-800/40 bg-emerald-950/20"
        }`}
        style={{ marginLeft: indentPx }}
      >
        {depth > 0 && (
          <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
        )}
        <span className="font-mono text-[10px] text-gray-500">
          {depth === 0 ? `#${index}` : `cpi`}
        </span>
        <span className="font-medium text-white">{node.programLabel}</span>
        <span className="font-mono text-[10px] text-gray-500">
          {shortSig(node.programId)}
        </span>
        {node.type && (
          <span className="rounded bg-gray-800 px-1.5 py-0.5 font-mono text-[10px] text-gray-300">
            {node.type}
          </span>
        )}
        {node.info?.lamports !== undefined && (
          <span className="font-mono text-[10px] text-gray-300">
            {formatLamports(node.info.lamports)}
            {node.info.destination && (
              <span className="text-gray-500">
                {" "}
                → {shortSig(node.info.destination)}
              </span>
            )}
          </span>
        )}
        {node.info?.amount && !node.info.lamports && (
          <span className="font-mono text-[10px] text-gray-300">
            amount {node.info.amount}
          </span>
        )}
        {node.rawData && (
          <span className="font-mono text-[10px] text-gray-500">
            {node.rawData.length} chars (binary)
          </span>
        )}
        {isFee && (
          <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-purple-300">
            fee
          </span>
        )}
        {isTrade && (
          <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-300">
            trade
          </span>
        )}
      </div>
      {node.innerInstructions.length > 0 && (
        <div className="mt-1 space-y-1">
          {node.innerInstructions.map((child, i) => (
            <CpiNodeRow
              key={i}
              node={child}
              index={i}
              depth={depth + 1}
              builderAuthority={builderAuthority}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
        ok
          ? "border-green-600/30 bg-green-600/5 text-green-300"
          : "border-red-600/30 bg-red-600/5 text-red-300"
      }`}
    >
      {ok ? (
        <CheckCircle2 className="h-4 w-4" />
      ) : (
        <XCircle className="h-4 w-4" />
      )}
      <span>{label}</span>
    </div>
  );
}
