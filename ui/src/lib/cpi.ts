/**
 * Cross-Program Invocation (CPI) helpers.
 *
 * Solana lets one program invoke another inside the same atomic transaction
 * (a "Cross-Program Invocation"). When a user-submitted instruction calls
 * other programs, those nested calls land in the transaction metadata as
 * `meta.innerInstructions`, indexed by the parent instruction they belong
 * to. This module turns that flat metadata into a renderable tree and gives
 * each program a friendly label.
 *
 * Used by:
 *   • `/explorer` — to render the real CPI graph for any signature.
 *   • Anywhere else I want to inspect what programs a transaction
 *     ultimately touched (e.g. future analytics).
 *
 * No RPC call is made here — callers pass in a `ParsedTransactionWithMeta`
 * they have already fetched via `connection.getParsedTransaction`.
 */

import type {
  ParsedInstruction,
  ParsedTransactionWithMeta,
  PartiallyDecodedInstruction,
} from "@solana/web3.js";

export const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";
export const DRIFT_PROGRAM_ID = "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH";
export const SPL_TOKEN_PROGRAM_ID =
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const SPL_TOKEN_2022_PROGRAM_ID =
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export const ASSOCIATED_TOKEN_PROGRAM_ID =
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
export const COMPUTE_BUDGET_PROGRAM_ID =
  "ComputeBudget111111111111111111111111111111";
export const ADDRESS_LOOKUP_TABLE_PROGRAM_ID =
  "AddressLookupTab1e1111111111111111111111111";
export const PYTH_PROGRAM_ID = "FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH";
export const SWITCHBOARD_PROGRAM_ID =
  "SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f";

export function programLabel(programId: string): string {
  switch (programId) {
    case SYSTEM_PROGRAM_ID:
      return "System Program";
    case DRIFT_PROGRAM_ID:
      return "Drift v2";
    case SPL_TOKEN_PROGRAM_ID:
      return "SPL Token";
    case SPL_TOKEN_2022_PROGRAM_ID:
      return "SPL Token 2022";
    case ASSOCIATED_TOKEN_PROGRAM_ID:
      return "Associated Token";
    case COMPUTE_BUDGET_PROGRAM_ID:
      return "Compute Budget";
    case ADDRESS_LOOKUP_TABLE_PROGRAM_ID:
      return "Address Lookup Table";
    case PYTH_PROGRAM_ID:
      return "Pyth Oracle";
    case SWITCHBOARD_PROGRAM_ID:
      return "Switchboard Oracle";
    default:
      return "Unknown program";
  }
}

export function isParsedInstruction(
  ix: ParsedInstruction | PartiallyDecodedInstruction,
): ix is ParsedInstruction {
  return (ix as ParsedInstruction).parsed !== undefined;
}

/** A flattened, render-friendly view of a single instruction. */
export interface InstructionNode {
  programId: string;
  programLabel: string;
  /** Parsed instruction subtype (e.g. "transfer", "createAccount"). */
  type?: string;
  /** Subset of useful fields lifted out of `parsed.info`. */
  info?: {
    source?: string;
    destination?: string;
    lamports?: number;
    amount?: string;
    authority?: string;
  };
  /** Raw base58 instruction data when the instruction wasn't fully parsed. */
  rawData?: string;
  /** CPIs invoked by this instruction (recursively flattened). */
  innerInstructions: InstructionNode[];
}

/** A whole transaction's CPI tree. */
export interface CpiTree {
  /** Top-level instructions (the ones the user actually signed for). */
  topLevel: InstructionNode[];
  /** Total CPI hops across the whole tx. */
  totalCpiHops: number;
  /** Distinct program ids touched, including via CPI. */
  uniqueProgramsTouched: string[];
}

function toNode(
  ix: ParsedInstruction | PartiallyDecodedInstruction,
): InstructionNode {
  const programId = ix.programId.toBase58();
  const node: InstructionNode = {
    programId,
    programLabel: programLabel(programId),
    innerInstructions: [],
  };
  if (isParsedInstruction(ix)) {
    const parsed = ix.parsed as {
      type?: string;
      info?: Record<string, unknown>;
    };
    node.type = parsed?.type;
    const info = parsed?.info ?? {};
    node.info = {
      source: info.source as string | undefined,
      destination: info.destination as string | undefined,
      lamports: info.lamports as number | undefined,
      amount: info.amount as string | undefined,
      authority: info.authority as string | undefined,
    };
  } else {
    node.rawData = ix.data;
  }
  return node;
}

/**
 * Build a renderable CPI tree from a `ParsedTransactionWithMeta`.
 *
 * Solana stores inner instructions as a flat list keyed by the parent
 * instruction's index. I re-attach them so that each parent can render
 * its children inline.
 */
export function extractCpiTree(tx: ParsedTransactionWithMeta): CpiTree {
  const topInstructions = tx.transaction.message.instructions;
  const inner = tx.meta?.innerInstructions ?? [];
  const innerByParent = new Map<number, InstructionNode[]>();
  for (const group of inner) {
    innerByParent.set(group.index, group.instructions.map(toNode));
  }

  let totalCpiHops = 0;
  const uniquePrograms = new Set<string>();

  const topLevel: InstructionNode[] = topInstructions.map((ix, i) => {
    const node = toNode(ix);
    uniquePrograms.add(node.programId);
    const children = innerByParent.get(i) ?? [];
    node.innerInstructions = children;
    totalCpiHops += children.length;
    for (const child of children) uniquePrograms.add(child.programId);
    return node;
  });

  return {
    topLevel,
    totalCpiHops,
    uniqueProgramsTouched: Array.from(uniquePrograms),
  };
}

/** Short SOL display for a lamports number. */
export function formatLamports(lamports: number | undefined): string {
  if (lamports === undefined) return "—";
  return `${(lamports / 1e9).toFixed(9)} SOL`;
}
