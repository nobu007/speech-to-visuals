declare module 'kuromoji' {
  interface KuromojiBuilder {
    (config: { dicPath: string }): {
      build(
        callback: (err: Error | null, tokenizer: unknown) => void
      ): void;
    };
  }

  interface KuromojiDict {
    builder: KuromojiBuilder;
  }

  const kuromoji: KuromojiDict;
  export = kuromoji;
}
