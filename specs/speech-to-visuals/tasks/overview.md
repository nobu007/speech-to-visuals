# speech-to-visuals タスク概要

**作成日**: 2026-04-30
**最終更新**: 2026-05-01（Phase 8 追加: 品質検証・ギャップ解消）
**プロジェクト期間**: 2026-04-27 - 2026-08-22（118日）
**推定工数**: 624時間（+72h+24h+36h）
**総タスク数**: 76件
**ステータス**: Phase 1-7 完了（70/70）、Phase 8 未着手（0/6）

## 関連文書

- **要件定義書**: [📋 requirements.md](../requirements.md)
- **設計文書**: [📐 architecture.md](../architecture.md)
- **API仕様**: [🔌 api-endpoints.md](../api-endpoints.md)
- **データベース設計**: [🗄️ database-schema.sql](../database-schema.sql)
- **インターフェース定義**: [📝 interfaces.ts](../interfaces.ts)
- **データフロー図**: [🔄 dataflow.md](../dataflow.md)
- **コンテキストノート**: [📝 note.md](../note.md)

## フェーズ構成

| フェーズ | 期間 | 成果物 | タスク数 | 工数 | ステータス |
|---------|------|--------|----------|------|-----------|
| Phase 1 | 2026-04-27 ~ 2026-05-09 | 基盤・データ層 | 10 | 68h | ✅完了 |
| Phase 2 | 2026-05-12 ~ 2026-06-06 | AI・処理モジュール | 12 | 112h | ✅完了 |
| Phase 3 | 2026-06-08 ~ 2026-06-27 | レイアウト・可視化 | 9 | 88h | ✅完了 |
| Phase 4 | 2026-06-29 ~ 2026-07-25 | レンダリング・フロントエンド | 11 | 104h | ✅完了 |
| Phase 5 | 2026-07-27 ~ 2026-08-22 | 統合・テスト | 18 | 156h | ✅完了 |
| Phase 6 | 未定 | 高度レイアウト・拡張タイプ | 6 | 72h | ✅完了 |
| Phase 7 | 未定 | コード品質改善 | 4 | 24h | ✅完了 |
| Phase 8 | 未定 | 品質検証・ギャップ解消 | 6 | 36h | 🔵進行中 |

## タスク番号管理

**使用済みタスク番号**: TASK-0001 ~ TASK-0076
**次回開始番号**: TASK-0077

## 全体進捗

- [x] Phase 1: 基盤・データ層 (10/10)
- [x] Phase 2: AI・処理モジュール (12/12)
- [x] Phase 3: レイアウト・可視化 (9/9)
- [x] Phase 4: レンダリング・フロントエンド (11/11)
- [x] Phase 5: 統合・テスト (18/18)
- [x] Phase 6: 高度レイアウト・拡張タイプ (6/6)
- [x] Phase 7: コード品質改善 (4/4)
- [ ] Phase 8: 品質検証・ギャップ解消 (4/6)

## 主要実績値

- エンドツーエンド処理時間: 25.2秒（1分音声、目標60秒以内）
- 成功率: 100%（目標95%以上）
- API コスト: $0.03/動画（目標$0.10以下）
- メモリ使用量: 82.21MB（目標512MB以下）
- 型エラー: 0件（237件→0件解消）
- 図解タイプ: 11種類（flow/tree/timeline/matrix/cycle/flowchart/comparison/network/conceptmap/mindmap/general）

## 要件カバレッジ

- REQ-001~055: 全55件 ✅実装済み
- REQ-056: キャッシュウォームアップ戦略 ✅TASK-0074
- REQ-057: Pipeline REST API エンドポイント ✅TASK-0073
- REQ-101~104: 全4件 ✅実装済み
- REQ-201~203: 全3件 ✅実装済み
- REQ-301~305: 全5件 ✅実装済み
- REQ-401~405: 全5件 ✅実装済み
- NFR-001~501: 全件 ✅達成
- EDGE-001~103: 全件 ✅対応済み

## REQ-036~039 拡張モジュール対応状況

