# Speech-to-Visuals 受け入れ基準


<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-04-27
**最終更新**: 2026-06-05（第182回検証: Phase 83完了・REQ-205~209 HTTPメトリクス・Prometheus・ヘルスプローブ・Grafana・アラート・241テストファイル・380ソースファイル・107パッケージ）
**関連要件定義**: [requirements.md](requirements.md)
**関連ユーザストーリー**: [user-stories.md](user-stories.md)
**分析記録**: [interview-record.md](interview-record.md)

**【信頼性レベル凡例】**:

- 🔵 **青信号**: PRD・既存要件定義書・設計文書・既存実装を参考にした確実な基準
- 🟡 **黄信号**: PRD・既存要件定義書・設計文書・既存実装から妥当な推測による基準
- 🔴 **赤信号**: 参照資料にない自動推定による基準

---

## REQ-001: 音声ファイル文字起こし 🔵

**信頼性**: 🔵 *PIPELINE_FLOW.md Stage 1・README.md より*


> Given: MP3/WAV/OGG/M4A 形式の音声ファイル（50MB以下）がアップロードされている; Whisper モデルが利用可能な状態である | When: ユーザーが「処理開始」ボタンをクリック、または CLI でパイプラインを実行する | Then: タイムスタンプ付きテキストが出力される; SRT 形式のキャプションファイルが生成される; 処理進捗がリアルタイムで UI に表示される

### テストケース


- [x] **TC-001-01**: WAV 形式の音声ファイル（344KB、jfk.wav）の文字起こし 🔵
  - **入力**: public/jfk.wav（344KB）
  - **期待結果**: 1132文字の文字起こしテキスト、4セグメント、90%精度
  - **信頼性**: 🔵 *Phase 29 実績より*

- [x] **TC-001-02**: MP3 形式の音声ファイルの文字起こし 🔵
  - **入力**: MP3 形式音声ファイル
  - **期待結果**: タイムスタンプ付きテキスト出力
  - **信頼性**: 🔵 *README.md 対応形式より*

- [x] **TC-001-03**: 日本語音声の文字起こし 🔵
  - **入力**: 日本語音声ファイル
  - **期待結果**: 日本語テキスト、自動言語検出で ja が選択される
  - **信頼性**: 🔵 *PIPELINE_FLOW.md 言語検出95%精度より*


- [x] **TC-001-E01**: 50MB 超過ファイルのアップロード 🔵
  - **入力**: 51MB の音声ファイル
  - **期待結果**: ファイルサイズエラーメッセージが表示される
  - **信頼性**: 🔵 *PIPELINE_FLOW.md §7.2 より*

- [x] **TC-001-E02**: 空の音声ファイル 🔵
  - **入力**: 0バイトのファイル
  - **期待結果**: エラーメッセージを返し処理を中止
  - **信頼性**: 🔵 *PIPELINE_FLOW.md §7.2 Abort Conditions より*


- [x] **TC-001-B01**: 50MB ギリギリのファイル 🔵
  - **入力**: 49.9MB の音声ファイル
  - **期待結果**: 正常処理される
  - **信頼性**: 🔵 *README.md 最大50MB仕様より*

- [x] **TC-001-B02**: 1秒の短い音声 🔵
  - **入力**: 1秒の WAV ファイル
  - **期待結果**: 正常処理される（最低1秒要件を満たす）
  - **信頼性**: 🔵 *PIPELINE_FLOW.md Quality Gates より*

---

## REQ-006: LLM 内容分析 🔵

**信頼性**: 🔵 *SYSTEM_CORE.md §4.1・PIPELINE_FLOW.md Stage 2・QUALITY_METRICS.md §3.2 より*


> Given: 文字起こしテキストが生成されている; GOOGLE_API_KEY が有効に設定されている; Gemini API がアクセス可能である | When: 分析パイプラインが文字起こしテキストを処理する | Then: エンティティ抽出 F1 スコア ≥ 80%（実績: 85%）; 関係性抽出精度 ≥ 85%（実績: 90%）; エッジ完全性 ≥ 80%（実績: 88%）; 図解タイプ検出精度 ≥ 90%（実績: 92%）; 11種類の図解タイプ（flow/flowchart/tree/timeline/matrix/cycle/comparison/network/conceptmap/mindmap/general）がすべて認識されること

### テストケース


- [x] **TC-006-01**: フロータイプのコンテンツ分析 🔵
  - **入力**: プロセス手順を説明するテキスト
  - **期待結果**: 図解タイプ "flow" が検出される
  - **信頼性**: 🔵 *SYSTEM_CORE.md §4.3 より*

- [x] **TC-006-02**: ツリータイプのコンテンツ分析 🔵
  - **入力**: 階層構造を説明するテキスト
  - **期待結果**: 図解タイプ "tree" が検出される
  - **信頼性**: 🔵 *Phase 29 実績（tree 自動判定）より*

- [x] **TC-006-03**: 複雑なコンテンツの Pro モデル選択 🔵
  - **入力**: 複雑度スコア ≥ 20% のテキスト
  - **期待結果**: gemini-2.5-pro が選択される
  - **信頼性**: 🔵 *PIPELINE_FLOW.md §5.3 より*


- [x] **TC-006-E01**: LLM API タイムアウト 🔵
  - **入力**: LLM API がタイムアウトする状況
  - **期待結果**: フォールバック LLM → ルールベース V1 への切り替え
  - **信頼性**: 🔵 *SYSTEM_CORE.md §4.2 より*

- [x] **TC-006-E02**: 無効な API キー 🔵
  - **入力**: 無効な GOOGLE_API_KEY
  - **期待結果**: ルールベース V1 にフォールバック、結果は生成される
  - **信頼性**: 🔵 *3層フォールバックアーキテクチャより*

---

## REQ-009: 3層フォールバック 🔵

**信頼性**: 🔵 *SYSTEM_CORE.md §4.2・PIPELINE_FLOW.md §4.1 より*


> Given: LLM API のいずれかが利用可能である（またはルールベースが利用可能） | When: Primary LLM 呼び出しが失敗する | Then: Fallback LLM → ルールベース V1 の順でフォールバック; 最終的に必ず何らかの結果が生成される（成功率 100%）

### テストケース

- [x] **TC-009-01**: Primary LLM 失敗 → Fallback LLM 成功 🔵
  - **期待結果**: Fallback LLM の結果が使用される
  - **信頼性**: 🔵 *SYSTEM_CORE.md §4.2 より*

- [x] **TC-009-02**: 全 LLM 失敗 → ルールベース V1 🔵
  - **期待結果**: シーケンシャル図解が生成される
  - **信頼性**: 🔵 *100% 成功保証より*

---

## REQ-012: レイアウト戦略自動選択 🔵

**信頼性**: 🔵 *src/visualization/strategy-selector.ts・PIPELINE_FLOW.md Stage 3 より*


> Given: 図解タイプが検出されている; DiagramData が生成されている | When: レイアウトエンジンが図解データを処理する | Then: 図解タイプに応じた最適なレイアウト戦略が選択される; 全ノードの位置が計算される; 全エッジのパスが計算される

### テストケース


- [x] **TC-012-01**: flow タイプ → Flow戦略選択 🔵
  - **入力**: diagramType="flow" のデータ
  - **期待結果**: フローレイアウト戦略が選択・実行される
  - **信頼性**: 🔵 *src/visualization/strategies/flow-strategy.ts より*

- [x] **TC-012-02**: tree タイプ → Tree戦略選択 🔵
  - **入力**: diagramType="tree" のデータ
  - **期待結果**: ツリーレイアウト戦略が選択・実行される
  - **信頼性**: 🔵 *src/visualization/strategies/tree-strategy.ts より*

- [x] **TC-012-03**: timeline/matrix/cycle タイプの選択 🔵
  - **入力**: 各図解タイプのデータ
  - **期待結果**: 対応する戦略が選択される
  - **信頼性**: 🔵 *src/visualization/strategies/ より*

---

## REQ-013: ゼロオーバーラップ保証 🔵

**信頼性**: 🔵 *src/visualization/overlap-resolver.ts・QUALITY_METRICS.md §3.3 より*


> Given: ノード配置が計算済みの図解データ | When: オーバーラップ検出・解消が実行される | Then: 全ノードペアでオーバーラップが0件; 全ノードがキャンバス境界内に収まっている

### テストケース

- [x] **TC-013-01**: 100ノード図解のオーバーラップ確認 🔵
  - **条件**: 100ノードの複雑な図解
  - **期待結果**: オーバーラップ0件
  - **信頼性**: 🔵 *フォースダイレクト法（最大100回反復）により保証*

- [x] **TC-013-02**: 初期オーバーラップ有りの解消 🔵
  - **条件**: オーバーラップが存在する初期配置
  - **期待結果**: 反復後にオーバーラップ0件
  - **信頼性**: 🔵 *src/visualization/overlap-resolver.ts より*

---

## REQ-015: 自動改善フレームワーク 🔵

**信頼性**: 🔵 *src/framework/auto-improvement-engine.ts・ITERATION_LOG より*


> Given: パイプライン処理結果が生成されている | When: 品質スコアが閾値を下回る | Then: 再処理が自動実行される; 品質スコアが改善される; 改善パターンが学習システムに蓄積される

### テストケース

- [x] **TC-015-01**: 低品質結果の自動再処理 🔵
  - **条件**: 品質スコアが閾値を下回る結果
  - **期待結果**: 再処理後、品質スコアが改善される
  - **信頼性**: 🔵 *ITERATION_LOG Phase 1-42 の改善履歴より*

---

## REQ-020: リグレッション検出 🔵

**信頼性**: 🔵 *src/quality/regression-detector.ts より*


> Given: 過去の品質メトリクスベースラインが存在する | When: 新しい品質メトリクスが測定される | Then: 5%以上の品質低下が検出される; デプロイがブロックされる; 通知が発信される

### テストケース

- [x] **TC-020-01**: 5%以上の品質低下検出 🔵
  - **条件**: 前回比5%以上の品質低下
  - **期待結果**: リグレッションとして検出・ブロック
  - **信頼性**: 🔵 *src/quality/regression-detector.ts より*

---

## NFR-001: エンドツーエンド処理時間 🔵

**信頼性**: 🔵 *QUALITY_METRICS.md §2.1 より*


> Given: 1分間の音声ファイルが入力されている; 全サービスが正常に動作している | When: エンドツーエンドパイプラインを実行する | Then: 処理時間が60秒以内（実績: 25.2秒）; 動画ファイルが正常に生成される

### テストケース

- [x] **TC-NFR-001-01**: 1分音声の処理時間測定 🔵
  - **測定項目**: エンドツーエンド処理時間
  - **目標値**: 60秒以内
  - **測定条件**: 1分間の WAV ファイル
  - **信頼性**: 🔵 *Phase 42 実績（25.2秒）より*

---

## NFR-302: ゼロオーバーラップ 🔵

**信頼性**: 🔵 *QUALITY_METRICS.md §3.3・SYSTEM_CORE.md §4.3 より*


> Given: 有効な DiagramData が生成されている | When: レイアウトエンジンがノード配置を計算する | Then: 全ノードペアでオーバーラップが0件; 全エッジのパスが計算されている; 全ノードがキャンバス境界内に収まっている

### テストケース

- [x] **TC-NFR-302-01**: 100ノード図解のオーバーラップ確認 🔵
  - **条件**: 100ノードの複雑な図解
  - **期待結果**: オーバーラップ0件
  - **信頼性**: 🔵 *フォースダイレクト法（最大100回反復）により保証*

---

## EDGE-001: 空ファイルエラー処理 🔵

**信頼性**: 🔵 *PIPELINE_FLOW.md §7.2 より*


> Given: 空のファイル（0バイト）がアップロードされる | When: パイプラインがファイルを処理しようとする | Then: エラーメッセージが表示される; 処理が安全に中止される; システムがクラッシュしない

### テストケース

- [x] **TC-EDGE-001-01**: 空ファイルのアップロード 🔵
  - **条件**: 0バイトのファイル
  - **期待結果**: エラーメッセージ + 安全な中止
  - **信頼性**: 🔵 *PIPELINE_FLOW.md §7.2 Abort Conditions より*

---

## EDGE-003: レートリミット対応 🔵

**信頼性**: 🔵 *PIPELINE_FLOW.md §4.2 より*


> Given: LLM API がレートリミット（429）を返す | When: システムが LLM API を呼び出す | Then: ジッタ付き指数バックオフで最大3回リトライ; リトライ間隔: 1000ms → 2000ms → 4000ms（±ジッタ）; 全リトライ失敗後はフォールバックに切り替え

### テストケース

- [x] **TC-EDGE-003-01**: レートリミット発生時のリトライ 🔵
  - **条件**: LLM API が429を返す
  - **期待結果**: バックオフリトライ後、フォールバックへ
  - **信頼性**: 🔵 *PIPELINE_FLOW.md §4.2 より*

---

## REQ-025: ノード・エッジアニメーション 🔵

**信頼性**: 🔵 *src/remotion/NodeAnimation.tsx・src/remotion/EdgeAnimation.tsx より*


> Given: 有効な DiagramData がレイアウト済みである | When: Remotion がアニメーションフレームを生成する | Then: ノードが0.3秒でフェードイン・スケールアニメーションする; エッジが0.5秒でSVGパス描画アニメーションする

### テストケース


- [x] **TC-025-01**: ノードフェードインアニメーション 🔵
  - **入力**: DiagramData（5ノード、3エッジ）
  - **期待結果**: フレーム0→9で opacity 0→1、scale 0.8→1.0
  - **信頼性**: 🔵 *NodeAnimation.test.tsx より*

- [x] **TC-025-02**: エッジパス描画アニメーション 🔵
  - **入力**: エッジデータ（from/to座標指定）
  - **期待結果**: フレーム0→15で stroke-dashoffset が full→0
  - **信頼性**: 🔵 *EdgeAnimation.test.tsx より*

---

## REQ-027: アニメーション戦略自動選択 🔵

**信頼性**: 🔵 *src/remotion/animation-strategies.ts より*


> Given: 図解タイプ（flow/tree/timeline/matrix/cycle）が検出されている | When: アニメーション戦略を選択する | Then: 図解タイプに応じた戦略が選択される; 各戦略が固有のノード/エッジタイミングを定義している

### テストケース

- [x] **TC-027-01**: 5種の図解タイプ戦略選択 🔵
  - **入力**: flow, tree, timeline, matrix, cycle の各タイプ
  - **期待結果**: 各タイプに対応する戦略が返される
  - **信頼性**: 🔵 *animation-strategies.test.ts より*

---

## REQ-028: SRTキャプションパース 🔵

**信頼性**: 🔵 *src/remotion/srt-parser.ts より*


> Given: SRT形式のキャプションファイルが入力されている | When: SRTパーサーがファイルを処理する | Then: タイムスタンプがミリ秒に変換される; フレーム番号が正しく計算される; SRT形式の整合性が検証される

### テストケース

- [x] **TC-028-01**: SRTファイルパース 🔵
  - **入力**: 標準的なSRTファイル
  - **期待結果**: キャプションエントリ配列が正しく生成される
  - **信頼性**: 🔵 *srt-parser.test.ts より*

---

## REQ-030: 動画レンダリング 🔵

**信頼性**: 🔵 *src/remotion/renderer.ts より*


> Given: 有効なシーンデータとキャプションが準備されている | When: Remotion renderMedia() でレンダリングを実行する | Then: 指定した解像度（720p/1080p/4K）、FPS（30/60）、コーデック（H.264/H.265/VP9）で出力される; ファイルサイズが推定される

### テストケース

- [x] **TC-030-01**: 1080p 30fps H.264 レンダリング 🔵
  - **条件**: デフォルト設定でのレンダリング
  - **期待結果**: 1920x1080 30fps MP4 が生成される
  - **信頼性**: 🔵 *renderer.test.ts より*

---

## REQ-031: SimplePipeline UI 🔵

**信頼性**: 🔵 *src/components/SimplePipelineInterface.tsx・src/pages/SimplePipeline.tsx より*


> Given: ユーザーがパイプラインページにアクセスしている | When: 音声ファイルをアップロードして処理を開始する | Then: 4段階の進捗表示がリアルタイムで更新される; 処理結果（シーン、トランスクリプト、メトリクス）が表示される; ビデオプレビューが提供される

### テストケース

- [x] **TC-031-01**: パイプラインUI表示とファイルアップロード 🔵
  - **条件**: /pipeline ページへのアクセス
  - **期待結果**: ファイルアップロードフォームと進捗表示が表示される
  - **信頼性**: 🔵 *SimplePipelineInterface.test.tsx より*

- [x] **TC-031-02**: キーボードショートカット動作 🔵
  - **条件**: Ctrl+O, Ctrl+Enter, Esc のキー操作
  - **期待結果**: それぞれファイル選択、処理開始、リセットが実行される
  - **信頼性**: 🔵 *SimplePipelineInterface.tsx 実装より*

---

## REQ-036: ストリーミング文字起こし 🔵

**信頼性**: 🔵 *src/transcription/streaming-transcriber.ts より*


> Given: 音声データがストリーミング可能な形式で入力されている | When: ストリーミングトランスクリーバーがチャンク単位で音声を処理する | Then: 各チャンクが逐次処理されてテキストが出力される; 全チャンク完了時に統合された文字起こし結果が生成される

### テストケース


- [x] **TC-036-01**: ストリーミング音声のチャンク処理 🔵
  - **入力**: チャンク分割された音声データ
  - **期待結果**: 各チャンクの文字起こし結果が逐次出力される
  - **信頼性**: 🔵 *streaming-transcriber.ts より*

---

## REQ-037: ユーザー主導エラー回復 🔵

**信頼性**: 🔵 *src/quality/user-guided-error-recovery.ts より*


> Given: パイプライン処理中にリカバリ可能なエラーが発生している | When: システムがユーザーに回復オプションを提示する | Then: ユーザーが回復方法を選択できる; 選択に基づいて処理が再開または調整される

### テストケース


- [x] **TC-037-01**: エラー時の回復オプション表示 🔵
  - **条件**: パイプライン処理中のエラー
  - **期待結果**: 複数の回復オプションがユーザーに提示される
  - **信頼性**: 🔵 *user-guided-error-recovery.ts より*

---

## REQ-038: 設定スキーマバリデーション 🔵

**信頼性**: 🔵 *src/config/validate.ts・src/config/schema.ts より*


> Given: システムが起動し、環境変数・設定値を読み込む | When: Zod スキーマによる設定バリデーションが実行される | Then: 全設定値がスキーマに照合され、不正値は即座にエラーとして報告される; バリデーション通過時のみシステムが正常起動する

### テストケース


- [x] **TC-038-01**: 正常設定での起動 🔵
  - **条件**: 全設定値がスキーマに適合
  - **期待結果**: バリデーション通過、システム正常起動
  - **信頼性**: 🔵 *config/validate.ts より*


- [x] **TC-038-E01**: 不正設定値での起動 🔵
  - **条件**: スキーマに適合しない設定値
  - **期待結果**: エラーメッセージ表示、起動中止
  - **信頼性**: 🔵 *config/schema.ts より*

---

## REQ-039: スマートパラメータ自動チューニング 🔵

**信頼性**: 🔵 *src/optimization/smart-parameter-tuner.ts・adaptive-content-processor.ts より*


> Given: 過去の処理結果メトリクスが蓄積されている | When: パイプライン実行前にパラメータチューニングが実行される | Then: メトリクスに基づいて最適なパラメータが自動選択される; 品質・性能のバランスが改善される

### テストケース


- [x] **TC-039-01**: パラメータ自動調整 🔵
  - **条件**: 過去メトリクスが蓄積済み
  - **期待結果**: 最適化されたパラメータが適用される
  - **信頼性**: 🔵 *smart-parameter-tuner.ts より*

---

## REQ-040: エラー分類システム 🔵

**信頼性**: 🔵 *src/quality/error-classifier.ts より*


> Given: パイプライン処理中にエラーが発生している | When: エラー分類器がエラーを分類する | Then: エラーが11種類のいずれかに分類される; 重大度（low/medium/high/critical）が判定される; 復旧可能性が判定される; ユーザー向けメッセージと推奨アクションが生成される

### テストケース


- [x] **TC-040-01**: LLM レートリミットエラーの分類 🔵
  - **入力**: 429 ステータスコードのエラー
  - **期待結果**: エラータイプ LLM_RATE_LIMITED、重大度 high、復旧可能
  - **信頼性**: 🔵 *error-classifier.ts CLASSIFICATION_RULES より*

- [x] **TC-040-02**: レンダリング OOM エラーの分類 🔵
  - **入力**: メモリ不足エラー
  - **期待結果**: エラータイプ RENDERING_OOM、重大度 critical、復旧可能
  - **信頼性**: 🔵 *error-classifier.ts より*

- [x] **TC-040-03**: バッチ分類の統計追跡 🔵
  - **入力**: 複数エラーのバッチ分類
  - **期待結果**: 分類統計が正しく集計される
  - **信頼性**: 🔵 *error-classifier.ts getStatistics() より*

---

## REQ-041: 5段階品質ゲート評価 🔵

**信頼性**: 🔵 *src/quality/quality-gate.ts より*


> Given: パイプラインの各ステージが完了している | When: 品質ゲート評価が実行される | Then: 各ステージの品質基準に対して pass/fail が判定される; 失敗時はブロックされフォールバックアクションが返される; 5%以上の品質低下でリグレッションが検出される

