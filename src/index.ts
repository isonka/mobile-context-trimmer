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
