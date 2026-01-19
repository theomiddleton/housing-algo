/**
 * Deterministic room scoring algorithm.
 *
 * This module contains the core scoring logic for matching people to rooms
 * based on their preferences, priorities, and room characteristics.
 */

import type {
  Person,
  Room,
  RoomMetrics,
  PersonMeta,
  PreferenceWeights,
  PriorityWeights,
  PersonDefaults,
  HouseMeta,
  PriorityMode,
  ScoringOverrides,
  ScoringPreferenceKey,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Room Metrics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalizes an array of numbers to the 0-1 range using min-max scaling.
 * Returns all 1s if all values are equal.
 *
 * Guards against edge cases:
 * - Empty arrays return empty arrays
 * - Arrays with NaN/Infinity values throw an error
 */
export const normalizeValues = (values: number[]): number[] => {
  if (values.length === 0) {
    return [];
  }

  const hasInvalidValue = values.some((v) => !Number.isFinite(v));
  if (hasInvalidValue) {
    throw new Error(
      "Cannot normalize values: array contains NaN or Infinity. Check that all room attributes are valid numbers.",
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) {
    return values.map(() => 1);
  }
  return values.map((value) => (value - min) / (max - min));
};

/**
 * Calculates safety risk for a room based on floor and facing.
 * Ground floor is less safe than upper floors.
 * Front-facing is less safe than back-facing.
 *
 * Risk levels (0 = safest, 1 = least safe):
 * - Back, Upper floor:   0.0
 * - Front, Upper floor:  0.25
 * - Back, Ground floor:  0.5
 * - Front, Ground floor: 1.0
 */
const calculateSafetyRisk = (room: Room): number => {
  const isGround = room.floor === 0;
  const isFront = room.isFrontFacing;

  if (isGround && isFront) return 1.0;
  if (isGround && !isFront) return 0.5;
  if (!isGround && isFront) return 0.25;
  return 0.0;
};

/**
 * Builds normalized metrics for each room to enable fair comparisons.
 */
export const buildRoomMetrics = (rooms: Room[]): RoomMetrics[] => {
  const sizes = rooms.map((room) => room.sizeSqm);
  const windows = rooms.map((room) => room.windows);
  const attractiveness = rooms.map((room) => room.attractiveness);
  const sunlight = rooms.map((room) => room.sunlight);
  const storage = rooms.map((room) => room.storage);
  const noise = rooms.map((room) => room.noise);

  const sizeNorm = normalizeValues(sizes);
  const windowNorm = normalizeValues(windows);
  const attractivenessNorm = normalizeValues(attractiveness);
  const sunlightNorm = normalizeValues(sunlight);
  const storageNorm = normalizeValues(storage);
  const noiseNorm = normalizeValues(noise);

  return rooms.map((room, index) => {
    return {
      size: sizeNorm[index] ?? 0,
      windows: windowNorm[index] ?? 0,
      attractiveness: attractivenessNorm[index] ?? 0,
      sunlight: sunlightNorm[index] ?? 0,
      storage: storageNorm[index] ?? 0,
      quiet: 1 - (noiseNorm[index] ?? 0),
      kitchenProximity: room.nearKitchen ? 1 : 0,
      ensuite: room.ensuite ? 1 : 0,
      safetyRisk: calculateSafetyRisk(room),
      bedValue: room.bedType === "double" ? 1 : 0,
      floorLevel: room.floor > 0 ? 1 : 0,
    };
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// People Metadata
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Merges default weights with person-specific overrides.
 */
export const mergeWeights = <T extends Record<string, number>>(
  defaults: T,
  overrides?: Partial<T>,
): T => {
  return {
    ...defaults,
    ...(overrides ?? {}),
  };
};

/**
 * Calculates a person's priority score based on their contributions.
 */
export const calculatePriorityScore = (
  person: Person,
  weights: PriorityWeights,
): number => {
  return (
    (person.foundHouse ? weights.foundHouse : 0) +
    (person.handledAgent ? weights.handledAgent : 0) +
    (person.attendedViewing ? weights.attendedViewing : 0)
  );
};

/**
 * Builds metadata for each person including resolved weights and priority info.
 */
export const buildPeopleMeta = (
  people: Person[],
  defaults: PersonDefaults,
): PersonMeta[] => {
  return people.map((person) => {
    const preferenceWeights = mergeWeights(
      defaults.preferenceWeights,
      person.preferenceWeights,
    );
    const priorityWeights = mergeWeights(
      defaults.priorityWeights,
      person.priorityWeights,
    );
    const priorityScore = calculatePriorityScore(person, priorityWeights);
    const priorityMultiplier = 1 + priorityScore / defaults.priorityScale;
    return {
      preferenceWeights,
      priorityWeights,
      priorityScore,
      priorityMultiplier,
      safetyConcern: person.safetyConcern ?? defaults.safetyConcern,
      hasSafetyConcern: person.hasSafetyConcern ?? false,
      kitchenPreference: person.kitchenPreference ?? "none",
      bedUpgradeWeight: person.bedUpgradeWeight ?? defaults.bedUpgradeWeight,
      bedDowngradePenalty:
        person.bedDowngradePenalty ?? defaults.bedDowngradePenalty,
      doubleBedPartnerWeight:
        person.doubleBedPartnerWeight ?? defaults.doubleBedPartnerWeight,
      singleBedInternalCoupleWeight:
        person.singleBedInternalCoupleWeight ??
        defaults.singleBedInternalCoupleWeight,
      doubleBedInternalCoupleWeight:
        person.doubleBedInternalCoupleWeight ??
        defaults.doubleBedInternalCoupleWeight,
    };
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Room Scoring
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines if a person has safety concerns (per-person setting).
 */
export const personHasSafetyConcern = (meta: PersonMeta): boolean => {
  return meta.hasSafetyConcern && meta.safetyConcern > 0;
};

/**
 * Scores how well a room fits a person based on their preferences.
 *
 * The score considers:
 * - Room characteristics (size, windows, sunlight, storage, noise)
 * - Bed type compatibility and upgrade/downgrade effects
 * - Kitchen proximity for people who cook often
 * - Safety concerns for front-ground rooms
 * - Priority multiplier for contributions to finding the house
 * - Internal couple single bed preference (when house has single beds)
 *
 * The priorityMode parameter controls how the priority multiplier is applied:
 * - "amplify": Multiplies the entire score (preferences + bonuses - penalties)
 * - "bonus": Only multiplies preferences and bonuses; penalties are applied after
 *
 * ## Scoring Scale Notes
 *
 * This function combines two types of score components:
 *
 * 1. **Normalized preference scores (0-1 range)**: Room attributes like size, windows,
 *    attractiveness, etc. are normalized to 0-1 and multiplied by preference weights
 *    (typically 0-10). Example: `metrics.size * weights.size` where size ∈ [0,1].
 *
 * 2. **Absolute bonuses/penalties**: Fixed point values added or subtracted based on
 *    specific conditions (e.g., bedUpgradeWeight=2.5, safetyConcern=4.0).
 *
 * The default bonus/penalty values are tuned to represent roughly 10-20% of the
 * maximum possible preference score (~31 points with default weights). When adjusting
 * preference weights, be aware that absolute bonuses may need retuning to maintain
 * their intended relative impact.
 */
export const scoreRoom = (
  person: Person,
  room: Room,
  metrics: RoomMetrics,
  meta: PersonMeta,
  houseMeta: HouseMeta,
  priorityMode: PriorityMode = "amplify",
  overrides: ScoringOverrides = {},
): number => {
  const ignored = new Set<ScoringPreferenceKey>(overrides.ignorePreferences ?? []);
  const include = (key: ScoringPreferenceKey) => !ignored.has(key);

  let preferenceScore = 0;
  let bonusScore = 0;
  let penaltyScore = 0;

  // Base room characteristics (normalized 0-1, weighted)
  if (include("size")) {
    preferenceScore += metrics.size * meta.preferenceWeights.size;
  }
  if (include("windows")) {
    preferenceScore += metrics.windows * meta.preferenceWeights.windows;
  }
  if (include("attractiveness")) {
    preferenceScore += metrics.attractiveness * meta.preferenceWeights.attractiveness;
  }
  if (include("sunlight")) {
    preferenceScore += metrics.sunlight * meta.preferenceWeights.sunlight;
  }
  if (include("storage")) {
    preferenceScore += metrics.storage * meta.preferenceWeights.storage;
  }
  if (include("quiet")) {
    preferenceScore += metrics.quiet * meta.preferenceWeights.quiet;
  }

  // Kitchen proximity preference
  // "close" = bonus for being near kitchen, "far" = bonus for being away from kitchen
  if (include("kitchenProximity")) {
    if (meta.kitchenPreference === "close") {
      preferenceScore += metrics.kitchenProximity * meta.preferenceWeights.kitchenProximity;
    } else if (meta.kitchenPreference === "far") {
      preferenceScore += (1 - metrics.kitchenProximity) * meta.preferenceWeights.kitchenProximity;
    }
  }

  // Ensuite preference
  if (include("ensuite")) {
    preferenceScore += metrics.ensuite * meta.preferenceWeights.ensuite;
  }

  // Floor level preference (first floor more attractive than ground)
  if (include("floor")) {
    preferenceScore += metrics.floorLevel * meta.preferenceWeights.floor;
  }

  // Bed type base preference
  if (include("bedType")) {
    preferenceScore += metrics.bedValue * meta.preferenceWeights.bedType;
  }

  // Bed upgrade bonus (single -> double)
  if (person.currentBedType === "single" && room.bedType === "double") {
    bonusScore += meta.bedUpgradeWeight;
  }

  // Bed downgrade penalty (double -> single)
  if (person.currentBedType === "double" && room.bedType === "single") {
    penaltyScore += meta.bedDowngradePenalty;
  }

  // External partner double bed preference
  // External couples are prioritized for double beds (they host their partner)
  if (
    person.relationship.status === "partnered" &&
    person.relationship.partnerLocation === "external"
  ) {
    if (room.bedType === "double") {
      bonusScore += meta.doubleBedPartnerWeight;
    }
  }

  // Internal couple bed preference
  // When partnered with someone in the house and there's at least one single bed,
  // one partner is prioritized for the double bed (they'll share it),
  // the other is prioritized for a single bed (freeing up a double for others).
  // We use alphabetical ID comparison to deterministically assign roles.
  if (
    person.relationship.status === "partnered" &&
    person.relationship.partnerLocation === "house" &&
    houseMeta.hasSingleBed
  ) {
    const partnerId = person.relationship.partnerId;
    // The partner with the "smaller" ID gets the double, the other gets the single
    const getsDouble = partnerId ? person.id < partnerId : false;

    if (getsDouble && room.bedType === "double") {
      bonusScore += meta.doubleBedInternalCoupleWeight;
    } else if (!getsDouble && room.bedType === "single") {
      bonusScore += meta.singleBedInternalCoupleWeight;
    }
  }

  // Safety penalty based on room risk level (ground floor + front facing = highest risk)
  // Only applies to people with hasSafetyConcern = true
  if (personHasSafetyConcern(meta)) {
    penaltyScore += metrics.safetyRisk * meta.safetyConcern;
  }

  // Apply priority multiplier based on mode
  if (priorityMode === "amplify") {
    // "amplify": Priority multiplies everything - higher contributors have more
    // extreme scores in both directions (preferences amplified, penalties amplified)
    return (preferenceScore + bonusScore - penaltyScore) * meta.priorityMultiplier;
  } else {
    // "bonus": Priority only boosts preferences and bonuses; penalties are constant.
    // This treats priority as a tiebreaker that doesn't penalize contributors more harshly.
    return (preferenceScore + bonusScore) * meta.priorityMultiplier - penaltyScore;
  }
};

/**
 * Builds the full score matrix for all person-room combinations.
 */
export const buildDeterministicScores = (
  people: Person[],
  rooms: Room[],
  roomMetrics: RoomMetrics[],
  peopleMeta: PersonMeta[],
  priorityMode: PriorityMode = "amplify",
  overrides?: ScoringOverrides,
): number[][] => {
  // Compute house-level metadata
  const houseMeta: HouseMeta = {
    hasSingleBed: rooms.some((room) => room.bedType === "single"),
  };

  return people.map((person, personIndex) => {
    return rooms.map((room, roomIndex) => {
      return scoreRoom(
        person,
        room,
        roomMetrics[roomIndex]!,
        peopleMeta[personIndex]!,
        houseMeta,
        priorityMode,
        overrides,
      );
    });
  });
};
