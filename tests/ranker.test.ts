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

      const ranked = await rankMobileFiles(files, { query: "auth middleware" });
      expect(ranked[0]?.relativePath).toBe("ios/Auth.swift");
      expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 0);
    });
  });
});
