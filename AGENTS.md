# CLAUDE.md - Speech-to-Visuals 開発指示書

## プロジェクト概要

**Speech-to-Visuals**: 音声ファイルから自動的に図解とアニメーション動画を生成する TypeScript/React パイプラインシステム。

### 技術スタック

- **言語**: TypeScript 5.x (strict mode)
- **フレームワーク**: React 18 + Vite 5
- **テスト**: Jest (jest.config.cjs) + React Testing Library
- **Lint**: ESLint 9 (eslint.config.js)
- **動画生成**: Remotion 4.0
- **AI分析**: Gemini 2.5 (flash/pro)
- **音声認識**: Whisper / Web Speech API
- **UI**: Tailwind CSS 3 + shadcn/ui

### 開発コマンド

```bash
npm test              # テスト実行 (Jest)
npm run type-check    # 型チェック (tsc --noEmit)
npm run lint          # Lint (ESLint)
npm run build         # ビルド (Vite)
npm run dev           # 開発サーバー
```

### プロジェクト構造

```
src/
├── analysis/          # 音声分析・内容分析・図解検出
├── api/               # REST API・WebSocket・バッチ処理
├── components/        # React UIコンポーネント
├── export/            # エクスポート機能 (SVG/PNG/PDF/JSON)
├── framework/         # 自動改善・学習フレームワーク
├── hooks/             # Reactカスタムフック
├── integrations/      # 外部サービス統合
├── monitoring/        # プロダクション監視
├── optimization/      # キャッシュ・最適化ユーティリティ
├── pages/             # ページコンポーネント
├── performance/       # パフォーマンス監視
├── pipeline/          # パイプラインオーケストレーター
├── quality/           # 品質保証・エラー管理
├── remotion/          # Remotion動画生成コンポーネント
├── transcription/     # 音声文字起こし
└── visualization/     # レイアウトエンジン・戦略
```

**コア層は外部パッケージ**: `types/` `utils/` `lib/` `config/` は
`@stv/core` (github:nobu007/stv-core, git 依存) に分離済み。import は
`@stv/core/<dir>/<module>`。同リポジトリ側に独自の境界検査とサイズラチェット
（実装 6,000 行 / 90 ファイル上限）がある。

**正規ドキュメント**: `specs/speech-to-visuals/` に要件・設計・タスクを配置。
**憲法**: `SYSTEM_CONSTITUTION.md` がプロジェクト境界を定義。

---

# 開発プロトコル

## 1. SDECサイクル（全作業で適用）

```
1. Spec（仕様理解）: 要求を原子的な主張に分解
2. Data（証拠収集）: コード・テスト・型定義から証拠を取得
3. Eval（双方向検証）: 証拠と主張を相互検証
4. Change（変更実施）: 検証済みの変更のみ実行
```

### 実践例（TypeScript）

```
Spec: 「OverlapResolverのパフォーマンスを改善」→「200ノード時に4000ms以内で完了する」
Data: npx jest tests/performance/ --verbose で現状4061msを確認
Eval: ボトルネックが反復回数にあることをプロファイリングで確認
Change: 反復の早期終了条件を追加して修正
```

## 2. TypeScript開発ルール

### 品質基準

- `npx tsc --noEmit` で0エラー（strict mode）
- `npm run lint` で0エラー
- `npm test` で全テスト通過（2,754+テスト）
- テストカバレッジ statements >= 75%

### コーディング規約

- **型安全性**: `any` 型の使用を禁止（どうしても必要な場合は `eslint-disable` と理由をコメント）
- **単一責務**: 1ファイル = 1主要エクスポート、1関数 = 60行以内
- **エラーハンドリング**: Result型パターンまたはtry-catchで必ず処理
- **テスト**: 新規機能には必ずテストを追加
- **import**: 相対パスは2階層まで、それ以上はエイリアスを使用

### React コンポーネント規約

