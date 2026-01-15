type BedType = "single" | "double";

type Gender = "female" | "male" | "nonbinary" | "other";

type RelationshipStatus = "single" | "partnered";

type PartnerLocation = "none" | "external" | "house";

type Relationship = {
  status: RelationshipStatus;
  partnerLocation: PartnerLocation;
};

type Room = {
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

type HouseConfig = {
  name: string;
  rooms: Room[];
};

type PreferenceWeights = {
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

type PriorityWeights = {
  foundHouse: number;
  handledAgent: number;
  attendedViewing: number;
  didPaperwork: number;
  flexibleMoveIn: number;
};

type PersonDefaults = {
  preferenceWeights: PreferenceWeights;
  priorityWeights: PriorityWeights;
  safetyConcern: number;
  bedUpgradeWeight: number;
  bedDowngradePenalty: number;
  doubleBedPartnerWeight: number;
  workFromHomeBonus: number;
  priorityScale: number;
  ensuitePenalty: number;
  safetySensitiveGenders: Gender[];
};

type Person = {
  id: string;
  name: string;
  gender: Gender;
  foundHouse: boolean;
  handledAgent: boolean;
  attendedViewing: boolean;
  didPaperwork: boolean;
  flexibleMoveIn: boolean;
  currentBedType: BedType;
  relationship: Relationship;
  worksFromHome: boolean;
  prefersQuiet: boolean;
  needsStorage: boolean;
  cooksOften: boolean;
  requiresEnsuite: boolean;
  preferenceWeights?: Partial<PreferenceWeights>;
  priorityWeights?: Partial<PriorityWeights>;
  safetyConcern?: number;
  bedUpgradeWeight?: number;
  bedDowngradePenalty?: number;
  doubleBedPartnerWeight?: number;
  workFromHomeBonus?: number;
};

type PeopleConfig = {
  defaults: PersonDefaults;
  people: Person[];
};

type RoomMetrics = {
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

type PersonMeta = {
  preferenceWeights: PreferenceWeights;
  priorityWeights: PriorityWeights;
  priorityScore: number;
  priorityMultiplier: number;
  safetyConcern: number;
  bedUpgradeWeight: number;
  bedDowngradePenalty: number;
  doubleBedPartnerWeight: number;
  workFromHomeBonus: number;
  ensuitePenalty: number;
  safetySensitiveGenders: Gender[];
};

type Assignment = {
  person: Person;
  room: Room;
  score: number;
  priorityScore: number;
  priorityMultiplier: number;
};

type ScoringMode = "deterministic" | "ai";

type CliOptions = {
  housePath: string;
  peoplePath: string;
  mode: ScoringMode;
  json: boolean;
  help: boolean;
};

const DEFAULT_HOUSE_PATH = "data/house.json";
const DEFAULT_PEOPLE_PATH = "data/people.json";

const main = async () => {
  const options = parseArgs(Bun.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const houseConfig = await readJson<HouseConfig>(options.housePath);
  const peopleConfig = await readJson<PeopleConfig>(options.peoplePath);

  assertHouseConfig(houseConfig);
  assertPeopleConfig(peopleConfig);

  if (peopleConfig.people.length > houseConfig.rooms.length) {
    throw new Error("There are more people than rooms. Add rooms or remove people.");
  }

  const roomMetrics = buildRoomMetrics(houseConfig.rooms);
  const peopleMeta = buildPeopleMeta(peopleConfig.people, peopleConfig.defaults);

  const scores =
    options.mode === "ai"
      ? await buildAiScores(peopleConfig, houseConfig, roomMetrics, peopleMeta)
      : buildDeterministicScores(peopleConfig.people, houseConfig.rooms, roomMetrics, peopleMeta);

  const { assignment, totalScore } = assignRooms(scores, peopleMeta, houseConfig.rooms);
  const result = assignment.map((roomIndex, personIndex) => {
    const person = peopleConfig.people[personIndex]!;
    const room = houseConfig.rooms[roomIndex]!;
    const meta = peopleMeta[personIndex]!;
    return {
      person,
      room,
      score: scores[personIndex]![roomIndex]!,
      priorityScore: meta.priorityScore,
      priorityMultiplier: meta.priorityMultiplier,
    } satisfies Assignment;
  });

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          house: houseConfig.name,
          mode: options.mode,
          totalScore: round(totalScore),
          assignments: result.map((item) => ({
            personId: item.person.id,
            personName: item.person.name,
            roomId: item.room.id,
            roomName: item.room.name,
            score: round(item.score),
            priorityScore: round(item.priorityScore),
            priorityMultiplier: round(item.priorityMultiplier),
          })),
        },
        null,
        2
      )
    );
    return;
  }

  console.log(`Room assignment for ${houseConfig.name}`);
  console.log(`Mode: ${options.mode}`);
  console.log(`Total score: ${round(totalScore)}`);
  console.log("");

  result.forEach((item) => {
    console.log(
      `- ${item.person.name} -> ${item.room.name} (score: ${round(item.score)}, priority: ${round(
        item.priorityScore
      )}, multiplier: ${round(item.priorityMultiplier)})`
    );
  });

  const unassignedRooms = houseConfig.rooms.filter(
    (_, index) => !assignment.includes(index)
  );

  if (unassignedRooms.length > 0) {
    console.log("");
    console.log("Unassigned rooms:");
    unassignedRooms.forEach((room) => {
      console.log(`- ${room.name}`);
    });
  }
};

