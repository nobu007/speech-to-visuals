# speech-to-visuals タスク概要

**作成日**: 2026-04-27
**最終更新**: 2026-04-30（REQ-046~049 WebSocket・最適化ユーティリティ要件参照追加）
**プロジェクト期間**: 2026-04-27 - 2026-09-26（153日）
**推定工数**: 508時間
**総タスク数**: 55件

## 関連文書

- **要件定義書**: [📋 requirements.md](../../spec/speech-to-visuals/requirements.md)
- **設計文書**: [📐 architecture.md](../../design/speech-to-visuals/architecture.md)
- **API仕様**: [🔌 api-endpoints.md](../../design/speech-to-visuals/api-endpoints.md)
- **データベース設計**: [🗄️ database-schema.sql](../../design/speech-to-visuals/database-schema.sql)
- **インターフェース定義**: [📝 interfaces.ts](../../design/speech-to-visuals/interfaces.ts)
- **データフロー図**: [🔄 dataflow.md](../../design/speech-to-visuals/dataflow.md)
- **コンテキストノート**: [📝 note.md](../../spec/speech-to-visuals/note.md)

## フェーズ構成

| フェーズ | 期間 | 成果物 | タスク数 | 工数 | ファイル |
|---------|------|--------|----------|------|----------|
| Phase 1 | 2026-04-27 ~ 2026-05-09 | 基盤・データ層 | 10 | 68h | [TASK-0001~0010](#phase-1-基盤データ層) |
| Phase 2 | 2026-05-12 ~ 2026-06-06 | AI・処理モジュール | 12 | 112h | [TASK-0011~0022](#phase-2-ai処理モジュール) |
| Phase 3 | 2026-06-08 ~ 2026-06-27 | レイアウト・可視化 | 9 | 88h | [TASK-0023~0031](#phase-3-レイアウト可視化) |
| Phase 4 | 2026-06-29 ~ 2026-07-25 | レンダリング・フロントエンド | 11 | 104h | [TASK-0032~0042](#phase-4-レンダリングフロントエンド) |
| Phase 5 | 2026-07-27 ~ 2026-08-22 | 統合・テスト | 13 | 136h | [TASK-0043~0055](#phase-5-統合テスト) |

## タスク番号管理

**使用済みタスク番号**: TASK-0001 ~ TASK-0055
**次回開始番号**: TASK-0056

## 全体進捗

- [x] Phase 1: 基盤・データ層
- [x] Phase 2: AI・処理モジュール
- [x] Phase 3: レイアウト・可視化
- [x] Phase 4: レンダリング・フロントエンド
- [ ] Phase 5: 統合・テスト

## REQ-036~039 拡張モジュール対応状況

Phase 1-4で実装済みの拡張モジュール（REQ-036~039）は、Phase 5の統合・テストタスクに統合して検証する：

| 要件 | モジュール | 統合先タスク | 内容 |
|------|-----------|-------------|------|
| REQ-036 | StreamingTranscriber | TASK-0043, TASK-0047, TASK-0049 | ストリーミング文字起こしパイプライン統合・WebSocketイベント・統合テスト |
| REQ-037 | UserGuidedErrorRecovery | TASK-0045, TASK-0047, TASK-0049 | ユーザー主導エラー回復・11カテゴリ分類・WebSocketイベント |
| REQ-038 | ConfigSchema (Zod) | TASK-0043, TASK-0049 | 設定バリデーション統合・起動時検証テスト |
| REQ-039 | SmartParameterTuner | TASK-0043, TASK-0049, TASK-0052 | パラメータ自動チューニング・性能測定 |

## REQ-040~045 Phase 5 モジュール対応状況

Phase 5 で追加された要件（REQ-040~045）に対応するタスクへの参照：

| 要件 | モジュール | 対応タスク | 内容 |
|------|-----------|-----------|------|
| REQ-040 | ErrorClassifier | TASK-0045, TASK-0049 | 11種類エラー分類・4段階重大度・復旧可能性判定 |
| REQ-041 | QualityGate (5段階) | TASK-0044, TASK-0049 | 5ステージ品質ゲート評価・基準未達ブロック |
| REQ-042 | PipelineOrchestrator | TASK-0043, TASK-0049 | 5段階パイプライン統合実行・品質ゲート・フォールバック統合 |
| REQ-043 | Batch REST API | TASK-0046, TASK-0050 | POST/GET/DELETE バッチジョブ・セマフォ3並列制御 |
| REQ-044 | Edge Functions Auth | TASK-0048 | JWT Bearer 認証・トークン検証・期限切れ検出 |
| REQ-045 | Edge Functions Error Handler | TASK-0048 | CORS・エラー分類・AbortController タイムアウト |

## REQ-046~049 WebSocket・最適化ユーティリティ対応状況

Phase 5 で追加された要件（REQ-046~049）に対応するタスクへの参照：

| 要件 | モジュール | 対応タスク | 内容 |
|------|-----------|-----------|------|
| REQ-046 | WebSocket Handler (Socket.IO) | TASK-0047 | JWT認証・ジョブルーム・リアルタイム進捗・ストリーミング・エラー回復イベント |
| REQ-047 | BatchOptimizer | TASK-0053, TASK-0052 | 並列チャンク処理・フェイルファスト・進捗コールバック・統計情報 |
| REQ-048 | ComputationCache + MemoryCache | TASK-0054, TASK-0052 | TTL・タグ無効化・LRU退行・定期クリーンアップ・ヒット率統計 |
| REQ-049 | LazyLoader | TASK-0055, TASK-0052 | 動的インポートキャッシュ・同時ロード重複排除・プリロード・ハンドルファクトリ |

## マイルストーン

- **M1: 基盤完成** (2026-05-09): データベース・環境構築・API基盤完了
- **M2: AI処理完成** (2026-06-06): Whisper・Gemini・フォールバック・キャッシュ完了
- **M3: 可視化完成** (2026-06-27): レイアウトエンジン・5戦略・ゼロオーバーラップ完了
- **M4: UI完成** (2026-07-25): レンダリング・フロントエンドUI完了
- **M5: リリース準備完了** (2026-08-22): 全テスト・パフォーマンス最適化完了

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
**目標**: パイプライン統合・API統合・E2Eテスト・パフォーマンス最適化（REQ-036~039 拡張モジュール + REQ-040~045 Phase 5モジュール + REQ-046~049 WebSocket・最適化ユーティリティ統合含む）
**成果物**: Pipeline Orchestrator (REQ-042), QualityGate (REQ-041), ErrorClassifier (REQ-040), Batch API (REQ-043), Edge Functions Auth+Error (REQ-044/045), WebSocket (REQ-046), BatchOptimizer (REQ-047), Cache (REQ-048), LazyLoader (REQ-049), 統合テスト, パフォーマンス検証

### タスク一覧

- [ ] [TASK-0043: Pipeline Orchestrator実装](TASK-0043.md) - 16h (TDD) 🔵
- [ ] [TASK-0044: 品質ゲート・品質監視モジュール](TASK-0044.md) - 8h (TDD) 🔵
- [ ] [TASK-0045: エラーハンドリング・回復フレームワーク](TASK-0045.md) - 8h (TDD) 🔵
- [ ] [TASK-0046: バッチ処理API実装](TASK-0046.md) - 16h (TDD) 🔵
- [ ] [TASK-0047: WebSocket リアルタイム進捗通知](TASK-0047.md) - 8h (TDD) 🔵
- [ ] [TASK-0048: Supabase Edge Functions 実装](TASK-0048.md) - 16h (TDD) 🔵
- [ ] [TASK-0049: パイプライン統合テスト](TASK-0049.md) - 16h (TDD) 🔵
- [ ] [TASK-0050: API統合テスト](TASK-0050.md) - 8h (TDD) 🔵
- [ ] [TASK-0051: E2Eテスト](TASK-0051.md) - 8h (TDD) 🟡
- [ ] [TASK-0052: パフォーマンステスト・最適化](TASK-0052.md) - 8h (TDD) 🔵
- [ ] [TASK-0053: バッチ最適化ユーティリティ実装](TASK-0053.md) - 8h (TDD) 🔵
- [ ] [TASK-0054: 計算キャッシュ・メモリキャッシュ実装](TASK-0054.md) - 8h (TDD) 🔵
- [ ] [TASK-0055: 遅延ローダー実装](TASK-0055.md) - 8h (TDD) 🔵

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
```

---

## 信頼性レベルサマリー

### 全タスク統計

- **総タスク数**: 55件
- 🔵 **青信号**: 51件 (93%)
- 🟡 **黄信号**: 4件 (7%)
- 🔴 **赤信号**: 0件 (0%)

### フェーズ別信頼性

| フェーズ | 🔵 青 | 🟡 黄 | 🔴 赤 | 合計 |
|---------|-------|-------|-------|------|
| Phase 1 | 9 | 1 | 0 | 10 |
| Phase 2 | 12 | 0 | 0 | 12 |
| Phase 3 | 9 | 0 | 0 | 9 |
| Phase 4 | 9 | 2 | 0 | 11 |
| Phase 5 | 12 | 1 | 0 | 13 |

**品質評価**: 高品質 - 93%のタスクが既存設計文書・実装に基づいている

## クリティカルパス

```
TASK-0001 → TASK-0002 → TASK-0014 → TASK-0015 → TASK-0017 → TASK-0021 → TASK-0023 → TASK-0029 → TASK-0032 → TASK-0033 → TASK-0034 → TASK-0035 → TASK-0043 → TASK-0049 → TASK-0052
```

**クリティカルパス工数**: 148時間
**並行作業可能工数**: 360時間

## 次のステップ

タスクを実装するには:
- 全タスク順番に実装: `/tsumiki:kairo-implement`
- 特定タスクを実装: `/tsumiki:kairo-implement TASK-0001`
