/**
 * AI/Gemini scoring module.
 *
 * This module handles all Gemini API interactions for AI-based room scoring.
 */

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { GoogleGenAI, type Content, type Part } from "@google/genai";
import { colors, log, spinner, resolvePath } from "./cli";
import type {
  HouseConfig,
  PeopleConfig,
  RoomMetrics,
  PersonMeta,
  ScoreResult,
  GeminiAttachment,
  GeminiInput,
  GeminiScorePayload,
  GeminiCliOptions,
  AiOptions,
  ThinkingLevel,
} from "./types";

export const DEFAULT_GEMINI_TIMEOUT_MS = 30000;
export const DEFAULT_GEMINI_RETRIES = 1;

// ─────────────────────────────────────────────────────────────────────────────
// File Handling
// ─────────────────────────────────────────────────────────────────────────────

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
  return segments.length > 0
    ? (segments[segments.length - 1] ?? filePath)
    : filePath;
};

const readGeminiAttachment = async (
  filePath: string,
  options: { defaultMimeType: string; forceBase64?: boolean },
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

// ─────────────────────────────────────────────────────────────────────────────
// Payload Building
// ─────────────────────────────────────────────────────────────────────────────

const buildGeminiPayload = async (
  options: GeminiCliOptions,
): Promise<GeminiInput> => {
  const data = await Promise.all(
    options.dataPaths.map((path) =>
      readGeminiAttachment(path, {
        defaultMimeType: "text/plain",
      }),
    ),
  );

  const images = await Promise.all(
    options.imagePaths.map((path) =>
      readGeminiAttachment(path, {
        defaultMimeType: "application/octet-stream",
        forceBase64: true,
      }),
    ),
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
  allowQuestions: boolean,
): string => {
  const roomOrder = houseConfig.rooms
    .map((room) => `${room.id} (${room.name})`)
    .join(", ");
  const peopleOrder = peopleConfig.people
    .map((person) => `${person.id} (${person.name})`)
    .join(", ");
  const webpages =
    gemini.webpages.length > 0 ? gemini.webpages.join("\n") : "(none)";

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
    "FAIRNESS REQUIREMENT:",
    "The order in which people are listed is arbitrary and MUST NOT influence your scoring.",
    "Evaluate each person independently based solely on their individual preferences,",
    "needs, priorities, and how well each room fits them. Do not favor people listed first.",
    "",
    "INTERNAL COUPLES GUIDANCE:",
    "When two people are in a relationship and both live in the house (partnerLocation: 'house'),",
    "and rooms with single beds are >=1, ",
    "assign them ONE double room and ONE single room - NOT two large double rooms.",
    "Giving an internal couple two big double rooms is wasteful and unfair to others.",
    "",
    "EXTERNAL COUPLES GUIDANCE:",
    "When a person is in a relationship with their partner external to the house (partnerLocation: 'external')",
    "They should have priority over double bed rooms.",
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

const buildGeminiParts = (prompt: string, gemini: GeminiInput): Part[] => {
  const parts: Part[] = [{ text: prompt }];

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
      inlineData: {
        mimeType: attachment.mimeType,
        data: attachment.content,
      },
    });
  });

  gemini.images.forEach((image) => {
    parts.push({ text: `Image: ${image.name}` });
    parts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: image.content,
      },
    });
  });

  return parts;
};

// ─────────────────────────────────────────────────────────────────────────────
// API Requests
// ─────────────────────────────────────────────────────────────────────────────

const getThinkingBudget = (level: ThinkingLevel): number | undefined => {
  switch (level) {
    case "none":
      return 0;
    case "low":
      return 1024;
    case "medium":
      return 8192;
    case "high":
      return 24576;
    default:
      return undefined;
  }
};