const parseArgs = (args: string[]): CliOptions => {
  const getFlagValue = (flag: string) => {
    const index = args.indexOf(flag);
    return index !== -1 && index + 1 < args.length ? args[index + 1] : undefined;
  };

  const modeRaw = getFlagValue("--mode");
  const mode: ScoringMode = modeRaw === "ai" ? "ai" : "deterministic";

  if (modeRaw && modeRaw !== "ai" && modeRaw !== "deterministic") {
    throw new Error(`Unknown mode: ${modeRaw}. Use --mode deterministic|ai.`);
  }

  return {
    housePath: getFlagValue("--house") ?? DEFAULT_HOUSE_PATH,
    peoplePath: getFlagValue("--people") ?? DEFAULT_PEOPLE_PATH,
    mode,
    json: args.includes("--json"),
    help: args.includes("--help") || args.includes("-h"),
  };
};

const printUsage = () => {
  console.log("Room assignment CLI");
  console.log("");
  console.log("Usage:");
  console.log("  bun run index.ts --house data/house.json --people data/people.json");
  console.log("");
  console.log("Options:");
  console.log("  --mode deterministic|ai   Scoring strategy (default: deterministic)");
  console.log("  --json                    Output JSON for integrations");
  console.log("  --house <path>            House/room JSON file");
  console.log("  --people <path>           People/weights JSON file");
  console.log("  --help, -h                Show this help");
};

const readJson = async <T,>(filePath: string): Promise<T> => {
  const resolved = filePath.startsWith("/") ? filePath : `${process.cwd()}/${filePath}`;
  const file = Bun.file(resolved);
  if (!(await file.exists())) {
    throw new Error(`File not found: ${resolved}`);
  }
  const text = await file.text();
  return JSON.parse(text) as T;
};

const assertHouseConfig = (house: HouseConfig) => {
  if (!house || typeof house.name !== "string" || !Array.isArray(house.rooms)) {
    throw new Error("Invalid house config. Expected { name, rooms }.");
  }
  house.rooms.forEach((room) => {
    if (!room.id || !room.name || typeof room.sizeSqm !== "number") {
      throw new Error(`Invalid room entry: ${JSON.stringify(room)}`);
    }
    if (!isBedType(room.bedType)) {
      throw new Error(`Room ${room.name} has invalid bedType.`);
    }
  });
};

const assertPeopleConfig = (peopleConfig: PeopleConfig) => {
  if (!peopleConfig || !Array.isArray(peopleConfig.people)) {
    throw new Error("Invalid people config. Expected { defaults, people }.");
  }
  if (!peopleConfig.defaults) {
    throw new Error("Missing defaults in people config.");
  }
  peopleConfig.people.forEach((person) => {
    if (!person.id || !person.name || !isBedType(person.currentBedType)) {
      throw new Error(`Invalid person entry: ${JSON.stringify(person)}`);
    }
    if (!isGender(person.gender)) {
      throw new Error(`Invalid gender for ${person.name}.`);
    }
    if (!isRelationship(person.relationship)) {
      throw new Error(`Invalid relationship for ${person.name}.`);
    }
  });
};

const isBedType = (value: unknown): value is BedType =>
  value === "single" || value === "double";

const isGender = (value: unknown): value is Gender =>
  value === "female" || value === "male" || value === "nonbinary" || value === "other";

const isRelationship = (value: unknown): value is Relationship => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const relationship = value as Relationship;
  const validStatus = relationship.status === "single" || relationship.status === "partnered";
  const validPartnerLocation =
    relationship.partnerLocation === "none" ||
    relationship.partnerLocation === "external" ||
    relationship.partnerLocation === "house";
  return validStatus && validPartnerLocation;
};

