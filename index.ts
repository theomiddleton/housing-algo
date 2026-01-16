import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

type BedType = "single" | "double";

type Gender = "female" | "male" | "nonbinary" | "other";

type RelationshipStatus = "single" | "partnered";

type PartnerLocation = "none" | "external" | "house";

type Relationship = {
  status: RelationshipStatus;
  partnerLocation: PartnerLocation;
  partnerId?: string;
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
};

type PersonDefaults = {
  preferenceWeights: PreferenceWeights;
  priorityWeights: PriorityWeights;
  safetyConcern: number;
  bedUpgradeWeight: number;
  bedDowngradePenalty: number;
  doubleBedPartnerWeight: number;
  priorityScale: number;
  safetySensitiveGenders: Gender[];
};

type Person = {
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
  safetySensitiveGenders: Gender[];
};

type Assignment = {
  person: Person;
  room: Room;
  score: number;
  priorityScore: number;
  priorityMultiplier: number;
  reason?: string;
};

type ScoreResult = {
  scores: number[][];
  reasons?: string[][];
};

type ScoringMode = "deterministic" | "ai" | "gemini";

type GeminiAttachment = {
  name: string;
  mimeType: string;
  encoding: "text" | "base64";
  content: string;
};

type GeminiInput = {
  model?: string;
  data: GeminiAttachment[];
  webpages: string[];
  images: GeminiAttachment[];
};

type GeminiTextPart = {
  text: string;
};

type GeminiInlinePart = {
  inline_data: {
    mime_type: string;
    data: string;
  };
};

type GeminiPart = GeminiTextPart | GeminiInlinePart;

type GeminiContent = {
  role: "user" | "model";
  parts: GeminiPart[];
};

type GeminiApiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

type GeminiScorePayload = {
  scores?: number[][];
  reasons?: string[][];
  questions?: string[];
};

type GeminiCliOptions = {
  model?: string;
  dataPaths: string[];
  webpageUrls: string[];
  imagePaths: string[];
  allowQuestions: boolean;
  timeoutMs?: number;
  retries: number;
  debug: boolean;
};

type AiOptions = {
  mode: Exclude<ScoringMode, "deterministic">;
  gemini: GeminiCliOptions;
};

type CliOptions = {
  housePath: string;
  peoplePath: string;
  mode: ScoringMode;
  json: boolean;
  help: boolean;
  gemini: GeminiCliOptions;
};

