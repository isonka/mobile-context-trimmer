#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { buildBundle, DEFAULT_MIN_COMBINED_SCORE_WITH_QUERY, formatBundleMarkdown } from "./bundler.js";
import { rankMobileFiles } from "./ranker.js";
import { scanMobileFiles } from "./scanner.js";
import { createDefaultTokenizer } from "./tokenizer.js";

void yargs(hideBin(process.argv))
  .scriptName("mobile-context-trimmer")
  .usage("$0 --dir ./repo --budget 32000 --out mobile-context.md")
  .option("dir", {
    type: "string",
    default: process.cwd(),
    describe: "Root directory of iOS/Android project"
  })
  .option("budget", {
    type: "number",
    default: 32000,
    describe: "Token budget for selected files"
  })
  .option("out", {
    type: "string",
    describe: "Optional output markdown file path"
  })
  .option("query", {
    type: "string",
    default: "",
    describe: "Optional task/query to rank files before bundling"
  })
  .option("min-keyword-score", {
    type: "number",
    describe:
      "Keyword relevance floor when --query is set (default: 0, omit files with no query match). Use a negative value to disable."
  })
  .option("min-combined-score", {
    type: "number",
    describe:
      `Minimum weighted rank score to include a file (default ${DEFAULT_MIN_COMBINED_SCORE_WITH_QUERY} when --query is set). Use -1 to disable. Calibrate ~0.08–0.15 for many iOS repos.`
  })
  .option("keyword-recency-reference", {
    type: "number",
    describe:
      "Keyword TF-IDF reference for recency dampening when --query is set (default ~0.055). Lower = stricter. Use 0 to disable dampening."
  })
  .command(
    "$0",
    "Build a mobile context bundle",
    () => {},
    async (argv) => {
      const rootDir = path.resolve(String(argv.dir));
      const budget = Math.max(1, Math.floor(Number(argv.budget)));
      const queryTrim = String(argv.query ?? "").trim();
      const rawMin = argv["min-keyword-score"] as number | undefined;
      let minKeywordScore: number | undefined;
      if (queryTrim) {
        if (rawMin !== undefined && rawMin < 0) {
          minKeywordScore = undefined;
        } else {
          minKeywordScore = rawMin !== undefined ? rawMin : 0;
        }
      }

      const files = await scanMobileFiles({ rootDir, includeContent: false });
      const kwRef = argv["keyword-recency-reference"] as number | undefined;
      const rankedFiles = await rankMobileFiles(files, {
        query: String(argv.query ?? ""),
        rootDir,
        ...(kwRef !== undefined && !Number.isNaN(kwRef) ? { keywordRecencyReference: kwRef } : {})
      });

      const rawCombined = argv["min-combined-score"] as number | undefined;
      let minCombinedScore: number | undefined;
      if (queryTrim) {
        if (rawCombined !== undefined && !Number.isNaN(rawCombined)) {
          minCombinedScore = rawCombined < 0 ? undefined : rawCombined;
        } else {
          minCombinedScore = DEFAULT_MIN_COMBINED_SCORE_WITH_QUERY;
        }
      }

      const bundle = await buildBundle(rankedFiles, {
        tokenBudget: budget,
        tokenizer: createDefaultTokenizer(),
        minKeywordScore,
        minCombinedScore
      });
      const output = formatBundleMarkdown(bundle, rootDir);

      if (argv.out) {
        const outPath = path.resolve(String(argv.out));
        await fs.writeFile(outPath, output, "utf8");
        process.stderr.write(
          `mobile-context-trimmer: wrote ${bundle.items.length} files (${bundle.usedTokens} tokens) to ${outPath}\n`
        );
        return;
      }

      process.stdout.write(`${output}\n`);
    }
  )
  .help()
  .strict()
  .parseAsync();
