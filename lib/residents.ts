import prompts from "prompts";
import {
  colors,
  symbols,
  log,
  formatHelp,
  parseArgs as createArgParser,
  resolvePath,
  handleError,
  box,
} from "./cli";

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
  floor: number;
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
  singleBedInternalCoupleWeight: number;
  doubleBedInternalCoupleWeight: number;
  priorityScale: number;
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

type PeopleConfig = {
  defaults: PersonDefaults;
  people: Person[];
};

type CliOptions = {
  outPath?: string;
  defaultsPath?: string;
  count?: number;
  help: boolean;
};

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
    floor: 2,
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
  singleBedInternalCoupleWeight: 4,
  doubleBedInternalCoupleWeight: 5,
  priorityScale: 10,
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
  "floor",
];

const PRIORITY_KEYS: Array<keyof PriorityWeights> = [
  "foundHouse",
  "handledAgent",
  "attendedViewing",
];

const main = async () => {
  const options = parseCliArgs(Bun.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  log.title("Residents Builder");

  const defaults = await loadDefaults(options.defaultsPath);

  let count = options.count;
  if (!count) {
    const response = await prompts({
      type: "number",
      name: "count",
      message: colors.label("How many residents?"),
      initial: 1,
      min: 1,
      validate: (v) => (v > 0 ? true : "Enter a positive number"),
    });
    count = response.count ?? 1;
  }

  const usedIds = new Set<string>();
  const people: Person[] = [];
  const peopleById = new Map<string, Person>();
  const peopleByKey = new Map<string, string>();
  const pendingPartnerLinks = new Map<string, string>();

  for (let index = 0; index < (count ?? 1); index += 1) {
    log.blank();
    console.log(
      box(`${colors.highlight(`Resident ${index + 1} of ${count}`)}`, {
        padding: 0,
        borderColor: colors.info,
      })
    );
    log.blank();

    const person = await promptPerson(
      defaults,
      usedIds,
      peopleById,
      peopleByKey,
      pendingPartnerLinks
    );
    people.push(person);

    log.success(`Added ${colors.highlight(person.name)}`);
  }

  if (pendingPartnerLinks.size > 0) {
    log.blank();
    log.warn("Unlinked in-house partner references:");
    pendingPartnerLinks.forEach((personId, key) => {
      const person = peopleById.get(personId);
      const label = person ? `${person.name} (${person.id})` : personId;
      console.log(`  ${symbols.bullet} ${colors.dim(label)} ${symbols.arrow} ${colors.dim(key)}`);
    });
  }

  const config: PeopleConfig = {
    defaults,
    people,
  };

  let outPath = options.outPath;
  if (!outPath) {
    const response = await prompts({
      type: "text",
      name: "outPath",
      message: colors.label("Output path for people.json"),
      validate: (v) => (v.trim() ? true : "Output path is required"),
    });
    if (!response.outPath) {
      log.error("Output path is required");
      process.exit(1);
    }
    outPath = response.outPath;
  }

  const resolvedOut = resolvePath(outPath!);
  
  // Check if path is a directory and append people.json if needed
  let finalPath = resolvedOut;
  try {
    const stat = await Bun.file(resolvedOut).stat();
    if (stat.isDirectory()) {
      finalPath = resolvedOut.endsWith("/") 
        ? `${resolvedOut}people.json` 
        : `${resolvedOut}/people.json`;
      log.info(`Directory detected, writing to ${colors.path(finalPath)}`);
    }
  } catch {
    // Path doesn't exist yet or isn't accessible - check if it ends with /
    if (resolvedOut.endsWith("/")) {
      finalPath = `${resolvedOut}people.json`;
      log.info(`Directory path detected, writing to ${colors.path(finalPath)}`);
    }
  }
  
  await Bun.write(finalPath, JSON.stringify(config, null, 2));

  log.blank();
  log.success(`Saved ${colors.highlight(people.length.toString())} residents to ${colors.path(finalPath)}`);
  log.blank();
};

const parseCliArgs = (args: string[]): CliOptions => {
  const { getFlagValue, parsePositiveInt } = createArgParser(args);

  const countRaw = getFlagValue("--count");
  const count = countRaw ? parsePositiveInt(countRaw, "--count") : undefined;

  return {
    outPath: getFlagValue("--out"),
    defaultsPath: getFlagValue("--defaults"),
    count,
    help: args.includes("--help") || args.includes("-h"),
  };
};

const printUsage = () => {
  console.log(
    formatHelp({
      name: "Residents Builder",
      description: "Interactively create a people.json configuration file",
      usage: "bun run residents.ts [options]",
      options: [
        { flag: "--out <path>", description: "Output people JSON file" },
        { flag: "--defaults <path>", description: "Defaults JSON file to load from" },
        { flag: "--count <number>", description: "Number of residents to enter" },
        { flag: "--help, -h", description: "Show this help" },
      ],
      sections: [
        {
          title: "Examples:",
          content: [
            colors.command("bun run residents.ts --out people.json"),
            colors.command("bun run residents.ts --count 5 --out people.json"),
            colors.command("bun run residents.ts --defaults existing-people.json"),
          ],
        },
        {
          title: "Note:",
          content: [
            "If output path is not provided, you will be prompted to enter it.",
          ],
        },
      ],
    })
  );
};

const loadDefaults = async (defaultsPath?: string): Promise<PersonDefaults> => {
  if (!defaultsPath) {
    log.info("Using built-in defaults");
    return FALLBACK_DEFAULTS;
  }

  const resolved = resolvePath(defaultsPath);
  const file = Bun.file(resolved);

  if (!(await file.exists())) {
    throw new Error(`Defaults file not found: ${colors.path(resolved)}`);
  }

  const text = await file.text();
  const parsed = JSON.parse(text) as unknown;
  const defaults = extractDefaults(parsed);
  if (!defaults) {
    throw new Error(`Defaults file ${colors.path(resolved)} does not contain valid defaults.`);
  }
  log.info(`Loaded defaults from ${colors.path(resolved)}`);
  return defaults;
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
    typeof value.priorityScale === "number"
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
  defaults: PersonDefaults,
  usedIds: Set<string>,
  peopleById: Map<string, Person>,
  peopleByKey: Map<string, string>,
  pendingPartnerLinks: Map<string, string>
): Promise<Person> => {
  // Basic info
  const { name } = await prompts({
    type: "text",
    name: "name",
    message: colors.label("Name"),
    validate: (v) => (v.trim() ? true : "Name is required"),
  });

  const defaultId = slugify(name);
  let id = defaultId;

  while (usedIds.has(id)) {
    const response = await prompts({
      type: "text",
      name: "id",
      message: colors.label(`ID (${colors.dim(defaultId)} is taken)`),
      initial: defaultId,
      validate: (v) => {
        if (!v.trim()) return "ID is required";
        if (usedIds.has(v)) return "ID already used";
        return true;
      },
    });
    id = response.id;
  }

  if (id !== defaultId) {
    const response = await prompts({
      type: "text",
      name: "id",
      message: colors.label("ID"),
      initial: defaultId,
    });
    if (response.id && !usedIds.has(response.id)) {
      id = response.id;
    }
  }
  usedIds.add(id);

  const pendingMatch = findPendingPartner(pendingPartnerLinks, [id, name]);
  if (pendingMatch) {
    const partnerName = peopleById.get(pendingMatch.partnerId)?.name ?? pendingMatch.partnerId;
    log.info(`Linking with ${colors.highlight(partnerName)} based on an earlier entry`);
  }

  const { gender } = await prompts({
    type: "select",
    name: "gender",
    message: colors.label("Gender"),
    choices: [
      { title: "Female", value: "female" },
      { title: "Male", value: "male" },
      { title: "Non-binary", value: "nonbinary" },
      { title: "Other", value: "other" },
    ],
    initial: 3,
  });

  // Contributions
  const contributions = await prompts([
    {
      type: "confirm",
      name: "foundHouse",
      message: colors.label("Found the house?"),
      initial: false,
    },
    {
      type: "confirm",
      name: "handledAgent",
      message: colors.label("Handled the agent?"),
      initial: false,
    },
    {
      type: "confirm",
      name: "attendedViewing",
      message: colors.label("Attended a viewing?"),
      initial: false,
    },
  ]);

  const { currentBedType } = await prompts({
    type: "select",
    name: "currentBedType",
    message: colors.label("Current bed type"),
    choices: [
      { title: "Single", value: "single" },
      { title: "Double", value: "double" },
    ],
  });

  // Relationship
  let relationshipStatus: RelationshipStatus = "single";
  let partnerLocation: PartnerLocation = "none";
  let partnerId: string | undefined;

  if (pendingMatch) {
    relationshipStatus = "partnered";
    partnerLocation = "house";
    partnerId = pendingMatch.partnerId;
  } else {
    const { status } = await prompts({
      type: "select",
      name: "status",
      message: colors.label("Relationship status"),
      choices: [
        { title: "Single", value: "single" },
        { title: "Partnered", value: "partnered" },
      ],
    });
    relationshipStatus = status;

    if (relationshipStatus === "partnered") {
      const { location } = await prompts({
        type: "select",
        name: "location",
        message: colors.label("Partner location"),
        choices: [
          { title: "External (not in house)", value: "external" },
          { title: "In-house (another resident)", value: "house" },
        ],
      });
      partnerLocation = location;

      if (partnerLocation === "house") {
        const { partner } = await prompts({
          type: "text",
          name: "partner",
          message: colors.label("Partner name or ID (blank to link later)"),
        });
        partnerId = partner?.trim() || undefined;
      }
    }
  }

  const { cooksOften } = await prompts({
    type: "confirm",
    name: "cooksOften",
    message: colors.label("Cooks often?"),
    initial: false,
  });

  const { hasSafetyConcern } = await prompts({
    type: "confirm",
    name: "hasSafetyConcern",
    message: colors.label("Has safety concerns? (prefers upper/back rooms)"),
    initial: false,
  });

  // Weight overrides (optional section)
  const { customizeWeights } = await prompts({
    type: "confirm",
    name: "customizeWeights",
    message: colors.label("Customize preference/priority weights?"),
    initial: false,
  });

  let preferenceWeights: Partial<PreferenceWeights> | undefined;
  let priorityWeights: Partial<PriorityWeights> | undefined;
  let safetyConcern: number | undefined;
  let bedUpgradeWeight: number | undefined;
  let bedDowngradePenalty: number | undefined;
  let doubleBedPartnerWeight: number | undefined;

  if (customizeWeights) {
    log.blank();
    console.log(`  ${colors.dim("Preference weights (0-10 scale, higher = more important)")}`);
    console.log(`  ${colors.dim("Press Enter to keep default value")}`);
    log.blank();

    preferenceWeights = await promptWeightOverrides(
      "Preference",
      defaults.preferenceWeights,
      PREFERENCE_KEYS
    );

    log.blank();
    console.log(`  ${colors.dim("Priority weights (points for contributions)")}`);
    log.blank();

    priorityWeights = await promptWeightOverrides(
      "Priority",
      defaults.priorityWeights,
      PRIORITY_KEYS
    );

    const advancedOverrides = await prompts([
      {
        type: "number",
        name: "safetyConcern",
        message: colors.label(`Safety concern (default: ${defaults.safetyConcern})`),
        initial: defaults.safetyConcern,
      },
      {
        type: "number",
        name: "bedUpgradeWeight",
        message: colors.label(`Bed upgrade weight (default: ${defaults.bedUpgradeWeight})`),
        initial: defaults.bedUpgradeWeight,
      },
      {
        type: "number",
        name: "bedDowngradePenalty",
        message: colors.label(`Bed downgrade penalty (default: ${defaults.bedDowngradePenalty})`),
        initial: defaults.bedDowngradePenalty,
      },
      {
        type: "number",
        name: "doubleBedPartnerWeight",
        message: colors.label(`Double bed partner weight (default: ${defaults.doubleBedPartnerWeight})`),
        initial: defaults.doubleBedPartnerWeight,
      },
    ]);

    if (advancedOverrides.safetyConcern !== defaults.safetyConcern) {
      safetyConcern = advancedOverrides.safetyConcern;
    }
    if (advancedOverrides.bedUpgradeWeight !== defaults.bedUpgradeWeight) {
      bedUpgradeWeight = advancedOverrides.bedUpgradeWeight;
    }
    if (advancedOverrides.bedDowngradePenalty !== defaults.bedDowngradePenalty) {
      bedDowngradePenalty = advancedOverrides.bedDowngradePenalty;
    }
    if (advancedOverrides.doubleBedPartnerWeight !== defaults.doubleBedPartnerWeight) {
      doubleBedPartnerWeight = advancedOverrides.doubleBedPartnerWeight;
    }
  }

  const relationship: Relationship = {
    status: relationshipStatus,
    partnerLocation,
    ...(partnerId ? { partnerId } : {}),
  };

  const person: Person = {
    id,
    name,
    gender,
    foundHouse: contributions.foundHouse ?? false,
    handledAgent: contributions.handledAgent ?? false,
    attendedViewing: contributions.attendedViewing ?? false,
    currentBedType,
    relationship,
    cooksOften: cooksOften ?? false,
    ...(hasSafetyConcern ? { hasSafetyConcern } : {}),
    ...(preferenceWeights && Object.keys(preferenceWeights).length > 0 ? { preferenceWeights } : {}),
    ...(priorityWeights && Object.keys(priorityWeights).length > 0 ? { priorityWeights } : {}),
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
        log.success(`Linked with ${colors.highlight(existingPartnerId)}`);
      } else if (existingPartnerId === person.id) {
        log.warn("Partner cannot be the same person; skipping link");
      } else if (!pendingPartnerLinks.has(partnerKey)) {
        pendingPartnerLinks.set(partnerKey, person.id);
        log.info(`Will link with "${requestedPartner}" when they're added`);
      } else {
        log.warn("A pending link already exists for that partner");
      }
    }
  }

  return person;
};

const promptWeightOverrides = async <T extends Record<string, number>>(
  label: string,
  defaults: T,
  keys: Array<keyof T>
): Promise<Partial<T> | undefined> => {
  const overrides: Partial<T> = {};

  for (const key of keys) {
    const defaultValue = defaults[key] as number;
    const { value } = await prompts({
      type: "number",
      name: "value",
      message: colors.label(`${label} - ${colors.highlight(String(key))}`),
      initial: defaultValue,
    });

    if (value !== undefined && value !== defaultValue) {
      overrides[key] = value as T[keyof T];
    }
  }

  return Object.keys(overrides).length > 0 ? overrides : undefined;
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

const slugify = (value: string): string => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || "resident";
};

main().catch(handleError);
