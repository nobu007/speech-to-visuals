# Speech-to-Visuals コンテキストノート


<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-04-27
**最終更新**: 2026-08-23（kairo-design session 統合記録 — design-interview.md A126 追加・audit-pass-first pattern をアーキテクチャ不変量に昇格・architecture.md に独立節新設・Acceptance に Phase 189-193 の REQ-391/392/393/394/395 census 5 chain + REQ-396/397 facet 5 計画 spec 受理 + A126 統合記録の 7 行追加）/ 2026-08-21（Phase 176 REQ-378 履行 — count-or-null 契約を health-check-service の fallback に拡張：6 つの gate-fed field（successRate/avgProcessingTime/activeRequests/cacheHitRate/errorRate/recoverySuccessRate）の DEFAULT 0 を明示 null に置換・PerformanceSnapshot 型を `number | null` に widen・`hitRate = ... || 0` silent-PASS を `totalHits+totalMisses === 0 → degraded "no events recorded yet"` へ置換・MW-043 mutation-verified）
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

### コアパッケージ（stv-core 分割・PR #7・2026-08-18）
- @stv/core v1.0.7 — 共有型（types/diagram 等）・ユーティリティ（logger/guards/sanitize 等）・設定（limits/schema/validate/production-config 等）の20モジュールパスを外部化したコアパッケージ
- 依存は GitHub タグ完全 pin: `github:nobu007/stv-core#v1.0.7`（浮動 ref 禁止・REQ-311）
- プロダクトリポジトリの317ファイルが `@stv/core` から import（2026-08-19 実測・REQ-310/312）

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
├── __tests__/       # src 直下テスト
├── analysis/        # 内容分析（LLM、Gemini、図解検出、言語検出、複雑度）
├── api/             # REST API（バッチ処理、WebSocket、ミドルウェア）
├── components/      # React UI（20+コンポーネント）
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
├── visualization/   # 図解レイアウト（14+戦略）
└── workers/         # Web Worker
```

※ 旧 `src/config`・`src/lib`・`src/types`・`src/utils` は @stv/core 移管で消滅（PR #7・2026-08-18）。`src/` 直下は2026-08-19 時点で19ディレクトリ + エントリファイル（App.tsx/main.tsx 等）。

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
- [x] 主要ディレクトリ構造の記述が実際の src/ 配下と一致する（19ディレクトリ + エントリファイル・2026-08-19 実測。旧 config/lib/types/utils は @stv/core 移管で消滅）
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
- [x] 第210回検証: Phase 125 legacy 視覚化 flow/flowchart スイッチパリティ CLOSED（REQ-292・5 サイト修正 + diagram-type-switch-parity-guard.test.ts 205行・4 known-fix pin + 広範囲 sweep）
- [x] 第210回検証: Phase 126 config-restore 有限性 LAST tail CLOSED（REQ-293・export.qualityPresets[].{w,h,fps,q} 配列内オブジェクト + isPositiveFiniteNumber + Array.isArray + element shape check・RED 21→GREEN 152/8 関連 suites 242/242）
- [x] 第210回検証: Phase 127 ExportJobQueue ETA オフバイワン修正（REQ-294・getEstimatedWaitTime position+1-availableSlots・新規 queue/ETA ordering バグクラス記録・RED 3→GREEN 39+112）
- [x] 第210回検証: Phase 128 config-restore 有限性 monitoring/export/memoryLimit SCALARS（REQ-295・7 フィールド + RED 33→GREEN 130/179/179 no regression/tsc 0）
- [x] 第210回検証: Phase 129 config-restore 有限性 performance SCALARS（REQ-296・3 フィールド + RED 19→GREEN 96/139/139 persistence-path/tsc 0・safe-storage 全 scalar/array numeric chokepoint 完結）
- [x] 第210回検証: Phase 130 stale-closure/async-setState クラス GUARDED-STRUCTURAL（REQ-297・async-state-stale-closure-guard.test.ts + 既知修正ピン 2 件 + handler-BODY 粒度 + JSX 除外 + ${...} 保持・0 live bugs・4/4+tsc 0）
- [x] 第210回検証: Phase 131+ パターン横展開提案（REQ-298~301・AI Hub steering feedback A〜D・diagram-type-switch-parity 他同値クラス展開 / storageParser validators JSON.parse vs JSON.stringify 非対称監査 / async-setState positive-case fixture / timestamp guard mutation-verified CI ピン留め）
- [x] 第211回検証: Phase 131+ 提案具体化（REQ-298/299/300 追加・feedback A/B/C 統合・feedback D「timestamp guard」は REQ-301 codec option 占有のため除外し別経路で段階実装・interview-record A129 参照）
- [x] 第218回検証: Phase 137 stv-core コア分割後の要件同期（REQ-310~312 — @stv/core 単一ソース/重複実装禁止・GitHub タグ pin 固定・tests/guards 境界 structural pin・requirements.md dead citation 17件 + acceptance-criteria.md 10件解消・Phase 111+ サマリー表 stale 合計是正・interview-record A137 参照）
- [x] 第219回検証: Phase 189 audit-pass-first census 第1facet 確立 — REQ-391 measurement-fixture class repo-wide census guard 新設 + 残存 9 site 一括撲滅（5b598ba4・TASK-0273・MW-055、interview-record A126 参照）
- [x] 第220回検証: Phase 190 audit-pass-first census 第2facet 契約側 — REQ-392 未populate契約（optional metric producer ゼロ）census guard 新設 + 4 dead leg 一括撲滅（fd6e4674・TASK-0274・MW-056、entityExtractionF1Score/relationAccuracy + measured branch + pipeline cacheHitRate never-wired leg + currentSize alias、REQ-389 設計決定 (2) 撤回を含む）
- [x] 第221回検証: Phase 191 audit-pass-first census 第3facet — REQ-393 score-ladder（凍結小数 leg）census guard 新設 + 10 site 一括撲滅（3d29c1ae・TASK-0275・MW-057、meanSegmentConfidence canonical 化）
- [x] 第222回検証: Phase 192 audit-pass-first census 第4facet — REQ-394 文-level 凍結 literal（frozen return・直値 initializer）census guard 新設 + 残件 0 固定 confirmed-zero（58bf86b4・TASK-0276・MW-058、撲滅同梱なし）
- [x] 第223回検証: Phase 193 audit-pass-first census 第5facet — REQ-395 census-artifact 三方一致 guard（spec 宣言数 ↔ guard roster ↔ LIVE archive 行の未検査辺を結ぶ、phrase は実測から構築）+ 終了済み ratchet 解体手順固定（解体≠削除）（5bd755d7・TASK-0277・MW-059、初回 run で spec↔roster drift 2 件発見訂正: REQ-391 ALLOWED 38→37・REQ-392 ROSTER 32/LIVE 27→34/29・7 file、pin ≥59）
- [x] 第224回検証: REQ-396/397 audit-pass-first census 第6facet（stale-comment・type-narrow-as-any・any 漏出）計画 spec 新設 — paired 3 guard 新設計画・family 5/6/7 登録・confirmed-zero + audit-driven 撲滅同梱の 2 方針併用を plan text 化（5d098b8b・specs/audit-pass-first-census-facet-5/ 同梱、実装履行は次 TASK 着手予定）
- [x] 第225回検証: design-interview.md A126 統合記録追加（kairo-design session 2026-08-23・audit-pass-first pattern のアーキテクチャ不変量昇格・T0250 closing receipt 単一 range 化を次 TASK 履行待ちとして記録） + architecture.md に audit-pass-first census パターン節新設 + 6 行 acceptance 反映
- [ ] **第218回+AI Hub make-run: Phase 175 AI Hub make-run steering feedback 統合要件化（REQ-378〜381 要件化完了・TC-362〜365 追加）** — make-run 出力値判定「前イテレーション VALUABLE」「4 commits of concrete bug fixes」からの継続プロンプト 4 件（count-or-null 契約の一般化方針昇格・suite-count == registry-entry-count parity leg 不変量化・pre-fold registry entry-count audit・4-row mutant ledger template 付録昇格）を次サイクル要件として具象化。要件化は完了（spec prose 反映）、実装履行は次 TASK（例: TASK-0261/0262）着手予定。TC-362〜365 は提案ベース（🟡）+ 1 件不変量 pin（🔵 TC-363）で履行を待つ状態。architecture.md に pre-fold audit 行（round 50、pre-fold count = 47）を追加し、frozen-literal-registry の PINNED ≥42 直前の fold 候補 4 family を文書化。mutation-witness-ledger.md の 更新ルール に 4-row template への正規化 step を追加予定

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


<!-- spine:references:begin -->
## Spine: external references

- [audit-pass-first census 第5 facet — Context Note](../audit-pass-first-census-facet-5/note.md)

<!-- spine:references:end -->
