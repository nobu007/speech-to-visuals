# Speech-to-Visuals 準備タスク（ユーザー作業）


<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - status: `canonical_child`
<!-- spine:anchor:end -->

> **仕様**: [requirements.md](requirements.md)
> **生成日**: 2026-04-27
> **最終更新**: 2026-06-05（第182回要件検証・380ソースファイル・241テストファイル・236要件・Phase 1-83完了・192タスク全完了・107パッケージ・Phase 84-86前方要件追加に伴う監視インフラ準備タスク追記）

**【信頼性レベル凡例】**:

- 🔵 **青信号**: 要件定義書・設計文書・既存実装で明確に必要と判明したタスク
- 🟡 **黄信号**: 要件定義書・設計文書から妥当に推測されるタスク
- 🔴 **赤信号**: 推測による予防的タスク（実装時に不要と判明する可能性あり）

## 必須（実装開始前に完了が必要）

以下のタスクが完了していないと、実装フェーズでブロッカーになります。

- [x] **Google Gemini API キーの取得** 🔵 *PIPELINE_FLOW.md §8.1・README.md 環境変数セクションより*
  - Google AI Studio（https://aistudio.google.com/apikey）で API キーを取得
  - 環境変数 `GOOGLE_API_KEY` に設定（`.env` ファイルまたは export）
  - 関連要件: REQ-006, REQ-009

- [x] **Node.js 18+ のインストール** 🔵 *SYSTEM_CORE.md §7.1 より*
  - Node.js 18 以上がインストールされていることを確認（`node --version`）
  - 関連要件: REQ-401

## 推奨（実装中に用意できればOK）

実装を開始できますが、該当機能の実装前までに準備してください。

- [ ] **Supabase プロジェクトのセットアップ** 🔵 *supabase/ ディレクトリ・PIPELINE_FLOW.md §8.1 より*
  - Supabase プロジェクトを作成（https://supabase.com/）
  - `supabase/migrations/` のマイグレーションを実行
  - ストレージバケット `audio` を作成
  - 環境変数に Supabase URL と Anon Key を設定
  - 必要になるフェーズ: Supabase 統合利用時
  - 関連要件: REQ-405, NFR-102

- [x] **Whisper モデルのダウンロード** 🔵 *src/transcription/whisper-transcriber.ts より*
  - `npx @remotion/install-whisper-cpp` で Whisper をインストール
  - base/small/medium モデルのいずれかが利用可能であることを確認 → `ggml-base.bin` (148MB) 確認済み
  - 必要になるフェーズ: ローカル文字起こし利用時
  - 関連要件: REQ-001

- [x] **Remotion Studio の動作確認** 🔵 *package.json scripts より*
  - `npm run remotion:studio` で Remotion Studio が起動することを確認 → localhost:3000 で起動確認済み
  - 動画プレビューが正常に表示されることを確認 → ビルド成功 (2279ms)
  - 必要になるフェーズ: Phase 4 動画確認時
  - 関連要件: REQ-025, REQ-030

- [x] **パイプライン API サーバーのセットアップ** 🔵 *src/hooks/useFrameworkPipeline.ts・要件定義REQ-057 より*
  - フロントエンドが呼び出す API エンドポイント（/api/render, /api/git/commit, /api/iteration-log, /api/framework/status）のバックエンド実装が必要 → 4エンドポイント実装済み (src/api/routes/pipeline.ts)
  - Express API サーバー（`npm run api:dev`）が起動していることを確認 → port 3001 で起動確認済み
  - 必要になるフェーズ: パイプライン API 利用時
  - 関連要件: REQ-057

- [ ] **Prometheus サーバーのセットアップ** 🔵 *REQ-206, REQ-208, REQ-209・src/monitoring/prometheus-exporter.ts より*
  - Prometheus サーバーをインストール・設定（https://prometheus.io/download/）
  - スクレイプ設定に `GET /api/v1/monitoring/prometheus` エンドポイントを追加（scrape_interval: 15s）
  - 必要になるフェーズ: Phase 84-85（監視APIデプロイ・パイプラインオブザーバビリティ）
  - 関連要件: REQ-206, REQ-210, REQ-211, REQ-212, REQ-213

- [ ] **Grafana ダッシュボードのインポート** 🔵 *REQ-208・src/monitoring/grafana-dashboard-model.ts より*
  - Grafana をインストール（https://grafana.com/）
  - Prometheus データソースを設定
  - GET /api/v1/monitoring/dashboard から JSON を取得しインポート（Phase 84 実装後）
  - 必要になるフェーズ: Phase 84（ダッシュボード配信API実装後）
  - 関連要件: REQ-208, REQ-210

- [ ] **AlertManager のセットアップ** 🔵 *REQ-209・src/monitoring/alert-rules.ts より*
  - AlertManager をインストール・設定
  - GET /api/v1/monitoring/alerts から YAML を取得し適用（Phase 84 実装後）
  - 通知チャネル（Email/Slack/PagerDuty 等）の設定
  - 必要になるフェーズ: Phase 84（アラート配信API実装後）
  - 関連要件: REQ-209, REQ-211

## 確認事項（判断が必要）

実装方針に影響するため、早めの判断・確認が推奨されます。

- [ ] **本番環境のデプロイ先の決定** 🟡 *SYSTEM_CORE.md §9 Phase 46+ より*
  - 現在はローカル開発のみ対応。本番デプロイ先（Vercel/Cloud Run/Fargate 等）の選択が必要
  - Supabase Edge Functions の本番設定
  - 関連要件: REQ-401, NFR-103

- [ ] **多言語対応の優先順位決定** 🟡 *QUALITY_METRICS.md §6.2 より*
  - Phase 44-45 で ES/FR/DE/ZH の追加が計画されている
  - どの言語を優先するかの判断が必要
  - 関連要件: REQ-303

---

## サマリー

| 優先度 | 件数 | 🔵 | 🟡 | 🔴 |
|--------|------|-----|-----|-----|
| 必須 | 2 | 2 | 0 | 0 |
| 推奨 | 7 | 7 | 0 | 0 |
| 確認事項 | 2 | 0 | 2 | 0 |

## 関連文書

- **要件定義書**: [requirements.md](requirements.md)
- **分析記録**: [interview-record.md](interview-record.md)
