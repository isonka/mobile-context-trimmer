import { describe, expect, it } from "vitest";
import { createDefaultTokenizer, estimateChar4Tokens } from "../src/tokenizer.js";

describe("tokenizer", () => {
  it("estimates token counts using char/4", () => {
    expect(estimateChar4Tokens("")).toBe(0);
    expect(estimateChar4Tokens("1234")).toBe(1);
    expect(estimateChar4Tokens("12345")).toBe(2);
  });

  it("creates default tokenizer", () => {
    const tokenizer = createDefaultTokenizer();
    expect(tokenizer.estimateTokens("hello world")).toBe(3);
  });
});
