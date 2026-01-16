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

type CliOptions = {
  outPath: string;
  defaultsPath?: string;
  count?: number;
  help: boolean;
};

type PromptResult<T> = {
  value: T;
  usedDefault: boolean;
};

const DEFAULT_OUT_PATH = "data/people.json";
const DEFAULT_DEFAULTS_PATH = "data/people.json";

const FALLBACK_DEFAULTS: PersonDefaults = {
  preferenceWeights: {
    size: 4,
    windows: 2,
    attractiveness: 3,
    bedType: 5,
    sunlight: 2,
    storage: 2,
    quiet: 3,
    kitchenProximity: 2,
    ensuite: 2,
  },
  priorityWeights: {
    foundHouse: 6,
    handledAgent: 4,
    attendedViewing: 2,
  },
  safetyConcern: 4,
  bedUpgradeWeight: 2.5,
  bedDowngradePenalty: 3,
  doubleBedPartnerWeight: 3,
  priorityScale: 10,
  safetySensitiveGenders: ["female", "nonbinary"],
};

const PREFERENCE_KEYS: Array<keyof PreferenceWeights> = [
  "size",
  "windows",
  "attractiveness",
  "bedType",
  "sunlight",
  "storage",
  "quiet",
  "kitchenProximity",
  "ensuite",
];

const PRIORITY_KEYS: Array<keyof PriorityWeights> = [
  "foundHouse",
  "handledAgent",
  "attendedViewing",
];

