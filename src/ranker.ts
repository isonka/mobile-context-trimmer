import { promises as fs } from "node:fs";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import path from "node:path";
import { type MobileScannedFile } from "./scanner.js";

const execFileAsync = promisify(execFile);

/**
 * Keyword TF‑IDF score at or above this value earns full recency weight; weaker matches scale recency down linearly.
 * Tuned so incidental hits (e.g. `subscriptions` as a property name) do not inherit a full 30% recency boost.
 */
export const DEFAULT_KEYWORD_RECENCY_REFERENCE = 0.055;

export interface RankMobileOptions {
  query: string;
  /** Repository root; required for git recency and path resolution. */
  rootDir: string;
  keywordWeight?: number;
  recencyWeight?: number;
  typeWeight?: number;
  typePriority?: Record<string, number>;
  /**
   * When the query has tokens, recency is multiplied by `min(1, keywordScore / reference)` unless disabled.
   * Set to `0` to disable dampening (legacy full recency). Default: {@link DEFAULT_KEYWORD_RECENCY_REFERENCE}.
   */
  keywordRecencyReference?: number;
}

export interface RankedMobileFile extends MobileScannedFile {
  score: number;
  keywordScore: number;
  recencyScore: number;
  typeScore: number;
  lastModifiedEpochMs: number;
}

interface FileKeywordStats {
  relativePath: string;
  matchesByToken: Map<string, number>;
  contentTokenCount: number;
}

const DEFAULT_TYPE_PRIORITY: Record<string, number> = {
  ".swift": 1,
  ".kt": 1,
  ".kts": 0.95,
  ".java": 0.9,
  ".xml": 0.8,
  ".plist": 0.7,
  ".gradle": 0.75,
  ".properties": 0.5
};

/**
 * Paths where git timestamps are dominated by Xcode merges/rewrites; use filesystem mtime instead.
 */
export function isGitRecencyUnreliablePath(relativePath: string): boolean {
  const normalized = relativePath.split(path.sep).join("/").toLowerCase();
  if (normalized.includes(".xcodeproj/")) {
    return true;
  }
  if (normalized.endsWith(".pbxproj")) {
    return true;
  }
  if (normalized.includes(".xcuserdata/")) {
    return true;
  }
  if (normalized.includes(".xcworkspace/xcuserdata/")) {
    return true;
  }
  return false;
}

/**
 * Ranks mobile files using TF-IDF-style query match, Xcode-safe recency, and extension priority.
 */
export async function rankMobileFiles(
  files: MobileScannedFile[],
  options: RankMobileOptions
): Promise<RankedMobileFile[]> {
  const rootDir = path.resolve(options.rootDir);
  const tokens = tokenizeQuery(options.query);
  const keywordWeight = options.keywordWeight ?? 0.55;
  const recencyWeight = options.recencyWeight ?? 0.3;
  const typeWeight = options.typeWeight ?? 0.15;
  const priority = {
    ...DEFAULT_TYPE_PRIORITY,
    ...normalizeTypePriority(options.typePriority ?? {})
  };
  const recencyRef =
    options.keywordRecencyReference === 0
      ? null
      : (options.keywordRecencyReference ?? DEFAULT_KEYWORD_RECENCY_REFERENCE);

  const keywordStats = await buildKeywordStats(files, tokens);
  const idf = buildInverseDocumentFrequency(keywordStats, tokens);
  const timestamps = await readMobileModifiedTimestamps(rootDir, files);
  const recencyRange = buildRange(Array.from(timestamps.values()));

  const ranked: RankedMobileFile[] = [];
  for (const file of files) {
    const stats = keywordStats.get(file.relativePath);
    const keywordScore = computeKeywordScoreFromStats(stats, tokens, idf);
    const lastModifiedEpochMs = timestamps.get(file.relativePath) ?? 0;
    const recencyScore = normalizeFromRange(lastModifiedEpochMs, recencyRange.min, recencyRange.max);
    const typeScore = priority[file.extension] ?? 0;
    const recencyMultiplier =
      tokens.length === 0 || recencyRef === null ? 1 : Math.min(1, keywordScore / recencyRef);
    const score =
      keywordScore * keywordWeight +
      recencyScore * recencyWeight * recencyMultiplier +
      typeScore * typeWeight;

    const content = file.content ?? (await fs.readFile(file.absolutePath, "utf8"));
    ranked.push({
      ...file,
      score,
      keywordScore,
      recencyScore,
      typeScore,
      lastModifiedEpochMs,
      content
    });
  }

  return ranked.sort((a, b) => b.score - a.score || a.relativePath.localeCompare(b.relativePath));
}

/**
 * Tokenizes a free text query into searchable terms.
 */
export function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
}

