# Speech-to-Visuals 受け入れ基準


<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-04-27
**最終更新**: 2026-06-24（第201回検証: Phase 111 REQ-253~257 受け入れ基準10項目すべて完了・全テストグリーン）
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

**信頼性**: 🔵 *@stv/core/config/validate・@stv/core/config/schema より*


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

**信頼性**: 🔵 *@stv/core/types/diagram isDiagramType() より*


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

**信頼性**: 🔵 *ISS-012 MEDIUM・@stv/core/config/production-config lines 80, 284, 291・.audit/purpose_driven_plan.yml より*


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
  - **条件**: @stv/core/config/production-config
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

**信頼性**: 🔵 *@stv/core/utils/sanitize 実装・ISS-044 パストラバーサル防止要件より*


> Given: sanitizeFilename 関数が @stv/core/utils/sanitize に定義されている; 関数はパストラバーサル防止・ヌルバイト除去・制御文字除去・ディレクトリセパレータ置換を実装 | When: 各エッジケース入力を sanitizeFilename() に渡す | Then: 入力に応じた安全なファイル名が出力される

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

**信頼性**: 🔵 *@stv/core/config/limits 集約化完了・REQ-071/REQ-073 要件より*


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

**信頼性**: 🔵 *@stv/core/utils/logger (32行)・@stv/core/utils/memory-usage (44行) 既存実装・テストファイルなし より*

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

**信頼性**: 🔵 *src/components/AudioUploader.tsx 32-38行インライン検証・@stv/core/utils/audio-validation 統合パターン・EnhancedFileUploader.tsx 統合例 より*

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

**信頼性**: 🔵 *src/transcription/types.ts MAX_FILE_SIZE vs @stv/core/config/limits AUDIO_LIMITS の重複定義 より*

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
  - **信頼性**: 🔵 *@stv/core/config/limits AUDIO_LIMITS.MAX_FILE_SIZE_BYTES*

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

- [x] **TC-205-04**: ステータスクラス別（1xx〜5xx）カウントが記録され 4xx/5xx が区別される 🔵
  - **入力**: 同一ルートに 200×2, 301, 404×2, 503
  - **期待結果**: `statusClassCounts` = {2xx:2, 3xx:1, 4xx:2, 5xx:1}（errorCount=3 は従来どおり ≥400）。クラス境界は単一定義 `statusCodeClass()` が唯一決定
  - **信頼性**: 🔵 *http-metrics-collector.ts statusCodeClass/statusClassCounts より。mutation-verified: 境界 `<500` を `<600` に退行させると TC-205-04 のみ RED*

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

- [x] **TC-206-04**: status_class が記録されたクラス別カウントから導出され、4xx が偽の 5xx に出ない 🔵
  - **入力**: 404のみ1000件のルート（statusClassCounts={4xx:1000}）
  - **期待結果**: `status_class="4xx" 1000` が出力され `status_class="5xx"` は一切出力されない（従来は errorCount をそのまま 5xx バケットに流し、404ストームがサーバーエラーとして表示されていた）。3xx も 2xx（count−errorCount）に折り込まれない
  - **信頼性**: 🔵 *prometheus-exporter.ts buildRequestTotal()・tests/unit/monitoring/prometheus-exporter.test.ts より*

- [x] **TC-206-05**: `?prefix=` がサンプル行と HELP/TYPE 行の両方に適用される 🔵
  - **入力**: `exportPrometheusMetrics({prefix:'s2v'})` と `GET /api/v1/monitoring/prometheus?prefix=s2v`
  - **期待結果**: 全サンプル行とコメント行が `s2v_http_requests_total` 等（namespace + `_` の結合は /dashboard・/alerts と同一契約）。従来は (a) ルートが prefix を無視、(b) エクスポーターはコメント行のみ書き換えサンプル行は無接頭のまま、だったため prefix 付き dashboard/alert クエリが恒久的 no-data になっていた
  - **信頼性**: 🔵 *prometheus-exporter.ts renderMetric/applyPrefixToSamples・routes/monitoring.ts PrometheusQuerySchema より。mutation-verified: ルートの prefix 传递を外すと TC-214-02 のみ RED*

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

- [x] **TC-210-01**: GET /api/v1/monitoring/dashboard が JSON を返す 🔵
  - **入力**: GET /api/v1/monitoring/dashboard
  - **期待結果**: 200 OK, Content-Type: application/json, Grafana import 形式の JSON ボディ
  - **信頼性**: 🔵 *grafana-dashboard-model.ts exportDashboardJson() 出力より*

---

## REQ-211: アラートルール配信API 🔵

**信頼性**: 🔵 *src/monitoring/alert-rules.ts exportAlertRulesYaml()・REQ-209 の拡張*

> Given: Prometheus アラートルールが生成可能 | When: GET /api/v1/monitoring/alerts が呼ばれる | Then: AlertManager YAML が Content-Type: text/yaml で配信される

### テストケース

#### 正常系

- [x] **TC-211-01**: GET /api/v1/monitoring/alerts が YAML を返す 🔵
  - **入力**: GET /api/v1/monitoring/alerts
  - **期待結果**: 200 OK, Content-Type: text/yaml, 4ルールを含む AlertManager YAML
  - **信頼性**: 🔵 *alert-rules.ts exportAlertRulesYaml() 出力より*

---

## REQ-212: パイプラインステージ所要時間Prometheus統合 🔵

**信頼性**: 🔵 *src/pipeline/stage-timing-metrics.ts 既存メトリクス・REQ-206 Prometheusエクスポーター*

> Given: パイプラインが実行されステージタイミングが記録されている | When: GET /api/v1/monitoring/prometheus が呼ばれる | Then: pipeline_stage_duration_ms ヒストグラムメトリクスが Prometheus 形式で出力される

### テストケース

#### 正常系

- [x] **TC-212-01**: パイプライン実行後ステージ所要時間がPrometheus出力に含まれる 🔵
  - **入力**: パイプライン実行 → GET /api/v1/monitoring/prometheus
  - **期待結果**: pipeline_stage_duration_ms{stage="transcription|analysis|layout|scene_prep|rendering"} が含まれる
  - **信頼性**: 🔵 *stage-timing-metrics.ts ステージ定義・prometheus-exporter.ts 拡張より*

---

## REQ-213: バッチジョブライフサイクルPrometheus統合 🔵

**信頼性**: 🔵 *src/api/batch-processing-api.ts ジョブステータス管理・REQ-206 Prometheusエクスポーター*

> Given: バッチジョブが作成・実行・完了されている | When: GET /api/v1/monitoring/prometheus が呼ばれる | Then: batch_jobs_total{status="created|running|completed|failed|cancelled"} と batch_jobs_active が Prometheus 形式で出力される

### テストケース

#### 正常系

- [x] **TC-213-01**: バッチジョブ実行後メトリクスがPrometheus出力に含まれる 🔵
  - **入力**: バッチジョブ作成→完了 → GET /api/v1/monitoring/prometheus
  - **期待結果**: batch_jobs_total{status="completed"} と batch_jobs_active=0 が含まれる
  - **信頼性**: 🔵 *batch-processing-api.ts ジョブステータス遷移より*

---

## REQ-214: PrometheusエクスポートE2E統合テスト 🔵

**信頼性**: 🔵 *src/monitoring/prometheus-exporter.ts・src/api/routes/monitoring.ts*

> Given: Express サーバーが起動し全ミドルウェアが有効 | When: HTTP リクエストを処理後に GET /api/v1/monitoring/prometheus を呼ぶ | Then: text/plain v0.0.4 フォーマットで全メトリクスが正しく出力される

### テストケース

#### 正常系

- [x] **TC-214-01**: 実際のHTTPリクエストを通じたPrometheus出力の完全性検証 🔵
  - **入力**: supertest でサーバーにリクエスト → /prometheus エクスポート
  - **期待結果**: 全6メトリクス種別が正しいフォーマットで出力される
  - **信頼性**: 🔵 *prometheus-exporter.ts フォーマット仕様より*

---

## REQ-215: アラートルール閾値境界テスト 🔵

**信頼性**: 🔵 *src/monitoring/alert-rules.ts generateAlertRules()*

> Given: アラートルールが閾値ベースで定義されている | When: 各閾値の境界値をテストする | Then: 正常時・閾値境界・閾値超過の3パターンで正しいアラート発火条件が確認される

### テストケース

#### 境界値

- [x] **TC-215-01**: HighErrorRate 5%閾値の境界テスト 🔵
  - **入力**: エラーレート 4.9% / 5.0% / 5.1%
  - **期待結果**: 5.0%以上でアラート発火条件が真になる
  - **信頼性**: 🔵 *alert-rules.ts HighErrorRate > 0.05 定義より*

- [x] **TC-215-02**: HighLatencyP95 20秒閾値の境界テスト 🔵
  - **入力**: P95レイテンシ 19.9秒 / 20.0秒 / 20.1秒
  - **期待結果**: 20秒以上でアラート発火条件が真になる
  - **信頼性**: 🔵 *alert-rules.ts HighLatencyP95 > 20000 定義より*

- [x] **TC-215-03**: HealthCheckFailures 3回連続閾値の境界テスト 🔵
  - **入力**: 連続失敗 2回 / 3回 / 4回
  - **期待結果**: 3回以上で critical アラート発火
  - **信頼性**: 🔵 *alert-rules.ts HealthCheckFailures >= 3 定義より*

---

## REQ-216: 監視エンドポイントZodクエリ検証 🔵

**信頼性**: 🔵 *src/api/routes/monitoring.ts Zod safeParse・commit 147261e*

> Given: 監視エンドポイント（dashboard・alerts・trends）が Zod クエリスキーマで保護されている | When: 不正なクエリパラメータでリクエストを送信する | Then: 400 エラーが返却される

### テストケース

#### 正常系

- [x] **TC-216-01**: dashboard エンドポイントの正常クエリパラメータ 🔵
  - **入力**: GET /monitoring/dashboard?refreshInterval=5000
  - **期待結果**: 200 OK でダッシュボードJSONが返却される
  - **信頼性**: 🔵 *monitoring.ts DashboardQuerySchema より*

- [x] **TC-216-02**: alerts エンドポイントの正常クエリパラメータ 🔵
  - **入力**: GET /monitoring/alerts?severity=warning&includeAck=true
  - **期待結果**: 200 OK でアラート情報が返却される
  - **信頼性**: 🔵 *monitoring.ts AlertsQuerySchema より*

#### 異常系

- [x] **TC-216-E01**: 不正な refreshInterval でリクエスト 🔵
  - **入力**: GET /monitoring/dashboard?refreshInterval=0
  - **期待結果**: 400 バリデーションエラー
  - **信頼性**: 🔵 *DashboardQuerySchema min(1000) 定義より*

- [x] **TC-216-E02**: 不正な period でリクエスト 🔵
  - **入力**: GET /monitoring/trends?period=invalid
  - **期待結果**: 400 バリデーションエラー
  - **信頼性**: 🔵 *TrendsQuerySchema enum 定義より*

---

## REQ-217: LLM応答図解構造検証 🔵

**信頼性**: 🔵 *src/analysis/gemini-analyzer.ts createEnhancedParser()・commit 5d3053c*

> Given: LLM から図解データが返却されている | When: createEnhancedParser() がノード・エッジの構造検証を実行する | Then: 不正データ（ID欠損・重複・自己ループ・孤立エッジ）がフィルタリングされる

### テストケース

#### 正常系

- [x] **TC-217-01**: 重複ノードIDの排除（最初の出現を保持）🔵
  - **入力**: 同一 ID のノードが複数含まれる図解データ
  - **期待結果**: 最初の出現のみ保持、警告ログ出力
  - **信頼性**: 🔵 *gemini-analyzer-comprehensive.test.ts テストより*

- [x] **TC-217-02**: 自己ループエッジ（from === to）のフィルタリング 🔵
  - **入力**: from と to が同一のエッジ
  - **期待結果**: 当該エッジが除外される
  - **信頼性**: 🔵 *gemini-analyzer-comprehensive.test.ts テストより*

- [x] **TC-217-03**: 重複エッジ（同一 from→to ペア）の排除 🔵
  - **入力**: 同一 from-to ペアのエッジが複数含まれる
  - **期待結果**: 最初の出現のみ保持
  - **信頼性**: 🔵 *gemini-analyzer-comprehensive.test.ts テストより*

- [x] **TC-217-04**: ID欠損ノードのフィルタリング 🔵
  - **入力**: id が空文字・null・undefined のノード
  - **期待結果**: 当該ノードが除外される
  - **信頼性**: 🔵 *gemini-analyzer-comprehensive.test.ts テストより*

#### 境界値

- [x] **TC-217-B01**: 複合検証（重複 + 自己ループ + 孤立エッジ）同時処理 🔵
  - **入力**: 全種類の不正データが混在する図解データ
  - **期待結果**: 全不正データが適切にフィルタリングされる
  - **信頼性**: 🔵 *gemini-analyzer-comprehensive.test.ts テストより*

---

## REQ-218: シーン駆動 Animated SVG エクスポート 🔵

**信頼性**: 🔵 *src/export/animated-scene-renderer.ts generateAnimatedSVG()・commit f405637（モジュール抽出）*

> Given: シーンデータが生成済み | When: svg-animated 形式でエクスポートする | Then: CSS キーフレームアニメーション付き SVG が生成される

### テストケース

#### 正常系

- [x] **TC-218-01**: XML宣言とネームスペースを含む有効なSVG生成 🔵
  - **入力**: 2シーン（intro + content）のシーンデータ
  - **期待結果**: `<?xml version="1.0"?>` + `<svg xmlns="http://www.w3.org/2000/svg">` を含む
  - **信頼性**: 🔵 *animated-svg-lottie-export.test.ts テストより*

- [x] **TC-218-02**: シーンタイプ別スタイル適用 🔵
  - **入力**: intro（背景#1a1a2e/48px）・content（背景#16213e/24px）・outro（背景#0f3460/36px）
  - **期待結果**: 各シーンタイプに応じた背景色・フォントサイズが適用される
  - **信頼性**: 🔵 *animated-svg-lottie-export.test.ts テストより*

#### 異常系

- [x] **TC-218-E01**: 空シーンデータのフォールバック 🔵
  - **入力**: scenes 未定義のシーンデータ
  - **期待結果**: フォールバックSVG（"No scenes available"）が生成される
  - **信頼性**: 🔵 *animated-svg-lottie-export.test.ts テストより*

#### 境界値

- [x] **TC-218-B01**: 特殊文字を含むシーンラベルのXMLエスケープ 🔵
  - **入力**: `&`, `<`, `>`, `"` を含むシーンラベル
  - **期待結果**: `&amp;`, `&lt;`, `&gt;`, `&quot;` にエスケープされる
  - **信頼性**: 🔵 *animated-svg-lottie-export.test.ts テストより*

---

## REQ-219: Lottie JSON アニメーションエクスポート 🔵

**信頼性**: 🔵 *src/export/animated-scene-renderer.ts generateLottieAnimation()・commit 214ec76（視覚形状コンテンツ）・commit f405637（モジュール抽出）*

> Given: シーンデータが生成済み | When: json-lottie 形式でエクスポートする | Then: Lottie 5.7.4 互換 JSON アニメーションが生成される

### テストケース

#### 正常系

- [x] **TC-219-01**: シーンベースのレイヤーを含むLottie JSON生成 🔵
  - **入力**: 2シーン（各duration=3）のシーンデータ
  - **期待結果**: レイヤー配列に各シーンのシェイプレイヤーが含まれる、ip/op/st が正しく計算される
  - **信頼性**: 🔵 *enhanced-export-engine.test.ts テストより*

- [x] **TC-219-02**: シーンラベルがレイヤー名として使用される 🔵
  - **入力**: label="Introduction" のシーン
  - **期待結果**: レイヤーの nm プロパティが "Introduction" になる
  - **信頼性**: 🔵 *animated-svg-lottie-export.test.ts テストより*

- [x] **TC-219-03**: シーンタイプ別背景色矩形シェイプがレイヤーに含まれる 🔵
  - **入力**: type="intro" / type="content" / type="outro" のシーン
  - **期待結果**: shapes 配列に Background Group（ty=gr）→ Background Rect（ty=rc）+ Background Fill（ty=fl）が含まれ、fill色がシーンタイプ別に正しい（intro: [0.102, 0.102, 0.180], outro: [0.059, 0.204, 0.376], content: [0.086, 0.129, 0.243]）
  - **信頼性**: 🔵 *animated-scene-renderer.ts buildLayerShapes()・commit 214ec76*

#### 異常系

- [x] **TC-219-E01**: 空シーンデータでも有効なLottie構造出力 🔵
  - **入力**: scenes 未定義のシーンデータ
  - **期待結果**: 空レイヤー配列を持つ有効なLottie JSON構造
  - **信頼性**: 🔵 *animated-svg-lottie-export.test.ts テストより*

---

## REQ-220: エクスポートパイプライン統合テスト 🔵

**信頼性**: 🔵 *tests/integration/export-pipeline-e2e.test.ts・tests/integration/renderer-engine-integration.test.ts・TASK-0199/0200*

> Given: シーンデータ（intro/content/outro）が生成済み | When: EnhancedExportEngine 経由で SVG・Lottie エクスポートを実行する | Then: モジュール間データフローが一貫し、SVG↔Lottie 横断でシーン色・ラベルが一致する

### テストケース

#### 正常系

- [x] **TC-220-01**: SVG E2E パイプライン — CSS keyframes 付き SVG 生成 🔵
  - **入力**: 3シーン（intro/content/outro）のシーンデータ
  - **期待結果**: EnhancedExportEngine が成功、renderer 出力に各シーンのラベル・@keyframes が含まれる
  - **信頼性**: 🔵 *export-pipeline-e2e.test.ts より*

- [x] **TC-220-02**: Lottie E2E パイプライン — 5.7.4 JSON 生成 🔵
  - **入力**: 3シーン（intro/content/outro）のシーンデータ
  - **期待結果**: EnhancedExportEngine が成功、renderer 出力に正しいレイヤー数・フレームオフセットが含まれる
  - **信頼性**: 🔵 *export-pipeline-e2e.test.ts より*

- [x] **TC-220-03**: SVG↔Lottie 横断ラベル一貫性 🔵
  - **入力**: 3シーンのシーンデータ
  - **期待結果**: SVG テキストと Lottie レイヤー nm が同じラベルを含む
  - **信頼性**: 🔵 *export-pipeline-e2e.test.ts より*

- [x] **TC-220-04**: SVG↔Lottie 横断色一貫性 🔵
  - **入力**: 各シーンタイプのデータ
  - **期待結果**: SVG hex 色と Lottie fill 色（sceneTypeToFillColor）が一致
  - **信頼性**: 🔵 *export-pipeline-e2e.test.ts + renderer-engine-integration.test.ts より*

- [x] **TC-220-05**: renderer → engine データフロー結合 🔵
  - **入力**: 3シーンのシーンデータ
  - **期待結果**: renderer 出力のプロパティが engine 最終出力に反映される
  - **信頼性**: 🔵 *renderer-engine-integration.test.ts より*

- [x] **TC-220-06**: シーンタイプ別委譲（intro/content/outro） 🔵
  - **入力**: 各シーンタイプのデータ
  - **期待結果**: 各タイプの色・スタイルが SVG/Lottie 両方に正しく適用される
  - **信頼性**: 🔵 *renderer-engine-integration.test.ts より*

- [x] **TC-220-07**: フォーマット委譲（svg-animated / json-lottie） 🔵
  - **入力**: 各フォーマット指定
  - **期待結果**: engine が対応する renderer 関数を選択して出力
  - **信頼性**: 🔵 *renderer-engine-integration.test.ts より*

#### 異常系

- [x] **TC-220-E01**: 空シーンフォールバック 🔵
  - **入力**: scenes=[] のシーンデータ
  - **期待結果**: SVG に "No scene data" プレースホルダー、Lottie に空レイヤー配列、engine が成功
  - **信頼性**: 🔵 *export-pipeline-e2e.test.ts + renderer-engine-integration.test.ts より*

- [x] **TC-220-E02**: 欠損オプションフィールドのシーン 🔵
  - **入力**: label/type/duration 欠損のシーンデータ
  - **期待結果**: デフォルト値（label="Scene N", type=content, duration=2）が適用される
  - **信頼性**: 🔵 *export-pipeline-e2e.test.ts より*

---

## REQ-221: シーンレンダラー入力検証 🔵

**信頼性**: 🔵 *Phase 91 実装・animated-scene-renderer.ts より*

### Given（前提条件）

- animated-scene-renderer モジュールがロード済み

### When（実行条件）

- 無効な FrameInfo（width/height=0/負数/NaN/Infinity）または無効な duration が渡される

### Then（期待結果）

- 無効な width/height は安全なデフォルト値（1920x1080）または上限（7680）にクランプされる
- 無効な duration はデフォルト2秒にフォールバック、上限3600秒にキャップされる
- null/undefined の sceneData でもクラッシュせず空シーンフォールバックを出力

### テストケース

#### 正常系

- [x] **TC-221-01**: validateFrameInfo 正常値はそのまま返す 🔵
  - **入力**: { width: 1920, height: 1080 }
  - **期待結果**: { width: 1920, height: 1080 } が返る
  - **信頼性**: 🔵 *animated-svg-lottie-export.test.ts より*

- [x] **TC-221-02**: validateFrameInfo 小数値は丸める 🔵
  - **入力**: { width: 1920.7, height: 1080.3 }
  - **期待結果**: { width: 1921, height: 1080 } が返る
  - **信頼性**: 🔵 *animated-svg-lottie-export.test.ts より*

- [x] **TC-221-03**: clampSceneDuration 正の値はそのまま返す 🔵
  - **入力**: 5
  - **期待結果**: 5 が返る
  - **信頼性**: 🔵 *animated-svg-lottie-export.test.ts より*

#### 異常系

- [x] **TC-221-E01**: width=0 はデフォルト1920に置換 🔵
  - **入力**: { width: 0, height: 600 }
  - **期待結果**: { width: 1920, height: 600 } が返る
  - **信頼性**: 🔵 *animated-svg-lottie-export.test.ts より*

- [x] **TC-221-E02**: width=負数 はデフォルト1920に置換 🔵
  - **入力**: { width: -100, height: 600 }
  - **期待結果**: { width: 1920, height: 600 } が返る
  - **信頼性**: 🔵 *animated-svg-lottie-export.test.ts より*

- [x] **TC-221-E03**: width=NaN はデフォルト1920に置換 🔵
  - **入力**: { width: NaN, height: 600 }
  - **期待結果**: { width: 1920, height: 600 } が返る
  - **信頼性**: 🔵 *animated-svg-lottie-export.test.ts より*

- [x] **TC-221-E04**: width=Infinity はデフォルト1920に置換 🔵
  - **入力**: { width: Infinity, height: 600 }
  - **期待結果**: { width: 1920, height: 600 } が返る
  - **信頼性**: 🔵 *animated-svg-lottie-export.test.ts より*

- [x] **TC-221-E05**: width>7680 は7680にクランプ 🔵
  - **入力**: { width: 10000, height: 1080 }
  - **期待結果**: { width: 7680, height: 1080 } が返る
  - **信頼性**: 🔵 *animated-svg-lottie-export.test.ts より*

- [x] **TC-221-E06**: clampSceneDuration undefined/null は2を返す 🔵
  - **入力**: undefined, null
  - **期待結果**: 2 が返る
  - **信頼性**: 🔵 *animated-svg-lottie-export.test.ts より*

- [x] **TC-221-E07**: clampSceneDuration 負数/0/NaN/Infinity は2を返す 🔵
  - **入力**: -10, 0, NaN, Infinity
  - **期待結果**: 全て2が返る
  - **信頼性**: 🔵 *animated-svg-lottie-export.test.ts より*