const DEFAULT_HOUSE_PATH = "data/house.json";
const DEFAULT_PEOPLE_PATH = "data/people.json";
const DEFAULT_GEMINI_TIMEOUT_MS = 30000;
const DEFAULT_GEMINI_RETRIES = 1;

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

  const scoreResult =
    options.mode === "deterministic"
      ? ({
          scores: buildDeterministicScores(
            peopleConfig.people,
            houseConfig.rooms,
            roomMetrics,
            peopleMeta
          ),
        } satisfies ScoreResult)
      : await buildAiScores(peopleConfig, houseConfig, roomMetrics, peopleMeta, {
          mode: options.mode,
          gemini: options.gemini,
        });

  const { scores, reasons } = scoreResult;
  const { assignment, totalScore } = assignRooms(scores, peopleMeta, houseConfig.rooms);
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
        reason ?? (options.mode === "deterministic" ? undefined : "No reason provided by AI."),
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
              reason: item.reason,
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
    const reasonSuffix = item.reason ? `, reason: ${item.reason}` : "";
    console.log(
      `- ${item.person.name} -> ${item.room.name} (score: ${round(item.score)}, priority: ${round(
        item.priorityScore
      )}, multiplier: ${round(item.priorityMultiplier)}${reasonSuffix})`
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
  const getFlagValues = (flag: string): string[] => {
    const values: string[] = [];
    for (let index = 0; index < args.length; index++) {
      if (args[index] !== flag) {
        continue;
      }
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for ${flag}.`);
      }
      values.push(value);
    }
    return values;
  };

  const getFlagValue = (flag: string): string | undefined => {
    const values = getFlagValues(flag);
    return values.length > 0 ? values[values.length - 1] : undefined;
  };

  const modeRaw = getFlagValue("--mode");
  const geminiQuestions = args.includes("--gemini-questions");
  const mode: ScoringMode = modeRaw
    ? modeRaw === "ai" || modeRaw === "gemini"
      ? modeRaw
      : "deterministic"
    : geminiQuestions
    ? "gemini"
    : "deterministic";

  if (modeRaw && modeRaw !== "ai" && modeRaw !== "deterministic" && modeRaw !== "gemini") {
    throw new Error(`Unknown mode: ${modeRaw}. Use --mode deterministic|ai|gemini.`);
  }

  const timeoutRaw = getFlagValue("--gemini-timeout");
  const timeoutMs = timeoutRaw ? parsePositiveInt(timeoutRaw, "--gemini-timeout") : undefined;
  const retriesRaw = getFlagValue("--gemini-retries");
  const retries = retriesRaw ? parseNonNegativeInt(retriesRaw, "--gemini-retries") : undefined;

  return {
    housePath: getFlagValue("--house") ?? DEFAULT_HOUSE_PATH,
    peoplePath: getFlagValue("--people") ?? DEFAULT_PEOPLE_PATH,
    mode,
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
  console.log("Room assignment CLI");
  console.log("");
  console.log("Usage:");
  console.log("  bun run index.ts --house data/house.json --people data/people.json");
  console.log("");
  console.log("Options:");
  console.log("  --mode deterministic|ai|gemini  Scoring strategy (default: deterministic)");
  console.log("  --json                          Output JSON for integrations");
  console.log("  --house <path>                  House/room JSON file");
  console.log("  --people <path>                 People/weights JSON file");
  console.log("  --gemini-model <name>           Gemini model identifier");
  console.log("  --gemini-data <path>            Attach data file (repeatable)");
  console.log("  --gemini-webpage <url>          Attach webpage URL (repeatable)");
  console.log("  --gemini-image <path>           Attach image file (repeatable)");
  console.log("  --gemini-questions              Let Gemini ask clarifying questions");
  console.log("  --gemini-timeout <ms>           Timeout per Gemini request (default: 30000)");
  console.log("  --gemini-retries <count>        Retry count after timeouts (default: 1)");
  console.log("  --gemini-debug                  Verbose Gemini request logging");
  console.log("  --help, -h                      Show this help");
};

const resolvePath = (filePath: string): string =>
  filePath.startsWith("/") ? filePath : `${process.cwd()}/${filePath}`;

const parsePositiveInt = (value: string, label: string): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label} value: ${value}. Expected a positive whole number.`);
  }
  return parsed;
};

