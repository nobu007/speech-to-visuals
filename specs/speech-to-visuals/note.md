# Speech-to-Visuals コンテキストノート

**作成日**: 2026-04-27
**最終更新**: 2026-05-02（第77回検証版・Phase 1-15全完了・269ファイル・82,629行・101タスク完了・3,118テスト全通過(116 suites)・TypeScript/ESLintエラー0件・95要件・カバレッジ88.85% stmts/75.91% branches・ギャップなし）
**プロジェクト**: Speech-to-Visuals - 音声→図解動画自動生成システム

## 技術スタック

### フロントエンド
- React 18.3 + TypeScript 5.8
- Vite 5.4（ビルドツール）
- Tailwind CSS + shadcn/ui（スタイリング・UIコンポーネント）
- Remotion 4.0（動画生成・プレビュー）
- React Router 6.30（ルーティング）
- React Query（TanStack Query 5.100）（状態管理）
- Zod 3.25.76（スキーマ検証）
- Recharts 2.15（グラフ可視化）
- Sonner 1.7（通知）

### バックエンド・処理
- Node.js 18+
- Express 5.2.1（API サーバー）
- Supabase 2.105（DB・Edge Functions・ストレージ）
- Socket.IO 4.8（リアルタイム通信）

### AI・ML
- Google Gemini AI @google/generative-ai 0.24（LLM）
- Whisper @remotion/install-whisper-cpp（音声認識）
- Kuromoji 0.1（日本語形態素解析）
- @dagrejs/dagre 1.1（グラフレイアウト）

### 開発ツール
- ESLint 9（Lint）
- Jest 30.3 + ts-jest 29（テスト）
- tsx 4.20（TypeScript 実行）

## 開発ルール

- TypeScript strict モード
- ESM（"type": "module"）
- パスエイリアス: `@` → `./src`
- ケバブケース ファイル命名
- 1ファイル1責務

## 関連実装

### 主要ディレクトリ構造
```
src/
├── analysis/        # 内容分析（LLM、Gemini、図解検出、言語検出、複雑度）
├── api/             # REST API（バッチ処理、WebSocket、ミドルウェア）
├── components/      # React UI（20+コンポーネント）
├── config/          # 設定（プロダクション設定、Zod バリデーション）
├── export/          # エクスポート（SVG/PNG/PDF/JSON）
├── framework/       # 再帰的改善フレームワーク
├── hooks/           # React Hooks
├── integrations/    # Supabase 統合
├── monitoring/      # プロダクション監視
├── optimization/    # パラメータチューニング、キャッシュ、遅延ロード
├── pages/           # React Router ページ
├── performance/     # インテリジェントキャッシュ
├── pipeline/        # パイプライン（Simple/Main/Framework/Orchestrator）
├── quality/         # 品質保証・エラー回復・品質ゲート
├── remotion/        # Remotion 動画コンポーネント
├── test/            # テストユーティリティ
├── transcription/   # 音声認識（Whisper/Streaming/Browser）
├── types/           # TypeScript 型定義
├── utils/           # ユーティリティ
└── visualization/   # 図解レイアウト（14+戦略）
```

### Supabase 構成
- ストレージバケット: `audio`（公開読み取り、認証済み書き込み）
- テーブル: `diagram_projects`（RLS有効）
- Edge Functions: `render-video`, `transcribe-audio`, `generate-scenes`

## 設計文書

- `docs/architecture/SYSTEM_CORE.md` - コアアーキテクチャ定義
- `docs/architecture/PIPELINE_FLOW.md` - 処理パイプライン仕様
- `docs/architecture/QUALITY_METRICS.md` - 品質評価基準
- `docs/architecture/ITERATION_LOG.md` - 改善履歴

## 注意事項

- GOOGLE_API_KEY 環境変数が必須（未設定時はルールベースにフォールバック）
- 開発サーバー: `npm run dev` → http://localhost:8080/simple
- API サーバー: `npm run api:dev`
- Remotion Studio: `npm run remotion:studio`
- 型チェック: `npm run type-check`
- テスト: `npm run test`

## システム憲法（SYSTEM_CONSTITUTION.md）

- 音声→図解動画自動生成の単一目的に限定
- 手動編集機能・ユーザー管理・SNS連携等は禁止
- 総ファイル数25以下（憲法制定時、現在は拡張済み）
- 1ファイル150行以下（憲法制定時、現在は拡張済み）