- [x] **TC-221-E08**: clampSceneDuration >3600 は3600にキャップ 🔵
  - **入力**: 7200
  - **期待結果**: 3600 が返る
  - **信頼性**: 🔵 *animated-svg-lottie-export.test.ts より*

#### 境界値

- [x] **TC-221-B01**: width<1 は1にクランプ 🔵
  - **入力**: { width: 0.5, height: 1080 }
  - **期待結果**: { width: 1, height: 1080 } が返る
  - **信頼性**: 🔵 *animated-svg-lottie-export.test.ts より*

- [x] **TC-221-B02**: width/height 両方無効は両デフォルトに置換 🔵
  - **入力**: { width: -1, height: -1 }
  - **期待結果**: { width: 1920, height: 1080 } が返る
  - **信頼性**: 🔵 *animated-svg-lottie-export.test.ts より*

- [x] **TC-221-B03**: clampSceneDuration=3600 はそのまま 🔵
  - **入力**: 3600
  - **期待結果**: 3600 が返る
  - **信頼性**: 🔵 *animated-svg-lottie-export.test.ts より*

- [x] **TC-221-B04**: clampSceneDuration 0.5（小数）はそのまま 🔵
  - **入力**: 0.5
  - **期待結果**: 0.5 が返る
  - **信頼性**: 🔵 *animated-svg-lottie-export.test.ts より*

#### 統合テスト（SVG/Lottie出力への影響）

- [x] **TC-221-I01**: null sceneData でもSVG安全出力 🔵
  - **入力**: sceneData=null, frames={width:0,height:0}
  - **期待結果**: "No scene data" SVG出力、デフォルト1920x1080使用
  - **信頼性**: 🔵 *animated-svg-lottie-export.test.ts より*

- [x] **TC-221-I02**: null sceneData でもLottie安全出力 🔵
  - **入力**: sceneData=null, frames={width:0,height:0}
  - **期待結果**: 有効なLottie JSON、w=1920, h=1080、空layers
  - **信頼性**: 🔵 *animated-svg-lottie-export.test.ts より*

- [x] **TC-221-I03**: 極大寸法は8KにクランプしてSVG出力 🔵
  - **入力**: {width:50000, height:50000}
  - **期待結果**: SVG に width="7680" height="7680"
  - **信頼性**: 🔵 *animated-svg-lottie-export.test.ts より*

- [x] **TC-221-I04**: 極大寸法は8KにクランプしてLottie出力 🔵
  - **入力**: {width:50000, height:50000}
  - **期待結果**: lottie.w=7680, lottie.h=7680
  - **信頼性**: 🔵 *animated-svg-lottie-export.test.ts より*

- [x] **TC-221-I05**: 無効durationのシーンでもSVG安全出力 🔵
  - **入力**: scenes=[{duration:-5},{duration:NaN}]
  - **期待結果**: 各2秒デフォルト、合計4秒アニメーション
  - **信頼性**: 🔵 *animated-svg-lottie-export.test.ts より*

- [x] **TC-221-I06**: 極長durationは3600秒キャップでSVG出力 🔵
  - **入力**: scenes=[{duration:99999}]
  - **期待結果**: SVG animation duration 3600s
  - **信頼性**: 🔵 *animated-svg-lottie-export.test.ts より*

---

## REQ-222: エラーリカバリREST API堅牢化 🔵

**信頼性**: 🔵 *Phase 92 実装・src/api/routes/errors.ts・@stv/core/config/limits より*

### Given（前提条件）

- エラーリカバリREST API（POST /register・GET /:errorId/options・POST /:errorId/recover）が稼働している

### When（実行条件）

- 各種入力パターンのリクエストを送信する

### Then（期待結果）

- Zod RegisterBodySchema により errorId・errorMessage の形式・長さが検証される
- パスパラメータ errorId が形式検証され不正値は 400 INVALID_ERROR_ID が返される
- HTMLタグが含まれる errorMessage は sanitizeMessage() でサニタイズされる
- エラーレジストリが1000件に達すると最古10%が退去される

### テストケース

#### 正常系

- [x] **TC-222-01**: 有効なerrorId（ハイフン・アンダースコア・ドット含む）で登録成功 🔵
  - **入力**: {errorId: 'my-error_id.v2', errorMessage: 'test error'}
  - **期待結果**: 200 success=true, data.errorId='my-error_id.v2'
  - **信頼性**: 🔵 *tests/unit/api/routes/errors.test.ts より*

#### 異常系

- [x] **TC-222-E01**: errorIdにスペースを含むと400 VALIDATION_ERROR 🔵
  - **入力**: {errorId: 'err space', errorMessage: 'test error'}
  - **期待結果**: 400, error.code='VALIDATION_ERROR'
  - **信頼性**: 🔵 *tests/unit/api/routes/errors.test.ts より*

- [x] **TC-222-E02**: errorIdに特殊文字を含むと400 🔵
  - **入力**: {errorId: 'err@#$%', errorMessage: 'test error'}
  - **期待結果**: 400, success=false
  - **信頼性**: 🔵 *tests/unit/api/routes/errors.test.ts より*

- [x] **TC-222-E03**: errorIdが129文字で400 🔵
  - **入力**: {errorId: 'a'.repeat(129), errorMessage: 'test error'}
  - **期待結果**: 400, success=false
  - **信頼性**: 🔵 *tests/unit/api/routes/errors.test.ts より*

- [x] **TC-222-E04**: errorMessageが2001文字で400 🔵
  - **入力**: {errorId: 'err-long', errorMessage: 'x'.repeat(2001)}
  - **期待結果**: 400, success=false
  - **信頼性**: 🔵 *tests/unit/api/routes/errors.test.ts より*

- [x] **TC-222-E05**: パスパラメータerrorIdにスペースでGET /options が400 INVALID_ERROR_ID 🔵
  - **入力**: GET /api/v1/errors/err%20id/options
  - **期待結果**: 400, error.code='INVALID_ERROR_ID'
  - **信頼性**: 🔵 *tests/unit/api/routes/errors.test.ts より*

- [x] **TC-222-E06**: パスパラメータerrorIdにスペースでPOST /recover が400 INVALID_ERROR_ID 🔵
  - **入力**: POST /api/v1/errors/err%20id/recover
  - **期待結果**: 400, error.code='INVALID_ERROR_ID'
  - **信頼性**: 🔵 *tests/unit/api/routes/errors.test.ts より*

#### セキュリティ

- [x] **TC-222-S01**: HTMLタグ付きerrorMessageがXSSサニタイズされて登録成功 🔵
  - **入力**: {errorId: 'err-xss', errorMessage: '<script>alert("xss")</script>File format unsupported'}
  - **期待結果**: 200, success=true（メッセージはサニタイズ済）
  - **信頼性**: 🔵 *tests/unit/api/routes/errors.test.ts より*

---

## REQ-223: エクスポート検証拡張 🔵

**信頼性**: 🔵 *Phase 93 実装・src/export/export-verifier.ts より*

### Given（前提条件）

- ExportVerifier が REQ-093 の基本検証（MP4/WebM/GIF/PNG/SVG/PDF/JSON）を提供している
- APNG エンコーダー（src/export/apng-encoder.ts）が acTL/fcTL チャンク付き APNG を生成する
- AnimatedSceneRenderer（src/export/animated-scene-renderer.ts）が Lottie 5.7.4 互換 JSON を生成する

### When（実行条件）

- APNG バイナリを 'apng' フォーマットで検証する
- Lottie JSON を 'lottie' フォーマットで検証する

### Then（期待結果）

- APNG: PNG署名に加えて acTL チャンクの存在・numFrames 正値・fcTL チャンク数との整合性が検証される
- Lottie: 必須ルートフィールド（v/fr/ip/op/w/h/layers）の存在・fr正値・op>ip・w/h正値が検証される
- deepValidation時は layers 各要素の ty 型フィールドが検証される

### テストケース

#### 正常系

- [x] **TC-223-N01**: acTL+fcTL付きAPNGが検証通過 🔵
- [x] **TC-223-N02**: 有効なLottie JSONが検証通過（バージョン・フレームレート・レイヤー数メタデータ抽出） 🔵
- [x] **TC-223-N03**: Lottie メタデータ抽出（寸法・フレームレンジ・レイヤー数） 🔵
- [x] **TC-223-N04**: renderer→verifier round-trip（SVG文字列・Lottie JSON・ArrayBuffer） 🔵

#### 異常系

- [x] **TC-223-E01**: acTL無しAPNG（プレーンPNG）は検証失敗 🔵
- [x] **TC-223-E02**: acTL num_frames=0 は検証失敗 🔵
- [x] **TC-223-E03**: fcTL数 > acTL num_frames は deepValidation時エラー 🔵
- [x] **TC-223-E04**: 無効JSONのLottie検証はパースエラー 🔵
- [x] **TC-223-E05**: Lottie必須フィールド欠落は検証失敗 🔵
- [x] **TC-223-E06**: fr<=0 のLottieは検証失敗 🔵
- [x] **TC-223-E07**: op<=ip のLottieは検証失敗 🔵
- [x] **TC-223-E08**: w/h<=0 のLottieは検証失敗 🔵
- [x] **TC-223-E09**: layer[i] ty無しは deepValidation時エラー 🔵
- [x] **TC-223-E10**: corrupted Lottie JSON round-tripで検出 🔵

#### 警告系

- [x] **TC-223-W01**: fcTL数 < acTL num_frames は警告 🔵
- [x] **TC-223-W02**: acTL有り・fcTL無しは警告 🔵
- [x] **TC-223-W03**: 空layers配列は警告 🔵
- [x] **TC-223-W04**: 非対応バージョン（v=3.0.0）は警告 🔵
- [x] **TC-223-W05**: layer ip/op欠落は deepValidation時警告 🔵

---

## REQ-224: エクスポートレート制限・レンダーエンドポイント検証強化 🔵

**信頼性**: 🔵 *Phase 94 実装・src/api/middleware/rate-limit.ts・src/api/routes/pipeline.ts・@stv/core/config/limits より*

### Given（前提条件）

- Express API サーバーが起動している
- exportRateLimiter ミドルウェアが設定されている（10リクエスト/15分/IP）
- RenderRequestSchema が codec 列挙型（h264/h265/vp9/av1）と resolution 正規表現（WIDTHxHEIGHT）を検証する
- RATE_LIMITS.EXPORT が limits.ts に定義されている

### When（実行条件）

- POST /api/render にレンダリングリクエストを送信する

### Then（期待結果）

- 15分間に10リクエストを超過すると 429 EXPORT_RATE_LIMIT_EXCEEDED が返却される
- codec が h264/h265/vp9/av1 以外の場合 400 VALIDATION_ERROR が返却される
- resolution が WIDTHxHEIGHT 形式でない場合 400 VALIDATION_ERROR が返却される

### テストケース

#### 異常系

- [x] **TC-224-E01**: 無効なcodec値で400 VALIDATION_ERROR 🔵
  - **入力**: {scenes: [{id: 1}], options: {codec: 'invalid_codec'}}
  - **期待結果**: 400, error.code='VALIDATION_ERROR'
  - **信頼性**: 🔵 *src/api/routes/__tests__/pipeline.test.ts より*

- [x] **TC-224-E02**: 無効なresolution形式で400 VALIDATION_ERROR 🔵
  - **入力**: {scenes: [{id: 1}], options: {resolution: 'not-a-resolution'}}
  - **期待結果**: 400, error.code='VALIDATION_ERROR'
  - **信頼性**: 🔵 *src/api/routes/__tests__/pipeline.test.ts より*

---

## REQ-227: エクスポートリトライとフェイルセーフ 🔵

**信頼性**: 🔵 *Phases 89-96のエクスポートパイプライン信頼性継続改善・enhanced-export-engine.ts encodeVideo()設計より*

### Given（前提条件）

- EnhancedExportEngine がエクスポートジョブを処理中
- Stage 3（encoding）で一時的エラー（OOM / タイムアウト / Workerクラッシュ）が発生
- EXPORT_RETRY_LIMITS が limits.ts に定義されている（maxRetries: 3, initialDelayMs: 1000, maxDelayMs: 30000, jitterMs: 500）

### When（実行条件）

- エンコーディング段階で一時的エラーがスローされる

### Then（期待結果）

- システムは指数バックオフ（1s → 2s → 4s、最大30s）+ ランダムジッター（0〜500ms）でリトライする
- 非一時的エラー（FormatValidationError / データ欠損）はリトライせず即座に失敗
- リトライ試行ごとに ExportMetricsCollector に retry_attempt イベントが記録される
- 全リトライ失敗時は最後のエラーメッセージを ExportResult.error に格納

### テストケース

#### 正常系

- [x] **TC-227-01**: 一時的エラー後リトライ成功 🔵
  - **入力**: エンコーディング1回目OOM・2回目成功
  - **期待結果**: ExportResult.success=true、retry_count=1がメトリクスに記録
  - **信頼性**: 🔵 *enhanced-export-engine.ts processExport()フローから妥当*

- [x] **TC-227-02**: 最大3回リトライ後成功 🔵
  - **入力**: エンコーディング1-3回目OOM・4回目成功
  - **期待結果**: ExportResult.success=true、retry_count=3がメトリクスに記録
  - **信頼性**: 🔵 *EXPORT_RETRY_LIMITS設計より*

#### 異常系

- [x] **TC-227-E01**: 全リトライ失敗でエラー返却 🔵
  - **入力**: エンコーディング4回連続OOM
  - **期待結果**: ExportResult.success=false、errorに最後のOOMメッセージ
  - **信頼性**: 🔵 *リトライ上限仕様より*

- [x] **TC-227-E02**: 非一時的エラーはリトライなし 🔵
  - **入力**: FormatValidationError スロー
  - **期待結果**: ExportResult.success=false、retry_count=0
  - **信頼性**: 🔵 *エラー分類仕様より*

#### 境界値

- [x] **TC-227-B01**: バックオフ最大待機時間キャップ 🔵
  - **入力**: リトライ間隔が30sを超える試算
  - **期待結果**: 待機時間が30sでキャップされる
  - **信頼性**: 🔵 *EXPORT_RETRY_LIMITS.maxDelayMs仕様より*

- [x] **TC-227-B02**: ジッター範囲確認 🔵
  - **入力**: 100回のリトライ実行
  - **期待結果**: 全ジッター値が0〜500msの範囲内
  - **信頼性**: 🔵 *jitterMs設計より*

---

## REQ-228: エクスポートジョブライフサイクル管理 🔵

**信頼性**: 🔵 *REQ-226メトリクス基盤・REST API /api/render 運用改善・enhanced-export-engine.ts設計より*

### Given（前提条件）

- EnhancedExportEngine がエクスポートジョブを実行中
- 各ジョブに AbortController が関連付けられている
- EXPORT_STAGE_TIMEOUTS が limits.ts に定義されている（preparing: 30s, rendering: 600s, encoding: 300s, finalizing: 60s）

### When（実行条件）

- cancelExport(jobId) が呼び出される、またはステージ実行がタイムアウト値を超過する

### Then（期待結果）

- 該当ジョブの AbortController.abort() が呼ばれる
- Stage 2（rendering）のフレームループが即座に中断される
- Stage 3（encoding）が即座に中断される
- ExportResult.success=false・error='Export cancelled' が返却される
- タイムアウト時は error='Stage {name} timed out after {ms}ms' が返却される

### テストケース

#### 正常系

- [x] **TC-228-01**: アクティブジョブのキャンセル 🔵
  - **入力**: レンダリング中のジョブIDで cancelExport() 呼び出し
  - **期待結果**: ExportResult.success=false, error='Export cancelled'
  - **信頼性**: 🔵 *AbortController設計より*

- [x] **TC-228-02**: キャンセル後のリソース解放 🔵
  - **入力**: キャンセル完了後の activeExports 確認
  - **期待結果**: 該当ジョブが activeExports Map から削除、processNextInQueue() が呼ばれる
  - **信頼性**: 🔵 *enhanced-export-engine.ts finally設計より*

#### 異常系

- [x] **TC-228-E01**: 存在しないジョブIDのキャンセル 🔵
  - **入力**: 未登録jobIdで cancelExport() 呼び出し
  - **期待結果**: false を返却（エラーをスローしない）
  - **信頼性**: 🔵 * graceful 設計より*

- [x] **TC-228-E02**: レンダリングステージタイムアウト 🔵
  - **入力**: rendering段階が600sを超過
  - **期待結果**: ExportResult.success=false, error='Stage rendering timed out after 600000ms'
  - **信頼性**: 🔵 *EXPORT_STAGE_TIMEOUTS仕様より*

#### 境界値

- [x] **TC-228-B01**: タイムアウト境界値（1ms未満） 🔵
  - **入力**: タイムアウト値0msまたは負数
  - **期待結果**: タイムアウト無効化（永遠に待機）またはデフォルト値フォールバック
  - **信頼性**: 🔵 *limits.tsバリデーション設計より*

- [x] **TC-228-B02**: 最終段階（finalizing）中のキャンセル 🔵
  - **入力**: finalizing段階で cancelExport() 呼び出し
  - **期待結果**: 既にファイル書き込み済みの場合は結果返却、未完了ならキャンセル
  - **信頼性**: 🔵 *ステージ非同期設計より*

---

## テストケースサマリー（REQ-227/228追加分）

| カテゴリ | 正常系 | 異常系 | 境界値 | 合計 |
|---------|--------|--------|--------|------|
| REQ-227 リトライ | 2 | 2 | 2 | 6 |
| REQ-228 ライフサイクル | 2 | 2 | 2 | 6 |
| **合計** | **4** | **4** | **4** | **12** |

### 信頼性レベル分布（追加分）

- 🔵 青信号: 12件 (100%)
- 🟡 黄信号: 0件 (0%)
- 🔴 赤信号: 0件 (0%)

---

## REQ-229: エクスポートジョブキューサービス 🔵

**信頼性**: 🔵 *ExportJobQueue実装済・コミットa949644・32テスト合格*

### Given（前提条件）

- ExportJobQueue が初期化され、EXPORT_QUEUE_LIMITS（MAX_CONCURRENT=3, MAX_QUEUE_SIZE=100, STARVATION_PREVENTION_INTERVAL_MS=30000）が設定されている
- ExportMetricsCollector がインスタンス化されている
- ジョブは high/normal/low のいずれかの優先度を持つ

### When（実行条件）

- ジョブが enqueue() でキューに追加される
- アクティブジョブが完了しスロットが解放される
- フェアスケジューラーが30秒間隔で実行される

### Then（期待結果）

- 高優先度ジョブが低優先度より先に処理される
- 同優先度内ではFIFO順で処理される
- 同時実行数が maxConcurrent を超えない
- getQueuePosition() が正しい位置とETAを返す
- 低優先度ジョブが30秒以上待機で昇格される
- ExportMetricsCollector に4メトリクスが記録される

### テストケース

#### 正常系

- [x] **TC-229-01**: 優先度順処理（high→normal→low） 🔵
  - **入力**: 3優先度のジョブを逆順で enqueue
  - **期待結果**: high → normal → low の順で処理開始
  - **信頼性**: 🔵 *テスト: priority ordering respects high→normal→low*

- [x] **TC-229-02**: 同優先度内FIFO順 🔵
  - **入力**: 同じnormal優先度のジョブ3つを順次 enqueue
  - **期待結果**: 登録順に処理開始
  - **信頼性**: 🔵 *テスト: same-priority jobs processed FIFO*

- [x] **TC-229-03**: 同時実行制御（maxConcurrent=3） 🔵
  - **入力**: 5ジョブを enqueue（maxConcurrent=3）
  - **期待結果**: 最初の3ジョブが即時開始、残り2はキュー待機
  - **信頼性**: 🔵 *テスト: respects maxConcurrent limit*

- [x] **TC-229-04**: キュー位置・ETA追跡 🔵
  - **入力**: ジョブ enqueue 後 getQueuePosition() 呼び出し
  - **期待結果**: 正しい position と ETA（avgDurationMs × position）を返す
  - **信頼性**: 🔵 *テスト: queue position tracking*

#### 異常系

- [x] **TC-229-E01**: キューサイズ上限超過 🔵
  - **入力**: MAX_QUEUE_SIZE(100) 超過のジョブを enqueue
  - **期待結果**: エラーをスローして追加拒否
  - **信頼性**: 🔵 *テスト: rejects when queue is full*

- [x] **TC-229-E02**: キュー済みジョブのキャンセル 🔵
  - **入力**: 待機中ジョブの cancel() 呼び出し
  - **期待結果**: ジョブがキューから除外、待機中の後続ジョブが繰り上がる
  - **信頼性**: 🔵 *テスト: cancel queued job*

#### 境界値

- [x] **TC-229-B01**: フェアスケジューリング（飽和防止） 🔵
  - **入力**: 低優先度ジョブが30秒以上待機
  - **期待結果**: 低優先度ジョブがnormalに昇格され処理される
  - **信頼性**: 🔵 *テスト: starvation prevention promotes old low-priority jobs*

- [x] **TC-229-B02**: 空キューでの即時処理 🔵
  - **入力**: アイドル状態でジョブを1つ enqueue
  - **期待結果**: 即座に処理開始（キュー通過なし）
  - **信頼性**: 🔵 *テスト: immediate processing when slots available*

- [x] **TC-229-B03**: ExportMetricsCollector統合 🔵
  - **入力**: ジョブの enqueue/dequeue/完了
  - **期待結果**: queue_size, queue_wait_time_ms, queue_dequeue_count, queue_priority_distribution が記録される
  - **信頼性**: 🔵 *テスト: metrics integration with ExportMetricsCollector*

---

## テストケースサマリー（REQ-229追加分）

| カテゴリ | 正常系 | 異常系 | 境界値 | 合計 |
|---------|--------|--------|--------|------|
| REQ-229 ジョブキュー | 4 | 2 | 3 | 9 |

### 信頼性レベル分布（REQ-229追加分）

- 🔵 青信号: 9件 (100%)

---

## REQ-230: エクスポートアーティファクト管理 🔵

**信頼性**: 🔵 *ExportArtifactStore実装・src/export/export-artifact-store.ts より*

### Given（前提条件）

- ExportArtifactStoreが初期化され、ARTIFACT_STORE_LIMITSが設定されている
- エクスポート結果（ExportResult）が生成されている

### When（実行条件）

- エクスポート成果物をExportArtifactStoreに保存する
- TTL期限切れアーティファクトがクリーンアップされる
- クォータ超過時にLRU退去が実行される
- ダウンロードURLが生成・検証される

### Then（期待結果）

- アーティファクトがメタデータ付きで保存され、一意のartifactIdで識別される
- TTL期限切れアーティファクトが定期削除される
- クォータ超過時に最も古い未使用アーティファクトが退去される
- 有効期限付きダウンロードURLが生成される
- ExportMetricsCollectorに4メトリクスが記録される

### テストケース

#### 正常系

- [x] **TC-230-01**: アーティファクト保存・取得 🔵
  - **入力**: エクスポート結果（data, format, metadata）
  - **期待結果**: artifactId で取得可能、メタデータが正しく保存される
  - **信頼性**: 🔵 *テスト: store and retrieve artifact*

- [x] **TC-230-02**: ダウンロードURL生成 🔵
  - **入力**: 有効なartifactId
  - **期待結果**: トークン付きURLが生成され、5分間有効
  - **信頼性**: 🔵 *テスト: generate download URL with token*

- [x] **TC-230-03**: 使用量統計取得 🔵
  - **入力**: 複数アーティファクト保存後
  - **期待結果**: 総バイト数・アーティファクト数・フォーマット別分布が正確
  - **信頼性**: 🔵 *テスト: usage tracking*

#### 異常系

- [x] **TC-230-E01**: クォータ超過時のLRU退去 🔵
  - **入力**: MAX_ARTIFACTS到達後の新規保存
  - **期待結果**: 最古の未使用アーティファクトが退去され、新規保存が成功
  - **信頼性**: 🔵 *テスト: LRU eviction on quota*

