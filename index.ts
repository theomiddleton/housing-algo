import prompts from "prompts";
import {
  colors,
  symbols,
  log,
  spinner,
  formatHelp,
  parseArgs as createArgParser,
  handleError,
  box,
  readJson,
} from "./lib/cli";
import {
  buildRoomMetrics,
  buildPeopleMeta,
  buildDeterministicScores,
} from "./lib/scoring";
import {
  buildAiScores,
  DEFAULT_GEMINI_TIMEOUT_MS,
  DEFAULT_GEMINI_RETRIES,
} from "./lib/ai";
import type {
  BedType,
  Gender,
  Relationship,
  Room,
  HouseConfig,
  Person,
  PeopleConfig,
  PersonMeta,
  Assignment,
  ScoreResult,
  ScoringMode,
  PriorityMode,
  CliOptions,
} from "./lib/types";

const main = async () => {
  const options = parseCliArgs(Bun.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  // Prompt for missing required inputs
  let housePath = options.housePath;
  let peoplePath = options.peoplePath;
  let mode = options.mode;
  let priorityMode = options.priorityMode;

  if (!housePath) {
    const response = await prompts({
      type: "text",
      name: "housePath",
      message: colors.label("Path to house JSON file"),
      validate: (v) => (v.trim() ? true : "House path is required"),
    });
    if (!response.housePath) {
      log.error("House path is required");
      process.exit(1);
    }
    housePath = response.housePath;
  }

  if (!peoplePath) {
    const response = await prompts({
      type: "text",
      name: "peoplePath",
      message: colors.label("Path to people JSON file"),
      validate: (v) => (v.trim() ? true : "People path is required"),
    });
    if (!response.peoplePath) {
      log.error("People path is required");
      process.exit(1);
    }
    peoplePath = response.peoplePath;
  }

  if (!mode) {
    const response = await prompts({
      type: "select",
      name: "mode",
      message: colors.label("Scoring mode"),
      choices: [
        { title: "Deterministic (rule-based)", value: "deterministic" },
        { title: "Gemini (AI)", value: "gemini" },
      ],
      initial: 0,
    });
    if (!response.mode) {
      log.error("Mode is required");
      process.exit(1);
    }
    mode = response.mode;
  }

  // Only prompt for priority mode in deterministic mode
  if (mode === "deterministic" && !priorityMode) {
    const response = await prompts({
      type: "select",
      name: "priorityMode",
      message: colors.label("Priority multiplier mode"),
      choices: [
        {
          title: "Amplify (multiplies entire score including penalties)",
          value: "amplify",
        },
        {
          title: "Bonus (only boosts preferences, penalties stay constant)",
          value: "bonus",
        },
      ],
      initial: 0,
    });
    if (!response.priorityMode) {
      log.error("Priority mode is required");
      process.exit(1);
    }
    priorityMode = response.priorityMode;
  }

  const loadSpinner = spinner.start("Loading configuration files...");

  let houseConfig: HouseConfig;
  let peopleConfig: PeopleConfig;

  try {
    houseConfig = await readJson<HouseConfig>(housePath!);
    peopleConfig = await readJson<PeopleConfig>(peoplePath!);
    assertHouseConfig(houseConfig);
    assertPeopleConfig(peopleConfig);
    loadSpinner.succeed("Configuration loaded");
  } catch (error) {
    loadSpinner.fail("Failed to load configuration");
    throw error;
  }

  if (peopleConfig.people.length > houseConfig.rooms.length) {
    throw new Error(
      "There are more people than rooms. Add rooms or remove people.",
    );
  }

  const roomMetrics = buildRoomMetrics(houseConfig.rooms);
  const peopleMeta = buildPeopleMeta(
    peopleConfig.people,
    peopleConfig.defaults,
  );

  let scoreResult: ScoreResult;
  if (mode === "deterministic") {
    const calcSpinner = spinner.start("Calculating scores...");
    scoreResult = {
      scores: buildDeterministicScores(
        peopleConfig.people,
        houseConfig.rooms,
        roomMetrics,
        peopleMeta,
        priorityMode ?? "amplify",
      ),
    };
    calcSpinner.succeed("Scores calculated");
  } else {
    scoreResult = await buildAiScores(
      peopleConfig,
      houseConfig,
      roomMetrics,
      peopleMeta,
      {
        gemini: options.gemini,
      },
    );
  }

  const { scores, reasons } = scoreResult;
  const { assignment, totalScore } = assignRooms(
    scores,
    peopleMeta,
    houseConfig.rooms,
  );
  const result = assignment.map((roomIndex, personIndex) => {
    const person = peopleConfig.people[personIndex]!;
    const room = houseConfig.rooms[roomIndex]!;
    const meta = peopleMeta[personIndex]!;
    const reason = reasons?.[personIndex]?.[roomIndex];
    return {
      person,
      room,
      score: scores[personIndex]![roomIndex]!,
      priorityScore: meta.priorityScore,
      priorityMultiplier: meta.priorityMultiplier,
      reason:
        reason ??
        (mode === "deterministic" ? undefined : "No reason provided by AI."),
    } satisfies Assignment;
  });

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          house: houseConfig.name,
          mode: mode,
          priorityMode: mode === "deterministic" ? (priorityMode ?? "amplify") : undefined,
          totalScore: round(totalScore),
          assignments: result.map((item) => ({
            personId: item.person.id,
            personName: item.person.name,
            roomId: item.room.id,
            roomName: item.room.name,
            score: round(item.score),
            priorityScore: round(item.priorityScore),
            priorityMultiplier: round(item.priorityMultiplier),
            reason: item.reason,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  // Pretty output
  log.blank();
  console.log(
    box(
      `${colors.title("Room Assignment Results")}\n${colors.dim(houseConfig.name)}`,
      {
        padding: 1,
        borderColor: colors.info,
      },
    ),
  );
  log.blank();

  log.item("Mode", mode!);
  if (mode === "deterministic") {
    log.item("Priority Mode", priorityMode ?? "amplify");
  }
  log.item("Total Score", colors.highlight(round(totalScore).toString()));
  log.item("People", peopleConfig.people.length.toString());
  log.item("Rooms", houseConfig.rooms.length.toString());
  log.blank();

  console.log(colors.label("  Assignments:"));
  log.blank();

  result.forEach((item) => {
    const scoreInfo = `score: ${colors.success(round(item.score).toString())}, priority: ${round(item.priorityScore)}, x${round(item.priorityMultiplier)}`;
    log.assignment(item.person.name, item.room.name, scoreInfo);
    if (item.reason) {
      console.log(`      ${colors.dim(item.reason)}`);
    }
  });

  const unassignedRooms = houseConfig.rooms.filter(
    (_, index) => !assignment.includes(index),
  );

  if (unassignedRooms.length > 0) {
    log.blank();
    log.warn(`${unassignedRooms.length} unassigned room(s):`);
    unassignedRooms.forEach((room) => {
      console.log(`    ${symbols.bullet} ${colors.dim(room.name)}`);
    });
  }

  log.blank();
  log.success("Assignment complete!");
  log.blank();
};

const parseCliArgs = (args: string[]): CliOptions => {
  const {
    getFlagValues,
    getFlagValue,
    hasFlag,
    parsePositiveInt,
    parseNonNegativeInt,
  } = createArgParser(args);

  const modeRaw = getFlagValue("--mode");
  const geminiQuestions = args.includes("--gemini-questions");

  let mode: ScoringMode | undefined;
  if (modeRaw) {
    if (modeRaw === "gemini") {
      mode = modeRaw;
    } else if (modeRaw === "deterministic") {
      mode = "deterministic";
    } else {
      throw new Error(
        `Unknown mode: ${modeRaw}. Use --mode deterministic|gemini.`,
      );
    }
  } else if (geminiQuestions) {
    mode = "gemini";
  }

  const priorityModeRaw = getFlagValue("--priority-mode");
  let priorityMode: PriorityMode | undefined;
  if (priorityModeRaw) {
    if (priorityModeRaw === "amplify" || priorityModeRaw === "bonus") {
      priorityMode = priorityModeRaw;
    } else {
      throw new Error(
        `Unknown priority mode: ${priorityModeRaw}. Use --priority-mode amplify|bonus.`,
      );
    }
  }

  const timeoutRaw = getFlagValue("--gemini-timeout");
  const timeoutMs = timeoutRaw
    ? parsePositiveInt(timeoutRaw, "--gemini-timeout")
    : undefined;
  const retriesRaw = getFlagValue("--gemini-retries");
  const retries = retriesRaw
    ? parseNonNegativeInt(retriesRaw, "--gemini-retries")
    : undefined;

  return {
    housePath: getFlagValue("--house"),
    peoplePath: getFlagValue("--people"),
    mode,
    priorityMode,
    json: args.includes("--json"),
    help: args.includes("--help") || args.includes("-h"),
    gemini: {
      model: getFlagValue("--gemini-model") ?? Bun.env.GEMINI_MODEL,
      dataPaths: getFlagValues("--gemini-data"),
      webpageUrls: getFlagValues("--gemini-webpage"),
      imagePaths: getFlagValues("--gemini-image"),
      allowQuestions: geminiQuestions,
      timeoutMs: timeoutMs ?? DEFAULT_GEMINI_TIMEOUT_MS,
      retries: retries ?? DEFAULT_GEMINI_RETRIES,
      debug: args.includes("--gemini-debug"),
    },
  };
};

const printUsage = () => {
  console.log(
    formatHelp({
      name: "Room Assignment CLI",
      description:
        "Optimally assign rooms to people based on preferences and priorities",
      usage: "bun run index.ts [options]",
      options: [
        { flag: "--house <path>", description: "House/room JSON file" },
        { flag: "--people <path>", description: "People/weights JSON file" },
        {
          flag: "--mode <mode>",
          description: "Scoring strategy: deterministic | gemini",
        },
        {
          flag: "--priority-mode <mode>",
          description: "Priority behavior: amplify | bonus (deterministic only)",
        },
        { flag: "--json", description: "Output JSON for integrations" },
        {
          flag: "--gemini-model <name>",
          description: "Gemini model identifier",
        },
        {
          flag: "--gemini-data <path>",
          description: "Attach data file (repeatable)",
        },
        {
          flag: "--gemini-webpage <url>",
          description: "Attach webpage URL (repeatable)",
        },
        {
          flag: "--gemini-image <path>",
          description: "Attach image file (repeatable)",
        },
        {
          flag: "--gemini-questions",
          description: "Let Gemini ask clarifying questions",
        },
        {
          flag: "--gemini-timeout <ms>",
          description: "Timeout per Gemini request",
          default: "30000",
        },
        {
          flag: "--gemini-retries <n>",
          description: "Retry count after timeouts",
          default: "1",
        },
        {
          flag: "--gemini-debug",
          description: "Verbose Gemini request logging",
        },
        { flag: "--help, -h", description: "Show this help" },
      ],
      sections: [
        {
          title: "Examples:",
          content: [
            colors.command(
              "bun run index.ts --house data/house.json --people data/people.json",
            ),
            colors.command("bun run index.ts --mode gemini --gemini-questions"),
            colors.command("bun run index.ts --json"),
          ],
        },
        {
          title: "Note:",
          content: [
            "If paths are not provided, you will be prompted to enter them.",
          ],
        },
      ],
    }),
  );
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
  value === "female" ||
  value === "male" ||
  value === "nonbinary" ||
  value === "other";

const isRelationship = (value: unknown): value is Relationship => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const relationship = value as Relationship;
  const validStatus =
    relationship.status === "single" || relationship.status === "partnered";
  const validPartnerLocation =
    relationship.partnerLocation === "none" ||
    relationship.partnerLocation === "external" ||
    relationship.partnerLocation === "house";
  const validPartnerId =
    relationship.partnerId === undefined ||
    typeof relationship.partnerId === "string";
  return validStatus && validPartnerLocation && validPartnerId;
};

const assignRooms = (
  scores: number[][],
  peopleMeta: PersonMeta[],
  rooms: Room[],
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
      const nextScore =
        (dp[mask] ?? Number.NEGATIVE_INFINITY) +
        scores[personIndex]![roomIndex]!;
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
  roomsCount: number,
): { assignment: number[]; totalScore: number } => {
  const peopleOrder = scores
    .map((_, index) => ({
      index,
      priority: peopleMeta[index]!.priorityMultiplier,
    }))
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

main().catch(handleError);