Phase 1-4で実装済みの拡張モジュール（REQ-036~039）は、Phase 5の統合・テストタスクに統合して検証：

| 要件 | モジュール | 統合先タスク | 内容 |
|------|-----------|-------------|------|
| REQ-036 | StreamingTranscriber | TASK-0043, TASK-0047, TASK-0049 | ストリーミング文字起こしパイプライン統合・WebSocketイベント・統合テスト |
| REQ-037 | UserGuidedErrorRecovery | TASK-0045, TASK-0047, TASK-0049 | ユーザー主導エラー回復・11カテゴリ分類・WebSocketイベント |
| REQ-038 | ConfigSchema (Zod) | TASK-0043, TASK-0049 | 設定バリデーション統合・起動時検証テスト |
| REQ-039 | SmartParameterTuner | TASK-0043, TASK-0049, TASK-0052 | パラメータ自動チューニング・性能測定 |

## REQ-040~051 Phase 5 モジュール対応状況

| 要件 | モジュール | 対応タスク | 内容 |
|------|-----------|-----------|------|
| REQ-040 | ErrorClassifier | TASK-0045, TASK-0049 | 11種類エラー分類・4段階重大度・復旧可能性判定 |
| REQ-041 | QualityGate (5段階) | TASK-0044, TASK-0049 | 5ステージ品質ゲート評価・基準未達ブロック |
| REQ-042 | PipelineOrchestrator | TASK-0043, TASK-0049 | 5段階パイプライン統合実行・品質ゲート・フォールバック統合 |
| REQ-043 | Batch REST API | TASK-0046, TASK-0050 | POST/GET/DELETE バッチジョブ・セマフォ3並列制御 |
| REQ-044 | Edge Functions Auth | TASK-0048 | JWT Bearer 認証・トークン検証・期限切れ検出 |
| REQ-045 | Edge Functions Error Handler | TASK-0048 | CORS・エラー分類・AbortController タイムアウト |
| REQ-046 | WebSocket Handler (Socket.IO) | TASK-0047 | JWT認証・ジョブルーム・リアルタイム進捗・ストリーミング・エラー回復イベント |
| REQ-047 | BatchOptimizer | TASK-0053, TASK-0052 | 並列チャンク処理・フェイルファスト・進捗コールバック・統計情報 |
| REQ-048 | ComputationCache + MemoryCache | TASK-0054, TASK-0052 | TTL・タグ無効化・LRU退行・定期クリーンアップ・ヒット率統計 |
| REQ-049 | LazyLoader | TASK-0055, TASK-0052 | 動的インポートキャッシュ・同時ロード重複排除・プリロード・ハンドルファクトリ |
| REQ-050 | グレースフルシャットダウン | TASK-0045 | アクティブリクエスト完了待機・30秒タイムアウト・サーキットブレーカーリセット |
| REQ-051 | 型ガード isDiagramType | TASK-0002 | 11種類DiagramType実行時検証 |

## REQ-052~055・REQ-305 追加 UI コンポーネント対応状況

| 要件 | モジュール | 対応タスク | 内容 |
|------|-----------|-----------|------|
| REQ-052 | TutorialSystem | TASK-0056 | マルチステップチュートリアル・4カテゴリ・3段階難易度・LocalStorage進捗 |
| REQ-053 | StreamingProcessor | TASK-0057 | Standard/Streaming モード切替・ライブ録音・リアルタイム文字起こし |
| REQ-054 | FrameworkDashboard | TASK-0058 | イテレーション追跡・品質メトリクス・フェーズ評価・改善推奨 |
| REQ-055 | ProductionDashboard | TASK-0059 | 設定管理・パフォーマンスレポート・監視・最適化ステータス |
| REQ-305 | ErrorAlertSystem | TASK-0060 | グローバルエラーアラート・11カテゴリ分類・自動非表示・重大度表示 |

## マイルストーン

