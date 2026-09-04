# stochastic-layout-seeding 設計自動分析記録


<!-- spine:anchor:begin -->
> **Spine anchor**: [Speech-to-Visuals システム憲法 V2.8](../../SYSTEM_CONSTITUTION.md)
>
> - parent: `SYSTEM_CONSTITUTION.md`
> - role: `feature_root`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-15
**分析実施**: step4 既存情報ベースの差分分析と自動統合

## 分析目的

round 16（2f98ef29）で先送りされた stochastic レイアウト戦略のシード化について、実装・テスト・registry の現状を確認し、次ラウンドの設計を確定する。

## 分析項目と判断

### A1: 先送り分の実在確認とサイト総数

**カテゴリ**: アーキテクチャ
**背景**: registry round-16 エントリの例外宣言が実態と一致するか。

**判断**: 一致する。`grep -rn "Math.random(" src/visualization/` で実コード 19 箇所（complex-engine id 含む）+ layout-rng.ts コメント内言及。例外 5 ファイルすべてに実在サイトあり、ファントムではない。
**根拠**: 実測 grep、`tests/guards/frozen-literal-rules.ts:387-423`。

**信頼性への影響**: 対象サイト表を 🔴 から 🔵 に確定（実測値）。

---

### A2: シードテキストと RNG 生成パターンの共通化

**カテゴリ**: アーキテクチャ
**背景**: r16 の 3 サイトがどうシードを切っているか、踏襲可能か。

**判断**: `createLayoutRng(nodes.map(n => n.id).join('|'))` を generate エントリで 1 回生成するパターンが 3 サイト（enhanced-zero-overlap-layout.ts:597, 1120 / NetworkLayoutStrategy.ts:94）で確立済み。複雑エンジンのみ `mulberry32(seedFromString(...))` の直呼び（693 行）。踏襲する。
**根拠**: 上記行の実装。

**信頼性への影響**: D1（生成箇所と寿命）を 🔵 で確定。`this` 保持禁止は規則の新規定のため 🔴。

---

### A3: 既存設計（specs/speech-to-visuals）との重複・統合判定

**カテゴリ**: アーキテクチャ
**背景**: Kairo 手順上、既存 design 群との統合判定が必要。

**判断**: `specs/speech-to-visuals/architecture.md` はシステム全体設計、本 feature は可視化エンジン内の限定変更 → **分割統合ではなく新規 feature ディレクトリ**（`specs/stochastic-layout-seeding/`）で親設計へリンクする形が適切。`docs/design/` 配下に該当設計なし（docs/ は architecture/, analysis/, llm-wiki/ 等で本件を直接扱う文書なし）。
**根拠**: `ls specs/ docs/` 実測。

**信頼性への影響**: なし（配置方針の確定のみ）。

---

### A4: complex-layout-engine.ts:847（layout id の Math.random）の扱い

**カテゴリ**: データモデル
**背景**: registry 例外コメントは「identity field, not geometry」として除外している。シード化対象に含めるか。

**判断**: **含める**。理由: (1) 出力 JSON に現れるため全体 JSON ゴールデン比較を非決定にする、(2) 同ファイル 693 行に既に rng があり流用コストがゼロ、(3) 例外を 1 つ残すと registry の「実コード 0」終着点が曖昧になる。
**根拠**: 847 行実装、693 行の既存 rng。

**信頼性への影響**: D4 を 🔵 で確定。`grep -rn "\.layoutId\|layout\.id" src/`（test 除外）で consumer なしを実測確認済み。

---

### A5: note.md / tasknote 生成の省略

**カテゴリ**: プロセス
**背景**: 手順 step3 は note.md 不在時に `/tsumiki:kairo-tasknote` の実行を求める。

**判断**: 当該スキルは本実行環境のスキル一覧に存在しないため省略し、本 analysis record が文脈の代替を担う。技術スタック・開発コマンドは AGENTS.md / プロジェクトメモリで既知。
**根拠**: 実行環境のスキル一覧。

**信頼性への影響**: なし。

---

### A6: 既存位置ピンテストの破壊リスク

**カテゴリ**: テスト
**背景**: 振る舞い変更（behavior change）により既存スナップショット/ピンが壊れるか。

**判断**: 実装時に各戦略の既存 suite を先に走らせ、壊れたピンは「新決定出力への意図的な張り替え」として更新する。事前洗い出しは本設計では行っていないため 🟡。
**根拠**: acceptance criteria にフルスイート GREEN を組み込み済み。

**信頼性への影響**: 互換性制約を 🟡 で明示。

---

## 分析結果サマリー

### 確認できた事項

- 例外宣言 5 ファイルすべてに実在する `Math.random()` サイト（計 19 箇所）
- r16 確立済みのシード化パターン（ids.join('|') + generate 内ローカル rng）
- registry 例外の段階縮退という既存キャンペーン運用
- complex-engine に既存 rng（693 行）があり id シード化は流用可能

### 設計方針の決定事項

- family ごと 5 コミット、各 RED-verified オラクル付き、`behavior change:` 明記
- rng は generate 単位ローカル、`this` 保持禁止、1 generate 1 インスタンス
- SA は 6 サイト一括（部分シード化禁止）
- complex-engine id 例外も削除し registry を実コード 0 で閉じる

### 残課題

- 既存位置ピンテストの張り替え範囲（実装時スイート実行で判明）
- 品質ガードのシードバリアント数（設計は 3、実装時に増減可）

### 信頼性レベル分布

**分析前**（指示段階）: 🔵 0 / 🟡 0 / 🔴 5想定項目

**分析後**: 🔵 +11 / 🟡 2 / 🔴 1（D2 呼び出し順序規則）

## 関連文書

- **アーキテクチャ設計**: [architecture.md](architecture.md)
- **データフロー**: [dataflow.md](dataflow.md)
- **親設計**: [../speech-to-visuals/architecture.md](../speech-to-visuals/architecture.md)
