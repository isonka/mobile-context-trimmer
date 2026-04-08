import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scanMobileFiles } from "../src/scanner.js";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mobile-context-trimmer-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

describe("scanMobileFiles", () => {
  it("scans iOS/Android source files with metadata-only default", async () => {
    await withTempDir(async (dir) => {
      await fs.mkdir(path.join(dir, "ios"), { recursive: true });
      await fs.mkdir(path.join(dir, "android"), { recursive: true });
      await fs.writeFile(path.join(dir, "ios", "AppDelegate.swift"), "class AppDelegate {}", "utf8");
      await fs.writeFile(path.join(dir, "android", "MainActivity.kt"), "class MainActivity", "utf8");
      await fs.writeFile(path.join(dir, "android", "ignore.txt"), "nope", "utf8");

      const files = await scanMobileFiles({ rootDir: dir });
      expect(files.map((f) => f.relativePath)).toEqual([
        "android/MainActivity.kt",
        "ios/AppDelegate.swift"
      ]);
      expect(files[0]?.content).toBeUndefined();
    });
  });

  it("respects .trimmerignore and can include content", async () => {
    await withTempDir(async (dir) => {
      await fs.mkdir(path.join(dir, "ios"), { recursive: true });
      await fs.writeFile(path.join(dir, "ios", "Keep.swift"), "struct Keep {}", "utf8");
      await fs.writeFile(path.join(dir, "ios", "Drop.swift"), "struct Drop {}", "utf8");
      await fs.writeFile(path.join(dir, ".trimmerignore"), "ios/Drop.swift\n", "utf8");

      const files = await scanMobileFiles({ rootDir: dir, includeContent: true });
      expect(files).toHaveLength(1);
      expect(files[0]?.relativePath).toBe("ios/Keep.swift");
      expect(files[0]?.content).toContain("struct Keep");
    });
  });
});
