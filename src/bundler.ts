import { promises as fs } from "node:fs";
import path from "node:path";
import { type MobileScannedFile } from "./scanner.js";
import { type Tokenizer } from "./tokenizer.js";

export interface BundleOptions {
  tokenBudget: number;
  tokenizer: Tokenizer;
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

  for (const file of files) {
    const content = file.content ?? (await fs.readFile(file.absolutePath, "utf8"));
    const estimatedTokens = options.tokenizer.estimateTokens(content);
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

  return { items, usedTokens, skippedFully };
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
    "",
    ...sections
  ].join("\n");
}
