import { describe, expect, it } from "vitest";
import { buildBundle, formatBundleMarkdown } from "../src/bundler.js";
import { createDefaultTokenizer } from "../src/tokenizer.js";
import { type MobileScannedFile } from "../src/scanner.js";

const fixtures: MobileScannedFile[] = [
  {
    absolutePath: "/tmp/A.swift",
    relativePath: "ios/A.swift",
    extension: ".swift",
    sizeBytes: 4,
    content: "aaaa"
  },
  {
    absolutePath: "/tmp/B.kt",
    relativePath: "android/B.kt",
    extension: ".kt",
    sizeBytes: 8,
    content: "bbbbbbbb"
  }
];

describe("bundler", () => {
  it("builds a bundle within budget", async () => {
    const bundle = await buildBundle(fixtures, {
      tokenBudget: 2,
      tokenizer: createDefaultTokenizer()
    });
    expect(bundle.items).toHaveLength(1);
    expect(bundle.skippedFully).toBe(1);
  });

  it("omits whitespace-only files before budget selection", async () => {
    const withNewlinesOnly: MobileScannedFile[] = [
      {
        absolutePath: "/tmp/ws.swift",
        relativePath: "ios/ws.swift",
        extension: ".swift",
        sizeBytes: 6,
        content: "\n\n  \n"
      },
      ...fixtures
    ];
    const bundle = await buildBundle(withNewlinesOnly, {
      tokenBudget: 20,
      tokenizer: createDefaultTokenizer()
    });
    expect(bundle.items.map((i) => i.path)).not.toContain("ios/ws.swift");
    expect(bundle.items.length).toBe(2);
  });

  it("omits zero-token files before budget selection", async () => {
    const withEmpty: MobileScannedFile[] = [
      {
        absolutePath: "/tmp/empty.swift",
        relativePath: "ios/empty.swift",
        extension: ".swift",
        sizeBytes: 0,
        content: ""
      },
      ...fixtures
    ];
    const bundle = await buildBundle(withEmpty, {
      tokenBudget: 20,
      tokenizer: createDefaultTokenizer()
    });
    expect(bundle.items.map((i) => i.path)).not.toContain("ios/empty.swift");
    expect(bundle.items.length).toBe(2);
  });

  it("formats markdown", async () => {
    const bundle = await buildBundle(fixtures, {
      tokenBudget: 20,
      tokenizer: createDefaultTokenizer()
    });
    const markdown = formatBundleMarkdown(bundle, "/tmp");
    expect(markdown).toContain("# Mobile Context Bundle");
    expect(markdown).toContain("## File: `ios/A.swift`");
  });
});