const main = async () => {
  const options = parseArgs(Bun.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const defaults = await loadDefaults(options.defaultsPath);
  const reader = createInterface({ input, output });

  try {
    const count =
      options.count ?? (await promptPositiveInt(reader, "How many residents?", 1)).value;
    const usedIds = new Set<string>();
    const people: Person[] = [];
    const peopleById = new Map<string, Person>();
    const peopleByKey = new Map<string, string>();
    const pendingPartnerLinks = new Map<string, string>();

    for (let index = 0; index < count; index += 1) {
      console.log("");
      console.log(`Resident ${index + 1} of ${count}`);
      const person = await promptPerson(
        reader,
        defaults,
        usedIds,
        peopleById,
        peopleByKey,
        pendingPartnerLinks
      );
      people.push(person);
    }

    if (pendingPartnerLinks.size > 0) {
      console.log("");
      console.log("Unlinked in-house partner references:");
      pendingPartnerLinks.forEach((personId, key) => {
        const person = peopleById.get(personId);
        const label = person ? `${person.name} (${person.id})` : personId;
        console.log(`- ${label} -> ${key}`);
      });
    }

    const config: PeopleConfig = {
      defaults,
      people,
    };

    const resolvedOut = resolvePath(options.outPath);
    await Bun.write(resolvedOut, JSON.stringify(config, null, 2));
    console.log("");
    console.log(`Saved residents to ${resolvedOut}`);
  } finally {
    reader.close();
  }
};

const parseArgs = (args: string[]): CliOptions => {
  const getFlagValue = (flag: string): string | undefined => {
    const index = args.indexOf(flag);
    if (index === -1) {
      return undefined;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${flag}.`);
    }
    return value;
  };

  const countRaw = getFlagValue("--count");
  const count = countRaw ? parsePositiveInt(countRaw, "--count") : undefined;

  return {
    outPath: getFlagValue("--out") ?? DEFAULT_OUT_PATH,
    defaultsPath: getFlagValue("--defaults"),
    count,
    help: args.includes("--help") || args.includes("-h"),
  };
};

const printUsage = () => {
  console.log("Residents builder");
  console.log("");
  console.log("Usage:");
  console.log("  bun run residents.ts --out data/people.json");
  console.log("");
  console.log("Options:");
  console.log("  --out <path>       Output people JSON file");
  console.log("  --defaults <path>  Defaults JSON (people.json or defaults-only)");
  console.log("  --count <number>   Number of residents to enter");
  console.log("  --help, -h         Show this help");
};

const resolvePath = (filePath: string): string =>
  filePath.startsWith("/") ? filePath : `${process.cwd()}/${filePath}`;

const loadDefaults = async (defaultsPath?: string): Promise<PersonDefaults> => {
  const candidatePath = defaultsPath ?? DEFAULT_DEFAULTS_PATH;
  const resolved = resolvePath(candidatePath);
  const file = Bun.file(resolved);

  if (await file.exists()) {
    const text = await file.text();
    const parsed = JSON.parse(text) as unknown;
    const defaults = extractDefaults(parsed);
    if (!defaults) {
      throw new Error(`Defaults file ${resolved} does not contain valid defaults.`);
    }
    return defaults;
  }

  if (defaultsPath) {
    throw new Error(`Defaults file not found: ${resolved}`);
  }

  return FALLBACK_DEFAULTS;
};

const extractDefaults = (data: unknown): PersonDefaults | null => {
  if (!data || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, unknown>;
  const defaultsCandidate = isPersonDefaults(record)
    ? record
    : isPeopleConfig(record)
    ? record.defaults
    : null;

  if (!defaultsCandidate || !isPersonDefaults(defaultsCandidate)) {
    return null;
  }

  return defaultsCandidate;
};

const isPeopleConfig = (value: Record<string, unknown>): value is PeopleConfig => {
  return Boolean(value.defaults && value.people);
};

const isPersonDefaults = (value: Record<string, unknown>): value is PersonDefaults => {
  return (
    isPreferenceWeights(value.preferenceWeights) &&
    isPriorityWeights(value.priorityWeights) &&
    typeof value.safetyConcern === "number" &&
    typeof value.bedUpgradeWeight === "number" &&
    typeof value.bedDowngradePenalty === "number" &&
    typeof value.doubleBedPartnerWeight === "number" &&
    typeof value.priorityScale === "number" &&
    Array.isArray(value.safetySensitiveGenders)
  );
};

const isPreferenceWeights = (value: unknown): value is PreferenceWeights => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const weights = value as PreferenceWeights;
  return PREFERENCE_KEYS.every((key) => typeof weights[key] === "number");
};

const isPriorityWeights = (value: unknown): value is PriorityWeights => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const weights = value as PriorityWeights;
  return PRIORITY_KEYS.every((key) => typeof weights[key] === "number");
};

const promptPerson = async (
  reader: ReturnType<typeof createInterface>,
  defaults: PersonDefaults,
  usedIds: Set<string>,
  peopleById: Map<string, Person>,
  peopleByKey: Map<string, string>,
  pendingPartnerLinks: Map<string, string>
): Promise<Person> => {
  const name = await promptRequiredString(reader, "Name");
  const id = await promptUniqueId(reader, name, usedIds);
  const pendingMatch = findPendingPartner(pendingPartnerLinks, [id, name]);

  if (pendingMatch) {
    const partnerName = peopleById.get(pendingMatch.partnerId)?.name ?? pendingMatch.partnerId;
    console.log(`Linking with ${partnerName} based on an earlier entry.`);
  }

  const gender = await promptChoice(reader, "Gender", ["female", "male", "nonbinary", "other"], "other");

  const foundHouse = await promptBoolean(reader, "Found the house?", false);
  const handledAgent = await promptBoolean(reader, "Handled the agent?", false);
  const attendedViewing = await promptBoolean(reader, "Attended a viewing?", false);

  const currentBedType = await promptChoice(reader, "Current bed type", ["single", "double"], "single");

  let relationshipStatus: RelationshipStatus = "single";
  let partnerLocation: PartnerLocation = "none";
  let partnerId: string | undefined;

  if (pendingMatch) {
    relationshipStatus = "partnered";
    partnerLocation = "house";
    partnerId = pendingMatch.partnerId;
  } else {
    relationshipStatus = await promptChoice(reader, "Relationship status", ["single", "partnered"], "single");
    if (relationshipStatus === "partnered") {
      partnerLocation = await promptChoice(reader, "Partner location", ["external", "house"], "external");
      if (partnerLocation === "house") {
        partnerId = await promptOptionalString(reader, "Partner name or ID (blank to link later)");
      }
    }
  }

  const cooksOften = await promptBoolean(reader, "Cooks often?", false);

  console.log("");
  console.log("Preference weights: 0-10 scale, higher = more important.");
  console.log("Press Enter to keep defaults.");
  const preferenceWeights = await promptWeightOverrides(
    reader,
    "Preference weight",
    defaults.preferenceWeights,
    PREFERENCE_KEYS
  );

  console.log("");
  console.log("Priority weights: points for contributions, higher = more priority.");
  console.log("Press Enter to keep defaults.");
  const priorityWeights = await promptWeightOverrides(
    reader,
    "Priority weight",
    defaults.priorityWeights,
    PRIORITY_KEYS
  );

  const safetyConcern = await promptOptionalNumber(reader, "Safety concern", defaults.safetyConcern);
  const bedUpgradeWeight = await promptOptionalNumber(
    reader,
    "Bed upgrade weight",
    defaults.bedUpgradeWeight
  );
  const bedDowngradePenalty = await promptOptionalNumber(
    reader,
    "Bed downgrade penalty",
    defaults.bedDowngradePenalty
  );
  const doubleBedPartnerWeight = await promptOptionalNumber(
    reader,
    "Double bed partner weight",
    defaults.doubleBedPartnerWeight
  );

  const relationship: Relationship = {
    status: relationshipStatus,
    partnerLocation,
    ...(partnerId ? { partnerId } : {}),
  };

  const person: Person = {
    id,
    name,
    gender,
    foundHouse,
    handledAgent,
    attendedViewing,
    currentBedType,
    relationship,
    cooksOften,
    ...(preferenceWeights ? { preferenceWeights } : {}),
    ...(priorityWeights ? { priorityWeights } : {}),
    ...(safetyConcern !== undefined ? { safetyConcern } : {}),
    ...(bedUpgradeWeight !== undefined ? { bedUpgradeWeight } : {}),
    ...(bedDowngradePenalty !== undefined ? { bedDowngradePenalty } : {}),
    ...(doubleBedPartnerWeight !== undefined ? { doubleBedPartnerWeight } : {}),
  };

  registerPerson(person, peopleById, peopleByKey);

  if (pendingMatch) {
    pendingPartnerLinks.delete(pendingMatch.key);
    linkPartners(person.id, pendingMatch.partnerId, peopleById);
  }

  if (!pendingMatch && relationship.status === "partnered" && relationship.partnerLocation === "house") {
    const requestedPartner = partnerId?.trim();
    if (requestedPartner) {
      const partnerKey = normalizePartnerKey(requestedPartner);
      const existingPartnerId = peopleByKey.get(partnerKey);
      if (existingPartnerId && existingPartnerId !== person.id) {
        linkPartners(person.id, existingPartnerId, peopleById);
      } else if (existingPartnerId === person.id) {
        console.log("Partner cannot be the same person; skipping link.");
      } else if (!pendingPartnerLinks.has(partnerKey)) {
        pendingPartnerLinks.set(partnerKey, person.id);
      } else {
        console.log("A pending link already exists for that partner.");
      }
    }
  }

  return person;
};

type PendingPartnerMatch = {
  key: string;
  partnerId: string;
};

const normalizePartnerKey = (value: string): string => slugify(value);

const findPendingPartner = (
  pendingPartnerLinks: Map<string, string>,
  values: string[]
): PendingPartnerMatch | undefined => {
  for (const value of values) {
    const key = normalizePartnerKey(value);
    const partnerId = pendingPartnerLinks.get(key);
    if (partnerId) {
      return { key, partnerId };
    }
  }
  return undefined;
};

const registerPerson = (
  person: Person,
  peopleById: Map<string, Person>,
  peopleByKey: Map<string, string>
) => {
  peopleById.set(person.id, person);
  peopleByKey.set(normalizePartnerKey(person.id), person.id);
  peopleByKey.set(normalizePartnerKey(person.name), person.id);
};

const linkPartners = (personId: string, partnerId: string, peopleById: Map<string, Person>) => {
  if (personId === partnerId) {
    return;
  }
  const person = peopleById.get(personId);
  const partner = peopleById.get(partnerId);
  if (!person || !partner) {
    return;
  }
  person.relationship = {
    status: "partnered",
    partnerLocation: "house",
    partnerId: partner.id,
  };
  partner.relationship = {
    status: "partnered",
    partnerLocation: "house",
    partnerId: person.id,
  };
};

const promptUniqueId = async (

  reader: ReturnType<typeof createInterface>,
  name: string,
  usedIds: Set<string>
): Promise<string> => {
  const defaultId = slugify(name);
  while (true) {
    const result = await promptString(reader, "ID", defaultId);
    const id = result.value;
    if (!usedIds.has(id)) {
      usedIds.add(id);
      return id;
    }
    console.log(`ID ${id} is already used. Please choose another.`);
  }
};

const promptWeightOverrides = async <T extends Record<string, number>>(
  reader: ReturnType<typeof createInterface>,
  label: string,
  defaults: T,
  keys: Array<keyof T>
): Promise<Partial<T> | undefined> => {
  const overrides: Partial<T> = {};

  for (const key of keys) {
    const defaultValue = defaults[key] as number;
    const result = await promptNumber(reader, `${label} - ${String(key)}`, defaultValue);
    if (!result.usedDefault && result.value !== defaultValue) {
      overrides[key] = result.value as T[keyof T];
    }
  }

  return Object.keys(overrides).length > 0 ? overrides : undefined;
};

const promptRequiredString = async (
  reader: ReturnType<typeof createInterface>,
  label: string
): Promise<string> => {
  while (true) {
    const result = await promptString(reader, label);
    const value = result.value.trim();
    if (value) {
      return value;
    }
    console.log("Value is required.");
  }
};

const promptOptionalString = async (
  reader: ReturnType<typeof createInterface>,
  label: string
): Promise<string | undefined> => {
  const result = await promptString(reader, label);
  const value = result.value.trim();
  return value ? value : undefined;
};

const promptString = async (
  reader: ReturnType<typeof createInterface>,
  label: string,
  defaultValue?: string
): Promise<PromptResult<string>> => {
  const hint = defaultValue ? ` [${defaultValue}]` : "";
  const answer = (await reader.question(`${label}${hint}: `)).trim();
  if (!answer && defaultValue !== undefined) {
    return { value: defaultValue, usedDefault: true };
  }
  return { value: answer, usedDefault: false };
};

const promptChoice = async <T extends string>(
  reader: ReturnType<typeof createInterface>,
  label: string,
  options: T[],
  defaultValue: T
): Promise<T> => {
  const choices = options.join("/");
  while (true) {
    const answer = (await reader.question(`${label} (${choices}) [${defaultValue}]: `))
      .trim()
      .toLowerCase();
    if (!answer) {
      return defaultValue;
    }
    const match = options.find((option) => option.toLowerCase() === answer);
    if (match) {
      return match;
    }
    console.log(`Choose one of: ${choices}.`);
  }
};

const promptBoolean = async (
  reader: ReturnType<typeof createInterface>,
  label: string,
  defaultValue: boolean
): Promise<boolean> => {
  const hint = defaultValue ? "Y/n" : "y/N";
  while (true) {
    const answer = (await reader.question(`${label} (${hint}): `)).trim().toLowerCase();
    if (!answer) {
      return defaultValue;
    }
    if (["y", "yes"].includes(answer)) {
      return true;
    }
    if (["n", "no"].includes(answer)) {
      return false;
    }
    console.log("Answer with y or n.");
  }
};

const promptNumber = async (
  reader: ReturnType<typeof createInterface>,
  label: string,
  defaultValue: number
): Promise<PromptResult<number>> => {
  while (true) {
    const answer = (await reader.question(`${label} [${defaultValue}]: `)).trim();
    if (!answer) {
      return { value: defaultValue, usedDefault: true };
    }
    const value = Number(answer);
    if (Number.isFinite(value)) {
      return { value, usedDefault: false };
    }
    console.log("Enter a valid number.");
  }
};

const promptOptionalNumber = async (
  reader: ReturnType<typeof createInterface>,
  label: string,
  defaultValue: number
): Promise<number | undefined> => {
  while (true) {
    const answer = (await reader.question(`${label} [${defaultValue}] (blank to keep): `)).trim();
    if (!answer) {
      return undefined;
    }
    const value = Number(answer);
    if (Number.isFinite(value)) {
      return value;
    }
    console.log("Enter a valid number.");
  }
};

const promptPositiveInt = async (
  reader: ReturnType<typeof createInterface>,
  label: string,
  defaultValue: number
): Promise<PromptResult<number>> => {
  while (true) {
    const answer = (await reader.question(`${label} [${defaultValue}]: `)).trim();
    if (!answer) {
      return { value: defaultValue, usedDefault: true };
    }
    const value = Number(answer);
    if (Number.isInteger(value) && value > 0) {
      return { value, usedDefault: false };
    }
    console.log("Enter a positive whole number.");
  }
};

const parsePositiveInt = (value: string, label: string): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label} value: ${value}. Expected a positive whole number.`);
  }
  return parsed;
};

const slugify = (value: string): string => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || "resident";
};

await main();