- 関数コンポーネント + Hooks パターン
- Props は interface で型定義
- 副作用は useEffect で管理、クリーンアップ必須
- テストは React Testing Library で user-centered に記述

### テスト規約

```typescript
// テストファイル配置: src/**/__tests__/*.test.ts または tests/**/*.test.ts
// 命名: describe > test (itではない)
describe('ModuleName', () => {
  test('should do something when condition', () => {
    // arrange - act - assert
  });
});
```

#### ソースアンカーテストのパス解決は import.meta.url 基準（禁止: process.cwd() 基準）

テストがリポジトリ内のソースを直接読む（source-anchor / mutation-pinning / canon guard 系）場合、
パスは必ず `import.meta.url` から解決すること。`process.cwd()` 基準（`resolve(process.cwd(), 'src/...')`、
 bare relative（`readFileSync('src/...')`、`globSync('src/**')`）は禁止。

- 理由1: 依存パッケージが module-load 時に `process.chdir()` することがある
  （実例: whisper-node → `tests/__mocks__/whisper-node.ts`）。chdir 後に同一 jest worker で
  実行された全スイートが誤った cwd で ENOENT → フル実行が非決定的に赤になる（16ed9ccf）。
- 理由2: `--maxWorkers>1` のスケジューリングでも cwd 相対読みは flake する（TC-302/313）。
- 理由3（最重要）: `existsSync` 前提が false になるとスイート全体が `it.skip` で
  「緑のまま無害化」する。赤より悪い。
- 正しい型: `const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');`
  （深さはテストファイルの場所に合わせる）。glob は `globSync('src/**/*.ts', { cwd: REPO_ROOT })`。
- 構造ガード: `tests/guards/source-anchor-cwd-discipline.test.ts` が全テストファイルを走査し、
  cwd 相対アンカーの新規追加を自動 FAIL する（例外は行末 `// cwd-anchor-exempt:` で宣言）。

## 3. 実装前の必須確認

```bash
# 1. 既存実装の確認
grep -r "実装予定機能" src/ --include="*.ts" --include="*.tsx"

# 2. 型定義の確認
grep -r "interface.*Target" node_modules/@stv/core/src/types/

# 3. テストの確認
find tests/ -name "*target*" -o -name "*module*"
```

**判定基準**:
- 類似実装が存在 → 既存を拡張
- 型定義が存在 → それを使用
- テストが存在 → テストファーストで修正

## 4. 禁止事項

| 禁止 | 理由 |
|------|------|
| `any` 型の使用 | 型安全性の侵害 |
| `@ts-ignore` / `@ts-expect-error` | 型エラーの隠蔽 |
| console.log の残置 | デバッグコードの混入 |
| テストなしの実装 | 品質保証不可 |
| `eslint-disable` 無理由使用 | Lintルールの回避 |
| SYSTEM_CONSTITUTION 範囲外の機能 | プロジェクト境界違反 |

## 5. 品質確認チェックリスト

各変更後に以下を確認:

- [ ] `npx tsc --noEmit` で0エラー
- [ ] `npm run lint` で0エラー（または既存と同等）
- [ ] `npm test` で全テスト通過
- [ ] 新規コードにテスト追加済み
- [ ] SYSTEM_CONSTITUTION の範囲内

## 6. ドキュメント参照

- **憲法**: `SYSTEM_CONSTITUTION.md` - プロジェクト境界・制約
- **要件**: `specs/speech-to-visuals/requirements.md` - 機能要件定義
- **設計**: `specs/speech-to-visuals/architecture.md` - アーキテクチャ設計
- **タスク**: `specs/speech-to-visuals/tasks/TASK-*.md` - 個別タスク定義
## LLM Wiki

Read `docs/llm-wiki/index.md` for high-level repository memory. Treat purpose, specs, and source files as canonical.

---

# 全自動開発ループ運用 (Autonomous Loop Ops)

