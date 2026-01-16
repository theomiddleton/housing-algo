import { test, expect, describe } from "bun:test";
import {
  hungarian,
  solveAssignment,
  assignRooms,
  computeTieBreaker,
  buildPerturbedScores,
  validateUniqueIds,
  canonicalizeId,
} from "./assignment";
import type { Person, Room } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const createPerson = (id: string, name?: string): Person => ({
  id,
  name: name ?? id,
  gender: "other",
  foundHouse: false,
  handledAgent: false,
  attendedViewing: false,
  currentBedType: "double",
  relationship: { status: "single", partnerLocation: "none" },
  cooksOften: false,
});

const createRoom = (id: string, name?: string): Room => ({
  id,
  name: name ?? id,
  sizeSqm: 15,
  windows: 2,
  attractiveness: 5,
  bedType: "double",
  floor: 1,
  isFrontFacing: false,
  noise: 3,
  storage: 5,
  sunlight: 5,
  nearKitchen: false,
  ensuite: false,
});

// ─────────────────────────────────────────────────────────────────────────────
// Hungarian Algorithm Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("hungarian algorithm", () => {
  test("handles empty matrix", () => {
    const result = hungarian([]);
    expect(result).toEqual([]);
  });

  test("handles single element", () => {
    const result = hungarian([[5]]);
    expect(result).toEqual([0]);
  });

  test("finds optimal assignment for 2x2 matrix", () => {
    // Person 0: prefers Room 1 (score 10 vs 1)
    // Person 1: prefers Room 0 (score 10 vs 1)
    // Optimal: Person 0 -> Room 1, Person 1 -> Room 0 (total: 20)
    const scores = [
      [1, 10],
      [10, 1],
    ];
    const result = hungarian(scores);
    expect(result[0]).toBe(1);
    expect(result[1]).toBe(0);
  });

  test("finds optimal assignment for 3x3 matrix", () => {
    const scores = [
      [3, 5, 2],
      [7, 2, 4],
      [1, 6, 3],
    ];
    // Optimal: Person 0 -> Room 1 (5), Person 1 -> Room 0 (7), Person 2 -> Room 2 (3) = 15
    // Or: Person 0 -> Room 1 (5), Person 1 -> Room 2 (4), Person 2 -> Room 0 (1) = 10
    const result = hungarian(scores);
    const totalScore =
      scores[0]![result[0]!]! +
      scores[1]![result[1]!]! +
      scores[2]![result[2]!]!;
    expect(totalScore).toBe(15);
  });

  test("handles rectangular matrix (more rooms than people)", () => {
    const scores = [
      [1, 10, 2],
      [3, 2, 8],
    ];
    // Optimal: Person 0 -> Room 1 (10), Person 1 -> Room 2 (8) = 18
    const result = hungarian(scores);
    expect(result.length).toBe(2);
    const totalScore = scores[0]![result[0]!]! + scores[1]![result[1]!]!;
    expect(totalScore).toBe(18);
  });

  test("handles negative scores", () => {
    const scores = [
      [-5, -2],
      [-3, -8],
    ];
    // Optimal: Person 0 -> Room 1 (-2), Person 1 -> Room 0 (-3) = -5
    const result = hungarian(scores);
    const totalScore = scores[0]![result[0]!]! + scores[1]![result[1]!]!;
    expect(totalScore).toBe(-5);
  });

  test("handles equal scores", () => {
    const scores = [
      [5, 5],
      [5, 5],
    ];
    const result = hungarian(scores);
    // Both rooms should be assigned
    expect(result[0]).not.toBe(result[1]);
    expect([0, 1]).toContain(result[0]!);
    expect([0, 1]).toContain(result[1]!);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tie-Breaker Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("computeTieBreaker", () => {
  test("returns value between 0 and 1", () => {
    const value = computeTieBreaker("alice", "room_1");
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });

  test("is deterministic", () => {
    const value1 = computeTieBreaker("alice", "room_1");
    const value2 = computeTieBreaker("alice", "room_1");
    expect(value1).toBe(value2);
  });

  test("produces different values for different pairs", () => {
    const values = new Set([
      computeTieBreaker("alice", "room_1"),
      computeTieBreaker("alice", "room_2"),
      computeTieBreaker("bob", "room_1"),
      computeTieBreaker("bob", "room_2"),
    ]);
    expect(values.size).toBe(4);
  });
});

describe("buildPerturbedScores", () => {
  test("adds small perturbations to scores", () => {
    const people = [createPerson("alice"), createPerson("bob")];
    const rooms = [createRoom("room_1"), createRoom("room_2")];
    const scores = [
      [10, 20],
      [15, 25],
    ];

    const perturbed = buildPerturbedScores(scores, people, rooms, 1e-9);

    // Perturbations should be very small
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const diff = Math.abs(perturbed[i]![j]! - scores[i]![j]!);
        expect(diff).toBeLessThan(1e-8);
        expect(diff).toBeGreaterThan(0);
      }
    }
  });

  test("perturbations are deterministic", () => {
    const people = [createPerson("alice"), createPerson("bob")];
    const rooms = [createRoom("room_1"), createRoom("room_2")];
    const scores = [
      [10, 20],
      [15, 25],
    ];

    const perturbed1 = buildPerturbedScores(scores, people, rooms);
    const perturbed2 = buildPerturbedScores(scores, people, rooms);

    expect(perturbed1).toEqual(perturbed2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// solveAssignment Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("solveAssignment", () => {
  test("returns empty result for empty inputs", () => {
    const result = solveAssignment([], [], []);
    expect(result.assignment.size).toBe(0);
    expect(result.totalScore).toBe(0);
  });

  test("finds optimal assignment and returns ID-based mapping", () => {
    const people = [createPerson("alice"), createPerson("bob")];
    const rooms = [createRoom("room_1"), createRoom("room_2")];
    const scores = [
      [1, 10], // Alice prefers room_2
      [10, 1], // Bob prefers room_1
    ];

    const result = solveAssignment(scores, people, rooms);

    expect(result.assignment.get("alice")).toBe("room_2");
    expect(result.assignment.get("bob")).toBe("room_1");
    expect(result.totalScore).toBe(20);
  });

  test("throws if more people than rooms", () => {
    const people = [
      createPerson("alice"),
      createPerson("bob"),
      createPerson("charlie"),
    ];
    const rooms = [createRoom("room_1"), createRoom("room_2")];
    const scores = [
      [1, 2],
      [3, 4],
      [5, 6],
    ];

    expect(() => solveAssignment(scores, people, rooms)).toThrow();
  });

  test("deterministic tie-breaking produces consistent results", () => {
    const people = [createPerson("alice"), createPerson("bob")];
    const rooms = [createRoom("room_1"), createRoom("room_2")];
    // All scores identical - pure tie-breaking scenario
    const scores = [
      [10, 10],
      [10, 10],
    ];

    const result1 = solveAssignment(scores, people, rooms);
    const result2 = solveAssignment(scores, people, rooms);

    expect(result1.assignment.get("alice")).toBe(result2.assignment.get("alice"));
    expect(result1.assignment.get("bob")).toBe(result2.assignment.get("bob"));
  });

  test("input ordering does not affect result", () => {
    // Original order
    const people1 = [createPerson("alice"), createPerson("bob")];
    const rooms1 = [createRoom("room_1"), createRoom("room_2")];
    const scores1 = [
      [10, 10],
      [10, 10],
    ];

    // Reversed order
    const people2 = [createPerson("bob"), createPerson("alice")];
    const rooms2 = [createRoom("room_2"), createRoom("room_1")];
    const scores2 = [
      [10, 10],
      [10, 10],
    ];

    const result1 = solveAssignment(scores1, people1, rooms1);
    const result2 = solveAssignment(scores2, people2, rooms2);

    // Same assignments regardless of input order
    expect(result1.assignment.get("alice")).toBe(result2.assignment.get("alice"));
    expect(result1.assignment.get("bob")).toBe(result2.assignment.get("bob"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Legacy assignRooms Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("assignRooms (legacy)", () => {
  test("returns index-based assignment for compatibility", () => {
    const people = [createPerson("alice"), createPerson("bob")];
    const rooms = [createRoom("room_1"), createRoom("room_2")];
    const scores = [
      [1, 10], // Alice prefers room_2 (index 1)
      [10, 1], // Bob prefers room_1 (index 0)
    ];

    const result = assignRooms(scores, people, rooms);

    expect(result.assignment).toEqual([1, 0]); // [alice->room_2, bob->room_1]
    expect(result.totalScore).toBe(20);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Utility Function Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("canonicalizeId", () => {
  test("converts to lowercase", () => {
    expect(canonicalizeId("ALICE")).toBe("alice");
    expect(canonicalizeId("Alice")).toBe("alice");
  });

  test("trims whitespace", () => {
    expect(canonicalizeId("  alice  ")).toBe("alice");
  });
});

describe("validateUniqueIds", () => {
  test("returns valid for unique IDs", () => {
    const people = [createPerson("alice"), createPerson("bob")];
    const rooms = [createRoom("room_1"), createRoom("room_2")];

    const result = validateUniqueIds(people, rooms);
    expect(result.valid).toBe(true);
    expect(result.duplicates).toEqual([]);
  });

  test("detects duplicate person IDs", () => {
    const people = [createPerson("alice"), createPerson("alice")];
    const rooms = [createRoom("room_1")];

    const result = validateUniqueIds(people, rooms);
    expect(result.valid).toBe(false);
    expect(result.duplicates).toContain("person:alice");
  });

  test("detects duplicate room IDs", () => {
    const people = [createPerson("alice")];
    const rooms = [createRoom("room_1"), createRoom("room_1")];

    const result = validateUniqueIds(people, rooms);
    expect(result.valid).toBe(false);
    expect(result.duplicates).toContain("room:room_1");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases and Stress Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("edge cases", () => {
  test("handles single person single room", () => {
    const people = [createPerson("alice")];
    const rooms = [createRoom("room_1")];
    const scores = [[42]];

    const result = solveAssignment(scores, people, rooms);
    expect(result.assignment.get("alice")).toBe("room_1");
    expect(result.totalScore).toBe(42);
  });

  test("handles many rooms with few people", () => {
    const people = [createPerson("alice"), createPerson("bob")];
    const rooms = [
      createRoom("room_1"),
      createRoom("room_2"),
      createRoom("room_3"),
      createRoom("room_4"),
      createRoom("room_5"),
    ];
    const scores = [
      [1, 2, 3, 4, 100], // Alice should get room_5
      [50, 1, 1, 1, 1], // Bob should get room_1
    ];

    const result = solveAssignment(scores, people, rooms);
    expect(result.assignment.get("alice")).toBe("room_5");
    expect(result.assignment.get("bob")).toBe("room_1");
    expect(result.totalScore).toBe(150);
  });

  test("handles zero and negative scores correctly", () => {
    const people = [createPerson("alice"), createPerson("bob")];
    const rooms = [createRoom("room_1"), createRoom("room_2")];
    const scores = [
      [0, -5],
      [-10, 0],
    ];

    const result = solveAssignment(scores, people, rooms);
    // Alice -> room_1 (0), Bob -> room_2 (0) = optimal (0)
    expect(result.totalScore).toBe(0);
  });

  test("handles very small score differences with tie-breaking", () => {
    const people = [createPerson("alice"), createPerson("bob")];
    const rooms = [createRoom("room_1"), createRoom("room_2")];
    // Scores differ by less than epsilon
    const scores = [
      [10.0000000001, 10.0000000002],
      [10.0000000001, 10.0000000002],
    ];

    const result = solveAssignment(scores, people, rooms);
    // Should still produce consistent results
    expect(result.assignment.size).toBe(2);
    expect(result.assignment.get("alice")).not.toBe(result.assignment.get("bob"));
  });
});

describe("larger scale tests", () => {
  test("handles 10x10 assignment", () => {
    const n = 10;
    const people = Array.from({ length: n }, (_, i) =>
      createPerson(`person_${i}`),
    );
    const rooms = Array.from({ length: n }, (_, i) => createRoom(`room_${i}`));

    // Create a matrix where optimal is diagonal
    const scores = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 100 : 1)),
    );

    const result = solveAssignment(scores, people, rooms);

    // Each person should get their "diagonal" room
    for (let i = 0; i < n; i++) {
      expect(result.assignment.get(`person_${i}`)).toBe(`room_${i}`);
    }
    expect(result.totalScore).toBe(n * 100);
  });
});
