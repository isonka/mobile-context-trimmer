import { promises as fs } from "node:fs";
import { type MobileScannedFile } from "./scanner.js";

export interface RankMobileOptions {
  query: string;
  keywordWeight?: number;
  typeWeight?: number;
  typePriority?: Record<string, number>;
}

export interface RankedMobileFile extends MobileScannedFile {
  score: number;
  keywordScore: number;
  typeScore: number;
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
 * Ranks mobile files using lexical query matching and extension priority.
 */
export async function rankMobileFiles(
  files: MobileScannedFile[],
  options: RankMobileOptions
): Promise<RankedMobileFile[]> {
  const tokens = tokenizeQuery(options.query);
  const keywordWeight = options.keywordWeight ?? 0.85;
  const typeWeight = options.typeWeight ?? 0.15;
  const priority = {
    ...DEFAULT_TYPE_PRIORITY,
    ...normalizeTypePriority(options.typePriority ?? {})
  };

  const ranked: RankedMobileFile[] = [];
  for (const file of files) {
    const content = file.content ?? (await fs.readFile(file.absolutePath, "utf8"));
    const keywordScore = computeKeywordScore(content, tokens);
    const typeScore = priority[file.extension] ?? 0;
    const score = keywordScore * keywordWeight + typeScore * typeWeight;
    ranked.push({
      ...file,
      score,
      keywordScore,
      typeScore,
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
 * Computes normalized lexical match score for query tokens.
 */
export function computeKeywordScore(content: string, queryTokens: string[]): number {
  if (queryTokens.length === 0) {
    return 0;
  }
  const lowered = content.toLowerCase();
  const tokenCount = Math.max(1, lowered.split(/\s+/).length);
  let total = 0;

  for (const token of queryTokens) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "g");
    const matches = lowered.match(regex)?.length ?? 0;
    total += matches / tokenCount;
  }
  return total;
}

function normalizeTypePriority(priority: Record<string, number>): Record<string, number> {
  const normalized: Record<string, number> = {};
  for (const [ext, score] of Object.entries(priority)) {
    const key = ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
    normalized[key] = score;
  }
  return normalized;
}