大目的は「AIによる全自動開発、人間より圧倒的に効率的に」。
すべての判断基準はこれ: 無人で回るループのスループット/検証可能性/並列性。
一時的な破損より速度を取る。守るべきは現状コードではなくループの持続性。

## マージフロー (push → main 反映まで)

```bash
git checkout -b <type>/<slug>
# ...変更...
npm run verify:all            # CI と同一構成のローカルゲート (push 前に必ず)
git add -A && git commit -m "..."
git push -u origin <branch>
gh pr create --base main
gh pr merge --auto --merge --delete-branch   # checks green の瞬間に自動 merge。polling 不要
git checkout main && git pull
```

- branch protection: `all-checks-pass` のみ required status check に指定済み
  (2026-08)。`gh pr merge --auto` が使える — checks green の瞬間に自動 merge され、
  polling も手動 merge も不要。ジョブをリネーム/追加しても gate が集約するので
  protection 側の更新は不要。enforce_admins は off (緊急時の直接 push を塞がない)。
- CI 失敗時: `gh pr checks` → 最初に赤いジョブのログ (`gh run view <id> --log-failed`)
  から直接修正。ローカルで verify:all を通してから push すれば往復はほぼ消える。

## 検証コマンドの使い分け

- `npm run verify:all` — push 前のフルゲート (CI 同構成、安い順に fail-fast)
- 部分検証: `npm run type-check` / `npm run lint` / `npm run audit:code-size`
- 対象テストのみ: `npm test -- "<path-regex>"` 例: `"quality|error-recovery"` (coverage は既定で off)
- カバレッジ数値が必要なときだけ `npm run test:coverage` (CI の通常ランには含めない)

## CI 構成 (2026-08 時点)

- `test` は 4 シャードの matrix 並列 (`--shard=n/4`)。各シャード 600s budget 超過で
  hard-fail。シャードの偏りで遅いのが出たらシャード数 or 分割方法を再検討。
- `build` / `security-fuzz` に直列 `needs` はない — 並列で回し、`all-checks-pass` が集約。
- タイムバジェット (REQ-254) は各ジョブが自负する。test 以外は gate job が
  `budget_exceeded` 出力を assert する形。

## jest 並列と既知の flake 源

- `maxWorkers: '75%'`。コアを遊ばせない (ローカル 12 core → 9 worker、CI 4 vCPU → 3)。
- **`detectOpenHandles` を設定に戻すな** (2026-08 の実測教訓)。jest はこれが立っていると
  worker を 1 本も spawn せず全スイートを in-band 直列実行する (maxWorkers は黙って無視)。
  実害: 全実行 79秒→11.5分。リーク診断が欲しいときは一部サブセットに
  `--detectOpenHandles` を CLI で付ける。
- cwd 相対のソース読みは禁止 (冒頭の source-anchor 規約 + 構造ガードが強制)。
  これを破ると `maxWorkers>1` で非決定的に赤になる。

## ガード文化 (リファクタ時の契約)

- リファクタは verbatim 移動が原則。配線 (DI/callback) のみ書き換える。
- コードを別ファイルへ移動したら、そのファイルを readSource している guard の
  アンカーを新征程に再指向する。消し忘れは guard 自身が fail するので必ず気づく。
- 「ガード以外のテストを一つも直さずに全部通る」ことが挙動保存の証明。
- internals テストは private メンバへの bracket/cast アクセス (`rec['loadMetrics']` 等)
  を使う。クラス分割時はファサードに delegate/accessor を残して互換を保つ
  (前例: enhanced-error-recovery.ts 分割、PR #10)。

## 行数バジェット

- `audit:code-size` が impl の総行数/ファイル数/1ファイル上限を憲法制限で ratchet する。
- 上限に近づいたら新規追加より削除 (デッドコード掃除) で余裕を作る。
- 1 ファイル上限 2,000 行。god-file を作ったら分割して CI が落ちる前に潰す。
