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
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Room Metrics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalizes an array of numbers to the 0-1 range using min-max scaling.
 * Returns all 1s if all values are equal.
 */
export const normalizeValues = (values: number[]): number[] => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) {
    return values.map(() => 1);
  }
  return values.map((value) => (value - min) / (max - min));
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
      isFrontGround: room.floor === 0 && room.isFrontFacing,
      bedValue: room.bedType === "double" ? 1 : 0,
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
      safetySensitiveGenders: defaults.safetySensitiveGenders,
    };
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Room Scoring
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines if a person should receive a safety penalty for front-ground rooms.
 */
export const personNeedsSafetyPenalty = (
  person: Person,
  meta: PersonMeta,
): boolean => {
  return (
    meta.safetyConcern > 0 &&
    meta.safetySensitiveGenders.includes(person.gender)
  );
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
 */
export const scoreRoom = (
  person: Person,
  room: Room,
  metrics: RoomMetrics,
  meta: PersonMeta,
  houseMeta: HouseMeta,
): number => {
  let score = 0;

  // Base room characteristics
  score += metrics.size * meta.preferenceWeights.size;
  score += metrics.windows * meta.preferenceWeights.windows;
  score += metrics.attractiveness * meta.preferenceWeights.attractiveness;
  score += metrics.sunlight * meta.preferenceWeights.sunlight;
  score += metrics.storage * meta.preferenceWeights.storage;
  score += metrics.quiet * meta.preferenceWeights.quiet;

  // Kitchen proximity bonus for frequent cooks
  if (person.cooksOften) {
    score += metrics.kitchenProximity * meta.preferenceWeights.kitchenProximity;
  }

  // Ensuite preference
  score += metrics.ensuite * meta.preferenceWeights.ensuite;

  // Bed type base preference
  score += metrics.bedValue * meta.preferenceWeights.bedType;

  // Bed upgrade bonus (single -> double)
  if (person.currentBedType === "single" && room.bedType === "double") {
    score += meta.bedUpgradeWeight;
  }

  // Bed downgrade penalty (double -> single)
  if (person.currentBedType === "double" && room.bedType === "single") {
    score -= meta.bedDowngradePenalty;
  }

  // External partner double bed preference
  // External couples are prioritized for double beds (they host their partner)
  if (
    person.relationship.status === "partnered" &&
    person.relationship.partnerLocation === "external"
  ) {
    if (room.bedType === "double") {
      score += meta.doubleBedPartnerWeight;
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
      score += meta.doubleBedInternalCoupleWeight;
    } else if (!getsDouble && room.bedType === "single") {
      score += meta.singleBedInternalCoupleWeight;
    }
  }

  // Safety penalty for front-ground rooms
  if (metrics.isFrontGround && personNeedsSafetyPenalty(person, meta)) {
    score -= meta.safetyConcern;
  }

  // Apply priority multiplier
  return score * meta.priorityMultiplier;
};

/**
 * Builds the full score matrix for all person-room combinations.
 */
export const buildDeterministicScores = (
  people: Person[],
  rooms: Room[],
  roomMetrics: RoomMetrics[],
  peopleMeta: PersonMeta[],
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
      );
    });
  });
};