const buildRoomMetrics = (rooms: Room[]): RoomMetrics[] => {
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

const normalizeValues = (values: number[]): number[] => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) {
    return values.map(() => 1);
  }
  return values.map((value) => (value - min) / (max - min));
};

const buildPeopleMeta = (people: Person[], defaults: PersonDefaults): PersonMeta[] => {
  return people.map((person) => {
    const preferenceWeights = mergeWeights(defaults.preferenceWeights, person.preferenceWeights);
    const priorityWeights = mergeWeights(defaults.priorityWeights, person.priorityWeights);
    const priorityScore = calculatePriorityScore(person, priorityWeights);
    const priorityMultiplier = 1 + priorityScore / defaults.priorityScale;
    return {
      preferenceWeights,
      priorityWeights,
      priorityScore,
      priorityMultiplier,
      safetyConcern: person.safetyConcern ?? defaults.safetyConcern,
      bedUpgradeWeight: person.bedUpgradeWeight ?? defaults.bedUpgradeWeight,
      bedDowngradePenalty: person.bedDowngradePenalty ?? defaults.bedDowngradePenalty,
      doubleBedPartnerWeight: person.doubleBedPartnerWeight ?? defaults.doubleBedPartnerWeight,
      workFromHomeBonus: person.workFromHomeBonus ?? defaults.workFromHomeBonus,
      ensuitePenalty: defaults.ensuitePenalty,
      safetySensitiveGenders: defaults.safetySensitiveGenders,
    };
  });
};

const mergeWeights = <T extends Record<string, number>>(
  defaults: T,
  overrides?: Partial<T>
): T => {
  return {
    ...defaults,
    ...(overrides ?? {}),
  };
};

const calculatePriorityScore = (person: Person, weights: PriorityWeights): number => {
  return (
    (person.foundHouse ? weights.foundHouse : 0) +
    (person.handledAgent ? weights.handledAgent : 0) +
    (person.attendedViewing ? weights.attendedViewing : 0) +
    (person.didPaperwork ? weights.didPaperwork : 0) +
    (person.flexibleMoveIn ? weights.flexibleMoveIn : 0)
  );
};

const buildDeterministicScores = (
  people: Person[],
  rooms: Room[],
  roomMetrics: RoomMetrics[],
  peopleMeta: PersonMeta[]
): number[][] => {
  return people.map((person, personIndex) => {
    return rooms.map((room, roomIndex) => {
      return scoreRoom(
        person,
        room,
        roomMetrics[roomIndex]!,
        peopleMeta[personIndex]!
      );
    });
  });
};

