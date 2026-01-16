import {
  colors,
  log,
  spinner,
  formatHelp,
  parseArgs as createArgParser,
  resolvePath,
  handleError,
} from "./cli";

type BedType = "single" | "double";

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

type RightmoveListing = {
  url: string;
  title?: string;
  description?: string;
  floorplans: string[];
  images: string[];
};

type ListingSignals = {
  descriptions: string[];
  titles: string[];
  images: string[];
  floorplans: string[];
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

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

type CliOptions = {
  url?: string;
  outPath: string;
  model: string;
  maxImages: number;
  maxFloorplans: number;
  help: boolean;
};

const DEFAULT_OUT_PATH = "data/house.json";
const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_MAX_IMAGES = 8;
const DEFAULT_MAX_FLOORPLANS = 2;

const main = async () => {
  const options = parseCliArgs(Bun.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  if (!options.url) {
    throw new Error(`Missing ${colors.command("--url")}. Provide a Rightmove listing URL.`);
  }

  log.title("Rightmove House Builder");
  log.item("URL", colors.path(options.url));
  log.item("Model", options.model);
  log.blank();

  // Scrape the listing
  const scrapeSpinner = spinner.start("Fetching Rightmove listing...");
  let listing: RightmoveListing;
  try {
    listing = await scrapeRightmove(options.url);
    scrapeSpinner.succeed(
      `Found listing: ${colors.highlight(listing.title ?? "Untitled")} (${listing.images.length} photos, ${listing.floorplans.length} floorplans)`
    );
  } catch (error) {
    scrapeSpinner.fail("Failed to fetch listing");
    throw error;
  }

  // Generate house config with Gemini
  const geminiSpinner = spinner.start("Generating house data with Gemini...");
  let houseConfig: HouseConfig;
  try {
    houseConfig = await buildHouseConfig(listing, options, geminiSpinner);
    assertHouseConfig(houseConfig);
    geminiSpinner.succeed(`Generated config with ${colors.highlight(houseConfig.rooms.length.toString())} rooms`);
  } catch (error) {
    geminiSpinner.fail("Failed to generate house config");
    throw error;
  }

  // Write output
  const resolvedOut = resolvePath(options.outPath);
  await Bun.write(resolvedOut, JSON.stringify(houseConfig, null, 2));

  log.blank();
  log.success(`Wrote house data to ${colors.path(resolvedOut)}`);
  log.blank();

  // Show room summary
  console.log(colors.label("  Rooms:"));
  houseConfig.rooms.forEach((room) => {
    const details = `${room.sizeSqm}sqm, ${room.bedType} bed, floor ${room.floor}`;
    console.log(`    ${colors.highlight(room.name)} ${colors.dim(`(${details})`)}`);
  });
  log.blank();
};

const parseCliArgs = (args: string[]): CliOptions => {
  const { getFlagValue, parsePositiveInt } = createArgParser(args);

  const parsePositiveIntFlag = (flag: string, fallback: number): number => {
    const raw = getFlagValue(flag);
    if (!raw) return fallback;
    return parsePositiveInt(raw, flag);
  };

  return {
    url: getFlagValue("--url"),
    outPath: getFlagValue("--out") ?? DEFAULT_OUT_PATH,
    model: getFlagValue("--model") ?? Bun.env.GEMINI_MODEL ?? DEFAULT_MODEL,
    maxImages: parsePositiveIntFlag("--max-images", DEFAULT_MAX_IMAGES),
    maxFloorplans: parsePositiveIntFlag("--max-floorplans", DEFAULT_MAX_FLOORPLANS),
    help: args.includes("--help") || args.includes("-h"),
  };
};

const printUsage = () => {
  console.log(
    formatHelp({
      name: "Rightmove House Builder",
      description: "Scrape a Rightmove listing and generate house.json using Gemini AI",
      usage: "bun run rightmove.ts --url <rightmove-url> [options]",
      options: [
        { flag: "--url <url>", description: "Rightmove listing URL (required)" },
        { flag: "--out <path>", description: "Output house JSON file", default: DEFAULT_OUT_PATH },
        { flag: "--model <name>", description: "Gemini model to use", default: "GEMINI_MODEL or gemini-1.5-flash" },
        { flag: "--max-images <n>", description: "Max listing photos to analyze", default: String(DEFAULT_MAX_IMAGES) },
        { flag: "--max-floorplans <n>", description: "Max floorplan images to analyze", default: String(DEFAULT_MAX_FLOORPLANS) },
        { flag: "--help, -h", description: "Show this help" },
      ],
      sections: [
        {
          title: "Examples:",
          content: [
            colors.command('bun run rightmove.ts --url "https://rightmove.co.uk/..."'),
            colors.command('bun run rightmove.ts --url "..." --out my-house.json'),
            colors.command('bun run rightmove.ts --url "..." --max-images 12'),
          ],
        },
      ],
    })
  );
};

const scrapeRightmove = async (url: string): Promise<RightmoveListing> => {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "housing-algo/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const jsonLdSignals = extractJsonLdSignals(html);
  const embeddedSignals = extractEmbeddedSignals(html);

  const descriptions = uniqueStrings([
    ...jsonLdSignals.descriptions,
    ...embeddedSignals.descriptions,
  ]);
  const titles = uniqueStrings([...jsonLdSignals.titles, ...embeddedSignals.titles]);
  const imageUrls = uniqueStrings([...jsonLdSignals.images, ...embeddedSignals.images]);

  const floorplanUrls = uniqueStrings([
    ...embeddedSignals.floorplans,
    ...imageUrls.filter((imageUrl) => imageUrl.toLowerCase().includes("floorplan")),
  ]);
  const pictureUrls = imageUrls.filter((imageUrl) => !floorplanUrls.includes(imageUrl));

  return {
    url,
    title: pickLongest(titles),
    description: pickLongest(descriptions),
    floorplans: floorplanUrls,
    images: pictureUrls,
  };
};

const extractJsonLdSignals = (html: string): ListingSignals => {
  const results: ListingSignals = {
    descriptions: [],
    titles: [],
    images: [],
    floorplans: [],
  };

  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(regex)) {
    const raw = match[1]?.trim();
    if (!raw) {
      continue;
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      mergeSignals(results, extractSignalsFromObject(parsed));
    } catch {
      continue;
    }
  }

  return normalizeSignals(results);
};

const extractEmbeddedSignals = (html: string): ListingSignals => {
  const results: ListingSignals = {
    descriptions: [],
    titles: [],
    images: [],
    floorplans: [],
  };

  const markers = [
    "window.PAGE_MODEL",
    "window.__PRELOADED_STATE__",
    "window.__INITIAL_STATE__",
    "__NEXT_DATA__",
  ];

  markers.forEach((marker) => {
    const jsonText = extractJsonFromMarker(html, marker);
    if (!jsonText) {
      return;
    }
    try {
      const parsed = JSON.parse(jsonText) as unknown;
      mergeSignals(results, extractSignalsFromObject(parsed));
    } catch {
      return;
    }
  });

  return normalizeSignals(results);
};

const extractJsonFromMarker = (html: string, marker: string): string | null => {
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }
  const braceIndex = html.indexOf("{", markerIndex);
  if (braceIndex === -1) {
    return null;
  }
  return extractJsonBlock(html, braceIndex);
};