const requestGemini = async (
  client: GoogleGenAI,
  model: string,
  contents: Content[],
  options: {
    timeoutMs: number;
    debug: boolean;
    round: number;
    maxRounds: number;
    thinkingLevel: ThinkingLevel;
  },
): Promise<string> => {
  if (options.debug) {
    log.info(
      `Request: model=${colors.highlight(model)}, timeout=${options.timeoutMs}ms, round=${options.round}/${options.maxRounds}, thinking=${options.thinkingLevel}`,
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  const thinkingBudget = getThinkingBudget(options.thinkingLevel);

  try {
    const response = await client.models.generateContent({
      model,
      contents,
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        abortSignal: controller.signal,
        thinkingConfig:
          thinkingBudget !== undefined ? { thinkingBudget } : undefined,
      },
    });

    const text = response.text?.trim() ?? "";
    if (!text) {
      throw new Error("Gemini response did not include text content.");
    }
    return text;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Gemini request timed out after ${options.timeoutMs}ms.`);
    }
    if (options.debug && error instanceof Error) {
      log.error(`Gemini error: ${error.message}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Response Parsing
// ─────────────────────────────────────────────────────────────────────────────

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
    const withoutFence = trimmed
      .replace(/^```(?:json)?\n?/i, "")
      .replace(/```$/i, "");
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

// ─────────────────────────────────────────────────────────────────────────────
// Score Normalization
// ─────────────────────────────────────────────────────────────────────────────

const normalizeGeminiScores = (
  scores: number[][],
  peopleCount: number,
  roomCount: number,
): number[][] => {
  if (!Array.isArray(scores) || scores.length !== peopleCount) {
    throw new Error("Gemini scores must include one row per person.");
  }

  return scores.map((row, rowIndex) => {
    if (!Array.isArray(row) || row.length !== roomCount) {
      throw new Error(
        `Gemini scores row ${rowIndex + 1} must have ${roomCount} entries.`,
      );
    }
    return row.map((value, colIndex) => {
      const numeric = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(numeric)) {
        throw new Error(
          `Gemini score at [${rowIndex + 1}, ${colIndex + 1}] is not numeric.`,
        );
      }
      return numeric;
    });
  });
};

const normalizeReasons = (
  reasons: unknown,
  peopleCount: number,
  roomCount: number,
): string[][] | undefined => {
  if (!Array.isArray(reasons)) {
    return undefined;
  }

  if (reasons.length !== peopleCount) {
    throw new Error("Reasons matrix must include one row per person.");
  }

  return reasons.map((row, rowIndex) => {
    if (!Array.isArray(row) || row.length !== roomCount) {
      throw new Error(
        `Reasons row ${rowIndex + 1} must have ${roomCount} entries.`,
      );
    }
    return row.map((value, colIndex) => {
      if (typeof value !== "string") {
        throw new Error(
          `Reason at [${rowIndex + 1}, ${colIndex + 1}] must be text.`,
        );
      }
      return value.trim();
    });
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Interactive Questions
// ─────────────────────────────────────────────────────────────────────────────

const promptGeminiQuestions = async (
  reader: ReturnType<typeof createInterface> | null,
  questions: string[],
): Promise<string[]> => {
  if (!reader) {
    throw new Error(
      "Gemini follow-up questions require an interactive terminal.",
    );
  }

  const answers: string[] = [];
  for (const question of questions) {
    if (!reader.terminal) {
      throw new Error(
        "Gemini follow-up questions require an interactive terminal.",
      );
    }
    const answer = await reader.question(`Gemini asks: ${question}\n> `);
    answers.push(answer.trim());
  }
  return answers;
};

const formatGeminiAnswers = (
  questions: string[],
  answers: string[],
): string => {
  const lines = ["Answers to your questions:"];
  questions.forEach((question, index) => {
    lines.push(`Q: ${question}`);
    lines.push(`A: ${answers[index] ?? ""}`);
  });
  lines.push("Please return the scores and reasons JSON now.");
  return lines.join("\n");
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Entry Points
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build AI scores using the configured AI provider.
 * Currently only Gemini is supported.
 */
export const buildAiScores = async (
  peopleConfig: PeopleConfig,
  houseConfig: HouseConfig,
  _roomMetrics: RoomMetrics[],
  _peopleMeta: PersonMeta[],
  aiOptions: AiOptions,
): Promise<ScoreResult> => {
  return buildGeminiScores(peopleConfig, houseConfig, aiOptions.gemini);
};

/**
 * Build room scores using the Gemini AI model.
 */
export const buildGeminiScores = async (
  peopleConfig: PeopleConfig,
  houseConfig: HouseConfig,
  geminiOptions: GeminiCliOptions,
): Promise<ScoreResult> => {
  const apiKey = Bun.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini mode requires GEMINI_API_KEY in the environment.");
  }

  const client = new GoogleGenAI({ apiKey });
  const model =
    geminiOptions.model ?? Bun.env.GEMINI_MODEL ?? "gemini-3-flash-preview";
  const gemini = await buildGeminiPayload(geminiOptions);
  const prompt = buildGeminiPrompt(
    peopleConfig,
    houseConfig,
    gemini,
    geminiOptions.allowQuestions,
  );

  if (geminiOptions.debug) {
    log.info(`Model: ${colors.highlight(model)}`);
    log.info(`Prompt: ${prompt.length} chars`);
    log.info(
      `Attachments: data=${gemini.data.length}, images=${gemini.images.length}, webpages=${gemini.webpages.length}`,
    );
    if (gemini.data.length > 0) {
      const dataNames = gemini.data.map(
        (item) => `${item.name} (${item.mimeType}, ${item.encoding})`,
      );
      log.info(`Data files: ${dataNames.join(", ")}`);
    }
    if (gemini.images.length > 0) {
      const imageNames = gemini.images.map(
        (item) => `${item.name} (${item.mimeType})`,
      );
      log.info(`Images: ${imageNames.join(", ")}`);
    }
    log.blank();
    log.info("Full prompt being sent to Gemini:");
    console.log(colors.dim("─".repeat(60)));
    console.log(prompt);
    console.log(colors.dim("─".repeat(60)));
    log.blank();
  }

  const contents: Content[] = [
    {
      role: "user",
      parts: buildGeminiParts(prompt, gemini),
    },
  ];

  const reader = geminiOptions.allowQuestions
    ? createInterface({ input, output })
    : null;
  const maxRounds = geminiOptions.allowQuestions ? 3 : 1;
  const timeoutMs = geminiOptions.timeoutMs ?? DEFAULT_GEMINI_TIMEOUT_MS;
  const partsCount = contents[0]?.parts?.length ?? 0;

  if (geminiOptions.debug) {
    log.info(
      `Payload: parts=${partsCount}, allowQuestions=${geminiOptions.allowQuestions}, retries=${geminiOptions.retries}, timeout=${timeoutMs}ms`,
    );
  }

  const geminiSpinner = spinner.create("Requesting Gemini scores...");

  try {
    for (let round = 0; round < maxRounds; round += 1) {
      const attemptMax = Math.max(0, geminiOptions.retries);
      for (let attempt = 0; attempt <= attemptMax; attempt += 1) {
        geminiSpinner.start();
        geminiSpinner.text = `Gemini scoring (round ${round + 1}/${maxRounds})...`;
        try {
          const responseText = await requestGemini(client, model, contents, {
            timeoutMs,
            debug: geminiOptions.debug,
            round: round + 1,
            maxRounds,
            thinkingLevel: geminiOptions.thinkingLevel,
          });

          if (geminiOptions.debug) {
            geminiSpinner.stop();
            log.info("Gemini response text:");
            console.log(responseText);
          }

          const payload = parseGeminiScorePayload(responseText);

          if (geminiOptions.debug) {
            log.info("Parsed payload:");
            console.log(JSON.stringify(payload, null, 2));
          }

          if (payload.scores) {
            const scores = normalizeGeminiScores(
              payload.scores,
              peopleConfig.people.length,
              houseConfig.rooms.length,
            );
            const reasons = normalizeReasons(
              payload.reasons,
              peopleConfig.people.length,
              houseConfig.rooms.length,
            );
            if (!reasons) {
              geminiSpinner.fail("Gemini response missing reasons");
              throw new Error(
                "Gemini response must include reasons for each score.",
              );
            }
            geminiSpinner.succeed("Gemini scores received");
            return { scores, reasons };
          }

          if (!geminiOptions.allowQuestions) {
            geminiSpinner.fail("Gemini did not return scores");
            throw new Error("Gemini did not return scores.");
          }

          if (
            !Array.isArray(payload.questions) ||
            payload.questions.length === 0
          ) {
            geminiSpinner.fail("Gemini did not return questions or scores");
            throw new Error("Gemini did not return questions or scores.");
          }

          geminiSpinner.info("Gemini has follow-up questions");
          const answers = await promptGeminiQuestions(
            reader,
            payload.questions,
          );
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
          const message =
            error instanceof Error ? error.message : String(error);
          if (!message.includes("timed out") || attempt >= attemptMax) {
            geminiSpinner.fail("Gemini request failed");
            throw error;
          }
          geminiSpinner.warn(
            `Timed out (attempt ${attempt + 1}/${attemptMax + 1}). Retrying...`,
          );
        }
      }
    }
  } finally {
    reader?.close();
  }

  geminiSpinner.fail("Gemini did not return scores");
  throw new Error("Gemini did not return scores after follow-up questions.");
};
