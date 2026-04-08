/**
 * Returns the package name for quick sanity checks.
 */
export function getLibraryName(): string {
  return "mobile-context-trimmer";
}

/**
 * Returns default file extensions for native iOS/Android scanning.
 */
export function getDefaultMobileExtensions(): string[] {
  return [
    ".swift",
    ".m",
    ".mm",
    ".h",
    ".plist",
    ".kt",
    ".kts",
    ".java",
    ".xml",
    ".gradle",
    ".properties"
  ];
}

/**
 * Returns default ignore patterns for native mobile repositories.
 */
export function getDefaultMobileIgnorePatterns(): string[] {
  return [
    ".git/",
    "node_modules/",
    "Pods/",
    "DerivedData/",
    ".gradle/",
    ".idea/",
    "build/",
    "**/build/",
    ".cxx/",
    ".dart_tool/",
    ".next/",
    ".turbo/",
    "*.xcworkspace/xcuserdata/",
    "*.xcodeproj/xcuserdata/"
  ];
}

export type MobilePlatform = "ios" | "android" | "mixed" | "unknown";

/**
 * Detects mobile platform focus from a list of file paths.
 */
export function detectMobilePlatform(paths: string[]): MobilePlatform {
  let hasIos = false;
  let hasAndroid = false;

  for (const rawPath of paths) {
    const normalized = rawPath.toLowerCase();
    if (
      normalized.endsWith(".swift") ||
      normalized.endsWith(".m") ||
      normalized.endsWith(".mm") ||
      normalized.endsWith(".plist") ||
      normalized.includes("/ios/") ||
      normalized.includes(".xcodeproj")
    ) {
      hasIos = true;
    }
    if (
      normalized.endsWith(".kt") ||
      normalized.endsWith(".kts") ||
      normalized.endsWith(".java") ||
      normalized.endsWith("androidmanifest.xml") ||
      normalized.includes("/android/") ||
      normalized.includes("build.gradle")
    ) {
      hasAndroid = true;
    }
  }

  if (hasIos && hasAndroid) {
    return "mixed";
  }
  if (hasIos) {
    return "ios";
  }
  if (hasAndroid) {
    return "android";
  }
  return "unknown";
}
