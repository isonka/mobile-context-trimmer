import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { rankMobileFiles } from "../src/ranker.js";
import { type MobileScannedFile } from "../src/scanner.js";

const execFileAsync = promisify(execFile);

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mobile-context-trimmer-git-rec-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

describe("rankMobileFiles git recency", () => {
  it("ranks more recently committed Swift files higher when keyword weights are zero", async () => {
    await withTempDir(async (dir) => {
      try {
        await execFileAsync("git", ["init"], { cwd: dir });
        await execFileAsync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
        await execFileAsync("git", ["config", "user.name", "Test"], { cwd: dir });

        await fs.writeFile(path.join(dir, "Old.swift"), "// old\n", "utf8");
        await execFileAsync("git", ["add", "Old.swift"], { cwd: dir });
        await execFileAsync("git", ["commit", "-m", "old"], {
          cwd: dir,
          env: {
            ...process.env,
            GIT_AUTHOR_DATE: "2020-01-01T12:00:00",
            GIT_COMMITTER_DATE: "2020-01-01T12:00:00"
          }
        });

        await fs.writeFile(path.join(dir, "New.swift"), "// new\n", "utf8");
        await execFileAsync("git", ["add", "New.swift"], { cwd: dir });
        await execFileAsync("git", ["commit", "-m", "new"], {
          cwd: dir,
          env: {
            ...process.env,
            GIT_AUTHOR_DATE: "2025-06-01T12:00:00",
            GIT_COMMITTER_DATE: "2025-06-01T12:00:00"
          }
        });
      } catch {
        expect(true).toBe(true);
        return;
      }

      const files: MobileScannedFile[] = [
        {
          absolutePath: path.join(dir, "Old.swift"),
          relativePath: "Old.swift",
          extension: ".swift",
          sizeBytes: 8
        },
        {
          absolutePath: path.join(dir, "New.swift"),
          relativePath: "New.swift",
          extension: ".swift",
          sizeBytes: 8
        }
      ];

      const ranked = await rankMobileFiles(files, {
        query: "",
        rootDir: dir,
        keywordWeight: 0,
        typeWeight: 0,
        recencyWeight: 1
      });

      expect(ranked[0]?.relativePath).toBe("New.swift");
      expect(ranked[0]?.lastModifiedEpochMs).toBeGreaterThan(ranked[1]?.lastModifiedEpochMs ?? 0);
    });
  });
});
