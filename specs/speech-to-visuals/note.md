# Speech-to-Visuals コンテキストノート


<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-04-27
**最終更新**: 2026-08-04（第204回検証・Phase 115 テストスイート安定化・Lint完全修正完了・ESLint 234エラー→0・jest.mock ESM修正・validateAudioFile クラッシュ修正・CJKトークン化テスト追加・キリル文字混入メソッド名修正・REQ-270~273追加）
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
- [x] 主要ディレクトリ構造の記述が実際の src/ 配下と一致する（24ディレクトリ）
- [x] 開発コマンド（dev, api:dev, remotion:studio, type-check, test）が package.json scripts と一致する
- [x] Phase 75 テストスイート安定化が完了（ESM互換性・エラー型伝播・アサーション修正・26+テスト障害解消）
- [x] Phase 76 バッチ処理プログレス正確性要件（REQ-196）が追加済み（コミット8edf876実装に基づく）
- [x] Phase 76 パイプラインオーケストレーター入力検証要件（REQ-197）が追加済み（コミット3eb6f6d実装に基づく）
- [x] Phase 76 全タスク完了（TASK-0188~0192）
- [x] Phase 78-79 プロダクション観測性強化完了（REQ-200 相関ID・REQ-204 構造化HTTPロギング）
- [x] Phase 80-82 HTTPメトリクス・Prometheus・ヘルスプローブ完了（REQ-205~207・41テスト追加）
- [x] Phase 83-86 監視ダッシュボード・アラート・API統合・Prometheus/アラート検証完了（REQ-208~215）
- [x] Phase 87 監視エンドポイントZodクエリ検証完了（REQ-216・107テスト追加）
- [x] Phase 88 LLM応答図解構造検証完了（REQ-217・ノード重複排除・自己ループフィルタ・5テスト追加）
- [x] Phase 89 シーン駆動アニメーションエクスポート完了（REQ-218~219・Animated SVG・Lottie JSON・視覚形状コンテンツ・animated-scene-renderer モジュール抽出・36テスト・28テスト）
- [x] Phase 90 エクスポートパイプラインE2E・結合・横断一貫性テスト完了（TASK-0199~0201・391+256+549行・Express 5型安全性修正）
- [x] Phase 91 シーンレンダラー入力検証完了（REQ-221・validateFrameInfo・clampSceneDuration・SceneRendererValidationError・29テスト追加）
- [x] Phase 92 エラーリカバリREST API堅牢化完了（REQ-222・RegisterBodySchema・errorId形式検証・XSSサニタイズ・LRU退去・ERROR_REGISTRY_LIMITS・94テスト追加）
- [x] Phase 93 エクスポート検証拡張完了（REQ-223・APNG acTL/fcTLチャンク検証・Lottie JSON構造検証・31テスト追加）
- [x] Phase 94 エクスポートレート制限・レンダー検証強化完了（REQ-224・exportRateLimiter 10req/15min・codec列挙型検証・resolution正規表現検証・2テスト追加）
- [x] Phase 95 エクスポートエンジン検証統合完了（REQ-225・finalizeExport検証・10テスト追加）
- [x] Phase 96 エクスポートメトリクス収集完了（REQ-226・ExportMetricsCollector・17テスト追加）
- [x] Phase 97 エクスポートリトライレジリエンス完了（REQ-227・encodeVideoWithRetry・15テスト追加）
- [x] Phase 98 エクスポートジョブライフサイクル管理完了（REQ-228・cancelExport+AbortController・15テスト追加）
- [x] Phase 99 エクスポートジョブキューサービス完了（REQ-229・ExportJobQueue・優先度スケジューリング・フェアスケジューリング・32テスト・コミットa949644）
- [x] Phase 100 エクスポートアーティファクト管理完了（REQ-230・ExportArtifactStore・TTLクリーンアップ・LRU退去・ダウンロードURL・26テスト・コミット4320a4c）
- [x] Phase 101/102 アーティファクトパイプライン統合要件追加（REQ-231~237・EnhancedExportEngine統合・ProductionExporter統合・ExportJobQueue統合・ダウンロードAPI・LRU退去E2Eテスト・TTL期限切れ統合テスト・フルライフサイクルE2Eテスト）
- [x] Phase 108 エクスポートセキュリティ hardening 完了（REQ-244~246・イベントハンドラ正規表現名前付き定数配列化・プロパティベース変異ファジング回帰ネット・SecurityMetricsCollector防護拒否メトリクス・130テスト追加）
- [x] Phase 109 セキュリティファジング CI 拡張完了（REQ-247~249・マルチシードCI ファジングモード・全エクスポート経路ガードメトリクス回帰テスト・E2Eセキュリティパイプライン統合テスト）
- [x] Phase 110 CI品質ゲート・ガード関数ファジング完了（REQ-250~252・red-phase CI統合・guard-fuzz test追加540ケース・security-fuzzビルド依存）
- [x] 第198回検証: EDGE-010 abort listener leak fix（EnhancedExportEngine リトライ遅延のAbortSignal listener cleanup・3テスト追加）
- [x] 第198回検証: EDGE-011 console.error→logger.error 正規化（memory-cache・budget-alert・production-monitoring-excellence・error-recovery-event-bus・5箇所修正）
- [x] 第200回検証: Phase 111 CI・インテグレーション検証ハードening要件定義（REQ-253~257・エクスポートリトライ5+サイクル統合テスト・CI timeout+ELAPSED assertion・ESLint no-console・EnhancedExportEngine リトライDI・シーンデュレーション統合検証）
- [x] 第201回検証: spine manifest validator CI統合（REQ-258・scripts/validate-spine-manifest.ts・CI spine-validate ジョブ・158行テスト）
- [x] 第201回検証: recovery path silent catch修正（REQ-259・enhanced-error-recovery.ts 4箇所・pipeline-error-recovery-orchestrator.ts 1箇所・764行テスト追加）
- [x] 第201回検証: SimpleDiagramDetectorバグ修正（REQ-260・testDetector()構造化結果返却・認識不可テキストのデフォルト要素生成・436行テスト）
- [x] 第202回検証: EnhancedErrorRecovery 5戦略silent catch修正（REQ-258・intelligent_retry/degraded_quality/cache_recovery/alternative_algorithm/minimal_viable_output・logger.error追加）
- [x] 第202回検証: 監視APIルートエラーロギング（REQ-259/262・monitoring.ts sendError 500エラー時にlogger.error呼出・5テスト追加）
- [x] 第202回検証: BatchOperationRecoveryテスト追加（REQ-260・逐次/並行/リトライ/フォールバック/集計統計/エッジケース・39テスト追加）
- [x] 第202回検証: ErrorRecoveryMonitorテスト追加（REQ-261・ライフサイクル/サンプリング/アラート計算/リセット・21テスト追加）

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