- **M1: 基盤完成** (2026-05-09): データベース・環境構築・API基盤完了 ✅
- **M2: AI処理完成** (2026-06-06): Whisper・Gemini・フォールバック・キャッシュ完了 ✅
- **M3: 可視化完成** (2026-06-27): レイアウトエンジン・5戦略・ゼロオーバーラップ完了 ✅
- **M4: UI完成** (2026-07-25): レンダリング・フロントエンドUI完了 ✅
- **M5: リリース準備完了** (2026-08-22): 全テスト・パフォーマンス最適化完了 ✅
- **M6: 高度レイアウト追跡完了** (2026-05-01): 拡張タイプ・高度エンジンのタスク化完了 ✅
- **M7: コード品質改善完了** (2026-05-01): ESLint strict型安全性・テストリソースリーク解消 ✅
- **M8: 品質検証完了** (未定): 受け入れ基準検証・憲法改訂・TODO解消・パフォーマンス検証 ⬜

---

## Phase 1: 基盤・データ層

**期間**: 2026-04-27 ~ 2026-05-09
**目標**: 開発環境・データベース・API基盤の構築
**成果物**: TypeScript型定義, Supabase DB/Storage, Express API基盤, テスト基盤

### タスク一覧

- [x] [TASK-0001: 環境設定・依存パッケージ整備](TASK-0001.md) - 4h (DIRECT) 🔵
- [x] [TASK-0002: TypeScript型定義実装](TASK-0002.md) - 8h (TDD) 🔵
- [x] [TASK-0003: Supabase データベーススキーマ・RLS設定](TASK-0003.md) - 8h (DIRECT) 🔵
- [x] [TASK-0004: Supabase Storage バケット設定](TASK-0004.md) - 4h (DIRECT) 🔵
- [x] [TASK-0005: 環境変数・設定管理モジュール](TASK-0005.md) - 4h (DIRECT) 🔵
- [x] [TASK-0006: Express API サーバー基本セットアップ](TASK-0006.md) - 8h (DIRECT) 🔵
- [x] [TASK-0007: Supabase 認証・クライアント統合](TASK-0007.md) - 8h (TDD) 🔵
- [x] [TASK-0008: API エラーハンドリング・セキュリティミドルウェア](TASK-0008.md) - 8h (TDD) 🔵
- [x] [TASK-0009: テストユーティリティ・モック基盤](TASK-0009.md) - 8h (DIRECT) 🔵
- [x] [TASK-0010: CI/CD・ビルドパイプライン設定](TASK-0010.md) - 4h (DIRECT) 🟡

### 依存関係

```
TASK-0001 → TASK-0002, TASK-0003, TASK-0005, TASK-0006
TASK-0002 → TASK-0009
TASK-0003 → TASK-0004, TASK-0007
TASK-0006 → TASK-0008
```

---

## Phase 2: AI・処理モジュール

**期間**: 2026-05-12 ~ 2026-06-06
**目標**: 音声認識・LLM分析・フォールバック・キャッシュの実装
**成果物**: Whisper文字起こし, Gemini LLM分析, 3層フォールバック, セマンティックキャッシュ

### タスク一覧

- [x] [TASK-0011: Whisper音声認識モジュール](TASK-0011.md) - 16h (TDD) 🔵
- [x] [TASK-0012: Web Speech API ブラウザ文字起こし](TASK-0012.md) - 8h (TDD) 🔵
- [x] [TASK-0013: SRTキャプション生成モジュール](TASK-0013.md) - 8h (TDD) 🔵
- [x] [TASK-0014: 言語検出モジュール](TASK-0014.md) - 8h (TDD) 🔵
- [x] [TASK-0015: シーンセグメンター](TASK-0015.md) - 8h (TDD) 🔵
- [x] [TASK-0016: 複雑度検出モジュール](TASK-0016.md) - 8h (TDD) 🔵
- [x] [TASK-0017: Gemini LLM分析サービス](TASK-0017.md) - 16h (TDD) 🔵
- [x] [TASK-0018: 3層フォールバック機構](TASK-0018.md) - 8h (TDD) 🔵
- [x] [TASK-0019: ジッタ付き指数バックオフリトライ](TASK-0019.md) - 8h (TDD) 🔵
- [x] [TASK-0020: セマンティックキャッシュ](TASK-0020.md) - 8h (TDD) 🔵
- [x] [TASK-0021: 図解タイプ検出モジュール](TASK-0021.md) - 8h (TDD) 🔵
- [x] [TASK-0022: ルールベースV1フォールバック](TASK-0022.md) - 8h (TDD) 🔵