- [x] **TC-230-E02**: 期限切れダウンロードURL 🔵
  - **入力**: 期限切れトークンでのダウンロード試行
  - **期待結果**: ダウンロードが拒否される
  - **信頼性**: 🔵 *テスト: expired download URL rejected*

#### 境界値

- [x] **TC-230-B01**: TTL期限切れクリーンアップ 🔵
  - **入力**: TTL経過後のクリーンアップ実行
  - **期待結果**: 期限切れアーティファクトが削除される
  - **信頼性**: 🔵 *テスト: TTL cleanup*

- [x] **TC-230-B02**: ExportMetricsCollector統合 🔵
  - **入力**: アーティファクト保存・期限切れ・ダウンロード
  - **期待結果**: artifact_stored_count, artifact_storage_bytes, artifact_expired_count, artifact_download_count が記録される
  - **信頼性**: 🔵 *テスト: metrics integration*

---

## REQ-231: EnhancedExportEngineアーティファクト保存統合 🔵

**信頼性**: 🔵 *REQ-230 ExportArtifactStore設計・EnhancedExportEngine.finalizeExport() 拡張より*

### Given（前提条件）

- EnhancedExportEngineがExportArtifactStoreインスタンスを保持している
- エクスポートが正常に完了しExportResultが生成されている

### When（実行条件）

- finalizeExport() がExportResultを返す前にExportArtifactStore.store()を呼び出す

### Then（期待結果）

- 成果物がアーティファクトストアに保存される
- ExportResultにartifactIdが含まれる
- store()失敗時は警告ログのみでExportResult.successはtrueのまま

### テストケース

- [x] **TC-231-01**: 正常系: エクスポート完了時にアーティファクトが自動保存される 🔵
- [x] **TC-231-02**: 異常系: store()失敗時に警告ログ出力・ExportResult.successはtrue 🟡

---

## REQ-235: LRU退去E2Eテスト 🔵

**信頼性**: 🔵 *ExportArtifactStore.evictLRU()・ARTIFACT_STORE_LIMITS より*

### Given（前提条件）

- ExportArtifactStoreのMAX_STORAGE_BYTESを低値（例: 1MB）に設定
- 複数のアーティファクトが保存済み

### When（実行条件）

- クォータを超過する新規アーティファクトを保存する

### Then（期待結果）

- 最も古い未使用アーティファクトが退去される
- 退去後の新規保存が成功する
- ExportMetricsCollectorにartifact_expired_countが記録される

### テストケース

- [x] **TC-235-01**: クォータ到達時LRU退去発火 🔵
- [x] **TC-235-02**: 退去後の新規保存成功 🔵
- [x] **TC-235-03**: メトリクス記録確認 🔵

---

## REQ-237: アーティファクトライフサイクルE2Eテスト 🔵

**信頼性**: 🔵 *EnhancedExportEngine→ExportArtifactStore→download API 完全パスより*

### Given（前提条件）

- EnhancedExportEngineにExportArtifactStoreが統合済み（REQ-231実装後）

### When（実行条件）

- エクスポートを実行し、成果物を保存し、ダウンロードURLを生成し、取得する

### Then（期待結果）

- エクスポート→保存→URL生成→取得の全ステップが成功する
- 各ステップでExportMetricsCollectorにメトリクスが記録される

### テストケース

- [x] **TC-237-01**: 完全ライフサイクル（エクスポート→保存→ダウンロード）成功 🔵
- 🟡 黄信号: 0件 (0%)
- 🔴 赤信号: 0件 (0%)

---

## REQ-238: アーティファクト一覧API 🔵

**信頼性**: 🔵 *src/api/routes/export.ts GET /artifacts・テスト通過より*

### Given（前提条件）

- ExportArtifactStoreに複数アーティファクトが保存されている
- REST APIサーバーが起動している

### When（実行条件）

- GET /api/v1/export/artifacts を呼び出す
- オプションでformat・limit・offsetクエリパラメータを指定する

### Then（期待結果）

- 200ステータスでアーティファクト一覧が返される
- フォーマットフィルタが適用される
- ページネーション（limit最大200、offset）が機能する

### テストケース

#### 正常系

- [x] **TC-238-01**: アーティファクトなし時に空リスト返却 🔵
  - **入力**: アーティファクトなしのstore
  - **期待結果**: artifacts=[], total=0
  - **信頼性**: 🔵 *テスト通過*

- [x] **TC-238-02**: 全アーティファクト一覧返却 🔵
  - **入力**: 2件（svg+mp4）保存済み
  - **期待結果**: artifacts.length=2, total=2
  - **信頼性**: 🔵 *テスト通過*

- [x] **TC-238-03**: フォーマットフィルタ適用 🔵
  - **入力**: 3件（svg×2+mp4）保存済み、format=svg
  - **期待結果**: artifacts.length=2, 全てformat=svg
  - **信頼性**: 🔵 *テスト通過*

- [x] **TC-238-04**: ページネーション（limit/offset） 🔵
  - **入力**: 5件保存済み、limit=2, offset=0
  - **期待結果**: artifacts.length=2, total=5, limit=2, offset=0
  - **信頼性**: 🔵 *テスト通過*

- [x] **TC-238-05**: limit上限クランプ（最大200） 🔵
  - **入力**: limit=500
  - **期待結果**: limit=200
  - **信頼性**: 🔵 *テスト通過*

- [x] **TC-238-06**: 不正limit/offset時のデフォルト値 🔵
  - **入力**: limit=abc, offset=-1
  - **期待結果**: limit=50, offset=0
  - **信頼性**: 🔵 *テスト通過*

#### 異常系・境界値

- [x] **TC-238-E01**: プロトタイプ継承キーをformatに指定した場合の400拒否 🔵
  - **入力**: format=constructor / format=toString（`in` 演算子はプロトタイプチェーンを走査するため旧実装では通過）
  - **期待結果**: 400 VALIDATION_ERROR（空の200を返さない）
  - **信頼性**: 🔵 *テスト通過（mutation検証済み: `in` に戻すとRED）*

- [x] **TC-238-B01**: デフォルトlimitもMAX上限でクランプ 🔵
  - **入力**: EXPORT_LIST_DEFAULT_LIMIT=1000, EXPORT_LIST_MAX_LIMIT=200 相当（resolveListLimit(NaN, 1000, 200)）
  - **期待結果**: limit=200（?limit= 明示指定と同じ上限がデフォルト経路にも適用される）
  - **信頼性**: 🔵 *テスト通過（mutation検証済み: デフォルト経路のクランプを外すとRED）*

---

## REQ-239: アーティファクトメタデータ取得・削除API 🔵

**信頼性**: 🔵 *src/api/routes/export.ts GET/DELETE /artifacts/:id・UUID検証・テスト通過より*

### Given（前提条件）

- ExportArtifactStoreにアーティファクトが保存されている
- REST APIサーバーが起動している

### When（実行条件）

- GET /api/v1/export/artifacts/:artifactId でメタデータを取得
- DELETE /api/v1/export/artifacts/:artifactId でアーティファクトを削除

### Then（期待結果）

- 正常なartifactIdで200ステータス・メタデータまたは削除確認を返す
- 不正なUUID形式で400 VALIDATION_ERRORを返す
- 存在しないartifactIdで404 ARTIFACT_NOT_FOUNDを返す

### テストケース

#### 正常系

- [x] **TC-239-01**: メタデータ取得成功 🔵
  - **入力**: artifactId（有効・存在する）
  - **期待結果**: 200, artifactId, format, sizeBytes, metadata返却（dataフィールドなし）
  - **信頼性**: 🔵 *テスト通過*

- [x] **TC-239-02**: アーティファクト削除成功 🔵
  - **入力**: artifactId（有効・存在する）
  - **期待結果**: 200, deleted=true, 後続GETで404
  - **信頼性**: 🔵 *テスト通過*

#### 異常系

- [x] **TC-239-E01**: 存在しないartifactIdのメタデータ取得 🔵
  - **入力**: 存在しないUUID
  - **期待結果**: 404, ARTIFACT_NOT_FOUND
  - **信頼性**: 🔵 *テスト通過*

- [x] **TC-239-E02**: 不正artifactId形式 🔵
  - **入力**: "not-a-uuid"
  - **期待結果**: 400, VALIDATION_ERROR
  - **信頼性**: 🔵 *テスト通過*

- [x] **TC-239-E03**: 存在しないartifactIdの削除 🔵
  - **入力**: 存在しないUUID
  - **期待結果**: 404, ARTIFACT_NOT_FOUND
  - **信頼性**: 🔵 *テスト通過*

- [x] **TC-239-E04**: 不正artifactId形式での削除 🔵
  - **入力**: "invalid"
  - **期待結果**: 400, VALIDATION_ERROR
  - **信頼性**: 🔵 *テスト通過*

---

## REQ-240: アーティファクト使用量統計API 🔵

**信頼性**: 🔵 *src/api/routes/export.ts GET /artifacts/usage・ExportArtifactStore.getUsage()・テスト通過より*

### Given（前提条件）

- ExportArtifactStoreに複数フォーマットのアーティファクトが保存されている

### When（実行条件）

- GET /api/v1/export/artifacts/usage を呼び出す

### Then（期待結果）

- 200ステータスでartifactCount・totalBytes・formatDistributionが返される

### テストケース

#### 正常系

- [x] **TC-240-01**: 使用量統計取得（データあり） 🔵
  - **入力**: svg(10bytes)+mp4(20bytes)保存済み
  - **期待結果**: artifactCount=2, totalBytes=30, formatDistribution={svg:1, mp4:1}
  - **信頼性**: 🔵 *テスト通過*

- [x] **TC-240-02**: 使用量統計取得（空store） 🔵
  - **入力**: アーティファクトなし
  - **期待結果**: artifactCount=0, totalBytes=0
  - **信頼性**: 🔵 *テスト通過*

---

## テストケースサマリー（REQ-238~240 Phase 103追加分）

| カテゴリ | 正常系 | 異常系 | 合計 |
|---------|--------|--------|------|
| REQ-238 アーティファクト一覧 | 6 | 2 | 8 |
| REQ-239 メタデータ取得・削除 | 2 | 4 | 6 |
| REQ-240 使用量統計 | 2 | 0 | 2 |
| **合計** | **10** | **6** | **16** |

### 信頼性レベル分布

- 🔵 青信号: 16件 (100%)
- 🟡 黄信号: 0件 (0%)
- 🔴 赤信号: 0件 (0%)

---

## REQ-241: エクスポートジョブ投入API 🔵

**信頼性**: 🔵 *src/export/export-job-queue.ts enqueue()・src/api/routes/export-jobs.ts・テスト通過より*

### Given（前提条件）

- ExportJobQueueが初期化されている
- REST APIサーバーが起動している

### When（実行条件）

- POST /api/v1/export/jobs でジョブを投入する
- format・inputHash・priority（任意）を指定する

### Then（期待結果）

- 201ステータスでjobId・status=queued・queuePosition・ETAが返される
- 不正なformat/inputHashで400エラー
- キュー満杯時に503エラー

### テストケース

#### 正常系

- [x] **TC-241-01**: デフォルト優先度（normal）でジョブ投入 🔵
  - **入力**: format=svg, inputHash=abc123
  - **期待結果**: 201, priority=normal, status=queued
  - **信頼性**: 🔵 *テスト通過*

- [x] **TC-241-02**: high優先度でジョブ投入 🔵
  - **入力**: format=mp4, priority=high
  - **期待結果**: 201, priority=high
  - **信頼性**: 🔵 *テスト通過*

- [x] **TC-241-03**: low優先度でジョブ投入 🔵
  - **入力**: format=pdf, priority=low
  - **期待結果**: 201, priority=low
  - **信頼性**: 🔵 *テスト通過*

- [x] **TC-241-04**: 不正優先度のフォールバック 🔵
  - **入力**: priority=invalid
  - **期待結果**: 201, priority=normal
  - **信頼性**: 🔵 *テスト通過*

- [x] **TC-241-05**: キュー位置・ETA返却 🔵
  - **入力**: 正常なジョブ投入
  - **期待結果**: queuePositionとestimatedWaitTimeMsが返される
  - **信頼性**: 🔵 *テスト通過*

#### 異常系

- [x] **TC-241-E01**: format欠落時400エラー 🔵
  - **入力**: inputHashのみ
  - **期待結果**: 400, VALIDATION_ERROR
  - **信頼性**: 🔵 *テスト通過*

- [x] **TC-241-E02**: inputHash欠落時400エラー 🔵
  - **入力**: formatのみ
  - **期待結果**: 400, VALIDATION_ERROR
  - **信頼性**: 🔵 *テスト通過*

- [x] **TC-241-E03**: キュー満杯時503エラー 🔵
  - **入力**: maxQueueSize=2のキューに3件目を投入
  - **期待結果**: 503, QUEUE_FULL
  - **信頼性**: 🔵 *テスト通過*

---

## REQ-242: エクスポートジョブステータス取得API 🔵

**信頼性**: 🔵 *src/api/routes/export-jobs.ts GET /jobs/:jobId・テスト通過より*

### Given（前提条件）

- ExportJobQueueにジョブが存在する

### When（実行条件）

- GET /api/v1/export/jobs/:jobId を呼び出す

### Then（期待結果）

- 200ステータスでjobId・status・priority・format・artifactId等が返される
- 不正UUIDで400エラー
- 存在しないjobIdで404エラー

### テストケース

#### 正常系

- [x] **TC-242-01**: queuedジョブのステータス取得 🔵
  - **入力**: 有効なqueuedジョブのjobId
  - **期待結果**: 200, status=queued, artifactId=null
  - **信頼性**: 🔵 *テスト通過*

- [x] **TC-242-02**: completedジョブのステータス取得 🔵
  - **入力**: 完了済みジョブのjobId
  - **期待結果**: 200, status=completed, artifactId定義済み
  - **信頼性**: 🔵 *テスト通過*

- [x] **TC-242-03**: failedジョブのステータス取得 🔵
  - **入力**: 失敗済みジョブのjobId
  - **期待結果**: 200, status=failed
  - **信頼性**: 🔵 *テスト通過*

- [x] **TC-242-04**: queuedジョブのキュー位置とETA 🔵
  - **入力**: queuedジョブのjobId
  - **期待結果**: queuePosition=0
  - **信頼性**: 🔵 *テスト通過*

#### 異常系

- [x] **TC-242-E01**: 存在しないjobId 🔵
  - **入力**: 存在しないUUID
  - **期待結果**: 404, JOB_NOT_FOUND
  - **信頼性**: 🔵 *テスト通過*

- [x] **TC-242-E02**: 不正jobId形式 🔵
  - **入力**: "not-a-uuid"
  - **期待結果**: 400, VALIDATION_ERROR
  - **信頼性**: 🔵 *テスト通過*

---

## REQ-243: エクスポートジョブキャンセルAPI 🔵

**信頼性**: 🔵 *src/api/routes/export-jobs.ts DELETE /jobs/:jobId・ExportJobQueue.cancel()・テスト通過より*

### Given（前提条件）

- ExportJobQueueにジョブが存在する

### When（実行条件）

- DELETE /api/v1/export/jobs/:jobId を呼び出す

### Then（期待結果）

- queued/runningジョブは200でキャンセル成功
- completed/failed/cancelledジョブは409 JOB_ALREADY_TERMINATED
- 不正UUIDで400エラー、存在しないjobIdで404エラー

### テストケース

#### 正常系

- [x] **TC-243-01**: queuedジョブのキャンセル 🔵
  - **入力**: queuedジョブのjobId
  - **期待結果**: 200, cancelled=true
  - **信頼性**: 🔵 *テスト通過*

- [x] **TC-243-02**: runningジョブのキャンセル 🔵
  - **入力**: runningジョブのjobId
  - **期待結果**: 200, cancelled=true
  - **信頼性**: 🔵 *テスト通過*

#### 異常系

- [x] **TC-243-E01**: 存在しないjobId 🔵
  - **入力**: 存在しないUUID
  - **期待結果**: 404, JOB_NOT_FOUND
  - **信頼性**: 🔵 *テスト通過*

- [x] **TC-243-E02**: 不正jobId形式 🔵
  - **入力**: "invalid"
  - **期待結果**: 400, VALIDATION_ERROR
  - **信頼性**: 🔵 *テスト通過*

- [x] **TC-243-E03**: completedジョブのキャンセル拒否 🔵
  - **入力**: completedジョブのjobId
  - **期待結果**: 409, JOB_ALREADY_TERMINATED
  - **信頼性**: 🔵 *テスト通過*

- [x] **TC-243-E04**: failedジョブのキャンセル拒否 🔵
  - **入力**: failedジョブのjobId
  - **期待結果**: 409, JOB_ALREADY_TERMINATED
  - **信頼性**: 🔵 *テスト通過*

---

## テストケースサマリー（REQ-241~243 Phase 104追加分）

| カテゴリ | 正常系 | 異常系 | 合計 |
|---------|--------|--------|------|
| REQ-241 ジョブ投入 | 5 | 3 | 8 |
| REQ-242 ステータス取得 | 4 | 2 | 6 |
| REQ-243 ジョブキャンセル | 2 | 4 | 6 |
| **合計** | **11** | **9** | **20** |

### 信頼性レベル分布

- 🔵 青信号: 20件 (100%)
- 🟡 黄信号: 0件 (0%)
- 🔴 赤信号: 0件 (0%)

---

## テストケース（REQ-241~243 Phase 105 統合テスト追加分）

### 統合テスト: Export Job Full Lifecycle Integration

- [x] **TC-INT-001**: フルライフサイクル（create → queued → running → completed with artifactId）🔵
  - **テスト**: POST create → GET status (queued) → simulate dequeue → GET status (running) → completeJob → GET status (completed)
  - **期待結果**: status遷移 queued→running→completed、artifactIdがUUID v4形式で返却
  - **信頼性**: 🔵 *統合テスト通過*

- [x] **TC-INT-002**: 失敗ライフサイクル（create → failed, no artifactId）🔵
  - **テスト**: POST create → simulate dequeue → completeJob(false) → GET status
  - **期待結果**: status=failed, artifactId=null
  - **信頼性**: 🔵 *統合テスト通過*

### 統合テスト: Export Job Priority Ordering via HTTP

- [x] **TC-INT-003**: 優先度順序（high > normal）🔵
  - **テスト**: POST normal → POST high → dequeue
  - **期待結果**: high-priority jobが先にdequeueされる
  - **信頼性**: 🔵 *統合テスト通過*

- [x] **TC-INT-004**: FIFO順序（same priority）🔵
  - **テスト**: POST ×3 (same priority) → dequeue ×3
  - **期待結果**: 投入順にdequeueされる
  - **信頼性**: 🔵 *統合テスト通過*

### 統合テスト: Export Job Cancel via HTTP

- [x] **TC-INT-005**: キャンセル→再キャンセル拒否🔵
  - **テスト**: POST create → DELETE cancel → GET status (cancelled) → DELETE (again)
  - **期待結果**: 1回目200/cancelled=true、2回目409/JOB_ALREADY_TERMINATED
  - **信頼性**: 🔵 *統合テスト通過*

### 統合テスト: Export Job Artifact Store Integration via HTTP

- [x] **TC-INT-006**: 完了ジョブのartifactIdがストアから取得可能🔵
  - **テスト**: POST create → simulate completion → GET status → artifactStore.get(artifactId)
  - **期待結果**: artifactがstoreから取得可能、format/sizeBytes/metadata.jobIdが一致
  - **信頼性**: 🔵 *統合テスト通過*

- [x] **TC-INT-007**: 複数完了ジョブのartifactIdが一意🔵
  - **テスト**: POST ×3 → complete each → verify artifactIds unique
  - **期待結果**: 3つのartifactIdがすべて異なり、store.size=3
  - **信頼性**: 🔵 *統合テスト通過*

### Phase 105 統合テストサマリー

| カテゴリ | テスト数 | 信頼性 |
|---------|---------|--------|
| フルライフサイクル | 2 | 🔵 |
| 優先度順序 | 2 | 🔵 |
| キャンセル | 1 | 🔵 |
| Artifact Store統合 | 2 | 🔵 |
| **合計** | **7** | **🔵 100%** |

---

## テストケース（Phase 107 エクスポートサービス・グレースフルシャットダウン）

### 統合テスト: Export Service Graceful Shutdown

- [x] **TC-SD-001**: ExportJobQueue.stop()がスターベーションタイマーをクリーンに停止🔵
  - **テスト**: queue.start() → queue.stop()
  - **期待結果**: 例外スローなし、タイマークリア完了
  - **信頼性**: 🔵 *統合テスト通過*

- [x] **TC-SD-002**: stop()の二重呼び出しが冪等🔵
  - **テスト**: queue.start() → queue.stop() → queue.stop()
  - **期待結果**: 2回目のstop()も例外なし
  - **信頼性**: 🔵 *統合テスト通過*

- [x] **TC-SD-003**: stop後もキュー/完了ジョブのデータが保持される🔵
  - **テスト**: enqueue → complete → stop → getQueueStats / findJob
  - **期待結果**: completed=1, queued=1, ジョブ情報が取得可能
  - **信頼性**: 🔵 *統合テスト通過*

- [x] **TC-SD-004**: stop後にrestart可能🔵
  - **テスト**: start → stop → start → enqueue → stop
  - **期待結果**: 再開後もジョブ登録が正常動作
  - **信頼性**: 🔵 *統合テスト通過*

- [x] **TC-SD-005**: start()の二重呼び出しが冪等🔵
  - **テスト**: start() → start()
  - **期待結果**: 2回目のstart()も例外なし
  - **信頼性**: 🔵 *統合テスト通過*

### 統合テスト: ExportArtifactStore.stop()

- [x] **TC-SD-006**: TTLクリーンアップタイマーがクリーンに停止🔵
  - **テスト**: store.start() → store.stop()
  - **期待結果**: 例外スローなし
  - **信頼性**: 🔵 *統合テスト通過*

- [x] **TC-SD-007**: stop()の二重呼び出しが冪等🔵
  - **テスト**: store.start() → store.stop() → store.stop()
  - **期待結果**: 2回目のstop()も例外なし
  - **信頼性**: 🔵 *統合テスト通過*

- [x] **TC-SD-008**: stop後もアーティファクトが取得可能🔵
  - **テスト**: store → stop → get
  - **期待結果**: データロスなし、アーティファクト取得可能
  - **信頼性**: 🔵 *統合テスト通過*

- [x] **TC-SD-009**: stop後にrestart可能🔵
  - **テスト**: start → stop → start → store → stop
  - **期待結果**: 再開後もストア登録が正常動作
  - **信頼性**: 🔵 *統合テスト通過*

### 統合テスト: Combined Shutdown

- [x] **TC-SD-010**: artifactStore→jobQueueの順でstopしてもデータロスなし🔵
  - **テスト**: enqueue → complete → artifactStore.stop() → jobQueue.stop()
  - **期待結果**: 完了ジョブのartifactIdが保持される
  - **信頼性**: 🔵 *統合テスト通過*

- [x] **TC-SD-011**: 複数回のstart/stopサイクルが可能🔵
  - **テスト**: 3サイクルの start → store artifact → stop
  - **期待結果**: 全サイクルで正常動作
  - **信頼性**: 🔵 *統合テスト通過*

### 統合テスト: Server Wiring

- [x] **TC-SD-012**: server.tsがartifactStoreとjobQueueをエクスポート🔵
  - **テスト**: import { artifactStore, jobQueue } from server.ts
  - **期待結果**: 両インスタンスが定義済み、stopメソッド存在
  - **信頼性**: 🔵 *統合テスト通過*

### Phase 107 サマリー