### テストケース


- [x] **TC-041-01**: ステージ1（文字起こし）品質ゲート 🔵
  - **条件**: 音声長 ≥ 1.0秒、サンプリングレート ≥ 16000Hz、ノイズ < -30dB
  - **期待結果**: 品質ゲート通過
  - **信頼性**: 🔵 *quality-gate.ts createDefaultQualityGates() より*

- [x] **TC-041-02**: ステージ3（レイアウト）オーバーラップ検出 🔵
  - **条件**: ノードにオーバーラップが存在する
  - **期待結果**: 品質ゲート失敗、ブロック
  - **信頼性**: 🔵 *quality-gate.ts 矩形オーバーラップ検出より*

- [x] **TC-041-03**: リグレッション検出（5%低下） 🔵
  - **条件**: 前回品質スコアから5%以上低下
  - **期待結果**: リグレッションとして検出・ブロック
  - **信頼性**: 🔵 *quality-gate.ts detectRegression() より*

---

## REQ-042: パイプラインオーケストレーター 🔵

**信頼性**: 🔵 *src/pipeline/pipeline-orchestrator.ts より*


> Given: 音声ファイルとオプション設定が入力されている; 全コンポーネントが初期化されている | When: パイプラインオーケストレーターが実行される | Then: 5段階が順次実行される; 各ステージで品質ゲートが評価される; 失敗時はフォールバック戦略が実行される; 進捗コールバックが通知される; 最終結果に動画URLと品質レポートが含まれる

### テストケース


- [x] **TC-042-01**: フルパイプライン正常実行 🔵
  - **条件**: 正常な音声ファイル入力
  - **期待結果**: 5ステージ全て完了、動画ファイル生成
  - **信頼性**: 🔵 *pipeline-orchestrator.ts execute() より*

- [x] **TC-042-02**: 品質ゲート失敗時のフォールバック 🔵
  - **条件**: 中間ステージで品質ゲート失敗
  - **期待結果**: フォールバック戦略が実行され、処理が継続
  - **信頼性**: 🔵 *pipeline-orchestrator.ts tryFallbacks() より*


- [x] **TC-042-E01**: 不正入力のバリデーション 🔵
  - **条件**: 空ファイルまたは未対応形式
  - **期待結果**: バリデーションエラーで即座に中止
  - **信頼性**: 🔵 *pipeline-orchestrator.ts validateInput() より*

---

## REQ-043: バッチ処理 REST API 🔵

**信頼性**: 🔵 *src/api/routes/batch.ts より*


> Given: バッチ API サーバーが起動している | When: クライアントが REST API でバッチジョブを操作する | Then: POST /batch/jobs でジョブが作成され HTTP 202 が返される; GET /batch/jobs/:id でステータスが取得される; DELETE /batch/jobs/:id でジョブがキャンセルされる; 最大3ジョブまで並列実行される

### テストケース


- [x] **TC-043-01**: バッチジョブ作成 🔵
  - **条件**: ファイル配列を POST
  - **期待結果**: UUID jobId 付きで HTTP 202 Accepted
  - **信頼性**: 🔵 *batch.ts createBatchRouter() より*

- [x] **TC-043-02**: ジョブステータス取得 🔵
  - **条件**: 存在する jobId で GET
  - **期待結果**: ジョブステータス（queued/processing/completed/failed/cancelled）が返される
  - **信頼性**: 🔵 *batch.ts getJobStatus() より*


- [x] **TC-043-E01**: 完了済みジョブのキャンセル 🔵
  - **条件**: 完了済み jobId で DELETE
  - **期待結果**: HTTP 409 Conflict
  - **信頼性**: 🔵 *batch.ts JobAlreadyCompletedError より*

---

## REQ-044: Edge Functions 共有認証 🔵

**信頼性**: 🔵 *supabase/functions/_shared/auth.ts より*


> Given: Edge Function リクエストに Authorization ヘッダーが含まれている | When: 共有認証モジュールが JWT を検証する | Then: Bearer トークンが抽出・検証される; 有効なトークンの場合、userId と email が返される; 期限切れ・無効トークンの場合、AuthError がスローされる

### テストケース

- [x] **TC-044-01**: 有効 JWT の認証 🔵
  - **条件**: 有効な Bearer トークン
  - **期待結果**: userId と email が返される
  - **信頼性**: 🔵 *auth.ts authenticateRequest() より*

- [x] **TC-044-02**: 期限切れトークンの検出 🔵
  - **条件**: 期限切れ JWT
  - **期待結果**: AUTH_TOKEN_EXPIRED エラー
  - **信頼性**: 🔵 *auth.ts validateToken() より*

---

## REQ-045: Edge Functions 統一エラーハンドリング 🔵

**信頼性**: 🔵 *supabase/functions/_shared/error-handler.ts より*


> Given: Edge Function でエラーが発生している | When: 統一エラーハンドラーがエラーレスポンスを生成する | Then: CORS ヘッダー付きの JSON レスポンスが返される; エラータイプに応じた HTTP ステータスコードが設定される; タイムアウトは AbortController で管理される（デフォルト30秒）

### テストケース

- [x] **TC-045-01**: 認証エラーの統一レスポンス 🔵
  - **条件**: AuthError
  - **期待結果**: HTTP 401 + CORS ヘッダー
  - **信頼性**: 🔵 *error-handler.ts classifyError() より*

- [x] **TC-045-02**: タイムアウト付き fetch 🔵
  - **条件**: fetchWithTimeout() 呼び出し
  - **期待結果**: 30秒でタイムアウト、HTTP 504
  - **信頼性**: 🔵 *error-handler.ts createTimeout() より*

---

## REQ-046: WebSocket リアルタイム進捗通知 🔵

**信頼性**: 🔵 *src/api/websocket-handler.ts より*


> Given: Socket.IO サーバーが起動している; クライアントが JWT 認証トークンを保持している | When: クライアントが WebSocket でジョブルームに参加し、進捗通知を待機する | Then: ジョブ進捗（job:progress）、完了（job:complete）、エラー（job:error）がリアルタイムで通知される; ファイルステータス（file:status）、ステージ進捗（stage:progress）が通知される; ストリーミングセグメント（streaming:segment）、エラー回復（error:recovery）が通知される

### テストケース


- [x] **TC-046-01**: ジョブルーム参加と進捗通知 🔵
  - **条件**: join:job イベント送信
  - **期待結果**: job:joined 応答、以後 job:progress イベント受信
  - **信頼性**: 🔵 *websocket-handler.ts registerWebSocketHandler() より*

- [x] **TC-046-02**: ストリーミングセグメント通知 🔵
  - **条件**: ストリーミング文字起こし中
  - **期待結果**: streaming:segment イベントが逐次通知される
  - **信頼性**: 🔵 *websocket-handler.ts emitStreamingSegment() より*


- [x] **TC-046-E01**: 未認証接続の拒否 🔵
  - **条件**: JWT トークンなしで接続
  - **期待結果**: Authentication required エラー
  - **信頼性**: 🔵 *websocket-handler.ts createWsAuthMiddleware() より*

---

## REQ-047: バッチ最適化 🔵

**信頼性**: 🔵 *src/optimization/batch-optimizer.ts より*


> Given: 大量の処理対象アイテムが入力されている | When: BatchOptimizer がアイテムを並列チャンクで処理する | Then: アイテムがチャンクに分割され、設定された並列度で並列処理される; 成功・失敗が元の順序で結果に格納される; 進捗コールバックが呼び出される

### テストケース


- [x] **TC-047-01**: 並列チャンク処理 🔵
  - **条件**: 100アイテム、チャンクサイズ50、並列度4
  - **期待結果**: 全アイテムが処理され、結果が元の順序で返される
  - **信頼性**: 🔵 *batch-optimizer.ts process() より*

- [x] **TC-047-02**: フェイルファスト無効時の部分成功 🔵
  - **条件**: 一部アイテムがエラー、failFast=false
  - **期待結果**: 成功アイテムは results に、失敗は errors に格納
  - **信頼性**: 🔵 *batch-optimizer.ts processChunk() より*

---

## REQ-048: 計算キャッシュ・メモリキャッシュ 🔵

**信頼性**: 🔵 *src/optimization/computation-cache.ts・memory-cache.ts より*


> Given: キャッシュインスタンスが初期化されている | When: 同一キーで複数回キャッシュアクセスが発生する | Then: 初回のみ計算が実行され、以後はキャッシュから返される; TTL 期限切れエントリは自動削除される; LRU 退行が最大サイズ超過時に実行される

### テストケース


- [x] **TC-048-01**: 計算キャッシュのメモ化 🔵
  - **条件**: 同一キーで2回 getOrCompute
  - **期待結果**: 初回のみ compute 呼び出し、2回目はキャッシュヒット
  - **信頼性**: 🔵 *computation-cache.ts getOrCompute() より*

- [x] **TC-048-02**: タグベース無効化 🔵
  - **条件**: タグ付きでキャッシュ→タグで一括無効化
  - **期待結果**: 該当タグのエントリが全て削除される
  - **信頼性**: 🔵 *computation-cache.ts invalidateByTag() より*

- [x] **TC-048-03**: メモリキャッシュのLRU退行 🔵
  - **条件**: maxSize=3 で4エントリを set
  - **期待結果**: 最初のエントリが退行される
  - **信頼性**: 🔵 *memory-cache.ts set() より*

---

## REQ-049: 遅延ローダー 🔵

**信頼性**: 🔵 *src/optimization/lazy-loader.ts より*


> Given: LazyLoader インスタンスが初期化されている | When: 同一キーで複数回 load が呼び出される | Then: 初回のみ loader 関数が実行される; 2回目以降はキャッシュから即座に返される; 同時呼び出しは重複排除される

### テストケース


- [x] **TC-049-01**: 遅延読み込みとキャッシュ 🔵
  - **条件**: 同一キーで2回 load
  - **期待結果**: loader 呼び出し1回、2回目はキャッシュ
  - **信頼性**: 🔵 *lazy-loader.ts load() より*

- [x] **TC-049-02**: プリロード 🔵
  - **条件**: preload 呼び出し後に load
  - **期待結果**: プリロード済みのキャッシュから即座に返される
  - **信頼性**: 🔵 *lazy-loader.ts preload() より*

---

## REQ-050: グレースフルシャットダウン 🔵

**信頼性**: 🔵 *src/quality/enhanced-error-recovery.ts shutdown() メソッドより*


> Given: EnhancedErrorRecovery インスタンスが稼働中; アクティブリクエストが存在する可能性がある | When: `shutdown()` メソッドが呼び出される | Then: ヘルスモニタリングタイマーが停止する; アクティブリクエストの完了を最大30秒待機する; タイムアウト後、残リクエストが強制終了される; リクエストキューがクリアされる; サーキットブレーカーがリセットされる

### テストケース


- [x] **TC-050-01**: アクティブリクエストなしでのシャットダウン 🔵
  - **条件**: アクティブリクエスト0件
  - **期待結果**: 即座にシャットダウン完了ログが出力される
  - **信頼性**: 🔵 *shutdown() メソッドより*

- [x] **TC-050-02**: アクティブリクエストありでのシャットダウン 🔵
  - **条件**: アクティブリクエスト1件以上
  - **期待結果**: リクエスト完了後にシャットダウン（30秒以内）
  - **信頼性**: 🔵 *shutdown() while ループより*


- [x] **TC-050-E01**: タイムアウト時の強制終了 🔵
  - **条件**: アクティブリクエストが30秒以内に完了しない
  - **期待結果**: 残リクエストが強制クリアされシャットダウン完了
  - **信頼性**: 🔵 *shutdown() force abort ロジックより*

---

## REQ-051: 型ガード・型安全性 🔵

**信頼性**: 🔵 *src/types/diagram.ts isDiagramType() より*


> Given: 不明な値が DiagramType として使用される可能性がある | When: `isDiagramType()` 関数に値を渡す | Then: 有効な DiagramType 値（11種）の場合は true を返す; 無効な値の場合は false を返す

### テストケース


- [x] **TC-051-01**: 有効な図解タイプの検証 🔵
  - **条件**: 'flow', 'tree', 'timeline', 'matrix', 'cycle', 'flowchart', 'comparison', 'network', 'conceptmap', 'mindmap', 'general'
  - **期待結果**: 全て true を返す
  - **信頼性**: 🔵 *isDiagramType() 関数より*


- [x] **TC-051-E01**: 無効な値の検出 🔵
  - **条件**: 'invalid', '', null, undefined, 123
  - **期待結果**: 全て false を返す
  - **信頼性**: 🔵 *isDiagramType() 関数より*

---

## REQ-056: キャッシュウォームアップ 🔵

**信頼性**: 🔵 *src/optimization/cache-warmup.ts より*


> Given: セマンティックキャッシュがコールドスタート状態（エントリ数が閾値以下）である | When: キャッシュウォームアップ戦略が実行される | Then: 代表的なクエリパターン（英語・日本語）でキャッシュが事前充填される; ウォームアップ前後のヒット率が統計として追跡される

### テストケース


- [x] **TC-056-01**: コールドスタート検出とウォームアップ実行 🔵
  - **条件**: キャッシュエントリ数 < 閾値
  - **期待結果**: ウォームアップが実行され、ヒット率が改善される
  - **信頼性**: 🔵 *cache-warmup.ts より*

---

## REQ-057: パイプライン API エンドポイント 🔵

**信頼性**: 🔵 *src/hooks/useFrameworkPipeline.ts・src/components/pipeline-interface.tsx より*


> Given: バックエンド API サーバーが起動している | When: フロントエンドが REST API エンドポイントを呼び出す | Then: POST /api/render: 動画レンダリングがトリガーされる; POST /api/git/commit: 品質閾値到達時にコミットが作成される; GET /api/iteration-log: イテレーションログが返される; GET /api/framework/status: フレームワークステータスが返される

### テストケース


- [x] **TC-057-01**: 動画レンダリング API 呼び出し 🔵
  - **条件**: POST /api/render にシーンデータを送信
  - **期待結果**: レンダリング結果のステータスが返される
  - **信頼性**: 🔵 *pipeline-interface.tsx より*

- [x] **TC-057-02**: 自動コミット API 呼び出し 🔵
  - **条件**: 品質閾値到達時に POST /api/git/commit
  - **期待結果**: コミットが正常に作成される
  - **信頼性**: 🔵 *useFrameworkPipeline.ts より*

---

## REQ-304: モバイルレスポンシブ UI 🔵

**信頼性**: 🔵 *src/components/EnhancedFileUploader.tsx・PipelineProgress.tsx・StageIndicator.tsx・VideoPreview.tsx・TASK-0076 より*


> Given: ユーザーがモバイルブラウザ（375px~768pxビューポート）でアプリケーションにアクセスしている | When: パイプラインUIをモバイルビューポートで操作する | Then: EnhancedFileUploader がモバイルタッチ操作に対応する; PipelineProgress がモバイル表示に最適化される; StageIndicator がモバイルレイアウトに対応する; VideoPreview がモバイルレイアウトで適切表示される

### テストケース


- [x] **TC-304-01**: モバイルビューポートでのUI表示 🔵
  - **条件**: 375px（iPhone SE）ビューポート
  - **期待結果**: 全パイプラインUIコンポーネントが適切に表示される
  - **信頼性**: 🔵 *src/components/__tests__/mobile-responsive.test.ts より*

- [x] **TC-304-02**: タッチ操作でのファイルアップロード 🔵
  - **条件**: モバイルでのタッチ操作によるファイル選択
  - **期待結果**: ファイルアップロードが正常に動作する
  - **信頼性**: 🔵 *EnhancedFileUploader.tsx モバイル対応・TASK-0076 より*

---

## REQ-111: authMiddleware Express パイプライン統合テスト 🔵

**信頼性**: 🔵 *src/api/middleware/auth.ts・src/api/server.ts・TASK-0154 ユニットテスト11件完了より*


> Given: Express アプリケーションに authMiddleware が組み込まれたテストサーバーが構築されている; JWT_SECRET 環境変数が設定されている; supertest パッケージが利用可能である | When: HTTP リクエストが認証が必要なエンドポイントに送信される | Then: HTTP レスポンス形状（ステータスコード・JSON ボディ・Content-Type ヘッダー）が正しい; CORS ヘッダーがエラーレスポンスでも正しく伝播する; ミドルウェアチェーンが正しく動作する

### テストケース


- [x] **TC-111-01**: 有効な Bearer トークンで保護されたエンドポイントが200レスポンス 🔵
  - **入力**: Authorization: Bearer <valid-jwt> ヘッダー付き GET /api/protected
  - **期待結果**: HTTP 200、Content-Type: application/json、req.user が設定される
  - **信頼性**: 🔵 *auth.test.ts ユニットテストパターンをExpress レベルで検証*

- [x] **TC-111-02**: 認証成功時の Content-Type ヘッダー検証 🔵
  - **入力**: 有効な JWT トークンでの API リクエスト
  - **期待結果**: Content-Type: application/json; charset=utf-8
  - **信頼性**: 🔵 *Express レスポンス仕様より*

- [x] **TC-111-03**: CORS ヘッダーがエラーレスポンスでも伝播 🔵
  - **入力**: 無効なトークンでの Origin: http://localhost:8080 リクエスト
  - **期待結果**: 401 レスポンスに Access-Control-Allow-Origin ヘッダーが含まれる
  - **信頼性**: 🔵 *src/api/server.ts CORS 設定より*

- [x] **TC-111-04**: authMiddleware が rate-limit ミドルウェアの後に動作 🔵
  - **入力**: レート制限超過後の認証リクエスト
  - **期待結果**: 429 Too Many Requests が authMiddleware の前に返される
  - **信頼性**: 🔵 *src/api/server.ts ミドルウェア順序より*


- [x] **TC-111-E01**: 欠損 Authorization ヘッダーで401レスポンス形状検証 🔵
  - **入力**: Authorization ヘッダーなしの GET /api/protected
  - **期待結果**: HTTP 401、{ success: false, error: { code: "UNAUTHORIZED", message: "..." } }
  - **信頼性**: 🔵 *auth.test.ts TC と同じパターンをExpress レベルで検証*

- [x] **TC-111-E02**: 期限切れ JWT トークンで401 TOKEN_ERROR レスポンス 🔵
  - **入力**: 期限切れ JWT での GET /api/protected
  - **期待結果**: HTTP 401、{ success: false, error: { code: "TOKEN_ERROR" } }
  - **信頼性**: 🔵 *jwt.verify 例外ハンドリングより*

- [x] **TC-111-E03**: 不正な JWT 署名で401 レスポンス 🔵
  - **入力**: 異なるシークレットで署名された JWT
  - **期待結果**: HTTP 401、{ success: false, error: { code: "TOKEN_ERROR" } }
  - **信頼性**: 🔵 *jwt.verify 例外ハンドリングより*


- [x] **TC-111-B01**: SUPABASE_JWT_SECRET フォールバックでの認証成功 🔵
  - **入力**: JWT_SECRET 未設定・SUPABASE_JWT_SECRET 設定状態でのリクエスト
  - **期待結果**: HTTP 200、正常な認証
  - **信頼性**: 🔵 *auth.ts getJwtSecret() フォールバックより*

- [x] **TC-111-B02**: JWT_SECRET/SUPABASE_JWT_SECRET 双方未設定で401 🔵
  - **入力**: 両環境変数未設定でのリクエスト
  - **期待結果**: HTTP 401（getJwtSecret() 例外が catch で捕捉され TOKEN_ERROR 返却）
  - **信頼性**: 🔵 *auth.ts getJwtSecret() 例外処理より*

---

## REQ-112: jsonwebtoken モック整合性自動検証 🔵

**信頼性**: 🔵 *tests/__mocks__/jsonwebtoken.ts・src/api/middleware/auth.ts より*


> Given: tests/__mocks__/jsonwebtoken.ts が存在し、verify/sign/decode をエクスポートしている; auth.ts が jsonwebtoken を import * as jwt from 'jsonwebtoken' で使用している | When: モック整合性検証テストが実行される | Then: モックがエクスポートする関数名と auth.ts が使用する JWT メソッドが一致する; 新しい JWT メソッドが必要になった場合、テストが失敗する

### テストケース


- [x] **TC-112-01**: モックが verify/sign/decode をエクスポートしている 🔵
  - **条件**: tests/__mocks__/jsonwebtoken.ts のインポート
  - **期待結果**: verify, sign, decode が jest.fn() として存在する
  - **信頼性**: 🔵 *モックファイル直接確認より*

- [x] **TC-112-02**: auth.ts が使用する jwt.verify がモックの verify と対応 🔵
  - **条件**: auth.ts の JWT 使用パターン分析
  - **期待結果**: auth.ts の jwt.verify(token, secret) 呼び出しがモックの verify で処理可能
  - **信頼性**: 🔵 *auth.ts:34 jwt.verify 使用箇所より*


- [x] **TC-112-E01**: モックに未対応の JWT メソッド追加時にテスト失敗 🔵
  - **条件**: auth.ts が新しい JWT メソッド（例: jwt.decode）を使用するように変更された場合
  - **期待結果**: モック整合性テストが失敗し、モック更新が必要であることを通知
  - **信頼性**: 🔵 *フェイルセーフ設計パターンより*

---

## REQ-052: チュートリアルシステム 🔵

