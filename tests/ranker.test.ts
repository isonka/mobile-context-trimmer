import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { rankMobileFiles, tokenizeQuery } from "../src/ranker.js";
import { type MobileScannedFile } from "../src/scanner.js";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mobile-context-trimmer-rank-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

describe("rankMobileFiles", () => {
  it("tokenizes query into terms", () => {
    expect(tokenizeQuery("add auth middleware")).toEqual(["add", "auth", "middleware"]);
  });

  it("ranks files with stronger keyword matches first", async () => {
    await withTempDir(async (dir) => {
      const files: MobileScannedFile[] = [
        {
          absolutePath: path.join(dir, "Auth.swift"),
          relativePath: "ios/Auth.swift",
          extension: ".swift",
          sizeBytes: 20,
          content: "auth middleware auth token"
        },
        {
          absolutePath: path.join(dir, "Strings.xml"),
          relativePath: "android/strings.xml",
          extension: ".xml",
          sizeBytes: 20,
          content: "<resources></resources>"
        }
      ];
      await fs.writeFile(files[0].absolutePath, files[0].content ?? "", "utf8");
      await fs.writeFile(files[1].absolutePath, files[1].content ?? "", "utf8");

      const ranked = await rankMobileFiles(files, {
        query: "auth middleware",
        rootDir: dir,
        recencyWeight: 0,
        typeWeight: 0,
        keywordWeight: 1
      });
      expect(ranked[0]?.relativePath).toBe("ios/Auth.swift");
      expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 0);
    });
  });

  it("uses IDF so rare query terms outweigh ubiquitous matches", async () => {
    await withTempDir(async (dir) => {
      const files: MobileScannedFile[] = [
        {
          absolutePath: path.join(dir, "A.swift"),
          relativePath: "A.swift",
          extension: ".swift",
          sizeBytes: 20,
          content: "common rareterm"
        },
        {
          absolutePath: path.join(dir, "B.swift"),
          relativePath: "B.swift",
          extension: ".swift",
          sizeBytes: 40,
          content: "common common common common common"
        },
        {
          absolutePath: path.join(dir, "C.swift"),
          relativePath: "C.swift",
          extension: ".swift",
          sizeBytes: 10,
          content: "other"
        }
      ];
      for (const f of files) {
        await fs.writeFile(f.absolutePath, f.content ?? "", "utf8");
      }

      const ranked = await rankMobileFiles(files, {
        query: "common rareterm",
        rootDir: dir,
        recencyWeight: 0,
        typeWeight: 0,
        keywordWeight: 1
      });
      expect(ranked[0]?.relativePath).toBe("A.swift");
    });
  });

  it("dampens recency for weak keyword hits so utilities score below full-recency mode", async () => {
    await withTempDir(async (dir) => {
      const legacyPath = path.join(dir, "ios", "Legacy.swift");
      const utilPath = path.join(dir, "ios", "Util.swift");
      const featPath = path.join(dir, "ios", "Feat.swift");
      await fs.mkdir(path.join(dir, "ios"), { recursive: true });
      await fs.writeFile(legacyPath, "// legacy", "utf8");
      await fs.writeFile(
        utilPath,
        "struct Orientation { let subscriptions: Set<Int> = [] }",
        "utf8"
      );
      await fs.writeFile(
        featPath,
        "func addSubscriptionsToMenu() { marktplaats navigation }",
        "utf8"
      );
      const old = new Date("2019-01-01");
      await fs.utimes(legacyPath, old, old);

      const files: MobileScannedFile[] = [
        {
          absolutePath: legacyPath,
          relativePath: "ios/Legacy.swift",
          extension: ".swift",
          sizeBytes: 12,
          content: "// legacy"
        },
        {
          absolutePath: utilPath,
          relativePath: "ios/Util.swift",
          extension: ".swift",
          sizeBytes: 50,
          content: "struct Orientation { let subscriptions: Set<Int> = [] }"
        },
        {
          absolutePath: featPath,
          relativePath: "ios/Feat.swift",
          extension: ".swift",
          sizeBytes: 80,
          content: "func addSubscriptionsToMenu() { marktplaats navigation }"
        }
      ];

      const damped = await rankMobileFiles(files, {
        query: "subscriptions menu marktplaats",
        rootDir: dir,
        keywordRecencyReference: 0.5
      });
      const fullRecency = await rankMobileFiles(files, {
        query: "subscriptions menu marktplaats",
        rootDir: dir,
        keywordRecencyReference: 0
      });

      const utilDamped = damped.find((f) => f.relativePath === "ios/Util.swift")?.score ?? 0;
      const utilFull = fullRecency.find((f) => f.relativePath === "ios/Util.swift")?.score ?? 0;
      expect(utilDamped).toBeLessThan(utilFull);
    });
  });
});
