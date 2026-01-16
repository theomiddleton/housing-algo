import pc from "picocolors";
import prompts from "prompts";
import ora, { type Ora } from "ora";

// ============================================================================
// Colors & Formatting
// ============================================================================

export const colors = {
  title: (text: string) => pc.bold(pc.cyan(text)),
  subtitle: (text: string) => pc.dim(text),
  success: (text: string) => pc.green(text),
  error: (text: string) => pc.red(text),
  warn: (text: string) => pc.yellow(text),
  info: (text: string) => pc.blue(text),
  highlight: (text: string) => pc.bold(pc.white(text)),
  dim: (text: string) => pc.dim(text),
  label: (text: string) => pc.cyan(text),
  value: (text: string) => pc.white(text),
  command: (text: string) => pc.yellow(text),
  path: (text: string) => pc.underline(pc.blue(text)),
};

export const symbols = {
  success: pc.green("✔"),
  error: pc.red("✖"),
  warn: pc.yellow("⚠"),
  info: pc.blue("ℹ"),
  arrow: pc.cyan("→"),
  bullet: pc.dim("•"),
  star: pc.yellow("★"),
};

// ============================================================================
// Console Output
// ============================================================================

export const log = {
  title: (text: string) => console.log(`\n${colors.title(text)}\n`),
  subtitle: (text: string) => console.log(colors.subtitle(text)),
  success: (text: string) => console.log(`${symbols.success} ${colors.success(text)}`),
  error: (text: string) => console.error(`${symbols.error} ${colors.error(text)}`),
  warn: (text: string) => console.log(`${symbols.warn} ${colors.warn(text)}`),
  info: (text: string) => console.log(`${symbols.info} ${colors.info(text)}`),
  item: (label: string, value: string) =>
    console.log(`  ${symbols.bullet} ${colors.label(label)}: ${colors.value(value)}`),
  assignment: (person: string, room: string, details?: string) =>
    console.log(
      `  ${symbols.arrow} ${colors.highlight(person)} ${colors.dim("→")} ${colors.value(room)}${details ? ` ${colors.dim(`(${details})`)}` : ""}`
    ),
  blank: () => console.log(),
};

// ============================================================================
// Spinners
// ============================================================================

export const spinner = {
  create: (text: string): Ora => ora({ text, color: "cyan" }),
  start: (text: string): Ora => ora({ text, color: "cyan" }).start(),
};

// ============================================================================
// Help Formatting
// ============================================================================

type HelpOption = {
  flag: string;
  description: string;
  default?: string;
};

type HelpSection = {
  title: string;
  content: string[];
};

export const formatHelp = (config: {
  name: string;
  description: string;
  usage: string;
  options: HelpOption[];
  sections?: HelpSection[];
}) => {
  const lines: string[] = [];

  // Header
  lines.push("");
  lines.push(`  ${colors.title(config.name)}`);
  lines.push(`  ${colors.subtitle(config.description)}`);
  lines.push("");

  // Usage
  lines.push(`  ${colors.label("Usage:")}`);
  lines.push(`    ${colors.command(config.usage)}`);
  lines.push("");

  // Options
  lines.push(`  ${colors.label("Options:")}`);
  const maxFlagLen = Math.max(...config.options.map((o) => o.flag.length));
  config.options.forEach((opt) => {
    const flag = opt.flag.padEnd(maxFlagLen + 2);
    const defaultStr = opt.default ? colors.dim(` (default: ${opt.default})`) : "";
    lines.push(`    ${colors.command(flag)}${opt.description}${defaultStr}`);
  });

  // Additional sections
  if (config.sections) {
    config.sections.forEach((section) => {
      lines.push("");
      lines.push(`  ${colors.label(section.title)}`);
      section.content.forEach((line) => {
        lines.push(`    ${line}`);
      });
    });
  }

  lines.push("");
  return lines.join("\n");
};

// ============================================================================
// Interactive Prompts
// ============================================================================

export const prompt = {
  text: async (message: string, options?: { initial?: string; validate?: (value: string) => boolean | string }) => {
    const response = await prompts({
      type: "text",
      name: "value",
      message: colors.label(message),
      initial: options?.initial,
      validate: options?.validate,
    });
    return response.value as string | undefined;
  },

  confirm: async (message: string, initial = false) => {
    const response = await prompts({
      type: "confirm",
      name: "value",
      message: colors.label(message),
      initial,
    });
    return response.value as boolean | undefined;
  },

  select: async <T extends string>(message: string, choices: { title: string; value: T; description?: string }[]) => {
    const response = await prompts({
      type: "select",
      name: "value",
      message: colors.label(message),
      choices: choices.map((c) => ({
        title: c.title,
        value: c.value,
        description: c.description,
      })),
    });
    return response.value as T | undefined;
  },

  number: async (message: string, options?: { initial?: number; min?: number; max?: number }) => {
    const response = await prompts({
      type: "number",
      name: "value",
      message: colors.label(message),
      initial: options?.initial,
      min: options?.min,
      max: options?.max,
    });
    return response.value as number | undefined;
  },

  multiselect: async <T extends string>(
    message: string,
    choices: { title: string; value: T; selected?: boolean }[]
  ) => {
    const response = await prompts({
      type: "multiselect",
      name: "value",
      message: colors.label(message),
      choices: choices.map((c) => ({
        title: c.title,
        value: c.value,
        selected: c.selected,
      })),
    });
    return response.value as T[] | undefined;
  },
};