**信頼性**: 🔵 *src/components/TutorialSystem.tsx より*


> Given: ユーザーがブラウザでアプリケーションにアクセスしている | When: 初回アクセス時またはチュートリアルを開いた時 | Then: カテゴリ別チュートリアル（概要/パイプライン/可視化/エクスポート）が表示される; 各ステップの難易度（初級/中級/上級）が表示される; 進捗が LocalStorage に保存される

### テストケース


- [x] **TC-052-01**: チュートリアルカテゴリ一覧表示 🔵
  - **期待結果**: 4カテゴリが表示される
  - **信頼性**: 🔵 *TutorialSystem.tsx より*

---

## REQ-053: マルチモードパイプライン 🔵

**信頼性**: 🔵 *src/pages/Index.tsx・src/components/StreamingProcessor.tsx より*


> Given: ユーザーがトップページにアクセスしている | When: Standard/Streaming モードを切り替えて処理を実行 | Then: Standard モード: ファイルアップロード→一括処理→動画生成; Streaming モード: マイク録音→リアルタイム文字起こし→シーン生成

### テストケース


- [x] **TC-053-01**: Standard モードでファイル処理 🔵
  - **期待結果**: ファイルアップロード→文字起こし→分析→動画生成が完了
  - **信頼性**: 🔵 *Index.tsx より*

- [x] **TC-053-02**: Streaming モードでリアルタイム処理 🔵
  - **期待結果**: マイク録音→プログレッシブシーン生成が動作
  - **信頼性**: 🔵 *StreamingProcessor.tsx より*

---

## REQ-054: フレームワークダッシュボード 🔵

**信頼性**: 🔵 *src/components/FrameworkDashboard.tsx より*


> Given: FrameworkIntegratedPipeline が実行可能である | When: /framework ルートにアクセス | Then: イテレーション追跡・品質メトリクス・フェーズ評価・改善推奨が表示される

### テストケース


- [x] **TC-054-01**: ダッシュボード表示 🔵
  - **期待結果**: フレームワークパイプライン実行状況がリアルタイム表示される
  - **信頼性**: 🔵 *FrameworkDashboard.tsx より*

---

## REQ-055: プロダクション設定ダッシュボード 🔵

**信頼性**: 🔵 *src/components/ProductionDashboard.tsx より*


> Given: プロダクション設定が初期化済みである | When: /production ルートにアクセス | Then: 設定確認・変更・パフォーマンスレポート・最適化ステータスが表示される

### テストケース


- [x] **TC-055-01**: 設定表示とレポート 🔵
  - **期待結果**: プロダクション設定とパフォーマンスレポートが表示される
  - **信頼性**: 🔵 *ProductionDashboard.tsx より*

---

## REQ-064: バッチAPI jobId UUID検証 🔵

**信頼性**: 🔵 *ISS-010 HIGH・src/api/routes/batch.ts lines 299, 314・.audit/purpose_driven_plan.yml より*


> Given: バッチ処理 REST API が利用可能である; ジョブが作成済みである | When: 不正な形式の jobId（非UUID文字列、SQLインジェクション文字列等）で GET /jobs/:jobId または POST /jobs/:jobId/cancel を呼び出す | Then: 400 Bad Request エラーが返される; エラーメッセージに不正な jobId は含まれない（サニタイズ済み）

### テストケース


- [x] **TC-064-E01**: 非UUID形式のjobIdでのステータス取得 🔵
  - **入力**: jobId = "'; DROP TABLE jobs;--"
  - **期待結果**: 400 Bad Request, jobId はUUID形式でなければならない旨のエラー
  - **信頼性**: 🔵 *ISS-010 report・batch.ts line 299 より*

- [x] **TC-064-E02**: 非UUID形式のjobIdでのキャンセル 🔵
  - **入力**: jobId = "abc-not-a-uuid"
  - **期待結果**: 400 Bad Request, jobId はUUID形式でなければならない旨のエラー
  - **信頼性**: 🔵 *ISS-010 report・batch.ts line 314 より*

- [x] **TC-064-E03**: 空文字のjobId 🔵
  - **入力**: jobId = ""
  - **期待結果**: 400 Bad Request
  - **信頼性**: 🔵 *入力検証要件より*


- [x] **TC-064-B01**: 正しいUUID v4形式のjobId 🔵
  - **入力**: jobId = "550e8400-e29b-41d4-a716-446655440000"
  - **期待結果**: 正常に処理（ジョブが存在すれば200、存在しなければ404）
  - **信頼性**: 🔵 *既存バッチAPI動作仕様より*

---

## REQ-065: 品質ゲート配列上限 🔵

**信頼性**: 🔵 *ISS-011 MEDIUM・src/quality/adaptive-quality-gates.ts line 161・.audit/purpose_driven_plan.yml より*


> Given: AdaptiveQualityGates インスタンスが初期化済みである; gates 配列に多数のゲートが追加されている | When: 上限値（50ゲート）を超えて addGate() を呼び出す | Then: 追加が拒否され、エラーまたはfalseが返される; gates 配列のサイズが上限値を超えない

### テストケース


- [x] **TC-065-E01**: 上限超過時のゲート追加 🔵
  - **入力**: 51個目のゲートを追加
  - **期待結果**: 追加が拒否され、配列サイズは50を維持
  - **信頼性**: 🔵 *ISS-011 report・adaptive-quality-gates.ts より*


- [x] **TC-065-B01**: 上限値ぴったりのゲート追加 🔵
  - **入力**: 50個目のゲートを追加
  - **期待結果**: 正常に追加される
  - **信頼性**: 🔵 *上限値仕様より*

---

## REQ-066: ブラウザセーフ環境変数アクセス 🔵

**信頼性**: 🔵 *ISS-012 MEDIUM・src/config/production-config.ts lines 80, 284, 291・.audit/purpose_driven_plan.yml より*


> Given: production-config.ts がブラウザ環境で動作している; process.env が undefined の可能性がある（Vite ビルド時の静的置換が行われない場合） | When: getEnvironmentConfig() または loadConfigOverrides() が呼び出される | Then: process.env が undefined の場合でもエラーが発生しない; 適切なデフォルト値が使用される

### テストケース


- [x] **TC-066-E01**: process.env undefined 時の環境設定取得 🔵
  - **条件**: typeof process === 'undefined' の環境
  - **期待結果**: デフォルト値 'development' が使用されエラーが発生しない
  - **信頼性**: 🔵 *ISS-012 report・production-config.ts line 80 より*

- [x] **TC-066-E02**: process.env undefined 時の設定オーバーライド読み込み 🔵
  - **条件**: typeof process === 'undefined' の環境
  - **期待結果**: デフォルト設定が使用されエラーが発生しない
  - **信頼性**: 🔵 *ISS-012 report・production-config.ts lines 284, 291 より*

---

## REQ-079: 図解ビジュアルバランススコアリング 🟡

**信頼性**: 🟡 *src/visualization/ 既存モジュールの拡張として妥当な推測*


> Given: 有効な DiagramData がレイアウト済みである; 全ノードの位置座標（x, y, width, height）が計算済みである | When: ビジュアルバランススコアリング関数が図解データを評価する | Then: ノード重心偏差が算出される（キャンバス中心との距離比）; 象限バランス比が算出される（4象限のノード分布均一性）; 密度均一性が算出される（局所密度の分散）; 複合バランススコア（0.0~1.0）が返される

### テストケース


- [x] **TC-079-01**: 完全対称レイアウトのバランススコア 🟡
  - **入力**: 中心に対称に配置された4ノード図解
  - **期待結果**: バランススコア ≥ 0.95
  - **信頼性**: 🟡 *幾何学的対称性からの推測*

- [x] **TC-079-02**: 非対称レイアウトのバランススコア低下 🟡
  - **入力**: 左上に偏った配置の10ノード図解
  - **期待結果**: バランススコア < 0.5
  - **信頼性**: 🟡 *重心偏差計算からの推測*


- [x] **TC-079-E01**: 単一ノード図解のバランス評価 🟡
  - **入力**: ノード1個のみの図解
  - **期待結果**: バランススコア = 1.0（単一要素は常にバランス済み）または定義済みデフォルト値
  - **信頼性**: 🟡 *境界条件の推測*


- [x] **TC-079-B01**: 空図解データのハンドリング 🟡
  - **入力**: ノード0個の図解データ
  - **期待結果**: エラーまたはスコア 0.0 を返しクラッシュしない
  - **信頼性**: 🟡 *エッジケースの推測*

---

## REQ-080: エッジ交差検出・最小化 🟡

**信頼性**: 🟡 *グラフ描画最適化手法として妥当な推測*


> Given: グラフ型図解（flow/flowchart/network/conceptmap）の DiagramData がレイアウト済みである | When: エッジ交差検出アルゴリズムが実行される | Then: 全エッジペアの交差が検出・カウントされる; 交差数が報告される; 交差最小化ヒューリスティクス適用後の交差数が報告される

### テストケース


- [x] **TC-080-01**: 交差なし図解の検出 🟡
  - **入力**: ツリー型（交差なし）の10ノード図解
  - **期待結果**: 交差数 = 0
  - **信頼性**: 🟡 *ツリー構造特性からの推測*

- [x] **TC-080-02**: 交差あり図解の検出と最小化 🟡
  - **入力**: 完全グラフに近い5ノード図解
  - **期待結果**: 交差が検出され、最小化後に交差数が減少する
  - **信頼性**: 🟡 *一般的なグラフ描画最適化手法からの推測*


- [x] **TC-080-B01**: エッジ0本の図解 🟡
  - **入力**: ノードのみでエッジなしの図解
  - **期待結果**: 交差数 = 0、クラッシュしない
  - **信頼性**: 🟡 *境界条件の推測*

---

## REQ-081: スマートラベルサイジング 🟡

**信頼性**: 🟡 *src/visualization/ 既存ノード描画の拡張として妥当な推測*


> Given: DiagramData の各ノードにラベルテキストが設定されている; ノードの幅・高さが計算済みである | When: ラベルサイジング関数が各ノードのラベルを評価・調整する | Then: ラベルテキストがノード境界内に収まるようにフォントサイズが調整される; 長いテキストは行折り返しされる; ノード幅を超える場合は省略記号で切り詰められる

### テストケース


- [x] **TC-081-01**: 短いラベルのフォントサイズ維持 🟡
  - **入力**: "ABC"（3文字）のノードラベル
  - **期待結果**: デフォルトフォントサイズが維持される
  - **信頼性**: 🟡 *テキスト計算からの推測*

- [x] **TC-081-02**: 長いラベルの自動折り返し 🟡
  - **入力**: 50文字の日本語ラベル
  - **期待結果**: テキストがノード幅に収まるよう行分割される
  - **信頼性**: 🟡 *テキスト折り返しロジックからの推測*


- [x] **TC-081-E01**: 空ラベルのハンドリング 🟡
  - **入力**: ラベルが空文字("")のノード
  - **期待結果**: エラーなく処理され、フォントサイズはデフォルト
  - **信頼性**: 🟡 *エッジケースの推測*

---

## REQ-082: レイアウト品質複合スコア 🟡

**信頼性**: 🟡 *src/quality/quality-gate.ts の拡張として妥当な推測*


> Given: バランススコア・交差スコア・あふれスコア・密度スコアが算出済みである | When: 複合スコア算出関数が各スコアを統合する | Then: 重み付き平均による複合スコア（0.0~1.0）が返される; 各スコアの寄与度が報告される

### テストケース


- [x] **TC-082-01**: 高品質レイアウトの複合スコア 🟡
  - **条件**: バランス0.95・交差0.0・あふれ0.0・密度0.9
  - **期待結果**: 複合スコア ≥ 0.8
  - **信頼性**: 🟡 *スコア計算ロジックからの推測*


- [x] **TC-082-E01**: スコア欠損時のハンドリング 🟡
  - **条件**: 一部スコアが undefined
  - **期待結果**: デフォルト値で補完しクラッシュしない
  - **信頼性**: 🟡 *エラー耐性の推測*

---

## REQ-083: 品質ベース自動最適化ループ 🔵

**信頼性**: 🔵 *src/visualization/layout-auto-optimizer.ts 実装済・13テスト通過*


> Given: レイアウト品質複合スコアが閾値（0.7）を下回っている | When: 自動最適化ループが実行される | Then: 最大3回までレイアウト戦略再選択・パラメータ調整・再計算が試行される; 各試行後にスコアが再評価される; スコア改善または3回到達で終了する

### テストケース


- [x] **TC-083-01**: 低品質レイアウトの自動改善 🟡
  - **条件**: 初期複合スコア 0.5 のレイアウト
  - **期待結果**: 再試行後にスコア ≥ 0.7 に改善される（または3回到達）
  - **信頼性**: 🟡 *自動改善パターンからの推測*

---

## REQ-084: パイプラインオーケストレーター品質最適化統合 🔵

**信頼性**: 🔵 *既存モジュールのパイプライン統合・src/pipeline/pipeline-orchestrator.ts 拡張*


> Given: パイプラインが Stage 3（レイアウト生成）を完了している; LayoutAutoOptimizer モジュールが利用可能 | When: Stage 3 完了後に品質スコア評価が実行される | Then: 複合品質スコアが算出されパイプラインメトリクスに記録される; スコア < 0.7 の場合、自動最適化が実行される; 最適化結果のスコアが改善される

### テストケース


- [x] **TC-084-01**: パイプライン経由の品質スコア評価 🔵
  - **条件**: Stage 3 完了後のレイアウト
  - **期待結果**: 複合品質スコアがメトリクスに記録される
  - **信頼性**: 🔵 *既存モジュール統合*

- [x] **TC-084-02**: 低品質時の自動最適化トリガー 🔵
  - **条件**: 初期スコア < 0.7 のレイアウト
  - **期待結果**: 自動最適化が実行されスコアが改善される
  - **信頼性**: 🔵 *既存モジュール統合*

---

## REQ-085: スマートラベルサイジングパイプライン適用 🔵

**信頼性**: 🔵 *既存モジュールのパイプライン適用・src/visualization/smart-label-sizer.ts 実装済*


> Given: パイプラインが Stage 3（レイアウト生成）を完了している; SmartLabelSizer モジュールが利用可能 | When: Stage 3 完了後にラベルサイジングが実行される | Then: 全ノードのラベルがフォントサイズ・折り返し・省略とともに自動調整される; ラベルがノード境界をあふれない; あふれスコアが品質評価に反映される

### テストケース


- [x] **TC-085-01**: パイプライン経由のラベル自動調整 🔵
  - **条件**: 長いラベルテキストを含むノード
  - **期待結果**: フォントサイズが縮小または折り返しが適用される
  - **信頼性**: 🔵 *既存モジュール統合*

---

## REQ-086: Phase 31 モジュール公開エクスポート 🔵

**信頼性**: 🔵 *src/visualization/index.ts のエクスポート追加*


> Given: Phase 31 全モジュールが src/visualization/ に実装済み | When: 外部モジュールが @/visualization からインポートを実行する | Then: VisualBalanceScorer, EdgeCrossingMinimizer, SmartLabelSizer, LayoutQualityCompositeScorer, LayoutAutoOptimizer が全てインポート可能

### テストケース


- [x] **TC-086-01**: Phase 31 全モジュールのエクスポート確認 🔵
  - **条件**: visualization/index.ts のエクスポート確認
  - **期待結果**: 5モジュール全てがエクスポートされている
  - **信頼性**: 🔵 *単純なエクスポート確認*

---

## REQ-087: E2E 図解品質パイプライン統合テスト 🔵

**信頼性**: 🔵 *既存テストパターンの拡張*


> Given: Phase 32 全統合（REQ-084~086）が完了している | When: エンドツーエンドのパイプラインが実行される | Then: レイアウト生成→品質スコアリング→自動最適化→ラベルサイジング→レンダリング準備の全流れが正常完了する

### テストケース


- [x] **TC-087-01**: E2E品質パイプラインフロー 🔵
  - **条件**: 音声入力→レイアウト→品質評価→最適化→レンダリング準備
  - **期待結果**: 全ステージが正常完了し品質スコアが記録される
  - **信頼性**: 🔵 *既存テストパターンの拡張*

---

## REQ-088: PipelineOrchestrator QualityMonitor 統合 🔵

**信頼性**: 🔵 *src/pipeline/quality-monitor.ts 既存実装と pipeline-orchestrator.ts の統合ギャップより*


> Given: PipelineOrchestrator が4ステージパイプラインを実行している; QualityMonitor が利用可能（src/pipeline/quality-monitor.ts） | When: パイプラインの各ステージが完了する | Then: 各ステージの品質スコアが QualityMonitor に記録される; パイプラインメトリクスに qualityScores フィールドが含まれる; 低品質ステージが警告として記録される

### テストケース


- [x] **TC-088-01**: QualityMonitor ステージ別スコア記録 🔵
  - **条件**: パイプライン全ステージ実行
  - **期待結果**: 4ステージ全ての品質スコアが記録される
  - **信頼性**: 🔵 *既存 QualityMonitor インターフェースの活用*


- [x] **TC-088-02**: QualityMonitor 初期化失敗時のフォールバック 🔵
  - **条件**: QualityMonitor が初期化できない場合
  - **期待結果**: パイプラインは品質記録なしで継続動作する
  - **信頼性**: 🔵 *既存エラー回復パターン*

---

## REQ-089: Phase 31 品質モジュール専用ユニットテスト 🔵

**信頼性**: 🔵 *18 visualization モジュールに専用テストファイルなし・phase31-diagram-quality.test.ts のみ*


> Given: Phase 31 品質モジュール（SmartLabelSizer・VisualBalanceScorer・EdgeCrossingMinimizer）が実装済み; tests/visualization/phase31-diagram-quality.test.ts に統合テストが存在 | When: 各モジュールの専用ユニットテストを実行する | Then: SmartLabelSizer の全設定バリエーションが検証される; VisualBalanceScorer のスコアリング精度が検証される; EdgeCrossingMinimizer の交差検出・最小化が検証される; 境界値・エッジケースがカバーされる

### テストケース


- [x] **TC-089-01**: SmartLabelSizer 専用ユニットテスト 🔵
  - **条件**: デフォルト設定・カスタム設定・日本語テキスト・CJK文字
  - **期待結果**: 全設定でラベルが適切にサイジングされる
  - **信頼性**: 🔵 *モジュール実装の直接テスト*

- [x] **TC-089-02**: VisualBalanceScorer 専用ユニットテスト 🔵
  - **条件**: 対称・非対称・空・単一ノードレイアウト
  - **期待結果**: 対称レイアウトが高スコア・非対称が低スコア
  - **信頼性**: 🔵 *モジュール実装の直接テスト*

- [x] **TC-089-03**: EdgeCrossingMinimizer 専用ユニットテスト 🔵
  - **条件**: 交差あり・交差なし・複雑グラフ
  - **期待結果**: 交差検出が正確・最小化結果が改善されている
  - **信頼性**: 🔵 *モジュール実装の直接テスト*


- [x] **TC-089-04**: minFontSize 境界値テスト 🔵
  - **条件**: minFontSize=8 でフォントサイズが下限に達する入力
  - **期待結果**: フォントサイズが minFontSize を下回らない
  - **信頼性**: 🔵 *設定パラメータの直接検証*

---

## REQ-090: プロダクションコード console.log 構造化ログ化 🔵

**信頼性**: 🔵 *30箇所以上の console.log/error/warn のコード確認*


> Given: プロダクションコードに console.log/error/warn が30箇所以上残存; CLAUDE.md が console.log 残置を禁止 | When: プロダクションコードのビルド・実行時 | Then: console.log/error/warn が構造化ログまたはエラー回復に置換される; テストコード内の console スタブは変更しない; 全テストが通過する

### テストケース


- [x] **TC-090-01**: 品質モジュールの console.log 除去 🔵
  - **条件**: src/quality/enhanced-error-recovery.ts・regression-detector.ts
  - **期待結果**: console 出力が適切なエラー処理に置換される
  - **信頼性**: 🔵 *直接コード確認*

- [x] **TC-090-02**: UI コンポーネントの console.log 除去 🔵
  - **条件**: src/components/StreamingProcessor.tsx・VideoRenderer.tsx
  - **期待結果**: console 出力が UI エラー表示に置換される
  - **信頼性**: 🔵 *直接コード確認*

- [x] **TC-090-03**: 設定モジュールの console.log 除去 🔵
  - **条件**: src/config/production-config.ts
  - **期待結果**: console 出力が設定バリデーションエラーに置換される
  - **信頼性**: 🔵 *直接コード確認*

---

## REQ-094: フォースダイレクトシミュレーションレイアウトアルゴリズム 🔵

**信頼性**: 🔵 *src/visualization/complex-layout-engine.ts 既存実装（コミット995ee7d）*


> Given: 図解ノード・エッジデータが生成済み; ComplexLayoutEngine がフォースダイレクト法を使用する設定 | When: レイアウト計算がフォースダイレクトシミュレーションを選択; Coulomb斥力・Hooke引力・減衰係数が適用される | Then: シミュレーションが収束または最大反復到達で終了する; ノードの重なりが自然に解消される; 複合品質スコアが改善される

### テストケース


- [x] **TC-094-01**: フォースダイレクトシミュレーション初期化 🔵
  - **入力**: 10ノード・15エッジのグラフデータ
  - **期待結果**: 状態が正しく初期化される
  - **信頼性**: 🔵 *既存実装ベース*