const extractJsonBlock = (text: string, startIndex: number): string | null => {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let start = -1;

  for (let index = startIndex; index < text.length; index++) {
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

const extractSignalsFromObject = (data: unknown): ListingSignals => {
  const descriptions = collectStringsByKey(data, (key) =>
    ["description", "summary", "propertydescription"].includes(key)
  );
  const titles = collectStringsByKey(data, (key) =>
    ["name", "headline", "displayaddress", "address", "propertyaddress"].includes(key)
  );
  const floorplans = collectUrlsByKey(data, (key) => key.includes("floorplan"));
  const images = collectUrlsByKey(
    data,
    (key) => (key.includes("image") || key.includes("photo") || key.includes("gallery")) &&
      !key.includes("floorplan")
  );

  return {
    descriptions,
    titles,
    images,
    floorplans,
  };
};

const collectStringsByKey = (
  data: unknown,
  keyMatcher: (key: string) => boolean
): string[] => {
  const results: string[] = [];

  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") {
      return;
    }

    Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
      const normalizedKey = key.toLowerCase();
      if (keyMatcher(normalizedKey)) {
        results.push(...collectStringsFromValue(child));
      }
      visit(child);
    });
  };

  visit(data);
  return results;
};

const collectStringsFromValue = (value: unknown): string[] => {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStringsFromValue(item));
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((item) =>
      collectStringsFromValue(item)
    );
  }
  return [];
};

const collectUrlsByKey = (data: unknown, keyMatcher: (key: string) => boolean): string[] => {
  return collectStringsByKey(data, keyMatcher)
    .map((value) => normalizeUrlCandidate(value))
    .filter((value) => isUrl(value));
};

const normalizeUrlCandidate = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }
  return trimmed;
};

const isUrl = (value: string): boolean => /^https?:\/\//i.test(value);

const normalizeSignals = (signals: ListingSignals): ListingSignals => ({
  descriptions: uniqueStrings(signals.descriptions),
  titles: uniqueStrings(signals.titles),
  images: uniqueStrings(signals.images),
  floorplans: uniqueStrings(signals.floorplans),
});

const mergeSignals = (target: ListingSignals, source: ListingSignals) => {
  target.descriptions.push(...source.descriptions);
  target.titles.push(...source.titles);
  target.images.push(...source.images);
  target.floorplans.push(...source.floorplans);
};

const uniqueStrings = (values: string[]): string[] => {
  const seen = new Set<string>();
  const results: string[] = [];
  values.forEach((value) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      results.push(trimmed);
    }
  });
  return results;
};

const pickLongest = (values: string[]): string | undefined => {
  if (values.length === 0) {
    return undefined;
  }
  return values.reduce((longest, current) =>
    current.length > longest.length ? current : longest
  );
};