### 依存関係

```
TASK-0002, TASK-0004 → TASK-0011
TASK-0002 → TASK-0012, TASK-0013, TASK-0014
TASK-0002, TASK-0014 → TASK-0015
TASK-0014 → TASK-0016
TASK-0005, TASK-0015, TASK-0016 → TASK-0017
TASK-0002, TASK-0005 → TASK-0019, TASK-0020
TASK-0017 → TASK-0021
TASK-0002, TASK-0021 → TASK-0022
TASK-0017, TASK-0019, TASK-0022 → TASK-0018
```

---

## Phase 3: レイアウト・可視化

**期間**: 2026-06-08 ~ 2026-06-27
**目標**: 図解レイアウトエンジンと5種類のレイアウト戦略の実装
**成果物**: レイアウトエンジン, flow/tree/timeline/matrix/cycle戦略, ゼロオーバーラップ保証

### タスク一覧

- [x] [TASK-0023: レイアウトエンジンコア](TASK-0023.md) - 16h (TDD) 🔵
- [x] [TASK-0024: フローレイアウト戦略](TASK-0024.md) - 8h (TDD) 🔵
- [x] [TASK-0025: ツリーレイアウト戦略](TASK-0025.md) - 8h (TDD) 🔵
- [x] [TASK-0026: タイムラインレイアウト戦略](TASK-0026.md) - 8h (TDD) 🔵
- [x] [TASK-0027: マトリックスレイアウト戦略](TASK-0027.md) - 8h (TDD) 🔵
- [x] [TASK-0028: サイクルレイアウト戦略](TASK-0028.md) - 8h (TDD) 🔵
- [x] [TASK-0029: ゼロオーバーラップ保証・オーバーラップ解消](TASK-0029.md) - 16h (TDD) 🔵
- [x] [TASK-0030: キャンバス計算・センタリング](TASK-0030.md) - 8h (TDD) 🔵
- [x] [TASK-0031: レイアウト戦略自動選択](TASK-0031.md) - 8h (TDD) 🔵

### 依存関係

```
TASK-0002, TASK-0021 → TASK-0023
TASK-0023 → TASK-0024, TASK-0025, TASK-0026, TASK-0027, TASK-0028, TASK-0030
TASK-0024~0028 → TASK-0029
TASK-0023, TASK-0029, TASK-0030 → TASK-0031
```

---

## Phase 4: レンダリング・フロントエンド

**期間**: 2026-06-29 ~ 2026-07-25
**目標**: Remotion動画生成・React UIコンポーネント・エクスポート機能の実装
**成果物**: Remotionコンポーネント, メインUI, アップローダ, 進捗表示, プレビュー, エクスポート

### タスク一覧

- [x] [TASK-0032: Remotion基本コンポーネント](TASK-0032.md) - 8h (TDD) 🔵
- [x] [TASK-0033: DiagramScene アニメーション](TASK-0033.md) - 16h (TDD) 🔵
- [x] [TASK-0034: キャプション同期機構](TASK-0034.md) - 8h (TDD) 🔵
- [x] [TASK-0035: 動画レンダリング設定・出力](TASK-0035.md) - 8h (TDD) 🔵
- [x] [TASK-0036: SimplePipelineInterface メインUI](TASK-0036.md) - 16h (TDD) 🔵
- [x] [TASK-0037: EnhancedFileUploader D&D実装](TASK-0037.md) - 8h (TDD) 🔵
- [x] [TASK-0038: 進捗表示コンポーネント](TASK-0038.md) - 8h (TDD) 🔵
- [x] [TASK-0039: ビデオプレビュー・Remotion Player統合](TASK-0039.md) - 8h (TDD) 🔵
- [x] [TASK-0040: エラー表示・リカバリUI](TASK-0040.md) - 8h (TDD) 🟡
- [x] [TASK-0041: エクスポート機能（SVG/PNG/PDF/JSON）](TASK-0041.md) - 8h (TDD) 🔵
- [x] [TASK-0042: モバイル対応・レスポンシブUI](TASK-0042.md) - 8h (TDD) 🟡

