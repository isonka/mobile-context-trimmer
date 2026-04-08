import { promises as fs } from "node:fs";
import path from "node:path";
import { type RankedMobileFile } from "./ranker.js";
import { type MobileScannedFile } from "./scanner.js";
import { type Tokenizer } from "./tokenizer.js";

/** Default `--min-combined-score` when `--query` is set (bundle stage). Use `-1` on the CLI to omit. */
export const DEFAULT_MIN_COMBINED_SCORE_WITH_QUERY = 0.1;

export interface BundleOptions {
  tokenBudget: number;
  tokenizer: Tokenizer;
  /**
   * When set, files from ranked output with `keywordScore <= minKeywordScore` are omitted
   * so high-recency boilerplate cannot fill the bundle. Ignored for inputs without `keywordScore`.
   * Use `0` to require strictly positive lexical relevance vs the query.
   */
  minKeywordScore?: number;
  /**
   * When set, ranked files with combined `score` (keyword + recency + type) **strictly below**
   * this value are omitted so weakly relevant but recently touched utilities do not fill the tail.
   */
  minCombinedScore?: number;
}

export interface BundleItem {
  path: string;
  content: string;
  estimatedTokens: number;
}

export interface BundleResult {
  items: BundleItem[];
  usedTokens: number;
  skippedFully: number;
  skippedBelowRelevance: number;
  skippedBelowCombinedScore: number;
}

/**
 * Builds a markdown-ready bundle within a token budget.
 */
export async function buildBundle(
  files: MobileScannedFile[],
  options: BundleOptions
): Promise<BundleResult> {
  const items: BundleItem[] = [];
  let usedTokens = 0;
  let skippedFully = 0;
  let skippedBelowRelevance = 0;
  let skippedBelowCombinedScore = 0;
  const floor = options.minKeywordScore;
  const minCombined = options.minCombinedScore;

  for (const file of files) {
    if (floor !== undefined && hasKeywordScore(file)) {
      if (file.keywordScore <= floor) {
        skippedBelowRelevance += 1;
        continue;
      }
    }
    if (minCombined !== undefined && hasRankScore(file)) {
      if (file.score < minCombined) {
        skippedBelowCombinedScore += 1;
        continue;
      }
    }
    const content = file.content ?? (await fs.readFile(file.absolutePath, "utf8"));
    if (content.trim().length === 0) {
      continue;
    }
    const estimatedTokens = options.tokenizer.estimateTokens(content);
    if (estimatedTokens === 0) {
      continue;
    }
    if (usedTokens + estimatedTokens > options.tokenBudget) {
      skippedFully += 1;
      continue;
    }
    items.push({
      path: file.relativePath,
      content,
      estimatedTokens
    });
    usedTokens += estimatedTokens;
  }

  return { items, usedTokens, skippedFully, skippedBelowRelevance, skippedBelowCombinedScore };
}

function hasKeywordScore(file: MobileScannedFile): file is RankedMobileFile {
  return (
    "keywordScore" in file &&
    typeof (file as RankedMobileFile).keywordScore === "number" &&
    !Number.isNaN((file as RankedMobileFile).keywordScore)
  );
}

function hasRankScore(file: MobileScannedFile): file is RankedMobileFile {
  return (
    "score" in file &&
    typeof (file as RankedMobileFile).score === "number" &&
    !Number.isNaN((file as RankedMobileFile).score)
  );
}

/**
 * Formats bundle output as markdown.
 */
export function formatBundleMarkdown(bundle: BundleResult, rootDir: string): string {
  const sections = bundle.items.map((item) =>
    [
      `## File: \`${item.path}\``,
      "",
      `- Absolute path: \`${path.resolve(rootDir, item.path)}\``,
      `- Estimated tokens: ${item.estimatedTokens}`,
      "",
      "```",
      item.content,
      "```"
    ].join("\n")
  );

  return [
    "# Mobile Context Bundle",
    "",
    `- Files included: ${bundle.items.length}`,
    `- Tokens used: ${bundle.usedTokens}`,
    `- Files skipped due to budget: ${bundle.skippedFully}`,
    `- Files skipped below keyword relevance floor: ${bundle.skippedBelowRelevance}`,
    `- Files skipped below combined rank score: ${bundle.skippedBelowCombinedScore}`,
    "",
    ...sections
  ].join("\n");
}