- [x] **TC-094-02**: 反復シミュレーションの収束 🔵
  - **入力**: 初期配置ランダムグラフ
  - **期待結果**: 反復ごとにエネルギーが減少し、収束判定が正しく動作する
  - **信頼性**: 🔵 *既存実装ベース*

- [x] **TC-094-03**: レイアウト出力変換 🔵
  - **入力**: 収束済みシミュレーション状態
  - **期待結果**: DiagramLayout 形式で正しく出力される
  - **信頼性**: 🔵 *既存実装ベース*


- [x] **TC-094-B01**: 単一ノードでのシミュレーション 🔵
  - **入力**: 1ノードのみ
  - **期待結果**: エラーなく処理される
  - **信頼性**: 🔵 *既存実装ベース*

- [x] **TC-094-B02**: 最大反復到達時の動作 🔵
  - **入力**: 収束しないグラフ設定
  - **期待結果**: 最大反復到達で終了し、最後の状態が出力される
  - **信頼性**: 🔵 *既存実装ベース*

---

## REQ-095: マルチレベルグラフ粗視化アルゴリズム 🔵

**信頼性**: 🔵 *src/visualization/complex-layout-engine.ts 既存実装（コミット995ee7d）*


> Given: 100ノード超の大規模グラフデータが生成済み; ComplexLayoutEngine がマルチレベル粗視化を使用する設定 | When: グラフ粗視化が heavy-edge matching で実行される; 粗視化レベルでの初期レイアウトから段階的精緻化が行われる | Then: 各粗視化レベルでノード数が削減される; 精緻化後のレイアウトが高品質である; 計算時間が直接的なフォースダイレクト法より短縮される

### テストケース


- [x] **TC-095-01**: グラフ粗視化1レベル 🔵
  - **入力**: 50ノード・80エッジのグラフ
  - **期待結果**: heavy-edge matching で粗視化され、ノード数が減少する
  - **信頼性**: 🔵 *既存実装ベース*

- [x] **TC-095-02**: 多レベル粗視化 🔵
  - **入力**: 200ノード・300エッジの大規模グラフ
  - **期待結果**: 最大4レベルまで粗視化される
  - **信頼性**: 🔵 *既存実装ベース*

- [x] **TC-095-03**: 段階的精緻化（uncoarsen + refine） 🔵
  - **入力**: 粗視化済みグラフ
  - **期待結果**: 段階的に精緻化され、最終レイアウト品質が向上する
  - **信頼性**: 🔵 *既存実装ベース*


- [x] **TC-095-B01**: 小規模グラフ（10ノード未満）での粗視化 🔵
  - **入力**: 5ノード・3エッジ
  - **期待結果**: 粗視化せず直接レイアウト計算に移行する
  - **信頼性**: 🔵 *既存実装ベース*

---

## REQ-096: Phase 31-34 全品質モジュール E2E 統合テスト 🔵

**信頼性**: 🔵 *Phase 31-34各モジュール単体テスト存在、E2E統合テスト未実装*


> Given: Phase 31-34 の全品質モジュールが実装済み; パイプラインオーケストレーターが全ステージで品質ゲートを実行 | When: 音声ファイルがアップロードされ、エンドツーエンドパイプラインが実行される | Then: 音声前処理（REQ-092）がノイズレベル・無音区間を評価する; ストリーミング品質監視（REQ-091）が文字起こし品質を評価する; レイアウト品質（REQ-079~083）が複合スコアを算出する; QualityMonitor（REQ-088）が全ステージ品質を統合する; エクスポート検証（REQ-093）が出力完全性を確認する; 全品質ゲート通過が確認される

### テストケース


- [x] **TC-096-01**: 全品質ゲート通過の E2E テスト 🔵
  - **入力**: 標準的な音声ファイル（30秒）
  - **期待結果**: 全ステージの品質ゲートが通過し、最終出力が検証される
  - **信頼性**: 🔵 *各モジュールの単体テストで検証済*

- [x] **TC-096-02**: 音声品質不良時の品質ゲート動作 🔵
  - **入力**: ノイズ多い音声ファイル
  - **期待結果**: 音声前処理で品質警告が発行され、後続ステージに情報が伝達される
  - **信頼性**: 🔵 *AudioPreprocessorテストで検証済*

- [x] **TC-096-03**: レイアウト品質低スコア時の自動最適化 🔵
  - **入力**: 複雑なグラフ図解（100+ノード）
  - **期待結果**: 複合品質スコア < 0.7 で自動最適化が実行され、スコアが改善する
  - **信頼性**: 🔵 *LayoutAutoOptimizerテストで検証済*


- [x] **TC-096-E01**: エクスポート検証失敗時のエラー処理 🔵
  - **入力**: 不完全なエクスポート出力
  - **期待結果**: ExportVerifier が検証失敗を検出し、エラーを返す
  - **信頼性**: 🔵 *ExportVerifierテストで検証済*

---

## REQ-097: パイプラインステージ並列化とボトルネック検出 🔵

**信頼性**: 🔵 *src/pipeline/parallel-layout-executor.ts・src/pipeline/bottleneck-detector.ts・TASK-0143完了*


> Given: パイプラインオーケストレーターが複数図解コンテンツの処理を開始する; enableParallel が有効である | When: Stage 3（レイアウト生成）と Stage 4（シーン準備）を実行する | Then: 複数図解のレイアウトが並列実行される（maxLayoutConcurrency 制限内）; シーン準備が並列実行される（maxSceneConcurrency 制限内）; 各ステージのタイミングメトリクスが記録される; 全体処理時間の40%以上を占めるステージがボトルネックとして検出される

### テストケース


- [x] **TC-097-01**: 並列レイアウト生成が逐次実行と同一結果 🔵
  - **入力**: 3つの図解データ
  - **期待結果**: 並列実行と逐次実行の結果が同一
  - **信頼性**: 🔵 *tests/pipeline/parallel-execution.test.ts で検証済*

- [x] **TC-097-02**: 同時実行数制限が機能する 🔵
  - **入力**: maxConcurrency=2, 5つの図解データ
  - **期待結果**: 同時実行最大2つ
  - **信頼性**: 🔵 *tests/pipeline/parallel-execution.test.ts で検証済*

- [x] **TC-097-03**: ボトルネック検出（warning/critical） 🔵
  - **入力**: Stage 2が全体の50%を占めるタイミングメトリクス
  - **期待結果**: warning severityでボトルネック検出
  - **信頼性**: 🔵 *tests/pipeline/parallel-execution.test.ts で検証済*

- [x] **TC-097-04**: ステージタイミングメトリクス精度 🔵
  - **入力**: 5段階パイプライン実行
  - **期待結果**: 各ステージの開始/終了/所要時間が正確に記録
  - **信頼性**: 🔵 *src/pipeline/stage-timing-metrics.ts テストで検証済*


- [x] **TC-097-E01**: 並列実行時の個別ステージ失敗 🔵
  - **入力**: 3つの図解のうち1つでレイアウト失敗
  - **期待結果**: 失敗した図解のみエラー、他は成功
  - **信頼性**: 🔵 *tests/pipeline/parallel-execution.test.ts で検証済*

---

## REQ-098: LLMコスト・トークン使用量監視 🔵

**信頼性**: 🔵 *src/analysis/token-usage-tracker.ts・src/analysis/cost-estimator.ts・src/analysis/budget-alert.ts・TASK-0144完了*


> Given: LLM API（Gemini Flash/Pro）が利用可能である; TokenUsageTracker が初期化されている | When: LLM API呼び出しが実行される | Then: input/output トークン数がリクエスト単位で記録される; モデル別価格に基づくコスト推定が計算される; セッション/日次予算のアラートが発行される; PerformanceDashboard にコストメトリクスが統合される

### テストケース


- [x] **TC-098-01**: トークン使用量記録が正確 🔵
  - **入力**: API応答（inputTokens:1500, outputTokens:500）
  - **期待結果**: TokenUsageRecordが正確に記録
  - **信頼性**: 🔵 *tests/analysis/token-usage-cost-monitoring.test.ts*

- [x] **TC-098-02**: Flash/Pro コスト推定が正確 🔵
  - **入力**: Flash 10K input + 2K output tokens
  - **期待結果**: $0.075*10 + $0.30*2 = $1.35
  - **信頼性**: 🔵 *tests/analysis/token-usage-cost-monitoring.test.ts*

- [x] **TC-098-03**: 予算アラート閾値発火 🔵
  - **入力**: sessionBudget: $1.00, alertThreshold: 0.8
  - **期待結果**: 累積$0.80到達でアラート発行
  - **信頼性**: 🔵 *tests/analysis/budget-alert-boundary.test.ts*

- [x] **TC-098-04**: ステージ別コスト内訳 🔵
  - **入力**: 3ステージ（analysis/fallback/cache-warmup）のコスト
  - **期待結果**: 各ステージのコストが正確に返される
  - **信頼性**: 🔵 *tests/analysis/llm-monitoring-integration.test.ts*

- [x] **TC-098-05**: PerformanceDashboard統合 🔵
  - **入力**: 3回のAPI呼び出し
  - **期待結果**: セッション合計・平均・ステージ別内訳が取得可能
  - **信頼性**: 🔵 *src/monitoring/performance-dashboard.ts に統合済*

- [x] **TC-098-06**: Gemini API usageMetadata からのトークン抽出 🔵
  - **入力**: Gemini API レスポンス
  - **期待結果**: response.usageMetadata からトークン数が正確に抽出される
  - **信頼性**: 🔵 *tests/analysis/llm-monitoring-integration.test.ts*


- [x] **TC-098-B01**: 予算閾値境界（ちょうど80%・79.9%・80.1%） 🔵
  - **入力**: セッション予算$1.00・閾値80%
  - **期待結果**: 境界値付近のアラート発火が正確
  - **信頼性**: 🔵 *tests/analysis/budget-alert-boundary.test.ts 15ケースで検証*

- [x] **TC-098-B02**: ゼロ予算・負値コストのガード 🔵
  - **入力**: ゼロまたは負の予算設定
  - **期待結果**: エラーまたはガード動作
  - **信頼性**: 🔵 *tests/analysis/budget-alert-boundary.test.ts*

---

## REQ-099: パフォーマンスリグレッションベンチマーク 🔵

**信頼性**: 🔵 *src/pipeline/performance-baseline.ts・src/pipeline/performance-regression-detector.ts・TASK-0145完了*


> Given: パイプライン各ステージのベースライン値が定義されている; ベンチマークテストが実行される | When: 各ステージの実際のタイミング・メモリを計測する | Then: 10%以上の性能悪化がリグレッションとして検出される; 並列化効果（逐次 vs 並列）が測定される; コスト効率メトリクスが追跡される; JSONレポートが出力される

### テストケース


- [x] **TC-099-01**: ベースライン比較が正確 🔵
  - **入力**: transcription baseline 8000ms, actual 9500ms
  - **期待結果**: 18.75%悪化 → リグレッション検出
  - **信頼性**: 🔵 *src/pipeline/performance-regression-detector.ts テスト*

- [x] **TC-099-02**: リグレッション重大度分類 🔵
  - **入力**: 10%/25%閾値
  - **期待結果**: 10%未満=warning, 25%以上=critical
  - **信頼性**: 🔵 *src/pipeline/performance-regression-detector.ts テスト*

- [x] **TC-099-03**: 並列化効果測定 🔵
  - **入力**: sequential 12000ms, parallel 5000ms
  - **期待結果**: 2.4x高速化として算出
  - **信頼性**: 🔵 *src/pipeline/parallel-benchmark.ts テスト*

---

## REQ-100: 監視REST API エンドポイント 🔵

**信頼性**: 🔵 *src/api/routes/monitoring.ts・src/api/server.ts・TASK-0146完了*


