# CodeReview 定義 — speech-to-visuals

`code-docs-review` スキル（汎用エンジン）に対する本リポジトリ固有のレビュー定義。
パスは本ファイル位置（repo root）からの相対参照。
**本ファイルに現時点の状態予測を書かないこと** — 結果は実ファイルの実測でのみ決まる。

## 対象

| 項目 | パス |
|---|---|
| 実装コード | `src/**/*.ts`・`src/**/*.tsx`・`scripts/**/*.ts` |
| 設定 | `package.json`・`tsconfig*.json`・`jest.config.cjs`・`remotion.config.ts`・`vite.config.ts`・`tailwind.config.ts`・`eslint.config.js` |
| docs | `README.md`・`TESTING_GUIDE.md`・`CLAUDE.md`・`AGENTS.md`・`STEERING.yaml`・`docs/**/*.md` |
| specs | `specs/**/*` |

**除外**（指摘対象外・存在報告も不要）:

- `node_modules/`・`dist/`・`build/`・`.venv/`・`__pycache__/` — 生成物・依存。
- `package-lock.json`・`test-scene-data.json` — 自動生成・fixture。

## 観点

| # | カテゴリ | 観点 | 証拠ソース | 既定重大度 |
|---|---|---|---|---|
| 1 | docs | README の機能・処理フロー記載と実装の整合 | `README.md`・`src/**`・`remotion.config.ts` | 高 |
| 2 | docs | README・TESTING_GUIDE のコマンド例と package.json scripts の整合 | `README.md`・`TESTING_GUIDE.md`・`package.json` | 高 |
| 3 | docs | README・docs の構成ツリー・パス記載の実在性 | `README.md`・`docs/**/*.md`・実ファイル群 | 中 |
| 4 | docs | テスト運用記載とテスト実態の整合 | `TESTING_GUIDE.md`・`jest.config.cjs`・`tests/**`・`package.json` | 中 |
| 5 | docs | 数値主張 (精度・FPS・解像度・処理時間) の根拠明示 | `README.md`・`docs/**/*.md`・`specs/**` | 中 |
| 6 | docs | ガバナンス doc 相互参照 (リンク・パス・コマンド) | `CLAUDE.md`・`AGENTS.md`・`STEERING.yaml`・実ファイル群 | 中 |

### 観点 1 — README の機能・処理フロー記載と実装の整合

1. README「主要機能」「処理フロー」が列挙する機能（音声認識・図解タイプ判定・
   レイアウト生成・動画レンダリング等）に対応する実装が `src/` に実在するか。
2. 図解タイプ（flow/tree/timeline/matrix/cycle 等、README 記載のもの）が
   実装内に型・分岐・定数として実在するか。README に列挙され実装に無い
   もの・逆に実装に有り README に無いものを指摘する。
3. README の出力仕様（解像度・fps・出力形式）と `remotion.config.ts` 等の
   実設定を照合する。

### 観点 2 — コマンド例と package.json scripts の整合

1. `package.json` の scripts を全列挙する。
2. README・TESTING_GUIDE に書かれた `npm run ...`・`npx ...` コマンドが
   scripts・devDependencies と一致するか。実在しないコマンドを指摘する。
3. 逆に主要 scripts のうち docs に一度も説明が無いものを指摘する。

### 観点 3 — 構成記載の実在性

README・docs の「ディレクトリ構成」「リポジトリ構成」等のツリー記載と
markdown リンク先が実ファイルとして存在するか。実在しないパスを指摘する。

### 観点 4 — テスト運用記載とテスト実態の整合

TESTING_GUIDE の記載するテストコマンド・対象ファイル・セットアップ手順が
`jest.config.cjs`・`tests/`・`package.json` の実態と一致するか。
実在しないコマンド・対象・手順を指摘する。

### 観点 5 — 数値主張の根拠明示

README・docs に書かれた定量的主張（認識精度・図解判定精度・レイアウト品質・
FPS・処理時間・解像度等）について、`docs/`・`specs/` 内にその測定根拠
（検証結果・ベンチマーク・仕様書）への言及・リンクがあるか。
根拠が見当たらない主張を「根拠未明示」として指摘する（数値の真偽ではなく
根拠の明示有無を検証する）。

### 観点 6 — ガバナンス doc 相互参照

CLAUDE.md・AGENTS.md・STEERING.yaml 間、およびから他 doc への相対リンク・
パス参照・コマンド例が実在するか。STEERING.yaml が参照するパスの実在を含む。

## 集約ルール

- **要修正**: 高 ≥ 1。
- **要整備**: 高 0・中 ≥ 1。
- **改善提案**: 高・中 0・低 ≥ 1。
- **クリーン**: 指摘 0。
- **検証不能**: 定義ファイルなし・証拠ソースの大規模欠落。
- 確認不能項目（実行時挙動・外部 API 依存の実測等）は判定に数え入れず、
  別枠で記録する。
- 修正方針は「docs を実態に合わせる」方向を原則とする（コードを docs に
  合わせる修正は、その方が明らかに正しい場合のみ）。
