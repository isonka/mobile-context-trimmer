export interface Tokenizer {
  estimateTokens(text: string): number;
}

/**
 * Char-based token estimation (chars/4) for lightweight defaults.
 */
export function estimateChar4Tokens(text: string): number {
  if (!text) {
    return 0;
  }
  return Math.ceil(text.length / 4);
}

/**
 * Creates the default tokenizer implementation.
 */
export function createDefaultTokenizer(): Tokenizer {
  return {
    estimateTokens(text: string): number {
      return estimateChar4Tokens(text);
    }
  };
}