| カテゴリ | テスト数 | 信頼性 |
|---------|---------|--------|
| JobQueue.stop() | 5 | 🔵 |
| ArtifactStore.stop() | 4 | 🔵 |
| Combined Shutdown | 2 | 🔵 |
| Server Wiring | 1 | 🔵 |
| **合計** | **13** | **🔵 100%** |

---

## REQ-247: マルチシードCI ファジングモード 🔵

**信頼性**: 🔵 *AI Hubフィードバック・既存ファジングテスト実装に基づく*

### Given（前提条件）

- 変異ファジングテストスイート（export-mutation-fuzz.test.ts）が存在する
- 各テストは mulberry32 決定論PRNG で固定シードを使用している

### When（実行条件）

- CI環境で `FUZZ_SEEDS` 環境変数を設定してテストを実行する

### Then（期待結果）

- 複数のランダムシードで追加ファジングイテレーションが実行される
- 各シードで独立した mulberry32 PRNG が生成される
- 固定シードが見逃すエッジケースが捕捉される

### テストケース

#### 正常系

- [x] **TC-247-01**: FUZZ_SEEDS未設定時は従来通り固定シードで動作する 🔵
  - **期待結果**: デフォルトシードで50イテレーション実行
  - **信頼性**: 🔵 *テスト通過*

- [x] **TC-247-02**: FUZZ_SEEDS=3設定時に3つのランダムシードで追加実行 🔵
  - **期待結果**: 各シードで独立イテレーションが実行され、全てXSSベクタが検出される
  - **信頼性**: 🔵 *テスト通過*

#### 境界値

- [x] **TC-247-B01**: FUZZ_SEEDS=0設定時は追加シードなし（固定シードのみ）🔵
  - **期待結果**: 追加イテレーションなし、従来動作と同等
  - **信頼性**: 🔵 *テスト通過*

---

## REQ-248: 全エクスポート経路ガードメトリクス回帰テスト 🔵

**信頼性**: 🔵 *AI Hubフィードバック・既存SecurityMetricsCollector実装に基づく*

### Given（前提条件）

- MultiFormatExporter（SVG/PNG/PDF/JSON）がSecurityMetricsCollector統合済み
- EnhancedExportEngineがstrict-mode検証でSecurityMetricsCollector統合済み

### When（実行条件）

- 悪意あるペイロード（XSSベクタ埋め込みSceneGraph）を各エクスポート経路に通す

### Then（期待結果）

- SecurityMetricsCollectorの拒否カウンターが増加する
- 全経路でcontent-validator層のメトリクスが記録される

### テストケース

#### 正常系

- [x] **TC-248-01**: MultiFormatExporterが悪意あるSceneGraphでガードメトリクスを記録 🔵
  - **期待結果**: securityMetricsCollector.totalRejections > 0
  - **信頼性**: 🔵 *テスト通過*

- [x] **TC-248-02**: EnhancedExportEngineがstrict-mode悪意あるペイロードでガードメトリクスを記録 🔵
  - **期待結果**: securityMetricsCollector.totalRejections > 0
  - **信頼性**: 🔵 *テスト通過*

#### 回帰防止

- [x] **TC-248-R01**: 正常なSceneGraph処理時はガードメトリクスがゼロを維持 🔵
  - **期待結果**: securityMetricsCollector.totalRejections === 0（正常時）
  - **信頼性**: 🔵 *テスト通過*

---

## REQ-249: E2Eセキュリティパイプライン統合テスト 🔵

**信頼性**: 🔵 *AI Hubフィードバック・既存エクスポートセキュリティチェーンに基づく*

### Given（前提条件）

- エクスポートパイプライン: validate → sanitize → metrics → download が構築済み

### When（実行条件）

- 悪意あるSceneGraph（複数XSSベクタ埋め込み）で全形式エクスポートを実行

### Then（期待結果）

- SVGエクスポート: XSSベクタがサニタイズされ、ガードメトリクスが記録される
- JSONエクスポート: XSSベクタが検出され、ガードメトリクスが記録される
- Interactive HTMLエクスポート: XSSベクタがサニタイズされ、ガードメトリクスが記録される

### テストケース

#### 正常系

- [x] **TC-249-01**: 悪意あるペイロード→SVGエクスポート: サニタイズ+メトリクス記録 🔵
  - **期待結果**: 出力SVGにXSSベクタ不在、SecurityMetricsCollector.totalRejections > 0
  - **信頼性**: 🔵 *テスト通過*

- [x] **TC-249-02**: 悪意あるペイロード→JSONエクスポート: 検出+メトリクス記録 🔵
  - **期待結果**: findings配列にXSS検出、SecurityMetricsCollector.totalRejections > 0
  - **信頼性**: 🔵 *テスト通過*

- [x] **TC-249-03**: 悪意あるペイロード→Interactive HTML: サニタイズ+メトリクス記録 🔵
  - **期待結果**: 出力HTMLにXSSベクタ不在、SecurityMetricsCollector.totalRejections > 0
  - **信頼性**: 🔵 *テスト通過*

#### 回帰防止

- [x] **TC-249-R01**: 正常なペイロードで全形式エクスポート: ガードメトリクスゼロ 🔵
  - **期待結果**: SecurityMetricsCollector.totalRejections === 0（正常時）
  - **信頼性**: 🔵 *テスト通過*

### Phase 109 サマリー

| カテゴリ | テスト数 | 信頼性 |
|---------|---------|--------|
| REQ-247: マルチシードCI ファジング | 3 | 🔵 |
| REQ-248: ガードメトリクス回帰 | 3 | 🔵 |
| REQ-249: E2Eセキュリティパイプライン | 4 | 🔵 |
| **合計** | **10** | **🔵 100%** |

---

## REQ-250: CI red-phase 検証ゲート 🔵

**信頼性**: 🔵 *AI Hubフィードバック・既存guard-red-phase-verification.test.ts・.github/workflows/ci.ymlより*

### Given（前提条件）

- `guard-red-phase-verification.test.ts` が23キャナリペイロードを含んでいる
- CI security-fuzz ジョブが定義されている

### When（実行条件）

- CIパイプラインがプッシュ/PRで実行される

### Then（期待結果）

- red-phase 検証テストがCI security-fuzz ジョブで実行される
- test:fuzz / test:fuzz:multi-seed パターンに guard-red-phase-verification が含まれる

### テストケース

#### 正常系

- [x] **TC-250-01**: test:fuzz パターンに guard-red-phase-verification が含まれる 🔵
  - **期待結果**: `npm run test:fuzz` が guard-red-phase-verification.test.ts を実行する
  - **信頼性**: 🔵 *package.json testPathPattern更新*

- [x] **TC-250-02**: CI security-fuzz ジョブで red-phase 検証が実行される 🔵
  - **期待結果**: CI ワークフローに red-phase 検証ステップが含まれる
  - **信頼性**: 🔵 *ci.yml更新*

---

## REQ-251: エクスポートガード関数ファジング 🔵

**信頼性**: 🔵 *AI Hubフィードバック・既存ガード関数・export-guard-fuzz.test.tsより*

### Given（前提条件）

- validateSceneGraphForExport・validateExportPayload・sanitizeFilename が実装済み
- ファジングテストインフラ（mulberry32 PRNG・FUZZ_SEEDS）が存在する

### When（実行条件）

- ファジングテストが実行される（ローカル or CI）

### Then（期待結果）

- ガード関数が多様な悪意入力を確実に検出・サニタイズする
- FUZZ_SEEDS環境変数でマルチシード対応する
- 偽陽性ゼロ（安全なコンテンツは検出しない）

### テストケース

#### 正常系

- [x] **TC-251-01**: validateSceneGraphForExport ファジング: 150イテレーション 🔵
  - **入力**: 3シード × 50イテレーション、ランダムフィールド・ランダムベクタ注入
  - **期待結果**: 全ての危険ベクタが検出される（findings.length > 0）
  - **信頼性**: 🔵 *540テスト通過*

- [x] **TC-251-02**: validateExportPayload ネストファジング: 150イテレーション 🔵
  - **入力**: 3シード × 50イテレーション、深度0-3のネストオブジェクト
  - **期待結果**: ネストされた悪意コンテンツが検出される
  - **信頼性**: 🔵 *540テスト通過*