const parseNonNegativeInt = (value: string, label: string): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid ${label} value: ${value}. Expected a non-negative whole number.`);
  }
  return parsed;
};

const readJson = async <T,>(filePath: string): Promise<T> => {
  const resolved = resolvePath(filePath);
  const file = Bun.file(resolved);
  if (!(await file.exists())) {
    throw new Error(`File not found: ${resolved}`);
  }
  const text = await file.text();
  return JSON.parse(text) as T;
};

const isTextMime = (mimeType: string): boolean => {
  return (
    mimeType.startsWith("text/") ||
    mimeType.includes("json") ||
    mimeType.includes("xml") ||
    mimeType.includes("yaml") ||
    mimeType.includes("csv")
  );
};

const getFileName = (filePath: string): string => {
  const segments = filePath.split("/");
  return segments.length > 0 ? (segments[segments.length - 1] ?? filePath) : filePath;
};

const readGeminiAttachment = async (
  filePath: string,
  options: { defaultMimeType: string; forceBase64?: boolean }
): Promise<GeminiAttachment> => {
  const resolved = resolvePath(filePath);
  const file = Bun.file(resolved);
  if (!(await file.exists())) {
    throw new Error(`File not found: ${resolved}`);
  }

  const mimeType = file.type || options.defaultMimeType;
  const name = getFileName(resolved);

  if (options.forceBase64 || !isTextMime(mimeType)) {
    const buffer = await file.arrayBuffer();
    return {
      name,
      mimeType,
      encoding: "base64",
      content: Buffer.from(buffer).toString("base64"),
    };
  }

  return {
    name,
    mimeType,
    encoding: "text",
    content: await file.text(),
  };
};

const buildGeminiPayload = async (options: GeminiCliOptions): Promise<GeminiInput> => {
  const data = await Promise.all(
    options.dataPaths.map((path) =>
      readGeminiAttachment(path, {
        defaultMimeType: "text/plain",
      })
    )
  );

  const images = await Promise.all(
    options.imagePaths.map((path) =>
      readGeminiAttachment(path, {
        defaultMimeType: "application/octet-stream",
        forceBase64: true,
      })
    )
  );

  return {
    model: options.model,
    data,
    webpages: options.webpageUrls,
    images,
  };
};

const buildGeminiPrompt = (
  peopleConfig: PeopleConfig,
  houseConfig: HouseConfig,
  gemini: GeminiInput,
  allowQuestions: boolean
): string => {
  const roomOrder = houseConfig.rooms.map((room) => `${room.id} (${room.name})`).join(", ");
  const peopleOrder = peopleConfig.people
    .map((person) => `${person.id} (${person.name})`)
    .join(", ");
  const webpages = gemini.webpages.length > 0 ? gemini.webpages.join("\n") : "(none)";

  const questionInstructions = allowQuestions
    ? [
        "If you need more context, respond with:",
        '{ "questions": ["question 1", "question 2"] }',
        "Ask at most 5 questions in one turn.",
      ]
    : ["Return scores immediately; do not ask questions."];

  return [
    "You are scoring room assignments for a shared house.",
    "Return only JSON, no markdown or commentary.",
    "",
    "When ready, respond with:",
    '{ "scores": [[...]], "reasons": [[...]] }',
    "The scores matrix must have one row per person and one column per room.",
    "The reasons matrix must match the scores shape.",
    "Higher scores mean a better fit for that person.",
    "Use a 0-100 scale.",
    "Use only the provided people and house data.",
    "",
    ...questionInstructions,
    "",
    `People order: ${peopleOrder}`,
    `Room order: ${roomOrder}`,
    "",
    "House JSON:",
    JSON.stringify(houseConfig, null, 2),
    "",
    "People JSON:",
    JSON.stringify(peopleConfig, null, 2),
    "",
    "Webpage URLs:",
    webpages,
    "",
    "Additional files and images follow as attached parts when present.",
  ].join("\n");
};

const buildGeminiParts = (prompt: string, gemini: GeminiInput): GeminiPart[] => {
  const parts: GeminiPart[] = [{ text: prompt }];

  gemini.webpages.forEach((url) => {
    parts.push({ text: `Webpage: ${url}` });
  });

  gemini.data.forEach((attachment) => {
    if (attachment.encoding === "text") {
      parts.push({
        text: `Attachment: ${attachment.name} (${attachment.mimeType})\n${attachment.content}`,
      });
      return;
    }
    parts.push({
      inline_data: {
        mime_type: attachment.mimeType,
        data: attachment.content,
      },
    });
  });

  gemini.images.forEach((image) => {
    parts.push({ text: `Image: ${image.name}` });
    parts.push({
      inline_data: {
        mime_type: image.mimeType,
        data: image.content,
      },
    });
  });

  return parts;
};

const requestGemini = async (
  apiKey: string,
  model: string,
  contents: GeminiContent[],
  options: { timeoutMs: number; debug: boolean; round: number; maxRounds: number }
): Promise<GeminiApiResponse> => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  if (options.debug) {
    console.log(
      `Gemini request: model=${model}, timeout=${options.timeoutMs}ms, round=${options.round}/${options.maxRounds}`
    );
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = options.debug ? await response.text() : undefined;
      if (options.debug && errorBody) {
        console.log(`Gemini error response: ${errorBody}`);
      }
      throw new Error(`Gemini request failed: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as GeminiApiResponse;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Gemini request timed out after ${options.timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

const extractGeminiText = (response: GeminiApiResponse): string => {
  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const text = parts.map((part) => part.text ?? "").join("\n").trim();
  if (!text) {
    throw new Error("Gemini response did not include text content.");
  }
  return text;
};

const parseGeminiScorePayload = (text: string): GeminiScorePayload => {
  const payload = parseJsonFromText(text);
  if (!payload || typeof payload !== "object") {
    throw new Error("Gemini response was not valid JSON.");
  }
  return payload as GeminiScorePayload;
};

const parseJsonFromText = (text: string): unknown => {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    const withoutFence = trimmed.replace(/^```(?:json)?\n?/i, "").replace(/```$/i, "");
    return parseJsonFromText(withoutFence);
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const startIndex = trimmed.indexOf("{");
    if (startIndex !== -1) {
      const block = extractJsonBlock(trimmed, startIndex);
      if (block) {
        return JSON.parse(block);
      }
    }
  }

  throw new Error("Unable to parse JSON from Gemini response.");
};

const extractJsonBlock = (text: string, startIndex: number): string | null => {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let start = -1;

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];
    if (!char) {
      continue;
    }
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
};

