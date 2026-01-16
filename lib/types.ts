/**
 * Shared type definitions for the housing algorithm.
 */

export type BedType = "single" | "double";

export type Gender = "female" | "male" | "nonbinary" | "other";

export type RelationshipStatus = "single" | "partnered";

export type PartnerLocation = "none" | "external" | "house";

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
  priorityScale: number;
  safetySensitiveGenders: Gender[];
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
  cooksOften: boolean;
  preferenceWeights?: Partial<PreferenceWeights>;
  priorityWeights?: Partial<PriorityWeights>;
  safetyConcern?: number;
  bedUpgradeWeight?: number;
  bedDowngradePenalty?: number;
  doubleBedPartnerWeight?: number;
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
  isFrontGround: boolean;
  bedValue: number;
};

export type PersonMeta = {
  preferenceWeights: PreferenceWeights;
  priorityWeights: PriorityWeights;
  priorityScore: number;
  priorityMultiplier: number;
  safetyConcern: number;
  bedUpgradeWeight: number;
  bedDowngradePenalty: number;
  doubleBedPartnerWeight: number;
  safetySensitiveGenders: Gender[];
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

export type GeminiCliOptions = {
  model?: string;
  dataPaths: string[];
  webpageUrls: string[];
  imagePaths: string[];
  allowQuestions: boolean;
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
  json: boolean;
  help: boolean;
  gemini: GeminiCliOptions;
};
