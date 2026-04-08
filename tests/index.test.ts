import { describe, expect, it } from "vitest";
import { getDefaultMobileExtensions, getLibraryName } from "../src/index.js";

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