const buildHouseConfig = async (
  listing: RightmoveListing,
  options: CliOptions,
  geminiSpinner: ReturnType<typeof spinner.start>
): Promise<HouseConfig> => {
  const apiKey = Bun.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY in the environment.");
  }

  const floorplans = listing.floorplans.slice(0, options.maxFloorplans);
  const photos = listing.images.slice(0, options.maxImages);
  const parts: GeminiPart[] = [
    {
      text: buildPrompt(listing, floorplans, photos),
    },
  ];

  geminiSpinner.text = "Fetching listing images...";
  const floorplanParts = await buildInlineImageParts(floorplans);
  const photoParts = await buildInlineImageParts(photos);
  parts.push(...floorplanParts, ...photoParts);

  geminiSpinner.text = `Sending request to ${colors.highlight(options.model)}...`;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${options.model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts,
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const responseText = extractGeminiText(data);
  const jsonPayload = parseJsonFromText(responseText);
  return jsonPayload as HouseConfig;
};

const buildInlineImageParts = async (urls: string[]): Promise<GeminiInlinePart[]> => {
  const parts: GeminiInlinePart[] = [];
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const buffer = await response.arrayBuffer();
      const mimeType = response.headers.get("content-type") ?? "application/octet-stream";
      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: Buffer.from(buffer).toString("base64"),
        },
      });
    } catch (error) {
      log.warn(`Skipping image ${colors.dim(url)}: ${String(error)}`);
    }
  }
  return parts;
};

const buildPrompt = (
  listing: RightmoveListing,
  floorplans: string[],
  photos: string[]
): string => {
  const description = listing.description
    ? trimToLength(listing.description, 4000)
    : "(no description found)";
  const title = listing.title ?? "(no title found)";
  const floorplanList = floorplans.length > 0 ? floorplans.join("\n") : "(none found)";
  const photoList = photos.length > 0 ? photos.join("\n") : "(none found)";

  return [
    "You are generating a HouseConfig JSON for the housing-algo app.",
    "Return only valid JSON, no markdown or commentary.",
    "",
    "Schema:",
    "{",
    "  \"name\": string,",
    "  \"rooms\": [",
    "    {",
    "      \"id\": string,",
    "      \"name\": string,",
    "      \"sizeSqm\": number,",
    "      \"windows\": number,",
    "      \"attractiveness\": number,",
    "      \"bedType\": \"single\" | \"double\",",
    "      \"floor\": number,",
    "      \"isFrontFacing\": boolean,",
    "      \"noise\": number,",
    "      \"storage\": number,",
    "      \"sunlight\": number,",
    "      \"nearKitchen\": boolean,",
    "      \"ensuite\": boolean",
    "    }",
    "  ]",
    "}",
    "",
    "Guidelines:",
    "- Use the listing description, floorplan, and photos to infer rooms.",
    "- Estimate missing fields if necessary.",
    "- Use square meters for sizeSqm.",
    "- Score attractiveness/noise/storage/sunlight from 0-10.",
    "- Use floor 0 for ground floor, 1 for first floor, etc.",
    "",
    `Listing URL: ${listing.url}`,
    `Listing title: ${title}`,
    "",
    "Listing description:",
    description,
    "",
    "Floorplan URLs:",
    floorplanList,
    "",
    "Photo URLs:",
    photoList,
  ].join("\n");
};

const trimToLength = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}...`;
};

const extractGeminiText = (response: GeminiResponse): string => {
  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const text = parts.map((part) => part.text ?? "").join("\n").trim();
  if (!text) {
    throw new Error("Gemini response did not include text content.");
  }
  return text;
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

const assertHouseConfig = (house: HouseConfig) => {
  if (!house || typeof house.name !== "string" || !Array.isArray(house.rooms)) {
    throw new Error("Gemini output must include { name, rooms }.");
  }

  house.rooms.forEach((room, index) => {
    if (!room || typeof room.id !== "string" || typeof room.name !== "string") {
      throw new Error(`Room ${index + 1} is missing id or name.`);
    }
    if (!isBedType(room.bedType)) {
      throw new Error(`Room ${room.name} has invalid bedType.`);
    }
    const numericFields: Array<[string, number]> = [
      ["sizeSqm", room.sizeSqm],
      ["windows", room.windows],
      ["attractiveness", room.attractiveness],
      ["floor", room.floor],
      ["noise", room.noise],
      ["storage", room.storage],
      ["sunlight", room.sunlight],
    ];

    numericFields.forEach(([field, value]) => {
      if (typeof value !== "number" || Number.isNaN(value)) {
        throw new Error(`Room ${room.name} has invalid ${field}.`);
      }
    });

    const booleanFields: Array<[string, boolean]> = [
      ["isFrontFacing", room.isFrontFacing],
      ["nearKitchen", room.nearKitchen],
      ["ensuite", room.ensuite],
    ];

    booleanFields.forEach(([field, value]) => {
      if (typeof value !== "boolean") {
        throw new Error(`Room ${room.name} has invalid ${field}.`);
      }
    });
  });
};

const isBedType = (value: unknown): value is BedType => value === "single" || value === "double";

main().catch(handleError);
