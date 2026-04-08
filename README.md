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

Files are then selected in **rank order** until the token budget is exhausted. When you pass a **non-empty `--query`**, the bundler applies a default **keyword relevance floor** (`minKeywordScore: 0`): files with **no lexical match** to the query (`keywordScore <= 0`) are **dropped** before budgeting, so recently touched A/B experiment stubs cannot crowd out on-topic files. Raise the floor with `--min-keyword-score` to demand stronger matches; use **`--min-keyword-score -1`** to disable the floor while keeping ranking.

**Tail noise from recency:** Utilities can clear the keyword floor from a **spurious** hit (e.g. `subscriptions` as a property name) while **recency still applies at full strength**, so combined scores can stay high (~0.3–0.45) and a **low** `--min-combined-score` (near 0) will not remove them.

Two levers work together:

1. **Recency dampening** (on by default when `--query` is non-empty): recency is scaled by `min(1, keywordScore / reference)` with default reference **~0.055** (`DEFAULT_KEYWORD_RECENCY_REFERENCE`). Weak lexical matches no longer inherit the full 30% recency term. **`--keyword-recency-reference 0`** restores legacy behavior (no dampening). Lower the reference to dampen more aggressively.

2. **Combined score floor:** With a query, the CLI now defaults **`--min-combined-score` to `0.1`** (`DEFAULT_MIN_COMBINED_SCORE_WITH_QUERY`). Calibrate on your repo—many iOS codebases land in roughly the **0.08–0.15** band for separating boilerplate tails from task files; raise toward **0.2** if utilities still slip through. **`--min-combined-score -1`** disables the floor.

## Quick start

```bash
npx mobile-context-trimmer --dir ./MyApp --query "fix login crash" --budget 32000 --out mobile-context.md
```

Stricter tail (defaults already apply dampening + combined floor `0.1`; raise if needed):

```bash
npx mobile-context-trimmer --dir ./MyApp --query "add subscriptions to menu" --min-combined-score 0.15 --budget 32000 --out mobile-context.md
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
| `--min-keyword-score` | `number` | `0` when `--query` is set; disabled when query empty | Omit files with `keywordScore` at or below this value. Negative value disables the floor. |
| `--min-combined-score` | `number` | **`0.1`** when `--query` is set | Omit ranked files whose combined `score` is **strictly below** this value. **`-1`** disables. |
| `--keyword-recency-reference` | `number` | **`~0.055`** | Recency dampening reference (see above). **`0`** disables dampening. |

### Ranking & bundle gate flags (reference)

These three flags only affect behavior when you pass a **non-empty `--query`** (except `--min-keyword-score`, which is ignored when the query is empty).

| Flag | Effect |
| --- | --- |
| **`--min-keyword-score`** | Drops files whose lexical **keyword score** (TF×IDF) is **≤** this value before spending token budget. **Default with query: `0`** (drops files with no query match). **`-1`** disables this floor. Raise it (e.g. `0.02`) if incidental token hits still get through. |
| **`--min-combined-score`** | Drops files whose **weighted rank score** (keyword + damped recency + type) is **&lt;** this value. **Default with query: `0.1`**. **`-1`** disables. Tune roughly **0.08–0.15** on many iOS repos; increase toward **0.2** if utility files still fill the tail. |
| **`--keyword-recency-reference`** | Controls **recency dampening**: recency is scaled by `min(1, keywordScore / reference)`. **Default: ~`0.055`**. **`0`** turns dampening off (legacy: full recency weight even for weak keyword hits). **Lower** the reference to dampen recency more aggressively for weak matches. |

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
- Files skipped below keyword relevance floor: 6
- Files skipped below combined rank score: 3

## File: `ios/App/AppDelegate.swift`

- Absolute path: `/path/to/MyApp/ios/App/AppDelegate.swift`
- Estimated tokens: 80
- Rank score: 0.812345
- Keyword score: 0.401000

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
  DEFAULT_MIN_COMBINED_SCORE_WITH_QUERY,
  formatBundleMarkdown,
} from "mobile-context-trimmer";

const rootDir = process.cwd();
const files = await scanMobileFiles({ rootDir, includeContent: false });
const ranked = await rankMobileFiles(files, {
  query: "push notification",
  rootDir,
});
const tokenizer = createDefaultTokenizer();
const bundle = await buildBundle(ranked, {
  tokenBudget: 32000,
  tokenizer,
  minKeywordScore: 0,
  minCombinedScore: DEFAULT_MIN_COMBINED_SCORE_WITH_QUERY,
});
console.log(formatBundleMarkdown(bundle, rootDir));
```

## Development

```bash
npm install
npm test
npm run build
```

### CI

[GitHub Actions](.github/workflows/ci.yml) runs **`npm ci`**, **`npm test`**, and **`npm run build`** on **push** and **pull request** to `main` or `master` (Node 18, 20, 22).

### Publishing to npm

- `package.json` includes **`publishConfig.access: "public"`** for scoped or first-time public packages.
- Set **`repository`**, **`bugs`**, and **`homepage`** in `package.json` to your GitHub URLs if they differ from the template.
- From a clean tree: `npm run build && npm test`, then `npm publish` (with npm login and version bump as needed).

Tests include unit coverage for scanner, tokenizer, bundler, ranker (TF‑IDF), Xcode path heuristics, optional git recency, and a CLI end-to-end run.

## Contributing

Pull requests should stay focused, include tests for behavior changes, and pass `npm test && npm run build`.

## License

MIT