- [x] **TC-251-03**: sanitizeFilename ファジング: 150イテレーション 🔵
  - **入力**: 3シード × 50イテレーション、パストラバーサル・制御文字・ヌルバイト
  - **期待結果**: サニタイズ結果に `..`, `/`, `\`, `\0`, 制御文字が含まれない
  - **信頼性**: 🔵 *540テスト通過*

#### 偽陽性防止

- [x] **TC-251-04**: 安全なコンテンツで findins がゼロ: 30イテレーション 🔵
  - **入力**: 安全なランダム文字列（<>"'=/\\を除外）
  - **期待結果**: validateSceneGraphForExport が findings を報告しない
  - **信頼性**: 🔵 *テスト通過*

---

## REQ-252: security-fuzz ビルド依存 🔵

**信頼性**: 🔵 *AI Hubフィードバック・.github/workflows/ci.ymlより*

### Given（前提条件）

- CI security-fuzz ジョブと build ジョブが定義されている

### When（実行条件）

- ビルドが失敗するコードがプッシュされる

### Then（期待結果）

- security-fuzz ジョブが実行されない（build ジョブの成功に依存）
- ビルドが壊れたコードがマージされない

### テストケース

#### 正常系

- [x] **TC-252-01**: security-fuzz ジョブ needs に build が含まれる 🔵
  - **期待結果**: `needs: [test, build]` がci.ymlに記述される
  - **信頼性**: 🔵 *ci.yml更新*

### Phase 110 サマリー

| カテゴリ | テスト数 | 信頼性 |
|---------|---------|--------|
| REQ-250: red-phase CI統合 | 2 | 🔵 |
| REQ-251: ガード関数ファジング | 540 | 🔵 |
| REQ-252: security-fuzzビルド依存 | 1 | 🔵 |
| **合計** | **543** | **🔵 100%** |

---

## EDGE-008~011: リソースリーク・ログ正規化テスト（第198~199回検証追加）

### EDGE-008: ErrorAlertSystem timer cleanup 🔵

- [x] **TC-EDGE-008-01**: auto-hide setTimeout が useRef Set で追跡される 🔵
  - **テスト**: tests/components/error-alert-system-timer.test.ts（5テスト）
  - **期待結果**: 全タイマーが unmount 時に clearTimeout される
  - **信頼性**: 🔵 *実装確認済*

### EDGE-009: OverlapResolver timer cleanup 🔵

- [x] **TC-EDGE-009-01**: Promise.race 完了後に clearTimeout が呼ばれる 🔵
  - **テスト**: tests/visualization/overlap-resolver-timer-cleanup.test.ts（2テスト）
  - **期待結果**: タイマー参照が解放される
  - **信頼性**: 🔵 *実装確認済（第199回検証で startTime 初期化バグ修正）*

### EDGE-010: EnhancedExportEngine abort listener cleanup 🔵

- [x] **TC-EDGE-010-01**: リトライ遅延タイマー勝利時の removeEventListener 呼び出し 🔵
  - **テスト**: src/export/__tests__/export-abort-listener-cleanup.test.ts
  - **期待結果**: タイマー完了後、AbortSignal から abort リスナーが削除される
  - **信頼性**: 🔵 *実装修正済*

- [x] **TC-EDGE-010-02**: リトライ中のabortで即時reject 🔵
  - **テスト**: src/export/__tests__/export-abort-listener-cleanup.test.ts
  - **期待結果**: abort発生時にリトライ遅延がキャンセルされ、即座にエクスポートがキャンセルされる
  - **信頼性**: 🔵 *実装修正済*

- [x] **TC-EDGE-010-03**: リトライ成功後にリスナーが蓄積しない 🔵
  - **テスト**: src/export/__tests__/export-abort-listener-cleanup.test.ts
  - **期待結果**: 複数リトライ後も addEventListener と removeEventListener の呼び出し回数が均衡する
  - **信頼性**: 🔵 *実装修正済*

### EDGE-011: console.error → logger.error 正規化 🔵

- [x] **TC-EDGE-011-01**: 全プロダクションコードの catch ブロックが logger.error を使用 🔵
  - **対象**: src/optimization/memory-cache.ts, src/analysis/budget-alert.ts, src/monitoring/production-monitoring-excellence.ts, src/quality/error-recovery-event-bus.ts, src/monitoring/performance-dashboard.ts, src/monitoring/real-time-performance-monitor.ts
  - **期待結果**: console.error が @stv/core/utils/logger の logger.error に置換される（logger.ts 自身を除く）
  - **信頼性**: 🔵 *ソースコード検証済*

### 第198~199回検証サマリー

| カテゴリ | テスト数 | 信頼性 |
|---------|---------|--------|
| EDGE-008: React timer leak | 5 | 🔵 |
| EDGE-009: Promise.race timer leak | 2 | 🔵 |
| EDGE-010: abort listener cleanup | 3 | 🔵 |
| EDGE-011: console.error正規化 | 1 | 🔵 |
| **合計** | **11** | **🔵 100%** |

---

## COV-001~003: 未テストモジュール カバレッジ拡充（第198回検証追加）

### COV-001: ExportVerifier フォーマット検証 🔵

- [x] **TC-COV-001-01**: MP4/WebM/GIF/PNG/APNG/PDF/SVG/JSON/Lottie 形式検証 🔵
  - **テスト**: src/export/__tests__/export-verifier.test.ts（138テスト）
  - **期待結果**: 各フォーマットのマジックバイト検証・最小ファイルサイズ・破損ファイル検出
  - **信頼性**: 🔵 *実装確認済*

### COV-002: RecoveryStrategyChain エラー回復 🔵

- [x] **TC-COV-002-01**: ChainBuilder・実行・時間予算・統計・トレース 🔵
  - **テスト**: src/quality/__tests__/recovery-strategy-chain.test.ts（59テスト）
  - **期待結果**: 戦略チェーン構築・実行・タイムアウト・統計収集・トレース出力
  - **信頼性**: 🔵 *実装確認済*

### COV-003: BatchJobManager バッチ処理 🔵

- [x] **TC-COV-003-01**: BatchJobManager・ルートハンドラー・UUID検証 🔵
  - **テスト**: src/api/routes/__tests__/batch.test.ts（52テスト・パラメータ化展開含む）
  - **期待結果**: ジョブ作成・ステータス取得・キャンセル・UUID形式検証・エラーハンドリング
  - **信頼性**: 🔵 *実行確認済（Jest実行時52テスト・静的カウント46+パラメータ化展開6）*

### カバレッジ拡充サマリー

| モジュール | テスト数 | 信頼性 |
|-----------|---------|--------|
| COV-001: ExportVerifier | 138 | 🔵 |
| COV-002: RecoveryStrategyChain | 59 | 🔵 |
| COV-003: BatchJobManager | 52 | 🔵 |
| **合計** | **249** | **🔵 100%** |

---

## REQ-253: エクスポートリトライ5+サイクル統合テスト 🔵

**信頼性**: 🔵 *AI Hub make-runフィードバック・EDGE-010修正の統合検証より*

### Given（前提条件）

- EnhancedExportEngine がリトライ設定のDIを受け入れること（REQ-256実装済み）
- encodeVideoWithRetry の abort listener cleanup（EDGE-010）が適用済みであること

### When（実行条件）

- EnhancedExportEngine を maxRetries=10 で初期化
- encodeVideo を常に失敗するモックに設定し、10回リトライを実行

### Then（期待結果）

- 各リトライサイクル後に AbortSignal のリスナー数が増加しない（安定）
- 全リトライ試行後にリスナー数がゼロに戻る

### テストケース

- [x] **TC-253-01**: 10回リトライでのリスナー数安定性検証 🔵
  - **入力**: maxRetries=10, 常に失敗するencodeVideoモック
  - **期待結果**: リスナー数が各サイクルで一定、最終的にゼロ
  - **信頼性**: 🔵 *EDGE-010 cleanup メカニズム検証*

- [x] **TC-253-02**: 中断時のリスナークリーンアップ検証 🔵
  - **入力**: maxRetries=10, 5回目でAbortSignal発火
  - **期待結果**: 即座にリスナーがクリーンアップされる
  - **信頼性**: 🔵 *EDGE-010 abort path検証*

---

## REQ-254: CIワークフロー timeout-minutes + ELAPSED assertion 🔵

**信頼性**: 🔵 *AI Hub make-runフィードバック・BMad template参照より*

### Given（前提条件）

- .github/workflows/ci.yml に全ジョブが定義されている
- サマリージョブが最終ステップとして存在する

### When（実行条件）

- 各ジョブに timeout-minutes を設定（lint=5, type-check=5, test=30, build=10, security-fuzz=20）
- 各ジョブ終了時にELAPSED経過時間を記録し、警告閾値（timeout-minutes×0.8）を超えた場合フラグを設定

### Then（期待結果）

- サマリージョブが警告フラグを検出した場合、非ゼロ終了コードで失敗を報告する

### テストケース

- [x] **TC-254-01**: ci.yml全ジョブのtimeout-minutes設定確認 🔵
  - **入力**: ci.yml ワークフロー定義
  - **期待結果**: 全ジョブに timeout-minutes が設定されている
  - **信頼性**: 🔵 *静的検証*

- [x] **TC-254-02**: ELAPSED警告閾値超過時の非ゼロ終了 🔵
  - **入力**: テストジョブのELAPSEDが24分（30分×0.8）を超えた場合
  - **期待結果**: サマリージョブが失敗を報告する
  - **信頼性**: 🔵 *CI統合検証*

---

## REQ-255: ESLint no-console 回帰防止 🔵

**信頼性**: 🔵 *AI Hub make-runフィードバック・EDGE-011正規化完了より*

### Given（前提条件）

- ESLint 9 設定（eslint.config.js）が利用可能
- @stv/core/utils/logger が console.error の唯一の正当な使用

### When（実行条件）

- eslint.config.js の src/ ルールに 'no-console' を追加
- logger.ts のみ allow 設定を適用

### Then（期待結果）

- CI の lint ジョブで新たな console.error 使用が検出された場合、ビルドが失敗する
- logger.ts の既存の console.error 使用は許可される

### テストケース

- [x] **TC-255-01**: no-console ルール追加後の lint パス 🔵
  - **入力**: 現在のコードベース + no-console ルール（logger.ts allow）
  - **期待結果**: ESLint エラー0件
  - **信頼性**: 🔵 *静的検証*

- [x] **TC-255-02**: 新規 console.error 挿入時の lint フェイル 🔵
  - **入力**: src/ の任意ファイルに console.error を追加
  - **期待結果**: ESLint がエラーを報告する
  - **信頼性**: 🔵 *リグレッションテスト*

---

## REQ-256: EnhancedExportEngine リトライ設定DI 🔵

**信頼性**: 🔵 *AI Hub make-runフィードバック・MAX_RETRIES=3ハードコード問題より*

### Given（前提条件）

- EnhancedExportEngine が EXPORT_RETRY_LIMITS.MAX_RETRIES=3 を import して使用している

### When（実行条件）

- EnhancedExportEngine コンストラクタに retryConfig?: Partial<typeof EXPORT_RETRY_LIMITS> を追加

### Then（期待結果）

- テスト時に maxRetries=10 を指定して5+リトライサイクルを再現できる
- デフォルト動作は従来通り MAX_RETRIES=3 を維持

### テストケース

- [x] **TC-256-01**: カスタムmaxRetriesでのリトライ回数検証 🔵
  - **入力**: maxRetries=5, 常に失敗するencodeVideo
  - **期待結果**: 6回（1+5リトライ）の試行後に最終失敗
  - **信頼性**: 🔵 *DI検証*

- [x] **TC-256-02**: デフォルトmaxRetries=3の後方互換性 🔵
  - **入力**: retryConfig未指定
  - **期待結果**: 従来通り4回（1+3リトライ）の試行
  - **信頼性**: 🔵 *後方互換性検証*

---

## REQ-257: シーンデュレーション統合検証 🔵

**信頼性**: 🔵 *AI Hub make-runフィードバック・コミット2ea5a98修正より*

### Given（前提条件）

- actualVideoRenderer.ts の scene.durationMs 累積計算修正が適用済み
- 単体テスト（actualVideoRenderer-duration.test.ts 6件）が通過済み

### When（実行条件）

- 既知のタイムスタンプを持つ3シーン（2s+5s+1s）でレンダリングを実行
- 10シーン、20シーンに増やして同様に検証

### Then（期待結果）

- 総デュレーションが各シーンの durationMs の合計と正確に一致する
- 各シーンの開始・終了タイミングが期待値通り

### テストケース

- [x] **TC-257-01**: 3シーン累積デュレーション検証 🔵
  - **入力**: intro(2s) + content(5s) + outro(1s)
  - **期待結果**: 総デュレーション=8s、各シーン境界が正確
  - **信頼性**: 🔵 *統合検証*

- [x] **TC-257-02**: 10シーン累積デュレーション検証 🔵
  - **入力**: 10シーンの様々なdurationMs
  - **期待結果**: 総デュレーション=全シーンdurationMs合計
  - **信頼性**: 🔵 *スケール検証*

---

### REQ-258: Spine manifest validator CI統合 🔵

**信頼性**: 🔵 *scripts/validate-spine-manifest.ts・.github/workflows/ci.yml より*

#### Given（前提条件）
- `specs/_doc_spine.yml` が存在し、全参照パスがディスク上に存在する

#### When（実行操作）
- CI で `npm run spine:validate` を実行

#### Then（期待結果）
- spine-validate ジョブが正常終了（exit code 0）
- 全参照パスの存在が確認される
- orphaned specファイルが warnings として報告される

#### テストケース

- [x] **TC-258-01**: spine manifestの全参照パスがディスク上に存在する 🔵
  - **信頼性**: 🔵 *tests/spine-manifest.test.ts*
- [x] **TC-258-02**: orphaned specファイルが正しく検出される 🔵
  - **信頼性**: 🔵 *tests/spine-manifest.test.ts*
- [x] **TC-258-03**: CI spine-validateジョブがbuild/all-checks-passの必須依存に含まれる 🔵
  - **信頼性**: 🔵 *ci.ymlのspine-validateジョブ定義*

---

### REQ-259: Recovery path silent catch修正 🔵

**信頼性**: 🔵 *src/quality/enhanced-error-recovery.ts・src/quality/pipeline-error-recovery-orchestrator.ts より*

#### Given（前提条件）
- エラー回復戦略の実行中に例外が発生する

#### When（実行操作）
- simplified_export / re_segmentation / skip_animation / fallback 戦略の実行

#### Then（期待結果）
- サイレントcatchブロックが `logger.error()` でエラー詳細を記録する
- エラー発生時に回復失敗結果が返却される

#### テストケース

- [x] **TC-259-01**: 4箇所のsilent catchがlogger.errorでログ出力する 🔵
  - **信頼性**: 🔵 *git diff e244be3*
- [x] **TC-259-02**: pipeline-error-recovery-orchestrator.tsのcatchがログ出力する 🔵
  - **信頼性**: 🔵 *git diff e244be3*
- [x] **TC-259-03**: recovery-telemetry-aggregator.test.ts（354行）が全て通過する 🔵
  - **信頼性**: 🔵 *src/quality/__tests__/recovery-telemetry-aggregator.test.ts*
- [x] **TC-259-04**: regression-detector.test.ts（410行）が全て通過する 🔵
  - **信頼性**: 🔵 *src/quality/__tests__/regression-detector.test.ts*

---

### REQ-260: SimpleDiagramDetector バグ修正 🔵

**信頼性**: 🔵 *src/analysis/simple-diagram-detector.ts・src/analysis/__tests__/simple-diagram-detector.test.ts より*

#### Given（前提条件）
- SimpleDiagramDetector がテキストセグメントを分析する

#### When（実行操作）
- キーワードスコアが全て0のテキストを入力、またはtestDetector()を呼び出し

#### Then（期待結果）
- 認識不可テキスト（score=0）の場合、generateDefaultElements() が呼ばれる（flow-chart要素ではない）
- testDetector() が `{ total, passed, failures[] }` 構造化結果を返す

#### テストケース

- [x] **TC-260-01**: スコア0テキストでデフォルト要素が生成される 🔵
  - **信頼性**: 🔵 *src/analysis/simple-diagram-detector.ts L105-108*
- [x] **TC-260-02**: testDetector()が構造化結果を返す 🔵
  - **信頼性**: 🔵 *src/analysis/simple-diagram-detector.ts L350-394*
- [x] **TC-260-03**: simple-diagram-detector.test.ts（436行）が全て通過する 🔵
  - **信頼性**: 🔵 *src/analysis/__tests__/simple-diagram-detector.test.ts*

---

### REQ-267: ルールベースフォールバックのテキストベースコンテンツ抽出 🔵

**信頼性**: 🔵 *コミット eeb74e8・src/analysis/diagram-detector.ts・src/analysis/__tests__/diagram-content-generation.test.ts（11テスト）*

#### Given（前提条件）
- Gemini LLMが利用できず、ルールベースフォールバックパスが実行される
- ユーザーの音声文字起こしテキストが入力として与えられる

#### When（実行操作）
- `generateContentFromText()` がテキストと図解タイプを引数に呼び出される

#### Then（期待結果）
- 入力テキストから抽出したキーフレーズがノードラベルに含まれる
- ハードコードされた固定ラベルが使用されない（入力と異なる場合）
- 異なる入力で異なる出力が生成される
- エッジ構造が図解タイプのトポロジーに一致する
- 空文字・短文に対してグレースフルにフォールバックする

#### テストケース

- [x] **TC-267-01**: ノードラベルが入力テキストの単語を含む 🔵
  - **信頼性**: 🔵 *src/analysis/__tests__/diagram-content-generation.test.ts*
- [x] **TC-267-02**: 異なる入力で異なる出力が生成される・ハードコードラベルが出現しない 🔵
  - **信頼性**: 🔵 *src/analysis/__tests__/diagram-content-generation.test.ts*
- [x] **TC-267-03**: 空文字・短文・長文のグレースフルフォールバック 🔵
  - **信頼性**: 🔵 *src/analysis/__tests__/diagram-content-generation.test.ts*

---

### REQ-268: continuous-learner destroy() メソッド 🔵

**信頼性**: 🔵 *コミット 9ec2a09・src/framework/continuous-learner.ts・src/framework/__tests__/continuous-learner-safety.test.ts*

#### Given（前提条件）
- ContinuousLearnerインスタンスが生成され、学習プロセスが開始されている

#### When（実行操作）
- `destroy()` を呼び出した後、一定時間待機する

#### Then（期待結果）
- interval callback が実行されない（iterationCountが増加しない）
- 全内部状態（学習データ・最適化戦略キャッシュ）がクリアされる

#### テストケース

- [x] **TC-268-01**: destroy()後にタイマーコールバックが実行されない 🔵
  - **信頼性**: 🔵 *src/framework/__tests__/continuous-learner-safety.test.ts*
- [x] **TC-268-02**: destroy()で全内部状態がクリアされる 🔵
  - **信頼性**: 🔵 *src/framework/__tests__/continuous-learner-safety.test.ts*

---

### REQ-269: pearson相関のNaNガード 🔵

**信頼性**: 🔵 *コミット 9ec2a09・src/framework/continuous-learner.ts・src/framework/__tests__/continuous-learner-safety.test.ts*

#### Given（前提条件）
- 異なる長さの配列、またはNaN・Infinity・undefinedを含む配列

#### When（実行操作）
- `pearson(xs, ys)` を呼び出す

#### Then（期待結果）
- 配列長不一致の場合は0が返される（NaNが伝播しない）
- 非有限値を含む配列の場合は0が返される

#### テストケース

- [x] **TC-269-01**: 異なる長さの配列で0が返される 🔵
  - **信頼性**: 🔵 *src/framework/__tests__/continuous-learner-safety.test.ts*
- [x] **TC-269-02**: NaN・Infinityを含む配列で0が返される 🔵
  - **信頼性**: 🔵 *src/framework/__tests__/continuous-learner-safety.test.ts*

---

## REQ-285: 品質モニタ diagram-type パリティ（Phase 118） 🔵

**信頼性**: 🔵 *src/quality/quality-monitor.ts assessContentRelevance・src/quality/__tests__/quality-monitor-diagram-type-parity.test.ts*

### Given（前提条件）
- 品質モニタの `assessPipelineQuality` が、1シーン・同一レイアウトノード（オーバーラップなし・十分な配置広がり）・要約あり・キーフレーズありの PipelineResult に対して呼ばれる

### When（実行操作）
- 同一シーンで `type` のみ `flow` / `flowchart`（および他9種の正典 DiagramType）を切り替えて `assessPipelineQuality` を呼ぶ

### Then（期待結果）
- 11種すべての正典タイプが同一の overallScore / accuracyScore を返す（flowchart 等の6種が 0.3 の valid-type ボーナスを失わない）
- 修正前は flowchart が flow に対し約0.036点低くスコアリングされた（accuracyScore の contentRelevance 成分で0.3ポイント欠落）

### テストケース

- [x] **TC-285-01**: flow と flowchart の同一シーンが同一点数（overallScore/accuracyScore 一致） 🔵
  - **信頼性**: 🔵 *修正前 RED（flowchart 0.836 vs flow 0.872）→ 修正後 GREEN*
- [x] **TC-285-02**: 11種の正典 DiagramType 全てが flow 基準と1e-9以内で一致 🔵
  - **信頼性**: 🔵 *CANONICAL_TYPES パリティループ + isDiagramType カバレッジ結合ガード*
- [x] **TC-285-03**: 非正典タイプ（`__not_a_real_type__`）は正典タイプより厳密に低くスコアリング（ガードの過緩和防止） 🔵
  - **信頼性**: 🔵 *ボーナス拒否の回帰ガード*

---

### Phase 125-130 受け入れ基準

#### REQ-292: 視覚化 flow/flowchart スイッチパリティ 🔵

**信頼性**: 🔵 *コミット 9b88a5f5 + diagram-type-switch-parity-guard.test.ts 205行*

- [x] **TC-292-01**: legacy LayoutEngine で `flowchart` が `flow` と同じ rankdir=TB / align=UL で dagre にルーティング 🔵
  - **信頼性**: 🔵 *getGraphConfig RED-on-revert ピン + 修正後 GREEN*
- [x] **TC-292-02**: FallbackLayoutStrategy.fallbackLayout で `flowchart` が `flow` と同じ grid layout を返す 🔵
  - **信頼性**: 🔵 *fallbackLayout RED-on-revert ピン + layout-bug-fixes.test.ts で regression guard*
- [x] **TC-292-03**: diagram-type-switch-parity-guard が DiagramType-TYPED-PARAM 関数の switch-CASE パリティを機械的に検証 🔵
  - **信頼性**: 🔵 *ガード 205行 + 既知修正ピン 4 件*

#### REQ-293: config-restore 有限性 LAST tail 🔵

**信頼性**: 🔵 *コミット 1bfb25cd*

- [x] **TC-293-01**: qualityPresets[].{width,height,fps,quality} 配列内 Infinity/負値/null 経由 0 が reject される 🔵
  - **信頼性**: 🔵 *isPositiveFiniteNumber + Array.isArray + element shape check*
- [x] **TC-293-02**: safe-storage 復元 predicate がプリセット未指定時に既定値委譲する 🔵
  - **信頼性**: 🔵 *21 RED → 152 GREEN 全ケース*
- [x] **TC-293-03**: 8 関連 suites 242/242, guards + safe-storage 41/41 が no regression 🔵
  - **信頼性**: 🔵 *Phase 126 実装+テスト同一コミット co-locate*

#### REQ-294: ExportJobQueue ETA オフバイワン 🔵

**信頼性**: 🔵 *コミット cc2ebd23*

- [x] **TC-294-01**: busy queue の head pos0 で ETA > 0 が返る 🔵
  - **信頼性**: 🔵 *position+1-availableSlots RED 3 → GREEN 39*
- [x] **TC-294-02**: 利用可能スロットが多い場合 ETA が head でも短縮される 🔵
  - **信頼性**: 🔵 *112 ETA/route テスト*
- [x] **TC-294-03**: queue/ETA ordering バグクラスが memory に記録されている 🔵
  - **信頼性**: 🔵 *memory MEMORY.md 更新*

#### REQ-295: config-restore 有限性 monitoring/export/memoryLimit SCALARS 🔵

**信頼性**: 🔵 *コミット db746769*

- [x] **TC-295-01**: monitoring.metricsCollectionInterval + alertThresholds ×4 の Infinity/負値/null 経由 0 が reject 🔵
  - **信頼性**: 🔵 *isPositiveFiniteNumber RED 33 → GREEN 130*
- [x] **TC-295-02**: export.concurrentExports + performance.memoryLimit が reject 🔵
  - **信頼性**: 🔵 *179/179 no regression + tsc 0*
- [x] **TC-295-03**: 7 フィールドすべてがガードされていることを構造的に検証 🔵
  - **信頼性**: 🔵 *Phase 128 実装+テスト同一コミット co-locate*

#### REQ-296: config-restore 有限性 performance SCALARS 🔵

**信頼性**: 🔵 *コミット 9e3fede5*

- [x] **TC-296-01**: performance.maxConcurrentJobs + timeoutMs + maxFileSize の Infinity/負値/null 経由 0 が reject 🔵
  - **信頼性**: 🔵 *isPositiveFiniteNumber RED 19 → GREEN 96*
- [x] **TC-296-02**: 139/139 persistence-path, tsc 0 🔵
  - **信頼性**: 🔵 *safe-storage の全 scalar/array numeric chokepoint 完結*
- [x] **TC-296-03**: consumer (intelligent-cache, orchestrator, upload) が safe-storage 経由 🔵
  - **信頼性**: 🔵 *Phase 129 実装+テスト同一コミット co-locate*

#### REQ-297: stale-closure/async-setState クラス GUARDED-STRUCTURAL 🔵

**信頼性**: 🔵 *コミット d1ccf4b1*

- [x] **TC-297-01**: async-state-stale-closure-guard.test.ts が既知修正ピン 2 件を構造的に保護 🔵
  - **信頼性**: 🔵 *既知修正 site 2 件を safe handler として登録*
- [x] **TC-297-02**: handler-BODY 粒度 sweep が 0 live bugs 🔵
  - **信頼性**: 🔵 *広範囲 sweep + 4/4 + tsc 0*
- [x] **TC-297-03**: JSX 除外 / ${...} 保持 / 0 live bugs 🔵
  - **信頼性**: 🔵 *構文契約が薄いバグクラスに対する「コード形制約」方針を確立*

#### REQ-298: diagram-type-switch-parity 他同値クラス展開 🟡

**信頼性**: 🟡 *AI Hub steering feedback A から妥当な推測（提案）*

- [x] **TC-298-01**: `@stv/core/types/diagram` に `'sequence' vs 'timeline'` 等の同義語 alias があるか再評価 🟡
  - **信頼性**: 🟡 *canonical DiagramType = 11 メンバー（flow/flowchart/tree/timeline/matrix/cycle/comparison/network/conceptmap/mindmap/general）、同義語 pair は `flow`/`flowchart` のみ（1 件）。`sequence` は canonical type に存在せず、`hierarchy` は `tree` 検出キーワードであって DiagramType メンバーではない*
  - **信頼性**: 🟡 *`diagram-type-switch-parity-guard.test.ts` 内に `EQUIVALENCE_PAIRS` インベントリ + 戦略コメントを co-locate。新ペア追加時は新ガードファイル（命名規約 `diagram-type-switch-parity-<canonical>-guard.test.ts`）を必須化する構造的 pinning を追加*
#### REQ-299: storageParser JSON.parse vs JSON.stringify 非対称監査 🟡

**信頼性**: 🟡 *AI Hub steering feedback B から妥当な推測（提案）*



- [x] **TC-299-01**: `rg "JSON.parse|parse\(" src/ --type ts | rg "isInteger|isFinite"` で safe-storage 以外の storage-side validator を 0-hit 確認 🟡
  - **信頼性**: 🟡 *src/ 配下の localStorage/sessionStorage/IndexedDB/fs.readFileSync → JSON.parse サイトは safe-storage.ts 以外で 0 件（direct access 監査）+ 4 ファイル（production-config/regression-detector/export-verifier/safe-storage）で `isPositiveFiniteNumber`/`Number.isFinite` ガード済。新規追加は `storage-jsonparse-finiteness-asymmetry-guard.test.ts` で自動ブロック*
- [x] **TC-299-02**: 明示的な再監査サイクルを CI に追加 🟡
  - **信頼性**: 🟡 *同 guard test が「every storage-side JSON.parse site either uses safe-storage OR has explicit finiteness guard」を sweep + known-safe chokepoints pin（4 件）。TC-299-02 = TC-299-01 と同一 commit で co-locate、CI 自動化達成*

#### REQ-300: async-setState positive-case fixture 🟡

**信頼性**: 🟡 *AI Hub steering feedback C から妥当な推測（提案）*

- [x] **TC-300-01**: `src/hooks/__tests__/__fixtures__/async-state-guarded-pattern.example.tsx` を生成（observer/raf inside hook + 実 cleanup）🟡
  - **信頼性**: 🟡 *`async-state-guarded-pattern.example.tsx` 生成済。`useRafTickCounter`（requestAnimationFrame observer + cleanup + call-time ref mirror）と `useIntervalPollingCount`（setInterval observer + cleanup）を含む 3 形状（Shape 1/2/3）の guarded pattern を co-locate 解説。バグクラス（09c/09v）のドキュメントと copy-paste 起点を提供*
- [x] **TC-300-02**: developer copy-paste 検証（guarded pattern の動作確認）🟡
  - **信頼性**: 🟡 *`async-state-guarded-pattern.example.test.tsx` で jsdom rAF/setInterval polyfill + renderHook/act で 5/5 GREEN（observer fires / cleanup cancels / ref mirror in sync / 1:1 register-clearInterval）。既存 `async-state-stale-closure-guard` sweep で誤検出なし（fixture は意図的に at-risk pattern を回避）*

#### REQ-301: timestamp guard mutation-verified CI ピン留め 🟡

**信頼性**: 🟡 *AI Hub steering feedback D から妥当な推測（提案）*

- [x] **TC-301-01**: `tests/guards/timestamp-guard-mutation-pinning.test.ts` を生成（Phase 09f guard 行を mutation test で保護）🟡
  - **信頼性**: 🟡 *`tests/guards/timestamp-guard-mutation-pinning.test.ts` 生成済。enhanced-export-engine.ts:814 の guard 行（`Date.now() − job.startTime.getTime()`）を anchor regex で pin + performance.now() の混在を negative anchor で排除。source 改変に対する structural 検出*
- [x] **TC-301-02**: fixture-mode test で当該行を一時除去 → 新テストが失敗することを確認 🟡
  - **信頼性**: 🟡 *同 test file 内 mutation invariant suite で (a) 正形 = non-negative duration、(b) 混成型 = negative duration + 1e12 magnitude、(c) collector レベル recordExport が durationMs<0 で record 破棄、を全 5/5 GREEN で確認*

#### REQ-304: 分析系 LLM リトライ既定値シングルソース化 🔵

**信頼性**: 🔵 *single-source round 9（round 8 freeze-guard registry の最初の新規エントリ）*

- [x] **TC-304-01**: `DEFAULT_RETRY_OPTIONS`（maxRetries 3 / baseDelay 1000 / maxDelay 10000）を `src/analysis/retry-strategy.ts` から export し、llm-service（`|| 3` フォールバック）、gemini-analyzer（明示的 `maxRetries: 3`）、fallback-chain（三重リテラル `{3, 1000, 10000}`）の 3 消費サイトを接続 🔵
  - **信頼性**: 🔵 *値は不変（desync 耐性のみ）。副次修正: llm-service の `|| 3` → `??` で明示的 `maxRetries: 0` が 3 に強制されていた falsy-guard を解消*
- [x] **TC-304-02**: frozen-literal registry に当該ファミリーのエントリを 1 件追加（`roots: ['src/analysis']`、minSweptFiles 20）し、RED-first で 3 offender を検出 → 修正後に GREEN 🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs tests/guards/frozen-literal-registry.test.ts tests/guards/analysis-retry-defaults-single-source.test.ts`
- [x] **TC-304-03**: 値 pin + 消費 import pin + behavioral pin を `tests/guards/analysis-retry-defaults-single-source.test.ts` に配置、既存 8 suite（llm-service/gemini-analyzer/fallback-chain/retry-strategy）157 test GREEN + tsc 0 error 🔵
  - **信頼性**: 🔵 *パイプライン層 retry（src/pipeline/retry.ts、500ms base、ErrorClassifier 駆動）は別概念として scope 外と明示。main-pipeline `retryConfig = {maxRetries: 3, backoffMs: 1000}` は backoffMs=1000 が既定 500 と異なる意図的 tuning のため同一ファミリー外と判定*
