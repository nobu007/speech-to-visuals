# speech-to-visuals タスク概要


<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](../architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-04-30
**最終更新**: 2026-08-07（Phase 113 再監査 — 8タスク中 7 STALE/1 部分有効と確定・再着手せず CLOSE）
**プロジェクト期間**: 2026-04-27 - 2026-08-22（118日）
**推定工数**: 1,154時間
**総タスク数**: 216件（216件 — Phase 113 配下 8件は STALE-CLOSED として完了計上）

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
| Phase 8 | 未定 | 品質検証・ギャップ解消 | 6 | 36h | ✅完了 |
| Phase 9 | 未定 | テスト安定性改善 | 2 | 8h | ✅完了 |
| Phase 10 | 未定 | メンテナンス・最適化 | 3 | 14h | ✅完了 |
| Phase 11 | 未定 | カバレッジ向上・保守 | 3 | 22h | ✅完了 |
| Phase 12 | 未定 | 品質・整合性確認 | 4 | 22h | ✅完了 |
| Phase 13 | 未定 | 品質回復・保守 | 5 | 26h | ✅完了 |
| Phase 14 | 未定 | 既知の問題解決・カバレッジ改善 | 4 | 12h | ✅完了 |
| Phase 15 | 未定 | 品質維持・保守 | 4 | 17h | ✅完了 |
| Phase 16 | 未定 | 品質メンテナンス | 4 | 16h | ✅完了 |
| Phase 17 | 未定 | 未追跡要件検証 | 3 | 12h | ✅完了 |
| Phase 18 | 未定 | ドキュメント整合性・残存品質課題 | 2 | 10h | ✅完了 |
| Phase 19 | 未定 | テスト型安全性・Flaky修正 | 3 | 14h | ✅完了 |
| Phase 20 | 未定 | Web Workers 並列化実装 | 3 | 32h | ✅完了 |
| Phase 21 | 未定 | エクスポート実エンコーディング・要件完了確認 | 2 | 12h | ✅完了 |
| Phase 22 | 未定 | 品質維持・ESLint回帰修正 | 1 | 4h | ✅完了 |
| Phase 23 | 未定 | 品質維持・テスト型エラー修正 | 1 | 8h | ✅完了 |
| Phase 24 | 未定 | 品質維持・コードクリーンアップ | 3 | 28h | ✅完了 |
| Phase 25~30 | 未定 | セキュリティ・堅牢性改善(ISS-003~045) | 0 | 0h | ✅完了 |
| Phase 31 | 未定 | 高度図解品質エンハンスメント | 6 | 52h | ✅完了 |
| Phase 32 | 未定 | 図解品質パイプライン統合 | 4 | 22h | ✅完了 |
| Phase 33 | 未定 | パイプライン品質監視統合 | 3 | 16h | ✅完了 |
| Phase 34 | 未定 | ストリーミング品質・音声前処理・エクスポート検証 | 3 | 24h | ✅完了 |
| Phase 35 | 未定 | 可視化アルゴリズム正式化・パイプライン品質統合 | 3 | 29h | ✅完了 |
| Phase 36 | 未定 | パフォーマンス最適化・コスト可視化パイプライン | 5 | 32h | ✅完了 |
| Phase 37 | 未定 | 監視API本組込み・コード規模監査 | 2 | 8h | ✅完了 |
| Phase 38 | 未定 | 監査スコープ修正・ドキュメント整合性 | 3 | 12h | ✅完了 |
| Phase 39 | 未定 | テストESM互換性修正・依存脆弱性解消・ドキュメント整合性 | 3 | 16h | ✅完了 |
| Phase 40 | 未定 | API認証ミドルウェア品質・信頼性 | 2+ | 8h | ✅完了 |
| Phase 56 | 未定 | 音声検証完全統合・コンポーネントテスト | 5 | 28h | ✅完了 |
| Phase 57 | 未定 | PipelineErrorRecoveryOrchestrator・LLMキャッシュデバウンス・空間インデックス | 1 | 8h | ✅完了 |
| Phase 58 | 未定 | リカバリ検証ループ・CI統合 | 4 | 32h | ✅完了 |
| Phase 65 | 未定 | 残存モジュール型付きエラー移行 | 2 | 6h | ✅完了 |
| Phase 66 | 未定 | モニタリングモジュールテストカバレッジ拡充 | 3 | 18h | ✅完了 |
| Phase 67 | 未定 | 文字起こしモジュール型付きエラー移行 | 2 | 6h | ✅完了 |
| Phase 68 | 未定 | 文字起こしモジュールテストカバレッジ拡充 | 3 | 12h | ✅完了 |
| Phase 69 | 未定 | 可視化・API モジュール型付きエラー移行 | 2 | 7h | ✅完了 |
| Phase 70 | 未定 | 可視化戦略完全化・重要度認識レイアウト | 8 | — | ✅完了 |
| Phase 71 | 未定 | KeyphraseOverlay・CaptionOverlay 動画統合 | 3 | — | ✅完了 |
| Phase 72 | 未定 | 戦略セレクター統合テスト | 1 | — | ✅完了 |
| Phase 73 | 未定 | ストリーミング文字起こし入力堅牢性 | 1 | — | ✅完了 |
| Phase 74 | 未定 | テストスイート安定化・品質回復 | 7 | 26h | ✅完了 |
| Phase 75 | 未定 | Jest ESM互換性・エラー伝播バグ修正 | 3 | 4h | ✅完了 |
| Phase 76 | 未定 | リトライ配線統合テスト・テストスイート検証 | 5 | 16h | ✅完了 |
| Phase 78 | 未定 | プロダクション観測性強化 | 2 | 7h | ✅完了 |
| Phase 80 | 未定 | HTTP リクエストメトリクス収集 (REQ-205) | 3 | 5h | ✅完了 |
| Phase 81 | 未定 | Prometheus 互換メトリクスエクスポート (REQ-206) | 1 | 4h | ✅完了 |
| Phase 82 | 未定 | ヘルスチェックliveness/readiness probe (REQ-207) | 1 | 3h | ✅完了 |
| Phase 83 | 未定 | Grafanaダッシュボード・アラートルール (REQ-208/209) | 2 | — | ✅完了 |
| Phase 84 | 未定 | 監視APIデプロイメント統合 (REQ-210/211) | 2 | — | ✅完了 |
| Phase 85 | 未定 | パイプラインオブザーバビリティ拡張 (REQ-212/213) | 2 | — | ✅完了 |
| Phase 86 | 未定 | 監視スタック統合検証 (REQ-214/215) | 2 | — | ✅完了 |
| Phase 87 | 未定 | 監視エンドポイントクエリ検証 (REQ-216) | 1 | — | ✅完了 |
| Phase 88 | 未定 | LLM応答図解構造検証 (REQ-217) | 1 | — | ✅完了 |
| Phase 89 | 未定 | シーン駆動アニメーションエクスポート (REQ-218/219) | 2 | — | ✅完了 |
| Phase 90 | 未定 | エクスポートパイプライン統合テスト強化 (REQ-220) | 3 | 16h | ✅完了 |
| Phase 91 | 未定 | シーンレンダラー入力検証 (REQ-221) | 1 | — | ✅完了 |
| Phase 92 | 未定 | エラーリカバリREST API堅牢化 (REQ-222) | 1 | — | ✅完了 |
| Phase 96 | 未定 | エクスポートメトリクス収集 (REQ-226) | 1 | 4h | ✅完了 |
| Phase 97 | 未定 | エクスポートリトライとフェイルセーフ (REQ-227) | 1 | 4h | ✅完了 |
| Phase 98 | 未定 | エクスポートジョブライフサイクル管理 (REQ-228) | 1 | 4h | ✅完了 |
| Phase 99 | 未定 | エクスポートジョブキューサービス (REQ-229) | 1 | 4h | ✅完了 |
| Phase 100 | 未定 | エクスポートアーティファクト管理 (REQ-230) | 1 | 4h | ✅完了 |
| Phase 101-105 | — | エクスポートエンジン統合・メトリクス・REST API・ジョブライフサイクル (REQ-231~243) | — | — | ✅完了 |
| Phase 106 | — | エクスポートジョブ境界ケース・メモリリーク修正 (bounded retention) | — | — | ✅完了 |
| Phase 110 | — | サイレントキャッチ修正・ログ正規化検証 | 2 | 7h | ✅完了 |
| Phase 113 | 未定 | クリティカルバグ修正&テスト安定性 | 8 | 42h | ✅完了(STALE-CLOSED) |
| Phase 132 | 未定 | Steering feedback A1 grounding + commit policy (REQ-298〜303) | 6 | 23h | 🔵進行中 |
| Phase 140 | 2026-08-19〜 | エビデンス出典・並列CI・規模予算・収束駆動タスク生成 (REQ-323〜327) | 3 | 13h | 🔵進行中(2/3) |

## タスク番号管理

**使用済みタスク番号**: TASK-0001 ~ TASK-0258（Phase 131: TASK-0217、Phase 132: TASK-0218〜0222、Phase 140: TASK-0223〜0225、Phase 141: TASK-0226〜0228、Phase 142: TASK-0229、Phase 143: TASK-0230、Phase 144: TASK-0231、Phase 145: TASK-0232、Phase 146: TASK-0233、Phase 147: TASK-0234、Phase 148: TASK-0235、Phase 149: TASK-0236、Phase 150: TASK-0237、Phase 151: TASK-0238、Phase 152: TASK-0239、Phase 153: TASK-0240、Phase 154: TASK-0241、Phase 155: TASK-0242、Phase 156: TASK-0243、Phase 157〜159: TASK-0244〜0246、Phase 161: TASK-0247、Phase 162: TASK-0248、Phase 163: TASK-0249、Phase 164: TASK-0250、Phase 165: TASK-0251、Phase 166: TASK-0252、Phase 167: TASK-0253、Phase 168: TASK-0254、Phase 169: TASK-0255、Phase 170: TASK-0256、Phase 171: TASK-0257、Phase 172: TASK-0258、Phase 173: TASK-0259）
**次回開始番号**: TASK-0260

> **REQ 番号帯（Phase 140 決定）**: REQ-313〜322 は acceptance-criteria の TC 帯（TC-313〜321 実在・TC-322 は未 merge PR #9 提案中）との番号衝突回避のため予約（未使用）。機能要件は REQ-323 から、TC は TC-323 から採番する（REQ-326/TC-323 が適用例）。

## 全体進捗

- [x] Phase 1: 基盤・データ層 (10/10)
- [x] Phase 2: AI・処理モジュール (12/12)
- [x] Phase 3: レイアウト・可視化 (9/9)
- [x] Phase 4: レンダリング・フロントエンド (11/11)
- [x] Phase 5: 統合・テスト (18/18)
- [x] Phase 6: 高度レイアウト・拡張タイプ (6/6)
- [x] Phase 7: コード品質改善 (4/4)
- [x] Phase 8: 品質検証・ギャップ解消 (6/6)
- [x] Phase 9: テスト安定性改善 (2/2)
- [x] Phase 10: メンテナンス・最適化 (3/3)
- [x] Phase 11: カバレッジ向上・保守 (3/3)
- [x] Phase 12: 品質・整合性確認 (4/4)
- [x] Phase 13: 品質回復・保守 (5/5)
- [x] Phase 14: 既知の問題解決・カバレッジ改善 (4/4)
- [x] Phase 15: 品質維持・保守 (4/4)
- [x] Phase 16: 品質メンテナンス (4/4)
- [x] Phase 17: 未追跡要件検証 (3/3)
- [x] Phase 18: ドキュメント整合性・残存品質課題 (2/2)
- [x] Phase 19: テスト型安全性・Flaky修正 (3/3)
- [x] Phase 20: Web Workers 並列化実装 (3/3)
- [x] Phase 21: エクスポート実エンコーディング・要件完了確認 (2/2)
- [x] Phase 22: 品質維持・ESLint回帰修正 (1/1)
- [x] Phase 23: 品質維持・テスト型エラー修正 (1/1)
- [x] Phase 24: 品質維持・コードクリーンアップ (3/3)
- [x] Phase 25~30: セキュリティ・堅牢性改善(ISS-003~045) (完了・タスク未追跡)
- [x] Phase 31: 高度図解品質エンハンスメント (6/6)
- [x] Phase 32: 図解品質パイプライン統合 (4/4)
- [x] Phase 33: パイプライン品質監視統合 (3/3)
- [x] Phase 34: ストリーミング品質・音声前処理・エクスポート検証 (3/3)
- [x] Phase 35: 可視化アルゴリズム正式化・パイプライン品質統合 (3/3)
- [x] Phase 36: パフォーマンス最適化・コスト可視化パイプライン (5/5)
- [x] Phase 37: 監視API本組込み・コード規模監査 (2/2)
- [x] Phase 38: 監査スコープ修正・ドキュメント整合性 (3/3)
- [x] Phase 39: テストESM互換性修正・依存脆弱性解消・ドキュメント整合性 (3/3)
- [x] Phase 40: API認証ミドルウェア品質・信頼性 (完了)
- [x] Phase 56: 音声検証完全統合・コンポーネントテスト (5/5 — TASK-0156~0160)
- [x] Phase 57: PipelineErrorRecoveryOrchestrator・LLMキャッシュデバウンス・空間インデックス (1/1 — TASK-0161)
- [x] Phase 58: リカバリ検証ループ・CI統合 (4/4 — TASK-0162~0165 全完了)
- [x] Phase 65: 残存モジュール型付きエラー移行 (2/2 — TASK-0166~0167)
- [x] Phase 66: モニタリングモジュールテストカバレッジ拡充 (3/3 — TASK-0168~0170)
- [x] Phase 67: 文字起こしモジュール型付きエラー移行 (2/2 — TASK-0171~0172)
- [x] Phase 68: 文字起こしモジュールテストカバレッジ拡充 (3/3 — TASK-0173~0175)
- [x] Phase 69: 可視化・API モジュール型付きエラー移行 (2/2 — TASK-0176~0177)
- [x] Phase 70: 可視化戦略完全化・重要度認識レイアウト (完了 — REQ-182~189)
- [x] Phase 71: KeyphraseOverlay・CaptionOverlay 動画統合 (完了 — REQ-190~192)
- [x] Phase 72: 戦略セレクター統合テスト (完了 — REQ-193)
- [x] Phase 73: ストリーミング文字起こし入力堅牢性 (完了 — REQ-194)
- [x] Phase 74: テストスイート安定化・品質回復 (7/7 — TASK-0178~0184 完了)
- [x] Phase 75: Jest ESM互換性・エラー伝播バグ修正 (3/3 — TASK-0185~0187 完了)
- [x] Phase 76: リトライ配線統合テスト・テストスイート検証 (5/5 — TASK-0188~0192)
- [x] Phase 78: プロダクション観測性強化 (2/2 — TASK-0193~0194)
- [x] Phase 81: Prometheus 互換メトリクスエクスポート (1/1 — REQ-206)
- [x] Phase 82: ヘルスチェックliveness/readiness probe (1/1 — REQ-207)
- [x] Phase 83: Grafanaダッシュボード・アラートルール (完了 — REQ-208/209)
- [x] Phase 84: 監視APIデプロイメント統合 (完了 — REQ-210/211)
- [x] Phase 85: パイプラインオブザーバビリティ拡張 (完了 — REQ-212/213)
- [x] Phase 86: 監視スタック統合検証 (完了 — REQ-214/215)
- [x] Phase 87: 監視エンドポイントクエリ検証 (完了 — REQ-216)
- [x] Phase 88: LLM応答図解構造検証 (完了 — REQ-217)
- [x] Phase 89: シーン駆動アニメーションエクスポート (完了 — REQ-218/219)
- [x] Phase 90: エクスポートパイプライン統合テスト強化 (3/3 — TASK-0199~0201 全完了)
- [x] Phase 91: シーンレンダラー入力検証 (完了 — REQ-221)
- [x] Phase 97: エクスポートリトライとフェイルセーフ (1/1 — REQ-227)
- [x] Phase 98: エクスポートジョブライフサイクル管理 (1/1 — REQ-228)
- [x] Phase 99: エクスポートジョブキューサービス (1/1 — REQ-229)
- [x] Phase 100: エクスポートアーティファクト管理 (1/1 — REQ-230)

- [x] Phase 110: サイレントキャッチ修正・ログ正規化検証 (2/2)

- [x] Phase 113: クリティカルバグ修正&テスト安定性 (STALE-CLOSED — 8再監査)

## 主要実績値

- エンドツーエンド処理時間: 25.2秒（1分音声、目標60秒以内）
- 成功率: 100%（目標95%以上）
- API コスト: $0.03/動画（目標$0.10以下）
- メモリ使用量: 82.21MB（目標512MB以下）
- 型エラー: 0件（237件→0件解消）
- テストカバレッジ: 92.14% statements（目標75%以上）・81.15% branches・92.46% functions・92.56% lines
- テスト数: 4,475+テスト（170テストファイル・全テスト通過）
- コード規模: 355ファイル・104,252行・74 deps + 31 devDeps = 105パッケージ
- ESLint `no-explicit-any` エラー: 0件 ✅（Workerテスト回帰はTASK-0119で解消済み）
- 図解タイプ: 11種類（flow/tree/timeline/matrix/cycle/flowchart/comparison/network/conceptmap/mindmap/general）

## 要件カバレッジ

- REQ-001~055: 全55件 ✅実装済み
- REQ-056: キャッシュウォームアップ戦略 ✅TASK-0074
- REQ-057: Pipeline REST API エンドポイント ✅TASK-0073
- REQ-058~061: 全4件 ✅実装済み
- REQ-062: Worker crash→recovery 統合テスト ✅コミットbc3cf68
- REQ-063: APNG実エンコーディング ✅TASK-0117
- REQ-064~078: セキュリティ・堅牢性（ISS-003~045） ✅全15件実装済み
- REQ-079~083: 高度図解品質エンハンスメント ✅全5件実装済み
- REQ-084~087: 図解品質パイプライン統合 ✅全4件実装済み
- REQ-088~090: パイプライン品質監視統合 ✅全3件実装済み
- REQ-091~093: ストリーミング品質・音声前処理・エクスポート検証 ✅全3件実装済み
- REQ-094~096: 可視化アルゴリズム正式化・パイプライン品質統合 ✅全3件実装済み
- REQ-097~100: パフォーマンス最適化・コスト可視化・監視API ✅全4件実装済み
- REQ-102~103: コード規模監査・監視API検証 ✅全2件実装済み
- REQ-104~106: 監査スコープ修正・ドキュメント整合性 ✅全3件実装済み
- REQ-107~109: テストESM互換性修正・依存脆弱性解消・ドキュメント整合性 ✅完了
- REQ-101~104: 全4件 ✅実装済み
- REQ-201~203: 全3件 ✅実装済み
- REQ-206: Prometheus 互換メトリクスエクスポート ✅Phase 81実装済
- REQ-207: ヘルスチェックliveness/readiness probe ✅Phase 82実装済
- REQ-208~209: Grafanaダッシュボード・アラートルール ✅Phase 83実装済
- REQ-210~211: 監視APIデプロイメント統合 ✅Phase 84実装済
- REQ-212~213: パイプラインオブザーバビリティ拡張 ✅Phase 85実装済
- REQ-214~215: 監視スタック統合検証 ✅Phase 86実装済
- REQ-216: 監視エンドポイントクエリ検証 ✅Phase 87実装済
- REQ-217: LLM応答図解構造検証 ✅Phase 88実装済
- REQ-218~219: シーン駆動アニメーションエクスポート ✅Phase 89実装済
- REQ-220: エクスポートパイプライン統合テスト ✅Phase 90実装済
- REQ-221: シーンレンダラー入力検証 ✅Phase 91実装済
- REQ-227: エクスポートリトライとフェイルセーフ ✅Phase 97完了
- REQ-228: エクスポートジョブライフサイクル管理 ✅Phase 98完了
- REQ-229: エクスポートジョブキューサービス ✅Phase 99完了
- REQ-230: エクスポートアーティファクト管理 ✅Phase 100完了
- REQ-301~305: 全5件 ✅実装済み
- REQ-401~405: 全5件 ✅実装済み
- NFR-001~501: 全件 ✅達成
- EDGE-001~103: 全件 ✅対応済み
- REQ-079~083: 全5件 ✅Phase 31実装済み
- REQ-084~087: 全4件 ✅Phase 32実装済み
- REQ-088~090: 全3件 ✅Phase 33実装済み
- REQ-091~093: 全3件 ✅Phase 34実装済み
- REQ-094~096: 全3件 ✅Phase 35実装済み

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
- **M8: 品質検証完了** (2026-05-01): 受け入れ基準検証・憲法改訂・TODO解消・パフォーマンス検証・モバイルUI改善 ✅
- **M9: テスト安定性完了** (2026-05-01): E2Eベンチマーク修正・テストタイマーリーク解消 ✅
- **M10: メンテナンス完了** (2026-05-01): 依存更新・レガシー除去・カバレッジ改善 ✅
- **M11: カバレッジ目標達成** (2026-05-01): statements 85.72%到達 ✅
- **M12: 品質整合性確認完了** (2026-05-01): ESLint 0エラー ✅・失敗テスト修正完了 ✅・依存更新完了 ✅・ドキュメント正確化完了 ✅
- **M13: 品質回復完了** (2026-05-01): ESLint 113件修正 ✅・型エラー8件修正 ✅・テスト警告解消 ✅・依存11件メジャーアップデート ✅・メトリクス正確化 ✅
- **M14: 既知の問題解決完了** (2026-05-02): KNOWN_ISSUES解消・低カバレッジ改善・npm audit解決 ✅
- **M15: 品質維持完了** (2026-05-02): KNOWN_ISSUES.md更新 ✅・カバレッジ改善 ✅・ブランチカバレッジ75.91%到達 ✅
- **M16: ドキュメント整合性完了** (未定): overview.md最新化 ✅・ワーカー警告解消 ✅
- **M17: テスト型安全性完了** (未定): テストTS型エラー0件・Flakyテスト安定化 ✅

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

- [x] [TASK-0071: 受け入れ基準テストケースの正式検証](TASK-0071.md) - 8h (TDD) 🔵
- [x] [TASK-0072: SYSTEM_CONSTITUTION.md 現状適合改訂](TASK-0072.md) - 4h (DIRECT) 🔵
- [x] [TASK-0073: Pipeline REST API エンドポイント実装（REQ-057）・残存 TODO 解消](TASK-0073.md) - 8h (TDD) 🔵
- [x] [TASK-0074: キャッシュウォームアップ戦略実装（REQ-056）](TASK-0074.md) - 4h (TDD) 🔵
- [x] [TASK-0075: E2Eパフォーマンスベンチマーク検証](TASK-0075.md) - 4h (TDD) 🔵
- [x] [TASK-0076: モバイルレスポンシブUI改善](TASK-0076.md) - 8h (TDD) 🟡

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

## Phase 9: テスト安定性改善

**期間**: 未定（Phase 8完了後）
**目標**: E2Eベンチマークテストの失敗修正・テストタイマーリーク解消
**成果物**: 全テスト通過・Jest警告解消
**備考**: Phase 8完了後のテスト品質改善フェーズ。1761テスト中1件失敗（200ノードレイアウト 4061ms > 4000ms）・Jest worker強制終了警告。

### タスク一覧

- [x] [TASK-0077: E2Eベンチマーク200ノードレイアウト性能改善](TASK-0077.md) - 4h (TDD) 🔵
- [x] [TASK-0078: テストスイートタイマーリーク修正](TASK-0078.md) - 4h (TDD) 🔵

### 依存関係

```
TASK-0075 → TASK-0077
TASK-0069, TASK-0075 → TASK-0078
TASK-0077 → TASK-0078
```

---

## Phase 10: メンテナンス・最適化

**期間**: 未定（Phase 9完了後）
**目標**: 依存パッケージ更新・レガシードキュメントクリーンアップ・テストカバレッジ改善
**成果物**: 最新依存パッケージ、クリーンなドキュメント構成、改善されたテストカバレッジ
**備考**: Phase 1-9で全要件実装完了。本フェーズはメンテナンス・最適化が中心。npm outdated による依存更新・docs/ レガシー除去・テストカバレッジ改善（statements 65%→75%目標）。

### タスク一覧

- [x] [TASK-0079: 依存パッケージ更新・セキュリティパッチ適用](TASK-0079.md) - 4h (DIRECT) 🔵
- [x] [TASK-0080: レガシードキュメントクリーンアップ](TASK-0080.md) - 2h (DIRECT) 🔵
- [x] [TASK-0081: テストカバレッジ改善](TASK-0081.md) - 8h (TDD) 🟡

### 依存関係

```
TASK-0079: 独立（Phase 9完了後ならいつでも実施可能）
TASK-0080: 独立
TASK-0079 → TASK-0081
```

---

## 信頼性レベルサマリー

*Phase 31追加後の最新版は overview.md 末尾の「信頼性レベルサマリー（更新版）」を参照*

## クリティカルパス

```
TASK-0001 → TASK-0002 → TASK-0014 → TASK-0015 → TASK-0017 → TASK-0021 → TASK-0023 → TASK-0029 → TASK-0032 → TASK-0033 → TASK-0034 → TASK-0035 → TASK-0043 → TASK-0049 → TASK-0052
```

**クリティカルパス工数**: 156時間
**並行作業可能工数**: 364時間

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
- **Phase 9追加**: 2026-05-01にテスト実行結果（1761テスト中1件失敗・Jest worker強制終了警告）のギャップ分析に基づき2タスクを新規追加
- **Phase 10追加**: 2026-05-01に依存パッケージ更新（npm outdated）・レガシードキュメント重複（docs/spec+design+tasks = 91ファイル）・テストカバレッジ（statements 65%）のギャップ分析に基づき3タスクを新規追加
- **Phase 11追加**: 2026-05-01にテストカバレッジ（statements 68.73% vs 目標75%）のギャップ分析・19モジュールの低カバレッジ（<60%）に基づき3タスクを新規追加
- **Phase 12追加**: 2026-05-01に残存ESLintエラー17件（4テストファイルのno-explicit-any）・テストカバレッジ乖離（overview主張84.61% vs 実測68.73%）・30件のoutdated依存パッケージのギャップ分析に基づき4タスクを新規追加
- **Phase 12更新**: 2026-05-01に実測値に基づく第52回検証。TASK-0085完了確認（ESLint 0エラー）・カバレッジ実測85.72%（目標超過達成）・4件テスト失敗をTASK-0086に反映・outdated 75件をTASK-0087に反映
- **Phase 13追加**: 2026-05-01に品質ギャップ分析に基づき5タスクを新規追加。overview.md「ESLint 0エラー」に対し実際は113件のno-explicit-anyエラーが検出。TypeScript型エラー8件・テストワーカー警告・27件outdated依存パッケージのギャップを対応
- **第73回検証**: 2026-05-02に全設計文書と実装のギャップ分析を実施。93タスク全完了・要件カバレッジ100%・全テスト通過を確認。軽微事項として9ファイルのカバレッジ<70%（VideoPreview.tsx 18.5%が最低）・テストワーカー強制終了警告・npm audit moderate 2件を記録。新規タスク不要と判定。
- **Phase 14追加**: 2026-05-02に第75回ギャップ分析に基づき4タスクを新規追加。KNOWN_ISSUES.md #1（拡張レイアウトプロパティ命名不整合・200+行変更2-3h）・#2（エッジプロパティ命名不整合・1h）・VideoPreview.tsx カバレッジ19.51%改善・npm audit moderate 2件解決。
- **Phase 15追加**: 2026-05-02に第77回ギャップ分析に基づき4タスクを新規追加。KNOWN_ISSUES.md Issue #1/#2 のステータスがTASK-0094/0095の完了を反映していない（RESOLVEDに更新が必要）・4ファイルのカバレッジ < 60%（enhanced-zero-overlap-layout.ts 53.41%, enhanced-error-recovery.ts 56.44%, cycle-strategy.ts 56.55%, llm-cache.ts 59.20%）・全体ブランチカバレッジ 73.58%（目標75%）。
- **Phase 16追加**: 2026-05-02に第82回ギャップ分析に基づき4タスクを新規追加。テストワーカー強制終了警告の残存（TASK-0078/0091部分修正後も継続）・5モジュールのブランチカバレッジ60%未満（LayoutStrategy 51.78%, GridSnapStrategy 52.08%, ProgressiveForceStrategy 60%, layout-engine 58.82%, OverlapResolver 63.51%）・SYSTEM_CONSTITUTION.md実績値陳腐化（68,140行/99パッケージ vs 実測83,132行/103パッケージ）。
- **第87回検証**: 2026-05-02にkairo-tasksによる包括的ギャップ分析を実施。TASK-0103（低ブランチカバレッジモジュールテスト拡充）の完了条件がコミット 6bda2f1/64276cc/7964270 により既に達成されていることを確認（LayoutStrategy 92.85%, GridSnapStrategy 70.83%, ProgressiveForceStrategy 89.23%, layout-engine 82.35%, OverlapResolver 78.37%）。テスト数3,228（+71）・statements 90.4%・branches 78.45%に改善。新規タスク不要と判定。残存Phase 16タスク: TASK-0102（ワーカー警告）・TASK-0104（CONSTITUTION更新）・TASK-0105（overview更新）。
- **Phase 17追加**: 2026-05-02に第97回ギャップ分析に基づき3タスクを新規追加。REQ-058（高度エクスポートエンジン: enhanced-export-engine.ts 761行, production-exporter.ts 632行）・REQ-059（インテリジェントキャッシュ: intelligent-cache.ts 913行）・REQ-060（改善検出: improvement-detector.ts 434行）は実装済みだが、TASK-0056~0060（REQ-052~055/305検証）と同等の個別検証タスクが存在しないトレーサビリティギャップを解消。
- **Phase 18追加**: 2026-05-03に第100回ギャップ分析に基づき2タスクを新規追加。overview.md メトリクス陳腐化（3,516テスト→実測3,569、132 suites→133、281ファイル→282、86,382行→87,267、カバレッジ改善 90.86%→92.15% stmts/79.25%→81.17% branches）・テストワーカー強制終了警告の残存（TASK-0078/0091/0102の4回修正後も継続）。
- **Phase 24追加**: 2026-05-06に第116回ギャップ分析に基づき3タスクを新規追加。CLAUDE.md禁止事項「console.logの残置」に対しプロダクションコードに724件残留（pipeline 100件・framework 107件・analysis 125件等）・SYSTEM_CONSTITUTION V2.1「総コード行数90,000行以下」に対し実測90,400行で400行超過・憲法実績値陳腐化（84,421行 vs 実測90,400行、273ファイル vs 実測297ファイル、3,228テスト vs 実測3,685テスト）。
- **第125回検証**: 2026-05-06にkairo-tasksによる包括的ギャップ分析を実施。TypeScriptエラー0件・ESLintエラー0件・3,685テスト全通過を確認。console.log 737件（TASK-0121作成時724件から13件増）・299ファイル・90,400行・104パッケージを確認。全106要件の実装完了を再確認。Phase 24 (TASK-0121~0123) が全残存ギャップをカバーしており、新規タスクは不要と判定。
- **第132回検証**: 2026-05-06にkairo-tasks分析を実施。全106要件✅実装済確認・Phase 24 TASK-0121~0123が全残存ギャップをカバー。console.log 737件・297ファイル・90,400行・104パッケージ(74 deps+30 devDeps)・TASK-0121~0123の_doc_spine.yml未登録を確認（TASK-0123完了条件に含まれる）。新規タスク不要と判定。

---

## Phase 18: ドキュメント整合性・残存品質課題

**期間**: 未定（Phase 17完了後）
**目標**: overview.md メトリクス最新化・テストワーカー警告の包括的解消
**成果物**: 実測値と一致するoverview.md、ワーカー警告ゼロ
**備考**: Phase 1-17で全要件実装完了。第100回ギャップ分析で以下を検出：overview.md メトリクスが現状と乖離（テスト数・ファイル数・行数・カバレッジ値が古い）・テストワーカー強制終了警告が4回の修正試行後も残存。

### タスク一覧

- [x] [TASK-0109: overview.md メトリクス最新化と整合性確認](TASK-0109.md) - 2h (DIRECT) 🔵 ✅完了
- [x] [TASK-0110: テストワーカープロセス強制終了警告の包括的解消](TASK-0110.md) - 8h (TDD) 🟡 ✅完了

### 依存関係

```
TASK-0109: 独立（Phase 17完了後ならいつでも実施可能）
TASK-0109 → TASK-0110
```

---

## Phase 11: カバレッジ向上・保守

**期間**: 未定（Phase 10完了後）
**目標**: テストカバレッジ75%到達・ドキュメント最新化
**成果物**: テストカバレッジ85.72%達成、更新済みoverview.md
**備考**: Phase 1-10で全要件実装完了。本フェーズはテスト品質向上が中心。coverage/coverage-summary.json で19モジュールが statements < 60%（全モジュール中最も低い streaming-transcriber.ts は 3.1%）。TASK-0082~0084で全モジュールのカバレッジを大幅改善し、全体statements 85.72%を達成。

### タスク一覧

- [x] [TASK-0082: 重要低カバレッジモジュールのテスト拡充（分析・フレームワーク層）](TASK-0082.md) - 12h (TDD) 🔵
- [x] [TASK-0083: テストカバレッジ75%到達（可視化・UI・トランスクリプション層）](TASK-0083.md) - 8h (TDD) 🟡
- [x] [TASK-0084: overview.md更新・Phase 10完了反映・第49回検証](TASK-0084.md) - 2h (DIRECT) 🔵

### 依存関係

```
TASK-0081 → TASK-0082 → TASK-0083 → TASK-0084
```

---

## Phase 12: 品質・整合性確認

**期間**: 未定（Phase 11完了後）
**目標**: 失敗テスト修正・カバレッジ検証・依存パッケージ更新・ドキュメント正確性確認
**成果物**: 全テスト通過、85.73%テストカバレッジ確認、更新済み依存パッケージ、正確なoverview.md
**備考**: Phase 1-12で全要件実装完了。ESLint 0エラー達成。テストカバレッジ85.73% statements。全2,754テスト通過。依存パッケージは安全な範囲で更新済み（26件のメジャーアップデートは見送り）。

### タスク一覧

- [x] [TASK-0085: テストファイル ESLint no-explicit-any エラー修正](TASK-0085.md) - 4h (TDD) 🔵 ✅完了
- [x] [TASK-0086: 失敗テスト修正とカバレッジ検証](TASK-0086.md) - 8h (TDD) 🔵 ✅完了
- [x] [TASK-0087: 依存パッケージ更新と互換性検証](TASK-0087.md) - 8h (DIRECT) 🟡 ✅完了
- [x] [TASK-0088: overview.md 正確性確認と第53回検証](TASK-0088.md) - 2h (DIRECT) 🔵 ✅完了

### 依存関係

```
TASK-0085 ✅ → TASK-0086 ✅
TASK-0086 ✅ → TASK-0088 ✅
TASK-0087 ✅ → TASK-0088 ✅
```

---

## Phase 13: 品質回復・保守

**期間**: 未定（Phase 12完了後）
**目標**: ESLint・TypeScript型エラー修正・テストワーカー警告解消・依存更新・メトリクス正確性確認
**成果物**: ESLint 0エラー、TypeScript型エラー0件、クリーンなテスト終了、更新済み依存パッケージ、正確なoverview.md
**備考**: Phase 12完了後に品質ギャップを検出。ESLint 113件修正・TypeScript型エラー8件修正・テストワーカー警告解消・依存パッケージ11件メジャーアップデート適用（uuid@14, sonner@2, lucide-react@1, globals@17, vaul@1, tailwind-merge@3, date-fns@4, react-day-picker@9, react-resizable-panels@4, @hookform/resolvers@5, @dagrejs/dagre@3）・15件のメジャーアップデート見送り（React 19, TypeScript 6, Vite 8, ESLint 10, tailwindcss 4, zod 4等）・overview.md正確性確認完了。

### タスク一覧

- [x] [TASK-0089: ESLint no-explicit-any エラー113件修正](TASK-0089.md) - 8h (TDD) 🔵
- [x] [TASK-0090: TypeScript型エラー8件修正](TASK-0090.md) - 4h (TDD) 🔵
- [x] [TASK-0091: テストワーカープロセス終了警告解消](TASK-0091.md) - 4h (TDD) 🔵
- [x] [TASK-0092: 依存パッケージ更新と互換性検証](TASK-0092.md) - 8h (DIRECT) 🟡
- [x] [TASK-0093: overview.md 正確性確認と第55回検証](TASK-0093.md) - 2h (DIRECT) 🔵

### 依存関係

```
TASK-0089 → TASK-0090
TASK-0089, TASK-0090, TASK-0091, TASK-0092 → TASK-0093
TASK-0091: 独立（TASK-0078完了後ならいつでも実施可能）
TASK-0092: 独立（TASK-0087完了後ならいつでも実施可能）
```

---

## Phase 14: 既知の問題解決・カバレッジ改善

**期間**: 未定（Phase 13完了後）
**目標**: KNOWN_ISSUES.md の未解決問題修正・低カバレッジファイル改善・npm audit 脆弱性解決
**成果物**: 拡張レイアウトエンジン有効化、エッジプロパティ整合性確認、VideoPreview.tsx カバレッジ70%以上、npm audit moderate 0件
**備考**: 第75回検証で KNOWN_ISSUES.md #1/#2 が未タスク化であることを特定。VideoPreview.tsx 19.51% カバレッジ（最 低）と npm audit moderate 2件も追加。Phase 1-13 で全要件実装完了済み、本フェーズは品質改善が中心。

### タスク一覧

- [x] [TASK-0094: Enhanced Layout プロパティ命名不整合修正](TASK-0094.md) - 4h (TDD) 🔵 ✅完了
- [x] [TASK-0095: Edge プロパティ命名監査・修正](TASK-0095.md) - 2h (TDD) 🔵 ✅完了
- [x] [TASK-0096: VideoPreview.tsx テストカバレッジ改善](TASK-0096.md) - 4h (TDD) 🟡 ✅完了
- [x] [TASK-0097: npm audit moderate 脆弱性解決](TASK-0097.md) - 2h (DIRECT) 🟡 ✅完了

### 依存関係

```
TASK-0094 → TASK-0095
TASK-0096: 独立（Phase 13完了後ならいつでも実施可能）
TASK-0097: 独立（TASK-0092完了後ならいつでも実施可能）
```

---

## Phase 15: 品質維持・保守

**期間**: 未定（Phase 14完了後）
**目標**: KNOWN_ISSUES.md ステータス更新・テストカバレッジ改善・ブランチカバレッジ75%到達
**成果物**: 更新済みKNOWN_ISSUES.md、70%+カバレッジの4モジュール、75%+全体ブランチカバレッジ
**備考**: Phase 14でコード修正完了後の品質維持フェーズ。KNOWN_ISSUES.mdがTASK-0094/0095の完了を反映していないため更新。4ファイルのカバレッジ < 60%（enhanced-zero-overlap-layout 53.41%, enhanced-error-recovery 56.44%, cycle-strategy 56.55%, llm-cache 59.20%）。全体ブランチカバレッジ 73.58% → 75%+目標。

### タスク一覧

- [x] [TASK-0098: KNOWN_ISSUES.md ステータス更新](TASK-0098.md) - 1h (DIRECT) 🔵 ✅完了
- [x] [TASK-0099: 拡張レイアウトエンジンテストカバレッジ改善](TASK-0099.md) - 4h (TDD) 🔵 ✅完了
- [x] [TASK-0100: 低カバレッジモジュールテスト拡充](TASK-0100.md) - 8h (TDD) 🟡 ✅完了
- [x] [TASK-0101: ブランチカバレッジ75%到達](TASK-0101.md) - 4h (TDD) 🟡 ✅完了

### 依存関係

```
TASK-0098: 独立（TASK-0094/0095完了後）
TASK-0098 → TASK-0099
TASK-0100: 独立（Phase 14完了後）
TASK-0099, TASK-0100 → TASK-0101
```

---

## Phase 16: 品質メンテナンス

**期間**: 未定（Phase 15完了後）
**目標**: テストワーカー警告解消・低カバレッジモジュール改善・SYSTEM_CONSTITUTION.md最新化
**成果物**: ワーカー警告ゼロ、ブランチカバレッジ70%+の5モジュール、更新済みSYSTEM_CONSTITUTION.md
**備考**: Phase 1-15で全要件実装完了。第82回検証で以下のギャップを検出：テストワーカー強制終了警告の残存（TASK-0078/0091で部分修正済み）、5モジュールのブランチカバレッジ60%未満（LayoutStrategy 51.78%, GridSnapStrategy 52.08%, ProgressiveForceStrategy 60%, layout-engine 58.82%, OverlapResolver 63.51%）、SYSTEM_CONSTITUTION.md実績値の陳腐化（68,140行/99パッケージ vs 実測83,132行/103パッケージ）。

### タスク一覧

- [x] [TASK-0102: テストワーカープロセス強制終了警告の完全解消](TASK-0102.md) - 4h (TDD) 🔵 ✅完了
- [x] [TASK-0103: 低ブランチカバレッジモジュールのテスト拡充](TASK-0103.md) - 8h (TDD) 🔵 ✅完了
- [x] [TASK-0104: SYSTEM_CONSTITUTION.md メトリクス更新とコード規模確認](TASK-0104.md) - 4h (DIRECT) 🟡 ✅完了
- [x] [TASK-0105: overview.md更新・第82回検証](TASK-0105.md) - 2h (DIRECT) 🔵 ✅完了

### 依存関係

```
TASK-0102: 独立（Phase 15完了後）
TASK-0103: 独立（Phase 15完了後）
TASK-0102, TASK-0103 → TASK-0104
TASK-0102, TASK-0103, TASK-0104 → TASK-0105
```

---

## Phase 17: 未追跡要件検証

**期間**: 未定（Phase 16完了後）
**目標**: REQ-058/059/060の実装検証・トレーサビリティギャップ解消
**成果物**: REQ-058~060の検証完了タスク、100%タスクトレーサビリティ
**備考**: Phase 1-16で全要件実装完了。第97回ギャップ分析で、REQ-058（高度エクスポートエンジン）・REQ-059（インテリジェントキャッシュ）・REQ-060（改善検出）の実装が存在するが、TASK-0056~0060（REQ-052~055/305検証）と同等の個別検証タスクが存在しないことを特定。トレーサビリティ完全性のため検証タスクを追加。

### タスク一覧

- [x] [TASK-0106: EnhancedExportEngine 実装検証](TASK-0106.md) - 4h (DIRECT) 🔵
- [x] [TASK-0107: IntelligentCache 実装検証](TASK-0107.md) - 4h (DIRECT) 🔵
- [x] [TASK-0108: ImprovementDetector 実装検証](TASK-0108.md) - 4h (DIRECT) 🔵

### 依存関係

```
TASK-0106: 独立（Phase 16完了後）
TASK-0107: 独立（Phase 16完了後）
TASK-0108: 独立（Phase 16完了後）
```

---

## Phase 19: テスト型安全性・Flaky修正

**期間**: 未定（Phase 18完了後）
**目標**: テストファイルTypeScript型エラー44件修正・Flakyテスト安定化・ドキュメント精度改善
**成果物**: ソースコード・テストコードともにTypeScript エラー0件、安定したE2Eメモリテスト、正確なドキュメント
**備考**: Phase 1-18で全要件実装完了。第107回ギャップ分析で以下を検出：テストファイルに44件のTypeScript型エラー（transcriber.test.ts 33件、simple-pipeline.test.ts 7件、Video.test.tsx 1件、GridSnapStrategy.test.ts 2件、LayoutStrategy.test.ts 1件）・E2Eメモリベンチマークテストが環境依存で間欠的に失敗（564.32MB > 512MB閾値）・ドキュメント「TypeScript errors 0」がソースコードのみに適用されていた。TASK-0111で型エラー0件を確認（既に解消済み）・TASK-0112でFlakyテスト安定性を確認（既に解消済み）・TASK-0113でドキュメントの正確性を確認・更新。

### タスク一覧

- [x] [TASK-0111: テストファイルTypeScript型エラー44件修正](TASK-0111.md) - 8h (TDD) 🔵 ✅完了
- [x] [TASK-0112: E2EメモリベンチマークFlaky修正](TASK-0112.md) - 4h (TDD) 🔵 ✅完了
- [x] [TASK-0113: ドキュメント型エラー記述の精度改善](TASK-0113.md) - 2h (DIRECT) 🔵 ✅完了

### 依存関係

```
TASK-0111: 独立（Phase 18完了後ならいつでも実施可能）
TASK-0112: 独立（Phase 18完了後ならいつでも実施可能）
TASK-0111 → TASK-0113
```

---

## Phase 20: Web Workers 並列化実装

**期間**: 未定（Phase 19完了後）
**目標**: CPU集約処理のWeb Workers並列化によるUI応答性向上
**成果物**: Worker基盤インフラ、エクスポートWorker、レイアウトWorker、統合テスト、パフォーマンスベンチマーク
**備考**: architecture.md スケーラビリティセクションに「Web Workers による CPU 集約処理の並列化（計画段階）」と明記。既存コード（enhanced-export-engine.ts の `workerPool: []`, complex-layout-engine.ts の `useWebWorkers: false`）にWorker参照が存在するが、実際のWorker実装は存在しない。Phase 20でこの計画を実装に移行する。

### タスク一覧

- [x] [TASK-0114: Web Worker基盤インフラ構築](TASK-0114.md) - 8h (DIRECT) 🔵
- [x] [TASK-0115: CPU集約処理のWeb Worker化](TASK-0115.md) - 16h (TDD) 🔵
- [x] [TASK-0116: Web Worker統合テストとパフォーマンス検証](TASK-0116.md) - 8h (TDD) 🔵

### 依存関係

```
TASK-0114 → TASK-0115
TASK-0115 → TASK-0116
```

---

## Phase 21: エクスポート実エンコーディング・要件完了確認

**期間**: 未定（Phase 20完了後）
**目標**: APNG実エンコーダ統合・REQ-062/063要件完了確認・ドキュメント整合性更新
**成果物**: 実APNGエンコーディング、更新済みrequirements.md、更新済みoverview.md、更新済み_doc_spine.yml
**備考**: Phase 1-20で全要件実装完了。AI_HUB_MAKE_RUN_FEEDBACKに基づく残存課題（REQ-062のステータス未更新・REQ-063のAPNGシミュレート→実エンコーダ置換え）を解消する最終フェーズ。

### タスク一覧

- [x] [TASK-0117: APNG実エンコーダ統合とエンコーディング実装](TASK-0117.md) - 8h (TDD) 🔵
- [x] [TASK-0118: Phase 21完了確認と要件・ドキュメント整合性更新](TASK-0118.md) - 4h (DIRECT) 🔵

### 依存関係

```
TASK-0116 → TASK-0117
TASK-0117 → TASK-0118
```

---

## Phase 22: 品質維持・ESLint回帰修正

**期間**: 未定（Phase 21完了後）
**目標**: Phase 20で追加されたWorkerテストファイルのESLint no-explicit-any回帰修正
**成果物**: ESLint 0エラー、3,685テスト全通過維持
**備考**: Phase 1-21で全要件実装完了。第112回要件検証でWorkerテスト4ファイルに48件の`no-explicit-any`エラー回帰を検出。CLAUDE.md品質基準「npm run lint で0エラー」に抵触するため修正が必要。

### タスク一覧

- [x] [TASK-0119: ESLint回帰修正: Workerテストのno-explicit-any解消](TASK-0119.md) - 4h (DIRECT) 🔵 ✅完了

### 依存関係

```
TASK-0116, TASK-0117, TASK-0118 → TASK-0119
```

---

## Phase 23: 品質維持・テスト型エラー修正

**期間**: 未定（Phase 22完了後）
**目標**: テストファイル内の38件TypeScript型エラー修正
**成果物**: TypeScript型エラー0件のテストファイル群
**備考**: Phase 1-22で全要件実装完了。第115回ギャップ分析で`npx tsc -p tsconfig.app.json --noEmit`実行時に38件のTypeScript型エラーを検出。overview.md「TypeScriptエラー0件」の主張と乖離。simple-pipeline.test.ts 25件・VideoPreview.test.tsx 6件・Workerテスト3件・レイアウト/Remotionテスト4件。

### タスク一覧

- [x] [TASK-0120: テストファイルTypeScript型エラー38件修正](TASK-0120.md) - 8h (TDD) 🔵 ✅完了

### 依存関係

```
TASK-0119 → TASK-0120
```

---

## Phase 24: 品質維持・コードクリーンアップ

**期間**: 未定（Phase 23完了後）
**目標**: プロダクションコードのconsole.log残置清理・コード規模90K制限適合・メトリクス更新
**成果物**: console.log 0件のプロダクションコード、90,000行以下のコードベース、更新済みSYSTEM_CONSTITUTION.md・overview.md
**備考**: Phase 1-23で全要件実装完了。第116回ギャップ分析で以下を検出：CLAUDE.md禁止事項「console.logの残置」に対しプロダクションコードに724件残留（pipeline 100件・framework 107件・analysis 125件等）・SYSTEM_CONSTITUTION V2.1「総コード行数90,000行以下」に対し実測90,400行で400行超過・憲法実績値陳腐化（84,421行 vs 実測90,400行、273ファイル vs 実測297ファイル、3,228テスト vs 実測3,685テスト）。

### タスク一覧

- [x] [TASK-0121: プロダクションコード console.log 残置清理](TASK-0121.md) - 16h (TDD) 🟡 ✅完了
- [x] [TASK-0122: コード規模90K制限への適合と不要コード除去](TASK-0122.md) - 8h (DIRECT) 🟡 ✅完了
- [x] [TASK-0123: SYSTEM_CONSTITUTION.md・overview.md メトリクス更新・第116回検証](TASK-0123.md) - 4h (DIRECT) 🔵 ✅完了

### 依存関係

```
TASK-0120 → TASK-0121
TASK-0120 → TASK-0122
TASK-0121, TASK-0122 → TASK-0123
```

---

## Phase 25~30: セキュリティ・堅牢性改善（ISS-003~045）

**期間**: 未定（Phase 24完了後）
**目標**: パストラバーサル防止・入力検証・ReDoS防止・JWT認証・暗号セキュアID等のセキュリティ・堅牢性改善
**成果物**: ISS-003~045 全45件の修正完了（個別タスクファイル未作成・コミットベースで完了確認済）
**備考**: Phase 25~30のセキュリティ・堅牢性改善はコミット単位で実行され、個別のTASK ファイルは作成されていない。REQ-064~078として要件化済み。26件の新規テストで検証済み。

### タスク一覧

ISS-003~045の修正はコミットベースで完了確認済み。詳細は requirements.md の Phase 25-30 を参照。

### 依存関係

```
Phase 24完了後 → Phase 25~30実行
```

---

## Phase 31: 高度図解品質エンハンスメント ✅完了

**期間**: 2026-05-07
**目標**: 図解レイアウトのビジュアル品質を定量化し、自動最適化するシステムの実装
**成果物**: ビジュアルバランススコアラー、エッジ交差最小化、スマートラベルサイジング、複合品質スコア、自動最適化ループ
**備考**: REQ-079~083の要件に基づく新規機能実装。第136回kairo-requirements検証で要件定義済。既存のLayoutEvaluator・AutoImprovementEngine・QualityGateの拡張として実装。168テストスイート・3,867テスト全通過で完了確認。

### タスク一覧

- [x] [TASK-0124: ビジュアルバランススコアリング実装](TASK-0124.md) - 8h (TDD) 🔵
- [x] [TASK-0125: エッジ交差検出・最小化実装](TASK-0125.md) - 16h (TDD) 🔵
- [x] [TASK-0126: スマートラベルサイジング実装](TASK-0126.md) - 8h (TDD) 🔵
- [x] [TASK-0127: 複合レイアウト品質スコア実装](TASK-0127.md) - 8h (TDD) 🔵
- [x] [TASK-0128: レイアウト自動最適化ループ実装](TASK-0128.md) - 8h (TDD) 🔵
- [x] [TASK-0129: Phase 31統合テスト・要件完了確認・ドキュメント更新](TASK-0129.md) - 4h (DIRECT) 🔵

### 依存関係

```
TASK-0124: 独立
TASK-0125: 独立
TASK-0126: 独立
TASK-0124, TASK-0125, TASK-0126 → TASK-0127
TASK-0127 → TASK-0128
TASK-0128 → TASK-0129
```

---

## 信頼性レベルサマリー（更新版）

### 全タスク統計

- **総タスク数**: 129件
- 🔵 **青信号**: 110件 (85%)
- 🟡 **黄信号**: 19件 (15%)
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
| Phase 9 | 2 | 0 | 0 | 2 |
| Phase 10 | 2 | 1 | 0 | 3 |
| Phase 11 | 2 | 1 | 0 | 3 |
| Phase 12 | 3 | 1 | 0 | 4 |
| Phase 13 | 4 | 1 | 0 | 5 |
| Phase 14 | 2 | 2 | 0 | 4 |
| Phase 15 | 2 | 2 | 0 | 4 |
| Phase 16 | 3 | 1 | 0 | 4 |
| Phase 17 | 3 | 0 | 0 | 3 |
| Phase 18 | 1 | 1 | 0 | 2 |
| Phase 19 | 3 | 0 | 0 | 3 |
| Phase 20 | 1 | 2 | 0 | 3 |
| Phase 21 | 2 | 0 | 0 | 2 |
| Phase 22 | 1 | 0 | 0 | 1 |
| Phase 23 | 1 | 0 | 0 | 1 |
| Phase 24 | 1 | 2 | 0 | 3 |
| Phase 31 | 6 | 0 | 0 | 6 |

**品質評価**: ✅ 高品質 - 85%のタスクが既存設計文書・実装に基づいている。Phase 31全タスク実装完了（REQ-079~083）。

## 移行情報（追記）

- **Phase 31完了**: 2026-05-07にPhase 31（REQ-079~083: 高度図解品質エンハンスメント）の全6タスクが完了。168テストスイート・3,867テスト全通過・TypeScript型エラー0件・ESLintエラー0件を確認。

---

## Phase 35: 可視化アルゴリズム正式化・パイプライン品質統合 ✅完了

**期間**: 2026-05-09
**目標**: ComplexLayoutEngine内のフォースダイレクトシミュレーション・グラフ粗視化を正式なREQとして定義し、Phase 31-34全品質モジュールのE2E連携テストを実装
**成果物**: フォースダイレクトシミュレーションテスト17件、グラフ粗視化テスト15件、E2E品質統合テスト17件
**備考**: REQ-094~096の要件に基づく実装検証。コミット995ee7dの実装に対する専用テスト追加。

### タスク一覧

- [x] [TASK-0140: フォースダイレクトシミュレーションREQ正式化・専用テスト追加](TASK-0140.md) - 8h (TDD) 🔵
- [x] [TASK-0141: マルチレベルグラフ粗視化REQ正式化・専用テスト追加](TASK-0141.md) - 8h (TDD) 🔵
- [x] [TASK-0142: Phase 31-34 全品質モジュール E2E 統合テスト](TASK-0142.md) - 13h (TDD) 🔵

### 依存関係

```
TASK-0140: 独立
TASK-0141: 独立
TASK-0140, TASK-0141 → TASK-0142
```

---

## Phase 36: パフォーマンス最適化・コスト可視化パイプライン ✅完了

**期間**: 2026-05-09
**目標**: パイプラインステージ並列化による処理時間短縮・LLMコスト可視化・パフォーマンスリグレッション自動検出
**成果物**: 並列レイアウト実行基盤、トークン使用量追跡・コスト推定システム、パフォーマンスベンチマーク自動化
**備考**: QUALITY_METRICS.md Phase 44-45目標に向けた中間マイルストーン。E2E処理25秒→20秒目標・コスト可視化0%→100%・リグレッション自動検出。

### タスク一覧

- [x] [TASK-0143: パイプラインステージ並列化とボトルネック検出](TASK-0143.md) - 16h (TDD) 🔵
- [x] [TASK-0144: LLMコスト・トークン使用量監視システム](TASK-0144.md) - 8h (TDD) 🔵
- [x] [TASK-0145: パフォーマンスリグレッションベンチマーク自動化](TASK-0145.md) - 8h (TDD) 🔵

### 依存関係

```
TASK-0143: 独立（Phase 35完了後）
TASK-0144: 独立（Phase 35完了後）
TASK-0143, TASK-0144 → TASK-0145
```

---

## Phase 37: 監視API本組込み・コード規模監査 ✅完了

**期間**: 2026-05-09
**目標**: コード規模自動監査CLI実装・監視REST API動作検証
**成果物**: code-size-audit CLI（npm run audit:code-size）、BudgetAlertSystem境界テスト、サーバー配線検証
**備考**: TASK-0146でコード規模監査CLI・監視APIエンドポイントを実装。TASK-0147でBudgetAlertSystem境界テスト・サーバー配線検証を完了。

### タスク一覧

- [x] [TASK-0146: コード規模自動監査CLI・監視REST APIエンドポイント実装](TASK-0146.md) - 4h (TDD) 🔵
- [x] [TASK-0147: BudgetAlertSystem境界テスト・サーバー配線検証](TASK-0147.md) - 4h (TDD) 🔵

### 依存関係

```
TASK-0146: 独立（Phase 36完了後）
TASK-0146 → TASK-0147
```

---

## Phase 38: 監査スコープ修正・ドキュメント整合性 ✅完了

**期間**: 2026-05-10
**目標**: コード規模監査のスコープを src/ ディレクトリに限定し、COMPLIANT確認・overview.md整合性更新
**成果物**: 修正版 code-size-audit（src/ スコープ限定）、COMPLIANT な監査結果、更新済み overview.md
**備考**: TASK-0148でcollectMetricsにsrcOnlyオプションを追加（デフォルトtrue）・--allフラグで全量監査可能。TASK-0149で327ファイル/96,758行・COMPLIANT確認。TASK-0150でoverview.md整合性更新。

### タスク一覧

- [x] [TASK-0148: コード規模監査スコープを src/ に限定](TASK-0148.md) - 4h (TDD) 🔵
- [x] [TASK-0149: audit:code-size COMPLIANT 確認・CI検証](TASK-0149.md) - 4h (TDD) 🔵
- [x] [TASK-0150: overview.md 整合性更新・第145回検証](TASK-0150.md) - 4h (DIRECT) 🔵

### 依存関係

```
TASK-0148: 独立（Phase 37完了後）
TASK-0148 → TASK-0149
TASK-0148, TASK-0149 → TASK-0150
```

---

## Phase 39: テストESM互換性修正・依存脆弱性解消・ドキュメント整合性 ✅完了

**期間**: 未定（Phase 38完了後）
**目標**: テストファイルのESM互換性修正・npm監査脆弱性解消・ドキュメント整合性更新
**成果物**: ESM環境で全テスト通過、npm audit 0脆弱性、更新済みarchitecture.md・requirements.md・overview.md
**備考**: Phase 38完了後の品質改善フェーズ。31テストファイルでjest.resetModules()がESM環境でReferenceErrorを発生・npm audit 3脆弱性（fast-uri HIGH・ip-address MODERATE）・architecture.md 未チェック受け入れ基準1件・品質評価陳腐化を解消。

### タスク一覧

- [x] [TASK-0151: jest ESM互換性修正（31テストファイル）](TASK-0151.md) - 8h (TDD) 🔵 ✅完了
- [x] [TASK-0152: npm監査脆弱性解消](TASK-0152.md) - 4h (DIRECT) 🔵 ✅完了
- [x] [TASK-0153: ドキュメント整合性更新](TASK-0153.md) - 4h (DIRECT) 🔵 ✅完了

### 依存関係

```
TASK-0150 → TASK-0151
TASK-0151 → TASK-0152
TASK-0152 → TASK-0153
```

---

## 信頼性レベルサマリー（Phase 39計画版）

### 全タスク統計

- **総タスク数**: 153件
- 🔵 **青信号**: 134件 (88%)
- 🟡 **黄信号**: 19件 (12%)
- 🔴 **赤信号**: 0件 (0%)

### フェーズ別信頼性（更新版）

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
| Phase 9 | 2 | 0 | 0 | 2 |
| Phase 10 | 2 | 1 | 0 | 3 |
| Phase 11 | 2 | 1 | 0 | 3 |
| Phase 12 | 3 | 1 | 0 | 4 |
| Phase 13 | 4 | 1 | 0 | 5 |
| Phase 14 | 2 | 2 | 0 | 4 |
| Phase 15 | 2 | 2 | 0 | 4 |
| Phase 16 | 3 | 1 | 0 | 4 |
| Phase 17 | 3 | 0 | 0 | 3 |
| Phase 18 | 1 | 1 | 0 | 2 |
| Phase 19 | 3 | 0 | 0 | 3 |
| Phase 20 | 1 | 2 | 0 | 3 |
| Phase 21 | 2 | 0 | 0 | 2 |
| Phase 22 | 1 | 0 | 0 | 1 |
| Phase 23 | 1 | 0 | 0 | 1 |
| Phase 24 | 1 | 2 | 0 | 3 |
| Phase 31 | 6 | 0 | 0 | 6 |
| Phase 32 | 4 | 0 | 0 | 4 |
| Phase 33 | 3 | 0 | 0 | 3 |
| Phase 34 | 3 | 0 | 0 | 3 |
| Phase 35 | 3 | 0 | 0 | 3 |
| Phase 36 | 3 | 0 | 0 | 3 |
| Phase 37 | 2 | 0 | 0 | 2 |
| Phase 38 | 3 | 0 | 0 | 3 |
| Phase 39 | 3 | 0 | 0 | 3 |

**品質評価**: ✅ 高品質 - 88%のタスクが既存設計文書・実装に基づいている。Phase 1-39全タスク完了（REQ-001~109）・全153タスク完了・4,346テスト（193スイート）全通過。

## クリティカルパス（更新版）

```
TASK-0001 → TASK-0002 → TASK-0014 → TASK-0015 → TASK-0017 → TASK-0021 → TASK-0023 → TASK-0029 → TASK-0032 → TASK-0033 → TASK-0034 → TASK-0035 → TASK-0043 → TASK-0049 → TASK-0052
```

**クリティカルパス工数**: 156時間
**並行作業可能工数**: 396時間

---

## Phase 56: 音声検証完全統合・コンポーネントテスト ✅完了

**期間**: 未定（Phase 55完了後）
**目標**: 音声検証の完全統合・重複定数の単一化・コンポーネントテスト追加
**成果物**: 統合済みAudioUploader、単一化音声制限定数、委譲済みwhisper-transcriber検証、AudioUploader専用テスト
**備考**: Phase 55でvalidateAudioFile()/validateAudioDuration()が実装済み。Phase 56では残存コンポーネント（AudioUploader・whisper-transcriber）への統合と重複定数の解消を完了する。

### タスク一覧

- [x] [TASK-0156: 重複音声制限定数の単一出処統合](TASK-0156.md) - 4h (TDD) 🔵
- [x] [TASK-0157: AudioUploader インライン検証の centralized validation 統合](TASK-0157.md) - 8h (TDD) 🔵
- [x] [TASK-0158: whisper-transcriber.ts 検証委譲と高度検証維持](TASK-0158.md) - 4h (TDD) 🔵
- [x] [TASK-0159: AudioUploader コンポーネント専用ユニットテスト](TASK-0159.md) - 8h (TDD) 🔵
- [ ] [TASK-0160: Phase 56 完了確認・ドキュメント更新](TASK-0160.md) - 4h (DIRECT) 🔵

### 依存関係

```
TASK-0156: 独立（Phase 56最初のタスク）
TASK-0156 → TASK-0157
TASK-0156 → TASK-0158
TASK-0157 → TASK-0159
TASK-0157, TASK-0158, TASK-0159 → TASK-0160
```

---

## 信頼性レベルサマリー（Phase 56計画版）

### 全タスク統計

- **総タスク数**: 160件
- 🔵 **青信号**: 144件 (90%)
- 🟡 **黄信号**: 16件 (10%)
- 🔴 **赤信号**: 0件 (0%)

### フェーズ別信頼性（Phase 56追加版）

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
| Phase 9 | 2 | 0 | 0 | 2 |
| Phase 10 | 2 | 1 | 0 | 3 |
| Phase 11 | 2 | 1 | 0 | 3 |
| Phase 12 | 3 | 1 | 0 | 4 |
| Phase 13 | 4 | 1 | 0 | 5 |
| Phase 14 | 2 | 2 | 0 | 4 |
| Phase 15 | 2 | 2 | 0 | 4 |
| Phase 16 | 3 | 1 | 0 | 4 |
| Phase 17 | 3 | 0 | 0 | 3 |
| Phase 18 | 1 | 1 | 0 | 2 |
| Phase 19 | 3 | 0 | 0 | 3 |
| Phase 20 | 1 | 2 | 0 | 3 |
| Phase 21 | 2 | 0 | 0 | 2 |
| Phase 22 | 1 | 0 | 0 | 1 |
| Phase 23 | 1 | 0 | 0 | 1 |
| Phase 24 | 1 | 2 | 0 | 3 |
| Phase 31 | 6 | 0 | 0 | 6 |
| Phase 32 | 4 | 0 | 0 | 4 |
| Phase 33 | 3 | 0 | 0 | 3 |
| Phase 34 | 3 | 0 | 0 | 3 |
| Phase 35 | 3 | 0 | 0 | 3 |
| Phase 36 | 3 | 0 | 0 | 3 |
| Phase 37 | 2 | 0 | 0 | 2 |
| Phase 38 | 3 | 0 | 0 | 3 |
| Phase 39 | 3 | 0 | 0 | 3 |
| Phase 56 | 5 | 0 | 0 | 5 |

**品質評価**: ✅ 高品質 - 90%のタスクが既存設計文書・実装に基づいている。Phase 56全5タスクがREQ-144~147要件に基づく。

## 移行情報（追記: Phase 56）

- **Phase 56追加**: 2026-05-18にkairo-tasksによる分析に基づり5タスクを新規追加。Phase 55（REQ-142~143: validateAudioFile/validateAudioDuration実装）完了後の残存ギャップとして、AudioUploader インライン検証残存・重複定数3箇所・whisper-transcriber 検証重複・AudioUploader テスト不在を特定。
- **Phase 57追加**: 2026-05-20にPhase 57の実装完了（PipelineErrorRecoveryOrchestrator 360行・spatialIndexing改善・E2Eテスト12件）に伴いTASK-0161（LLMキャッシュデバウンステスト）を登録。REQ-148/149対応。Phase 57はコミットベースで実行され、TASK-0161のみ個別ファイル化。
- **Phase 58追加**: 2026-05-21にkairo-tasksによる分析に基づき4タスクを新規追加。AI Hub フィードバック「wire the recovery orchestrator into end-to-end pipeline tests or CI to close the verification loop」に対応。CI煙テスト・フルE2Eリカバリ統合テスト・video-generatorタイムアウト修正・ドキュメント更新を計画。

---

## Phase 57: PipelineErrorRecoveryOrchestrator・LLMキャッシュデバウンス・空間インデックス ✅完了

**期間**: 未定（Phase 56完了後）
**目標**: 多層エラーリカバリオーケストレーターの実装・LLMキャッシュデバウンステスト・空間インデックス改善
**成果物**: PipelineErrorRecoveryOrchestrator（360行）、空間インデックスO(n)衝突検出、LLMキャッシュデバウンステスト15件、E2E統合テスト12件
**備考**: Phase 57はコミットベースで実行。PipelineErrorRecoveryOrchestratorがRecoveryStrategyChain・BatchOperationRecovery・PipelineRunRecoveryTracker・ErrorRecoveryMonitor・ErrorRecoveryEventBusを統合。spatialIndexing設定がdetectAllOverlapsに配線されO(n)衝突検出を実現。E2Eテスト12件（REQ-149）とデバウンステスト15件（REQ-148）を追加。

### タスク一覧

- [x] [TASK-0161: LLMキャッシュデバウンステスト追加](TASK-0161.md) - 8h (TDD) 🔵

### コミットベース完了項目（タスクファイルなし）

- feat(quality): PipelineErrorRecoveryOrchestrator追加（コミット 55e3cf5）
- feat(pipeline): PipelineOrchestratorにリカバリオーケストレーター統合（コミット afdbf6e）
- feat(layout): spatialIndexing設定をdetectAllOverlapsに配線（コミット 327454e）
- test(quality): 多層エラーリカバリ統合テスト（コミット 1738b38）
- test(pipeline): PipelineOrchestrator+ErrorRecovery E2E統合テスト（コミット 56081df）

### 依存関係

```
Phase 56完了 → Phase 57実行
```

---

## Phase 58: リカバリ検証ループ・CI統合 🔵部分完了

**期間**: 未定（Phase 57完了後）
**目標**: リカバリオーケストレーターのCI検証ループ完了・E2Eリカバリ統合テスト・既知テストタイムアウト修正
**成果物**: CI煙テスト、フルE2Eリカバリ統合テスト、修正済みvideo-generatorテスト、更新済みドキュメント
**備考**: AI Hub フィードバック「wire the recovery orchestrator into end-to-end pipeline tests or CI to close the verification loop」に対応。Phase 57のPipelineErrorRecoveryOrchestrator統合をCIで検証し、検証ループを閉じる。video-generator.test.tsの3テストタイムアウトも修正。

### タスク一覧

- [x] [TASK-0162: Pipeline Recovery CI Smoke Test](TASK-0162.md) - 8h (TDD) 🔵 ✅部分完了（npm test全通過はBLOCKED）
- [ ] [TASK-0163: Pipeline Full E2E Recovery Integration Test](TASK-0163.md) - 16h (TDD) 🔵
- [ ] [TASK-0164: Video Generator Test Timeout Fix](TASK-0164.md) - 4h (DIRECT) 🔵
- [x] [TASK-0165: Phase 57-58 Documentation Update](TASK-0165.md) - 4h (DIRECT) 🔵 ✅進行中（TypeScript/ESLint/_doc_spine.yml確認済・TASK-0162~0164完了はBLOCKED）

### 依存関係

```
TASK-0161 → TASK-0162
TASK-0162 → TASK-0163
TASK-0162, TASK-0163, TASK-0164 → TASK-0165
TASK-0164: 独立（Phase 57完了後ならいつでも実施可能）
```

---

## Phase 74: テストスイート安定化・品質回復

**期間**: 未定
**目標**: 20テストスイート133件の失敗テスト修正・64件ESLintエラー解消・ドキュメント整合性更新
**成果物**: 全テスト通過・ESLint 0エラー・overview.md整合性
**ステータス**: ✅完了（全7タスク完了）

**背景**: Phase 65~73の型付きエラー移行・戦略登録・入力堅牢性追加後、テストモック・アサーションが実装と乖離。本フェーズで乖離を解消し、テストスイート全体を安定化。

### タスク一覧

- [x] [TASK-0178: 可視化モジュールテスト安定化](TASK-0178.md) - 4h (TDD) 🔵
- [x] [TASK-0179: パイプライン・E2Eテスト安定化](TASK-0179.md) - 4h (TDD) 🔵
- [x] [TASK-0180: API・セキュリティテスト安定化](TASK-0180.md) - 4h (TDD) 🔵
- [x] [TASK-0181: モニタリング・品質・UIテスト安定化](TASK-0181.md) - 4h (TDD) 🔵
- [x] [TASK-0182: トランスクリプション・LLM・ベンチマークテスト安定化](TASK-0182.md) - 4h (TDD) 🔵
- [x] [TASK-0183: テストファイルESLint no-explicit-any解消](TASK-0183.md) - 4h (DIRECT) 🔵
- [x] [TASK-0184: overview.md Phase 65-73完了ステータス更新](TASK-0184.md) - 2h (DIRECT) 🔵

### 依存関係

```
TASK-0178~0182: 並行実行可能（モジュール独立）
TASK-0183: 並行実行可能（ESLint修正はテスト修正と独立）
TASK-0184: TASK-0178~0183 完了後に実行（最終メトリクス反映）
```

---

## Phase 76: リトライ配線統合テスト・テストスイート検証

**期間**: 未定（Phase 75完了後）
**目標**: リトライ配線統合テスト・BatchProcessingAPIテスト修正・テストスイート全通過確認
**成果物**: PipelineOrchestrator配線統合テスト、エラー型伝播E2Eテスト、バッチリカバリ並列統合テスト、APIテスト修正、overview.md更新
**ステータス**: ⬜未着手

**背景**: AI Hub フィードバック「adding integration/E2E tests that verify the retry wire-up works end-to-end under simulated network failures, not just unit-level mocked tests」に対応。Phase 75のエラー型伝播修正（REQ-195）を受けて、リトライ配線がパイプライン全体で正しく機能することを統合テストで検証する。

### タスク一覧

- [ ] [TASK-0188: PipelineOrchestrator→ErrorRecoveryOrchestrator配線統合テスト](TASK-0188.md) - 4h (TDD) 🔵
- [ ] [TASK-0189: エラー型伝播E2Eテスト](TASK-0189.md) - 4h (TDD) 🔵
- [ ] [TASK-0190: バッチリカバリ並列実行統合テスト](TASK-0190.md) - 4h (TDD) 🔵
- [ ] [TASK-0191: BatchProcessingAPI テスト修正](TASK-0191.md) - 2h (TDD) 🔵
- [ ] [TASK-0192: テストスイート全通過確認・Phase 76完了報告](TASK-0192.md) - 2h (DIRECT) 🔵

### 依存関係

```
TASK-0187 → TASK-0188, TASK-0189, TASK-0191 (並行実行可能)
TASK-0188 → TASK-0190
TASK-0188, TASK-0189, TASK-0190, TASK-0191 → TASK-0192
```

---

## 移行情報（追記: Phase 76）

- **Phase 76追加**: 2026-06-02にkairo-tasksによる分析に基づり5タスクを新規追加。AI Hub フィードバック「adding integration/E2E tests that verify the retry wire-up works end-to-end under simulated network failures」に対応。Phase 75のエラー型伝播修正（REQ-195）の検証ループを閉じるため、PipelineOrchestrator配線統合テスト・エラー型伝播E2Eテスト・バッチリカバリ並列統合テストを追加。またtests/integration/api.test.tsのBatchProcessingAPIテスト失敗（progress.total不整合）を修正タスクとして含める。

---

## 信頼性レベルサマリー

### 全タスク統計

- **総タスク数**: 201件（198完了・3未着手）
- 🔵 **青信号**: 168件 (84%)
- 🟡 **黄信号**: 17件 (8%)
- 🔴 **赤信号**: 0件 (0%)

### フェーズ別信頼性（Phase 58追加版）

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
| Phase 9 | 2 | 0 | 0 | 2 |
| Phase 10 | 2 | 1 | 0 | 3 |
| Phase 11 | 2 | 1 | 0 | 3 |
| Phase 12 | 3 | 1 | 0 | 4 |
| Phase 13 | 4 | 1 | 0 | 5 |
| Phase 14 | 2 | 2 | 0 | 4 |
| Phase 15 | 2 | 2 | 0 | 4 |
| Phase 16 | 3 | 1 | 0 | 4 |
| Phase 17 | 3 | 0 | 0 | 3 |
| Phase 18 | 1 | 1 | 0 | 2 |
| Phase 19 | 3 | 0 | 0 | 3 |
| Phase 20 | 1 | 2 | 0 | 3 |
| Phase 21 | 2 | 0 | 0 | 2 |
| Phase 22 | 1 | 0 | 0 | 1 |
| Phase 23 | 1 | 0 | 0 | 1 |
| Phase 24 | 1 | 2 | 0 | 3 |
| Phase 31 | 6 | 0 | 0 | 6 |
| Phase 32 | 4 | 0 | 0 | 4 |
| Phase 33 | 3 | 0 | 0 | 3 |
| Phase 34 | 3 | 0 | 0 | 3 |
| Phase 35 | 3 | 0 | 0 | 3 |
| Phase 36 | 3 | 0 | 0 | 3 |
| Phase 37 | 2 | 0 | 0 | 2 |
| Phase 38 | 3 | 0 | 0 | 3 |
| Phase 39 | 3 | 0 | 0 | 3 |
| Phase 56 | 5 | 0 | 0 | 5 |
| Phase 57 | 1 | 0 | 0 | 1 |
| Phase 58 | 4 | 0 | 0 | 4 |
| Phase 65 | 2 | 0 | 0 | 2 |
| Phase 66 | 3 | 0 | 0 | 3 |
| Phase 67 | 2 | 0 | 0 | 2 |
| Phase 68 | 3 | 0 | 0 | 3 |
| Phase 69 | 2 | 0 | 0 | 2 |
| Phase 74 | 7 | 0 | 0 | 7 |
| Phase 76 | 5 | 0 | 0 | 5 |
| Phase 78 | 2 | 0 | 0 | 2 |
| Phase 90 | 2 | 1 | 0 | 3 |

**品質評価**: ✅ 高品質 - 84%のタスクが既存設計文書・実装に基づいている。Phase 90はAI Hubフィードバックとコード検査に基づく。

---

## Phase 78: プロダクション観測性強化

**期間**: 2026-06-04
**目標**: API相関IDトレーシングの追加と生console呼び出しの構造化loggerへの移行
**成果物**: correlation-id.ts ミドルウェア, fallback-chain.ts logger移行

### タスク一覧

- [x] [TASK-0193: リクエスト相関IDミドルウェア](TASK-0193.md) - 6h (TDD) 🔵
- [x] [TASK-0194: FallbackChainの生console呼び出しをloggerへ移行](TASK-0194.md) - 1h (DIRECT) 🔵

### 依存関係

```
TASK-0193, TASK-0194 (独立・並行実行可能)
```

---

## Phase 81: Prometheus 互換メトリクスエクスポート

**期間**: 2026-06-04
**目標**: HTTP メトリクスを Prometheus 互換フォーマットで外部監視システムにエクスポート
**成果物**: prometheus-exporter.ts, monitoring ルート /prometheus エンドポイント

### タスク一覧

- [x] TASK-0198: Prometheus 互換メトリクスエクスポーター実装 - 4h (TDD) 🔵

### 依存関係

```
(Phase 80 HttpMetricsCollector に依存)
```

---

## Phase 90: エクスポートパイプライン統合テスト強化

**期間**: 未定（Phase 89完了後）
**目標**: エクスポートパイプライン全体を end-to-end で検証する統合テストの実装
**成果物**: E2E エクスポート統合テスト、renderer-engine 結合テスト、フォーマット横断一貫性テスト
**ステータス**: ⬜未着手

**背景**: AI Hub フィードバック「648行のテストファイルが大きい — integration-level tests exercising the full export pipeline end-to-end would catch issues the current unit tests miss」に対応。Phase 89 で animated-scene-renderer を抽出したが、モジュール間連携の統合テストが不在。E2E でシーンデータ入力から SVG/Lottie 出力までを一貫検証するテストを追加する。

### タスク一覧

- [ ] [TASK-0199: エクスポートパイプライン E2E 統合テスト](TASK-0199.md) - 8h (TDD) 🔵
- [ ] [TASK-0200: animated-scene-renderer → enhanced-export-engine 結合検証テスト](TASK-0200.md) - 4h (TDD) 🔵
- [ ] [TASK-0201: エクスポートフォーマット横断一貫性テスト](TASK-0201.md) - 4h (TDD) 🟡

### 依存関係

```
TASK-0193, TASK-0194 → TASK-0199
TASK-0199 → TASK-0200
TASK-0199, TASK-0200 → TASK-0201
```

---

---

## Phase 96: エクスポートメトリクス収集

**期間**: 未定（Phase 95完了後）
**目標**: エクスポートパイプラインのメトリクスを収集しPrometheus互換形式で公開
**成果物**: ExportMetricsCollector・Prometheus統合4メトリック・EnhancedExportEngine instrumentation
**ステータス**: ✅完了

**背景**: エクスポートパイプラインにPrometheus互換の観測可能性が不在。PipelineMetricsCollectorは存在するが、エクスポート操作のフォーマット別所要時間・成功/失敗・ファイルサイズ・ステージ別所要時間のメトリクスが未収集。

### タスク一覧

- [x] TASK-0202: ExportMetricsCollector + Prometheus統合 + EnhancedExportEngine instrumentation (REQ-226) - 4h 🔵

---

## Phase 97: エクスポートリトライとフェイルセーフ

**期間**: 未定（Phase 96完了後）
**目標**: エクスポートパイプラインのエンコーディング段階に指数バックオフリトライを追加し、一時的エラーからの自動復旧を実現
**成果物**: encodeWithRetry()・isTransientError()・EXPORT_RETRY_LIMITS・リトライメトリクス統合
**ステータス**: ✅完了

**背景**: EnhancedExportEngine の Stage 3（encoding）でOOM・タイムアウト・Workerクラッシュ等の一時的エラーが発生した場合、即座にジョブが失敗する。Phases 89-96で構築した検証・メトリクス基盤を活用し、一時的エラーからの自動復旧でエクスポート成功率を向上させる。

### タスク一覧

- [x] TASK-0203: エクスポートエンコーディング指数バックオフリトライ + 一時的/非一時的エラー分類 + リトライメトリクス (REQ-227) - 4h 🔵

**依存関係**: Phase 96 (TASK-0202) → Phase 97 (TASK-0203)

---

## Phase 98: エクスポートジョブライフサイクル管理

**期間**: 未定（Phase 97完了後）
**目標**: エクスポートジョブのキャンセル機能とステージ別タイムアウトを追加し、リソース管理を改善
**成果物**: cancelExport()・AbortController統合・EXPORT_STAGE_TIMEOUTS・タイムアウト/キャンセルメトリクス
**ステータス**: ✅完了

**背景**: 長時間実行されるエクスポートジョブをキャンセルする手段がなく、ステージ別タイムアウトも不在。リソース枯渇やハングしたジョブが後続ジョブをブロックするリスクがある。REQ-227のリトライ基盤とREQ-226のメトリクス基盤を活用し、ジョブライフサイクル全体を管理する。

### タスク一覧

- [x] TASK-0204: エクスポートジョブキャンセル + AbortController統合 + ステージタイムアウト + EXPORT_STAGE_TIMEOUTS (REQ-228) - 4h 🔵

**依存関係**: Phase 97 (TASK-0203) → Phase 98 (TASK-0204)

---

## 次のステップ

タスクを実装するには:

- 全タスク順番に実装: `/tsumiki:kairo-implement`
- 特定タスクを実装: `/tsumiki:kairo-implement TASK-0205`

---

## Phase 99: エクスポートジョブキューサービス

**期間**: 未定（Phase 98完了後）
**目標**: エクスポートジョブの優先度ベースキューサービスを追加し、同時実行制御とフェアスケジューリングを実現
**成果物**: ExportJobQueue・優先度スケジューリング・キュー位置追跡・ETA推定・ExportMetricsCollector統合
**ステータス**: 🔲未着手

**背景**: REQ-224のレートリミット（10req/15min）とREQ-228のライフサイクル管理はあるが、リクエストが上限に達すると即座に拒否される。キューサービスにより、容量が空いた際に自動処理されるようになり、ユーザー体験とスループットが向上する。REQ-226メトリクス基盤のqueue_*イベントとREQ-228のAbortController基盤を活用する。

### タスク一覧

- [ ] TASK-0205: ExportJobQueue優先度スケジューリング + 同時実行制御 + キュー位置追跡 + ETA推定 (REQ-229) - 4h 🔵

**依存関係**: Phase 98 (TASK-0204) → Phase 99 (TASK-0205)

---

## Phase 100: エクスポートアーティファクト管理

**期間**: 未定（Phase 99完了後）
**目標**: エクスポート成果物のストレージ管理・TTLベース自動クリーンアップ・ダウンロードURL生成を実現
**成果物**: ExportArtifactStore・TTL自動クリーンアップ・ダウンロードURL生成・使用量追跡
**ステータス**: ✅完了

**背景**: エクスポート成果物がメモリ/ディスクに蓄積される一方で、自動クリーンアップやダウンロード管理の仕組みがない。長期間の運用でストレージ枯渇のリスクがある。REQ-229のキューサービスと連携し、成果物のライフサイクル全体を管理する。

### タスク一覧

- [x] TASK-0206: ExportArtifactStore + TTL自動クリーンアップ + ダウンロードURL生成 + 使用量追跡 (REQ-230) - 4h 🔵

**依存関係**: Phase 99 (TASK-0205) → Phase 100 (TASK-0206)

---

## Phase 110: サイレントキャッチ修正・ログ正規化検証

**期間**: 未定
**目標**: ヘルスチェック・監視モジュールのサイレントcatchブロック修正・console.error正規化の下流影響検証・未テストモジュールgap分析
**成果物**: 7箇所のサイレントcatch修正・6つのエラーログ検証テスト・ログ正規化安全性確認・gap分析ドキュメント
**ステータス**: ✅完了

**背景**: AI Hubフィードバックに基づき、health-check-service.ts（6箇所）とperformance-dashboard.ts（1箇所）のサイレントcatchブロックを特定・修正。これらのcatchブロックは、依存サービスエラー発生時にdegradedステータスを返すものの、エラーの根本原因をログに記録していなかった。また、console.error→logger.error正規化（commit 78efa1b, e2666ad）の下流ログ消費者への影響がないことを検証。

### タスク一覧

- [x] [TASK-0207: ヘルスチェック・監視モジュールのサイレントキャッチ修正](TASK-0207.md) - 4h (DIRECT) 🔵
- [x] [TASK-0208: ログ正規化の下流影響検証・未テストモジュールgap分析](TASK-0208.md) - 3h (DIRECT) 🔵

### 依存関係

```
TASK-0207: 独立
TASK-0208: 独立
```

---

## Phase 113: クリティカルバグ修正&テスト安定性

**期間**: 未定
**目標**: 6つのクリティカルソースファイルで発見された23個のバグ候補を修正し、4つの既存テスト失敗を解消し、残存サイレントキャッチを修正する
**成果物**: Promise Leak修正、Timer Leak修正、NaN伝播防止、タイムアウトAbortSignal追加、テスト失敗4件解消、サイレントキャッチ2件修正
**ステータス**: ✅完了（STALE-CLOSED — 2026-08-07 再監査）

**背景**: AI Hubフィードバック（substantive work推奨）に基づき、コアパイプライン・品質管理・可視化・APIの6主要モジュールに対する静的解析・動的解析を実施。結果として、Promise Leak（enhanced-error-recovery.ts）、Timer Leak（continuous-learner.ts）、NaN伝播（enhanced-zero-overlap-layout.ts）、AbortSignal未連携（pipeline-orchestrator.ts）、サイレントキャッチ残存2件（rule-based-analyzer.ts, SimplePipelineInterface.tsx）、および4件の既存テスト失敗を特定。

**Disposition (2026-08-07)**: kairo-tasks 再呼び出しを契機に 8 タスクを実コードと突き合わせ再監査。**7 STALE / 1 部分有効** と確定し、TASK 群は STALE-CLOSED として Phase クローズ。それぞれの根拠を以下に明記する（タスク個別の file:line アンカー）。

| TASK | 主張 | 実コード検証 | Disposition |
|------|------|------------|-------------|
| TASK-0209 既存テスト失敗 | 4件 | 直近 commit f8304de2 で 3件のテストインフラ回帰（`unstable_mockModule` の export 漏れ・`listTsFiles()` が *.test.ts* を巻き込む・`useFrameworkPipeline` ブレークダウン期待値の stale-trap）を RED→GREEN 解消済み。残1件は本監査で再現不可。 | STALE-CLOSED |
| TASK-0210 Promise Leak | `cleanupExpiredQueuedRequests()` が Promise を孤児化 | `src/quality/enhanced-error-recovery.ts:272` `requestQueue: Array<{ id, request: () => Promise<unknown>, ... }>` — キューは **request 関数**を保持し、**Promise オブジェクトは保持しない**。filter で除外しても孤児 Promise は生じない（呼ばれなかった関数が破棄されるだけ）。「Promise resolve/reject 漏れ」の前提が構造的に誤り。 | STALE-CLOSED |
| TASK-0211 Timer Leak + Pearson | `stopLearning` 未呼び出し時に timer leak、`xs.length === ys.length` チェックなし | `continuous-learner.ts:1185-1199` `stopLearning()`/`destroy()` 完備（`destroy()` は `stopLearning()` を呼ぶ）。`pearson` 計算は同:653 で `if (xs.length !== ys.length) return 0;` 既に存在。 | STALE-CLOSED |
| TASK-0212 NaN + 進捗検出 | `calculateOptimalSeparation()` の NaN 伝播、while ループに進捗検出なし | `enhanced-zero-overlap-layout.ts:950-955` NaN ガード完備。同:748-752 `if (overlaps.length >= prevOverlapCount) { logger.warn(...); break; }` 進捗検出は既存。 | STALE-CLOSED |
| TASK-0213 AbortSignal + Null安全 | 動的タイムアウトが `Promise.race` で reject しても処理継続、layout null キャストでクラッシュ | `pipeline-orchestrator.ts` 全体に対し `grep -n "Promise.race\|AbortController\|AbortSignal\|abort"` → **0件**。Timeout 機構自体が存在せず、TASK の前提（Promise.race による reject）が現コードに存在しない。 | STALE-CLOSED |
| TASK-0214 残存サイレントキャッチ | `rule-based-analyzer.ts:104`, `SimplePipelineInterface.tsx:125` の catch が silent | 両 catch とも `logger.warn('[rule-based-analyzer] process.env access failed...')` / `logger.error('[SimplePipeline] Processing error: ${message}')` を **既に出力**。silent ではない。 | STALE-CLOSED |
| TASK-0215 リトライカウンタスレッド安全性 | `this.retryAttempts += attempts` が並行実行で競合 | Node.js は **シングルスレッド**（イベントループ）であり、真の race condition は起きない。実態は **実行間状態の混合汚染**（pipeline A の累積リトライ回数を pipeline B が継承）で、フレーミング（thread-safety）が誤り。実害は限定的・observability 集計の汚染のみ。 | STALE-CLOSED（FRAMING 誤り） |
| TASK-0216 sendError 後に return 忘れ | `monitoring.ts` の `sendError` 呼び出し後の `return` 漏れ → "Cannot set headers after they are sent" | `monitoring.ts` で `sendError` を呼ぶ 17 箇所すべて `return sendError(...)` 形式（`grep -n "return sendError"` 17 ヒット）。さらに全 async handler は `withTimeout` ラッパ（line 97）で囲まれ、route-level タイムアウト保護も **既存**。 | STALE-CLOSED |

**結論**: 8 タスク全件 STALE。再着手せず Phase 113 を CLOSE する。TASK-0215 の「実行間状態汚染」だけは観測上の問題として残るが、修正は構造変更（per-execution スコープ化）+ observability 値の意味的ドキュメント化が必要で、bug 修正というより spec リファイン扱い。新たに Phase 114 を切るほどの impact でもない。

### 監査ログ

- 2026-08-07: 8 タスク全件を実コード `src/quality/enhanced-error-recovery.ts` / `src/framework/continuous-learner.ts` / `src/visualization/enhanced-zero-overlap-layout.ts` / `src/pipeline/pipeline-orchestrator.ts` / `src/analysis/rule-based-analyzer.ts` / `src/components/SimplePipelineInterface.tsx` / `src/pipeline/main-pipeline.ts` / `src/api/routes/monitoring.ts` と file:line アンカーで照合。
- フレームワーク系テスト（4 suites / 359 tests）で現状の健全性を確認（f8304de2 後の状態）。
- `MEMORY.md` の phantom 警告（cross-codebase 混同 / closed dead-end 再検索禁止）と整合。

---

## Phase 132: Steering feedback A1 grounding + commit policy

**期間**: 2026-08-11 〜
**目標**: 直近 AI_HUB_MAKE_RUN_FEEDBACK に基づき、Phase 131+ 提案（REQ-298/299/300）の具現化と critical-path guard 1 ペアの real fix、commit 粒度ポリシーの明文化を行う
**成果物**: 11図解タイプ string literal inventory、storageParser 双方向 validator、useEffectWithUnmountGuard hook、async-setState-after-unmount real fix、commit-policy.md
**ステータス**: 🔵進行中

**背景**: 直近 4 commit（5c373b72 / 0318ddfb / 3fbece7d / 4800ae75）はすべて「sibling RED-witness standard への引き上げ」系で同種。steering feedback は (1) guard 拡張の横展開、(2) critical-path guard の real fix ペア grounding、(3) commit 粒度の 1 commit / 3-4 file 化を推奨。本フェーズはこれらを Phase 132 タスクとして実装する。

### タスク一覧

- [x] [TASK-0217: JSON.parse-vs-finiteness 監査と残余 Infinity ベクタの修正](TASK-0217.md) - 4h (TDD) 🔵 *既存 Phase 131*
- [ ] [TASK-0218: storageParser validators JSON.parse⇔JSON.stringify 非対称監査 (REQ-299)](TASK-0218.md) - 5h (TDD) 🔵
- [ ] [TASK-0219: async-setState positive-case fixture (REQ-300)](TASK-0219.md) - 4h (TDD) 🔵
- [ ] [TASK-0220: critical-path guard real fix + mutation witness pair (async-setState-after-unmount)](TASK-0220.md) - 6h (TDD) 🔵
- [ ] [TASK-0221: commit 粒度統合（4-5 commit / 3-4 file 再編）](TASK-0221.md) - 3h (DIRECT) 🔵
- [ ] [TASK-0222: Phase 132 overview 更新](TASK-0222.md) - 1h (DIRECT) 🔵

### 依存関係

```
TASK-0218 → TASK-0220（real fix 前提として storage 経路 inventory が要）
TASK-0219 → TASK-0220（useEffectWithUnmountGuard hook 抽出が real fix の前提）
TASK-0220 → TASK-0222（real fix 完了後に overview 更新）
TASK-0221 → TASK-0222（commit policy 確定後に overview 更新）
```

### 信頼性レベルサマリー（Phase 132 追加分）

- 全 6 タスク 🔵（steering feedback 明示 + REQ-298/299/300 提案整合基盤あり）
- 推定工数: 23 時間（既存 TASK-0217 の 4h 含む）

### 次フェーズ開始番号

**次回開始番号**: TASK-0223

---

## Phase 140: エビデンス出典・並列CI・規模予算・収束駆動タスク生成

**期間**: 2026-08-19 〜
**目標**: AI Hub steering feedback（前回 iteration VALUABLE 判定の後続）の META-intent を本リポジトリの実体に映射する — (1) 数量・性能主張のエビデンス出典を正典ツールで強制、(2) PR #8/#11/#12/#13 の実装済み変更（並列 CI・型 strict・規模予算）を出典付きで要件化、(3) single-source/fold family の phase 生成停止条件と価値密度ルールを overview に固定
**成果物**: scripts/collect-evidence.ts（[EVIDENCE] 行 runner）・tests/scripts/collect-evidence.test.ts（TC-323・14 tests）・REQ-323〜327・TASK-0223〜0225・688acbed「650→0」非再現の 3 点実測記録・tsconfig.test.json strict 化（156→0→override 削除・A140）
**ステータス**: ✅完了（2026-08-19・TASK-0223/0224/0225 全完了 — Phase 140 完結）

**背景**: steering feedback の固有名（`foldGuardOracles` / `no-inline-*-display.test.ts` / `ActionPlanPanel` / `fold-display-census`）は grep 実測で本リポジトリに存在しない cross-repo 汚染（interview-record A138）。一方で META-intent は実体があり、うち 2 件（registry からの data-driven テスト生成・census による残り数計測）は本リポジトリで既に達成済み（tests/guards/frozen-literal-registry.test.ts・fold-census-families.ts）。未達だった 2 件 — 出典の強制とタスク生成側の停止条件 — を本フェーズで実装した。

### タスク一覧

- [x] [TASK-0223: エビデンス runner（[EVIDENCE] 行）の実装と TC-323 pin](TASK-0223.md) - 4h (TDD) 🔵
- [x] [TASK-0224: テストツリー strict flag lock-in（188 error → 0 → tsconfig 反転）](TASK-0224.md) - 8h (DIRECT) 🔵 ✅2026-08-19（実開始状態は 156・A140 出典）
- [x] [TASK-0225: Phase 140 overview 同期と per-fold series CLOSED 明記](TASK-0225.md) - 1h (DIRECT) 🔵

### 依存関係

```
TASK-0223 → TASK-0224（baseline 188 と完了 0 の計測に出典ツールを使用）
TASK-0223 → TASK-0225（overview の成果物記載に TC-323 結果を使用）
```

### single-source / fold family の phase 生成停止条件（REQ-327）

- **series CLOSED**: fold 系列（round 41〜50 の value-neutral fold 対象）は census 上 converged（value-neutral 候補 0・tests/guards/fold-census-families.ts FOLD_SERIES_STATUS ratchet + specs/guard-harness-fold-census/requirements.md census-pin）。**本 series に対して per-fold phase を新規生成しないこと**。残存 C1〜C5 は実挙動変更または設計判断が必要な別案件（census 表参照）。
- **価値密度**: 値が偶然一致しているだけの coincidence twin（value-neutral fold）は独立 phase にしない。発散が確認された兄弟 fold と同一 phase に巻き込む。per-phase 作業の連続生成は自律ループの価値評価で漸減するため、発散 family・未到達 backlog へ移行する。
- 次の候補は Phase 132 の未着手 TASK-0218〜0222（storageParser 非対称監査・async-setState positive fixture・real fix ペア・commit 粒度）。TASK-0224（strict lock-in）は 2026-08-19 完了。

### 信頼性レベルサマリー（Phase 140 追加分）

- 全 3 タスク 🔵（steering META-intent + 実測 baseline に出典）
- 推定工数: 13 時間（TASK-0223/0225 は第219回・TASK-0224 は第221回で完了）

### 次フェーズ開始番号

**次回開始番号**: TASK-0226

## Phase 141: non-null assertion 撲滅・storage parity・mutation witness 台帳

**ステータス**: ✅完了（2026-08-20・TASK-0226/0227/0228 全完了）

**背景**: 前 iteration（Phase 140）の VALUABLE 判定に続く steering 4 指摘のうち、固有名（`fold-display-census` REMAINING-WORK pin・`STORAGE_KEYS`・`b86ddeb6`）は本リポジトリに存在しない cross-repo 汚染（6 件目・interview-record A141）。META-intent 3 件を実体に映射: (1) `!` の census と可視化ツリー置換、(2) storage reader/writer パリティの機械検証、(3) mutation witness の盤査可能性。divergence-first 選別ルールは Phase 140 REQ-327 として既存。

### タスク一覧

- [x] [TASK-0226: src/visualization non-null assertion 撲滅 + 全ツリー census ratchet](TASK-0226.md) - 6h (DIRECT) 🔵 ✅2026-08-20（67→0・128+34 suites GREEN）
- [x] [TASK-0227: storage key read/write parity sweep + 常設 guard](TASK-0227.md) - 2h (DIRECT) 🔵 ✅2026-08-20（LIVE-dead なし・parity guard 4 tests）
- [x] [TASK-0228: mutation witness 台帳（mutant 一覧 + red 数の committed log）](TASK-0228.md) - 3h (DIRECT) 🔵 ✅2026-08-20（MW-001〜006・過去主張 3 件を [EVIDENCE] 付き再実行）

### 依存関係

```
TASK-0228 は REQ-326 evidence runner（TASK-0223）の出典形式を再利用
TASK-0226/0227/0228 は相互独立（同一 phase で並行実施可）
```

### 信頼性レベルサマリー（Phase 141 追加分）

- 全 3 タスク 🔵（steering META-intent + grep/再実行実測に出典）
- 推定工数: 11 時間

### 次フェーズ開始番号

**次回開始番号**: TASK-0229

## Phase 142: non-null assertion 撲滅・pipeline 編

**ステータス**: ✅完了（2026-08-20・TASK-0229 完了）

**背景**: REQ-328（Phase 141）の直接継続。steering bullet 1「src と主要テストパスの残 `!` を census し（TASK-0226 以降に ratchet TASK を追加）」の『TASK-0226 以降』第2弾として、残 src 最大バケット src/pipeline（29 件・オーケストレーション核心）を対象に選択（2026-08-20 実測分布: pipeline 29・transcription 17・export 10・他 38）。

### タスク一覧

- [x] [TASK-0229: src/pipeline non-null assertion 撲滅 + census ratchet 縮小](TASK-0229.md) - 4h (DIRECT) 🔵 ✅2026-08-20（29→0・src ratchet 93→64・MW-007）

### 依存関係

```
TASK-0229 は REQ-328 の census guard（TASK-0226）と MW 台帳（TASK-0228）を再利用
次候補: src/transcription（17）→ src/export（10）— 同一パターンセットで残 64 を段階的に 0 へ
```

### 信頼性レベルサマリー（Phase 142 追加分）

- 全 1 タスク 🔵（steering META-intent 継続 + 前後実測（38→201 suites GREEN・tsc 0）に出典）
- 推定工数: 4 時間

### 次フェーズ開始番号

**次回開始番号**: TASK-0230

## Phase 143: non-null assertion 撲滅・transcription 編

**ステータス**: ✅完了（2026-08-20・TASK-0230 完了）

**背景**: REQ-331（Phase 142）の直接継続。Phase 142 引継ぎの残 src `!` 分布（2026-08-20 実測: transcription 17・export 10・monitoring 7・analysis 6・framework 5・api 4・test 4・components 3・quality 3・remotion 2・main.tsx 1・pages 1・workers 1 = 64）の次点バケット src/transcription（17 件・streaming-transcriber 14 行・whisper-transcriber 3 行）を対象に選択。入力境界モジュールから `!` を排除し strict mode の実検証範囲を拡大。

### タスク一覧

- [x] [TASK-0230: src/transcription non-null assertion 撲滅 + census ratchet 縮小](TASK-0230.md) - 4h (DIRECT) 🔵 ✅2026-08-20（17→0・src ratchet 64→47・MW-008）

### 依存関係

```
TASK-0230 は REQ-328 の census guard（TASK-0226）と MW 台帳（TASK-0228）を再利用
次候補: src/export（10）→ src/monitoring（7）— 同一パターンセットで残 47 を段階的に 0 へ
```

### 信頼性レベルサマリー（Phase 143 追加分）

- 全 1 タスク 🔵（steering META-intent 継続 + 前後実測（25 suites/603 tests 同一 GREEN・tsc 0）に出典）
- 推定工数: 4 時間

### 次フェーズ開始番号

**次回開始番号**: TASK-0231

## Phase 144: non-null assertion 撲滅・export 編

**ステータス**: ✅完了（2026-08-20・TASK-0231 完了）

**背景**: REQ-332（Phase 143）の直接継続。Phase 143 引継ぎの残 src `!` 分布（2026-08-20 実測: export 10・monitoring 7・analysis 6・framework 5・api 4・test 4・components 3・quality 3・remotion 2・main.tsx 1・pages 1・workers 1 = 47）の最大バケット src/export（10 件・multi-format-exporter 6 行・security-metrics-collector 1 行・production-exporter 1 行・export-job-queue 1 行・enhanced-export-engine 1 行）を対象に選択。XSS 検証・成果物命名・job 生命周期という外部境界から `!` を排除し strict mode の実検証範囲を拡大。

### タスク一覧

- [x] [TASK-0231: src/export non-null assertion 撲滅 + census ratchet 縮小](TASK-0231.md) - 4h (DIRECT) 🔵 ✅2026-08-20（10→0・src ratchet 47→37・MW-009・fail-loud accessor は REQ-228 mock 経路で REFUTED を記録し pass-through 署名で解決）

### 依存関係

```
TASK-0231 は REQ-328 の census guard（TASK-0226）と MW 台帳（TASK-0228）を再利用
source-anchor pin 更新: tests/export/production-exporter-safe-aggregation-migration.test.ts（site-780 肯定 pin を post-Phase-144 形に）
次候補: src/monitoring（7）→ src/analysis（6）— 同一パターンセットで残 37 を段階的に 0 へ
```

### 信頼性レベルサマリー（Phase 144 追加分）

- 全 1 タスク 🔵（steering META-intent 継続 + 前後実測（73 suites/4144 tests 同一 GREEN・tsc 0）に出典）
- 推定工数: 4 時間

## Phase 145: non-null assertion 撲滅・monitoring 編

**ステータス**: ✅完了（2026-08-20・TASK-0232 完了）

**背景**: REQ-333（Phase 144）の直接継続。Phase 144 引継ぎの残 src `!` 分布（2026-08-20 実測: monitoring 7・analysis 6・framework 5・api 4・test 4・components 3・quality 3・remotion 2・main.tsx 1・pages 1・workers 1 = 37）の最大バケット src/monitoring（7 件・health-check-service 2 行・performance-dashboard 2 行・real-time-performance-monitor 1 行・production-error-handler 1 行・http-metrics-collector 1 行）を対象に選択。optional なランタイムメトリック（rss/external）と register/listener マップという内部境界から `!` を排除し strict mode の実検証範囲を拡大。

### タスク一覧

- [x] [TASK-0232: src/monitoring non-null assertion 撲滅 + census ratchet 縮小](TASK-0232.md) - 4h (DIRECT) 🔵 ✅2026-08-20（7→0・src ratchet 37→30・MW-010・bytes-to-mb-canon pin 更新）

### 依存関係

```
TASK-0232 は REQ-328 の census guard（TASK-0226）と MW 台帳（TASK-0228）を再利用
source-anchor pin 更新: tests/guards/bytes-to-mb-canon.test.ts（rss 肯定 pin を ?? Number.NaN 要求形に）
次候補: src/analysis（6）→ src/framework（5）— 同一パターンセットで残 30 を段階的に 0 へ
```

### 信頼性レベルサマリー（Phase 145 追加分）

- 全 1 タスク 🔵（steering META-intent 継続 + 実測（monitoring+guards 45 suites/1068 tests GREEN・tsc 0）に出典）
- 推定工数: 4 時間

## Phase 146: non-null assertion 撲滅・analysis 編

**ステータス**: ✅完了（2026-08-20・TASK-0233 完了）

**背景**: REQ-334（Phase 145）の直接継続。Phase 145 引継ぎの残 src `!` 分布（2026-08-20 実測: analysis 6・framework 5・api 4・test 4・components 3・quality 3・remotion 2・main.tsx 1・pages 1・workers 1 = 30）の最大バケット src/analysis（6 件・llm-service 1 行・scene-segmenter 5 行）を対象に選択。LLM クライアントの optional 初期化（`genAI?`）とセグメント集約ループという内部境界から `!` を排除し strict mode の実検証範囲を拡大。

### タスク一覧

- [x] [TASK-0233: src/analysis non-null assertion 撲滅 + census ratchet 縮小](TASK-0233.md) - 4h (DIRECT) 🔵 ✅2026-08-20（6→0・src ratchet 30→24・MW-011）

### 依存関係

```
TASK-0233 は REQ-328 の census guard（TASK-0226）と MW 台帳（TASK-0228）を再利用
source-anchor 陳腐化 pin なし（scene-segmenter/llm-service の既存 anchor は編集箇所と無関係）
次候補: src/framework（5）→ src/api（4）— 同一パターンセットで残 24 を段階的に 0 へ
```

### 信頼性レベルサマリー（Phase 146 追加分）

- 全 1 タスク 🔵（steering META-intent 継続 + 実測（analysis+guards 135 suites/7057 tests GREEN・tsc 0）に出典）
- 推定工数: 4 時間

## Phase 147: non-null assertion 撲滅・src 全体 exact-0 + checker AST 化 + tests ディレクトリ別 ratchet

**ステータス**: ✅完了（2026-08-20・TASK-0234 完了）

**背景**: REQ-335（Phase 146）の直接継続で撲滅プログラム（Phase 141〜・計 136 件）の完結編。AI Hub steering 指示「src バケットの残り 24 件に同一の exact-0 パターンを適用して src 全体を exact-0 まで到達させよ。到達後は tests バケット 960 をディレクトリ別 ratchet に分割して単調減少を開始せよ」+「手動の表面列挙の前に検出パターンを先に実行し、hits 全体から機械的に対象リストを生成せよ（Phase 299 missed-surface 教訓）」。guard-first survey として census checker を先に line-regex → TypeScript AST に置換した結果、旧 regex の盲点が露出: `!(` 呼び出し形（Phase 144 の src/export「10→0」時の見落とし `nextJob.resolve!({`）を検出し、逆に文字列/JSX text 偽陽性 3 件を不可視化。残り 22 AST node（12 ファイル）を Phase 141〜146 パターン + 8 派生形で挙動保存置換し **src 全体を exact-0** に到達。あわせて tests ツリー 1096 node を 14 ディレクトリ別 ratchet に分割。

### タスク一覧

- [x] [TASK-0234: src 全体 non-null assertion exact-0 + census checker AST 化 + tests ディレクトリ別 ratchet](TASK-0234.md) - 5h (DIRECT) 🔵 ✅2026-08-20（22 node→0・whole-src exact pin・TESTS_DIR_PINS 14・MW-012/013）

### 依存関係

```
TASK-0234 は REQ-328 の census guard（TASK-0226）と MW 台帳（TASK-0228）を再利用
checker の AST 化は TASK-0226 の line-regex rule を SUPERSEDE（spine 整合のため Phase 146 まで同一 regex を維持）
source-anchor 陳腐化 pin なし（編集 12 ファイルに肯定 pin なし・事前 grep で確認）
次候補: tests ツリーのディレクトリ別 ratchet 縮小（unit 471 が最大バケット）— REQ-337 の単調減少フェーズ
```

### 信頼性レベルサマリー（Phase 147 追加分）

- 全 1 タスク 🔵（steering 直接指示 + 実測（census guard 11 tests・対象 67 suite 1575 tests GREEN・tsc 0・MW-012/013 mutant RED）に出典）
- 推定工数: 5 時間

### 次フェーズ開始番号

**次回開始番号**: TASK-0235

## Phase 148: tests ツリー non-null assertion ratchet 単調減少ラウンド 1（tests/unit 471 → 377）

**ステータス**: ✅完了（2026-08-20・TASK-0235 完了）

**背景**: REQ-337（Phase 147）が「後続フェーズは ratchet を段階的に縮小し単調減少を維持せよ」と規定した最初の実施ラウンド。AI Hub steering 指示「到達後は tests バケットをディレクトリ別 ratchet に分割して単調減少を開始せよ」の減少側。対象は guard-first 実測（AST census per-file 集計）で機械的に決定 — tests/unit の上位 2 ファイル: monitoring/alert-rules.test.ts（55 node・unit の 12%）と export/export-job-queue-dlq.test.ts（39 node・同 8%）。両ファイルとも同一根本クラス（`find()` / `findJob()` / `replayDeadLetterJob()` / `dequeue()` の optional 戻り値の checker 抑制）。fail-loud local helper 2 種（`requireAlertRule`・`requireDefined`）で挙動保存置換し 94 node → 0・**tests/unit pin 471 → 377・tests 合計 pin 1096 → 1002**。MW-014（rewrite への `!` 1 node 再注入で dir ratchet + 合計 ratchet の 2 RED）で減少の機械強制を実証。

### タスク一覧

- [x] [TASK-0235: tests ツリー non-null assertion ratchet 単調減少ラウンド 1（tests/unit 471 → 377）](TASK-0235.md) - 3h (DIRECT) 🔵 ✅2026-08-20（94 node→0・pin 377/1002・MW-014）

### 依存関係

```
TASK-0235 は REQ-337 の TESTS_DIR_PINS（TASK-0234）を縮小側に更新
fail-loud helper は Phase 144 requireSceneId パターンの tests 適用
MW 台帳（TASK-0228）に MW-014 追加・監査 pin ≥13 → ≥14
次候補: tests/unit 残 377 の継続縮小（grafana-dashboard-model 25・pipeline-orchestrator 25・production-exporter 24 が次点）
```

### 信頼性レベルサマリー（Phase 148 追加分）

- 全 1 タスク 🔵（steering 直接指示（減少開始）+ 実測（census guard 11 tests・対象 2 suite 74 tests GREEN・tsc 0・MW-014 mutant RED）に出典）
- 推定工数: 3 時間

### 次フェーズ開始番号

**次回開始番号**: TASK-0236

## Phase 149: tests ツリー non-null assertion ratchet 単調減少ラウンド 2（tests/unit 377 → 274）

**ステータス**: ✅完了（2026-08-20・TASK-0236 完了）

**背景**: REQ-337 の単調減少維持指令のラウンド 2。A148 残課題の次点 3 ファイル（grafana-dashboard-model 25・pipeline-orchestrator 25・production-exporter 24）に guard-first per-file census で上位に現れた quality-gate.test.ts（29 node・unit 残 377 の最大ファイル）を加えた 4 ファイル 103 node を対象。同一根本クラス（optional 戻り値 / optional フィールドへの checker 抑制）を fail-loud helper 4 種（`requireCriterionResult`・`requirePanel`・`requireDefined`・`requirePreset`/`requireJobStatus`）+ factory 戻り型 narrowing（`PipelineInput & { config: PipelineConfig }`）+ inline narrowing（`templating`）で挙動保存置換し 103 node → 0・**tests/unit pin 377 → 274・tests 合計 pin 1002 → 899**。MW-015（rewrite への `!` 1 node 再注入で合計 ratchet 900 > 899 と dir ratchet 275 > 274 の 2 RED）で減少の機械強制を継続実証。

### タスク一覧

- [x] [TASK-0236: tests ツリー non-null assertion ratchet 単調減少ラウンド 2（tests/unit 377 → 274）](TASK-0236.md) - 3h (DIRECT) 🔵 ✅2026-08-20（103 node→0・pin 274/899・MW-015）

### 依存関係

```
TASK-0236 は REQ-337 の TESTS_DIR_PINS（TASK-0234）を Phase 148（TASK-0235）に続き縮小側に更新
requireDefined は Phase 148 export-job-queue-dlq と同型・factory 戻り型 narrowing は新規
MW 台帳（TASK-0228）に MW-015 追加・監査 pin ≥14 → ≥15
次候補: tests/unit 残 274 の継続縮小（phase32 系 integration 38 は別ディレクトリ・unit 内次点: api/websocket-handler 21・api/batch-processing-api 14・api/routes/monitoring-phase84-85 14）
```

### 信頼性レベルサマリー（Phase 149 追加分）

- 全 1 タスク 🔵（A148 残課題 + steering の単調減少指示 + 実測（census guard 11 tests・対象 4 suite 145 tests GREEN・tsc 0・MW-015 mutant RED）に出典）
- 推定工数: 3 時間

### 次フェーズ開始番号

**次回開始番号**: TASK-0237

## Phase 150: tests ツリー non-null assertion ratchet 単調減少ラウンド 3（tests/unit 274 → 169）

**ステータス**: ✅完了（2026-08-20・TASK-0237 完了）

**背景**: REQ-337 の単調減少維持指令のラウンド 3。steering の **guard-first survey** 指令（パターンを先に走らせ検出全 hit から面リストを機械的に生成）に初準拠し、Phase 147 の AST census checker と同一ロジックの per-file 集計降順上位 7 ファイル 105 node（websocket-handler 21・batch-processing-api 14・monitoring-phase84-85 14・websocket-payload-validation 14・VideoPreview 14・animated-svg-lottie-export 14・error-recovery-boundary-grouping 14）を対象。同一根本クラス（optional 戻り値 / mock キャプチャ / optional フィールドへの checker 抑制）を fail-loud helper 6 種（`requireEventHandler`・`requireDefined`(null 対応)・`requireAlertRule` 再利用・`requireFirstHandler`+`requireEmitted`・`requirePlayer`・`requireShape`）で挙動保存・verdict 保存置換し 105 node → 0・**tests/unit pin 274 → 169・tests 合計 pin 899 → 794**。MW-016（rewrite への `!` 1 node 再注入で合計 ratchet 795 > 794 と dir ratchet 170 > 169 の 2 RED）で減少の機械強制を継続実証。

### タスク一覧

- [x] [TASK-0237: tests ツリー non-null assertion ratchet 単調減少ラウンド 3（tests/unit 274 → 169）](TASK-0237.md) - 3h (DIRECT) 🔵 ✅2026-08-20（105 node→0・pin 169/794・MW-016）

### 依存関係

```
TASK-0237 は REQ-337 の TESTS_DIR_PINS（TASK-0234）を Phase 148/149 に続き縮小側に更新
requireAlertRule は REQ-338 alert-rules.test.ts と同型・requireEventHandler/requirePlayer/requireShape は新規
MW 台帳（TASK-0228）に MW-016 追加・監査 pin ≥15 → ≥16
次候補: tests/unit 残 169 の継続縮小（census 次点: pipeline/pipeline-quality-monitor 13・monitoring/real-time-performance-monitor 11・pipeline/pipeline-orchestrated-recovery-integration 10）
```

### 信頼性レベルサマリー（Phase 150 追加分）

- 全 1 タスク 🔵（A149 残課題 + steering の guard-first survey 指示 + 実測（census guard 11 tests・対象パターン 8 suites 315 tests GREEN・tsc 0・MW-016 mutant RED 2 failed）に出典）
- 推定工数: 3 時間

### 次フェーズ開始番号

**次回開始番号**: TASK-0238

## Phase 151: tests ツリー non-null assertion ratchet 単調減少ラウンド 4（tests/unit 169 → 103）

**ステータス**: ✅完了（2026-08-20・TASK-0238 完了）

**背景**: REQ-337 の単調減少維持指令のラウンド 4。Phase 150 と同じ **guard-first survey**（AST census per-file 集計降順・手動列挙なし）の上位 7 ファイル 66 node（pipeline-quality-monitor 13・real-time-performance-monitor 11・pipeline-orchestrated-recovery-integration 10・bottleneck-detector 8・pipeline-run-recovery-integration 8・enhanced-error-recovery-extended 8・recovery-strategy-chain 8）を対象。同一根本クラス（optional 戻り値 `QualityMetrics | null`/`ChainStats | null`/`BottleneckInfo | null`・optional フィールド `metrics?.recoveryReport`・`.find()` キャプチャへの checker 抑制）を fail-loud helper 5 種（`requireDefined` ×3 ファイル・`requireTrend`・`requireWorstBottleneck`・`requireRecoveryReport`（cast 除去込み）・`requireStats`）で挙動保存・verdict 保存置換し 66 node → 0・**tests/unit pin 169 → 103・tests 合計 pin 794 → 728**。MW-017（rewrite への `!` 1 node 再注入で合計 ratchet 729 > 728 と dir ratchet 104 > 103 の 2 RED）で減少の機械強制を継続実証。

### タスク一覧

- [x] [TASK-0238: tests ツリー non-null assertion ratchet 単調減少ラウンド 4（tests/unit 169 → 103）](TASK-0238.md) - 3h (DIRECT) 🔵 ✅2026-08-20（66 node→0・pin 103/728・MW-017）

### 依存関係

```
TASK-0238 は REQ-337 の TESTS_DIR_PINS（TASK-0234）を Phase 148/149/150 に続き縮小側に更新
requireDefined は REQ-338/REQ-340 と同型・requireTrend/requireWorstBottleneck/requireRecoveryReport/requireStats は新規
MW 台帳（TASK-0228）に MW-017 追加・監査 pin ≥16 → ≥17
次候補: tests/unit 残 103 の継続縮小（census 次点: export/apng-encoder 7・monitoring/pipeline-metrics-collector 7・pipeline/pipeline-orchestrator-quality 7・quality/batch-operation-recovery 7・quality/error-recovery-health-tracker 7・quality/error-recovery-state-management 7）
```

### 信頼性レベルサマリー（Phase 151 追加分）

- 全 1 タスク 🔵（A150 残課題（unit 残 169 の継続縮小・census 次点 3 ファイル）+ REQ-337 の単調減少維持指令 + 実測（census guard 11 tests・対象 7 suite 193 tests GREEN・guards 全 75 suites 3171 tests GREEN・tsc 0・MW-017 mutant RED 2 failed）に出典）
- 推定工数: 3 時間

### 次フェーズ開始番号

**次回開始番号**: TASK-0239

## Phase 152: tests ツリー non-null assertion ratchet 単調減少ラウンド 5・tests/unit 外初回（integration 245 → 132・visualization 184 → 107）

**ステータス**: ✅完了（2026-08-20・TASK-0239 完了）

**背景**: steering が前回 iteration を VALUABLE 判定し「残 pin 728 の最大プールである tests/integration(245) と tests/visualization(184) を対象に単調減少を継続」を指令 — **unit 外ディレクトリ初回**。**guard-first survey**（AST census per-file 集計降順・手動列挙なし）上位 9 ファイル 190 node（phase32-quality-pipeline 38・batch 23・importance-scaler 21・secure-download-pipeline 20・flow-strategy 20・tree-strategy 18・complex-layout-engine 18・test_pipeline_health_smoke 17・label-sizing-pipeline 15）を対象。integration 側（optional `result.metrics`・null 戻り `getJobStatus(): BatchJobStatus | null`・download stage チェーン）と visualization 側（optional `PositionedNode.width|height` への算術・動的 import の definite-assignment `!:`）の 2 根本クラスを fail-loud helper 群（`requireMetrics` ×2・`requireJobStatus`/`requireCancelToken`/`requireStartedId`・`requireDefined<T>`・`requireTimingReport`/`requireHealthReport`/`requireCostComparison`（`NonNullable<T['field']>` で未 export 型を回避）・`findNode`/`findLayoutNode`・`requireModule`・`centerXOf`/`centerYOf`/`centerOf`（`?? Number.NaN` で旧 `width!` 算術の undefined→NaN 伝播を保存し matcher 型エラーも解消））で挙動保存・verdict 保存置換し 190 node → 0・**tests/integration pin 245 → 132・tests/visualization pin 184 → 107・tests 合計 pin 728 → 538**。MW-018（rewrite への `!` 1 node 再注入で合計 ratchet 539 > 538 と visualization dir ratchet 108 > 107 の 2 RED）で減少の機械強制を継続実証。

### タスク一覧

- [x] [TASK-0239: tests ツリー non-null assertion ratchet 単調減少ラウンド 5・tests/unit 外初回（integration 245 → 132・visualization 184 → 107）](TASK-0239.md) - 3h (DIRECT) 🔵 ✅2026-08-20（190 node→0・pin 132/107/538・MW-018）

### 依存関係

```
TASK-0239 は REQ-337 の TESTS_DIR_PINS（TASK-0234）を Phase 148〜151 に続き縮小側に更新（integration/visualization は初回縮小）
requireDefined/requireJobStatus は REQ-340/REQ-341 と同型・requireMetrics/requireCancelToken/requireStartedId/requireTimingReport/requireHealthReport/requireCostComparison/findNode/requireModule/centerXOf 系は新規
MW 台帳（TASK-0228）に MW-018 追加・監査 pin ≥17 → ≥18
次候補: tests 残 538 の継続縮小（census 次点: analysis/llm-cache-debounce 20・visualization/cycle-strategy 16・pipeline/improvement-detector 15・integration/pipeline-orchestrator-recovery 13・integration/export-artifact-pipeline-e2e 12）
```

### 信頼性レベルサマリー（Phase 152 追加分）

- 全 1 タスク 🔵（A151 残課題（unit 残 103）+ steering の integration/visualization 対象指令 + 実測（census + ledger guard 49 tests・対象パターン 13 suites 228 tests GREEN・tsc 0・full 742 suites 23,157 passed 0 failed・MW-018 mutant RED 2 failed）に出典）
- 推定工数: 3 時間

### 次フェーズ開始番号

**次回開始番号**: TASK-0240

## Phase 153: tests ツリー non-null assertion ratchet 単調減少ラウンド 6・4 ディレクトリ横断（analysis 44 → 13・pipeline 45 → 20・visualization 107 → 78・integration 132 → 107）

**ステータス**: ✅完了（2026-08-20・TASK-0240 完了）

**背景**: steering が ratchet 単調減少の継続を指令（tests/unit 0 到達時の 14 ディレクトリ pin → tests 全体 exact-0 pin 集約は unit 残 103 のため未発火）。対象選定を Phase 152 までの「ディレクトリ指定 + 降順上位」から **機械閾値「残存ファイルのうち node ≥ 10 を全数」** に切り替え、4 ディレクトリ横断 8 ファイル 110 node（llm-cache-debounce 20・cycle-strategy(root) 16・improvement-detector 15・cycle-strategy(strategies) 13・pipeline-orchestrator-recovery 13・export-artifact-pipeline-e2e 12・budget-alert-boundary 11・bottleneck-detector 10）を一括対象化。fail-loud helper 群（`requireDisk()`（null 戻り cache 読み・cachePath 付き throw）・`requireAlert(alerts, type)`（`BudgetAlert['type']` 引数）・`requireOpportunity(report, area)`（中間 verdict 保存）・`requireWorstBottleneck`/`requireStage`（Phase 151 同型再導入）・root 側構造型 `centerXOf`/`centerYOf` と strategies 側 `PositionedNode`/`LayoutEdge` **型付き** `findNode`/`findEdge`（`LayoutEdge.from: string | undefined` のため型付き必須・matcher 型エラー解消）・`requireMetrics` + `requireRecoveryReport`（旧 `as RunRecoveryReport` cast 解消）・`requireDefined<T>` ×2）で挙動保存・verdict 保存置換し 110 node → 0・**tests/analysis pin 44 → 13・tests/pipeline pin 45 → 20・tests/visualization pin 107 → 78・tests/integration pin 132 → 107・tests 合計 pin 538 → 428**。MW-019（rewrite への `!` 1 node 再注入で合計 ratchet 429 > 428 と pipeline dir ratchet 21 > 20 の 2 RED）で減少の機械強制を継続実証。

### タスク一覧

- [x] [TASK-0240: tests ツリー non-null assertion ratchet 単調減少ラウンド 6・4 ディレクトリ横断（analysis 44 → 13・pipeline 45 → 20・visualization 107 → 78・integration 132 → 107）](TASK-0240.md) - 3h (DIRECT) 🔵 ✅2026-08-20（110 node→0・pin 13/20/78/107/428・MW-019）

### 依存関係

```
TASK-0240 は REQ-337 の TESTS_DIR_PINS（TASK-0234）を Phase 148〜152 に続き縮小側に更新（analysis/pipeline は初回縮小）
requireDefined/requireWorstBottleneck/requireMetrics/requireRecoveryReport は REQ-340〜342 と同型・requireDisk/requireAlert/requireOpportunity/requireStage/findEdge/構造型 centerXOf は新規
MW 台帳（TASK-0228）に MW-019 追加・監査 pin ≥18 → ≥19
次候補: tests 残 428 の継続縮小（unit 残 103 が最大プール・node ≥ 10 全数閾は成立しなくなったため降順上位選定に戻る）
```

### 信頼性レベルサマリー（Phase 153 追加分）

- 全 1 タスク 🔵（A152 残課題（「tests 残 538 の継続縮小」）+ steering の単調減少継続指令 + 実測（census + ledger guard 51 tests・対象パターン 13 suites 247 tests GREEN・tsc 0 新規 error・full suite 0 failed・MW-019 mutant RED 2 failed）に出典）
- 推定工数: 3 時間

### 次フェーズ開始番号

**次回開始番号**: TASK-0241

## Phase 154: tests ツリー non-null assertion ratchet 単調減少ラウンド 7・transcription 初の dir exact-0 と空洞化チェック簡素化（guards 72 → 60・integration 107 → 71・visualization 78 → 61・pipeline 20 → 11・quality 17 → 9・transcription 8 → 0）

**ステータス**: ✅完了（2026-08-20・TASK-0241 完了）

**背景**: steering が ratchet 単調減少の継続を指令。「node ≥ 10 全数」機械閾値が枯渇したため選定を **guard-first survey 降順上位 10 ファイル**（6 ディレクトリ横断・90 node: edge-anchor-geometry-single-source 12・api 9・export-error-recovery-integration 9・export-retry-dlq-metrics-integration 9・pipeline-recovery-e2e 9・retry-observability-surface 9・layout-quality-composite 9・regression-detector 8・browser-transcriber 8・flowchart-strategy 8）に戻した。fail-loud helper 群（`requireNode`/`requirePoints`（map lookup・id/key 付き throw）・`requireJobStatus`（`BatchJobStatus | null`）・`requireDequeued`/`requireReplayed`（`dequeue(): … | undefined` と `replayDeadLetterJob` — DLQ エラーメッセージ検証は dequeued 再代入ループの undefined verdict を loop 内 null guard で保存）・`resolveRender` definite-assignment holder・`requireMetrics`/`requireRecoveryReport`/`requireStageTimings`（cast 除去）・`requireLoadedBaseline`（`NonNullable` 戻りで null 狭窄化 — 素の `Awaited<ReturnType<…>>` は TS18047）・`fireHandler`（`| null` handler 委譲）・`requireStage3Gate`/`requireCriterionResult`・typed `findNode` + superfluous `!` 除去 5 site（具象 class member は non-optional のため `!` 不要））で挙動保存置換し 90 node → 0・**tests/guards pin 72 → 60・tests/integration pin 107 → 71・tests/visualization pin 78 → 61・tests/pipeline pin 20 → 11・tests/quality pin 17 → 9・tests/transcription pin 8 → 0（tests 内初のディレクトリ exact-0）・tests 合計 pin 428 → 338**。transcription exact-0 の発火に合わせ空洞化チェック（TC-333-02 c）を hits 有無から **files 有無ベース（`testsDirsByFiles`）** に簡素化（bogus pin で RED 検証・未 pin dir throw は残存）。MW-020（rewrite への `!` 1 node 再注入で合計 ratchet 339 > 338 と transcription exact-0 1 > 0 の 2 RED）で減少の機械強制を継続実証。

### タスク一覧

- [x] [TASK-0241: tests ツリー non-null assertion ratchet 単調減少ラウンド 7・transcription 初の dir exact-0 と空洞化チェック簡素化（guards 72 → 60・integration 107 → 71・visualization 78 → 61・pipeline 20 → 11・quality 17 → 9・transcription 8 → 0）](TASK-0241.md) - 3h (DIRECT) 🔵 ✅2026-08-20（90 node→0・pin 60/71/61/11/9/0/338・MW-020）

### 依存関係

```
TASK-0241 は REQ-337 の TESTS_DIR_PINS（TASK-0234）を Phase 148〜153 に続き縮小側に更新（guards/quality は初回縮小）
requireJobStatus/requireMetrics/requireRecoveryReport/requireDequeued/findNode は REQ-340〜343 と同型・requireNode/requirePoints/requireReplayed/requireStageTimings/requireLoadedBaseline/requireByMetric/fireHandler/requireStage3Gate/requireCriterionResult は新規
MW 台帳（TASK-0228）に MW-020 追加・監査 pin ≥19 → ≥20
次候補: tests 残 338 の継続縮小（unit 残 103 が最大・次点 visualization 61・integration 71 — 全体 0 で 14 dir pin → tests exact-0 集約指令あり）
```

### 信頼性レベルサマリー（Phase 154 追加分）

- 全 1 タスク 🔵（A153 残課題（「tests 残 428 の継続縮小」）+ steering の単調減少継続指令 + 実測（census + ledger guard GREEN・対象パターン 17 suites 777 tests GREEN・tsc 0 新規 error（HEAD stash A/B）・full suite 0 failed・MW-020 mutant RED 2 failed）に出典）
- 推定工数: 3 時間

### 次フェーズ開始番号

**次回開始番号**: TASK-0242

## Phase 155: tests ツリー non-null assertion ratchet 単調減少ラウンド 8・node≥7 全数で tests/unit 残存最大層に初本格着手（guards 60 → 51・analysis 13 → 6・integration 71 → 50・unit 103 → 61・visualization 61 → 54）

**ステータス**: ✅完了（2026-08-20・TASK-0242 完了）

**背景**: steering が ratchet 単調減少の継続を指令。機械閾値を **「node ≥ 7 全数」** に引き下げて選定（該当 12 ファイル 86 node・5 ディレクトリ横断が降順上位と一致: node-extent-scan-single-source 9・llm-cache-stats-paths 7・export-job-lifecycle 7・export-security-e2e 7・secure-download-edge-cases 7・apng-encoder 7・pipeline-metrics-collector 7・pipeline-orchestrator-quality 7・batch-operation-recovery 7・error-recovery-health-tracker 7・error-recovery-state-management 7・dagre-layout-strategy 7）。**tests/unit（残存最大 103）に初めて本格着手**し 6 ファイル 42 node → 0・103 → 61。fail-loud helper 群（`requireExtents`（`foldNodeExtents` は空入力のみ null — 空入力 pin は保存）・`requireDisk`（`readCacheFile(): … | null`・Phase 153 同型）・`requireDequeued`/`requireArtifact`/`requireDownloadUrl`（`dequeue()`/`generateDownloadUrl()` の `| undefined` 戻りを wrap・直前の redundant `toBeDefined()` を throw に折りたたみ）・`requireChunk`/`requireStage`（chunk type 名・stage 名付き throw）・`QualityCall = Parameters<QualityMonitor['recordMetrics']>` + `requireQualityCall`（spy call 型を導出で解消）・`requireItemError`（`ItemResult<unknown>` — 素の ItemResult は TS2314・`ClassifiedError` は `@/quality/error-classifier` から直接 import）・`requireStageScore` + generic `requireBreaker<T>`（breaker Map value の member shape が site 毎に異なるため generic 必須）・typed `findNode` + `?? Number.NaN`（`PositionedNode.w` optional の undefined→failed-matcher verdict 保存）+ superfluous `!` 除去（`LayoutEdge.points` non-optional・R7 flowchart と同型））で挙動保存置換し 86 node → 0・**tests/guards pin 60 → 51・tests/analysis pin 13 → 6・tests/integration pin 71 → 50・tests/unit pin 103 → 61・tests/visualization pin 61 → 54・tests 合計 pin 338 → 252**。MW-021（rewrite への `!` 1 node 再注入で合計 ratchet 253 > 252 と visualization 55 > 54 の 2 RED）で減少の機械強制を継続実証。

### タスク一覧

- [x] [TASK-0242: tests ツリー non-null assertion ratchet 単調減少ラウンド 8・node≥7 全数 12 ファイルで tests/unit 残存最大層に初本格着手（guards 60 → 51・analysis 13 → 6・integration 71 → 50・unit 103 → 61・visualization 61 → 54）](TASK-0242.md) - 3h (DIRECT) 🔵 ✅2026-08-20（86 node→0・pin 51/6/50/61/54/252・MW-021）

### 依存関係

```
TASK-0242 は REQ-337 の TESTS_DIR_PINS（TASK-0234）を Phase 148〜154 に続き縮小側に更新（analysis は初回縮小）
requireDisk/requireDequeued/findNode は REQ-340〜344 と同型・requireExtents/requireArtifact/requireDownloadUrl/requireChunk/requireStage/QualityCall/requireItemError/requireStageScore/requireBreaker は新規（generic）
MW 台帳（TASK-0228）に MW-021 追加・監査 pin ≥20 → ≥21
次候補: tests 残 252 の継続縮小（unit 残 61 が最大・次点 visualization 54・integration 50 — unit 0 で 14 dir pin → tests exact-0 集約指令あり）
```

### 信頼性レベルサマリー（Phase 155 追加分）

- 全 1 タスク 🔵（A154 残課題（「tests 残 338 の継続縮小」）+ steering の単調減少継続指令 + 実測（census + ledger guard 2 suites 55 tests GREEN・対象パターン 14 suites 364 tests GREEN・tsc 0 新規 error・full suite 0 failed・MW-021 mutant RED 2 failed）に出典）
- 推定工数: 3 時間

### 次フェーズ開始番号

**次回開始番号**: TASK-0243

## Phase 156: tests ratchet 終了条件（end-of-ratchet gate）spec 化 + HealthCheckService.checkMemoryHealth の欠損 heapUsed/heapTotal NaN-routing 修正（義務 A 初履行・MW-022）

**ステータス**: ✅完了（2026-08-20・TASK-0243 完了）

**背景**: AI_HUB_MAKE_RUN_FEEDBACK が 8 ラウンドの `!` 置換を pure-ratchet で意思決定材料を増やしていないと判定。steering の修正指示「ratchet 終了条件を spec 化してから次イテレーションに入る」「次サイクルでは ratchet 継続ではなく実 production パスを少なくとも 1 件修正する」を受けた wiring。本ラウンドは **2 つの deliverable**:
1. **終了条件 spec 化**: `tests/unit exact-0` + `tests total ≤ 100` の 2 gate を `tests/guards/non-null-assertion-census.test.ts` に **opt-in `it.skip` で wiring**（GREEN 通過のまま残し、gate 到達後の manual unskip で初めて有効化 — AI_HUB rejection と同型の RED-as-normal を **opt-in によって構造的に回避**）。acceptance TC-342-01/02/03 を `acceptance-criteria.md` に追加、`tasks/TASK-0243.md` を新設。
2. **義務 A 初履行**: MW-014〜021 が `getMemoryUsage()` の heap field 欠損経路を `?? Number.NaN` で正規化していなかった（rss/external のみ・REQ-334）点と、`HealthCheckService.checkMemoryHealth()` が欠損を silent NaN-routing で critical 報告していた点を **実 production 修正**で harden。`if (typeof memoryUsage.heapUsed !== 'number' || typeof memoryUsage.heapTotal !== 'number')` を catch ブロック契約と mirror で追加し、`'Memory monitoring unavailable: backend omitted heapUsed/heapTotal'` を返す fail-loud 経路を投入。`tests/unit/monitoring/health-check-service.test.ts` に 2 件（完全欠損 + 部分欠損）の RED-verifying tests を追加。MW-022 として ledger に追記し、mutation `!==` → `===` 反転で `40 passed / 2 failed` の真のセマンティクス保存を実証。

### タスク一覧

- [x] [TASK-0243: tests ratchet 終了条件（end-of-ratchet gate）spec 化 + 実 production null-path 修正（HealthCheckService.checkMemoryHealth の欠損 heapUsed/heapTotal NaN-routing・REQ-347）+ MW-022 ledger 初履行](TASK-0243.md) - 2h (DIRECT) 🔵 ✅2026-08-20（TC-342 3 tests + src diff 1 site + 新規 test 2 件 + mutation RED 確認 + green 復元）

### 依存関係

```
TASK-0243 は TASK-0242（ratchet ラウンド 8）の上流 AI_HUB_MAKE_RUN_FEEDBACK を直接受けた対応
義務 A は MW ledger（MW-014〜021）から逆引きした src/ 側 caller 経路の harden
義務 B（architecture.md mirror 同期の spec build hook 化）は次サイクル obligation
revert 余裕: gate 通過後の manual unskip に同型の手順書を提供
```

### 信頼性レベルサマリー（Phase 156 追加分）

- 全 1 タスク 🔵（steering の AI_HUB_MAKE_RUN_FEEDBACK 2 項目を完全反映 + guard-first 実測 + mutation-verified）
- 推定工数: 2 時間

### 次フェーズ開始番号

**次回開始番号**: TASK-0244

## Phase 157: HealthCheckService.checkCacheHealth の non-finite/omitted hitRate NaN-routing 修正（義務 A 2 件目・MW-023・self-referential rate formula 拡張の fail-loud 化）

**ステータス**: ✅完了（2026-08-20・TASK-0244 完了）

**背景**: TC-342-02 で宣言された「次サイクル obligation」のうち、義務 A（実 production null-path 修正を少なくとも 1 件）の 2 件目。MW-022 が閉じた `HealthCheckService.checkMemoryHealth()` の heap field 欠損経路と隣接する `HealthCheckService.checkCacheHealth()` 経路を、memory の recurring-bug-classes.md "Self-referential rate/proportion formula"（Phase 142 commit 2428e472 が `intelligent-cache.updateHitRate` を閉じた live instance）の延長線上で hunt し、同一 silent corruption クラスを発見：`globalCache.getStats()` 戻り値の `stats.hitRate` / `stats.totalEntries` が backend omit / non-finite（例：`hitRate = NaN` を返す broken cache）のとき、`Math.round(undefined * N) = NaN` → `NaN / (NaN + NaN) = NaN` → `|| 0` で `0%` → "Cache is ineffective (0% hit rate)" → **unhealthy** を返し、`generateRecommendations` が "CRITICAL: Cache is ineffective - review caching strategy" を unknown observation window で emit する silent corruption。本ラウンドは **2 つの deliverable**:
1. **実 production 修正**: `src/monitoring/health-check-service.ts` の `checkCacheHealth()` 冒頭に `typeof stats.hitRate !== 'number' || typeof stats.totalEntries !== 'number' || !Number.isFinite(stats.hitRate) || !Number.isFinite(stats.totalEntries)` の 4 条件 OR ガードを追加し、MW-022 と同型の fail-loud 経路 `'Cache monitoring unavailable: backend returned non-finite or omitted metrics'` を投入。
2. **MW-023 ledger 登録**: `tests/guards/mutation-witness-ledger.test.ts` audit pin ≥21 通過継続（MW-023 追加で ledger 22 → 23 件）。`tests/unit/monitoring/health-check-service.test.ts` に 2 件（`hitRate = NaN` 完全欠損 + `hitRate/totalEntries` omit）の RED-verifying tests を追加。MW-022 と同型の mutation（4 条件すべてのオペランド反転）で `45 passed / 7 failed` の真のセマンティクス保存（=欠損/non-finite 時のみ degraded・妥当入力時は healthy/degraded/unhealthy の数値判定）を実証。`defaultCacheStats` には production-realistic な `hitRate: 0.6, totalEntries: 1000` を追加（修正前テスト全件が silent corruption で RED していた状態が finite input で解消する根拠）。

### タスク一覧

- [x] [TASK-0244: HealthCheckService.checkCacheHealth の non-finite/omitted hitRate NaN-routing 修正（REQ-348）+ MW-023 ledger 2 件目履行](TASK-0244.md) - 1h (DIRECT) 🔵 ✅2026-08-20（src diff 1 site + 新規 test 2 件 + mutation RED 確認 + green 復元 + ledger 1 エントリ追加）

### 依存関係

```
TASK-0244 は TASK-0243（Phase 156）の義務 A 2 件目として履行
MW-023 は MW ledger（MW-014〜022）の逆引きで intelligent-cache.ts getStats() 経路の self-referential rate formula を
  HealthCheckService caller 側で fail-loud 化（Phase 142 が intelligent-cache.ts 直で閉じた更新経路とは別の read path）
義務 B（architecture.md mirror 同期の spec build hook 化）は次サイクル obligation として残置
義務 C（ratchet 終了条件の gate 通過 — `tests/unit exact-0` + `tests total ≤ 100` — と manual unskip）は次サイクル obligation
```

### 信頼性レベルサマリー（Phase 157 追加分）

- 全 1 タスク 🔵（MW-022 と完全に同型の手法・mutation 4 条件反転で真逆セマンティクスを実証・test 52 件 GREEN 復元・ledger audit 48 件 GREEN 継続）
- 推定工数: 1 時間

### 次フェーズ開始番号

**次回開始番号**: TASK-0245

## Phase 158: HealthCheckService.checkPipelineHealth の欠損/non-finite successRate/avgProcessingTime NaN-routing 修正（義務 A 3 件目・MW-024）

**ステータス**: ✅完了（2026-08-20・TASK-0245 完了・specs 同期は Phase 161 に補填）

**背景**: TASK-0244 §残存 obligation の隣接 live silent-corruption 候補 3 件のうち最重要経路。`checkPipelineHealth()` は `realTimeMonitor.getSnapshot().pipeline` の `successRate` / `avgProcessingTime` を素読きし、`undefined > 0.95` / `NaN < 60000` がともに FALSE に化けて else 枝で "Pipeline is experiencing issues (NaN.0% success rate)" の fabricated unhealthy を `generateRecommendations` の CRITICAL 相当まで伝播させる silent corruption だった。typeof + Number.isFinite ガードで `'Pipeline monitoring unavailable: backend omitted successRate/avgProcessingTime'` を返す degraded path に fail-loud 化（commit 2ae7719a）。

### タスク一覧

- [x] [TASK-0245: HealthCheckService.checkPipelineHealth の欠損/non-finite successRate/avgProcessingTime NaN-routing 修正（REQ-349）+ MW-024](TASK-0245.md) - 1h (DIRECT) 🔵 ✅2026-08-20（src diff 1 site + 新規 test 2 件 + mutation RED 2/44 実測 + green 復元。MW-024 台帳登録は Phase 161 に補填）

### 依存関係

```
TASK-0245 は TASK-0244（Phase 157）の義務 A 3 件目として履行
MW-024 は MW-022/023 と同一 contract（realTimeMonitor.getSnapshot() 戻り値の素読み）の隣接 instance
義務 B（architecture.md mirror 同期の spec build hook 化）は次サイクル obligation として残置
```

### 信頼性レベルサマリー（Phase 158 追加分）

- 全 1 タスク 🔵（MW-022/023 と同型手法・mutation 反転で target RED 2 のみ・cascade なし = 2 メトリクス独立経路の実証）

### 次フェーズ開始番号

**次回開始番号**: TASK-0246

## Phase 159: HealthCheckService.checkLLMHealth の欠損/non-finite cacheHitRate NaN-routing 修正（義務 A 4 件目・MW-025・REQ-350）

**ステータス**: ✅完了（2026-08-20・commit 6d7a34e5・TASK-0246 ファイルは Phase 161 に補填）

**背景**: TASK-0244 §残存 obligation の 2 件目。`checkLLMHealth()` は `snapshot.llm.cacheHitRate` を素読みし、`cacheHitRate > 0.4` / `> 0.2` がともに FALSE に化け else 枝で "Llm integration may have issues (NaN% cache hit rate)" の fabricated unhealthy を CRITICAL recommendation まで伝播させる silent corruption だった。typeof + Number.isFinite ガードで `'LLM integration unavailable: backend omitted/non-finite cacheHitRate'` を返す degraded path に fail-loud 化。検証: 48/48 GREEN・mutation 反転で 2 tests RED cascade → revert 復元・guards 75 suites / 3185 tests・tsc 0 error。

### タスク一覧

- [x] [TASK-0246: HealthCheckService.checkLLMHealth の欠損/non-finite cacheHitRate NaN-routing 修正（REQ-350）+ MW-025](TASK-0246.md) - 1h (DIRECT) 🔵 ✅2026-08-20（src diff 1 site + 新規 test 2 件 + mutation RED 確認。TASK ファイル・REQ-350・TC-345・MW-025 台帳は Phase 161 に補填）

### 依存関係

```
TASK-0246 は TASK-0244（Phase 157）の義務 A 4 件目として履行
残候補は checkErrorRecoveryHealth のみ（Phase 161 / TASK-0247 で閉じる）
```

### 信頼性レベルサマリー（Phase 159 追加分）

- 全 1 タスク 🔵（MW-022〜024 と同型手法・mutation-verified）

### 次フェーズ開始番号

**次回開始番号**: TASK-0247（Phase 160 は refactor のため TASK 消費なし）

## Phase 160: HealthCheckService 4 checkXxxHealth ガード重複の isFiniteMetric<T> 述語への統合（MW-026・pure refactor）

**ステータス**: ✅完了（2026-08-20・commit f441e8d3・MW-026 台帳登録は Phase 161 に補填）

**背景**: REQ-347〜350（Phase 156〜159）で 3 サイトに投入した `typeof x !== 'number' || !Number.isFinite(x)` ガードの重複を、共通述語 `isFiniteMetric(value: unknown): value is number` に統合（`value is number` narrowing で arithmetic 直前の型再検査を除去）。`checkMemoryHealth` は backend 契約上 NaN 到達経路が無く `typeof !== 'number'` 単発を意図的に維持し helper docstring NOTE で意図差を明示。あわせて AI_HUB_MAKE_RUN_FEEDBACK への応答として EXECUTE gates（sync:edge --check exit 0・spine:validate SKIPPED gitignored・monitoring:validate exit 0・tsc exit 0）と "6 deleted no-inline tests" phantom-feedback の commit-trail note（cross-repo 汚染・isFiniteMetric が composite guard として同 surface を集約）を記録。

### タスク一覧

- （TASK 消費なし — pure refactor・Phase 161 の MW-026 台帳補填で述語反転 mutation `20 failed / 38 passed / 58 total` の一斉 RED を実測し chokepoint 保証）

### 依存関係

```
Phase 160 refactor は REQ-347〜350 のガード形状に依存（後方互換・pure refactor）
残義務 B（make sync:mirror-from-requirements）は Phase 161 / TASK-0247 §残存 obligation で DoD を concrete 化
```

### 信頼性レベルサマリー（Phase 160 追加分）

- pure refactor（48/48 + 397/397 monitoring unit + tsc 0 error・MW-026 は Phase 161 補填時に mutation-verified）

### 次フェーズ開始番号

**次回開始番号**: TASK-0247

## Phase 161: HealthCheckService.checkErrorRecoveryHealth の欠損/non-finite errorRate/recoverySuccessRate NaN-routing 修正（義務 A 5 件目・MW-027）+ Phase 158〜160 specs 債務の一括解消

**ステータス**: ✅完了（2026-08-20・TASK-0247 完了）

**背景**: TASK-0244 §残存 obligation の最後の 1 件。`checkErrorRecoveryHealth()` は `snapshot.errors` の `errorRate` / `recoverySuccessRate` を素読きし、閾値チェーンの NaN/undefined オペランド比較が FALSE に化けて fabricated verdict（実測: "Error recovery is degraded (NaN% error rate, 90.0% recovery rate)" / "(2.0% error rate, NaN% recovery rate)"）を伝播させる silent corruption だった。`isFiniteMetric` ガードで fail-loud 化し **checkXxxHealth 系の未ガード metric read を全完**。本ラウンドは **3 つの deliverable**:
1. **実 production 修正（TC-346 / REQ-351 / MW-027）**: 修正前 RED 実測（fabricated message 2 種）→ guard → 58/58 GREEN・mutation 反転で `7 failed / 51 passed / 58 total`（MW-022/023 と同一 signature）→ revert 復元（commit 136e5f65）
2. **Phase 158〜160 specs 債務の一括解消**: REQ-346〜350 の requirements.md 未登録・TC-344/345 の AC 未登録・TASK-0246.md 未作成・MW-024/025/026 の台帳未登録・overview Phase 158〜160 未記載を一括補填。MW-024〜026 は再実行で observed を取得（11 / 8 / 20 failed @ 58-test baseline）
3. **ledger 監査 pin ≥21 → ≥27**: MW-024〜027 補填で ledger 23 → 27 エントリ・`tests/guards/mutation-witness-ledger.test.ts` pin 引き上げ（56/56 GREEN）

### タスク一覧

- [x] [TASK-0247: HealthCheckService.checkErrorRecoveryHealth の欠損/non-finite errorRate/recoverySuccessRate NaN-routing 修正（REQ-351）+ MW-027 + Phase 158〜160 specs 補填](TASK-0247.md) - 1.5h (DIRECT) 🔵 ✅2026-08-20（src diff 1 site + 新規 test 2 件 + mutation RED 7/51 実測 + ledger 4 エントリ + 監査 pin 引き上げ + specs 一括補填）
- [x] [TASK-0246: HealthCheckService.checkLLMHealth の NaN-routing 修正（REQ-350・Phase 159 実装分）の TASK 化補填](TASK-0246.md) - 0.5h (DOCS) 🔵 ✅2026-08-20（TASK-0246.md 新設 + REQ-350 / TC-345 / MW-025 補填）

### 依存関係

```
TASK-0247 は TASK-0244（Phase 157）の義務 A 5 件目として履行 — これで checkXxxHealth 系は全完
MW-024〜026 補填は Phase 158〜160 commit が台帳登録を怠っていた債務の解消（ledger 更新ルール 1 の遡及適用）
義務 B（make sync:mirror-from-requirements）は TASK-0247 §残存 obligation で DoD を concrete 化
  （Makefile 不在・_doc_spine.yml は auto-gen gitignored・architecture.md は手書き prose → marker 契約先行の設計順序を明記）
```

### 信頼性レベルサマリー（Phase 161 追加分）

- 全 2 タスク 🔵（修正前 RED 実測 + mutation signature 一致 + 監査 pin 引き上げ実測 + 債務補填の全範囲を table 化）

### 次フェーズ開始番号

**次回開始番号**: TASK-0248

## Phase 162: HealthCheckService NaN-routing fail-loud 化の generateRecommendations・checkLiveness 横展開（REQ-352〜354・MW-028〜030）

**ステータス**: ✅完了（2026-08-20・TASK-0248 完了・**実装 + specs を単一 commit に同梱**）

**背景**: AI_HUB_MAKE_RUN_FEEDBACK の横展開指示。checkXxxHealth 系全完（Phase 158〜161）を受け、`realTimeMonitor.getSnapshot()` の consumer 全数（useAdminAnalytics・adaptive-quality-gates・checkPerformanceHealth・API verdict 層を含む）を scan し 3 hit を fail-loud 化:
1. **generateRecommendations memory ゲート（REQ-352）**: `memoryUsagePercent > 85` の FALSE 化で CRITICAL escalation が「高くない」と区別不可能のまま silent suppress
2. **generateRecommendations pipeline ゲート（REQ-353）**: `activeRequests > 10` の同一パターンで scaling 推奨が silent suppress
3. **checkLiveness の fabricated dead verdict（REQ-354）**: `alive = latency < 1000 && heapUsed > 0` の連言で heapUsed 欠損時に **latency 正常でも alive=false**・reason は常に latency を名指し（GET /health/live 消費者で restart 誘発）

no-hit の根拠（p95 は recordMetric の sanitizeFinite chokepoint・checkPerformanceHealth は trend 文字列のみ・API verdict は PerformanceDashboard 別 chain）と deferred 候補（adaptive-quality-gates の sticky threshold 汚染・PerformanceDashboard `cacheHitRate || 0`）は TASK-0248.md §scan 結果に table 化。

### タスク一覧

- [x] [TASK-0248: HealthCheckService generateRecommendations/checkLiveness の NaN-routing fail-loud 横展開（REQ-352〜354）+ MW-028〜030](TASK-0248.md) - 1.5h (DIRECT) 🔵 ✅2026-08-20（src diff 3 site + 新規 test 7 件 + 修正前 RED 5/60 実測 + mutation 3/2/2 failed 実測 + 監査 pin ≥27→≥30 + REQ/TC/TASK/MW/overview を同一 commit 同梱）

### 依存関係

```
TASK-0248 は Phase 158〜161（REQ-347〜351）の isFiniteMetric パターンを getSnapshot consumer 全数へ横展開
  — checkXxxHealth 系の policing は限界収穫という steering の判断どおり consumer scan ベースに移行
Phase 158〜160 の教訓（specs 同期の分離が債務化）を受け、本 Phase から実装 + specs を単一 commit に同梱
  （link:spine は本 repo に不存在 — ai-hub 側 script。相当物 = overview.md の同 commit 更新）
義務 B（marker 契約）は TASK-0248 §残存 obligation に引き続き最優先として明記
```

### 信頼性レベルサマリー（Phase 162 追加分）

- 全 1 タスク 🔵（scan 結果の全 consumer table 化 + 修正前 RED 5 件実測 + MW 3 エントリの mutation observed 実測 + pin 引き上げ GREEN 62/62）

### 次フェーズ開始番号

**次回開始番号**: TASK-0249

## Phase 163: specs mirror marker 契約の定義と guard による機械強制（REQ-355・義務 B 前半・MW-031）

**ステータス**: ✅完了（2026-08-20・TASK-0249 完了・実装 + specs を単一 commit に同梱）

**背景**: TASK-0243 §義務 B（requirements.md 正本 ↔ architecture.md mirror の手作業 sync の機械化）のうち、TASK-0247 が固定した DoD の「marker 契約先行」を履行。Phase 158〜161 の specs 債務（同期分離で台帳に穴）と ai-hub link:spine drift（正典 child 追加時の children ブロック再生成が作業 commit から漏れる）はともに「sync 状態が機械検査されていない」ことが根因 — 契約 + `tests/guards/` による CI 強制を先行させ、generator（義務 B 後半・TASK-0250）の出力受入検証に使う。

**成果物**:
1. mirror marker 契約（`<!-- mirror:<正本>#<節>:start tokens="…" -->` … `:end`）を定義し architecture.md §非機能要件の実現方法 に適用（10 トークン双方向 verbatim 検証）
2. `tests/guards/specs-mirror-contract.{ts,test.ts}` — 純関数 parser/validator + 12 tests（real tree zero-violation・presence pin・fixture 10 種 = mirror/source 両 drift・孤立・nest・空 region・欠落・節抽出完全一致）
3. MW-031: mirror 内 `60秒以内` → `90秒以内` 変異で **1 failed / 11 passed** 実測 + revert GREEN 復元・監査 pin ≥30→≥31・ledger guard target regex `(src|tests)` → `(src|tests|specs)` 拡張
4. steering 指示の getSnapshot scan は Phase 162 実施済みを再確認（PerformanceDashboard chain は finite-by-construction で no-hit と close — TASK-0249.md §steering 指示への対応 に table 化）

### タスク一覧

- [x] [TASK-0249: specs mirror marker 契約の定義と guard による機械強制（REQ-355・義務 B 前半・MW-031）](TASK-0249.md) - 1.5h (DIRECT) 🔵 ✅2026-08-20（guard 12 tests + MW-031 mutation observed 実測 + pin ≥30→≥31 + REQ/TC/TASK/MW/overview を同一 commit 同梱）

### 依存関係

```
TASK-0249 は TASK-0243 §義務 B の前半（marker 契約）— TASK-0247 が固定した DoD の順序どおり契約を先行
義務 B 後半（TASK-0250）: sync-mirror-from-requirements generator + npm script + manifest hook 配線
  — 本 guard が generator 出力の受入検査になる（契約固定により generator は region 再生成のみに専念可）
mirror 対象は「真の mirror」のみ（信頼性レベル分布↔サマリーは母集団が違う・技術的制約は PIPELINE_FLOW.md 出典）— 偽 sync を避ける設計判断
```

### 信頼性レベルサマリー（Phase 163 追加分）

- 全 1 タスク 🔵（契約適用前に 10 トークン両側 verbatim 存在の手動検証 + real-tree/fixture/presence pin の 3 層 test + MW-031 observed 実測）

### 次フェーズ開始番号

**次回開始番号**: TASK-0250

## Phase 164: specs mirror sync generator と sync-stamp 契約 + gate 配線（REQ-356・義務 B 後半・MW-032）

**ステータス**: ✅完了（2026-08-20・TASK-0250 完了・実装 + specs を単一 commit に同梱）

**背景**: TASK-0249 §残存 obligation の指定どおり義務 B 後半に着手。prose は機械生成できないため region 全体の verbatim copy 化（= 偽 sync・guard 検出力ゼロ）ではなく **所有権分割** で解いた: marker 行 / tokens / prose = 人間所有（TASK-0249 契約は不変）、region 内の sync-stamp 行 1 行 = generator 所有。stamp は正本節の正規化 sha256（先頭 12 hex）で、tokens に宣言されていない事実編集も含む正本節への **あらゆる** 編集を `STALE_SYNC_STAMP` として検出する。

**成果物**:
1. `tests/guards/specs-mirror-contract.ts` — `computeSourceDigest` / `renderSyncStamp` + stamp 検証（MISSING / DUPLICATE / STALE の 3 violation kind）。generator も同一 module を import し契約の単一ソースを維持
2. `scripts/sync-mirror-from-requirements.ts`（新規）— dual-mode generator（repo の `sync:edge`/`verify:edge` 慣行に準拠）: `--check` = 書き込まない drift detector / default = stamp 再生成 → post-sync 検証で人手 curation 済みでない token drift があれば exit 1。構造違反ファイルは一切書き換えない fail-loud・冪等
3. npm scripts `specs:mirror:check` / `specs:mirror:sync` + `verify:all` と `spine:validate`（`scripts/validate-spine-manifest.ts` CLI）への hook 配線 — manifest が gitignored auto-gen で SKIPPED でも specs/ は tracked なので clean checkout / CI で gate が実 teeth
4. `tests/guards/specs-mirror-contract.test.ts` 12 → **23 tests**（stamp fixture 5 + generator 6・最終 test「generator output passes the full contract validation」= 受入検査）
5. MW-032: requirements.md NFR-501 `$0.10 以下` → `$0.11 以下`（非 token 編集）で **1 failed / 22 passed**（STALE_SYNC_STAMP のみ・TOKEN_MISSING なし = stamp 検出力の isolate 実証）・check exit 1 → sync 修復 → revert GREEN 復元・監査 pin ≥31→≥32

### タスク一覧

- [x] [TASK-0250: specs mirror sync generator と sync-stamp 契約 + gate 配線（REQ-356・義務 B 後半・MW-032）](TASK-0250.md) - 1.5h (DIRECT) 🔵 ✅2026-08-20（generator 6 tests + stamp fixture 5 tests + MW-032 observed 実測 + pin ≥31→≥32 + REQ/TC/TASK/MW/overview を同一 commit 同梱）

### 依存関係

```
TASK-0250 は TASK-0249 契約（REQ-355）の上に立つ後半 — 契約モジュールを scripts から import する単一ソース構造
義務 B は本 Phase で完了（marker 契約 + guard → generator + sync-stamp + gate 配線）
残存: 義務 C（tests/unit exact-0 + tests total ≤ 100 gate）・adaptive-quality-gates non-finite 対応・mirror 対象拡張（marker 追加時に stamp は sync script が自動挿入）
運用: 正本節を更新する commit は npm run specs:mirror:sync を同 commit で実行（steering の link:spine drift 指摘と同型の規律）
```

### 信頼性レベルサマリー（Phase 164 追加分）

- 全 1 タスク 🔵（generator/stamp の unit test 23 + 受入検査 test + MW-032 observed 実測 + check CLI の exit code 検証）

### 次フェーズ開始番号

**次回開始番号**: TASK-0251


## Phase 165: 義務 C 第1ゲート tests/unit exact-0 — 残存全 21 ファイル 61 ノード一括撲滅（REQ-357・MW-033）

**ステータス**: ✅完了（2026-08-20・TASK-0251 完了・実装 + specs を単一 commit に同梱）

**背景**: TASK-0243 定義の義務 C（`tests/unit exact-0` + `tests total ≤ 100` の 2 gate）のうち第1ゲート。ratchet ラウンド 1〜8（Phase 148〜155）で tests/unit 471 → 61 まで減り、閾値選別（≥10 → ≥7）は枯渇 — 本ラウンドは guard-first survey で残存 **全数**（21 ファイル / 61 ノード）を一括撲滅する。

**実装**:

- 置換は Phase 148/149 確立の fail-loud idiom: `requireDefined(value, label)` ×14 ファイル（find/dequeue/getBaseline/optional field/null 戻り・label 付き throw で RED verdict が欠損名を名指し）・`fireCapturedResolver(fn, label)`（export-retry-lifecycle の Promise executor 捕捉 resolver 6 宣言を `(() => void) | undefined` 型に widen）・`act()` コールバック内 definite-assignment の `| undefined` 型 + 即 guard（use-framework-pipeline）・env truthy-ternary の const capture（cors-config）・`expect(x).toHaveLength(1)`（async-resource-cleanup）
- **挙動保存の実証（GOTCHA）**: nullable-access-null-guard の `(scenes?.length ?? 0) === 0` は null も拾う — `=== undefined` のみの等価置換は null 入力 3 RED（`Cannot read properties of null`）。`=== null || === undefined` 両チェックで原本挙動（null → return 0）を保存し 31/31 GREEN
- census pin: `TESTS_DIR_PINS.unit` 61 → **0**（transcription に次ぐ 2 番目の dir exact-0・files-based 空洞化チェックで pin 有効）・tests total 252 → **191**・履歴 comment に round 9 エントリ
- MW-033: mutation（`expect(cached.status)` → `expect(cached!.status)`・health-check-service.test.ts:761）で **unit ratchet（Received: 1・expected ≤ 0）と total ratchet（Received: 192・expected ≤ 191）の同時 RED** `2 failed / 9 passed / 11 total` 実測 → revert GREEN 復元・監査 pin ≥32 → ≥33

**タスク**:

- [x] [TASK-0251: 義務 C 第1ゲート tests/unit exact-0 — 残存全 21 ファイル 61 ノード一括撲滅（REQ-357・MW-033）](TASK-0251.md) - 2h (DIRECT) 🔵 ✅2026-08-20（触 21 suite 826 tests + census 11/11 + guards 76/3226 GREEN・tsc 0・MW-033 同時 RED 実測 + pin ≥32→≥33 + REQ/TC/TASK/MW/overview を同一 commit 同梱）

```
義務 C は第1ゲート（tests/unit exact-0）を通過 — 残り第2ゲート tests total ≤ 100（現状 191・guards 51/visualization 54/integration 50 が次の層）
`?.`/`??` → guard 置換は null と undefined の両方を見る（片側だけだと原本より検出力が落ちる）
steering の getSnapshot consumer 横展開指示は Phase 162（e9fb26fb）で実施済み — 本 Phase は TASK-0250 §残存 obligation の指定どおり義務 C に着手
```

### 信頼性レベルサマリー（Phase 165 追加分）

- 全 1 タスク 🔵（fail-loud 置換後の全 suite GREEN + census pin 引き下げ + MW-033 同時 RED 実測）

### 次フェーズ開始番号

**次回開始番号**: TASK-0252


## Phase 166: memory-backend 出力契約（finite or null）— getSnapshot 欠損シグナルの根源集約（REQ-358〜360・MW-034）

**ステータス**: ✅完了（2026-08-21・TASK-0252 完了・実装 + specs を単一 commit に同梱）

**背景**: steering 主要指示（強調のため prompt に二重記載）—「NaN 対策を各消費側 3 層で個別 routing した状態から、根源の getSnapshot/メモリバックエンドに『常に有限値 or 明示 null』の出力契約を設け、消費側の isFiniteMetric ガードを 1 箇所の契約検証に集約せよ。多層 fail-loud は一時的に正しいが、同じ欠損シグナルの再発を防ぐには source 側契約とその検証テストが要る」。Phase 157〜162 の消費側個別 guard は実際に再発を許した（adaptive-quality-gates の `null < 85` silent-pass・`null.toFixed(2)` crash = TASK-0248 残存 obligation）。

**実装**:

- 新設 `src/monitoring/memory-backend.ts`: `MemoryBackendReading` 全フィールド「有限数 or 明示 null」（undefined/NaN/±Infinity 禁止・`finiteOrNull` マッパー）+ 派生 helper（heapUsagePercentOrNull/Rounded・mbRoundedOrNull — canonical 委譲を集中し canon guard pin もここに移動）
- getSnapshot system メモリ派生 4 field を `number | null` に（欠損は field 単位 null 伝播・zero-fallback 実測は 0 保存）
- 消費側集約: adaptive-quality-gates（null → gate FAIL + METRIC UNAVAILABLE・baseline seeding skip）・health-check-service（`=== null` + pin 済み message・rss/external NaN marker → null）・main-pipeline 2 site・load-balanced-executor（zero-fallback 0 ドキュメント済み）・performance-dashboard（Phase 145 pin の null→NaN 写像は唯一の例外として明示維持）
- 契約検証集約: memory-backend-contract 10 tests（7 shape アドバーサル sweep 含む）+ null 伝播 6 tests + gate UNAVAILABLE 4 tests・canon 2 suite pin 更新
- MW-034: 3 独立 mutation（`?? 0` 戻し → 3 failed/6・finiteOrNull 素通し → 7 failed/10・gate `=== null`→`=== undefined` → 3 failed/47）各 revert GREEN 復元・監査 pin ≥33 → ≥34

**タスク**:

- [x] [TASK-0252: memory-backend 出力契約（finite or null）— getSnapshot 欠損シグナルの根源集約（REQ-358〜360・MW-034）](TASK-0252.md) - 3h (DIRECT) 🔵 ✅2026-08-21（触 18 suites/367 tests + sibling 15/308 + guards 76/3230 GREEN・tsc 0・MW-034 3 mutation RED 実測 + pin ≥33→≥34 + REQ/TC/TASK/MW/overview を同一 commit 同梱）

```
source 側契約なしの消費側 guard は再発を防がない — 実証: adaptive-quality-gates は無ガード読みで null<85 silent-pass していた
null 強制変換の 2 毒: null < 85 → true（silent gate PASS）と null.toFixed(2) → TypeError crash — 契約は両方を `=== null` 分岐で塞ぐ
zero-fallback {0,0} は実測（null と区別）・isFiniteMetric は defense-in-depth として維持（isFiniteMetric(null)===false で null は正しく unavailable 経路）
残存: 義務 C 第2ゲート tests total ≤ 100（191・guards 51/visualization 54/integration 50）・snapshot 型変更の test ツリー追従
```

### 信頼性レベルサマリー（Phase 166 追加分）

- 全 1 タスク 🔵（契約テスト 10 + null 伝播 6 + gate 4 tests GREEN + MW-034 3 独立 mutation RED 実測）

## Phase 167: 義務 C 第2ゲート guards・visualization・integration exact-0 — 残存全 57 ファイル 155 ノード一括撲滅（REQ-361・MW-035）

**ステータス**: ✅完了（2026-08-21・TASK-0253 完了・実装 + specs を単一 commit に同梱）

**背景**: steering 主要指示 —「義務 C の残りディレクトリ（integration 50・visualization 54・guards 51）の exact-0 化を進める。cors-config 型の単純置換ではなく fireCapturedResolver/requireDefined 型の fail-loud idiom を用い、各段階で MW-033 と同じ再注入 mutation で ratchet の実効性を実測して ledger に残せ」。第1ゲート（unit exact-0・Phase 165）に続く第2ゲート（tests total ≤ 100）を 3 dir 全数撲滅で通過。

**実装**:

- guards 20 ファイル 51 → 0（inline regex-match null guard・resolver holder・`V2CaseEdge` typed fixture・concrete method 直接呼び出し・requireEdge helper・ledger guard throw）
- visualization 17 ファイル 54 → 0（`requireTopology`/`requireNode` helper・labeled find guard・`?? Number.NaN` 寸法伝播保存・`strategy.validateInputs(` 直接呼び出し）
- integration 20 ファイル 50 → 0（typed-errors 5 ファイル同一 guard・typed metrics field の cast 削除 guard 読み・typeof narrow 化 `Number.isFinite` 三項・fixture 配列の vestigial bang 削除・`.catch()` 捕捉の initializer なし holder）
- census pin: 3 dir → 0・total 191 → **36**（第2ゲート ≤ 100 通過・残存 pipeline 11/quality 9/analysis 6/他 10）
- MW-035: 3 mutation（3 dir 各 1 `!` 再注入）で dir ratchet 0→1 と total 36→37 の同時 RED 実測・監査 pin ≥34 → ≥35

**タスク**:

- [x] [TASK-0253: 義務 C 第2ゲート guards・visualization・integration exact-0（REQ-361・MW-035）](TASK-0253.md) - 3h (DIRECT) 🔵 ✅2026-08-21（guards 20/447 + visualization 17/1197 + integration 20/833 GREEN・tsc 新規 0・MW-035 3 mutation 同時 RED 実測 + pin ≥34→≥35 + REQ/TC/TASK/MW/overview を同一 commit 同梱）

```
`.catch()` コールバック捕捉変数は initializer なし `| undefined` holder — `= null` は CFA で全 read を never 狕化（alias も initializer が優勝・実測 TS2339）
typed optional field の `x!.f as T` は `x?.f` + guard で cast ごと削除（field が typed なら cast は最初から不要）
残存 36 = pipeline 11・quality 9・analysis 6・他 10 — 全 dir exact-0 で manual unskip gate（TC-342）発火
```

### 信頼性レベルサマリー（Phase 167 追加分）

- 全 1 タスク 🔵（3 dir 計 57 suites / 2477 tests GREEN + census 11/11 + MW-035 3 独立 mutation 同時 RED 実測）

### 次フェーズ開始番号

**次回開始番号**: TASK-0254


## Phase 168: 義務 C 最終ゲート 残存 9 ディレクトリ 36 ノード撲滅 + 全 pin 集約 + ratchet 終了条件 active 化（REQ-362・MW-036）

**ステータス**: ✅完了（2026-08-21・TASK-0254 完了・実装 + specs を単一 commit に同梱・**義務 C 完結**）

**背景**: TASK-0243 が定義した義務 C の最終段階 — 第1ゲート（unit exact-0・Phase 165）・第2ゲート（total ≤ 100・Phase 167）通過後の残存 36 ノードを全数撲滅し、TASK-0243 が予告した「14 ディレクトリ個別 pin → tests 全体 exact-0 pin 集約」と ratchet 終了条件 3 ケース（TC-342-01 で it.skip 予定だったが guard 未実装のままだった — `git log -S "stillRoom" -- tests/` 空）の active 化を 1 commit に閉じる。

**実装**:

- 残存 9 dir 14 ファイル 36 ノード → 0（pipeline 11・quality 9・analysis 6・api 2・lib 2・remotion 2・(root) 2・acceptance 1・config 1）
- fail-loud idiom: `requireCriterionResult`/`requireRecommendation`/`requireWorstBottleneck`/generic `requireBreaker<T>`/`requireMatch<T>`/`requireCodePoint` のファイル内 helper・optional field の one-shot narrowing guard・冗長 `toBeDefined`/`not.toBeNull` の labeled throw 畳込み
- census pin 集約: `TESTS_DIR_PINS` 14 エントリ全て 0・`PINNED['tests (excl. __mocks__)']` 36 → **0** — **src と tests の両 tree が exact-0**
- 終了条件 3 ケースを active 形式で guard に実装（total ≤ 100 / unit = 0 / `stillRoom === false`）— 「manual unskip 登火」の実体
- vacuity check 入れ替え: 両 tree 0 で `count > 0` check は恒常 RED 化するため `countInText` を切り出し、`x!`/`x!:` 2 hit + string/comment 内 decoy 非カウントの fixture liveness test に置換
- MW-036: 4 mutation（pipeline/quality/analysis/(root) 各 1 `!` 再注入）で dir ratchet 0→1 と total 0→1 の同時 RED 実測・監査 pin ≥35 → ≥36

**タスク**:

- [x] [TASK-0254: 義務 C 最終ゲート 残存 9 ディレクトリ 36 ノード exact-0 + 全 pin 集約 + ratchet 終了条件の active 化（REQ-362・MW-036）](TASK-0254.md) - 3h (DIRECT) 🔵 ✅2026-08-21（触 14 ファイル 16 suites / 3216 tests GREEN・guards 76 suites GREEN・tsc baseline 14 不変・MW-036 4 mutation 同時 RED 実測 + pin ≥35→≥36 + REQ/TC/TASK/MW/overview を同一 commit 同梱）

```
終了条件は it.skip→manual unskip でなく active GREEN として直接実装 — 両ゲート通過済みなら skip 儀式は RED-as-normal-state を生まない dead weight
両 tree 0 で旧 vacuity check（count > 0）は恒常 RED — counting を countInText に切り出し fixture liveness（decoy 非カウント）で置換
新規 `!` は dir ratchet × total ratchet（src なら + whole-src pin）の 3 重即 RED — ratchet 系の残は tsconfig.test baseline 14 のみ
```

### 信頼性レベルサマリー（Phase 168 追加分）

- 全 1 タスク 🔵（触 16 suites / 3216 tests + guards 76 suites / 3241 tests GREEN + census 14/14 + MW-036 4 独立 mutation 同時 RED 実測）

### 次フェーズ開始番号

**次回開始番号**: TASK-0255


## Phase 169: tests tree strict lock-in 完結 — tsconfig.test baseline 14 → 0 + type-check:tests CI gate 化（REQ-363・MW-037）

**ステータス**: ✅完了（2026-08-21・TASK-0255 完了・実装 + specs を単一 commit に同梱・**TASK-0224 の strict lock-in 完結**）

**背景**: TASK-0224（tsconfig.test.json から strict 系 false 削除・真 baseline 156 露出）以降 Phase 148〜168 の `!` 撲滅で 14 まで減少していた tests tree の tsc error が (1) 残存したまま (2) CI type-check job は `tsconfig.app.json`（src のみ）しか検査しないため **CI から不可視** だった。義務 C 完結後の ratchet 系残件は本項のみ（TASK-0254 §残存 obligation 筆頭）。

**実装**:

- baseline 14 → **0**（3 家系）: (a) closure 内のみ代入の holder への `= null` initializer 再剔除（`open`・`captured`・`receivedReport`）— `= null` は CFA を null 狭化に固定し TS2339×3/TS18047×6・initializer なしだけでは宣言型に undefined が無いと TS2454 が発火（Phase 168 `.catch()` holder idiom の完結形: **initializer なし + 宣言型に `undefined`**）(b) requireDefined を `T | null | undefined` に widen（pipeline-health-score・null 素通しの潜在穴も同時閉塞）(c) census checker は `import type * as TS` で型のみ静的 import（CJS 読み込みは createRequire 維持）+ `isParameter` 分岐除去 — parameter `!:` は TS1005/TS1138 parse error で言語仕様上存在せず実行時も常に非カウントの dead detector だった
- CI gate 配線: `package.json` に `type-check:tests` 追加・ci.yml type-check job 同一 step で実行（elapsed 両方込み・実測 23.5s ≪ 480s 予算）— baseline 14 回帰が main push/PR で捕捉される
- MW-037: 3 mutation（`= null` 再注入 ×2・requireDefined 狭化復帰）で 4+3+2 error の独立 RED 実測 → revert 0 error GREEN 復元・監査 pin ≥36 → ≥37

**タスク**:

- [x] [TASK-0255: tsconfig.test baseline 14 → 0 + type-check:tests CI gate 化（REQ-363・MW-037）](TASK-0255.md) - 2h (DIRECT) 🔵 ✅2026-08-21（tsc 両 config 0・検証 pattern 9 suites / 234 tests + guards 76 suites / 3241 tests GREEN・MW-037 3 mutation 独立 RED 実測 + pin ≥36→≥37 + REQ/TC/TASK/MW/overview を同一 commit 同梱）

```
closure 内のみ代入の holder: `= null` は CFA null 固定（TS2339/TS18047）・initializer なしだけでは TS2454 — 「initializer なし + 宣言型に undefined」が完結形
ParameterDeclaration に exclamationToken は無い — parameter `!:` は TS1005/TS1138 parse error。実行時常に非カウントの分岐は dead detector なので除去が正解
CI type-check job が src しか見ない間は tests tree baseline は不可視 — 撲滅と同時に gate 配線しないと再び静かに増える
```

### 信頼性レベルサマリー（Phase 169 追加分）

- 全 1 タスク 🔵（検証 pattern 9 suites / 234 tests + guards 76 suites / 3241 tests GREEN + tsc 両 config 0 + MW-037 3 独立 mutation RED 実測）

## Phase 170: L3 hunt #1 — RTPM 捏造 quality/LLM-timing メトリック撲滅（REQ-364・MW-038）

**ステータス**: ✅完了（2026-08-21・TASK-0256 完了・実装 + specs を単一 commit に同梱・**memory L3 台帳 hunt-order #1 の live instance 解消**）

**背景**: steering は「ratchet 系自己言及的 churn をやめ次の義務へ」（具体的な T0244/freeze-guard 指定は cross-repo contamination — `specs/task-0244-test-inventory-ratchet/` は trans_parency_os_private repo のパス）。TASK-0255 §残存 obligation と memory L3 台帳が指定する hunt-order #1「**0.85 metric-DEFAULT coupled-to-GATE-threshold**」を hunt し、`getSnapshot()` の producer-less quality/LLM-timing 5 field（捏造定数 0.90/0/0.85/0/0・「Populated externally」だが populate する producer は repo 内に存在しない）が adaptive-quality-gates の blocker 2 gate（Transcription Accuracy gte 0.85・Layout Overlap Rate eq 0）+ major 1 gate（LLM Response Time lt 15000）を**恒久 green** にし、adaptable gate の閾値適応を捏造 0.90 で汚染している実欠陥を特定。

**実装**:

- REQ-358〜360（Phase 166）の finite-or-null 契約を当該 5 field に拡張: `PerformanceSnapshot` 型 `number | null` + producer 明示 null（no reading）。gate の無い display-only accumulator（flashUsagePercent/proUsagePercent/estimatedCostSavings・cpuUsagePercent）は 0 のまま契約境界不変
- 消費側は既存機構に乗るのみ: `evaluateGate` METRIC UNAVAILABLE fail-loud（REQ-360）+ `updateAdaptiveThresholds` null skip。消費側は事前全数列挘（AdminAnalyticsDashboard は pipeline.p95 のみ・generateRecommendations は system.memoryUsagePercent のみ）
- MW-038: 2 mutation（producer 捏造定数再注入 → 契約 test `Received: 0.9` RED・extractor `?? 0.90` silent-pass 再注入 → blocker gate `Expected: false / Received: true` 含む 3 failed RED）の独立 RED 実測 → revert 63/63 GREEN 復元・監査 pin ≥37 → ≥38

**タスク**:

- [x] [TASK-0256: RTPM 捏造 quality/LLM-timing メトリック撲滅 — finite-or-null 契約拡張（REQ-364・MW-038）](TASK-0256.md) - 1.5h (DIRECT) 🔵 ✅2026-08-21（RTPM 契約 3 + gates 5 tests 追加・触 10 suites / 235 tests GREEN・tsc 両 config 0・MW-038 2 mutation 独立 RED 実測 + pin ≥37→≥38 + REQ/TC/TASK/MW/overview を同一 commit 同梱）

```
「Populated externally」コメントは populate される保証ではない — producer の全数 grep で初めて捏造と判別する
metric-DEFAULT が gate threshold と結合すると default flip = gate flip（0.90→0.8 で無実の blocker FAIL）— 未測定は null で UNAVAILABLE fail-loud が正典（Phase 166 契約の直接拡張）
adaptable gate の baseline に捏造値が入ると閾値適応そのものが汚染される（REQ-360 poisoning の fabrication 版）— null round skip が必要
```

### 信頼性レベルサマリー（Phase 170 追加分）

- 全 1 タスク 🔵（触 10 suites / 235 tests GREEN + tsc 両 config 0 + MW-038 2 独立 mutation RED 実測）

## Phase 171: fail-loud の行き先 — per-model LLM response-time producer 実装 + METRIC_EXTRACTORS 静的 guard（REQ-365〜368・MW-039）

**ステータス**: ✅完了（2026-08-21・TASK-0257 完了・実装 + specs を単一 commit に同梱・**Phase 170 make-run feedback の steering 2 指示を直接実装**）

**背景**: Phase 170 への make-run feedback は REQ-364 を VALUABLE 判定し (1)「fail-loud の行き先」— null のままでは LLM Response Time gate が monitor 起動後 1 リクエスト目まで METRIC UNAVAILABLE・deploymentReady=false が常態化。monitor は既に `recordLLMRequest` で LLM request を count しているので **request start/end timing producer が自然な次 TASK**。(2) `METRIC_EXTRACTORS` への `?? 定数` silent-pass 再注入は MW-038 runtime test でのみ検出されるため **静的 guard が必要** — 次の再注入は review を素通りする。advanced/01_use_base_processor は Python/cross-repo 系のため「最小 verifiable task」の手法のみ適用。

**実装**:

- REQ-365: monitor に per-model 累積 counter（`{flash,pro}ResponseTime{TotalMs,Count}`・sanitizeFinite・reset 対応）+ `classifyModelBucket` helper（flash/pro substring 相互排他・複合 `'pro+flash'`/`'cache'` は attribution なし）。snapshot は `count > 0 ? Math.round(totalMs/count) : null`。**cache hit は平均から除外**（model を起動しない ~0ms は lower-is-better gate への微型捏造）
- REQ-366: llm-service `execute()` の完了 5 経路が `realTimeMonitor.recordLLMRequest` に報告（primary 成功・cache hit・primary 即時失敗・fallback 成功のみ 1 call・全滅は複合ラベル）。**not-enabled は報告しない**。依存方向 analysis→monitoring（循環なし）
- REQ-367: `tests/guards/adaptive-gates-extractor-no-literal-fallback.test.ts` — METRIC_EXTRACTORS block 内 `\?\? <数字>`/`\|\| <数字>` を ban。anti-vacuity: block 長>500・`: s =>` arrow 数 18 pin・18 key 存在 pin（block 縮小で恒真化を防止）
- REQ-368: health-check-service catch-fallback（getSnapshot throw 時）が契約 9 field に捏造 0 を再注入していた **MISSED-SIBLING-SITE** → 明示 null（display accumulator のみ有限 0）
- **設計決定**: quality trio（transcriptionAccuracy/layoutOverlapRate/avgSceneQuality）は producer を作らず fail-closed のまま — METRIC UNAVAILABLE が計装を促す REQ-364 の意図を維持（要件文に明記）
- MW-039: 3 mutation（monitor 累積削除 → `Received: null`×3・extractor `?? 0.90` 再注入 → 静的 guard + runtime silent-pass + baseline poisoning の 3 failed・wiring 削除 → `Received number of calls: 0`）の独立 RED 実測 → revert 8 suites / 238 tests GREEN 復元・監査 pin ≥38 → ≥39

**タスク**:

- [x] [TASK-0257: fail-loud の行き先 — per-model LLM response-time producer 実装 + METRIC_EXTRACTORS 静的 guard（REQ-365〜368・MW-039）](TASK-0257.md) - 2h (DIRECT) 🔵 ✅2026-08-21（producer 6 + wiring 5 + 静的 guard 22 assertions + fallback 1 tests 追加・影響 8 suites / 250 tests + 消費側 15 suites / 324 tests GREEN・tsc 両 config 0・MW-039 3 独立 mutation RED 実測 + pin ≥38→≥39 + REQ/TC/TASK/MW/overview を同一 commit 同梱）

```
fail-loud 契約は「行き先」まで面倒を見る — null 化だけでは gate が恒久 UNAVAILABLE になり deploymentReady=false が常態化する。実測可能な metric から順に producer を生やす
runtime mutation witness は「test が該当 gate を踏んだ時」しか発火しない — silent-pass 形状は静的 guard で SHAPE ごと ban する方が次の再注入を確実に捕える
catch-fallback の minimal metrics は契約 field に 0 を置きがちな sibling-site — producer 直しの後に全数 grep で追跡する（REQ-368 = REQ-359/364 の見落とし兄弟）
cache hit を per-model 平均に混ぜない — 「測っていない速さ」で lower-is-better gate を GREEN 側へ傾けるのは捏造と同型
```

### 信頼性レベルサマリー（Phase 171 追分量）

- 全 1 タスク 🔵（影響 8 suites / 250 tests + 消費側回帰 15 suites / 324 tests + guards 77 suites / 3266 tests GREEN + tsc 両 config 0 + MW-039 3 独立 mutation RED 実測）

### 次フェーズ開始番号

**次回開始番号**: TASK-0259

## Phase 172: 捏造 quality metric を canonical estimators に委譲 — simple-pipeline / gemini-analyzer の gate 恒久 green 撲滅（REQ-369〜371・MW-040）

**ステータス**: ✅完了（2026-08-21・TASK-0258 完了・実装 + specs を単一 commit に同梱・**L3 台帳「0.85 metric-DEFAULT coupled-to-GATE-threshold」の reporter-side live instance 撲滅**）

**背景**: Phase 170/171 は RTPM/adaptive-gates 系（monitor 出力側）の捏造 metric を finite-or-null 契約 + producer で閉じたが、QualityMonitor に直結する **reporter 側** に同型が 2 site 残存: (1) SimplePipeline success-path の trio（`0.9/0.85/0` — MainPipeline・FrameworkIntegratedPipeline は estimators 委譲済みの MISSED-SIBLING-SITE）・(2) GeminiAnalyzer の `entityExtractionF1: nodes.length > 0 ? 0.85 : 0.3`。いずれも `detectViolations` threshold と正確に結合し恒久 green。

**実装**:

- REQ-369: `PipelineQualitySignals`（= `Pick<PipelineResult, 'success' | 'scenes' | 'duration'>`）経由で SimplePipeline success-path を `estimateTranscriptionAccuracy` / `estimateSegmentationQuality` / `countLayoutOverlaps` に委譲。`duration` は `scenes.reduce(Σ durationMs)` 実測。「layout engine が保証」comment 削除。**GOTCHA**: `segments.map(s => s.text).join(' ')` は空 text 複数でも非空（空白）→ `transcript.length > 0` はほぼ恒真 — 退化 fixture は単一 `['']` でないと mutation が RED にならない
- REQ-370: `scoreNodeDensity(nodes.length)`（2–10→0.90・1→0.70・その他→0.50）に委譲。**空抽出は hard 0**（`scoreNodeDensity(0)`=0.50 は degenerate density 用・旧 0.3「partial」も廃止）
- REQ-371: estimator 8 関数の引数を `PipelineQualitySignals` に緩め（構造的部分型で既存呼び出し不変）・density scale を `scoreNodeDensity` として単一 source 化（duplicate-formula class 封じ）
- MW-040: 4 mutation（trio 各 field の捏造再注入 1+2+1 failed・gemini pair 再注入 4 failed）の独立 RED 実測 → revert GREEN 復元・監査 pin ≥39 → ≥40

**タスク**:

- [x] [TASK-0258: 捏造 quality metric を canonical estimators に委譲 — simple-pipeline / gemini-analyzer の gate 恒久 green 撲滅（REQ-369〜371・MW-040）](TASK-0258.md) - 2h (DIRECT) 🔵 ✅2026-08-21（estimators 直接 pin 13 + simple-pipeline 2 + gemini 4 tests 追加・影響 3 suites / 107 tests + 52 suites / 967 tests + 回帰 156 suites / 4477 tests GREEN・tsc 両 config 0・MW-040 4 独立 mutation RED 実測 + pin ≥39→≥40 + REQ/TC/TASK/MW/overview を同一 commit 同梱）

```
捏造 metric の修正は「削る」だけでなく「正規の測定系に繋ぐ」— MainPipeline が既に委譲済みなら sibling 全数 grep が次の site を指す（SimplePipeline = 今回・pipeline-orchestrator は実 confidence で対象外）
triplet の途中型は Pick で作る — 委譲先が読む field だけを要求すれば PipelineResult を持たない呼び出し元も構造的部分型で乗る（既存呼び出しは signature 緩和のみで不変）
join(' ') 系の「非空判定」は空白のみ文字列で恒真 — 捏造 length>0 分岐の mutation witness を作るときは要素 1 個の配列まで絞る
空抽出・空検出の score は 0 — 「degenerate density 用の中間値」を empty に流用すると無抽出が実 signal と同水準に偽装される
```

### 信頼性レベルサマリー（Phase 172 追分量）

- 全 1 タスク 🔵（影響 3 suites / 107 tests + 52 suites / 967 tests + 回帰 156 suites / 4477 tests GREEN + tsc 両 config 0 + MW-040 4 独立 mutation RED 実測）

### 次フェーズ開始番号

**次回開始番号**: TASK-0259

## Phase 173: RTPM layout-overlap 実測 producer — `layoutOverlapRate` の fail-closed 解消（REQ-372〜374・MW-041）

**ステータス**: ✅完了（2026-08-21・TASK-0259 完了・実装 + specs を単一 commit に同梱・**REQ-368 設計決定の fail-closed トリガーを `layoutOverlapRate` について発火**）

**背景**: Phase 170/171 は RTPM の捏造 metric を finite-or-null 契約 + producer（LLM 系）で閉じたが、quality trio は REQ-368 設計決定で「producer なし fail-closed のまま」としていた。make-run steering の meta-intent「fail-loud の行き先」を quality 系に適用した結果、**`layoutOverlapRate` のみ例外扱いが正しい**ことが判明: overlap は品質パイプライン由来ではなく repo 内に canonical 実測 scan（`countLayoutOverlaps`）が既存のため最小 verifiable 範囲に収まる。残る `transcriptionAccuracy`/`avgSceneQuality` は正解ラベル・実測が scope 外のため引き続き fail-closed。

**実装**:

- REQ-372: `recordPipelineQuality(measuredScenes, layoutOverlapCount)` producer — `measuredScenes > 0 ? count : null`（degenerate report は null・vacuous 0 は eq-0 blocker を無測定 pass させる REQ-364 class）・`sanitizeFinite` ingestion・last-wins・`reset()` 消去。**設計決定**: 値は **count であって rate ではない**（QualityMonitor `layoutOverlap` と同量・rate 化は所有者のいない分母を要求する）
- REQ-373: **測定サイト直結** wiring 3 site（SimplePipeline success path・MainPipeline `buildQualityMetrics`・FrameworkIntegratedPipeline `extractQualityMetrics`）。**設計決定**: `QualityMonitor.recordMetrics` 内に bridge を置かない — 他 caller（gemini-analyzer・pipeline-orchestrator・failure path）は DEFAULT `layoutOverlap: 0` を未測定のまま渡し、bridge すると未測定 0 が eq-0 blocker に再流入する。failure path は report しない
- REQ-374: adaptive gate が measured count 2 で blocker RED・`deploymentReady=false` になる pin（Phase 170 の null→UNAVAILABLE test と対）
- MW-041: 3 mutation（producer 全焼 4 failed・捏造 0 再注入 5 failed・wiring 削除 2 failed）の独立 RED 実測 → revert GREEN 復元・監査 pin ≥40 → ≥41

**タスク**:

- [x] [TASK-0259: RTPM layout-overlap 実測 producer — `layoutOverlapRate` の fail-closed 解消（REQ-372〜374・MW-041）](TASK-0259.md) - 2h (DIRECT) 🔵 ✅2026-08-21（producer test 7 + wiring test 3+2+2 + gate test 1 追加・影響 9 suites / 324 tests + 回帰 38 suites / 764 tests GREEN・tsc 両 config 0・MW-041 3 独立 mutation RED 実測 + pin ≥40→≥41 + REQ/TC/TASK/MW/overview を同一 commit 同梱）

```
producer-less gate の fail-closed は「測定系が既に repo 内にある」field についてだけ解消する — 正解ラベルが要る metric に proxy producer を生やすと恒久 green が一段深い所で再現される
bridge は集約点（recordMetrics）ではなく測定サイトに置く — 集約点の他 caller が未測定 DEFAULT 値を渡す場合、bridge はそれを gate に再流入させる（REQ-364 class の再発）
pipeline が monitor を transitive import すると ESM mock の提供 export 義務が広がる — `unstable_mockModule` は transitive consumer の読む名前も全て export しないと module-link が SyntaxError になる
ESM の frozen namespace でも singleton instance の method は spy 可能 — `jest.spyOn(realTimeMonitor, 'recordPipelineQuality')` で wiring を観測できる（module mock より実体に近い）
```

### 信頼性レベルサマリー（Phase 173 追分量）

- 全 1 タスク 🔵（影響 9 suites / 324 tests + pipeline import 系 16 suites / 346 tests + integration/monitoring 22 suites / 418 tests GREEN + tsc 両 config 0 + MW-041 3 独立 mutation RED 実測）

### 次フェーズ開始番号

**次回開始番号**: TASK-0260


## Spine: external references

- [speech-to-visuals API エンドポイント仕様](/home/jinno/speech-to-visuals/specs/speech-to-visuals/api-endpoints.md)
- [TASK-0119: ESLint回帰修正: Workerテストのno-explicit-any解消](TASK-0119.md)
- [TASK-0122: コード規模90K制限への適合と不要コード除去](TASK-0122.md)
- [TASK-0123: SYSTEM_CONSTITUTION.md・overview.md メトリクス更新・第116回検証](TASK-0123.md)
- [TASK-0137: ストリーミング文字起こし品質監視統合](TASK-0137.md)
- [TASK-0138: 音声前処理パイプライン実装](TASK-0138.md)
- [TASK-0139: エクスポート完全性検証実装](TASK-0139.md)
- [TASK-0140: フォースダイレクトシミュレーションREQ正式化・専用テスト追加](TASK-0140.md)
- [TASK-0141: マルチレベルグラフ粗視化REQ正式化・専用テスト追加](TASK-0141.md)
- [TASK-0142: Phase 31-34 全品質モジュール E2E 統合テスト](TASK-0142.md)

<!-- spine:references:end -->
