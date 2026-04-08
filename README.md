# mobile-context-trimmer

TypeScript CLI and library that scans native **iOS** and **Android** repositories and builds a token-budgeted markdown context bundle for LLMs.

## Why this exists

Mobile codebases mix Swift/Kotlin sources with Xcode and Gradle noise. Plain “scan everything” bundles waste budget on generated or churn-heavy files, while missing the files that actually changed recently. This tool applies **mobile-aware defaults** (extensions, ignores) and ranks files using **TF‑IDF-style relevance**, **git recency with Xcode-safe rules**, and **file-type priority**—similar to `context-trimmer`, but tuned for native apps.

## How ranking works

Each file gets a weighted score from three signals:

| Signal | Description |
| --- | --- |
| **Query match** | TF × IDF over query terms in file content (corpus = scanned files). Rare terms that appear in few files count more than words that appear everywhere. |
| **Recency** | Last commit time from batched `git log` (first-seen path wins), normalized across the set. **Xcode-safe:** paths under `.xcodeproj/`, `*.pbxproj`, and `xcuserdata` **do not** use git timestamps (they are excluded from the git map and use **filesystem `mtime`** instead), so Xcode constantly rewriting the project file does not drown out real Swift/Kotlin activity. |
| **File type** | Extension weights (e.g. `.swift` / `.kt` favored over `.xml` / `.properties`). |

Default weights: keyword **0.55**, recency **0.30**, type **0.15** (recency matters more on mobile than in generic JS repos).

Files are then selected in **rank order** until the token budget is exhausted.

## Quick start

```bash
npx mobile-context-trimmer --dir ./MyApp --query "fix login crash" --budget 32000 --out mobile-context.md
```

Stream to stdout (omit `--out`):

```bash
npx mobile-context-trimmer --dir ./MyApp --query "navigation stack" --budget 16000
```

## CLI options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `--dir` | `string` | current working directory | Project root to scan |
| `--query` | `string` | `""` | Task or keywords for ranking (optional but recommended) |
| `--budget` | `number` | `32000` | Approximate token budget (char/4 estimator) |
| `--out` | `string` | none | Write markdown bundle to this path |

## Scanning defaults

**Extensions (whitelist):** `.swift`, `.m`, `.mm`, `.h`, `.plist`, `.kt`, `.kts`, `.java`, `.xml`, `.gradle`, `.properties`

**Always ignored (in addition to `.gitignore` / `.trimmerignore`):** e.g. `Pods/`, `DerivedData/`, `.gradle/`, `build/`, Core Data `*.xcmapping.xml`, common IDE and web artifacts. See `getDefaultMobileIgnorePatterns()` in source.

The CLI uses **metadata-first** scanning (`includeContent: false` during walk) and reads file contents only while ranking and bundling.

## Example output

```markdown
# Mobile Context Bundle

- Files included: 2
- Tokens used: 120
- Files skipped due to budget: 5

## File: `ios/App/AppDelegate.swift`

- Absolute path: `/path/to/MyApp/ios/App/AppDelegate.swift`
- Estimated tokens: 80

```
// file content
```
```

## Library usage

```ts
import {
  scanMobileFiles,
  rankMobileFiles,
  createDefaultTokenizer,
  buildBundle,
  formatBundleMarkdown,
} from "mobile-context-trimmer";

const rootDir = process.cwd();
const files = await scanMobileFiles({ rootDir, includeContent: false });
const ranked = await rankMobileFiles(files, {
  query: "push notification",
  rootDir,
});
const tokenizer = createDefaultTokenizer();
const bundle = await buildBundle(ranked, { tokenBudget: 32000, tokenizer });
console.log(formatBundleMarkdown(bundle, rootDir));
```

## Development

```bash
npm install
npm test
npm run build
```

Tests include unit coverage for scanner, tokenizer, bundler, ranker (TF‑IDF), Xcode path heuristics, optional git recency, and a CLI end-to-end run.

## Contributing

Pull requests should stay focused, include tests for behavior changes, and pass `npm test && npm run build`.

## License

MIT
