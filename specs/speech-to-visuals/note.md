# Speech-to-Visuals コンテキストノート


<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-04-27
**最終更新**: 2026-05-18（第154回検証・Phase 1-51全完了・Phase 52進行中（REQ-132~134テスト検証）・327ファイル・96,466行・105パッケージ(74 deps+31 devDeps)・TypeScriptエラー0件・ESLintエラー0件・console.log 0件（CLAUDE.md基準達成）・4,357テスト（194スイート）・154要件（REQ-001~134+NFR+EDGE）・npm audit 0脆弱性）
**プロジェクト**: Speech-to-Visuals - 音声→図解動画自動生成システム

## 技術スタック

### フロントエンド
- React 18.3 + TypeScript 5.9
- Vite 6.4（ビルドツール）
- Tailwind CSS + shadcn/ui（スタイリング・UIコンポーネント）
- Remotion 4.0（動画生成・プレビュー）
- React Router 6.30（ルーティング）
- React Query（TanStack Query 5.100）（状態管理）
- Zod 3.25.76（スキーマ検証）
- Recharts 2.15（グラフ可視化）
- Sonner 2.0（通知）

### バックエンド・処理
- Node.js 18+
- Express 5.2.1（API サーバー）
- Supabase 2.105（DB・Edge Functions・ストレージ）
- Socket.IO 4.8（リアルタイム通信）

### AI・ML
- Google Gemini AI @google/generative-ai 0.24（LLM）
- Whisper @remotion/install-whisper-cpp（音声認識）
- Kuromoji 0.1（日本語形態素解析）
- @dagrejs/dagre 3.0（グラフレイアウト）

### 開発ツール
- ESLint 9（Lint）
- Jest 30.3 + ts-jest 29（テスト）
- tsx 4.21（TypeScript 実行）

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
├── lib/             # 共有ライブラリ（shadcn/ui primitives 等）
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

## Acceptance criteria

- [x] フロントエンド技術スタックのバージョンが package.json dependencies と一致する（React 18.3, TypeScript 5.9, Vite 6.4, React Router 6.30, TanStack Query 5.100, Zod 3.25.76, Recharts 2.15, Sonner 2.0, Remotion 4.0）
- [x] バックエンド・処理技術スタックのバージョンが package.json dependencies と一致する（Express 5.2.1, Supabase 2.105, Socket.IO 4.8）
- [x] AI・ML技術スタックのバージョンが package.json dependencies と一致する（@google/generative-ai 0.24, @remotion/install-whisper-cpp, Kuromoji 0.1, @dagrejs/dagre 3.0）
- [x] 開発ツールのバージョンが package.json devDependencies と一致する（ESLint 9, Jest 30.3, ts-jest 29, tsx 4.21）
- [x] 主要ディレクトリ構造の記述が実際の src/ 配下と一致する（21ディレクトリ）
- [x] 開発コマンド（dev, api:dev, remotion:studio, type-check, test）が package.json scripts と一致する

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
