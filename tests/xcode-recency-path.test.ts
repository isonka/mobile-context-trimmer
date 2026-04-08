import { describe, expect, it } from "vitest";
import { isGitRecencyUnreliablePath } from "../src/ranker.js";

describe("isGitRecencyUnreliablePath", () => {
  it("flags Xcode project bundle paths and pbxproj", () => {
    expect(isGitRecencyUnreliablePath("MyApp.xcodeproj/project.pbxproj")).toBe(true);
    expect(isGitRecencyUnreliablePath("ios/MyApp.xcodeproj/project.pbxproj")).toBe(true);
    expect(isGitRecencyUnreliablePath("MyApp.xcodeproj/xcuserdata/foo.xcuserstate")).toBe(true);
  });

  it("does not flag normal Swift or Kotlin sources", () => {
    expect(isGitRecencyUnreliablePath("ios/App/AppDelegate.swift")).toBe(false);
    expect(isGitRecencyUnreliablePath("android/app/src/MainActivity.kt")).toBe(false);
  });

  it("flags workspace xcuserdata segments", () => {
    expect(isGitRecencyUnreliablePath("MyApp.xcworkspace/xcuserdata/jane.xcuserdatad")).toBe(true);
  });
});
