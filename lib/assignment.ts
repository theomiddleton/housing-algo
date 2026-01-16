/**
 * Global assignment solver for optimal room allocation.
 *
 * This module solves the assignment problem (maximum-weight bipartite matching)
 * to find the globally optimal allocation of people to rooms.
 *
 * Key features:
 * - Hungarian algorithm for optimal O(n^3) solution
 * - Deterministic tie-breaking via epsilon perturbation
 * - ID-based mapping (not index-based) for input-order independence
 */

import type { Person, Room, PersonMeta } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Result of the assignment solver.
 */
export type AssignmentResult = {
  /** Mapping from personId to roomId */
  assignment: Map<string, string>;
  /** Total score of the optimal assignment */
  totalScore: number;
};

/**
 * Options for the assignment solver.
 */
export type AssignmentOptions = {
  /**
   * Enable deterministic tie-breaking via epsilon perturbation.
   * When enabled, adds tiny deterministic values based on IDs to break ties.
   * Default: true
   */
  deterministicTieBreak?: boolean;
  /**
   * Epsilon value for tie-breaking perturbation.
   * Should be small enough to never change real decisions.
   * Default: 1e-9
   */
  epsilon?: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Stable Hash Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes a stable hash value for a string.
 * Uses FNV-1a algorithm for good distribution and simplicity.
 * Returns a value in [0, 1) for use as a tie-breaker.
 */
const fnv1aHash = (str: string): number => {
  const FNV_OFFSET_BASIS = 2166136261;
  const FNV_PRIME = 16777619;

  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }

  // Convert to unsigned 32-bit integer, then normalize to [0, 1)
  return (hash >>> 0) / 0xffffffff;
};

/**
 * Computes a deterministic tie-breaker value for a (personId, roomId) pair.
 * The value is in [0, 1) and is used for epsilon perturbation.
 */
export const computeTieBreaker = (personId: string, roomId: string): number => {
  // Combine IDs in a consistent way (sorted to ensure symmetry isn't needed)
  const combined = `${personId}:${roomId}`;
  return fnv1aHash(combined);
};

// ─────────────────────────────────────────────────────────────────────────────
// Score Matrix with Epsilon Perturbation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a perturbed score matrix for the assignment solver.
 *
 * The perturbation adds tiny deterministic values based on IDs to break ties:
 * s'(p,r) = s(p,r) + epsilon * t(p,r)
 *
 * This ensures that even when real scores are identical, the solver will
 * produce the same result regardless of input ordering.
 *
 * @param scores - Original score matrix [personIndex][roomIndex]
 * @param people - Array of people (for IDs)
 * @param rooms - Array of rooms (for IDs)
 * @param epsilon - Perturbation magnitude (default: 1e-9)
 * @returns Perturbed score matrix
 */