// ============================================================================
// Argument Parsing Helpers
// ============================================================================

export const parseArgs = (args: string[]) => {
  const getFlagValues = (flag: string): string[] => {
    const values: string[] = [];
    for (let index = 0; index < args.length; index++) {
      if (args[index] !== flag) continue;
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for ${colors.command(flag)}.`);
      }
      values.push(value);
    }
    return values;
  };

  const getFlagValue = (flag: string): string | undefined => {
    const values = getFlagValues(flag);
    return values.length > 0 ? values[values.length - 1] : undefined;
  };

  const hasFlag = (...flags: string[]): boolean => flags.some((f) => args.includes(f));

  const parsePositiveInt = (value: string, label: string): number => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(`Invalid ${colors.command(label)} value: ${value}. Expected a positive whole number.`);
    }
    return parsed;
  };

  const parseNonNegativeInt = (value: string, label: string): number => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new Error(`Invalid ${colors.command(label)} value: ${value}. Expected a non-negative whole number.`);
    }
    return parsed;
  };

  return { getFlagValues, getFlagValue, hasFlag, parsePositiveInt, parseNonNegativeInt };
};

// ============================================================================
// Path Helpers
// ============================================================================

export const resolvePath = (filePath: string): string =>
  filePath.startsWith("/") ? filePath : `${process.cwd()}/${filePath}`;

// ============================================================================
// Error Handling
// ============================================================================

export const handleError = (error: unknown): never => {
  const message = error instanceof Error ? error.message : String(error);
  log.error(message);
  process.exit(1);
};

// ============================================================================
// File Operations (using Bun)
// ============================================================================

export const readJson = async <T>(filePath: string): Promise<T> => {
  const resolved = resolvePath(filePath);
  const file = Bun.file(resolved);
  if (!(await file.exists())) {
    throw new Error(`File not found: ${colors.path(resolved)}`);
  }
  const text = await file.text();
  return JSON.parse(text) as T;
};

export const writeJson = async (filePath: string, data: unknown): Promise<void> => {
  const resolved = resolvePath(filePath);
  await Bun.write(resolved, JSON.stringify(data, null, 2));
};

// ============================================================================
// Table Formatting
// ============================================================================

type TableColumn = {
  header: string;
  key: string;
  align?: "left" | "right" | "center";
  format?: (value: unknown) => string;
};

export const formatTable = (data: Record<string, unknown>[], columns: TableColumn[]): string => {
  const widths = columns.map((col) => {
    const headerLen = col.header.length;
    const maxDataLen = Math.max(
      ...data.map((row) => {
        const value = row[col.key];
        const formatted = col.format ? col.format(value) : String(value ?? "");
        return formatted.length;
      })
    );
    return Math.max(headerLen, maxDataLen);
  });

  const pad = (text: string, width: number, align: "left" | "right" | "center" = "left") => {
    const diff = width - text.length;
    if (diff <= 0) return text;
    if (align === "right") return " ".repeat(diff) + text;
    if (align === "center") return " ".repeat(Math.floor(diff / 2)) + text + " ".repeat(Math.ceil(diff / 2));
    return text + " ".repeat(diff);
  };

  const lines: string[] = [];

  // Header
  const headerRow = columns.map((col, i) => colors.label(pad(col.header, widths[i]!, col.align))).join("  ");
  lines.push(`  ${headerRow}`);

  // Separator
  const separator = columns.map((_, i) => colors.dim("─".repeat(widths[i]!))).join("  ");
  lines.push(`  ${separator}`);

  // Data rows
  data.forEach((row) => {
    const rowStr = columns
      .map((col, i) => {
        const value = row[col.key];
        const formatted = col.format ? col.format(value) : String(value ?? "");
        return pad(formatted, widths[i]!, col.align);
      })
      .join("  ");
    lines.push(`  ${rowStr}`);
  });

  return lines.join("\n");
};

// ============================================================================
// Progress Bar
// ============================================================================

export const progressBar = (current: number, total: number, width = 30): string => {
  const percent = Math.min(current / total, 1);
  const filled = Math.round(width * percent);
  const empty = width - filled;
  const bar = colors.success("█".repeat(filled)) + colors.dim("░".repeat(empty));
  const percentStr = colors.dim(`${Math.round(percent * 100)}%`);
  return `${bar} ${percentStr}`;
};

// ============================================================================
// Box Drawing
// ============================================================================

export const box = (content: string, options?: { padding?: number; borderColor?: (s: string) => string }) => {
  const padding = options?.padding ?? 1;
  const borderColor = options?.borderColor ?? colors.dim;

  const lines = content.split("\n");
  const maxLen = Math.max(...lines.map((l) => l.length));
  const paddedWidth = maxLen + padding * 2;

  const horizontal = "─".repeat(paddedWidth);
  const empty = " ".repeat(paddedWidth);

  const result: string[] = [];
  result.push(borderColor(`╭${horizontal}╮`));

  for (let i = 0; i < padding; i++) {
    result.push(`${borderColor("│")}${empty}${borderColor("│")}`);
  }

  lines.forEach((line) => {
    const padded = " ".repeat(padding) + line.padEnd(maxLen) + " ".repeat(padding);
    result.push(`${borderColor("│")}${padded}${borderColor("│")}`);
  });

  for (let i = 0; i < padding; i++) {
    result.push(`${borderColor("│")}${empty}${borderColor("│")}`);
  }

  result.push(borderColor(`╰${horizontal}╯`));

  return result.join("\n");
};
