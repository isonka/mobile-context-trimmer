#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { buildBundle, formatBundleMarkdown } from "./bundler.js";
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
  .command(
    "$0",
    "Build a mobile context bundle",
    () => {},
    async (argv) => {
      const rootDir = path.resolve(String(argv.dir));
      const budget = Math.max(1, Math.floor(Number(argv.budget)));

      const files = await scanMobileFiles({ rootDir, includeContent: false });
      const rankedFiles = await rankMobileFiles(files, {
        query: String(argv.query ?? ""),
        rootDir
      });
      const bundle = await buildBundle(rankedFiles, {
        tokenBudget: budget,
        tokenizer: createDefaultTokenizer()
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