export const buildPerturbedScores = (
  scores: number[][],
  people: Person[],
  rooms: Room[],
  epsilon: number = 1e-9,
): number[][] => {
  return scores.map((personScores, personIndex) => {
    const personId = people[personIndex]!.id;
    return personScores.map((score, roomIndex) => {
      const roomId = rooms[roomIndex]!.id;
      const tieBreaker = computeTieBreaker(personId, roomId);
      return score + epsilon * tieBreaker;
    });
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Hungarian Algorithm
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Solves the assignment problem using the Hungarian algorithm.
 *
 * Given a cost matrix (or in our case, benefit matrix), finds the optimal
 * assignment that maximizes total benefit.
 *
 * Time complexity: O(n^3)
 * Space complexity: O(n^2)
 *
 * This implementation handles rectangular matrices where #people <= #rooms.
 *
 * @param matrix - Score matrix [personIndex][roomIndex]
 * @returns Array where result[personIndex] = roomIndex
 */
export const hungarian = (matrix: number[][]): number[] => {
  const n = matrix.length; // Number of people (rows)
  const m = matrix[0]?.length ?? 0; // Number of rooms (columns)

  if (n === 0 || m === 0) {
    return [];
  }

  if (n > m) {
    throw new Error(
      `Hungarian algorithm requires #people <= #rooms. Got ${n} people and ${m} rooms.`,
    );
  }

  // Convert to maximization problem by negating (algorithm minimizes)
  // We'll work with a square matrix padded with zeros if needed
  const size = Math.max(n, m);
  const cost: number[][] = Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => {
      if (i < n && j < m) {
        // Negate to convert max to min problem
        return -matrix[i]![j]!;
      }
      return 0; // Padding for rectangular matrices
    }),
  );

  // Hungarian algorithm state
  const u = new Array<number>(size + 1).fill(0); // Row potentials
  const v = new Array<number>(size + 1).fill(0); // Column potentials
  const p = new Array<number>(size + 1).fill(0); // p[j] = row assigned to column j
  const way = new Array<number>(size + 1).fill(0); // Augmenting path

  for (let i = 1; i <= size; i++) {
    // Start with row i (1-indexed for convenience)
    p[0] = i;
    let j0 = 0; // Current column in the augmenting path

    const minv = new Array<number>(size + 1).fill(Infinity);
    const used = new Array<boolean>(size + 1).fill(false);

    // Find augmenting path
    do {
      used[j0] = true;
      const i0 = p[j0]!;
      let delta = Infinity;
      let j1 = 0;

      for (let j = 1; j <= size; j++) {
        if (!used[j]) {
          // Reduced cost
          const cur = cost[i0! - 1]![j - 1]! - u[i0!]! - v[j]!;
          if (cur < minv[j]!) {
            minv[j] = cur;
            way[j] = j0;
          }
          if (minv[j]! < delta) {
            delta = minv[j]!;
            j1 = j;
          }
        }
      }

      // Update potentials
      for (let j = 0; j <= size; j++) {
        if (used[j]) {
          u[p[j]!]! += delta;
          v[j]! -= delta;
        } else {
          minv[j]! -= delta;
        }
      }

      j0 = j1;
    } while (p[j0]! !== 0);

    // Reconstruct augmenting path
    while (j0 !== 0) {
      const j1 = way[j0]!;
      p[j0] = p[j1]!;
      j0 = j1;
    }
  }

  // Build result: for each person (row), find their assigned room (column)
  const result = new Array<number>(n).fill(-1);
  for (let j = 1; j <= m; j++) {
    const personIndex = p[j]! - 1;
    if (personIndex >= 0 && personIndex < n) {
      result[personIndex] = j - 1;
    }
  }

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Assignment Solver
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Solves the room assignment problem optimally.
 *
 * Uses the Hungarian algorithm to find the maximum-weight bipartite matching
 * between people and rooms. Optionally applies epsilon perturbation for
 * deterministic tie-breaking.
 *
 * The result is an ID-based mapping, not index-based, ensuring that the
 * output is independent of input array ordering.
 *
 * @param scores - Score matrix [personIndex][roomIndex]
 * @param people - Array of people
 * @param rooms - Array of rooms
 * @param options - Solver options
 * @returns Assignment result with ID-based mapping
 */
export const solveAssignment = (
  scores: number[][],
  people: Person[],
  rooms: Room[],
  options: AssignmentOptions = {},
): AssignmentResult => {
  const { deterministicTieBreak = true, epsilon = 1e-9 } = options;

  // Validate inputs
  if (people.length === 0) {
    return { assignment: new Map(), totalScore: 0 };
  }

  if (people.length > rooms.length) {
    throw new Error(
      `Cannot assign ${people.length} people to ${rooms.length} rooms. Need at least as many rooms as people.`,
    );
  }

  // Apply epsilon perturbation for deterministic tie-breaking
  const workingScores = deterministicTieBreak
    ? buildPerturbedScores(scores, people, rooms, epsilon)
    : scores;

  // Solve using Hungarian algorithm
  const indexAssignment = hungarian(workingScores);

  // Build ID-based result and calculate total score (using original scores)
  const assignment = new Map<string, string>();
  let totalScore = 0;

  for (let personIndex = 0; personIndex < people.length; personIndex++) {
    const roomIndex = indexAssignment[personIndex]!;
    const personId = people[personIndex]!.id;
    const roomId = rooms[roomIndex]!.id;

    assignment.set(personId, roomId);
    totalScore += scores[personIndex]![roomIndex]!;
  }

  return { assignment, totalScore };
};

// ─────────────────────────────────────────────────────────────────────────────
// Legacy Compatibility Layer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Legacy assignment function that returns index-based results.
 *
 * This provides backward compatibility with the existing index.ts interface
 * while using the new optimal solver under the hood.
 *
 * @deprecated Use solveAssignment for new code
 */
export const assignRooms = (
  scores: number[][],
  people: Person[],
  rooms: Room[],
  _peopleMeta?: PersonMeta[],
): { assignment: number[]; totalScore: number } => {
  const result = solveAssignment(scores, people, rooms);

  // Convert ID-based map back to index-based array
  const assignment = people.map((person) => {
    const roomId = result.assignment.get(person.id);
    if (!roomId) {
      throw new Error(`No room assigned to person ${person.id}`);
    }
    return rooms.findIndex((room) => room.id === roomId);
  });

  return { assignment, totalScore: result.totalScore };
};

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonicalizes an ID to ensure consistent comparison.
 * Converts to lowercase and trims whitespace.
 */
export const canonicalizeId = (id: string): string => {
  return id.toLowerCase().trim();
};

/**
 * Validates that all person and room IDs are unique.
 */
export const validateUniqueIds = (
  people: Person[],
  rooms: Room[],
): { valid: boolean; duplicates: string[] } => {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const person of people) {
    const canonical = canonicalizeId(person.id);
    if (seen.has(`person:${canonical}`)) {
      duplicates.push(`person:${person.id}`);
    }
    seen.add(`person:${canonical}`);
  }

  for (const room of rooms) {
    const canonical = canonicalizeId(room.id);
    if (seen.has(`room:${canonical}`)) {
      duplicates.push(`room:${room.id}`);
    }
    seen.add(`room:${canonical}`);
  }

  return { valid: duplicates.length === 0, duplicates };
};
