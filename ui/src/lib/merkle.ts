/**
 * SHA-256 Merkle tree.
 *
 * Pure-browser, dependency-free. Uses the WebCrypto SubtleCrypto API for
 * hashing so it runs identically in the browser, in service workers, and in
 * modern Node (>= 16) which exposes `globalThis.crypto.subtle`.
 *
 * Why this exists:
 *   • Powers the Merkle-proof demo on `/verify`.
 *   • Demonstrates the same primitive Solana validators use to commit to
 *     bank-hash account state and to bundle vote attestations.
 *
 * Conventions:
 *   • Leaves are arbitrary `Uint8Array`s. I hash each leaf once before
 *     placing it in the tree (this is the "leaf hash"), to avoid the
 *     well-known second-preimage attack where an internal node's pre-image
 *     could be forged as a leaf.
 *   • Internal nodes are `H(left || right)`. If a level has an odd number
 *     of nodes, the last node is duplicated (Bitcoin's convention).
 *   • A proof is an array of `{ sibling, position }` entries from leaf
 *     up to (but not including) the root. `position` says whether the
 *     sibling sits to the left or the right of the running hash.
 */

export interface MerkleProofStep {
  sibling: Uint8Array;
  position: "left" | "right";
}

export interface MerkleTree {
  /** Hash of every leaf (level 0). Length == number of input leaves. */
  leafHashes: Uint8Array[];
  /** Tree levels from bottom (level 0 = leaves) up to top (root). */
  levels: Uint8Array[][];
  /** The 32-byte root hash. */
  root: Uint8Array;
}

const LEAF_PREFIX = new Uint8Array([0x00]);
const NODE_PREFIX = new Uint8Array([0x01]);

async function sha256(...parts: Uint8Array[]): Promise<Uint8Array> {
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    buf.set(p, offset);
    offset += p.byteLength;
  }
  // Re-wrap to satisfy the strict BufferSource signature on some DOM lib variants.
  const view = new Uint8Array(buf.byteLength);
  view.set(buf);
  const digest = await crypto.subtle.digest("SHA-256", view.buffer);
  return new Uint8Array(digest);
}

/** Hash a single leaf with the LEAF_PREFIX domain separator. */
export async function hashLeaf(data: Uint8Array): Promise<Uint8Array> {
  return sha256(LEAF_PREFIX, data);
}

/** Hash an internal node with the NODE_PREFIX domain separator. */
export async function hashNode(
  left: Uint8Array,
  right: Uint8Array,
): Promise<Uint8Array> {
  return sha256(NODE_PREFIX, left, right);
}

/**
 * Build a Merkle tree from an ordered list of leaves.
 * Returns the levels and the 32-byte root.
 *
 * Throws if `leaves` is empty (an empty Merkle tree has no defined root).
 */
export async function buildMerkleTree(
  leaves: Uint8Array[],
): Promise<MerkleTree> {
  if (leaves.length === 0) {
    throw new Error("Cannot build a Merkle tree with zero leaves");
  }

  const leafHashes = await Promise.all(leaves.map(hashLeaf));
  const levels: Uint8Array[][] = [leafHashes];

  let current = leafHashes;
  while (current.length > 1) {
    const next: Uint8Array[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      // Duplicate the last node when the level has an odd count.
      const right = i + 1 < current.length ? current[i + 1] : current[i];
      next.push(await hashNode(left, right));
    }
    levels.push(next);
    current = next;
  }

  return { leafHashes, levels, root: current[0] };
}

/**
 * Generate a Merkle inclusion proof for the leaf at `index`.
 * Returns the path of sibling hashes from leaf upward.
 */
export function getProof(tree: MerkleTree, index: number): MerkleProofStep[] {
  if (index < 0 || index >= tree.leafHashes.length) {
    throw new RangeError(
      `index ${index} out of range (have ${tree.leafHashes.length} leaves)`,
    );
  }

  const proof: MerkleProofStep[] = [];
  let idx = index;
  for (let level = 0; level < tree.levels.length - 1; level++) {
    const nodes = tree.levels[level];
    const isRight = idx % 2 === 1;
    const siblingIdx = isRight ? idx - 1 : idx + 1;
    // If I'm on the right, the sibling is to my left, and vice versa.
    // For odd-count levels with the duplicate-last rule, the missing sibling
    // is the node itself.
    const sibling =
      siblingIdx < nodes.length ? nodes[siblingIdx] : nodes[idx];
    proof.push({ sibling, position: isRight ? "left" : "right" });
    idx = Math.floor(idx / 2);
  }
  return proof;
}

/**
 * Verify a Merkle proof against a known root.
 *
 * `leaf` is the raw leaf bytes (NOT pre-hashed) — I apply the LEAF_PREFIX
 * for you so callers can't accidentally feed an internal node hash as a
 * "leaf" and forge inclusion.
 */
export async function verifyProof(
  leaf: Uint8Array,
  proof: MerkleProofStep[],
  root: Uint8Array,
): Promise<boolean> {
  let running = await hashLeaf(leaf);
  for (const step of proof) {
    running =
      step.position === "left"
        ? await hashNode(step.sibling, running)
        : await hashNode(running, step.sibling);
  }
  if (running.length !== root.length) return false;
  let diff = 0;
  for (let i = 0; i < root.length; i++) diff |= running[i] ^ root[i];
  return diff === 0;
}

/** Convert a hash to a short hex preview for UI display. */
export function shortHex(bytes: Uint8Array, head = 6, tail = 4): string {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (hex.length <= (head + tail) * 2) return hex;
  return `${hex.slice(0, head * 2)}…${hex.slice(-tail * 2)}`;
}

/** Convert a hash to its full hex string. */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
