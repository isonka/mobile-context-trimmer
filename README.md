# mobile-context-trimmer

`mobile-context-trimmer` is a TypeScript CLI + library for building LLM-ready context bundles from native iOS and Android repositories.

## Status

Initial scaffold is in place (CLI entrypoint, typed library export, test setup, and build pipeline).

## Quick start

```bash
npm install
npm test
npm run build
```

Run the CLI:

```bash
npx mobile-context-trimmer
```

## Project structure

```
mobile-context-trimmer/
├── src/
│   ├── cli.ts
│   └── index.ts
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
