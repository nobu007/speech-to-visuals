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
├── config/            # 設定管理・バリデーション
├── export/            # エクスポート機能 (SVG/PNG/PDF/JSON)
├── framework/         # 自動改善・学習フレームワーク
├── hooks/             # Reactカスタムフック
├── integrations/      # 外部サービス統合
├── lib/               # 共通ユーティリティ
├── monitoring/        # プロダクション監視
├── optimization/      # キャッシュ・最適化ユーティリティ
├── pages/             # ページコンポーネント
├── performance/       # パフォーマンス監視
├── pipeline/          # パイプラインオーケストレーター
├── quality/           # 品質保証・エラー管理
├── remotion/          # Remotion動画生成コンポーネント
├── transcription/     # 音声文字起こし
├── types/             # TypeScript型定義
├── utils/             # ユーティリティ関数
└── visualization/     # レイアウトエンジン・戦略
```

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

## 3. 実装前の必須確認

```bash
# 1. 既存実装の確認
grep -r "実装予定機能" src/ --include="*.ts" --include="*.tsx"

# 2. 型定義の確認
grep -r "interface.*Target" src/types/

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