const buildAiScores = async (
  peopleConfig: PeopleConfig,
  houseConfig: HouseConfig,
  roomMetrics: RoomMetrics[],
  peopleMeta: PersonMeta[]
): Promise<number[][]> => {
  const endpoint = Bun.env.AI_DECIDER_URL;
  if (!endpoint) {
    throw new Error("AI mode requires AI_DECIDER_URL in the environment.");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      house: houseConfig,
      people: peopleConfig,
      roomMetrics,
      peopleMeta,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI decider failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { scores: number[][] };
  if (!data.scores || !Array.isArray(data.scores)) {
    throw new Error("AI decider response must include scores matrix.");
  }

  return data.scores;
};

const scoreRoom = (
  person: Person,
  room: Room,
  metrics: RoomMetrics,
  meta: PersonMeta
): number => {
  let score = 0;
  score += metrics.size * meta.preferenceWeights.size;
  score += metrics.windows * meta.preferenceWeights.windows;
  score += metrics.attractiveness * meta.preferenceWeights.attractiveness;
  score += metrics.sunlight * meta.preferenceWeights.sunlight;

  if (person.needsStorage) {
    score += metrics.storage * meta.preferenceWeights.storage;
  }

  if (person.prefersQuiet) {
    score += metrics.quiet * meta.preferenceWeights.quiet;
  }

  if (person.cooksOften) {
    score += metrics.kitchenProximity * meta.preferenceWeights.kitchenProximity;
  }

  if (person.requiresEnsuite) {
    score += metrics.ensuite * meta.preferenceWeights.ensuite;
  }

  score += metrics.bedValue * meta.preferenceWeights.bedType;

  if (person.currentBedType === "single" && room.bedType === "double") {
    score += meta.bedUpgradeWeight;
  }

  if (person.currentBedType === "double" && room.bedType === "single") {
    score -= meta.bedDowngradePenalty;
  }

  if (person.relationship.status === "partnered" && person.relationship.partnerLocation === "external") {
    if (room.bedType === "double") {
      score += meta.doubleBedPartnerWeight;
    }
  }

  if (person.worksFromHome) {
    score +=
      meta.workFromHomeBonus * average([metrics.size, metrics.quiet, metrics.sunlight]);
  }

  if (person.requiresEnsuite && !room.ensuite) {
    score -= meta.ensuitePenalty;
  }

  if (metrics.isFrontGround && personNeedsSafetyPenalty(person, meta)) {
    score -= meta.safetyConcern;
  }

  return score * meta.priorityMultiplier;
};

const personNeedsSafetyPenalty = (person: Person, meta: PersonMeta): boolean => {
  return meta.safetyConcern > 0 && meta.safetySensitiveGenders.includes(person.gender);
};

const average = (values: number[]): number => {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const assignRooms = (
  scores: number[][],
  peopleMeta: PersonMeta[],
  rooms: Room[]
): { assignment: number[]; totalScore: number } => {
  const peopleCount = scores.length;
  const roomsCount = rooms.length;

  if (roomsCount > 20) {
    return greedyAssignment(scores, peopleMeta, roomsCount);
  }

  const maxMask = 1 << roomsCount;
  const dp = new Array<number>(maxMask).fill(Number.NEGATIVE_INFINITY);
  const prev = new Array<number>(maxMask).fill(-1);
  const picked = new Array<number>(maxMask).fill(-1);
  dp[0] = 0;

  for (let mask = 0; mask < maxMask; mask++) {
    const personIndex = countBits(mask);
    if (personIndex >= peopleCount) {
      continue;
    }
    for (let roomIndex = 0; roomIndex < roomsCount; roomIndex++) {
      if (mask & (1 << roomIndex)) {
        continue;
      }
      const nextMask = mask | (1 << roomIndex);
      const nextScore = (dp[mask] ?? Number.NEGATIVE_INFINITY) + scores[personIndex]![roomIndex]!;
      if (nextScore > (dp[nextMask] ?? Number.NEGATIVE_INFINITY)) {
        dp[nextMask] = nextScore;
        prev[nextMask] = mask;
        picked[nextMask] = roomIndex;
      }
    }
  }

  let bestMask = -1;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let mask = 0; mask < maxMask; mask++) {
    if (countBits(mask) !== peopleCount) {
      continue;
    }
    const currentScore = dp[mask] ?? Number.NEGATIVE_INFINITY;
    if (currentScore > bestScore) {
      bestScore = currentScore;
      bestMask = mask;
    }
  }

  if (bestMask === -1) {
    throw new Error("Unable to compute a valid assignment.");
  }

  const assignment = new Array<number>(peopleCount).fill(-1);
  let mask = bestMask;
  for (let personIndex = peopleCount - 1; personIndex >= 0; personIndex--) {
    const roomIndex = picked[mask] ?? -1;
    if (roomIndex === -1) {
      throw new Error("Unable to reconstruct assignment.");
    }
    assignment[personIndex] = roomIndex;
    const previousMask = prev[mask] ?? -1;
    if (previousMask === -1 && personIndex !== 0) {
      throw new Error("Unable to reconstruct assignment.");
    }
    mask = previousMask;
  }

  return { assignment, totalScore: bestScore };
};

const greedyAssignment = (
  scores: number[][],
  peopleMeta: PersonMeta[],
  roomsCount: number
): { assignment: number[]; totalScore: number } => {
  const peopleOrder = scores
    .map((_, index) => ({ index, priority: peopleMeta[index]!.priorityMultiplier }))
    .sort((a, b) => b.priority - a.priority);

  const assignment = new Array<number>(scores.length).fill(-1);
  const usedRooms = new Set<number>();
  let totalScore = 0;

  peopleOrder.forEach(({ index }) => {
    let bestRoom = -1;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let roomIndex = 0; roomIndex < roomsCount; roomIndex++) {
      if (usedRooms.has(roomIndex)) {
        continue;
      }
      const score = scores[index]![roomIndex]!;
      if (score > bestScore) {
        bestScore = score;
        bestRoom = roomIndex;
      }
    }
    if (bestRoom === -1) {
      throw new Error("Unable to find room for person.");
    }
    assignment[index] = bestRoom;
    usedRooms.add(bestRoom);
    totalScore += bestScore;
  });

  return { assignment, totalScore };
};

const countBits = (mask: number): number => {
  let count = 0;
  let value = mask;
  while (value) {
    count += value & 1;
    value >>= 1;
  }
  return count;
};

const round = (value: number): number => Math.round(value * 100) / 100;

await main();