### 依存関係

```
TASK-0002, TASK-0029, TASK-0030 → TASK-0032
TASK-0032 → TASK-0033
TASK-0013, TASK-0033 → TASK-0034
TASK-0034 → TASK-0035
TASK-0007, TASK-0035 → TASK-0036
TASK-0036 → TASK-0037, TASK-0038, TASK-0040, TASK-0042
TASK-0036, TASK-0035 → TASK-0039, TASK-0041
```

---

## Phase 5: 統合・テスト

**期間**: 2026-07-27 ~ 2026-08-22
**目標**: パイプライン統合・API統合・E2Eテスト・パフォーマンス最適化
**成果物**: Pipeline Orchestrator, QualityGate, ErrorClassifier, Batch API, Edge Functions, WebSocket, 最適化ユーティリティ, UI検証

### タスク一覧

- [x] [TASK-0043: Pipeline Orchestrator実装](TASK-0043.md) - 16h (TDD) 🔵
- [x] [TASK-0044: 品質ゲート・品質監視モジュール](TASK-0044.md) - 8h (TDD) 🔵
- [x] [TASK-0045: エラーハンドリング・回復フレームワーク](TASK-0045.md) - 8h (TDD) 🔵
- [x] [TASK-0046: バッチ処理API実装](TASK-0046.md) - 16h (TDD) 🔵
- [x] [TASK-0047: WebSocket リアルタイム進捗通知](TASK-0047.md) - 8h (TDD) 🔵
- [x] [TASK-0048: Supabase Edge Functions 実装](TASK-0048.md) - 16h (TDD) 🔵
- [x] [TASK-0049: パイプライン統合テスト](TASK-0049.md) - 16h (TDD) 🔵
- [x] [TASK-0050: API統合テスト](TASK-0050.md) - 8h (TDD) 🔵
- [x] [TASK-0051: E2Eテスト](TASK-0051.md) - 8h (TDD) 🟡
- [x] [TASK-0052: パフォーマンステスト・最適化](TASK-0052.md) - 8h (TDD) 🔵
- [x] [TASK-0053: バッチ最適化ユーティリティ実装](TASK-0053.md) - 8h (TDD) 🔵
- [x] [TASK-0054: 計算キャッシュ・メモリキャッシュ実装](TASK-0054.md) - 8h (TDD) 🔵
- [x] [TASK-0055: 遅延ローダー実装](TASK-0055.md) - 8h (TDD) 🔵
- [x] [TASK-0056: TutorialSystem 実装検証](TASK-0056.md) - 4h (DIRECT) 🔵
- [x] [TASK-0057: StreamingProcessor マルチモード検証](TASK-0057.md) - 4h (DIRECT) 🔵
- [x] [TASK-0058: FrameworkDashboard 検証](TASK-0058.md) - 4h (DIRECT) 🔵
- [x] [TASK-0059: ProductionDashboard 検証](TASK-0059.md) - 4h (DIRECT) 🔵
- [x] [TASK-0060: ErrorAlertSystem 検証](TASK-0060.md) - 4h (DIRECT) 🔵

### 依存関係