const normalizeGeminiScores = (
  scores: number[][],
  peopleCount: number,
  roomCount: number
): number[][] => {
  if (!Array.isArray(scores) || scores.length !== peopleCount) {
    throw new Error("Gemini scores must include one row per person.");
  }

  return scores.map((row, rowIndex) => {
    if (!Array.isArray(row) || row.length !== roomCount) {
      throw new Error(`Gemini scores row ${rowIndex + 1} must have ${roomCount} entries.`);
    }
    return row.map((value, colIndex) => {
      const numeric = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(numeric)) {
        throw new Error(`Gemini score at [${rowIndex + 1}, ${colIndex + 1}] is not numeric.`);
      }
      return numeric;
    });
  });
};

const normalizeReasons = (
  reasons: unknown,
  peopleCount: number,
  roomCount: number
): string[][] | undefined => {
  if (!Array.isArray(reasons)) {
    return undefined;
  }

  if (reasons.length !== peopleCount) {
    throw new Error("Reasons matrix must include one row per person.");
  }

  return reasons.map((row, rowIndex) => {
    if (!Array.isArray(row) || row.length !== roomCount) {
      throw new Error(`Reasons row ${rowIndex + 1} must have ${roomCount} entries.`);
    }
    return row.map((value, colIndex) => {
      if (typeof value !== "string") {
        throw new Error(`Reason at [${rowIndex + 1}, ${colIndex + 1}] must be text.`);
      }
      return value.trim();
    });
  });
};

const promptGeminiQuestions = async (
  reader: ReturnType<typeof createInterface> | null,
  questions: string[]
): Promise<string[]> => {
  if (!reader) {
    throw new Error("Gemini follow-up questions require an interactive terminal.");
  }

  const answers: string[] = [];
  for (const question of questions) {
    if (!reader.terminal) {
      throw new Error("Gemini follow-up questions require an interactive terminal.");
    }
    const answer = await reader.question(`Gemini asks: ${question}\n> `);
    answers.push(answer.trim());
  }
  return answers;
};

const formatGeminiAnswers = (questions: string[], answers: string[]): string => {
  const lines = ["Answers to your questions:"];
  questions.forEach((question, index) => {
    lines.push(`Q: ${question}`);
    lines.push(`A: ${answers[index] ?? ""}`);
  });
  lines.push("Please return the scores and reasons JSON now.");
  return lines.join("\n");
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
  const validPartnerId =
    relationship.partnerId === undefined || typeof relationship.partnerId === "string";
  return validStatus && validPartnerLocation && validPartnerId;
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
    (person.attendedViewing ? weights.attendedViewing : 0)
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
  peopleMeta: PersonMeta[],
  aiOptions: AiOptions
): Promise<ScoreResult> => {
  if (aiOptions.mode === "ai") {
    return buildDeciderScores(
      peopleConfig,
      houseConfig,
      roomMetrics,
      peopleMeta,
      aiOptions.gemini
    );
  }

  return buildGeminiScores(peopleConfig, houseConfig, aiOptions.gemini);
};

const buildDeciderScores = async (
  peopleConfig: PeopleConfig,
  houseConfig: HouseConfig,
  roomMetrics: RoomMetrics[],
  peopleMeta: PersonMeta[],
  geminiOptions: GeminiCliOptions
): Promise<ScoreResult> => {
  const endpoint = Bun.env.AI_DECIDER_URL;
  if (!endpoint) {
    throw new Error("AI mode requires AI_DECIDER_URL in the environment.");
  }

  const gemini = await buildGeminiPayload(geminiOptions);

  console.log("Requesting AI scores from the decider...");
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
      mode: "ai",
      gemini,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI decider failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { scores: number[][]; reasons?: string[][] };
  if (!data.scores || !Array.isArray(data.scores)) {
    throw new Error("AI decider response must include scores matrix.");
  }

  const scores = data.scores;
  const reasons = normalizeReasons(
    data.reasons,
    peopleConfig.people.length,
    houseConfig.rooms.length
  );

  if (!reasons) {
    console.warn("AI decider did not provide reasons.");
  }

  return { scores, reasons };
};

