import { describe, expect, it } from "vitest";
import {
  detectMobilePlatform,
  getDefaultMobileExtensions,
  getDefaultMobileIgnorePatterns,
  getLibraryName
} from "../src/index.js";

describe("getLibraryName", () => {
  it("returns package identifier", () => {
    expect(getLibraryName()).toBe("mobile-context-trimmer");
  });
});

describe("getDefaultMobileExtensions", () => {
  it("includes common iOS and Android source extensions", () => {
    const extensions = getDefaultMobileExtensions();
    expect(extensions).toContain(".swift");
    expect(extensions).toContain(".kt");
    expect(extensions).toContain(".java");
    expect(extensions).toContain(".xml");
  });
});

describe("getDefaultMobileIgnorePatterns", () => {
  it("includes common generated and tool directories", () => {
    const patterns = getDefaultMobileIgnorePatterns();
    expect(patterns).toContain("Pods/");
    expect(patterns).toContain("DerivedData/");
    expect(patterns).toContain(".gradle/");
    expect(patterns).toContain("**/build/");
  });
});

describe("detectMobilePlatform", () => {
  it("detects ios-only inputs", () => {
    expect(detectMobilePlatform(["ios/AppDelegate.swift", "Info.plist"])).toBe("ios");
  });

  it("detects android-only inputs", () => {
    expect(detectMobilePlatform(["android/app/src/MainActivity.kt", "AndroidManifest.xml"])).toBe(
      "android"
    );
  });

  it("detects mixed repositories", () => {
    expect(detectMobilePlatform(["ios/AppDelegate.swift", "android/app/build.gradle.kts"])).toBe(
      "mixed"
    );
  });
});
