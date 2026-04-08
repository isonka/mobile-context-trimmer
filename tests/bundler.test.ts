import { describe, expect, it } from "vitest";
import { buildBundle, formatBundleMarkdown } from "../src/bundler.js";
import { type RankedMobileFile } from "../src/ranker.js";
import { type MobileScannedFile } from "../src/scanner.js";
import { createDefaultTokenizer } from "../src/tokenizer.js";

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
    expect(markdown).toContain("skipped below keyword relevance floor");
    expect(markdown).toContain("skipped below combined rank score");
  });

  it("omits ranked files at or below minKeywordScore before budget selection", async () => {
    const ranked: RankedMobileFile[] = [
      {
        absolutePath: "/tmp/Exp.swift",
        relativePath: "ios/Exp.swift",
        extension: ".swift",
        sizeBytes: 8,
        content: "abSwitchKey",
        score: 0.9,
        keywordScore: 0,
        recencyScore: 1,
        typeScore: 1,
        lastModifiedEpochMs: 2
      },
      {
        absolutePath: "/tmp/Push.swift",
        relativePath: "ios/Push.swift",
        extension: ".swift",
        sizeBytes: 40,
        content: "push notification registration",
        score: 0.5,
        keywordScore: 0.2,
        recencyScore: 0,
        typeScore: 1,
        lastModifiedEpochMs: 1
      }
    ];
    const bundle = await buildBundle(ranked, {
      tokenBudget: 100,
      tokenizer: createDefaultTokenizer(),
      minKeywordScore: 0
    });
    expect(bundle.items.map((i) => i.path)).toEqual(["ios/Push.swift"]);
    expect(bundle.skippedBelowRelevance).toBe(1);
  });

  it("omits ranked files below minCombinedScore before budget selection", async () => {
    const ranked: RankedMobileFile[] = [
      {
        absolutePath: "/tmp/Orientation.swift",
        relativePath: "ios/OrientationManager.swift",
        extension: ".swift",
        sizeBytes: 20,
        content: "struct OrientationManager {}",
        score: 0.35,
        keywordScore: 0.02,
        recencyScore: 0.95,
        typeScore: 1,
        lastModifiedEpochMs: 9
      },
      {
        absolutePath: "/tmp/Subscriptions.swift",
        relativePath: "ios/SubscriptionsMenu.swift",
        extension: ".swift",
        sizeBytes: 40,
        content: "subscriptions menu marktplaats",
        score: 0.72,
        keywordScore: 0.4,
        recencyScore: 0.5,
        typeScore: 1,
        lastModifiedEpochMs: 5
      }
    ];
    const bundle = await buildBundle(ranked, {
      tokenBudget: 200,
      tokenizer: createDefaultTokenizer(),
      minKeywordScore: 0,
      minCombinedScore: 0.5
    });
    expect(bundle.items.map((i) => i.path)).toEqual(["ios/SubscriptionsMenu.swift"]);
    expect(bundle.skippedBelowCombinedScore).toBe(1);
  });
});
