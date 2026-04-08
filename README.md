# mobile-context-trimmer

`mobile-context-trimmer` is a TypeScript CLI + library for building LLM-ready context bundles from native iOS and Android repositories.

## Status

Initial pipeline is in place: mobile scanner, token estimator, budget bundler, and CLI output.

## Quick start

```bash
npm install
npm test
npm run build
```

Run the CLI:

```bash
npx mobile-context-trimmer --dir ./MyApp --query "auth flow crash" --budget 32000 --out mobile-context.md
```

## Project structure

```
mobile-context-trimmer/
├── src/
│   ├── bundler.ts
│   ├── cli.ts
│   ├── index.ts
│   ├── scanner.ts
│   └── tokenizer.ts
├── tests/
│   └── index.test.ts
├── LICENSE
├── README.md
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## License

MIT
