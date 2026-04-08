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