- [x] **TC-304-04**: `??` 修正の振る舞い pin — 明示的 `maxRetries: 0` が 3 に強制されないこと（API call 0 回・即時失敗・retryCount 0）と、省略時は `DEFAULT_RETRY_OPTIONS.maxRetries`（3 primary + 3 fallback = 6 call）にフォールバックすることを `tests/analysis/llm-service-max-retries-zero.test.ts` で assert 🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs tests/analysis/llm-service-max-retries-zero.test.ts`
  - **信頼性**: 🔵 *mutation-verified: `??` を `||` に一時退行させると zero-passthrough test のみ RED（default-3 test は両セマンティクスで GREEN であることも確認済み）。round 9 の judge 指摘「`??` セマンティクス pin の欠如により L3 未達」を解消*

#### REQ-306: API 層 UUID v4 検証 regex シングルソース化 🔵

**信頼性**: 🔵 *single-source round 12（freeze-guard registry の 3 件目の新規エントリ）*

- [x] **TC-306-01**: `UUID_V4_RE` を `src/api/uuid-validation.ts` から export し、4 消費サイト（batch routes・export routes・export-jobs routes・websocket handler）が各自 hand-rolled していた同一 regex のローカル const を削除して import に切替 🔵
  - **信頼性**: 🔵 *値は不変（desync 耐性のみ）。producer は `uuidv4()`（batch）と `crypto.randomUUID()`（export-artifact-store）で常に v4 を emit するため 4 サイトは同一契約*
- [x] **TC-306-02**: frozen-literal registry に当該ファミリーのエントリを 1 件追加（`roots: ['src/api']`、minSweptFiles 15、rename 耐性の char-class body pattern 含む）し、RED-first で 4 offender を検出 → 修正後に GREEN。mutation 検証: `_RE` 名を変えた rename copy（`ID_RE`）も sweep が捕捉 🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs tests/guards/frozen-literal-registry.test.ts tests/guards/uuid-validation-single-source.test.ts`
- [x] **TC-306-03**: 振る舞い pin + 消費 import pin を `tests/guards/uuid-validation-single-source.test.ts` に配置（v4 受理・大文字受理・v1 拒否・variant `c` 拒否・path traversal 拒否）、API 層 57 suite 865 test + integration 2 suite 28 test GREEN + tsc 0 error 🔵
  - **信頼性**: 🔵 *test-side の UUID_V4_RE copy（tests/integration/*）は sweep 境界（src/api）外であり意図的除外*

#### REQ-308: 図解タイプ日本語タイトル map シングルソース化 🔵

**信頼性**: 🔵 *single-source round 13（freeze-guard registry の 4 件目の新規エントリ）*

- [x] **TC-308-01**: `DIAGRAM_TYPE_TITLES` を `@stv/core/types/diagram`（`DIAGRAM_TYPES` と同居）から export し、`video-generator.generateSceneTitle` と `DiagramScene` のレンダリングタイトルの 2 消費サイトをローカル map から import に切替 🔵
  - **信頼性**: 🔵 *両 map は drift 済みだった（flowchart「プロセスフロー」vs「フローチャート」、general「ダイアグラム」vs「一般」）ため値変更を伴う実挙動修正 — シーンリストと動画フレームのタイトル不一致を解消。DiagramPreview の badge wording（ツリー構造/マトリクス/…）は別 surface の UI 略称として理由付き除外*
- [x] **TC-308-02**: frozen-literal registry に当該ファミリーのエントリを 1 件追加（`roots: ['src']`、minSweptFiles 200、object-literal member 形 pattern で canonical 値 + 変異文言の両方を捕捉）し、RED-first で 22 offender を検出 → 修正後に GREEN。mutation 検証: 別ファイルへの rename copy（`LOCAL_TITLE_COPY`）も sweep が捕捉 🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs tests/guards/frozen-literal-registry.test.ts tests/guards/diagram-type-titles-single-source.test.ts`
- [x] **TC-308-03**: 値 pin + 完全性 pin（DIAGRAM_TYPES 全 key・余分 key なし）+ behavioral pin（`VideoGenerator.convertSceneToRemotionFormat` の title が全タイプで canonical 接頭辞を持つこと、drift 済みだった flowchart/general を明示）+ 消費 import pin を `tests/guards/diagram-type-titles-single-source.test.ts` に配置。mutation: canonical 値変更で behavioral pin が RED。副次修正: `tests/integration/video-generator-duration-unit.test.ts` の旧 clamp literal pin（3000/10000、HEAD 時点で 4 RED）を scene-duration-limits からの import 導出に再 pin 🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs tests/guards/diagram-type-titles-single-source.test.ts tests/integration/video-generator-duration-unit.test.ts`

---

#### REQ-309: force-directed 収束述語変更のレイアウトアウトカム検証 🔵

**信頼性**: 🔵 *0531aa4f（round 15）の follow-up。iteration-count pin は述語の「いつ抜けるか」しか検証せず「抜けた結果の品質」を検証しない、という steering 指摘への対応*

- [x] **TC-309-01**: `src/visualization/__tests__/force-directed-convergence-outcome.test.ts` に 12 トポロジー（sparse 7: chain/ring/star/complete/hubs/chain-20/ring-24 + dense 5: chain-40/ring-40/grid-64/star-50/rand-100）× 3 述語 arm（canonical=本物の `runForceDirectedPhases`、old=`&& i > 0` 再現、full=予算全域）のアウトカムパリティ表を配置。sparse: canonical は 3 step で旧 33 step と同一の overlap=0・bounds 内結果に到達。dense: 予算枯渇で 3 arm が値一致 🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns force-directed-convergence-outcome`
- [x] **TC-309-02**: E2E（public `generateLayout`）で sparse 全トポロジーの幾何学 overlap 0・BOUNDS_MARGIN 内・座標有限・インスタンス再生成で位置一致（seeding r17 の回帰でもある）。mutation 検証: (1) 述語を旧形に戻す → sparse 1-step/phase assertion が RED、(2) bounds clamp 除去 → 5 件 RED、(3) jitter ×20 → 3 件 RED。repulsion 符号反転はアウトカム観測不能（damped・velocity-capped で分離済み配置はほぼ動かない）であり round-15 の physics 値 pin 側で担保と明記 🔵

#### REQ-310: @stv/core コア分割後の単一ソース維持 🔵

**信頼性**: 🔵 *PR #7（stv-core split・2026-08-18 マージ）に追随する Phase 137 要件。移管モジュール群のプロダクトリポジトリ内重複実装禁止と要件文書の出典パス同期を機械検証で担保*

- [x] **TC-310-01**: プロダクトリポジトリ src/ 配下に @stv/core 移管対象ディレクトリ（src/types・src/config・src/lib）の重複実装が存在せず、移管モジュールは 317 ファイルが `@stv/core` から import する単一ソースである（2026-08-19 実測）🔵
  - **再検証コマンド**: `test ! -d src/types && test ! -d src/config && test ! -d src/lib && echo NO-DUP-DIRS` / `grep -rl "from '@stv/core" src | wc -l`（→ 317）
- [x] **TC-310-02**: 要件文書の dead citation 監査 — requirements.md と acceptance-criteria.md に引用される src/ パスが全て実在する（stv-core split 前の旧パス引用 27件を 2026-08-19 に解消済み）🔵
  - **再検証コマンド**: `grep -o 'src/[A-Za-z0-9_/.-]*\.\(ts\|tsx\)' specs/speech-to-visuals/requirements.md | sort -u | while read p; do [ -f "$p" ] || echo "DEAD: $p"; done`（出力 0 行が合格・acceptance-criteria.md 同様）

#### REQ-311: @stv/core バージョン pin の固定 🔵

**信頼性**: 🔵 *PR #7 の statusCheckRollup 13/14 SUCCESS + deploy SKIPPED（gh pr view 7 実測）が分割時点の品質証拠。依存解決の再現性はタグ pin でのみ保証されるため形状を pin する*

- [x] **TC-311-01**: package.json の @stv/core 依存が GitHub タグへの完全 pin（`github:nobu007/stv-core#v1.0.7`）であり、浮動 ref（branch 名・semver range）でない。浮動 ref 化はビルド再現性を喪失させる拒否変更とする 🔵
  - **再検証コマンド**: `grep -n '"@stv/core"' package.json`（→ `"@stv/core": "github:nobu007/stv-core#v1.0.7",`）

#### REQ-312: tests/guards による分割境界の構造ピン維持 🔵

**信頼性**: 🔵 *tests/guards は72テストファイル（2026-08-19 実測）の構造ガード群で、ガードテスト自体が @stv/core import 形状を pin しているかを検証する*

- [x] **TC-312-01**: tests/guards 配下のガードテストが @stv/core への import 形状を正として pin している（例: tests/guards/clamp01-single-source.test.ts は `from '@stv/core/utils/guards'` を検証対象ソースに要求）。旧 src/utils パスへの回帰はガードが RED 化する構造 🔵
  - **再検証コマンド**: `find tests/guards -name '*.test.ts' | wc -l`（→ 72）/ `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns tests/guards/clamp01-single-source`

#### REQ-326: エビデンス出典（Phase 140）

- [x] **TC-323-01**: `formatEvidenceLine` が出力する `[EVIDENCE]` 行が固定形状（`started=<local-ISO>` / `ended=<local-ISO>` / `exit=<int>` / `elapsed_s=<小数2桁>` / 任意 `label=` / `cmd=<shell引用>` / `commit=` / `branch=`）に一致し、`EVIDENCE_LINE_RE` を満たすこと。ラベル無しの場合 `label=` スロットを出力しないこと。コマンド内の空白・引用符は shell-copyable に引用されること 🔵
- [x] **TC-323-02**: 失敗経路が黙示成功しないこと — spawn 失敗（存在しないコマンド）は `exit=127` を報告、未知オプション・コマンド未指定は usage エラー（exit 2）となり、中途パースされたコマンドを実行しないこと。子プロセスの非零 exit は行と process exit の両方に伝搬すること 🔵
- [x] **TC-323-03**: `elapsed_s` が子プロセス実行のみを囲む計測であること（120ms sleep を 0.12s 以上として報告）・タイムスタンプが numeric offset 付き local-ISO で round-trip 可能なこと 🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules' npx jest --config jest.config.cjs --testPathPatterns tests/scripts/collect-evidence`（14 tests）
  - **mutation RED 検証済み**: `[EVIDENCE]` prefix 改変で 5 tests RED・`SPAWN_FAILURE_EXIT=127→0` 改変で 1 test RED（interview-record A138）


#### REQ-328: non-null assertion census ratchet（Phase 141）

- [x] **TC-324-01**: src/visualization プロダクションコード（`__tests__` 除く）に postfix non-null assertion が 0 件であることが exact pin で検証されること。src 本体（`__tests__`/`__mocks__` 除外）= 93 以下・tests ツリー（`__mocks__` 除外）= 960 以下の ratchet が同時に検証されること（2026-08-19 実測開始値） 🔵
- [x] **TC-324-02**: census が空振りしないこと（残存 src/tests 両バケットが > 0 を検出する liveness check）・マッチング規則が文字列内 bang（`'visuals!'` 等）を計上しないこと 🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules' npx jest --config jest.config.cjs --testPathPatterns tests/guards/non-null-assertion-census`（4 tests）
  - **mutation RED 検証済み（MW-005）**: advanced-layouts.ts 末尾への `!` 注入で visualization exact pin と src ratchet の 2 tests RED（revert 後 GREEN）

#### REQ-329: storage key parity（Phase 141）

- [x] **TC-325-01**: LOADED key リテラルが全て SAVED されており（dead-read 0）・SAVED key が全て LOADED されていること（dead-write 0）。key セットは `{first-visit, tutorial-progress}` に exact pin されること 🔵
- [x] **TC-325-02**: 非 literal storage access が CorruptionOverlay のみに存在し（動的 key は corruption event 由来）・`extractStorageKey` の存在が pin されること 🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules' npx jest --config jest.config.cjs --testPathPatterns tests/guards/storage-key-parity`（4 tests）
  - **mutation RED 検証済み（MW-006）**: TutorialSystem の save key rename で 3 tests RED（dead-read 検出・pinned loaded/saved set）

#### REQ-330: mutation witness 台帳（Phase 141）

- [x] **TC-326-01**: 台帳（specs/speech-to-visuals/mutation-witness-ledger.md）の全 MW エントリが claim / target / mutation / command / observed を持ち、target ファイルが実在すること。エントリ数が pin（≥6）を下回らないこと 🔵
- [x] **TC-326-02**: 台帳が specs が mutation-verified として引用する TC id（TC-205-04 / TC-214-02 / TC-304-04）を網羅すること。過去主張 3 件は 2026-08-19 の再実行で確認済み（各 [EVIDENCE] 行: MW-001 = 1 failed/16・MW-002 = 1 failed/39・MW-004 = 1 failed/2 — いずれも主張どおり該当 test のみ RED） 🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules' npx jest --config jest.config.cjs --testPathPatterns tests/guards/mutation-witness-ledger`（14 tests）

#### REQ-331: non-null assertion 撲滅・pipeline 編（Phase 142）

- [x] **TC-327-01**: src/pipeline プロダクションコード（`__tests__` 除く）に postfix non-null assertion が 0 件であることが exact pin で検証されること。src 本体（`__tests__`/`__mocks__` 除外）ratchet が 93 から **64** に縮小されること（2026-08-20 実測・93 − 29） 🔵
- [x] **TC-327-02**: 挙動保存置換であること — 置換対象 9 ファイルを含む pipeline 系・guards・acceptance suite が全て GREEN（38 suites/657 tests baseline → post-edit 201 suites/5479 tests）・`tsc -p tsconfig.app.json --noEmit` exit=0・NaN 保存算術（`Number(undefined)` = NaN で `|| defaultDuration` fallback が同一挙動）であること 🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules' npx jest --config jest.config.cjs --testPathPatterns tests/guards/non-null-assertion-census`（5 tests）
  - **mutation RED 検証済み（MW-007）**: quality-estimators.ts `scenes.length` → `(scenes as unknown as { length: number })!.length` で pipeline exact pin と src ratchet（Expected <= 64 / Received 65）の 2 tests RED（revert 後 5 tests GREEN）

#### REQ-332: non-null assertion 撲滅・transcription 編（Phase 143）

- [x] **TC-328-01**: src/transcription プロダクションコード（`__tests__` 除く）に postfix non-null assertion が 0 件であることが exact pin で検証されること。src 本体（`__tests__`/`__mocks__` 除外）ratchet が 64 から **47** に縮小されること（2026-08-20 実測・64 − 17） 🔵
- [x] **TC-328-02**: 挙動保存置換であること — 置換対象 2 ファイルを含む transcription|streaming 系 suite が置換前後で同一 GREEN（25 suites/603 tests）・`tsc -p tsconfig.app.json --noEmit` exit=0・`sanitizeFinite(v, k)` ≡ `Number.isFinite(v) ? v : k`（正典実装は typeof number && isFinite → value・他は default で値選択述語が完全一致）・confidence フィルタの `?? Number.NaN` は undefined/NaN が常に閾値未満（`undefined >= x` = false）・Infinity は受理という旧 `!` 比較の全状態を保存すること（0 fallback は `minConfidence: 0` 合法値で非等価） 🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules' npx jest --config jest.config.cjs --testPathPatterns tests/guards/non-null-assertion-census`（6 tests）
  - **mutation RED 検証済み（MW-008）**: streaming-transcriber.ts:506 `sum + sanitizeFinite(segment.confidence), 0);` → `sum + ((segment as { confidence: number })!.confidence), 0);` で transcription exact pin（mutant 行を hits として検出）と src ratchet（Expected <= 47 / Received 48）の 2 tests RED（revert 後 6 tests GREEN）

#### REQ-333: non-null assertion 撲滅・export 編（Phase 144）

- [x] **TC-329-01**: src/export プロダクションコード（`__tests__` 除く）に postfix non-null assertion が 0 件であることが exact pin で検証されること。src 本体（`__tests__`/`__mocks__` 除外）ratchet が 47 から **37** に縮小されること（2026-08-20 実測・47 − 10） 🔵
- [x] **TC-329-02**: 挙動保存置換であること — 置換対象 5 ファイルを含む export pattern suite が置換前後で同一 GREEN（73 suites/4144 tests）・`tsc -p tsconfig.app.json --noEmit` exit=0・`requireSceneId` は id 無し scene の caught `{success:false}` 契約を保存（`?? ''`→`unnamed` 成功は非等価）・`Number()` は `undefined - x` ≡ `Number(undefined) - x` = NaN を safeMean/metrics 経路で同一保存・`writeOutputFile`/`getFileSize` の `string | undefined` pass-through 署名は REQ-228 の `prepareExport` 丸ごと stub テストが到達する outputPath 未設定状態を旧 `!` と同一に素通しすること（fail-loud accessor は同テスト 2 件 RED で REFUTED・`?? ''`/再生成も非等価） 🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules' npx jest --config jest.config.cjs --testPathPatterns tests/guards/non-null-assertion-census`（7 tests）
  - **mutation RED 検証済み（MW-009）**: export-job-queue.ts:220 `Number(job.startedAt) - job.enqueuedAt` → `(job as { startedAt: number }).startedAt! - job.enqueuedAt` で export exact pin と src ratchet（Expected <= 37 / Received 38）の 2 tests RED（revert 後 7 tests GREEN）
  - **source-anchor guard 更新**: tests/export/production-exporter-safe-aggregation-migration.test.ts の site-780 肯定 pin を `safeMean(completed.map((job) => Number(job.endTime) - Number(job.startTime)))` 形に更新（旧 `endTime! - startTime!` pin は Phase 144 置換で陳腐化 — 委譲で陳腐化した旧肯定 pin の先例と同一手順）

#### REQ-334: non-null assertion 撲滅・monitoring 編（Phase 145）

- [x] **TC-330-01**: src/monitoring プロダクションコード（`__tests__` 除く）に postfix non-null assertion が 0 件であることが exact pin で検証されること。src 本体（`__tests__`/`__mocks__` 除外）ratchet が 37 から **30** に縮小されること（2026-08-20 実測・37 − 7） 🔵
- [x] **TC-330-02**: 挙動保存置換であること — 置換対象 5 ファイルを含む monitoring+guards suite が GREEN（45 suites/1068 tests）・`tsc -p tsconfig.app.json --noEmit` exit=0・`?? Number.NaN` は optional な `MemoryMetrics.rss/external` 不在時の旧 `undefined / (1024*1024)` = NaN outcome を保存（`?? 0` は健康に見える偽計測を捏造するため非等価）・get-or-create は不在分岐が格納する配列と同一 instance を返す旧 `has()/set()/get()!` 三段と等価・`routes!:` 除去は ctor 無条件代入を strictPropertyInitialization が証明すること 🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules' npx jest --config jest.config.cjs --testPathPatterns tests/guards/non-null-assertion-census`（8 tests）
  - **mutation RED 検証済み（MW-010）**: real-time-performance-monitor.ts:209 `let history = this.metrics.get(metric);` → `let history = this.metrics.get(metric)!;` で monitoring exact pin と src ratchet（Expected <= 30 / Received 31）の 2 tests RED（revert 後 8 tests GREEN）
  - **source-anchor guard 更新**: tests/guards/bytes-to-mb-canon.test.ts の rss 肯定 pin を `bytesToMb(memoryUsage.rss ?? Number.NaN)` 要求形に更新（旧 `rss!?` 許容形 pin は Phase 145 置換で陳腐化 — source 変更と同コミット・site-780 と同一手順）

#### REQ-335: non-null assertion 撲滅・analysis 編（Phase 146）

- [x] **TC-331-01**: src/analysis プロダクションコード（`__tests__` 除く）に postfix non-null assertion が 0 件であることが exact pin で検証されること。src 本体（`__tests__`/`__mocks__` 除外）ratchet が 30 から **24** に縮小されること（2026-08-20 実測・30 − 6） 🔵
- [x] **TC-331-02**: 挙動保存置換であること — 置換対象 2 ファイルを含む analysis+guards suite が GREEN（135 suites/7057 tests）・`tsc -p tsconfig.app.json --noEmit` exit=0・fail-loud captured guard は `execute()` の `isEnabled()` = `Boolean(this.genAI)` ゲートで到達不能な undefined 分岐を同ゲートのメッセージで throw すること（mock 到達可能性 grep 済み・テストは `new LLMService('test-key')` 生成のみ到達）・`else if (currentSegment)` narrowing は `!currentSegment` が shouldStartNew を true する以上 else 到達時点で非 null 自明・closure 内 `let` narrowing 失効は const capture で構造解・`has()/get()!` → captured `get()` compare は buildTopicVector（値は常に number・undefined 格納なし）で厳密等価・`pop()!` → unreachable-undefined `break` は while guard `result.length > 0` で到達不能を明示すること 🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules' npx jest --config jest.config.cjs --testPathPatterns tests/guards/non-null-assertion-census`（9 tests）
  - **mutation RED 検証済み（MW-011）**: scene-segmenter.ts:939 `const prev = result.pop();` → `const prev = result.pop()!;` で analysis exact pin と src ratchet（Expected <= 24 / Received 25）の 2 tests RED（revert 後 9 tests GREEN）
  - **source-anchor guard 影響**: なし — scene-segmenter/llm-service の既存 anchor（sanitizeFinite ×3 系・SENTENCE_BOUNDARY_REGEX・retry defaults）は全て編集箇所と無関係（事前 grep で確認・陳腐化 pin なし）

#### REQ-336: non-null assertion 撲滅・src 全体 exact-0 + checker AST 化（Phase 147）

- [x] **TC-332-01**: src 全体のプロダクションコード（`__tests__`/`__mocks__` 除外・api/components/framework/quality/remotion/workers/src/test/main.tsx を含む）に postfix non-null assertion と definite-assignment assertion が **AST node として 0 件**であることが whole-src exact pin（`expect(srcTotal.hits).toEqual([])`）で検証されること。checker は TypeScript AST（`isNonNullExpression` + declaration `exclamationToken`）であり、文字列/コメント/JSX text の `!` をカウントせず（旧 regex 偽陽性 3 件の構造的除去）・`f!(…)` 形状を検出すること（Phase 146 終了時 line-regex 分布 24 行 = 偽陽性 3 + 実 node 21 + regex 盲点 1 → 置換対象 22 AST node・12 ファイル） 🔵
- [x] **TC-332-02**: 挙動保存置換であること — 置換対象 12 ファイルを含む 67 suite pattern が GREEN（1575 tests）・`tsc -p tsconfig.app.json --noEmit` exit=0・eslint 0・`?? Number.NaN` は optional confidence/startTime/PositionedNode dims の旧 `undefined` 演算 outcome（NaN = `toFixed` の "NaN"・`formatPlaybackTime` の `!Number.isFinite → '0:00'`・NaN 比較で overlap 検出）を正確に保存すること（`?? 0` は 0 の偽計測を捏造するため非等価）・captured destructured resolver（`const { resolve } = nextJob`）は closure 内 narrowing 問題の構造解で旧 `!` と同一 reference を渡すこと・timestamp parameter は呼び出し時点で代入済みの `lastAnalysisAt` を引数型に置換すること・module-level factory は ctor の `initializeHealthMetrics()` 呼び出しと同一初期状態を生成すること（呼び出し削除済み）・`?? ''` は `assertActive()` ⟺ runId lockstep 下の同ファイル既存正規化と対称であること 🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns tests/guards/non-null-assertion-census`（11 tests）
  - **mutation RED 検証済み（MW-012）**: MW-011 同一 mutant（scene-segmenter.ts:939 `const prev = result.pop();` → `const prev = result.pop()!;`）を AST checker 下で再適用し analysis exact pin + **whole-src exact pin** の 2 tests RED（revert 後 11 tests GREEN）— checker 置換後も検出力が連続
  - **mutation RED 検証済み（MW-013）**: enhanced-export-engine.ts:1185 `resolve({` → `nextJob.resolve!({`（旧 regex が Phase 144 で見落とした形状の再注入）で export exact pin + whole-src exact pin の 2 tests RED・**さらに旧 line-regex checker は同 mutant ファイルに 0 hits**（`!(` が continuation class 外）— checker upgrade が計量の言い換えでなく実検出ギャップを閉じたことの実証（revert 後 11 tests GREEN）

#### REQ-337: tests ツリー non-null assertion ディレクトリ別 ratchet（Phase 147）

- [x] **TC-333-01**: tests ツリー（`__mocks__` 除外）の non-null assertion 総数が AST node ベース上限 **1096** 以下であること（旧 line-based 960 からの再ベースライン — 行→node 計数器昇格で回帰ではない）・かつトップレベル 14 ディレクトリ（unit 471・integration 245・visualization 184・guards 72・pipeline 45・analysis 44・quality 17・transcription 8・api 2・lib 2・remotion 2・(root) 2・acceptance 1・config 1 = 合計 1096）それぞれが上限 pin 以下であることが guard で検証されること 🔵
- [x] **TC-333-02**: ratchet の失敗形が機能すること — (a) pin 済みディレクトリへの `!` 追加は当該 dir pin と合計 pin を RED にすること・(b) **pin に存在しない新規トップレベルディレクトリ**への `!` 追加は `tests/<dir> has no TESTS_DIR_PINS entry` の throw で fail すること（新テストディレクトリは意識的な pin 追加を強制）・(c) pin 済みディレクトリの消滅は pin 対応チェックが RED にすること（ratchet の無言の空洞化を防止）・(d) checker が空振りしていないことの liveness（tests total > 0） 🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns tests/guards/non-null-assertion-census`（11 tests）

#### REQ-338: tests ツリー non-null assertion ratchet 単調減少ラウンド 1（Phase 148）

- [x] **TC-334-01**: REQ-337 の ratchet が単調減少していること — Phase 148 実施後、tests/unit ディレクトリ pin が **471 → 377**（monitoring/alert-rules.test.ts 55 node → 0・export/export-job-queue-dlq.test.ts 39 node → 0・挙動保存の fail-loud helper 置換）に・tests 合計 pin が **1096 → 1002** に縮小され、guard が縮小後の pin で GREEN であること・置換対象 2 suite（48 + 26 = 74 tests）が GREEN であること 🔵
- [x] **TC-334-02**: 減少の強制が実証されていること — Phase 148 rewrite への `!` 1 node 再注入（`expect(rule.expr)` → `expect(rule!.expr)`・alert-rules.test.ts）が tests/unit ディレクトリ ratchet（377 → 378 超過）と tests 合計 ratchet（1002 → 1003 超過）の **2 tests RED** を生むこと（MW-014・revert 後 GREEN）。置換は verdict 保存であること — helper は不在時に欠落対象名を含む Error を throw し（旧: `TypeError: Cannot read properties of undefined` または bare `toBeDefined()` 失敗 = いずれも RED）、存在時は同一 assertion を narrow された値に対して実行する 🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'tests/guards/non-null-assertion-census|tests/unit/monitoring/alert-rules|tests/unit/export/export-job-queue-dlq'`（3 suites / 85 tests）

#### REQ-339: tests ツリー non-null assertion ratchet 単調減少ラウンド 2（Phase 149）

- [x] **TC-335-01**: REQ-337 の ratchet が Phase 148 に引き続き単調減少していること — Phase 149 実施後、tests/unit ディレクトリ pin が **377 → 274**（quality/quality-gate.test.ts 29 node → 0・monitoring/grafana-dashboard-model.test.ts 25 node → 0・pipeline/pipeline-orchestrator.test.ts 25 node → 0・export/production-exporter.test.ts 24 node → 0・計 103 node）に・tests 合計 pin が **1002 → 899** に縮小され、guard が縮小後の pin で GREEN であること・置換対象 4 suite（42 + 24 + 48 + 31 = 145 tests）が GREEN であること 🔵
- [x] **TC-335-02**: 減少の強制が継続実証されていること — Phase 149 rewrite への `!` 1 node 再注入（`expect(requireDefined(result.metrics, 'result.metrics').layoutQualityScore)` → `expect(result.metrics!.layoutQualityScore)`・pipeline-orchestrator.test.ts:723）が tests/unit ディレクトリ ratchet（275 > 274 超過）と tests 合計 ratchet（900 > 899 超過）の **2 tests RED** を生むこと（MW-015・revert 後 GREEN）。置換は verdict 保存であること — (c) の `input.config!` は factory 戻り型 `PipelineInput & { config: PipelineConfig }` による**正型経路の mutate** に置換され（factory は常に config を代入するため挙動同一）・(d) の `getJobStatus()` は `ExportJob | null` を返すため helper `requireJobStatus` は **null を guard** すること（旧: `null.field` TypeError = RED・新: throw Error = 同一 RED verdict）🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'tests/guards/non-null-assertion-census|tests/unit/quality/quality-gate|tests/unit/monitoring/grafana-dashboard-model|tests/unit/pipeline/pipeline-orchestrator\.test|tests/unit/export/production-exporter'`（5 suites / 156 tests）

#### REQ-340: tests ツリー non-null assertion ratchet 単調減少ラウンド 3（Phase 150）

- [x] **TC-336-01**: REQ-337 の ratchet が Phase 149 に引き続き単調減少していること — Phase 150 実施後、tests/unit ディレクトリ pin が **274 → 169**（api/websocket-handler.test.ts 21 node → 0・api/batch-processing-api.test.ts 14 node → 0・api/routes/monitoring-phase84-85.test.ts 14 node → 0・api/websocket-payload-validation.test.ts 14 node → 0・components/VideoPreview.test.tsx 14 node → 0・export/animated-svg-lottie-export.test.ts 14 node → 0・quality/error-recovery-boundary-grouping.test.ts 14 node → 0・計 105 node）に・tests 合計 pin が **899 → 794** に縮小され、guard が縮小後の pin で GREEN であること・対象が **guard-first survey**（AST census per-file 集計降順の上位 7 ファイル・手動列挙なし）で機械的に選定されていること・置換対象 7 suite を含むパターン一致 **8 suites / 315 tests** が GREEN であること 🔵
- [x] **TC-336-02**: 減少の強制が継続実証されていること — Phase 150 rewrite への `!` 1 node 再注入（`expect(requirePlayer().play)` → `expect(capturedPlayerRef!.play)`・VideoPreview.test.tsx）が tests/unit ディレクトリ ratchet（170 > 169 超過）と tests 合計 ratchet（795 > 794 超過）の **2 tests RED** を生むこと（MW-016・revert 後 GREEN）。置換は verdict 保存であること — (a) の mock handler 呼び出しは不在時の旧挙動 `undefined is not a function`（= RED）に対し helper は未登録 event 名を含む Error を throw し・(b) の `getJobStatus()` は `BatchJobStatus | null` を返すため helper は **null を guard** すること（旧: `null.status` TypeError = RED・新: throw Error = 同一 RED verdict）・(d) の直前 `toBeDefined()` 対は helper の throw が同保証を担うため折りたたまれていること 🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'tests/guards/non-null-assertion-census|tests/unit/api/websocket-handler|tests/unit/api/batch-processing-api|tests/unit/api/routes/monitoring-phase84-85|tests/unit/api/websocket-payload-validation|tests/unit/components/VideoPreview|tests/unit/export/animated-svg-lottie-export|tests/unit/quality/error-recovery-boundary-grouping'`（9 suites / 326 tests）

#### REQ-341: tests ツリー non-null assertion ratchet 単調減少ラウンド 4（Phase 151）

- [x] **TC-337-01**: REQ-337 の ratchet が Phase 150 に引き続き単調減少していること — Phase 151 実施後、tests/unit ディレクトリ pin が **169 → 103**（pipeline/pipeline-quality-monitor.test.ts 13 node → 0・monitoring/real-time-performance-monitor.test.ts 11 node → 0・pipeline/pipeline-orchestrated-recovery-integration.test.ts 10 node → 0・pipeline/bottleneck-detector.test.ts 8 node → 0・pipeline/pipeline-run-recovery-integration.test.ts 8 node → 0・quality/enhanced-error-recovery-extended.test.ts 8 node → 0・quality/recovery-strategy-chain.test.ts 8 node → 0・計 66 node）に・tests 合計 pin が **794 → 728** に縮小され、guard が縮小後の pin で GREEN であること・対象が **guard-first survey**（AST census per-file 集計降順の上位 7 ファイル・手動列挙なし）で機械的に選定されていること・置換対象 7 suite **193 tests**（44+59+14+12+6+36+22）が GREEN であること 🔵
- [x] **TC-337-02**: 減少の強制が継続実証されていること — Phase 151 rewrite への `!` 1 node 再注入（`expect(latest.processingTime)` → `expect(latest!.processingTime)`・pipeline-quality-monitor.test.ts）が tests/unit ディレクトリ ratchet（104 > 103 超過）と tests 合計 ratchet（729 > 728 超過）の **2 tests RED** を生むこと（MW-017・revert 後 GREEN）。置換は verdict 保存であること — (c) の `getStats()` は `ChainStats | null` を・`worstBottleneck` は `BottleneckInfo | null` を返すため helper は **null を guard** すること（旧: `null.totalRuns` TypeError = RED・新: throw Error = 同一 RED verdict）・(d) は `metrics?.recoveryReport` の narrowing で旧 `as RunRecoveryReport` cast をも解消していること（field は ExtendedPipelineMetrics で既に `RunRecoveryReport` 型）・直前の `toBeDefined()` / `not.toBeNull()` 対は helper の throw が同保証を担うため折りたたまれていること 🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'tests/guards/non-null-assertion-census|tests/unit/pipeline/pipeline-quality-monitor|tests/unit/monitoring/real-time-performance-monitor|tests/unit/pipeline/pipeline-orchestrated-recovery-integration|tests/unit/pipeline/bottleneck-detector|tests/unit/pipeline/pipeline-run-recovery-integration|tests/unit/quality/enhanced-error-recovery-extended|tests/unit/quality/recovery-strategy-chain'`（8 suites / 204 tests）

#### REQ-342: tests ツリー non-null assertion ratchet 単調減少ラウンド 5・tests/unit 外初回（Phase 152）

- [x] **TC-338-01**: REQ-337 の ratchet が Phase 151 に引き続き・steering 指令の **tests/unit 外初回**として単調減少していること — Phase 152 実施後、tests/integration ディレクトリ pin が **245 → 132**（phase32-quality-pipeline.test.ts 38 node → 0・batch.test.ts 23 node → 0・secure-download-pipeline.test.ts 20 node → 0・test_pipeline_health_smoke.test.ts 17 node → 0・label-sizing-pipeline.test.ts 15 node → 0・計 113 node）に・tests/visualization ディレクトリ pin が **184 → 107**（importance-scaler.test.ts 21 node → 0・strategies/flow-strategy.test.ts 20 node → 0・strategies/tree-strategy.test.ts 18 node → 0・complex-layout-engine.test.ts 18 node → 0・計 77 node）に・tests 合計 pin が **728 → 538** に縮小され、guard が縮小後の pin で GREEN であること・対象が **guard-first survey**（AST census per-file 集計降順・手動列挙なし）で両ディレクトリの上位ファイルを機械的に選定していること・置換対象 9 suite を含むパターン一致 **13 suites / 228 tests** が GREEN であること 🔵
- [x] **TC-338-02**: 減少の強制が継続実証されていること — Phase 152 rewrite への `!` 1 node 再注入（`const centerA = centerXOf(nodeA);` → `const centerA = nodeA.x + nodeA.width! / 2;`・flow-strategy.test.ts）が tests/visualization ディレクトリ ratchet（108 > 107 超過）と tests 合計 ratchet（539 > 538 超過）の **2 tests RED** を生むこと（MW-018・revert 後 GREEN）。置換は verdict 保存であること — (b) の `getJobStatus()` は `BatchJobStatus | null` を返すため helper は **null を guard** すること（旧: `null.status` TypeError = RED・新: throw Error = 同一 RED verdict）・(e) の `centerXOf` は旧 `node.width!` 算術の undefined→NaN 伝播を `?? Number.NaN` で**保存**すること（`!` は runtime 値を変えないので NaN 挙動が旧と同一）・(f) の definite-assignment `let MindMapStrategy!: typeof import(…)` は `let mod: typeof import(…) | undefined` holder + 各テストの `requireModule` destructure に置換され・beforeAll import 失敗時は module 名入り Error で RED であること・ledger 監査 pin が **≥17 → ≥18** に引き上げられ MW-018 エントリで GREEN であること 🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'tests/guards/non-null-assertion-census|tests/guards/mutation-witness-ledger|tests/integration/phase32-quality-pipeline|tests/integration/batch|tests/integration/secure-download-pipeline|tests/integration/test_pipeline_health_smoke|tests/integration/label-sizing-pipeline|tests/visualization/importance-scaler|tests/visualization/strategies/flow-strategy|tests/visualization/strategies/tree-strategy|tests/visualization/complex-layout-engine'`（13 suites / 228 tests）

#### REQ-343: tests ツリー non-null assertion ratchet 単調減少ラウンド 6・4 ディレクトリ横断（Phase 153）

- [x] **TC-339-01**: REQ-337 の ratchet が Phase 152 に引き続き **4 ディレクトリ横断**で単調減少していること — Phase 153 実施後、tests/analysis ディレクトリ pin が **44 → 13**（llm-cache-debounce.test.ts 20 node → 0・budget-alert-boundary.test.ts 11 node → 0・計 31 node）に・tests/pipeline ディレクトリ pin が **45 → 20**（improvement-detector.test.ts 15 node → 0・bottleneck-detector.test.ts 10 node → 0・計 25 node）に・tests/visualization ディレクトリ pin が **107 → 78**（cycle-strategy.test.ts 16 node → 0・strategies/cycle-strategy.test.ts 13 node → 0・計 29 node）に・tests/integration ディレクトリ pin が **132 → 107**（pipeline-orchestrator-recovery.test.ts 13 node → 0・export-artifact-pipeline-e2e.test.ts 12 node → 0・計 25 node）に・tests 合計 pin が **538 → 428** に縮小され、guard が縮小後の pin で GREEN であること・対象が guard-first survey の **node ≥ 10 全数**（手動列挙なし・横断的機械閾値）で選定されていること・置換対象 8 suite を含むパターン一致 **13 suites / 247 tests** が GREEN であること 🔵
- [x] **TC-339-02**: 減少の強制が継続実証されていること — Phase 153 rewrite への `!` 1 node 再注入（`expect(requireOpportunity(report, 'Processing Speed').priority).toBe('medium');` → `expect(opp!.priority).toBe('medium');`・improvement-detector.test.ts）が tests/pipeline ディレクトリ ratchet（21 > 20 超過）と tests 合計 ratchet（429 > 428 超過）の **2 tests RED** を生むこと（MW-019・revert 後 GREEN）。置換は verdict 保存であること — (a) の `readCacheFile()` は `| null` を返すため `requireDisk()` は **null を guard** すること（旧: `null.entries` TypeError = RED・新: throw Error = 同一 RED verdict）・(e) の `centerXOf` は旧 `node.width!` 算術の undefined→NaN 伝播を `?? Number.NaN` で**保存**すること（root 側は構造型 `{ x; width? }`・strategies 側は `LayoutEdge.from` が `string | undefined` のため `PositionedNode`/`LayoutEdge` **型付き helper** とし matcher の `number | undefined` 型エラーをも解消）・(f) は `metrics?.recoveryReport` の narrowing で旧 `as RunRecoveryReport` cast をも解消していること（field は ExtendedPipelineMetrics で既に `RunRecoveryReport` 型）・(c) の中間 `const opp = …find(…)` + `expect(opp).toBeDefined()` verdict は保存されていること・ledger 監査 pin が **≥18 → ≥19** に引き上げられ MW-019 エントリで GREEN であること 🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'tests/guards/non-null-assertion-census|tests/guards/mutation-witness-ledger|tests/analysis/llm-cache-debounce|tests/analysis/budget-alert-boundary|tests/pipeline/improvement-detector|tests/pipeline/bottleneck-detector|tests/visualization/cycle-strategy|tests/visualization/strategies/cycle-strategy|tests/integration/pipeline-orchestrator-recovery|tests/integration/export-artifact-pipeline-e2e'`（13 suites / 247 tests）

#### REQ-344: tests ツリー non-null assertion ratchet 単調減少ラウンド 7・transcription 初の dir exact-0 と空洞化チェック簡素化（Phase 154）

- [x] **TC-340-01**: REQ-337 の ratchet が Phase 153 に引き続き **降順上位 10 ファイル・6 ディレクトリ横断**で単調減少していること — Phase 154 実施後、tests/guards ディレクトリ pin が **72 → 60**（edge-anchor-geometry-single-source.test.ts 12 node → 0）に・tests/integration ディレクトリ pin が **107 → 71**（api.test.ts 9・export-error-recovery-integration.test.ts 9・export-retry-dlq-metrics-integration.test.ts 9・pipeline-recovery-e2e.test.ts 9 = 計 36 node → 0）に・tests/visualization ディレクトリ pin が **78 → 61**（layout-quality-composite.test.ts 9・strategies/flowchart-strategy.test.ts 8 = 計 17 node → 0）に・tests/pipeline ディレクトリ pin が **20 → 11**（retry-observability-surface.test.ts 9 node → 0）に・tests/quality ディレクトリ pin が **17 → 9**（regression-detector.test.ts 8 node → 0）に・tests/transcription ディレクトリ pin が **8 → 0**（browser-transcriber.test.ts 8 node → 0・**tests 内初のディレクトリ exact-0 pin**）に・tests 合計 pin が **428 → 338** に縮小され、guard が縮小後の pin で GREEN であること・対象が guard-first survey の **降順上位 10 ファイル**（node ≥ 10 機械閾値の枯渇後・選定根拠は survey 出力）で選定されていること・置換対象 10 suite を含むパターン一致 **17 suites / 777 tests** が GREEN であること・transcription exact-0 に伴い空洞化チェック（TC-333-02 c）が **files 有無ベース（testsDirsByFiles）** に簡素化され bogus pin `'nonexistent-dir': 0` で RED 検証済みであること 🔵
- [x] **TC-340-02**: 減少の強制が継続実証されていること — Phase 154 rewrite への `!` 1 node 再注入（`fireHandler(mockRecognitionInstance.onerror, { error: 'network', message: 'Network error' });` → `mockRecognitionInstance.onerror!({ error: 'network', message: 'Network error' });`・browser-transcriber.test.ts）が tests 合計 ratchet（339 > 338 超過）と **transcription exact-0 ratchet（1 > 0 超過）** の **2 tests RED** を生むこと（MW-020・revert 後 GREEN — 初の exact-0 ディレクトリ pin が新規 1 node も許容しないことの実証）。置換は verdict 保存であること — (b) の `getJobStatus()` は `BatchJobStatus | null` を返すため helper は **null を guard** すること（旧: `null.status` TypeError = RED・新: throw Error = 同一 RED verdict・直前の `expect(status).not.toBeNull()` は throw に折りたたみ）・(c) の DLQ エラーメッセージ検証は `dequeued` が undefined になり得る再代入ループのため **loop 内 null guard** で最終 `expect(dequeued).toBeUndefined()` verdict を保存すること・`resolveRender!()` は definite-assignment holder（`let resolveRender | undefined` + executor 直後 `finishRender === undefined` throw）で保存すること・(e) の `requireLoadedBaseline` は `NonNullable<LoadedBaseline>` 戻りで null 狭窄化すること・(g) の `strategy.validateInputs!(…)` ×4 / `strategy.getStrategyDefaults!()` は具象 class member が non-optional（optional は ILayoutStrategy interface 側のみ）のため **`!` 除去が挙動保存**であること・ledger 監査 pin が **≥19 → ≥20** に引き上げられ MW-020 エントリで GREEN であること 🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'tests/guards/non-null-assertion-census|tests/guards/mutation-witness-ledger|tests/guards/edge-anchor-geometry-single-source|tests/integration/api.test|tests/integration/export-error-recovery-integration|tests/integration/export-retry-dlq-metrics-integration|tests/integration/pipeline-recovery-e2e|tests/pipeline/retry-observability-surface|tests/quality/regression-detector|tests/transcription/browser-transcriber|tests/visualization/layout-quality-composite|tests/visualization/strategies/flowchart-strategy'`（17 suites / 777 tests）


#### REQ-345: tests ツリー non-null assertion ratchet 単調減少ラウンド 8・node≥7 全数で tests/unit 残存最大層に初本格着手（Phase 155）

- [x] **TC-341-01**: REQ-337 の ratchet が Phase 154 に引き続き **node≥7 全数・12 ファイル・5 ディレクトリ横断**で単調減少していること — Phase 155 実施後、tests/guards ディレクトリ pin が **60 → 51**（node-extent-scan-single-source.test.ts 9 node → 0）に・tests/analysis ディレクトリ pin が **13 → 6**（llm-cache-stats-paths.test.ts 7 node → 0）に・tests/integration ディレクトリ pin が **71 → 50**（export-job-lifecycle.test.ts 7・export-security-e2e.test.ts 7・secure-download-edge-cases.test.ts 7 = 計 21 node → 0）に・tests/unit ディレクトリ pin が **103 → 61**（export/apng-encoder.test.ts 7・monitoring/pipeline-metrics-collector.test.ts 7・pipeline/pipeline-orchestrator-quality.test.ts 7・quality/batch-operation-recovery.test.ts 7・quality/error-recovery-health-tracker.test.ts 7・quality/error-recovery-state-management.test.ts 7 = 計 42 node → 0・**初の本格着手**）に・tests/visualization ディレクトリ pin が **61 → 54**（strategies/dagre-layout-strategy.test.ts 7 node → 0）に・tests 合計 pin が **338 → 252** に縮小され、guard が縮小後の pin で GREEN であること・対象が guard-first survey の **node≥7 全数**（降順上位 12 ファイルと一致・選定根拠は survey 出力）で選定されていること・置換対象 12 suite を含むパターン一致 **14 suites / 364 tests** が GREEN であること 🔵
- [x] **TC-341-02**: 減少の強制が継続実証されていること — Phase 155 rewrite への `!` 1 node 再注入（`expect(longNode.w ?? Number.NaN).toBeGreaterThanOrEqual(shortNode.w ?? Number.NaN);` → `expect(longNode.w!).toBeGreaterThanOrEqual(shortNode.w ?? Number.NaN);`・dagre-layout-strategy.test.ts）が tests 合計 ratchet（253 > 252 超過）と tests/visualization ディレクトリ ratchet（55 > 54 超過）の **2 tests RED** を生むこと（MW-021・revert 後 GREEN）。置換は verdict 保存であること — (a) の `foldNodeExtents` は空入力のみ `null` を返すため `requireExtents` は非空 fold site のみを wrap し空入力 pin の `toBeNull()` verdict を保存すること・(c) の `generateDownloadUrl()` は `| undefined` を返すため `requireDownloadUrl` は undefined を guard し直前の redundant `expect(…).toBeDefined()` を throw に折りたたむこと（旧: `undefined.url` TypeError = RED・新: throw Error = 同一 RED verdict）・(e) の `QualityCall` は `Parameters<QualityMonitor['recordMetrics']>` から導出し find callback の引数注釈をも解消すること・(f) の `requireBreaker` は breaker Map value の member shape が site 毎に異なるため **generic `<T>`** であること・`ClassifiedError` は `@/quality/error-classifier` から直接 import すること（本 module からは re-export されない）・(g) の `PositionedNode.w` は optional のため `w!` site は `?? Number.NaN` で undefined→failed-matcher verdict を保存し・`LayoutEdge.points` は non-optional のため `points!` は **除去のみが挙動保存** であること（ラウンド 7 flowchart-strategy と同型）・ledger 監査 pin が **≥20 → ≥21** に引き上げられ MW-021 エントリで GREEN であること 🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'tests/guards/non-null-assertion-census|tests/guards/mutation-witness-ledger|tests/guards/node-extent-scan-single-source|tests/analysis/llm-cache-stats-paths|tests/integration/export-job-lifecycle|tests/integration/export-security-e2e|tests/integration/secure-download-edge-cases|tests/unit/export/apng-encoder|tests/unit/monitoring/pipeline-metrics-collector|tests/unit/pipeline/pipeline-orchestrator-quality|tests/unit/quality/batch-operation-recovery|tests/unit/quality/error-recovery-health-tracker|tests/unit/quality/error-recovery-state-management|tests/visualization/strategies/dagre-layout-strategy'`（14 suites / 364 tests）

#### REQ-346: tests ratchet 終了条件（end-of-ratchet gate）spec 化と次サイクル obligation の宣言

- [x] **TC-342-01**: ratchet の打ち切り基準が **opt-in な acceptance** として spec 化されていること — `tests/guards/non-null-assertion-census.test.ts` に **3 ケースの `it.skip(...)`** が同 guard suite に追加されている（skip 状態のため現状の pin 252 / unit 61 でも **GREEN 通過**）。同 skip は「両 gate 通過後の manual unskip のみ」を trigger とし、`tests (excl. __mocks__) pin ≤ 100` / `tests/unit pin = 0` / `expect(stillRoom).toBe(false)` の 3 ケースから成る。unskip は機械 rule ではなく **次の commit で人間が手動で行う**ことが明記されており、これは前回の AI_HUB_MAKE_RUN_FEEDBACK が拒否した「RED-as-normal-state 同型」を **opt-in によって完全に回避**するための wiring であること 🔵
- [x] **TC-342-02**: 終了条件到達後の obligation が spec 化されていること — [tasks/TASK-0243.md](../tasks/TASK-0243.md) §「義務 A」で `mutation-witness-ledger.test.ts` と `non-null-assertion-census.test.ts` の commentary を逆引きして **src/ 側 API 契約**（`T | null` / `T | undefined`）と caller を 1 件以上 harden し、MW-022 を ledger に追記することが宣言されていること。§「義務 B」で `make sync:mirror-from-requirements` target が `specs/_doc_spine.yml` の `spine:children:begin` 直前 post-step として配線され、`requirements.md`（正本）から `architecture.md`（mirror）を自動再生成する **spec build hook** 経路のみが AC mirror DONE とみなされることが宣言されていること。両義務は **次サイクル obligation**（履行は TASK-0244 以降）として明示され、本タスク（TASK-0243）のスコープは「終了条件 spec 化 + acceptance wiring のみ」と分離されていること 🔵
- [x] **TC-342-03**: 打ち切り基準の commit 形に **monotonic decrease 停止** が埋め込まれていること — `docs(specs): TASK-0243 wiring — …` commit message は、（a）`tests/unit exact-0` 到達後の新ラウンド提案で pin を引き下げる変更を **revert する手順**を 1 行で含み・（b）acceptance に `expect(stillRoom).toBe(false)`（両 gate 通過後に反転する assertion）を GREEN のまま組み込み・（c）義務 A / B の **履行は含めず** wiring のみを完了とすることの 3 点が commit 本文に明記されていること。mutant 実測（pin 引き下げ → acceptance RED）を 1 ケース以上含むこと — 例えば「`PINNED['tests (excl. __mocks__)'] = 252` を `251` に書き戻す」と TC-342-01 の gate assertion が **RED** になり revert で GREEN に戻ることが GREEN 実測ログで示されていること 🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'tests/guards/non-null-assertion-census|tests/guards/mutation-witness-ledger'`（2 suites / 既存 green 維持）

#### REQ-348: HealthCheckService.checkCacheHealth の non-finite/omitted hitRate NaN-routing fail-loud 化（義務 A 2 件目・MW-023）

- [x] **TC-343-01**: silent NaN-routing が fail-loud に置換されていること — `src/monitoring/health-check-service.ts` の `checkCacheHealth()` 冒頭に `typeof stats.hitRate !== 'number' || typeof stats.totalEntries !== 'number' || !Number.isFinite(stats.hitRate) || !Number.isFinite(stats.totalEntries)` の 4 条件 OR ガードが追加され、`'Cache monitoring unavailable: backend returned non-finite or omitted metrics'` を返す degraded path が投入されていること。修正前は `globalCache.getStats()` の `stats.hitRate = undefined` / `NaN` / `stats.totalEntries = undefined` が `Math.round(NaN * N) = NaN` → `NaN / (NaN + NaN) = NaN` → `|| 0` で `0%` → "Cache is ineffective (0% hit rate)" → unhealthy（= unknown observation window で fabricated critical）→ `generateRecommendations` が "CRITICAL: Cache is ineffective - review caching strategy" を emit する silent corruption を起こしていた（memory の recurring-bug-classes.md "Self-referential rate/proportion formula" の延長線上の live instance）🔵
- [x] **TC-343-02**: RED-verifying tests が追加されていること — `tests/unit/monitoring/health-check-service.test.ts` の cache health check describe ブロックに 2 tests が追加されている:（a）`should report degraded when stats.hitRate is non-finite (NaN) (REQ-348)` で `hitRate: NaN, totalEntries: 1000, totalHits/Misses: undefined` を渡したとき `'Cache monitoring unavailable: backend returned non-finite or omitted metrics'` を返す degraded を assert・（b）`should report degraded when stats.hitRate/totalEntries are omitted (REQ-348)` で `totalHits/Misses/hitRate/totalEntries` すべて undefined を渡したとき同 degraded message を assert。`defaultCacheStats` には `hitRate: 0.6, totalEntries: 1000` が追加され、修正前の silent corruption（=テスト全件が healthy/degraded/unhealthy 判定に流れず fabricated unhealthy に収束）が finite input で解消する根拠を提供していること 🔵
- [x] **TC-343-03**: mutation-verified で真逆セマンティクス保存が実証されていること — `specs/speech-to-visuals/mutation-witness-ledger.md` に MW-023 エントリが追加され、ガード 4 条件それぞれのオペランド反転 mutation（`typeof === 'number'` / `Number.isFinite` のときに degraded = 修正前と真逆のセマンティクス）後の run が `Tests: 7 failed, 45 passed, 52 total` を返すこと。新規 2 tests が **target RED**（`expected 'healthy' to be 'degraded'`）を返し、既存の正常系テスト 5 件が **cascade RED**（「healthy な finite hitRate が depleted 判定に転落」）になることで、修正が「欠損/non-finite 時のみ degraded・妥当入力時は healthy/degraded/unhealthy の数値判定」という真のセマンティクスを保存していることを **MW-022 と同手法で** 実証していること。revert で 52/52 GREEN 復元・ledger 監査 46/46 → 48/48 GREEN 継続（pin ≥21 通過）🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'tests/unit/monitoring/health-check-service|tests/guards/mutation-witness-ledger'`（2 suites / 52 + 48 tests GREEN）

- [x] **TC-344-01**: silent NaN-routing が fail-loud に置換されていること — `src/monitoring/health-check-service.ts` の `checkPipelineHealth()` に（Phase 160 統合後の形式で）`if (!isFiniteMetric(successRate) || !isFiniteMetric(avgProcessingTime))` ガードが前置され、`'Pipeline monitoring unavailable: backend omitted successRate/avgProcessingTime'` を返す degraded path が投入されていること。修正前は `realTimeMonitor.getSnapshot().pipeline` の `successRate` / `avgProcessingTime` が omitted / non-finite のとき `undefined > 0.95` / `NaN < 60000` がともに FALSE に化け else 枝で "Pipeline is experiencing issues (NaN.0% success rate)" の fabricated unhealthy を `generateRecommendations` の CRITICAL 相当まで伝播させていた（REQ-349・Phase 158・TASK-0245）🔵
- [x] **TC-344-02**: RED-verifying tests が追加されていること — `tests/unit/monitoring/health-check-service.test.ts` の pipeline describe に（a）`should report degraded with the omit-fields message when pipeline.successRate is missing (REQ-349)`（`successRate: undefined`・`avgProcessingTime` default）と（b）`should report degraded when pipeline.avgProcessingTime is non-finite (NaN) (REQ-349)`（`avgProcessingTime: NaN`）の 2 tests が追加され、両ケースで同 degraded message を assert すること 🔵
- [x] **TC-344-03**: mutation-verified で真逆セマンティクス保存が実証されていること — mutation（ガード反転: `isFiniteMetric(successRate) && isFiniteMetric(avgProcessingTime)` = finite/defined のとき degraded）適用後の run が Phase 158 実施時は `Tests: 2 failed, 44 passed, 46 total`（target RED 2 件のみ・cascade なし — 2 メトリクスが独立した経路として機能）、Phase 161 再実行（58-test baseline・REQ-350/351 tests 追加後）は `Tests: 11 failed, 47 passed, 58 total`（target RED 2 + pipeline 正常系・overall status 計算の cascade RED）を返すこと。revert で GREEN 復元。MW-024 エントリが Phase 161 に台帳補填されていること 🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'tests/unit/monitoring/health-check-service'`

- [x] **TC-345-01**: silent NaN-routing が fail-loud に置換されていること — `src/monitoring/health-check-service.ts` の `checkLLMHealth()` に（Phase 160 統合後の形式で）`if (!isFiniteMetric(cacheHitRate))` ガードが前置され、`'LLM integration unavailable: backend omitted/non-finite cacheHitRate'` を返す degraded path が投入されていること。修正前は `snapshot.llm.cacheHitRate` が omitted / non-finite のとき `cacheHitRate > 0.4` / `> 0.2` がともに FALSE に化け else 枝で "Llm integration may have issues (NaN% cache hit rate)" の fabricated unhealthy を `generateRecommendations` の CRITICAL recommendation まで伝播させていた（REQ-350・Phase 159・TASK-0246 — TASK ファイル・TC・台帳は Phase 161 に補填）🔵
- [x] **TC-345-02**: RED-verifying tests が追加されていること — `tests/unit/monitoring/health-check-service.test.ts` の LLM describe に（a）`should report degraded when llm.cacheHitRate is non-finite (NaN) (REQ-350)`（`cacheHitRate: NaN, totalRequests: 100`）と（b）`should report degraded when llm.cacheHitRate is omitted (REQ-350)`（`cacheHitRate: undefined, totalRequests: 100`）の 2 tests が追加され、両ケースで同 degraded message を assert すること 🔵
- [x] **TC-345-03**: mutation-verified で真逆セマンティクス保存が実証されていること — mutation（ガード反転: `isFiniteMetric(cacheHitRate)` = finite/defined のとき degraded）適用後の run が Phase 161 再実行（58-test baseline）で `Tests: 8 failed, 50 passed, 58 total`（target RED 2 = NaN/omit tests・cascade RED 6 = LLM 正常系 4 + overall status 計算 2）を返すこと。revert で GREEN 復元。MW-025 エントリが Phase 161 に台帳補填されていること 🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'tests/unit/monitoring/health-check-service'`

- [x] **TC-346-01**: silent NaN-routing が fail-loud に置換されていること — `src/monitoring/health-check-service.ts` の `checkErrorRecoveryHealth()` に `if (!isFiniteMetric(errorRate) || !isFiniteMetric(recoveryRate))` ガードが前置され、`'Error recovery unavailable: backend omitted/non-finite errorRate/recoverySuccessRate'` を返す degraded path が投入されていること。修正前実測として `errorRate: NaN` で `"Error recovery is degraded (NaN% error rate, 90.0% recovery rate)"`・`recoverySuccessRate: undefined` で `"Error recovery is degraded (2.0% error rate, NaN% recovery rate)"` の fabricated verdict が RED 検証で観測されたこと。これにより `checkXxxHealth` 系の未ガード metric read が全完すること（memory=REQ-347・cache=REQ-348・pipeline=REQ-349・llm=REQ-350・errorRecovery=REQ-351・performance=try-catch 別系統）（REQ-351・Phase 161・TASK-0247）🔵
- [x] **TC-346-02**: RED-verifying tests が追加されていること — `tests/unit/monitoring/health-check-service.test.ts` の error recovery describe に（a）`should report degraded when errors.errorRate is non-finite (NaN) (REQ-351)`（`errorRate: NaN`・recoverySuccessRate は default 0.9）と（b）`should report degraded when errors.recoverySuccessRate is omitted (REQ-351)`（`recoverySuccessRate: undefined`・errorRate は default 0.02）の 2 tests が追加され、両ケースで同 degraded message を assert すること 🔵
- [x] **TC-346-03**: mutation-verified で真逆セマンティクス保存が実証されていること — mutation（ガード反転: `isFiniteMetric(errorRate) && isFiniteMetric(recoveryRate)` = finite/defined のとき degraded）適用後の run が `Tests: 7 failed, 51 passed, 58 total`（target RED 2 + cascade RED 5 = **MW-022/023 と同一 signature**）を返すこと。revert で 58/58 GREEN 復元。MW-027 エントリが台帳に追加され、監査 pin が **≥21 → ≥27**（MW-024〜027 補填で 23 → 27 エントリ）に引き上げられ GREEN であること 🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'tests/unit/monitoring/health-check-service|tests/guards/mutation-witness-ledger'`

#### REQ-352〜354: HealthCheckService NaN-routing fail-loud 化の generateRecommendations・checkLiveness 横展開（Phase 162・TASK-0248）

- [x] **TC-347-01**: silent suppress が fail-loud に置換されていること — `src/monitoring/health-check-service.ts` の `generateRecommendations()` memory 推奨ゲートが `if (isFiniteMetric(metrics.system.memoryUsagePercent)) { if (… > 85) { CRITICAL… } } else { warn + WARNING note }` 構造に置換され、`'WARNING: Memory usage metric unavailable - criticality could not be assessed'` recommendation と `[HealthCheck] memoryUsagePercent is non-finite …` warn log が投入されていること。修正前は REQ-347 が documented した browser-path memory 欠損と同一の起因が snapshot 経路（`getSnapshot().system.memoryUsagePercent` = `roundTo(heapUsagePercent(undefined, undefined))` = NaN）で到達し、`NaN > 85` の FALSE 化で CRITICAL escalation が「高くない」と区別不可能なまま silently suppress されていたこと（REQ-352・MW-028）🔵
- [x] **TC-347-02**: RED-verifying tests が追加されていること — `tests/unit/monitoring/health-check-service.test.ts` の recommendation generation describe に（a）`should push CRITICAL memory recommendation when snapshot memoryUsagePercent > 85 (REQ-352 baseline)`（heap ~94% で memory check unhealthy + snapshot `memoryUsagePercent: 90` → CRITICAL 推奨があり WARNING note が無いことを assert = guard が finite 評価を保存する baseline）、（b）`…when memoryUsagePercent is non-finite (NaN) (REQ-352)`（memory check degraded + snapshot NaN → WARNING note があり CRITICAL が無いこと）、（c）`…when snapshot memoryUsagePercent is omitted (REQ-352)`（`undefined as any` → 同 WARNING note）の 3 tests が追加されていること 🔵
- [x] **TC-347-03**: mutation-verified で真逆セマンティクス保存が実証されていること — mutation（ガード反転: `!isFiniteMetric(metrics.system.memoryUsagePercent)` = non-finite のとき閾値評価・finite のとき WARNING note）適用後の run が `Tests: 3 failed, 62 passed, 65 total`（target RED 2 = NaN/omit tests・cascade RED 1 = baseline test が finite 90 で CRITICAL ではなく note を受け取る）を返すこと。revert で 65/65 GREEN 復元・MW-028 エントリが台帳に追加され監査 pin が **≥27 → ≥30** に引き上げられること 🔵

- [x] **TC-348-01**: silent suppress が fail-loud に置換されていること — `generateRecommendations()` の pipeline 推奨ゲートが REQ-352 と同型の `isFiniteMetric(metrics.pipeline.activeRequests)` ガード + `'WARNING: Active-request count unavailable - scaling headroom could not be assessed'` note + warn log 構造に置換され、`undefined/NaN > 10` の FALSE 化による horizontal-scaling 推奨の silent suppress が解消されていること（REQ-353・MW-029）🔵
- [x] **TC-348-02**: RED-verifying tests が追加されていること — recommendation generation describe に（a）`should push the scaling recommendation when activeRequests > 10 (REQ-353 baseline)`（pipeline degraded 0.85 + `activeRequests: 15` → scaling 推奨があり note が無いこと）、（b）`…when activeRequests is non-finite (NaN) (REQ-353)`（`activeRequests: NaN` → note があり scaling 推奨が無いこと）の 2 tests が追加されていること 🔵
- [x] **TC-348-03**: mutation-verified で真逆セマンティクス保存が実証されていること — mutation（ガード反転: `!isFiniteMetric(metrics.pipeline.activeRequests)`）適用後の run が `Tests: 2 failed, 63 passed, 65 total`（target RED 1 + cascade RED 1 = baseline）を返すこと。revert で GREEN 復元・MW-029 エントリが台帳に追加されること 🔵

- [x] **TC-349-01**: fabricated dead verdict が fail-loud に置換されていること — `src/monitoring/health-check-service.ts` の `checkLiveness()` が `memoryMetricAvailable = typeof memoryUsage.heapUsed === 'number' && Number.isFinite(memoryUsage.heapUsed)` を導入し、`alive = latency < 1000 && (!memoryMetricAvailable || memoryUsage.heapUsed > 0)` で memory metric unavailable 時には sanity check を skip（latency が responsiveness signal のまま）し、alive 時の reason が `'System is responsive (memory metric unavailable: backend omitted/non-finite heapUsed)'` を明示すること。not-alive reason も原因別に誠実化（latency 超過時のみ latency reason・`heapUsed ≤ 0` 時は `Memory sanity check failed (heapUsed=…)`）されていること。修正前は `undefined > 0` / `NaN > 0` の FALSE 化で実測 latency が正常でも `"System responsiveness issue (latency: Xms)"` の偽 reason 付き alive=false（GET /health/live = restart 誘発）を返していたこと（REQ-354・MW-030）🔵
- [x] **TC-349-02**: RED-verifying tests が追加されていること — checkLiveness describe に（a）`should stay alive with the honest unavailable reason when heapUsed is omitted (REQ-354)`（`mockReturnValueOnce` で heapUsed を omit → alive=true + reason が 'memory metric unavailable' を含むこと）、（b）`…when heapUsed is non-finite (NaN) (REQ-354)`（`heapUsed: NaN` → 同判定）の 2 tests が追加されていること。既存の `should return alive=true when system is responsive`（heapUsed 正常値）と `should return alive=false on error`（throw → catch）は無変更で GREEN 維持であること 🔵
- [x] **TC-349-03**: mutation-verified で真逆セマンティクス保存が実証されていること — mutation（連言反転: `alive = latency < 1000 && (memoryMetricAvailable && memoryUsage.heapUsed > 0)` = memory metric が unavailable のとき必ず dead と判定 = 修正前の偽 verdict セマンティクス）適用後の run が `Tests: 2 failed, 63 passed, 65 total`（target RED 2・cascade なし — 既存の正常系は memoryMetricAvailable=true で影響不受）を返すこと。revert で GREEN 復元・MW-030 エントリが台帳に追加されること 🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'tests/unit/monitoring/health-check-service|tests/guards/mutation-witness-ledger'`（2 suites / 65 + pin30 GREEN）

### TC-350: specs mirror marker 契約（義務 B 前半）の drift 検出（REQ-355・Phase 163・TASK-0249）

- [x] **TC-350-01**: mirror marker 契約が適用され real specs tree が zero-viololation であること — `specs/speech-to-visuals/architecture.md` §非機能要件の実現方法 が `<!-- mirror:requirements.md#非機能要件:start tokens="60秒以内|25.2秒|2秒以内|0.5倍|37-45 FPS|20秒以内|環境変数|express-rate-limit|Helmet|Supabase" -->` … `<!-- mirror:requirements.md#非機能要件:end -->` で囲まれ、`tests/guards/specs-mirror-contract.test.ts` の real-tree test が `specs/speech-to-visuals/*.md` 全体で violation ゼロを検証すること。10 トークンは正本節（requirements.md §非機能要件）と mirror region の両方に verbatim 存在することが手動検証済みであること（REQ-355）🔵
- [x] **TC-350-02**: drift 検出ロジック自体が fixture で検証されていること — 同 test の fixture describe が（a）mirror 側 drift（正本 60秒以内・mirror 90秒以内 → `TOKEN_MISSING_IN_MIRROR`）、（b）source 側 drift（正本が 90秒以内に更新され mirror が stale → `TOKEN_MISSING_IN_SOURCE`）、（c）孤立 start / 孤立 end、（d）nest、（e）空 region、（f）正本ファイル欠落 / 節欠落、（g）節抽出の完全一致（prefix 見出し `## 非機能要件の実現方法` を誤 hit しない）の各 case を検出できること。契約自体の presence pin（architecture.md ↔ requirements.md#非機能要件 の region と 10 トークン配列の完全一致）も含まれ、marker 削除・tokens 縮小で RED になること（REQ-355）🔵
- [x] **TC-350-03**: mutation-verified で drift 検出が実証されていること — mutation（mirror region 内 `60秒以内（実績25.2秒）` → `90秒以内（実績25.2秒）` = 正本更新が mirror に未伝播の典型 drift）適用後の run が `Tests: 1 failed, 11 passed, 12 total`（real-tree zero-violation test が `TOKEN_MISSING_IN_MIRROR` 1 violation で target RED）を返すこと。revert で 12/12 GREEN 復元・MW-031 エントリが台帳に追加され監査 pin が **≥30 → ≥31** に引き上げられること（REQ-355）🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'specs-mirror-contract|mutation-witness-ledger'`（2 suites / 12 + pin31 GREEN）

### TC-351: specs mirror sync generator と sync-stamp 契約（義務 B 後半）（REQ-356・Phase 164・TASK-0250）

- [x] **TC-351-01**: sync generator と sync-stamp 契約が 23 tests で検証されていること — `tests/guards/specs-mirror-contract.test.ts` が（a）stamp 欠落 `MISSING_SYNC_STAMP`・（b）正本節への token 未宣言の編集を検出する `STALE_SYNC_STAMP`（token 検証を素通りする編集も逃さない）・（c）重複 `DUPLICATE_SYNC_STAMP`・（d）malformed 行・（e）正規化ノイズ（CRLF・行末空白）無視、および `scripts/sync-mirror-from-requirements.ts` generator の（f）stamp 挿入と冪等・（g）stale stamp の機械再生成・（h）構造違反ファイルへの fail-loud 拒否・（i）節欠落 skip・（j）重複拒否・（k）generator 出力が TASK-0249 契約の検証全体を通ること（= 受入検査）を検証すること（REQ-356）🔵
- [x] **TC-351-02**: npm scripts と gate 配線が CI teeth を持つこと — `npm run specs:mirror:check`（`--check` = 書き込まない drift detector・違反で exit 1）と `npm run specs:mirror:sync`（stamp 再生成 → post-sync 検証で残存違反 = 人手 curation が必要な token drift があれば exit 1）が `package.json` に定義され、`verify:all` と `spine:validate`（`scripts/validate-spine-manifest.ts` に hook 配線）の両方から実行されること。spine manifest が gitignored auto-gen で SKIPPED になる clean checkout でも mirror check は specs/（tracked）を対象に走り exit code に反映されること（REQ-356）🔵
- [x] **TC-351-03**: mutation-verified で sync-stamp の検出力が実証されていること — mutation（requirements.md NFR-501 `コストは $0.10 以下` → `$0.11 以下` = 10 トークンいずれでもない非 token 事実編集）適用後の run が `Tests: 1 failed, 22 passed, 23 total`（`STALE_SYNC_STAMP` 1 violation・`TOKEN_MISSING` なし = token 検証だけでは素通りする編集を stamp が検出）を返し、`specs:mirror:check` が exit 1・`specs:mirror:sync` が stamp を機械再生成して post-sync violation ゼロになること。revert + sync で 23/23 GREEN 復元・MW-032 エントリが台帳に追加され監査 pin が **≥31 → ≥32** に引き上げられること（REQ-356）🔵
  - **再検証コマンド**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'specs-mirror-contract|mutation-witness-ledger'`（2 suites / 23 + pin32 GREEN）+ `npm run specs:mirror:check`（exit 0）



### Phase 111+ 受け入れ基準サマリー

| 要件 | テストケース数 | 信頼性 |
|------|--------------|--------|
| REQ-253: リトライ5+サイクル統合 | 2 | 🔵 |
| REQ-254: CI timeout assertion | 2 | 🔵 |
| REQ-255: ESLint no-console | 2 | 🔵 |
| REQ-256: リトライ設定DI | 2 | 🔵 |
| REQ-257: シーンデュレーション統合 | 2 | 🔵 |
| REQ-258: Spine manifest CI統合 | 3 | 🔵 |
| REQ-259: Recovery silent catch修正 | 4 | 🔵 |
| REQ-260: SimpleDiagramDetector修正 | 3 | 🔵 |
| REQ-263: w/h移行完全完了 | 5 | 🔵 |
| REQ-264: diagram-detector sant guard | 4 | 🔵 |
| REQ-265: scene-segmenter sant guard | 3 | 🔵 |
| REQ-266: NaN safety検証テスト | 2 | 🔵 |
| REQ-267: テキストベースコンテンツ抽出 | 3 | 🔵 |
| REQ-268: continuous-learner destroy() | 2 | 🔵 |
| REQ-269: pearson NaNガード | 2 | 🔵 |
| REQ-270: ESLint 0エラー達成 | 3 | 🔵 |
| REQ-271: jest.mock ESM修正 | 2 | 🔵 |
| REQ-272: validateAudioFile クラッシュ修正 | 2 | 🔵 |
| REQ-273: CJKトークン化・キリル文字修正 | 2 | 🔵 |
| REQ-285: 品質モニタ diagram-type パリティ | 3 | 🔵 |
| REQ-292: 視覚化 flow/flowchart スイッチパリティ | 3 | 🔵 |
| REQ-293: qualityPresets[].{w,h,fps,q} 有限性 | 3 | 🔵 |
| REQ-294: ExportJobQueue ETA オフバイワン | 3 | 🔵 |
| REQ-295: monitoring/export/memoryLimit 有限性 | 3 | 🔵 |
| REQ-296: performance スカラー有限性 | 3 | 🔵 |
| REQ-297: stale-closure/async-setState 構造ガード | 3 | 🔵 |
| REQ-298: diagram-type-switch-parity 他ペア展開 | 2 | 🟡 |
| REQ-299: storageParser JSON.parse 非対称監査 | 2 | 🟡 |
| REQ-300: async-setState positive-case fixture | 2 | 🟡 |
| REQ-301: timestamp guard mutation-verified CI | 2 | 🟡 |
| REQ-302: AutoImprovementEngine.LOWER_IS_BETTER_METRICS 命名統一 | 2 | 🔵 |
| REQ-303: Number.isFinite 共通 sanitizer 集約提案 | 2 | 🟡 |
| REQ-304: 分析系 LLM リトライ既定値シングルソース化 | 4 | 🔵 |
| REQ-306: API 層 UUID v4 検証 regex シングルソース化 | 3 | 🔵 |
| REQ-308: 図解タイプ日本語タイトル map シングルソース化 | 3 | 🔵 |
| REQ-309: force-directed 収束述語アウトカム検証 | 2 | 🔵 |
| REQ-310: @stv/core 単一ソース・dead citation 監査 | 2 | 🔵 |
| REQ-311: @stv/core タグ pin 固定 | 1 | 🔵 |
| REQ-312: tests/guards 分割境界ピン | 1 | 🔵 |
| REQ-326: エビデンス出典 [EVIDENCE] 行 pin | 3 | 🔵 |
| REQ-328: non-null assertion census ratchet | 2 | 🔵 |
| REQ-329: storage key parity | 2 | 🔵 |
| REQ-330: mutation witness 台帳 | 2 | 🔵 |
| REQ-331: non-null assertion 撲滅・pipeline 編 | 2 | 🔵 |
| REQ-332: non-null assertion 撲滅・transcription 編 | 2 | 🔵 |
| REQ-333: non-null assertion 撲滅・export 編 | 2 | 🔵 |
| REQ-334: non-null assertion 撲滅・monitoring 編 | 2 | 🔵 |
| REQ-335: non-null assertion 撲滅・analysis 編 | 2 | 🔵 |
| REQ-336: non-null assertion 撲滅・src 全体 exact-0 + checker AST 化 | 2 | 🔵 |
| REQ-337: tests ツリー non-null assertion ディレクトリ別 ratchet | 2 | 🔵 |
| REQ-338: tests ツリー non-null assertion ratchet 単調減少ラウンド 1 | 2 | 🔵 |
| REQ-339: tests ツリー non-null assertion ratchet 単調減少ラウンド 2 | 2 | 🔵 |
| REQ-340: tests ツリー non-null assertion ratchet 単調減少ラウンド 3 | 2 | 🔵 |
| REQ-341: tests ツリー non-null assertion ratchet 単調減少ラウンド 4 | 2 | 🔵 |
| REQ-342: tests ツリー non-null assertion ratchet 単調減少ラウンド 5・tests/unit 外初回 | 2 | 🔵 |
| REQ-343: tests ツリー non-null assertion ratchet 単調減少ラウンド 6・4 ディレクトリ横断 | 2 | 🔵 |
| REQ-344: tests ツリー non-null assertion ratchet 単調減少ラウンド 7・transcription 初の dir exact-0 と空洞化チェック簡素化 | 2 | 🔵 |
| REQ-345: tests ツリー non-null assertion ratchet 単調減少ラウンド 8・node≥7 全数で tests/unit 残存最大層に初本格着手 | 2 | 🔵 |
| REQ-346: tests ratchet 終了条件（end-of-ratchet gate）spec 化と次サイクル obligation の宣言 | 3 | 🔵 |
| **合計** | **141** | **🔵 93.0% / 🟡 7.0%** |


<!-- spine:references:begin -->
## Spine: external references

- [TASK-0071: 受け入れ基準テストケースの正式検証](tasks/TASK-0071.md)
- [TASK-0077: E2Eベンチマーク200ノードレイアウト性能改善](tasks/TASK-0077.md)

<!-- spine:references:end -->