```
TASK-0011, TASK-0012, TASK-0018, TASK-0031, TASK-0035 → TASK-0043
TASK-0002, TASK-0043 → TASK-0044
TASK-0018, TASK-0043 → TASK-0045
TASK-0006, TASK-0008, TASK-0043 → TASK-0046
TASK-0046, TASK-0038 → TASK-0047
TASK-0003 → TASK-0048
TASK-0043, TASK-0045, TASK-0047, TASK-0048 → TASK-0049
TASK-0046, TASK-0009 → TASK-0050
TASK-0050 → TASK-0051
TASK-0009 → TASK-0053, TASK-0054, TASK-0055
TASK-0010, TASK-0044, TASK-0049, TASK-0051, TASK-0053, TASK-0054, TASK-0055 → TASK-0052
TASK-0036 → TASK-0056
TASK-0036, TASK-0011 → TASK-0057
TASK-0036 → TASK-0058
TASK-0036 → TASK-0059
TASK-0040 → TASK-0060
```

---

## Phase 6: 高度レイアウト・拡張タイプ

**期間**: 未定（Phase 5完了後）
**目標**: 設計文書の高度レイアウト型定義・拡張ダイアグラムタイプに対応するタスク追跡
**成果物**: 拡張6タイプ戦略, AdvancedLayoutEngine, ComplexLayoutEngine, ビジュアルテーマ, 文化的適応, パフォーマンス最適化
**備考**: 実装は既に完了済み（interfaces.ts 42新規型定義、advanced-layouts.ts, complex-layout-engine.ts 等）。本フェーズは未追跡機能のタスク化。

### タスク一覧

- [x] [TASK-0061: 拡張ダイアグラムタイプ レイアウト戦略](TASK-0061.md) - 16h (TDD) 🔵
- [x] [TASK-0062: 高度レイアウトエンジン](TASK-0062.md) - 16h (TDD) 🔵
- [x] [TASK-0063: 複合レイアウトエンジン](TASK-0063.md) - 16h (TDD) 🔵
- [x] [TASK-0064: ビジュアルテーマ・エフェクトシステム](TASK-0064.md) - 8h (TDD) 🔵
- [x] [TASK-0065: 文化的レイアウト適応](TASK-0065.md) - 8h (TDD) 🟡
- [x] [TASK-0066: 高度レイアウトパフォーマンス最適化](TASK-0066.md) - 8h (TDD) 🟡

### 依存関係

```
TASK-0023, TASK-0031 → TASK-0061
TASK-0023, TASK-0029, TASK-0061 → TASK-0062
TASK-0023, TASK-0029 → TASK-0063
TASK-0062 → TASK-0064
TASK-0023 → TASK-0065
TASK-0062, TASK-0063 → TASK-0066
```

---

## Phase 7: コード品質改善

**期間**: 未定（Phase 6完了後）
**目標**: ESLint strict型安全性改善・テストリソースリーク修正
**成果物**: ESLint 0エラー・0警告、テスト正常終了確認
**備考**: Phase 1-6完了後の品質改善フェーズ。全要件は実装済みだが、ESLint no-explicit-any エラー267件・テストタイマーリークが残存。

### タスク一覧

- [x] [TASK-0067: バックエンド層のESLint strict型安全性改善](TASK-0067.md) - 8h (TDD) 🔵
- [x] [TASK-0068: フロントエンド・可視化層のESLint strict型安全性改善](TASK-0068.md) - 8h (TDD) 🔵
- [x] [TASK-0069: テストリソースリーク修正](TASK-0069.md) - 4h (TDD) 🔵
- [x] [TASK-0070: ESLint警告解消とlint strictパス確認](TASK-0070.md) - 4h (DIRECT) 🔵

### 依存関係

```
TASK-0067, TASK-0068 → TASK-0070
TASK-0069: 独立（Phase 6完了後ならいつでも実施可能）
```

---

## Phase 8: 品質検証・ギャップ解消

**期間**: 未定（Phase 7完了後）
**目標**: 受け入れ基準の正式検証・ドキュメント整備・残存ギャップ解消
**成果物**: 受け入れ基準検証記録、改訂版SYSTEM_CONSTITUTION.md、TODO解消、キャッシュウォームアップ、パフォーマンス検証、モバイル対応
**備考**: Phase 1-7で全要件実装完了。残存ギャップ（未検証受け入れ基準・ドキュメント乖離・TODO残存・オプション機能未実装）の解消フェーズ。

