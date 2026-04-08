import { describe, expect, it } from "vitest";
import { getLibraryName } from "../src/index.js";

describe("getLibraryName", () => {
  it("returns package identifier", () => {
    expect(getLibraryName()).toBe("mobile-context-trimmer");
  });
});