> Given: Express API サーバーが起動している; 監視モジュール（PerformanceDashboard・TokenUsageTracker・BudgetAlert）が初期化されている | When: 外部クライアントが /api/v1/monitoring/* エンドポイントにアクセスする | Then: GET /metrics: 現在のダッシュボードメトリクスが返される; GET /cost: LLMコスト・トークン・予算メトリクスが返される; GET /trends: パフォーマンストレンドが返される; GET /health: ヘルスチェックステータスが返される

### テストケース


- [x] **TC-100-01**: GET /metrics レスポンス検証 🔵
  - **入力**: GET /api/v1/monitoring/metrics
  - **期待結果**: 200 + ダッシュボードメトリクスJSON
  - **信頼性**: 🔵 *tests/api/routes/__tests__/monitoring.test.ts*

- [x] **TC-100-02**: GET /cost コストメトリクス検証 🔵
  - **入力**: GET /api/v1/monitoring/cost
  - **期待結果**: 200 + トークン・コスト・予算データJSON
  - **信頼性**: 🔵 *tests/api/routes/__tests__/monitoring.test.ts*

- [x] **TC-100-03**: GET /trends トレンド検証 🔵
  - **入力**: GET /api/v1/monitoring/trends?timespan=1h
  - **期待結果**: 200 + パフォーマンストレンドJSON
  - **信頼性**: 🔵 *tests/api/routes/__tests__/monitoring.test.ts*

- [x] **TC-100-04**: GET /health ヘルスチェック検証 🔵
  - **入力**: GET /api/v1/monitoring/health
  - **期待結果**: 200 + コンポーネントステータスJSON
  - **信頼性**: 🔵 *tests/api/routes/__tests__/monitoring.test.ts*


- [x] **TC-100-B01**: 無効なtimespanパラメータ 🔵
  - **入力**: GET /trends?timespan=invalid
  - **期待結果**: 400 + バリデーションエラー
  - **信頼性**: 🔵 *Zodスキーマ検証*

---

## REQ-113: 監視ヘルスエンドポイント・ウォームアップ失敗テスト 🔵

**信頼性**: 🔵 *src/api/routes/monitoring.ts cacheWarmup フィールド・startup-warmup.ts WarmupStatusInfo 型より*


> Given: Express API サーバーが起動している; startup-warmup モジュールがウォームアップ失敗状態を報告している; 監視ヘルスエンドポイント（GET /api/v1/monitoring/health）が利用可能 | When: 外部クライアントが GET /api/v1/monitoring/health にアクセスする; startup-warmup の getWarmupStatus() が {status: 'failed', error: '...'} を返す状態 | Then: HTTP 200 が返される（ウォームアップ失敗はサーバー全体のヘルスに影響しない）; レスポンス data.status が 'healthy' または 'degraded'（successRate に基づく）; レスポンス data.cacheWarmup.status が 'failed'; レスポンス data.cacheWarmup.error がエラーメッセージ文字列; レスポンス data.cacheWarmup.timestamp が ISO 形式

### テストケース


- [x] **TC-113-01**: ウォームアップ失敗時のヘルスレスポンス形状 🔵
  - **入力**: getWarmupStatus() が {status: 'failed', error: 'ECONNREFUSED', timestamp: '...'} を返す状態で GET /health
  - **期待結果**: 200 + cacheWarmup.status = 'failed' + cacheWarmup.error = 'ECONNREFUSED'
  - **信頼性**: 🔵 *src/api/startup-warmup.ts .catch() フロー・monitoring.ts line 111 より*

- [x] **TC-113-02**: ウォームアップ失敗がヘルスステータス全体に影響しないこと 🔵
  - **入力**: getWarmupStatus() が failed 状態 + successRate = 1.0 で GET /health
  - **期待結果**: data.status = 'healthy'（ウォームアップ失敗は successRate に影響しない）
  - **信頼性**: 🔵 *fire-and-forget 設計・monitoring.ts status 判定ロジック line 103 より*


- [x] **TC-113-E01**: ウォームアップpending中のヘルスレスポンス 🔵
  - **入力**: getWarmupStatus() が {status: 'pending'} を返す状態で GET /health
  - **期待結果**: 200 + cacheWarmup.status = 'pending' + cacheWarmup.error = undefined
  - **信頼性**: 🔵 *startup-warmup.ts 初期状態・monitoring.ts line 111 より*

- [x] **TC-113-E02**: ウォームアップスキップ時のヘルスレスポンス 🔵
  - **入力**: getWarmupStatus() が {status: 'skipped', timestamp: '...'} を返す状態で GET /health
  - **期待結果**: 200 + cacheWarmup.status = 'skipped'
  - **信頼性**: 🔵 *startup-warmup.ts LLM disabled 分岐・monitoring.ts line 111 より*

---

## REQ-114: キャッシュバックエンド到達不能統合テスト 🔵

**信頼性**: 🔵 *src/api/startup-warmup.ts fire-and-forget 設計・startup-warmup.test.ts 失敗テストケースより*


> Given: LLMService の warmupCache() がネットワークエラー（ECONNREFUSED / ETIMEDOUT / DNS resolution failure）で reject する; triggerStartupWarmup() が呼び出される; 監視ヘルスエンドポイントが利用可能 | When: triggerStartupWarmup() が実行される（キャッシュバックエンド到達不能状態）; 非同期ウォームアップが失敗する; GET /api/v1/monitoring/health が呼び出される | Then: triggerStartupWarmup() は例外をスローしない（同期リターン）; getWarmupStatus().status が 'failed' になる; getWarmupStatus().error にエラーメッセージが含まれる; ヘルスエンドポイントは 200 + cacheWarmup.status = 'failed' を返す; サーバー起動は継続する（ウォームアップ失敗で停止しない）

### テストケース


- [x] **TC-114-01**: ネットワークエラー時のウォームアップ失敗ハンドリング 🔵
  - **入力**: warmupCache() が Error('ECONNREFUSED 127.0.0.1:6379') で reject
  - **期待結果**: triggerStartupWarmup() が例外をスローせず、status が 'failed' + error に 'ECONNREFUSED' が含まれる
  - **信頼性**: 🔵 *startup-warmup.ts .catch() フロー・startup-warmup.test.ts line 140-151 より*

- [x] **TC-114-02**: タイムアウト時のウォームアップ失敗ハンドリング 🔵
  - **入力**: warmupCache() が Error('request timeout') で reject
  - **期待結果**: triggerStartupWarmup() が例外をスローせず、status が 'failed' + error に 'timeout' が含まれる
  - **信頼性**: 🔵 *startup-warmup.ts .catch() フロー・startup-warmup.test.ts line 140-151 より*


- [x] **TC-114-E01**: 非Error例外のウォームアップ失敗ハンドリング 🔵
  - **入力**: warmupCache() が文字列 'unknown failure' で reject
  - **期待結果**: triggerStartupWarmup() が例外をスローせず、status が 'failed' + error に 'unknown failure' が含まれる
  - **信頼性**: 🔵 *startup-warmup.ts line 73: err instanceof Error チェック・startup-warmup.test.ts より*

---

## REQ-115: ウォームアップ状態遷移監視テスト 🔵

**信頼性**: 🔵 *src/api/startup-warmup.ts WarmupStatusInfo 型・monitoring.ts health エンドポイントより*


> Given: startup-warmup モジュールが初期状態（pending）; 監視ヘルスエンドポイントが利用可能 | When: ウォームアップ状態が各遷移（pending → completed / failed / skipped）を経由する; 各状態で GET /api/v1/monitoring/health が呼び出される | Then: 各状態遷移で cacheWarmup フィールドが正しく反映される; pending: cacheWarmup.status = 'pending', error = undefined, timestamp = undefined; completed: cacheWarmup.status = 'completed', patternsProcessed = 数値, timestamp = ISO文字列; failed: cacheWarmup.status = 'failed', error = エラーメッセージ, timestamp = ISO文字列; skipped: cacheWarmup.status = 'skipped', timestamp = ISO文字列

### テストケース


- [x] **TC-115-01**: pending → completed 遷移のヘルスエンドポイント反映 🔵
  - **入力**: warmupCache() が true で resolve → ヘルスチェック
  - **期待結果**: cacheWarmup.status = 'completed' + patternsProcessed = 8
  - **信頼性**: 🔵 *startup-warmup.ts line 55-61・monitoring.ts line 111 より*

- [x] **TC-115-02**: pending → skipped（キャッシュ既にウォーム）遷移のヘルスエンドポイント反映 🔵
  - **入力**: warmupCache() が false で resolve → ヘルスチェック
  - **期待結果**: cacheWarmup.status = 'skipped' + timestamp が定義されている
  - **信頼性**: 🔵 *startup-warmup.ts line 63-67 より*

- [x] **TC-115-03**: pending → failed 遷移のヘルスエンドポイント反映 🔵
  - **入力**: warmupCache() が Error('connection refused') で reject → ヘルスチェック
  - **期待結果**: cacheWarmup.status = 'failed' + error = 'connection refused'
  - **信頼性**: 🔵 *startup-warmup.ts line 69-76 より*


- [x] **TC-115-B01**: ウォームアップ実行中（in-flight）のヘルスエンドポイント 🔵
  - **入力**: warmupCache() が未解決の Promise → ヘルスチェック
  - **期待結果**: cacheWarmup.status = 'pending'（ウォームアップ中は pending のまま）
  - **信頼性**: 🔵 *startup-warmup.ts 同期リターン設計・monitoring.ts line 111 より*

---

## Phase 52: ファイル名サニタイズ・テスト検証

### REQ-132: sanitizeFilename エッジケーステスト 🔵

**信頼性**: 🔵 *src/utils/sanitize.ts 実装・ISS-044 パストラバーサル防止要件より*


> Given: sanitizeFilename 関数が src/utils/sanitize.ts に定義されている; 関数はパストラバーサル防止・ヌルバイト除去・制御文字除去・ディレクトリセパレータ置換を実装 | When: 各エッジケース入力を sanitizeFilename() に渡す | Then: 入力に応じた安全なファイル名が出力される

### テストケース


- [x] **TC-132-01**: 通常のファイル名はそのまま返す 🔵
  - **入力**: `"video-output.mp4"`
  - **期待結果**: `"video-output.mp4"`
  - **信頼性**: 🔵 *sanitize.ts 基本動作より*

- [x] **TC-132-02**: 日本語ファイル名はそのまま返す 🔵
  - **入力**: `"図解動画_2024.mp4"`
  - **期待結果**: `"図解動画_2024.mp4"`
  - **信頼性**: 🔵 *sanitize.ts Unicode許容設計より*

- [x] **TC-132-03**: 前後の空白はトリムされる 🔵
  - **入力**: `"  output.mp4  "`
  - **期待結果**: `"output.mp4"`
  - **信頼性**: 🔵 *sanitize.ts .trim() より*


- [x] **TC-132-E01**: パストラバーサル（../）を除去 🔵
  - **入力**: `"../../../etc/passwd"`
  - **期待結果**: `"___etc_passwd"`
  - **信頼性**: 🔵 *ISS-044 パストラバーサル防止要件より*

- [x] **TC-132-E02**: ヌルバイト注入を除去 🔵
  - **入力**: `"file\x00.mp4"`
  - **期待結果**: `"file.mp4"`
  - **信頼性**: 🔵 *sanitize.ts NULL_BYTE_PATTERN より*

- [x] **TC-132-E03**: 制御文字を除去 🔵
  - **入力**: `"file\x01\x1f\x7f.mp4"`
  - **期待結果**: `"file.mp4"`
  - **信頼性**: 🔵 *sanitize.ts CONTROL_CHAR_PATTERN より*

- [x] **TC-132-E04**: ディレクトリセパレータを置換 🔵
  - **入力**: `"path/to\\file.mp4"`
  - **期待結果**: `"path_to_file.mp4"`
  - **信頼性**: 🔵 *sanitize.ts UNSAFE_PATTERN より*

- [x] **TC-132-E05**: 先頭ドット（隠しファイル）を除去 🔵
  - **入力**: `".hidden"`
  - **期待結果**: `"hidden"`
  - **信頼性**: 🔵 *sanitize.ts /^\.+/ パターンより*


- [x] **TC-132-B01**: 空文字列入力のフォールバック 🔵
  - **入力**: `""`
  - **期待結果**: `"unnamed"`
  - **信頼性**: 🔵 *sanitize.ts length === 0 フォールバックより*

- [x] **TC-132-B02**: 空白のみ入力のフォールバック 🔵
  - **入力**: `"   "`
  - **期待結果**: `"unnamed"`
  - **信頼性**: 🔵 *sanitize.ts trim後length === 0 フォールバックより*

- [x] **TC-132-B03**: 全て除去される入力のフォールバック 🔵
  - **入力**: `"..\\../.."`
  - **期待結果**: `"__"` （`..`除去後も`_`が残るため `"unnamed"` にはならない）
  - **信頼性**: 🔵 *sanitize.ts 全パターン適用後空チェックより*

---

### REQ-133: limits.ts 定数検証テスト 🔵

**信頼性**: 🔵 *src/config/limits.ts 集約化完了・REQ-071/REQ-073 要件より*


> Given: limits.ts に RATE_LIMITS・BATCH_LIMITS・SERVER_LIMITS・PIPELINE_LIMITS・SECURITY_LIMITS が定義されている; 各モジュールがこれらの定数を正しく参照している | When: limits.ts の各定数値を検証; 参照元モジュールでの使用箇所を確認 | Then: 定数値が期待値と一致する; マジックナンバーの漏れがない

### テストケース


- [x] **TC-133-01**: RATE_LIMITS.API が正しい値を持つ 🔵
  - **検証**: WINDOW_MS = 900000 (15min), MAX_REQUESTS = 100
  - **信頼性**: 🔵 *limits.ts 定義値・REQ-073 レート制限要件より*

- [x] **TC-133-02**: RATE_LIMITS.UPLOAD が正しい値を持つ 🔵
  - **検証**: WINDOW_MS = 900000 (15min), MAX_REQUESTS = 20
  - **信頼性**: 🔵 *limits.ts 定義値・REQ-073 レート制限要件より*

- [x] **TC-133-03**: BATCH_LIMITS が正しい値を持つ 🔵
  - **検証**: MAX_CONCURRENT_JOBS = 3, MAX_STORED_JOBS = 200, MAX_FILES_PER_BATCH = 100
  - **信頼性**: 🔵 *limits.ts 定義値・REQ-043 バッチ制約より*

- [x] **TC-133-04**: PIPELINE_LIMITS が正しい値を持つ 🔵
  - **検証**: MAX_SCENES = 200, MAX_ITERATIONS = 500, MAX_OUTPUT_NAME_LENGTH = 255, MAX_COMMIT_MESSAGE_LENGTH = 1000, MAX_FPS = 120
  - **信頼性**: 🔵 *limits.ts 定義値・REQ-071 Zod検証制約より*

- [x] **TC-133-05**: SECURITY_LIMITS が正しい値を持つ 🔵
  - **検証**: JWT_SECRET_MIN_LENGTH = 32, JWT_SECRET_MIN_CHAR_TYPES = 2
  - **信頼性**: 🔵 *limits.ts 定義値・REQ-078 JWT認証要件より*


- [x] **TC-133-B01**: 全定数が as const で不変であること 🔵
  - **検証**: TypeScript の型推論でリテラル型として推論されること
  - **信頼性**: 🔵 *limits.ts as const 宣言より*

---

### REQ-134: HealthCheckService 個別コンポーネント例外テスト 🔵

**信頼性**: 🔵 *REQ-131 本番コード堅牢化・src/monitoring/health-check-service.ts 個別 try-catch より*


> Given: HealthCheckService の各コンポーネントチェックが try-catch で保護されている; バックエンド（globalCache・realTimeMonitor）が例外を投げる可能性がある | When: 特定のコンポーネントのバックエンドだけが例外を投げる; performHealthCheck() が実行される | Then: 例外を投げたコンポーネントだけが "degraded" ステータスになる; 他のコンポーネントは正常に評価される; ヘルスチェック全体はクラッシュしない

### テストケース


- [x] **TC-134-E01**: globalCache.getStats() 例外時の checkCacheHealth 縮退 🔵
  - **条件**: globalCache.getStats() が Error('Redis unavailable') を投げる
  - **期待結果**: cacheHealth.status = 'degraded', 他コンポーネントは正常
  - **信頼性**: 🔵 *health-check-service.ts checkCacheHealth try-catch より*

- [x] **TC-134-E02**: realTimeMonitor.getSnapshot() 例外時の checkPipelineHealth 縮退 🔵
  - **条件**: realTimeMonitor.getSnapshot() が Error('Monitor crashed') を投げる
  - **期待結果**: pipelineHealth.status = 'degraded', 他コンポーネントは正常
  - **信頼性**: 🔵 *health-check-service.ts checkPipelineHealth try-catch より*

- [x] **TC-134-E03**: LLM メトリクス例外時の checkLLMHealth 縮退 🔵
  - **条件**: LLM メトリクス取得が例外を投げる
  - **期待結果**: llmHealth.status = 'degraded', 他コンポーネントは正常
  - **信頼性**: 🔵 *health-check-service.ts checkLLMHealth try-catch より*

- [x] **TC-134-E04**: エラー復旧メトリクス例外時の checkErrorRecoveryHealth 縮退 🔵
  - **条件**: エラー復旧スナップショット取得が例外を投げる
  - **期待結果**: errorRecoveryHealth.status = 'degraded', 他コンポーネントは正常
  - **信頼性**: 🔵 *health-check-service.ts checkErrorRecoveryHealth try-catch より*

- [x] **TC-134-E05**: パフォーマンス傾向例外時の checkPerformanceHealth 縮退 🔵
  - **条件**: パフォーマンス傾向取得が例外を投げる
  - **期待結果**: performanceHealth.status = 'degraded', 他コンポーネントは正常
  - **信頼性**: 🔵 *health-check-service.ts checkPerformanceHealth try-catch より*

- [x] **TC-134-E06**: 複数コンポーネント同時例外時の安定性 🔵
  - **条件**: globalCache と realTimeMonitor の両方が例外を投げる
  - **期待結果**: 該当コンポーネントが全て degraded、ヘルスチェック全体はクラッシュしない
  - **信頼性**: 🔵 *health-check-service.ts 独立 try-catch 設計より*

---

## REQ-135: 仕様ドキュメント最適化 🔵

**信頼性**: 🔵 *AI Hub iteration feedback: spec doc hotspot files grew 370 lines・acceptance-criteria.md Phase 44-52 = 54.2% より*

### Given（前提条件）

- acceptance-criteria.md が 2,007 行（圧縮後・Phase 44-52 重複セクション集約済み）
- interview-record.md が 2,495 行
- 完了済みフェーズのテストケースサマリー・信頼性レベル分布・実施計画セクションが各フェーズで重複記載

### When（実行条件）

- 完了済みフェーズ（Phase 44~51）の重複セクション（信頼性レベル分布表・テストケースサマリー表・テスト実施計画）を簡潔な完了ステータスに集約する

### Then（期待結果）

- acceptance-criteria.md の全体行数が15%以上削減される
- テストケース定義（TC-xxx-xx エントリ）は全て保持される
- REQ-132~134 の Phase 52 セクションは保持される

### テストケース

#### 正常系

- [x] **TC-135-01**: acceptance-criteria.md 行数削減率検証 🔵
  - **測定**: 削減前後の行数比較
  - **期待結果**: 削減率 ≥ 15%（2,876行 → 2,444行以下）
  - **信頼性**: 🔵 *現状 2,876 行・Phase 44-52 が 1,561 行より*

- [x] **TC-135-02**: テストケース定義保持確認 🔵
  - **測定**: 全 TC-xxx-xx エントリの存在確認
  - **期待結果**: TC-001-01 ~ TC-134-E06 の全テストケースが保持される
  - **信頼性**: 🔵 *テストケースは原本情報・削除不可*

- [x] **TC-135-03**: Phase 52 セクション保持確認 🔵
  - **測定**: REQ-132/133/134 セクションの完全性確認
  - **期待結果**: Phase 52 全23テストケースが保持される
  - **信頼性**: 🔵 *最新フェーズ・原本情報*

---

## REQ-136: use-toast.ts フックユニットテスト 🔵

**信頼性**: 🔵 *src/hooks/use-toast.ts (186行) 既存実装・テストファイルなし より*

### Given（前提条件）

- use-toast.ts がトースト状態管理（reducer パターン）を提供
- トースト追加・更新・削除・キュー管理・自動非表示機能を実装
- 専用ユニットテストファイルが存在しない

### When（実行条件）

- use-toast.ts の reducer・状態管理ロジックに対するユニットテストを作成・実行する

### Then（期待結果）

- 全 reducer パターンがテストされる
- キュー上限・自動非表示・タイマークリーンアップが検証される

### テストケース

#### 正常系

- [x] **TC-136-01**: トースト追加（ADD_TOAST）の状態変更 🔵
  - **入力**: reducer state(空) + ADD_TOAST action
  - **期待結果**: toasts 配列に新しいトーストが追加される
  - **信頼性**: 🔵 *use-toast.ts reducer case ADD_TOAST より*

- [x] **TC-136-02**: トースト更新（UPDATE_TOAST）の状態変更 🔵
  - **入力**: reducer state(既存トースト) + UPDATE_TOAST action
  - **期待結果**: 指定IDのトーストが更新される
  - **信頼性**: 🔵 *use-toast.ts reducer case UPDATE_TOAST より*

- [x] **TC-136-03**: トースト削除（DISMISS_TOAST）の状態変更 🔵
  - **入力**: reducer state(既存トースト) + DISMISS_TOAST action
  - **期待結果**: 指定IDのトーストが open=false に更新される
  - **信頼性**: 🔵 *use-toast.ts reducer case DISMISS_TOAST より*

- [x] **TC-136-04**: トースト完全削除（REMOVE_TOAST）の状態変更 🔵
  - **入力**: reducer state(既存トースト) + REMOVE_TOAST action
  - **期待結果**: 指定IDのトーストが配列から除去される
  - **信頼性**: 🔵 *use-toast.ts reducer case REMOVE_TOAST より*

#### 境界値

- [x] **TC-136-B01**: 存在しないIDのトースト更新 🔵
  - **入力**: reducer state + UPDATE_TOAST(id: "non-existent")
  - **期待結果**: 状態変更なし（冪等性）
  - **信頼性**: 🔵 *reducer 実装の null ガードより*

---

## REQ-137: useFrameworkPipeline.ts フックユニットテスト 🔵

**信頼性**: 🔵 *src/hooks/useFrameworkPipeline.ts (385行) 既存実装・テストファイルなし より*

### Given（前提条件）

- useFrameworkPipeline.ts が FrameworkIntegratedPipeline との連携を管理
- パイプライン実行状態・イテレーション履歴・品質メトリクス・エラー回復を追跡
- 専用ユニットテストファイルが存在しない

### When（実行条件）

- useFrameworkPipeline.ts の状態管理・パイプラインインタラクションに対するユニットテストを作成・実行する

### Then（期待結果）

- パイプライン実行開始・完了・エラーの状態遷移が検証される
- イテレーション履歴の蓄積・品質メトリクスの更新が検証される

### テストケース

#### 正常系

- [x] **TC-137-01**: 初期状態の検証 🔵
  - **期待結果**: isRunning=false, error=null, iterationHistory=[] の初期状態
  - **信頼性**: 🔵 *useFrameworkPipeline.ts useState 初期値より*

- [x] **TC-137-02**: パイプライン実行開始時の状態変更 🔵
  - **入力**: execute() 呼び出し
  - **期待結果**: isRunning=true に遷移
  - **信頼性**: 🔵 *useFrameworkPipeline.ts 実行状態管理より*

- [x] **TC-137-03**: パイプライン実行完了時の状態変更 🔵
  - **入力**: パイプライン実行完了
  - **期待結果**: isRunning=false, iterationHistory に結果が蓄積
  - **信頼性**: 🔵 *useFrameworkPipeline.ts 完了処理より*

#### 異常系

- [x] **TC-137-E01**: パイプライン実行エラー時の状態変更 🔵
  - **条件**: パイプラインが例外をスロー
  - **期待結果**: isRunning=false, error にエラーメッセージが設定
  - **信頼性**: 🔵 *useFrameworkPipeline.ts catch ブロックより*

---

## REQ-138: logger.ts・memory-usage.ts ユーティリティテスト 🔵

**信頼性**: 🔵 *src/utils/logger.ts (32行)・src/utils/memory-usage.ts (44行) 既存実装・テストファイルなし より*

### Given（前提条件）

- logger.ts が LogLevel enum（DEBUG/INFO/WARN/ERROR/SILENT）によるログレベルフィルタリングを提供
- memory-usage.ts が Node.js（process.memoryUsage）/ Chrome（performance.memory）/ フォールバックの3環境でメモリ取得を提供
- 専用ユニットテストファイルが存在しない

### When（実行条件）

- logger.ts と memory-usage.ts のコア機能に対するユニットテストを作成・実行する

### Then（期待結果）

- ログレベルフィルタリングが正しく動作する
- クロスプラットフォームメモリ取得が各環境で検証される

### テストケース

#### 正常系

- [x] **TC-138-01**: logger.info がプレフィックス付きメッセージを出力 🔵
  - **入力**: logger.info("test message")
  - **期待結果**: "[INFO] test message" が出力される
  - **信頼性**: 🔵 *logger.ts info メソッド実装より*

- [x] **TC-138-02**: memory-usage.ts Node.js 環境での取得 🔵
  - **条件**: process.memoryUsage が利用可能
  - **期待結果**: heapUsed > 0, heapTotal > 0, rss > 0
  - **信頼性**: 🔵 *memory-usage.ts Node.js 分岐より*

#### 異常系

- [x] **TC-138-E01**: memory-usage.ts フォールバック動作 🔵
  - **条件**: process も performance.memory も利用不可
  - **期待結果**: { heapUsed: 0, heapTotal: 0 } を返す
  - **信頼性**: 🔵 *memory-usage.ts フォールバック return より*

---

## REQ-144: AudioUploader centralized validation 統合 🔵

**信頼性**: 🔵 *src/components/AudioUploader.tsx 32-38行インライン検証・src/utils/audio-validation.ts 統合パターン・EnhancedFileUploader.tsx 統合例 より*

### Given（前提条件）

- AudioUploader.tsx がインライン MIME type チェック（`audio/*`）のみ実行
- centralized audio-validation.ts が validateAudioFile() + validateAudioDuration() を提供
- EnhancedFileUploader.tsx と SimplePipelineInterface.tsx は既に統合済み

### When（実行条件）

- AudioUploader.tsx のインライン検証を validateAudioFile() に置換
- validateAudioDuration() を用いた非同期音声長チェックを追加

### Then（期待結果）

- EDGE-001（空ファイル）が AudioUploader で検出される
- EDGE-101（50MB超過）が AudioUploader で検出される
- EDGE-102（1秒未満）が AudioUploader でリジェクトされる
- EDGE-103（1時間超過）が AudioUploader で警告表示される

### テストケース

#### 正常系

- [x] **TC-144-01**: AudioUploader が有効な音声ファイルを受け入れる 🔵
  - **入力**: MP3 ファイル（10MB、3分）
  - **期待結果**: ファイルが選択され、エラーなし
  - **信頼性**: 🔵 *EnhancedFileUploader 統合パターンより*

#### 異常系

- [x] **TC-144-E01**: AudioUploader が空ファイルをリジェクト 🔵
  - **入力**: 0バイトのファイル（audio/mpeg MIME type）
  - **期待結果**: エラーメッセージ表示
  - **信頼性**: 🔵 *EDGE-001 テストパターンより*

- [x] **TC-144-E02**: AudioUploader が50MB超過ファイルをリジェクト 🔵
  - **入力**: 51MB の音声ファイル
  - **期待結果**: ファイルサイズエラー表示
  - **信頼性**: 🔵 *EDGE-101 テストパターンより*

#### 境界値

- [x] **TC-144-B01**: AudioUploader が1秒未満音声をリジェクト 🔵
  - **入力**: 0.5秒の音声ファイル
  - **期待結果**: 音声が短すぎるエラー表示
  - **信頼性**: 🔵 *EDGE-102 テストパターンより*

---

## REQ-145: 音声制限定数統合 🔵

**信頼性**: 🔵 *src/transcription/types.ts MAX_FILE_SIZE vs src/config/limits.ts AUDIO_LIMITS の重複定義 より*

### Given（前提条件）

- types.ts に MAX_FILE_SIZE（51,024,000）が定義
- config/limits.ts に AUDIO_LIMITS.MAX_FILE_SIZE_BYTES が定義
- SUPPORTED_AUDIO_FORMATS が3箇所で個別定義

### When（実行条件）

- 重複定数を AUDIO_LIMITS に統合
- types.ts から AUDIO_LIMITS を再エクスポートして互換性維持

### Then（期待結果）

- 音声制限定数が単一出処（config/limits.ts）に集約
- 既存インポートの互換性が維持される

### テストケース

- [x] **TC-145-01**: types.ts 再エクスポート値が AUDIO_LIMITS と一致 🔵
  - **期待結果**: MAX_FILE_SIZE === AUDIO_LIMITS.MAX_FILE_SIZE_BYTES
  - **信頼性**: 🔵 *既存 limits.test.ts パターンより*

---

## REQ-146: whisper-transcriber 検証統合 🔵

**信頼性**: 🔵 *src/transcription/whisper-transcriber.ts validateAudioInput() 121-129行・src/transcription/transcriber.ts validateAudioFile() 172-200行 より*

### Given（前提条件）

- whisper-transcriber.ts が独自の形式・サイズ検証を実装
- transcriber.ts が独自の validateAudioFile() メソッドを実装
- centralized audio-validation.ts が基本検証を提供

### When（実行条件）

- 基本検証（形式・サイズ）を centralized validateAudioFile() に委譲
- 破損検出（magic byte check）は追加レイヤーとして維持

### Then（期待結果）

- 基本検証ロジックの重複が解消
- 破損検出は維持される

### テストケース

- [x] **TC-146-01**: 基本検証が centralized module に委譲 🔵
  - **期待結果**: whisper-transcriber が validateAudioFile を import して使用
  - **信頼性**: 🔵 *EnhancedFileUploader 統合例より*

---

## REQ-147: AudioUploader コンポーネントユニットテスト 🔵

**信頼性**: 🔵 *src/components/AudioUploader.tsx テストファイル不在・Phase 55 audio-validation.test.ts 27テストパターン より*

### Given（前提条件）

- AudioUploader.tsx に対応するテストファイルが存在しない
- REQ-144 統合後の動作を検証するテストが必要

### When（実行条件）

- AudioUploader コンポーネントのユニットテストを作成

### Then（期待結果）

- ファイル選択・バリデーションエラー・継続警告のテストケースが全て通過

### テストケース

- [x] **TC-147-01**: AudioUploader 正常ファイル選択 🔵
  - **期待結果**: 有効な音声ファイルが selectedFile に設定される
  - **信頼性**: 🔵 *AudioUploader.tsx setSelectedFile フローより*

- [x] **TC-147-02**: AudioUploader 非音声ファイルリジェクト 🔵
  - **期待結果**: エラートースト表示
  - **信頼性**: 🔵 *AudioUploader.tsx else ブロックより*

- [x] **TC-147-E01**: AudioUploader 空ファイルリジェクト 🔵
  - **期待結果**: EDGE-001 エラー表示
  - **信頼性**: 🔵 *validateAudioFile 空ファイル検出より*

---

## REQ-148: LLMキャッシュデバウンステスト 🔵

**信頼性**: 🔵 *llm-cache.ts scheduleSave/destroy/persist 実装・AI Hub フィードバックより*

### テストケース

#### scheduleSave coalescing

- [x] **TC-148-01**: 複数の rapid set() 呼び出しが1回のディスク書き込みに結合されること 🔵
  - **入力**: 10回の set() 呼び出し（debounceMs: 50ms）
  - **期待結果**: debounce 経過前にファイル未作成、経過後に10エントリで1回書き込み
  - **信頼性**: 🔵 *scheduleSave coalescing ロジックより*

- [x] **TC-148-02**: set() 呼び出しが debounce 間隔をまたぐ場合、別々の書き込みが発生すること 🔵
  - **入力**: set() → 30ms経過 → set() → 30ms経過
  - **期待結果**: 2回のディスク書き込み
  - **信頼性**: 🔵 *debounce タイマーリセット動作より*

- [x] **TC-148-03**: 中間の set() が debounce タイマーをリセットすること 🔵
  - **入力**: set() → 80ms経過 → set() → 30ms経過（合計110ms、2回目から30ms）
  - **期待結果**: ファイル未作成（debounce 未完了）→ さらに70ms経過後、2エントリで書き込み
  - **信頼性**: 🔵 *scheduleSave clearTimeout + setTimeout ロジックより*

#### destroy() cancellation

- [x] **TC-148-04**: destroy() が保留中の debounced save をキャンセルすること 🔵
  - **入力**: set() → destroy() → 500ms経過
  - **期待結果**: ファイル未作成
  - **信頼性**: 🔵 *destroy() clearTimeout ロジックより*

- [x] **TC-148-05**: destroy() が冪等であること 🔵
  - **入力**: destroy() を2回連続呼び出し
  - **期待結果**: 例外なし
  - **信頼性**: 🔵 *destroy() null check ロジックより*

- [x] **TC-148-06**: destroy() 後の set() が新しい debounced save をスケジュールすること 🔵
  - **入力**: set('first') → destroy() → 100ms経過 → set('second') → 50ms経過
  - **期待結果**: 最初のエントリはディスク未書き込み（destroyでキャンセル）、2回目の set 後に両エントリが書き込まれる（in-memory cache保持）
  - **信頼性**: 🔵 *destroy() はtimerのみキャンセルしin-memoryをクリアしない設計より*

#### persist() immediate flush

- [x] **TC-148-07**: persist() が即時書き込みを行い、保留中の debounce をキャンセルすること 🔵
  - **入力**: set() → persist()（debounceMs: 500ms）
  - **期待結果**: タイマー経過なしで即座にファイル作成
  - **信頼性**: 🔵 *persist() clearTimeout + saveToDisk ロジックより*

- [x] **TC-148-08**: persist() 後のタイマー経過で二重書き込みが発生しないこと 🔵
  - **入力**: set() → persist() → 200ms経過
  - **期待結果**: ファイル mtime が変化しない（タイマーはキャンセル済み）
  - **信頼性**: 🔵 *persist() timer=null 設定ロジックより*

- [x] **TC-148-09**: persistPath なしで persist() が no-op であること 🔵
  - **入力**: persistPath 未設定のキャッシュで set() → persist()
  - **期待結果**: 例外なし
  - **信頼性**: 🔵 *persistEnabled=false の分岐ロジックより*

#### timer interval accuracy

- [x] **TC-148-10**: debounceMs 経過前に書き込みが発生しないこと 🔵
  - **入力**: set() → 199ms経過（debounceMs: 200ms）
  - **期待結果**: ファイル未作成
  - **信頼性**: 🔵 *setTimeout 遅延ロジックより*

- [x] **TC-148-11**: debounceMs 経過後に書き込みが発生すること 🔵
  - **入力**: set() → 200ms経過（debounceMs: 200ms）
  - **期待結果**: ファイル作成、エントリ1件
  - **信頼性**: 🔵 *setTimeout コールバックロジックより*

#### clearExpired re-scheduling

- [x] **TC-148-12**: clearExpired() が新しい debounced save をスケジュールすること 🔵
  - **入力**: ttlMinutes: 0 で set() → clearExpired() → 100ms経過
  - **期待結果**: ファイル作成、期限切れエントリは0件
  - **信頼性**: 🔵 *clearExpired() scheduleSave 呼び出しロジックより*

- [x] **TC-148-13**: clearExpired() が保留中の debounce を結合すること 🔵
  - **入力**: set() → clearExpired() → 100ms経過
  - **期待結果**: ファイル作成、エントリ1件
  - **信頼性**: 🔵 *scheduleSave coalescing ロジックより*

#### persistDebounceMs: 0 fallback

- [x] **TC-148-14**: persistDebounceMs: 0 で set() が同期的に書き込むこと 🔵
  - **入力**: set()（debounceMs: 0）
  - **期待結果**: タイマー経過なしで即座にファイル作成
  - **信頼性**: 🔵 *debounceMs <= 0 分岐の saveToDisk 直接呼び出しより*

- [x] **TC-148-15**: persistDebounceMs: 0 で destroy() が安全であること 🔵
  - **入力**: set() → destroy()（debounceMs: 0）
  - **期待結果**: 例外なし
  - **信頼性**: 🔵 *saveTimer=null での clearTimeout 安全性より*

---

## REQ-150: 可変シーンデュレーション 🔵

**信頼性**: 🔵 *src/pipeline/smoke-orchestrator.ts RawDiagram.durationMs・buildMultiScenes 累積計算・コミット3951e69 より*

### Given（前提条件）

- RawDiagram がオプションの durationMs フィールドをサポート
- デフォルトシーンデュレーションは5000ms
- マルチシーン構築で各シーンの startMs を前シーンの累積 durationMs から計算

### When（実行条件）

- 異なる durationMs を持つ複数の RawDiagram を buildMultiScenes で処理

### Then（期待結果）

- 各シーンの durationMs が指定値またはデフォルト5000msとなる
- 各シーンの startMs が前シーンの累積 durationMs となる

### テストケース

#### 正常系

- [x] **TC-150-01**: デフォルト durationMs（省略時5000ms）が使用されること 🔵
  - **入力**: durationMs 未指定の RawDiagram
  - **期待結果**: scene.durationMs === 5000
  - **信頼性**: 🔵 *DEFAULT_SCENE_DURATION_MS 定数より*

- [x] **TC-150-02**: カスタム durationMs が反映されること 🔵
  - **入力**: durationMs: 3000 の RawDiagram
  - **期待結果**: scene.durationMs === 3000
  - **信頼性**: 🔵 *buildSingleScene nullish coalescing より*

- [x] **TC-150-03**: マルチシーンの累積 startMs 計算 🔵
  - **入力**: [{durationMs: 3000}, {durationMs: 7000}, {}] の3シーン
  - **期待結果**: startMs が [0, 3000, 10000] となる
  - **信頼性**: 🔵 *buildMultiScenes currentMs += scene.durationMs より*

---

## REQ-151: シーンID生成 🔵

**信頼性**: 🔵 *src/pipeline/smoke-orchestrator.ts SceneGraph.id・コミット931ae7a より*

### Given（前提条件）

- MultiFormatExporter が SceneGraph.id をファイル名に使用
- 旧実装では id が undefined でファイル名エラーが発生

### When（実行条件）

- buildSingleScene で SceneGraph を生成

### Then（期待結果）

- SceneGraph.id が `scene-${startMs}` 形式で設定される
- エクスポート時のファイル名が undefined とならない

### テストケース

- [x] **TC-151-01**: SceneGraph.id が正しい形式で生成されること 🔵
  - **入力**: startMs=0 のシーン
  - **期待結果**: scene.id === "scene-0"
  - **信頼性**: 🔵 *buildSingleScene id テンプレートリテラルより*

- [x] **TC-151-02**: マルチシーンで一意のIDが生成されること 🔵
  - **入力**: 3シーン（startMs: 0, 5000, 10000）
  - **期待結果**: IDs が ["scene-0", "scene-5000", "scene-10000"]
  - **信頼性**: 🔵 *buildMultiScenes 累積 startMs より*

---

## REQ-152: JSONエクスポート SceneGraph シリアライズ 🔵

**信頼性**: 🔵 *src/export/multi-format-exporter.ts・コミット931ae7a より*

### Given（前提条件）

- MultiFormatExporter の JSON 出力が旧フィールド（content, startTime, endTime, confidence）をシリアライズしていた
- SceneGraph の実際のフィールド（nodes, edges, startMs, durationMs, summary, keyphrases, id, type）が未シリアライズ

### When（実行条件）

- MultiFormatExporter で JSON エクスポートを実行

### Then（期待結果）

- 全 SceneGraph フィールドが正しく JSON に含まれる
- 旧フィールドは出力されない

### テストケース

- [x] **TC-152-01**: JSON 出力に全 SceneGraph フィールドが含まれること 🔵
  - **入力**: SceneGraph（nodes, edges, startMs, durationMs, summary, keyphrases, id, type）
  - **期待結果**: JSON 出力に全フィールドが含まれる
  - **信頼性**: 🔵 *multi-format-exporter.ts シリアライズロジックより*

---

## REQ-153: キャプションインデックス連続性 🔵

**信頼性**: 🔵 *src/pipeline/smoke-orchestrator.ts buildMultiScenes globalIndex・コミット3951e69 より*

### Given（前提条件）

- マルチシーン構築時、各シーンのキャプションインデックスが重複していた
- SRT 形式ではインデックスのグローバル一意性が要求される

### When（実行条件）

- 複数の RawDiagram を buildMultiScenes で処理

### Then（期待結果）

- キャプションインデックスがシーン間でグローバルに一意・連続となる

### テストケース

- [x] **TC-153-01**: マルチシーンでキャプションインデックスが連続すること 🔵
  - **入力**: 2シーン（各2キャプション）
  - **期待結果**: インデックスが [1, 2, 3, 4] となる
  - **信頼性**: 🔵 *buildMultiScenes globalIndex++ より*

---

## REQ-154: PipelineAbortError 構造化エラー 🔵

**信頼性**: 🔵 *src/pipeline/pipeline-errors.ts PipelineAbortError・コミット5d9c1f1 より*

### Given（前提条件）

- pipeline-orchestrator.ts で raw Error throw を使用していた
- ErrorClassifier が regex ベースでエラー分類を行い、精度に限界があった

### When（実行条件）

- パイプラインの中断条件（品質ゲート失敗・リカバリ限界超過）が発生

### Then（期待結果）

- PipelineAbortError がスローされる（errorType=QUALITY_GATE_FAILED, stage=abort）
- ErrorClassifier が instanceof チェックで正確にトリアージ可能

### テストケース

- [x] **TC-154-01**: PipelineAbortError が正しい errorType と stage を持つこと 🔵
  - **期待結果**: error.errorType === 'QUALITY_GATE_FAILED', error.stage === 'abort'
  - **信頼性**: 🔵 *pipeline-errors.ts コンストラクタより*

- [x] **TC-154-02**: PipelineAbortError が PipelineError を継承すること 🔵
  - **期待結果**: error instanceof PipelineError === true
  - **信頼性**: 🔵 *extends PipelineError 宣言より*

- [x] **TC-154-03**: PipelineAbortError が Error と区別可能であること 🔵
  - **期待結果**: error instanceof PipelineAbortError === true, error instanceof Error === true
  - **信頼性**: 🔵 *pipeline-errors.test.ts より*

---

## REQ-155: PipelineAbortError→ErrorClassifier 統合テスト 🔵

**信頼性**: 🔵 *AI Hub フィードバック対応・REQ-154継続・src/pipeline/pipeline-orchestrator.ts + src/quality/error-classifier.ts より*

### Given（前提条件）

- PipelineOrchestrator が品質ゲート失敗時に PipelineAbortError をスローする（REQ-154）
- ErrorClassifier が errorType ベースでエラー分類・リカバリ戦略選択を行う
- ErrorClassifier 単体テストは存在するが、PipelineOrchestrator→ErrorClassifier の直結統合テストが不在

### When（実行条件）

- PipelineOrchestrator の品質ゲートが失敗し PipelineAbortError がスローされる
- ErrorClassifier.classify() にそのエラーが渡される

### Then（期待結果）

- ErrorClassifier が errorType=QUALITY_GATE_FAILED として正確に分類
- 適切なリカバリ戦略（retry/fallback/abort）が返される
- エラー情報がリカバリレポートに伝播

### テストケース

- [x] **TC-155-01**: PipelineOrchestrator 品質ゲート失敗→ErrorClassifier が QUALITY_GATE_FAILED に分類 🔵
  - **入力**: 品質スコアが閾値を下回るパイプライン実行
  - **期待結果**: ErrorClassifier.classify(abortError).errorType === 'QUALITY_GATE_FAILED'
  - **信頼性**: 🔵 *pipeline-orchestrator.ts + error-classifier.ts 実装より*

- [x] **TC-155-02**: ErrorClassifier が PipelineAbortError に対して abort リカバリ戦略を返す 🔵
  - **入力**: PipelineAbortError インスタンス
  - **期待結果**: classify() の結果が適切なリカバリ戦略を含む
  - **信頼性**: 🔵 *error-classifier.ts 戦略マッピングより*

- [x] **TC-155-03**: 複数の PipelineAbortError が同時に発生しても ErrorClassifier が独立して分類 🔵
  - **入力**: 並列パイプライン実行で複数の PipelineAbortError
  - **期待結果**: 各エラーが独立して正確に分類される
  - **信頼性**: 🔵 *pipeline-recovery-e2e.test.ts 並列テストパターンより*

---

## REQ-156: 残存 raw Error throw 型付きエラー置換 🔵

**信頼性**: 🔵 *コミット1f950c9 で6箇所置換済・残存5箇所の grep 結果より*

### Given（前提条件）

- コミット1f950c9 で6箇所の raw Error throw を型付きエラーに置換済
- 残存5箇所: simple-pipeline.ts:1・smoke-orchestrator.ts:3・adaptive-quality-presets.ts:1

### When（実行条件）

- 残存5箇所の raw Error throw を適切な型付きエラークラスに置換

### Then（期待結果）

- src/pipeline/ 内の raw Error throw が0件となる
- 全パイプラインエラーが ErrorClassifier で正確に分類可能

### テストケース

- [x] **TC-156-01**: simple-pipeline.ts の raw Error が PipelineError に置換される 🔵
  - **入力**: 処理失敗時のエラー
  - **期待結果**: throw new PipelineError(...) に置換、errorType が設定される
  - **信頼性**: 🔵 *grep "throw new Error" simple-pipeline.ts:666 より*

- [x] **TC-156-02**: smoke-orchestrator.ts の3箇所 raw Error が型付きエラーに置換される 🔵
  - **入力**: レンダープラン検証失敗・パラメータエラー
  - **期待結果**: PipelineConfigError/RenderingError に置換
  - **信頼性**: 🔵 *grep "throw new Error" smoke-orchestrator.ts:203,215,261 より*

- [x] **TC-156-03**: adaptive-quality-presets.ts の raw Error が QualityGateError に置換される 🔵
  - **入力**: 無効なプリセット名
  - **期待結果**: QualityGateError または PipelineConfigError に置換
  - **信頼性**: 🔵 *grep "throw new Error" adaptive-quality-presets.ts:201 より*

- [x] **TC-156-04**: 置換後も全既存テストが通過する 🔵
  - **期待結果**: npm test 全通過
  - **信頼性**: 🔵 *既存1,390+テストの回帰防止*

---

## REQ-157: PipelineAbortError round-trip 検証テスト 🔵

**信頼性**: 🔵 *AI Hub フィードバック「round-trip validation tests」対応・REQ-154/155 継続*

### Given（前提条件）

- PipelineAbortError がパイプラインオーケストレーターでスローされる
- ErrorClassifier がエラーを分類しリカバリ戦略を返す
- リカバリオーケストレーターが戦略を実行しリカバリレポートを生成する
- 各段階の単体テストは存在するが、全往復の統合テストが不在

### When（実行条件）

- パイプライン実行中に PipelineAbortError が発生
- エラー→分類→戦略→リカバリレポートの全チェーンが実行

### Then（期待結果）

- PipelineAbortError の errorType がリカバリレポートに正しく反映
- リカバリ戦略の実行結果がレポートに記録
- レポートの最終ステータスが正確（failure/degraded/recovered）

### テストケース

- [x] **TC-157-01**: PipelineAbortError→ErrorClassifier→リカバリ戦略→リカバリレポートの完全往復 🔵
  - **入力**: 品質ゲート失敗を発生させるパイプライン実行
  - **期待結果**: リカバリレポートに errorType=QUALITY_GATE_FAILED・戦略実行結果・最終ステータスが記録
  - **信頼性**: 🔵 *pipeline-recovery-e2e.test.ts パターン拡張*

- [x] **TC-157-02**: 型付きエラーのプロパティが往復チェーン全体で保存される 🔵
  - **入力**: stage/phase 情報付きの PipelineAbortError
  - **期待結果**: リカバリレポートに stage・phase・errorType が全て記録
  - **信頼性**: 🔵 *pipeline-errors.ts プロパティ定義より*

- [x] **TC-157-03**: raw Error（型付きエラー未置換）が混在しても round-trip が正常動作 🔵
  - **入力**: PipelineAbortError と raw Error が混在するパイプライン実行
  - **期待結果**: 両方とも ErrorClassifier で適切に分類される
  - **信頼性**: 🔵 *error-classifier.ts フォールバック分類ロジックより*

---

## REQ-158: npm audit 脆弱性0件維持 🔵

**信頼性**: 🔵 *Phase 39(REQ-109)で0件達成の実績・SYSTEM_CONSTITUTION.md メトリクス監視*

### Given（前提条件）

- 現在 npm audit で10件の moderate 脆弱性が存在
- Phase 39(REQ-109) で0件を達成した実績がある

### When（実行条件）

- npm audit fix または依存パッケージの更新を実行

### Then（期待結果）

- npm audit で0件の脆弱性

### テストケース

- [x] **TC-158-01**: npm audit 実行で脆弱性が0件 🔵
  - **期待結果**: `npm audit` 出力が "found 0 vulnerabilities"
  - **信頼性**: 🔵 *2026-05-28確認: 0件・Phase 39 実績より*

---

## REQ-159: ErrorClassifier→オーケストレーター統合 🔵

**信頼性**: 🔵 *コミットee06c0eで実装済・src/pipeline/pipeline-orchestrator.ts catch ブロックより*

### Given（前提条件）

- PipelineOrchestrator が catch ブロックでエラーを捕捉する
- ErrorClassifier がエラーを11種に分類できる

### When（実行条件）

- パイプライン実行中にエラーが発生しcatchブロックに到達
- ErrorClassifier がエラーを分類

### Then（期待結果）

- キャッチされたエラーが ErrorClassifier で構造化トリアージされる
- 分類結果がリカバリオーケストレーターに渡される

### テストケース

- [x] **TC-159-01**: PipelineOrchestrator catch ブロックで ErrorClassifier が呼び出される 🔵
  - **期待結果**: catch ブロック内で errorClassifier.classify(error) が実行される
  - **信頼性**: 🔵 *コミットee06c0e・src/pipeline/pipeline-orchestrator.ts より*

---

## REQ-160: 品質モジュール raw Error 置換 🔵

**信頼性**: 🔵 *Phase 59-60でパイプライン21箇所完了・src/quality/3ファイル8箇所grep確認*

### Given（前提条件）

- 品質モジュール（src/quality/）に8箇所の raw Error throw が残存する
- enhanced-error-recovery.ts: 3箇所（CircuitBreaker open rejection・キャッシュミス・maxAgeMs検証）
- pipeline-run-recovery-tracker.ts: 2箇所（アクティブラン衝突・アクティブラン不在）
- regression-detector.ts: 3箇所（メトリクス未取得・ベースライン未確立・現在値未取得）

### When（実行条件）

- 8箇所の raw Error throw を適切な型付きエラークラスに置換

### Then（期待結果）

- src/quality/ 内の raw Error throw が0件になる
- 各置換後も既存テストが全て通過する

### テストケース

- [x] **TC-160-01**: enhanced-error-recovery.ts の3箇所 raw Error が型付きエラーに置換される 🔵
  - **期待結果**: CircuitBreaker open rejection → QualityGateError または適切な型、キャッシュミス・maxAgeMs検証も適切な型付きエラー
  - **信頼性**: 🔵 *grep "throw new Error" src/quality/enhanced-error-recovery.ts 確認*

- [x] **TC-160-02**: pipeline-run-recovery-tracker.ts の2箇所 raw Error が型付きエラーに置換される 🔵
  - **期待結果**: アクティブラン衝突・不在が適切な型付きエラーに置換
  - **信頼性**: 🔵 *grep "throw new Error" src/quality/pipeline-run-recovery-tracker.ts 確認*

- [x] **TC-160-03**: regression-detector.ts の3箇所 raw Error が型付きエラーに置換される 🔵
  - **期待結果**: メトリクス未取得・ベースライン未確立・現在値未取得が適切な型付きエラーに置換
  - **信頼性**: 🔵 *grep "throw new Error" src/quality/regression-detector.ts 確認*

- [x] **TC-160-04**: 置換後 grep "throw new Error(" src/quality/ で0件 🔵
  - **期待結果**: src/quality/ 全ファイルで raw Error throw が0件
  - **信頼性**: 🔵 *Phase 59-60 パターンと同一*

---

## REQ-161: 品質モジュール ErrorClassifier 回帰テスト 🔵

**信頼性**: 🔵 *REQ-159 ErrorClassifier統合の品質モジュール拡張*

### Given（前提条件）

- 品質モジュールの raw Error が型付きエラーに置換済み（REQ-160）
- ErrorClassifier がパイプラインモジュールのエラー分類で実績あり

### When（実行条件）

- 新しい型付きエラーが ErrorClassifier に渡される

### Then（期待結果）

- ErrorClassifier が品質モジュールの型付きエラーを正確に分類する
- 分類結果が既存の ErrorClassifier テストと一貫している

### テストケース

- [x] **TC-161-01**: 品質モジュールの新しい型付きエラーが ErrorClassifier で正確に分類される 🔵
  - **期待結果**: 各型付きエラーの errorType が期待値と一致
  - **信頼性**: 🔵 *tests/unit/quality/error-classifier.test.ts パターン拡張*

- [x] **TC-161-02**: 品質モジュールの型付きエラーがパイプラインリカバリチェーンで正しく伝播 🔵
  - **期待結果**: throw→classify→strategy→recovery-report の往復が成功
  - **信頼性**: 🔵 *REQ-157 round-trip テストパターン*

---

## REQ-162: diagram-detector.ts テストカバレッジ 🔵

**信頼性**: 🔵 *src/analysis/diagram-detector.ts 1,406行・パイプラインStage 2図解タイプ検出のコア*

### Given（前提条件）

- diagram-detector.ts が11種の図解タイプ検出を実装
- 専用テストファイルが存在しない

### When（実行条件）

- diagram-detector.ts のコア機能に対するユニットテストを作成

### Then（期待結果）

- 図解タイプ検出・キーワードマッチング・スコアリング・フォールバックロジックがテストカバーされる

### テストケース

- [x] **TC-162-01**: 11種の図解タイプ検出がテストされる 🔵
  - **期待結果**: flow/tree/timeline/matrix/cycle/flowchart/comparison/network/conceptmap/mindmap/general 全タイプの検出が検証
  - **信頼性**: 🔵 *src/analysis/diagram-detector.ts detectDiagramType() より*

- [x] **TC-162-02**: キーワードマッチングとスコアリングロジックがテストされる 🔵
  - **期待結果**: キーワード重み・スコア閾値・タイプ確信度が検証
  - **信頼性**: 🔵 *diagram-detector.ts スコアリングロジックより*

---

## REQ-163: scene-segmenter.ts テストカバレッジ 🔵

**信頼性**: 🔵 *src/analysis/scene-segmenter.ts 970行・パイプラインStage 2セグメンテーションの中核*

### Given（前提条件）

- scene-segmenter.ts がセマンティックセグメンテーション・トピックベースクラスタリングを実装
- 専用テストファイルが存在しない

### When（実行条件）

- scene-segmenter.ts のコア機能に対するユニットテストを作成

### Then（期待結果）

- セグメンテーション・Jaccard係数マージ・トピッククラスタリング・境界検出がテストカバーされる

### テストケース

- [x] **TC-163-01**: セマンティックセグメンテーション（Jaccard係数マージ）がテストされる 🔵
  - **期待結果**: キーワード類似度に基づくセグメントマージが検証
  - **信頼性**: 🔵 *scene-segmenter.ts segmentBySemantics() より*

- [x] **TC-163-02**: トピックベースクラスタリングがテストされる 🔵
  - **期待結果**: コサイン類似度によるトピックベクトルクラスタリングが検証
  - **信頼性**: 🔵 *scene-segmenter.ts segmentByTopic() より*

---

## REQ-164: language-detector.ts テストカバレッジ 🔵

**信頼性**: 🔵 *src/analysis/language-detector.ts 623行・パイプラインStage 1言語検出の構成要素*

### Given（前提条件）

- language-detector.ts が日英判定・スクリプト分析・確信度スコアリングを実装
- 専用テストファイルが存在しない

### When（実行条件）

- language-detector.ts のコア機能に対するユニットテストを作成

### Then（期待結果）

- 言語検出・スクリプト分析・確信度スコアリング・混合言語対応がテストカバーされる

### テストケース

- [x] **TC-164-01**: 日本語・英語の言語検出がテストされる 🔵
  - **期待結果**: 日本語テキスト→ja、英語テキスト→en、混合テキスト→主要言語が検証
  - **信頼性**: 🔵 *language-detector.ts detectLanguage() より*

- [x] **TC-164-02**: 確信度スコアリングがテストされる 🔵
  - **期待結果**: 確信度が0.0~1.0範囲・スクリプト分析の精度が検証
  - **信頼性**: 🔵 *language-detector.ts スコアリングロジックより*

---

## REQ-165: エクスポートモジュール raw Error 置換 🔵

**信頼性**: 🔵 *src/export/ 4ファイル12箇所・Phase 63完了*

### Given（前提条件）

- エクスポートモジュール（apng-encoder/enhanced-export-engine/multi-format-exporter/production-exporter）に12箇所のraw Error throwが存在

### When（実行条件）

- 12箇所をExportError・EncodingError・FormatValidationErrorに置換

### Then（期待結果）

- 全raw Error throwが型付きエラークラスに置換される

### テストケース

- [x] **TC-165-01**: エクスポートモジュール4ファイル12箇所のraw Error throwが型付きエラーに置換される 🔵
  - **期待結果**: apng-encoder:4・enhanced-export-engine:4・multi-format-exporter:3・production-exporter:1の置換完了
  - **信頼性**: 🔵 *コミットf9e39f6より*

---

## REQ-166: エクスポートモジュール ErrorClassifier 回帰テスト 🔵

**信頼性**: 🔵 *tests/integration/export-typed-errors.test.ts・Phase 63完了*

### テストケース

- [x] **TC-166-01**: ExportError・EncodingError・FormatValidationError が ErrorClassifier で正確に分類される 🔵
  - **期待結果**: 15テスト全通過
  - **信頼性**: 🔵 *コミットf9e39f6より*

---

## REQ-167: enhanced-export-engine.ts テストカバレッジ 🔵

**信頼性**: 🔵 *src/export/enhanced-export-engine.ts 906行・Phase 64完了*

### テストケース

- [x] **TC-167-01**: マルチ形式エクスポート・HDR出力・ウォーターマーク・圧縮レベルがテストされる 🔵
  - **期待結果**: 42テスト全通過
  - **信頼性**: 🔵 *tests/unit/export/enhanced-export-engine.test.ts（360行）より*

---

## REQ-168: multi-format-exporter.ts テストカバレッジ 🔵

**信頼性**: 🔵 *src/export/multi-format-exporter.ts 550行・Phase 64完了*

### テストケース

- [x] **TC-168-01**: SVG/PNG/PDF/JSON形式変換・メタデータ・バリデーションがテストされる 🔵
  - **期待結果**: 39テスト全通過
  - **信頼性**: 🔵 *tests/unit/export/multi-format-exporter.test.ts（310行）より*

---

## REQ-169: production-exporter.ts テストカバレッジ 🔵

**信頼性**: 🔵 *src/export/production-exporter.ts 686行・Phase 64完了*

### テストケース

- [x] **TC-169-01**: プロダクションエクスポートパイプライン・プリセット管理・品質検証がテストされる 🔵
  - **期待結果**: 37テスト全通過
  - **信頼性**: 🔵 *tests/unit/export/production-exporter.test.ts（275行）より*

---

## REQ-170: 残存モジュール raw Error 置換 🔵

**信頼性**: 🔵 *Phase 65完了*

### テストケース

- [x] **TC-170-01**: monitoring・config・integrations・framework・pages モジュール7箇所のraw Error throwが型付きエラーに置換される 🔵
  - **期待結果**: MonitoringError追加・7箇所置換完了
  - **信頼性**: 🔵 *コミット9623ef1より*

---

## REQ-171: 残存モジュール ErrorClassifier 回帰テスト 🔵

**信頼性**: 🔵 *Phase 65完了*

### テストケース

- [x] **TC-171-01**: 新しい型付きエラーがErrorClassifierで正確に分類される 🔵
  - **期待結果**: 12テスト全通過
  - **信頼性**: 🔵 *tests/integration/cross-module-typed-errors.test.tsより*

---

## REQ-172: performance-dashboard.ts テストカバレッジ 🔵

**信頼性**: 🔵 *src/monitoring/performance-dashboard.ts 681行・Phase 66完了*

### テストケース

- [x] **TC-172-01**: パーセンタイル計算（P50/P95/P99）が追加される 🔵
  - **期待結果**: responseTime/memoryHeap/cacheHitRate/successRateのパーセンタイルが計算可能
  - **信頼性**: 🔵 *コミット74de4baより*

- [x] **TC-172-02**: 入力検証（負数トークンカウント）が追加される 🔵
  - **期待結果**: 負のトークン数でMonitoringErrorがスローされる
  - **信頼性**: 🔵 *コミット74de4baより*

---

## REQ-173: production-error-handler.ts テストカバレッジ 🔵

**信頼性**: 🔵 *src/monitoring/production-error-handler.ts 638行・Phase 66完了*

### テストケース

- [x] **TC-173-01**: エラー分類・重要度判定・リカバリ戦略・通知がテストされる 🔵
  - **期待結果**: 69テスト全通過
  - **信頼性**: 🔵 *tests/unit/monitoring/production-error-handler.test.ts（705行）より*

---

## REQ-174: real-time-performance-monitor.ts テストカバレッジ 🔵

**信頼性**: 🔵 *src/monitoring/real-time-performance-monitor.ts 616行・Phase 66完了*

### テストケース

- [x] **TC-174-01**: メトリクス記録・アラート閾値・重要度計算がテストされる 🔵
  - **期待結果**: 48テスト全通過
  - **信頼性**: 🔵 *tests/unit/monitoring/real-time-performance-monitor.test.ts（639行）より*

- [x] **TC-174-02**: cacheHitRate閾値反転バグが修正される 🔵
  - **期待結果**: critical < warning の場合に正しく反転検出
  - **信頼性**: 🔵 *コミット9f4d777より*

---

## REQ-182: StrategySelector 11タイプ全戦略登録 🔵

**信頼性**: 🔵 *src/visualization/strategy-selector.ts・コミットbe1dbb5*

### テストケース

- [x] **TC-182-01**: 11図解タイプ全てに専用戦略が登録されている 🔵
  - **期待結果**: flow/tree/timeline/matrix/cycle/mindmap/network/conceptmap/flowchart/comparison/general 全て登録済
  - **信頼性**: 🔵 *strategy-selector.ts より*

---

## REQ-183: MindMapStrategy 放射状レイアウト 🔵

**信頼性**: 🔵 *src/visualization/strategies/mindmap-strategy.ts*

### テストケース

- [x] **TC-183-01**: 放射状レイアウトが生成される 🔵
  - **期待結果**: ルートノード中心に子ノードが放射状に配置
  - **信頼性**: 🔵 *mindmap-strategy.ts より*

- [x] **TC-183-02**: 重要度ベースルート選択が動作する 🔵
  - **期待結果**: 高重要度ノードがルートとして選択される
  - **信頼性**: 🔵 *コミットb84f9a5 より*

---

## REQ-184: NetworkStrategy フォースダイレクトレイアウト 🔵

**信頼性**: 🔵 *src/visualization/strategies/network-strategy.ts・コミットbcd30f1*

### テストケース

- [x] **TC-184-01**: 確定的フォースダイレクトレイアウトが生成される 🔵
  - **期待結果**: 乱数不使用・円形初期配置・3フェーズ75反復収束
  - **信頼性**: 🔵 *tests/visualization/strategies/__tests__/network-strategy.test.ts（258行）より*

---

## REQ-185: ConceptMapStrategy BFS階層型レイアウト 🔵

**信頼性**: 🔵 *src/visualization/strategies/conceptmap-strategy.ts・コミット7f30cb3*

### テストケース

- [x] **TC-185-01**: BFS階層型レイアウトが生成される 🔵
  - **期待結果**: ルート選択（次数+重要度）・レベル別水平展開・クロスコネクション保持
  - **信頼性**: 🔵 *tests/visualization/strategies/__tests__/conceptmap-strategy.test.ts（285行）より*

---

## REQ-186: FlowchartStrategy Dagreレイアウト 🔵

**信頼性**: 🔵 *src/visualization/strategies/flowchart-strategy.ts・コミットbe1dbb5*

### テストケース

- [x] **TC-186-01**: Dagre上→下階層レイアウトが生成される 🔵
  - **期待結果**: プロセスフロー・決定木に最適化された配置
  - **信頼性**: 🔵 *tests/visualization/strategies/flowchart-layout-strategy.test.ts より*

---

## REQ-187: ComparisonStrategy 2列レイアウト 🔵

**信頼性**: 🔵 *src/visualization/strategies/comparison-strategy.ts・コミットbe1dbb5*

### テストケース

- [x] **TC-187-01**: 2列サイドバイサイドレイアウトが生成される 🔵
  - **期待結果**: バランス調整された左右カラム・オーバーラップゼロ
  - **信頼性**: 🔵 *tests/visualization/strategies/comparison-layout-strategy.test.ts より*

---

## REQ-188: GeneralStrategy スパイラルグリッドレイアウト 🔵

**信頼性**: 🔵 *src/visualization/strategies/general-strategy.ts・コミットbe1dbb5*

### テストケース

- [x] **TC-188-01**: 適応型スパイラルグリッド配置が生成される 🔵
  - **期待結果**: 高接続ノード中心・孤立ノード外周
  - **信頼性**: 🔵 *tests/visualization/strategies/general-layout-strategy.test.ts より*

---

## REQ-189: importance-scaler モジュール 🔵

**信頼性**: 🔵 *src/visualization/importance-scaler.ts・コミットb84f9a5*

### テストケース

- [x] **TC-189-01**: 全関数が正しく動作する 🔵
  - **期待結果**: getImportance・importanceSizeScale・importanceWeight・scaledDimensions・isHighImportance・isLowImportance・pickHighestImportance がテスト通過
  - **信頼性**: 🔵 *tests/visualization/importance-scaler.test.ts（255行）より*

---

## REQ-190: KeyphraseOverlay コンポーネント 🔵

**信頼性**: 🔵 *src/remotion/KeyphraseOverlay.tsx・コミット49462a6*

### テストケース

- [x] **TC-190-01**: キーフレーズタグがアニメーション付きで表示される 🔵
  - **期待結果**: フェードイン/アウト各8フレーム・スタガード2フレーム遅延・最大5表示
  - **信頼性**: 🔵 *tests/remotion/__tests__/KeyphraseOverlay.test.tsx（273行）より*

---

## REQ-191: Video KeyphraseOverlay+CaptionOverlay 統合 🔵

**信頼性**: 🔵 *src/remotion/Video.tsx・コミット160a34e*

### テストケース

- [x] **TC-191-01**: KeyphraseOverlayとCaptionOverlayが統合表示される 🔵
  - **期待結果**: キーフレーズ上部・キャプション下部の同時表示
  - **信頼性**: 🔵 *tests/remotion/video-overlay-integration.test.ts（80行）より*

---

## REQ-192: キーフレーズパイプライン配線 🔵

**信頼性**: 🔵 *src/pipeline/video-generator.ts・コミット49462a6*

### テストケース

- [x] **TC-192-01**: キーフレーズがSceneGraph→RemotionSceneDataに伝播される 🔵
  - **期待結果**: RemotionSceneData.keyphrases フィールドにキーフレーズが設定される
  - **信頼性**: 🔵 *video-generator.ts convertSceneToRemotionFormat() より*

---

## REQ-193: 戦略セレクターE2E統合テスト 🔵 ✅実装済

**信頼性**: 🔵 *AI Hubフィードバック・コミット0920f6a*

### テストケース

- [x] **TC-193-01**: 全11図解タイプのE2Eディスパッチが検証される 🔵
  - **期待結果**: 実際のSceneGraphデータで全戦略のレイアウト出力にノード・エッジが含まれる
  - **信頼性**: 🔵 *src/visualization/strategy-selector.ts より*
  - **実装**: tests/visualization/strategy-selector-integration.test.ts・コミット0920f6a

---

## REQ-194: StreamingTranscriber入力堅牢性 🔵 ✅実装済

**信頼性**: 🔵 *コミット0e10ed1*

### テストケース

- [x] **TC-194-01**: chunkSizeMs境界値検証 🔵
  - **期待結果**: chunkSizeMs <= 0 または > 60000 の場合 TranscriptionError がスローされる
  - **信頼性**: 🔵 *src/transcription/streaming-transcriber.ts L51-56*

- [x] **TC-194-02**: minConfidence境界値検証 🔵
  - **期待結果**: minConfidence < 0 または > 1 の場合 TranscriptionError がスローされる
  - **信頼性**: 🔵 *src/transcription/streaming-transcriber.ts L60-65*

- [x] **TC-194-03**: overlapMs境界値検証 🔵
  - **期待結果**: overlapMs < 0 の場合 TranscriptionError がスローされる
  - **信頼性**: 🔵 *src/transcription/streaming-transcriber.ts L70-75*

- [x] **TC-194-04**: overlapMs >= chunkSizeMs検証 🔵
  - **期待結果**: overlapMs >= chunkSizeMs の場合 TranscriptionError がスローされる
  - **信頼性**: 🔵 *src/transcription/streaming-transcriber.ts L76-80*

---

## REQ-195: processWithRetry エラー型伝播正確性 🔵 ✅実装済

**信頼性**: 🔵 *コミットa3b05dd・TASK-0186*

### Given（前提条件）

- SimplePipeline の processWithRetry が失敗結果を再スローする際

### When（実行条件）

- process() が成功フラグ false と errorType を返した場合

### Then（期待結果）

- PipelineError の errorType にハードコード'UNKNOWN'ではなく実際の result.errorType が伝播される
- retryWithBackoff がエラーをリカバリ可能として正しく分類する

### テストケース

#### 正常系

- [x] **TC-195-01**: エラー型伝播検証 🔵
  - **入力**: LLM API エラー（errorType='LLM_API_ERROR'）
  - **期待結果**: PipelineError の errorType が 'LLM_API_ERROR' として伝播される
  - **信頼性**: 🔵 *src/pipeline/simple-pipeline.ts L664-665*

- [x] **TC-195-02**: リトライ時のエラー分類検証 🔵
  - **入力**: リカバリ可能エラー（LLM API error）
  - **期待結果**: retryWithBackoff がリトライを実行し、最終的に成功する
  - **信頼性**: 🔵 *src/pipeline/__tests__/simple-pipeline.test.ts*

#### 異常系

- [x] **TC-195-E01**: 不明エラー型のハンドリング 🔵
  - **入力**: errorType が undefined の場合
  - **期待結果**: フォールバックとして 'UNKNOWN' が使用される
  - **信頼性**: 🔵 *src/pipeline/simple-pipeline.ts L664*

---

## REQ-196: バッチ処理プログレス正確性 🔵 ✅実装済

**信頼性**: 🔵 *コミット8edf876・src/api/batch-processing-api.ts*

### Given（前提条件）

- バッチ処理API（POST /batch/jobs）に複数ファイルが送信されている
- 送信されたファイルの中に重複（同一ハッシュ）が含まれている

### When（実行条件）

- バッチAPIがファイルの重複検出・除外を実行し、ジョブを作成・処理する

### Then（期待結果）

- progress.total が重複解除後のファイル数ではなく、ユーザーがアップロードした元のファイル数を反映する
- 重複としてスキップされたファイル（skippedFiles）の数が progress.completed に事前完了分として加算される
- ユーザーが確認する進捗率が直感的（3ファイル提出時は3ファイルベースの進捗表示）

### テストケース

#### 正常系

- [x] **TC-196-01**: 重複なしファイルのプログレス 🔵
  - **入力**: 3ファイル（重複なし）
  - **期待結果**: progress.total = 3, progress.completed が処理完了とともに増加
  - **信頼性**: 🔵 *src/api/batch-processing-api.ts:226-228*

- [x] **TC-196-02**: 重複ありファイルのプログレス 🔵
  - **入力**: 3ファイル（うち2ファイルが同一ハッシュ）
  - **期待結果**: progress.total = 3（1ではない）, skippedCount = 2
  - **信頼性**: 🔵 *src/api/batch-processing-api.ts:226（originalTotal = request.files.length）*

#### 境界値

- [x] **TC-196-B01**: 全ファイル重複のプログレス 🔵
  - **入力**: 3ファイル（全て同一ハッシュ）
  - **期待結果**: progress.total = 3, skippedCount = 2, 実際の処理対象 = 1ファイル
  - **信頼性**: 🔵 *src/api/batch-processing-api.ts:226-228*

---

## REQ-197: パイプラインオーケストレーター入力検証 🔵 ✅実装済

**信頼性**: 🔵 *コミット3eb6f6d・src/pipeline/pipeline-orchestrator.ts validateInput()・src/pipeline/pipeline-errors.ts AudioValidationError*

### Given（前提条件）

- PipelineOrchestrator が初期化されている
- SUPPORTED_AUDIO_FORMATS（mp3/wav/ogg/m4a）と AUDIO_LIMITS.MAX_FILE_SIZE_BYTES（50MB）が設定されている

### When（実行条件）

- PipelineOrchestrator.execute() が音声ファイル入力で呼び出される

### Then（期待結果）

- サポート外形式のファイルは AudioValidationError（errorType=FILE_FORMAT_INVALID・stage=audio_validation）で拒否される
- 50MB超過のFile オブジェクトは AudioValidationError で拒否される
- 有効な形式・サイズのファイルは正常に処理ステージに進む
- UI（REQ-142/143）・Whisper（REQ-146）に加えてパイプラインレベルの防御 in depth が提供される

### テストケース

#### 正常系

- [x] **TC-197-01**: サポート形式ファイルの受入 🔵
  - **入力**: mp3/wav/ogg/m4a 形式のファイル
  - **期待結果**: エラーなく処理ステージに進む
  - **信頼性**: 🔵 *コミット3eb6f6d*

- [x] **TC-197-02**: 文字列パスの受入 🔵
  - **入力**: 音声ファイルパス文字列（"/path/to/audio.wav"）
  - **期待結果**: 形式検証が実行され、有効な拡張子なら処理続行
  - **信頼性**: 🔵 *src/pipeline/pipeline-orchestrator.ts:199-213*

#### 異常系

- [x] **TC-197-E01**: サポート外形式の拒否 🔵
  - **入力**: .avi/.mkv/.txt 形式のファイル
  - **期待結果**: AudioValidationError がスローされ、サポート形式一覧を含むエラーメッセージが返る
  - **信頼性**: 🔵 *コミット3eb6f6d*

- [x] **TC-197-E02**: ファイルサイズ超過の拒否 🔵
  - **入力**: 51MB の File オブジェクト
  - **期待結果**: AudioValidationError がスローされ、実際のサイズと上限が含まれるエラーメッセージが返る
  - **信頼性**: 🔵 *src/pipeline/pipeline-orchestrator.ts:215-225*

#### 境界値

- [x] **TC-197-B01**: 50MB 境界値ファイル 🔵
  - **入力**: ちょうど50MB の File オブジェクト
  - **期待結果**: 正常受入（境界値未満チェック: file.size > MAX_FILE_SIZE_BYTES）
  - **信頼性**: 🔵 *src/config/limits.ts AUDIO_LIMITS.MAX_FILE_SIZE_BYTES*

---

## REQ-200: 相関IDミドルウェア 🔵 ✅実装済

**信頼性**: 🔵 *src/api/middleware/correlation-id.ts・コミットef9e9a5*

> Given: Express API サーバーが起動している; X-Request-ID ヘッダー仕様が定義されている | When: HTTP リクエストがサーバーに到達する | Then: 有効な相関IDがリクエストコンテキストに設定され、レスポンスヘッダーに伝播される

### テストケース

#### 正常系

- [x] **TC-200-01**: X-Request-ID ヘッダーなしの場合 UUID v4 が生成される 🔵
  - **入力**: X-Request-ID ヘッダーなしのリクエスト
  - **期待結果**: ランダムUUIDが生成され、レスポンスヘッダーに X-Request-ID として設定される
  - **信頼性**: 🔵 *correlation-id.ts randomUUID() より*

- [x] **TC-200-02**: 有効な X-Request-ID ヘッダーが受入・伝播される 🔵
  - **入力**: X-Request-ID: "test-req-123" ヘッダー付きリクエスト
  - **期待結果**: 同一IDがリクエストコンテキストとレスポンスヘッダーに設定される
  - **信頼性**: 🔵 *correlation-id.ts incoming validation より*

#### 異常系

- [x] **TC-200-E01**: 空 X-Request-ID ヘッダーが新しいUUIDで置換される 🔵
  - **入力**: X-Request-ID: "" のリクエスト
  - **期待結果**: 新しいUUIDが生成され、レスポンスヘッダーに設定される
  - **信頼性**: 🔵 *correlation-id.ts incoming.length > 0 チェックより*

- [x] **TC-200-E02**: 128文字超過 X-Request-ID が新しいUUIDで置換される 🔵
  - **入力**: 129文字の X-Request-ID ヘッダー
  - **期待結果**: 新しいUUIDが生成され、レスポンスヘッダーに設定される
  - **信頼性**: 🔵 *correlation-id.ts MAX_ID_LENGTH=128 チェックより*

---

## REQ-204: 構造化HTTPリクエスト/レスポンスロギング 🔵 ✅実装済

**信頼性**: 🔵 *src/api/middleware/request-logger.ts・コミット104db88*

> Given: Express API サーバーが correlation ID ミドルウェア（REQ-200）とロガーで設定されている | When: HTTP リクエストが処理されレスポンスが返される | Then: メソッド・パス・ステータスコード・応答時間・相関IDがログレベル別に記録される

### テストケース

#### 正常系

- [x] **TC-204-01**: 成功リクエスト（2xx）が info レベルでログ出力される 🔵
  - **入力**: GET /api/v1/test → 200
  - **期待結果**: logger.info が1回呼ばれ、メソッド・パス・ステータス・応答時間が含まれる
  - **信頼性**: 🔵 *request-logger.test.ts より*

- [x] **TC-204-02**: ログメッセージにメソッド・パス・ステータス・応答時間・相関IDが含まれる 🔵
  - **入力**: GET /api/v1/test with X-Request-ID: "test-correlation-123"
  - **期待結果**: ログメッセージが "GET /api/v1/test 200 Xms rid=test-correlation-123" 形式
  - **信頼性**: 🔵 *request-logger.ts message format より*

#### 異常系

- [x] **TC-204-E01**: 4xx レスポンスが warn レベルでログ出力される 🔵
  - **入力**: GET /api/v1/bad → 400
  - **期待結果**: logger.warn が1回呼ばれ、ステータスコード400が含まれる
  - **信頼性**: 🔵 *request-logger.ts statusCode >= 400 分岐より*

- [x] **TC-204-E02**: 5xx レスポンスが error レベルでログ出力される 🔵
  - **入力**: GET /api/v1/server-error → 500
  - **期待結果**: logger.error が1回呼ばれ、ステータスコード500が含まれる
  - **信頼性**: 🔵 *request-logger.ts statusCode >= 500 分岐より*

#### 境界値

- [x] **TC-204-B01**: ヘルスチェックエンドポイントがログ対象外となる 🔵
  - **入力**: GET /api/v1/health → 200
  - **期待結果**: logger.info/warn/error が呼ばれない
  - **信頼性**: 🔵 *request-logger.ts SKIP_PATHS より*

- [x] **TC-204-B02**: 相関IDなしの場合 rid=- がログ出力される 🔵
  - **入力**: X-Request-ID ヘッダーなしのリクエスト
  - **期待結果**: ログメッセージに "rid=-" が含まれる
  - **信頼性**: 🔵 *request-logger.ts fallback '-' より*

---

## REQ-205: HTTPリクエストメトリクス収集 🔵 ✅実装済

**信頼性**: 🔵 *src/monitoring/http-metrics-collector.ts・コミット241e126*

> Given: Express API サーバーが HttpMetricsCollector ミドルウェアで設定されている | When: HTTP リクエストが処理される | Then: メソッド+パスごとのリクエスト数・P50/P95/P99レイテンシ・エラーレート・スローリクエストが bounded circular buffer で追跡される

### テストケース

#### 正常系

- [x] **TC-205-01**: リクエスト完了時にメトリクスが記録される 🔵
  - **入力**: GET /api/v1/test → 200 (100ms)
  - **期待結果**: メソッド+パスのエントリにリクエスト数1・レイテンシ100msが記録される
  - **信頼性**: 🔵 *http-metrics-collector.ts recordRequest() より*

- [x] **TC-205-02**: 複数リクエストでP50/P95/P99が正しく計算される 🔵
  - **入力**: 同一ルートに10リクエスト（異なるレイテンシ）
  - **期待結果**: P50/P95/P99パーセンタイルが正確に計算される
  - **信頼性**: 🔵 *http-metrics-collector.ts percentile() 計算ロジックより*

- [x] **TC-205-03**: アクティブリクエスト数が追跡される 🔵
  - **入力**: 並列リクエスト3件を同時発行
  - **期待結果**: アクティブリクエスト数が正しく増減する
  - **信頼性**: 🔵 *http-metrics-collector.ts activeRequests より*

#### 境界値

- [x] **TC-205-B01**: スローリクエスト（5000ms閾値超過）が検出される 🔵
  - **入力**: 6000ms要するリクエスト
  - **期待結果**: slowRequests カウンターがインクリメントされる
  - **信頼性**: 🔵 *http-metrics-collector.ts SLOW_THRESHOLD_MS=5000 より*

- [x] **TC-205-B02**: bounded circular buffer が最大1000サンプルに制限される 🔵
  - **入力**: 同一ルートに1100リクエスト
  - **期待結果**: 最新1000サンプルのみ保持される
  - **信頼性**: 🔵 *http-metrics-collector.ts MAX_SAMPLES_PER_ROUTE=1000 より*

---

## REQ-206: Prometheus互換メトリクスエクスポート 🔵 ✅実装済

**信頼性**: 🔵 *src/monitoring/prometheus-exporter.ts・コミットac14a4b*

> Given: HttpMetricsCollector にメトリクスが蓄積されている | When: GET /api/v1/monitoring/prometheus が呼ばれる | Then: Prometheus text/plain v0.0.4 フォーマットで6メトリクス（http_requests_total, http_request_duration_ms, http_errors_total, http_active_requests, http_slow_requests_total, process_uptime_ms）が出力される

### テストケース

#### 正常系

- [x] **TC-206-01**: Prometheus text/plain v0.0.4 フォーマットで出力される 🔵
  - **入力**: メトリクス収集済み状態でエクスポート実行
  - **期待結果**: Content-Type が PROMETHEUS_CONTENT_TYPE・各メトリクスが TYPE/HELP 行付きで出力される
  - **信頼性**: 🔵 *prometheus-exporter.ts exportPrometheusMetrics() より*

- [x] **TC-206-02**: ラベルサニタイズでPrometheus注入が防止される 🔵
  - **入力**: ルートパスに特殊文字（日本語・空白・記号）を含むメトリクス
  - **期待結果**: ラベル値がアンダースコア・小文字に正規化される
  - **信頼性**: 🔵 *prometheus-exporter.ts sanitizeLabel() より*

- [x] **TC-206-03**: 6メトリクス種別が全て出力される 🔵
  - **入力**: メトリクス収集済み状態
  - **期待結果**: http_requests_total, http_request_duration_ms, http_errors_total, http_active_requests, http_slow_requests_total, process_uptime_ms が出力される
  - **信頼性**: 🔵 *prometheus-exporter.ts METRIC_DEFINITIONS より*

---

## REQ-207: ヘルスチェックliveness/readiness probe 🔵 ✅実装済

**信頼性**: 🔵 *src/monitoring/health-check-service.ts・src/api/routes/health.ts・コミット67f5b05*

> Given: Express API サーバーが HealthCheckService 配線済み | When: GET /api/v1/health/live または GET /api/v1/health/ready が呼ばれる | Then: liveness probe はプロセス稼働状態を、readiness probe は全コンポーネント健全性を報告する

### テストケース

#### 正常系

- [x] **TC-207-01**: liveness probe が alive=true を返す 🔵
  - **入力**: GET /api/v1/health/live
  - **期待結果**: { status: "alive", alive: true, timestamp: ... }
  - **信頼性**: 🔵 *health.ts /health/live ルート・health-check-service.ts checkLiveness() より*

- [x] **TC-207-02**: readiness probe が全コンポーネント健全性を報告する 🔵
  - **入力**: GET /api/v1/health/ready
  - **期待結果**: { status: "ready"|"degraded"|"unhealthy", ready: boolean, checks: { memory, cache, pipeline, llm, errorRecovery, performanceTrend } }
  - **信頼性**: 🔵 *health.ts /health/ready ルート・health-check-service.ts checkReadiness() より*

#### 異常系

- [x] **TC-207-E01**: メモリ使用量90%超過時 readiness が degraded を返す 🔵
  - **入力**: メモリ使用量92%をシミュレート
  - **期待結果**: checks.memory.status = "degraded"、ready = false
  - **信頼性**: 🔵 *health-check-service.ts checkMemoryHealth() 90%閾値より*

---

## REQ-208: Grafanaダッシュボード設定 🔵 ✅実装済

**信頼性**: 🔵 *src/monitoring/grafana-dashboard-model.ts・コミットa1a3e5f*

> Given: Grafana ダッシュボード JSON model が定義されている | When: generateGrafanaDashboard() が呼ばれる | Then: 8パネル（latency/error-rate/success-rate/slow-requests/active-requests/uptime/request-volume/errors-by-route）の Grafana import 互換 JSON が生成される

### テストケース

#### 正常系

- [x] **TC-208-01**: Grafana import 互換 JSON が生成される 🔵
  - **入力**: generateGrafanaDashboard()
  - **期待結果**: JSON に title, uid, panels (8個), templating が含まれる
  - **信頼性**: 🔵 *grafana-dashboard-model.ts generateGrafanaDashboard() より*

- [x] **TC-208-02**: 8パネルが全て定義されている 🔵
  - **入力**: generateGrafanaDashboard()
  - **期待結果**: panels 配列に8エントリ（各パネルに id, title, type, targets with PromQL が含まれる）
  - **信頼性**: 🔵 *grafana-dashboard-model.ts PANEL_DEFINITIONS より*

- [x] **TC-208-03**: exportDashboardJson() がシリアライズ済JSON文字列を返す 🔵
  - **入力**: exportDashboardJson()
  - **期待結果**: JSON.parse 可能な文字列
  - **信頼性**: 🔵 *grafana-dashboard-model.ts exportDashboardJson() より*

---

## REQ-209: Prometheusアラートルール 🔵 ✅実装済

**信頼性**: 🔵 *src/monitoring/alert-rules.ts・コミットa1a3e5f*

> Given: アラートルールが定義されている | When: generateAlertRules() が呼ばれる | Then: 4ルール（HighErrorRate・HighLatencyP95・HealthCheckFailures・LLMBudgetOverage）の AlertManager YAML が生成される

### テストケース

#### 正常系

- [x] **TC-209-01**: 4アラートルールが全て生成される 🔵
  - **入力**: generateAlertRules()
  - **期待結果**: rules 配列に4エントリ（各ルールに alert, expr, for, labels.severity, annotations が含まれる）
  - **信頼性**: 🔵 *alert-rules.ts ALERT_RULE_DEFINITIONS より*

- [x] **TC-209-02**: exportAlertRulesYaml() がYAML形式文字列を返す 🔵
  - **入力**: exportAlertRulesYaml()
  - **期待結果**: "groups:" で始まるYAML形式文字列
  - **信頼性**: 🔵 *alert-rules.ts exportAlertRulesYaml() より*

- [x] **TC-209-03**: HighErrorRate ルールの閾値が5%である 🔵
  - **入力**: generateAlertRules() → HighErrorRate ルール
  - **期待結果**: expr に "rate(http_errors_total[5m]) / rate(http_requests_total[5m]) > 0.05" が含まれる
  - **信頼性**: 🔵 *alert-rules.ts HighErrorRate 定義より*

---

## REQ-210: ダッシュボード設定配信API 🔵

**信頼性**: 🔵 *src/monitoring/grafana-dashboard-model.ts exportDashboardJson()・REQ-208 の拡張*

> Given: Grafana ダッシュボード JSON model が生成可能 | When: GET /api/v1/monitoring/dashboard が呼ばれる | Then: Grafana import 互換 JSON が Content-Type: application/json で配信される

### テストケース

#### 正常系

- [ ] **TC-210-01**: GET /api/v1/monitoring/dashboard が JSON を返す 🔵
  - **入力**: GET /api/v1/monitoring/dashboard
  - **期待結果**: 200 OK, Content-Type: application/json, Grafana import 形式の JSON ボディ
  - **信頼性**: 🔵 *grafana-dashboard-model.ts exportDashboardJson() 出力より*

---

## REQ-211: アラートルール配信API 🔵

**信頼性**: 🔵 *src/monitoring/alert-rules.ts exportAlertRulesYaml()・REQ-209 の拡張*

> Given: Prometheus アラートルールが生成可能 | When: GET /api/v1/monitoring/alerts が呼ばれる | Then: AlertManager YAML が Content-Type: text/yaml で配信される

### テストケース

#### 正常系

- [ ] **TC-211-01**: GET /api/v1/monitoring/alerts が YAML を返す 🔵
  - **入力**: GET /api/v1/monitoring/alerts
  - **期待結果**: 200 OK, Content-Type: text/yaml, 4ルールを含む AlertManager YAML
  - **信頼性**: 🔵 *alert-rules.ts exportAlertRulesYaml() 出力より*

---

## REQ-212: パイプラインステージ所要時間Prometheus統合 🔵

**信頼性**: 🔵 *src/pipeline/stage-timing-metrics.ts 既存メトリクス・REQ-206 Prometheusエクスポーター*

> Given: パイプラインが実行されステージタイミングが記録されている | When: GET /api/v1/monitoring/prometheus が呼ばれる | Then: pipeline_stage_duration_ms ヒストグラムメトリクスが Prometheus 形式で出力される

### テストケース

#### 正常系

- [ ] **TC-212-01**: パイプライン実行後ステージ所要時間がPrometheus出力に含まれる 🔵
  - **入力**: パイプライン実行 → GET /api/v1/monitoring/prometheus
  - **期待結果**: pipeline_stage_duration_ms{stage="transcription|analysis|layout|scene_prep|rendering"} が含まれる
  - **信頼性**: 🔵 *stage-timing-metrics.ts ステージ定義・prometheus-exporter.ts 拡張より*

---

## REQ-213: バッチジョブライフサイクルPrometheus統合 🔵

**信頼性**: 🔵 *src/api/batch-processing-api.ts ジョブステータス管理・REQ-206 Prometheusエクスポーター*

> Given: バッチジョブが作成・実行・完了されている | When: GET /api/v1/monitoring/prometheus が呼ばれる | Then: batch_jobs_total{status="created|running|completed|failed|cancelled"} と batch_jobs_active が Prometheus 形式で出力される

### テストケース

#### 正常系

- [ ] **TC-213-01**: バッチジョブ実行後メトリクスがPrometheus出力に含まれる 🔵
  - **入力**: バッチジョブ作成→完了 → GET /api/v1/monitoring/prometheus
  - **期待結果**: batch_jobs_total{status="completed"} と batch_jobs_active=0 が含まれる
  - **信頼性**: 🔵 *batch-processing-api.ts ジョブステータス遷移より*

---

## REQ-214: PrometheusエクスポートE2E統合テスト 🔵

**信頼性**: 🔵 *src/monitoring/prometheus-exporter.ts・src/api/routes/monitoring.ts*

> Given: Express サーバーが起動し全ミドルウェアが有効 | When: HTTP リクエストを処理後に GET /api/v1/monitoring/prometheus を呼ぶ | Then: text/plain v0.0.4 フォーマットで全メトリクスが正しく出力される

### テストケース

#### 正常系

- [ ] **TC-214-01**: 実際のHTTPリクエストを通じたPrometheus出力の完全性検証 🔵
  - **入力**: supertest でサーバーにリクエスト → /prometheus エクスポート
  - **期待結果**: 全6メトリクス種別が正しいフォーマットで出力される
  - **信頼性**: 🔵 *prometheus-exporter.ts フォーマット仕様より*

---

## REQ-215: アラートルール閾値境界テスト 🔵

**信頼性**: 🔵 *src/monitoring/alert-rules.ts generateAlertRules()*

> Given: アラートルールが閾値ベースで定義されている | When: 各閾値の境界値をテストする | Then: 正常時・閾値境界・閾値超過の3パターンで正しいアラート発火条件が確認される

### テストケース

#### 境界値

- [ ] **TC-215-01**: HighErrorRate 5%閾値の境界テスト 🔵
  - **入力**: エラーレート 4.9% / 5.0% / 5.1%
  - **期待結果**: 5.0%以上でアラート発火条件が真になる
  - **信頼性**: 🔵 *alert-rules.ts HighErrorRate > 0.05 定義より*

- [ ] **TC-215-02**: HighLatencyP95 20秒閾値の境界テスト 🔵
  - **入力**: P95レイテンシ 19.9秒 / 20.0秒 / 20.1秒
  - **期待結果**: 20秒以上でアラート発火条件が真になる
  - **信頼性**: 🔵 *alert-rules.ts HighLatencyP95 > 20000 定義より*

- [ ] **TC-215-03**: HealthCheckFailures 3回連続閾値の境界テスト 🔵
  - **入力**: 連続失敗 2回 / 3回 / 4回
  - **期待結果**: 3回以上で critical アラート発火
  - **信頼性**: 🔵 *alert-rules.ts HealthCheckFailures >= 3 定義より*

---
