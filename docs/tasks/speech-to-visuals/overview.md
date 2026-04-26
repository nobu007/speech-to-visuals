# speech-to-visuals タスク概要

**作成日**: 2026-04-27
**プロジェクト期間**: 2026-04-27 - 2026-09-26（153日）
**推定工数**: 484時間
**総タスク数**: 52件

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
| Phase 5 | 2026-07-27 ~ 2026-08-22 | 統合・テスト | 10 | 112h | [TASK-0043~0052](#phase-5-統合テスト) |

## タスク番号管理

**使用済みタスク番号**: TASK-0001 ~ TASK-0052
**次回開始番号**: TASK-0053

## 全体進捗

- [x] Phase 1: 基盤・データ層
- [ ] Phase 2: AI・処理モジュール
- [ ] Phase 3: レイアウト・可視化
- [ ] Phase 4: レンダリング・フロントエンド
- [ ] Phase 5: 統合・テスト

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

- [ ] [TASK-0011: Whisper音声認識モジュール](TASK-0011.md) - 16h (TDD) 🔵
- [ ] [TASK-0012: Web Speech API ブラウザ文字起こし](TASK-0012.md) - 8h (TDD) 🔵
- [ ] [TASK-0013: SRTキャプション生成モジュール](TASK-0013.md) - 8h (TDD) 🔵
- [ ] [TASK-0014: 言語検出モジュール](TASK-0014.md) - 8h (TDD) 🔵
- [ ] [TASK-0015: シーンセグメンター](TASK-0015.md) - 8h (TDD) 🔵
- [ ] [TASK-0016: 複雑度検出モジュール](TASK-0016.md) - 8h (TDD) 🔵
- [ ] [TASK-0017: Gemini LLM分析サービス](TASK-0017.md) - 16h (TDD) 🔵
- [ ] [TASK-0018: 3層フォールバック機構](TASK-0018.md) - 8h (TDD) 🔵
- [ ] [TASK-0019: ジッタ付き指数バックオフリトライ](TASK-0019.md) - 8h (TDD) 🔵
- [ ] [TASK-0020: セマンティックキャッシュ](TASK-0020.md) - 8h (TDD) 🔵
- [ ] [TASK-0021: 図解タイプ検出モジュール](TASK-0021.md) - 8h (TDD) 🔵
- [ ] [TASK-0022: ルールベースV1フォールバック](TASK-0022.md) - 8h (TDD) 🔵

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

- [ ] [TASK-0023: レイアウトエンジンコア](TASK-0023.md) - 16h (TDD) 🔵
- [ ] [TASK-0024: フローレイアウト戦略](TASK-0024.md) - 8h (TDD) 🔵
- [ ] [TASK-0025: ツリーレイアウト戦略](TASK-0025.md) - 8h (TDD) 🔵
- [ ] [TASK-0026: タイムラインレイアウト戦略](TASK-0026.md) - 8h (TDD) 🔵
- [ ] [TASK-0027: マトリックスレイアウト戦略](TASK-0027.md) - 8h (TDD) 🔵
- [ ] [TASK-0028: サイクルレイアウト戦略](TASK-0028.md) - 8h (TDD) 🔵
- [ ] [TASK-0029: ゼロオーバーラップ保証・オーバーラップ解消](TASK-0029.md) - 16h (TDD) 🔵
- [ ] [TASK-0030: キャンバス計算・センタリング](TASK-0030.md) - 8h (TDD) 🔵
- [ ] [TASK-0031: レイアウト戦略自動選択](TASK-0031.md) - 8h (TDD) 🔵

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

- [ ] [TASK-0032: Remotion基本コンポーネント](TASK-0032.md) - 8h (TDD) 🔵
- [ ] [TASK-0033: DiagramScene アニメーション](TASK-0033.md) - 16h (TDD) 🔵
- [ ] [TASK-0034: キャプション同期機構](TASK-0034.md) - 8h (TDD) 🔵
- [ ] [TASK-0035: 動画レンダリング設定・出力](TASK-0035.md) - 8h (TDD) 🔵
- [ ] [TASK-0036: SimplePipelineInterface メインUI](TASK-0036.md) - 16h (TDD) 🔵
- [ ] [TASK-0037: EnhancedFileUploader D&D実装](TASK-0037.md) - 8h (TDD) 🔵
- [ ] [TASK-0038: 進捗表示コンポーネント](TASK-0038.md) - 8h (TDD) 🔵
- [ ] [TASK-0039: ビデオプレビュー・Remotion Player統合](TASK-0039.md) - 8h (TDD) 🔵
- [ ] [TASK-0040: エラー表示・リカバリUI](TASK-0040.md) - 8h (TDD) 🟡
- [ ] [TASK-0041: エクスポート機能（SVG/PNG/PDF/JSON）](TASK-0041.md) - 8h (TDD) 🔵
- [ ] [TASK-0042: モバイル対応・レスポンシブUI](TASK-0042.md) - 8h (TDD) 🟡

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
**成果物**: Pipeline Orchestrator, バッチAPI, Edge Functions, 統合テスト, パフォーマンス検証

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
TASK-0010, TASK-0044, TASK-0049, TASK-0051 → TASK-0052
```

---

## 信頼性レベルサマリー

### 全タスク統計

- **総タスク数**: 52件
- 🔵 **青信号**: 48件 (92%)
- 🟡 **黄信号**: 4件 (8%)
- 🔴 **赤信号**: 0件 (0%)

### フェーズ別信頼性

| フェーズ | 🔵 青 | 🟡 黄 | 🔴 赤 | 合計 |
|---------|-------|-------|-------|------|
| Phase 1 | 9 | 1 | 0 | 10 |
| Phase 2 | 12 | 0 | 0 | 12 |
| Phase 3 | 9 | 0 | 0 | 9 |
| Phase 4 | 9 | 2 | 0 | 11 |
| Phase 5 | 9 | 1 | 0 | 10 |

**品質評価**: 高品質 - 92%のタスクが既存設計文書・実装に基づいている

## クリティカルパス

```
TASK-0001 → TASK-0002 → TASK-0014 → TASK-0015 → TASK-0017 → TASK-0021 → TASK-0023 → TASK-0029 → TASK-0032 → TASK-0033 → TASK-0034 → TASK-0035 → TASK-0043 → TASK-0049 → TASK-0052
```

**クリティカルパス工数**: 148時間
**並行作業可能工数**: 336時間

## 次のステップ

タスクを実装するには:
- 全タスク順番に実装: `/tsumiki:kairo-implement`
- 特定タスクを実装: `/tsumiki:kairo-implement TASK-0001`