### タスク一覧

- [ ] [TASK-0071: 受け入れ基準テストケースの正式検証](TASK-0071.md) - 8h (TDD) 🔵
- [ ] [TASK-0072: SYSTEM_CONSTITUTION.md 現状適合改訂](TASK-0072.md) - 4h (DIRECT) 🔵
- [x] [TASK-0073: Pipeline REST API エンドポイント実装（REQ-057）・残存 TODO 解消](TASK-0073.md) - 8h (TDD) 🔵
- [x] [TASK-0074: キャッシュウォームアップ戦略実装（REQ-056）](TASK-0074.md) - 4h (TDD) 🔵
- [ ] [TASK-0075: E2Eパフォーマンスベンチマーク検証](TASK-0075.md) - 4h (TDD) 🔵
- [ ] [TASK-0076: モバイルレスポンシブUI改善](TASK-0076.md) - 8h (TDD) 🟡

### 依存関係

```
TASK-0071: 独立（Phase 7完了後ならいつでも実施可能）
TASK-0072: 独立
TASK-0072 → TASK-0073
TASK-0074: 独立
TASK-0075: 独立
TASK-0071 → TASK-0076
```

---

## 信頼性レベルサマリー

### 全タスク統計

- **総タスク数**: 76件
- 🔵 **青信号**: 69件 (91%)
- 🟡 **黄信号**: 7件 (9%)
- 🔴 **赤信号**: 0件 (0%)

### フェーズ別信頼性

| フェーズ | 🔵 青 | 🟡 黄 | 🔴 赤 | 合計 |
|---------|-------|-------|-------|------|
| Phase 1 | 9 | 1 | 0 | 10 |
| Phase 2 | 12 | 0 | 0 | 12 |
| Phase 3 | 9 | 0 | 0 | 9 |
| Phase 4 | 9 | 2 | 0 | 11 |
| Phase 5 | 17 | 1 | 0 | 18 |
| Phase 6 | 4 | 2 | 0 | 6 |
| Phase 7 | 4 | 0 | 0 | 4 |
| Phase 8 | 5 | 1 | 0 | 6 |

**品質評価**: ✅ 高品質 - 91%のタスクが既存設計文書・実装に基づいている

## クリティカルパス

```
TASK-0001 → TASK-0002 → TASK-0014 → TASK-0015 → TASK-0017 → TASK-0021 → TASK-0023 → TASK-0029 → TASK-0032 → TASK-0033 → TASK-0034 → TASK-0035 → TASK-0043 → TASK-0049 → TASK-0052
```

**クリティカルパス工数**: 148時間
**並行作業可能工数**: 360時間

## 移行情報

- **移行元**: `docs/tasks/speech-to-visuals/`
- **移行先**: `specs/speech-to-visuals/tasks/`
- **移行日**: 2026-04-30
- **パス変更**: `../../spec/speech-to-visuals/` → `../`、`../../design/speech-to-visuals/` → `../`
- **統合方針**: 全60件を完全再利用で統合（内容変更なし、参照パスのみ更新）
- **Phase 6追加**: 2026-05-01に設計文書（interfaces.ts 42新規型、architecture.md, dataflow.md）と既存タスクのギャップ分析に基づき6タスクを新規追加
- **Phase 7追加**: 2026-05-01にESLint no-explicit-any 267エラー・テストタイマーリークのギャップ分析に基づき4タスクを新規追加
- **Phase 8追加**: 2026-05-01に受け入れ基準未検証・SYSTEM_CONSTITUTION.md実態乖離・TODO残存6件・REQ-202未実装・NFR検証不足・REQ-304未実装のギャップ分析に基づき6タスクを新規追加
- **Phase 8更新統合**: 2026-05-01にREQ-056（キャッシュウォームアップ）とREQ-057（Pipeline REST API）の正式要件追加に伴い、TASK-0073（REQ-057統合）・TASK-0074（REQ-056統合）を更新統合
