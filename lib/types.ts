/**
 * Shared type definitions for the housing algorithm.
 */

export type BedType = "single" | "double";

export type Gender = "female" | "male" | "nonbinary" | "other";

export type RelationshipStatus = "single" | "partnered";

export type PartnerLocation = "none" | "external" | "house";

export type KitchenPreference = "close" | "far" | "none";

export type Relationship = {
  status: RelationshipStatus;
  partnerLocation: PartnerLocation;
  partnerId?: string;
};

export type Room = {
  id: string;
  name: string;
  sizeSqm: number;
  windows: number;
  attractiveness: number;
  bedType: BedType;
  floor: number;
  isFrontFacing: boolean;
  noise: number;
  storage: number;
  sunlight: number;
  nearKitchen: boolean;
  ensuite: boolean;
};

export type HouseConfig = {
  name: string;
  rooms: Room[];
};

export type PreferenceWeights = {
  size: number;
  windows: number;
  attractiveness: number;
  bedType: number;
  sunlight: number;
  storage: number;
  quiet: number;
  kitchenProximity: number;
  ensuite: number;
  floor: number;
};

export type PriorityWeights = {
  foundHouse: number;
  handledAgent: number;
  attendedViewing: number;
};

export type PersonDefaults = {
  preferenceWeights: PreferenceWeights;
  priorityWeights: PriorityWeights;
  safetyConcern: number;
  bedUpgradeWeight: number;
  bedDowngradePenalty: number;
  doubleBedPartnerWeight: number;
  singleBedInternalCoupleWeight: number;
  doubleBedInternalCoupleWeight: number;
  priorityScale: number;
};

export type Person = {
  id: string;
  name: string;
  gender: Gender;
  foundHouse: boolean;
  handledAgent: boolean;
  attendedViewing: boolean;
  currentBedType: BedType;
  relationship: Relationship;
  kitchenPreference?: KitchenPreference;
  hasSafetyConcern?: boolean;
  preferenceWeights?: Partial<PreferenceWeights>;
  priorityWeights?: Partial<PriorityWeights>;
  safetyConcern?: number;
  bedUpgradeWeight?: number;
  bedDowngradePenalty?: number;
  doubleBedPartnerWeight?: number;
  singleBedInternalCoupleWeight?: number;
  doubleBedInternalCoupleWeight?: number;
};

export type PeopleConfig = {
  defaults: PersonDefaults;
  people: Person[];
};

export type RoomMetrics = {
  size: number;
  windows: number;
  attractiveness: number;
  sunlight: number;
  storage: number;
  quiet: number;
  kitchenProximity: number;
  ensuite: number;
  safetyRisk: number;
  bedValue: number;
  floorLevel: number;
};

export type PersonMeta = {
  preferenceWeights: PreferenceWeights;
  priorityWeights: PriorityWeights;
  priorityScore: number;
  priorityMultiplier: number;
  safetyConcern: number;
  hasSafetyConcern: boolean;
  kitchenPreference: KitchenPreference;
  bedUpgradeWeight: number;
  bedDowngradePenalty: number;
  doubleBedPartnerWeight: number;
  singleBedInternalCoupleWeight: number;
  doubleBedInternalCoupleWeight: number;
};

export type HouseMeta = {
  hasSingleBed: boolean;
};

export type Assignment = {
  person: Person;
  room: Room;
  score: number;
  priorityScore: number;
  priorityMultiplier: number;
  reason?: string;
};

export type ScoreResult = {
  scores: number[][];
  reasons?: string[][];
};

export type ScoringMode = "deterministic" | "gemini";

/**
 * Controls how the priority multiplier affects final scores.
 *
 * - "amplify": Priority multiplies the entire score (preferences + bonuses - penalties).
 *   Higher priority amplifies both positive and negative effects.
 *
 * - "bonus": Priority only boosts preferences and bonuses; penalties remain constant.
 *   This treats priority as a tiebreaker that doesn't penalize contributors more harshly.
 */
export type PriorityMode = "amplify" | "bonus";

export type GeminiAttachment = {
  name: string;
  mimeType: string;
  encoding: "text" | "base64";
  content: string;
};

export type GeminiInput = {
  model?: string;
  data: GeminiAttachment[];
  webpages: string[];
  images: GeminiAttachment[];
};

export type GeminiScorePayload = {
  scores?: number[][];
  reasons?: string[][];
  questions?: string[];
};

export type ThinkingLevel = "none" | "low" | "medium" | "high";

export type GeminiCliOptions = {
  model?: string;
  dataPaths: string[];
  webpageUrls: string[];
  imagePaths: string[];
  allowQuestions: boolean;
  thinkingLevel: ThinkingLevel;
  timeoutMs?: number;
  retries: number;
  debug: boolean;
};

export type AiOptions = {
  gemini: GeminiCliOptions;
};

export type CliOptions = {
  housePath?: string;
  peoplePath?: string;
  mode?: ScoringMode;
  priorityMode?: PriorityMode;
  json: boolean;
  help: boolean;
  gemini: GeminiCliOptions;
};

// ─────────────────────────────────────────────────────────────────────────────
// Assignment Types
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