const buildGeminiScores = async (
  peopleConfig: PeopleConfig,
  houseConfig: HouseConfig,
  geminiOptions: GeminiCliOptions
): Promise<ScoreResult> => {
  const apiKey = Bun.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini mode requires GEMINI_API_KEY in the environment.");
  }

  const model = geminiOptions.model ?? Bun.env.GEMINI_MODEL ?? "gemini-1.5-flash";
  const gemini = await buildGeminiPayload(geminiOptions);
  const prompt = buildGeminiPrompt(peopleConfig, houseConfig, gemini, geminiOptions.allowQuestions);
  if (geminiOptions.debug) {
    console.log(`Gemini prompt chars: ${prompt.length}`);
    console.log(
      `Gemini attachments: data=${gemini.data.length}, images=${gemini.images.length}, webpages=${gemini.webpages.length}`
    );
    if (gemini.data.length > 0) {
      const dataNames = gemini.data.map((item) => `${item.name} (${item.mimeType}, ${item.encoding})`);
      console.log(`Gemini data files: ${dataNames.join(", ")}`);
    }
    if (gemini.images.length > 0) {
      const imageNames = gemini.images.map((item) => `${item.name} (${item.mimeType})`);
      console.log(`Gemini images: ${imageNames.join(", ")}`);
    }
  }
  const contents: GeminiContent[] = [
    {
      role: "user",
      parts: buildGeminiParts(prompt, gemini),
    },
  ];

  const reader = geminiOptions.allowQuestions ? createInterface({ input, output }) : null;
  const maxRounds = geminiOptions.allowQuestions ? 3 : 1;
  const timeoutMs = geminiOptions.timeoutMs ?? DEFAULT_GEMINI_TIMEOUT_MS;
  const partsCount = contents[0]?.parts.length ?? 0;
  if (geminiOptions.debug) {
    console.log(
      `Gemini request payload: parts=${partsCount}, allowQuestions=${geminiOptions.allowQuestions}, retries=${geminiOptions.retries}, timeoutMs=${timeoutMs}`
    );
  }

  try {
    for (let round = 0; round < maxRounds; round += 1) {
      const attemptMax = Math.max(0, geminiOptions.retries);
      for (let attempt = 0; attempt <= attemptMax; attempt += 1) {
        console.log(`Gemini scoring (round ${round + 1}/${maxRounds})...`);
        try {
          const response = await requestGemini(apiKey, model, contents, {
            timeoutMs,
            debug: geminiOptions.debug,
            round: round + 1,
            maxRounds,
          });
          const responseText = extractGeminiText(response);
          const payload = parseGeminiScorePayload(responseText);

          if (payload.scores) {
            const scores = normalizeGeminiScores(
              payload.scores,
              peopleConfig.people.length,
              houseConfig.rooms.length
            );
            const reasons = normalizeReasons(
              payload.reasons,
              peopleConfig.people.length,
              houseConfig.rooms.length
            );
            if (!reasons) {
              throw new Error("Gemini response must include reasons for each score.");
            }
            return { scores, reasons };
          }

          if (!geminiOptions.allowQuestions) {
            throw new Error("Gemini did not return scores.");
          }

          if (!Array.isArray(payload.questions) || payload.questions.length === 0) {
            throw new Error("Gemini did not return questions or scores.");
          }

          console.log("Gemini asked follow-up questions.");
          const answers = await promptGeminiQuestions(reader, payload.questions);
          contents.push({
            role: "model",
            parts: [{ text: responseText }],
          });
          contents.push({
            role: "user",
            parts: [{ text: formatGeminiAnswers(payload.questions, answers) }],
          });
          break;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (!message.includes("timed out") || attempt >= attemptMax) {
            throw error;
          }
          console.warn(`Gemini request timed out (attempt ${attempt + 1}/${attemptMax + 1}). Retrying...`);
        }
      }
    }
  } finally {
    reader?.close();
  }

  throw new Error("Gemini did not return scores after follow-up questions.");
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

  score += metrics.storage * meta.preferenceWeights.storage;
  score += metrics.quiet * meta.preferenceWeights.quiet;

  if (person.cooksOften) {
    score += metrics.kitchenProximity * meta.preferenceWeights.kitchenProximity;
  }

  score += metrics.ensuite * meta.preferenceWeights.ensuite;

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


  if (metrics.isFrontGround && personNeedsSafetyPenalty(person, meta)) {
    score -= meta.safetyConcern;
  }

  return score * meta.priorityMultiplier;
};

const personNeedsSafetyPenalty = (person: Person, meta: PersonMeta): boolean => {
  return meta.safetyConcern > 0 && meta.safetySensitiveGenders.includes(person.gender);
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