/**
 * Computes TF-IDF style score using precomputed per-file stats and corpus IDF.
 */
export function computeKeywordScoreFromStats(
  stats: FileKeywordStats | undefined,
  queryTokens: string[],
  inverseDocumentFrequency: Map<string, number>
): number {
  if (!stats || queryTokens.length === 0) {
    return 0;
  }
  let total = 0;
  for (const token of queryTokens) {
    const matches = stats.matchesByToken.get(token) ?? 0;
    const tf = matches / Math.max(1, stats.contentTokenCount);
    total += tf * (inverseDocumentFrequency.get(token) ?? 0);
  }
  return total;
}

function countTokenOccurrences(text: string, token: string): number {
  if (!token) {
    return 0;
  }
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\b${escaped}\\b`, "gi");
  return text.match(regex)?.length ?? 0;
}

function buildInverseDocumentFrequency(
  statsByPath: Map<string, FileKeywordStats>,
  queryTokens: string[]
): Map<string, number> {
  const totalDocs = Math.max(1, statsByPath.size);
  const result = new Map<string, number>();

  for (const token of queryTokens) {
    let docsContainingToken = 0;
    for (const stats of statsByPath.values()) {
      if ((stats.matchesByToken.get(token) ?? 0) > 0) {
        docsContainingToken += 1;
      }
    }
    const idf = Math.log((1 + totalDocs) / (1 + docsContainingToken)) + 1;
    result.set(token, idf);
  }

  return result;
}

async function buildKeywordStats(
  files: MobileScannedFile[],
  tokens: string[]
): Promise<Map<string, FileKeywordStats>> {
  const result = new Map<string, FileKeywordStats>();

  await Promise.all(
    files.map(async (file) => {
      const content = file.content ?? (await fs.readFile(file.absolutePath, "utf8"));
      const lowered = content.toLowerCase();
      const contentTokenCount = Math.max(1, lowered.split(/\s+/).length);
      const matchesByToken = new Map<string, number>();
      for (const token of tokens) {
        matchesByToken.set(token, countTokenOccurrences(lowered, token));
      }
      result.set(file.relativePath, {
        relativePath: file.relativePath,
        matchesByToken,
        contentTokenCount
      });
    })
  );

  return result;
}

async function readMobileModifiedTimestamps(
  rootDir: string,
  files: MobileScannedFile[]
): Promise<Map<string, number>> {
  const output = new Map<string, number>();
  const gitTimestamps = await readGitTimestampsBatch(rootDir);

  await Promise.all(
    files.map(async (file) => {
      const fullPath = path.resolve(rootDir, file.relativePath);

      if (isGitRecencyUnreliablePath(file.relativePath)) {
        try {
          const stat = await fs.stat(fullPath);
          output.set(file.relativePath, stat.mtimeMs);
        } catch {
          output.set(file.relativePath, 0);
        }
        return;
      }

      const gitTs = gitTimestamps.get(file.relativePath) ?? 0;
      if (gitTs > 0) {
        output.set(file.relativePath, gitTs);
        return;
      }

      try {
        const stat = await fs.stat(fullPath);
        output.set(file.relativePath, stat.mtimeMs);
      } catch {
        output.set(file.relativePath, 0);
      }
    })
  );

  return output;
}

async function readGitTimestampsBatch(rootDir: string): Promise<Map<string, number>> {
  const output = new Map<string, number>();
  try {
    const { stdout } = await execFileAsync("git", ["log", "--name-only", "--format=%ct"], {
      cwd: rootDir
    });
    const lines = stdout.split(/\r?\n/);
    let currentTimestamp = 0;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }
      if (/^\d+$/.test(line)) {
        currentTimestamp = Number.parseInt(line, 10) * 1000;
        continue;
      }
      if (currentTimestamp <= 0) {
        continue;
      }
      const normalizedPath = line.split(path.sep).join("/");
      if (isGitRecencyUnreliablePath(normalizedPath)) {
        continue;
      }
      if (!output.has(normalizedPath)) {
        output.set(normalizedPath, currentTimestamp);
      }
    }
  } catch {
    return output;
  }
  return output;
}

function buildRange(values: number[]): { min: number; max: number } {
  if (values.length === 0) {
    return { min: 0, max: 0 };
  }
  return { min: Math.min(...values), max: Math.max(...values) };
}

function normalizeFromRange(value: number, min: number, max: number): number {
  if (max <= min) {
    return 0;
  }
  return (value - min) / (max - min);
}

function normalizeTypePriority(priority: Record<string, number>): Record<string, number> {
  const normalized: Record<string, number> = {};
  for (const [ext, score] of Object.entries(priority)) {
    const key = ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
    normalized[key] = score;
  }
  return normalized;
}
