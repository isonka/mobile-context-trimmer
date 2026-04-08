import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mobile-context-trimmer-cli-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

describe("cli", () => {
  it("generates a markdown bundle file", async () => {
    await withTempDir(async (fixtureDir) => {
      await fs.mkdir(path.join(fixtureDir, "ios"), { recursive: true });
      await fs.writeFile(path.join(fixtureDir, "ios", "AppDelegate.swift"), "class AppDelegate {}", "utf8");
      const outPath = path.join(fixtureDir, "bundle.md");

      await execFileAsync(
        process.execPath,
        ["--import", "tsx", "src/cli.ts", "--dir", fixtureDir, "--budget", "100", "--out", outPath],
        { cwd: path.resolve(process.cwd()) }
      );

      const content = await fs.readFile(outPath, "utf8");
      expect(content).toContain("# Mobile Context Bundle");
      expect(content).toContain("ios/AppDelegate.swift");
    });
  });
});
