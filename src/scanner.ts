import { promises as fs } from "node:fs";
import path from "node:path";
import ignore, { type Ignore } from "ignore";
import { getDefaultMobileExtensions, getDefaultMobileIgnorePatterns } from "./index.js";

export interface MobileScanOptions {
  rootDir: string;
  extensions?: string[];
  includeContent?: boolean;
  includeHidden?: boolean;
}

export interface MobileScannedFile {
  absolutePath: string;
  relativePath: string;
  extension: string;
  sizeBytes: number;
  content?: string;
}

/**
 * Scans a mobile repository with iOS/Android-aware defaults.
 */
export async function scanMobileFiles(options: MobileScanOptions): Promise<MobileScannedFile[]> {
  const rootDir = path.resolve(options.rootDir);
  const includeContent = options.includeContent ?? false;
  const includeHidden = options.includeHidden ?? false;
  const extensions = normalizeExtensions(options.extensions ?? getDefaultMobileExtensions());
  const ig = await createIgnoreMatcher(rootDir, includeHidden);
  const files: MobileScannedFile[] = [];

  await walk(rootDir, rootDir, ig, extensions, includeContent, files);
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

/**
 * Normalizes extension strings with leading dots and lowercase.
 */
export function normalizeExtensions(extensions: string[]): Set<string> {
  return new Set(
    extensions.map((ext) => (ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`))
  );
}

async function walk(
  rootDir: string,
  currentDir: string,
  ig: Ignore,
  extensions: Set<string>,
  includeContent: boolean,
  out: MobileScannedFile[]
): Promise<void> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = normalizeRelativePath(path.relative(rootDir, absolutePath));
    if (!relativePath || ig.ignores(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      await walk(rootDir, absolutePath, ig, extensions, includeContent, out);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (!extensions.has(extension)) {
      continue;
    }

    const stat = await fs.stat(absolutePath);
    const content = includeContent ? await fs.readFile(absolutePath, "utf8") : undefined;
    out.push({
      absolutePath,
      relativePath,
      extension,
      sizeBytes: stat.size,
      content
    });
  }
}

async function createIgnoreMatcher(rootDir: string, includeHidden: boolean): Promise<Ignore> {
  const ig = ignore();
  ig.add(getDefaultMobileIgnorePatterns());
  ig.add(await readIgnoreFile(path.join(rootDir, ".gitignore")));
  ig.add(await readIgnoreFile(path.join(rootDir, ".trimmerignore")));
  if (!includeHidden) {
    ig.add(".*");
  }
  return ig;
}

async function readIgnoreFile(filePath: string): Promise<string[]> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));
  } catch {
    return [];
  }
}

function normalizeRelativePath(value: string): string {
  return value.split(path.sep).join("/");
}
