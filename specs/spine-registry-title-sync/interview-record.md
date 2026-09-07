# spine registry title-sync census — 自動分析記録

<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals 設計自動分析記録](../speech-to-visuals/design-interview.md)
>
> - parent: `speech-to-visuals/design-interview.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-25
**分析実施**: step4 既存情報ベースの差分分析と自動統合

## 分析目的

make-run steering の今期指摘 3 件（make-run コミット分割単位・EDGE-130
multi-token coverage bonus・EDGE-131/132 hidden-value 漏洩 channel 洗い出し）
のうち本 repo で実体があるものを確定し、REQ-402 spine edge census が検証
対象外として残した「registry entry 表題」の gap を閉じる要件の前提を確定
する。

## 分析項目と判断

### A1: steering 指摘の repo 実在性（phantom triage）

**カテゴリ**: 優先順位
**背景**: steering の具名 symbol（EDGE-130・EDGE-131・EDGE-132・
SampleDetailModal・「ヨガ体験予約フォーム」）が本 repo に存在するか。

**判断**: `grep -rn` を src/ + tests/ + specs/ に実行（2026-08-25 再実施）—
ヒット 0 件。EDGE-130/131・SampleDetailModal は他 hub repo 由来の cross-repo
contamination（REQ-405 interview-record A1 と同一結論・再確認）。make-run の
コミット分割単位指摘のみ本 repo に観測可能な帰結（`chore(make-run): commit
N remaining change(s)` commit 2 件: c818286f・47d71cd5）を持つ。

**根拠**: grep 実行結果（no hits）+ `git log --oneline | grep make-run`。

**信頼性への影響**: 今期の作業対象を「sweep commit class の構造的遮断」に
確定。EDGE-130/132 系の META-intent（可視 channel 間の表記一貫性）は
REQ-406 の表題 sync が同型の答案として部分接続する。

---

### A2: 事故の一次資料と反実仮想

**カテゴリ**: アーキテクチャ
**背景**: REQ-402 は「登録の存在」を強制したのに、なぜ 47d71cd5 の sweep
commit がstill発生したのか。guard が事前に存在し得たか。

**判断**: 47d71cd5 の diff は (1) 子 spec 表題の同期・(2) children 並び順の
REQ 順正規化・(3) design-interview.md 側の参照順修正からなる。その親
90c924db（REQ-404 本体 commit）の tree を実測すると architecture.md
children に表題 drift **2 件**（boundary: index `boundary strictness（混在
演算子）census …` vs 子 H1 `boundary strictness census（同一
metric×threshold の strict/inclusive 演算子混在）…`・rounding 側も同様）が
存在した。つまり 47d71cd5 は「存在した drift の修復」であり、REQ-406 の
title-sync 検証があれば 90c924db は RED = 改題と index 同期が同一 commit
に揃うまで landing 不可能だった。並び順（diff の(2)(3)）は本契約の対象外
（REQ-406-007）— 正規性より「表題が実 doc を指す」ことを優先し、順序は
人間規約に残す。

**根拠**: `git show 90c924db:specs/speech-to-visuals/architecture.md` と
`git show 90c924db:specs/{boundary-operator,rounding-mode}-census/requirements.md`
の実測比較。

**信頼性への影響**: REQ-406-001〜003 を 🔵 で確定（反実仮想は一次資料で
検証済み・撲滅ではなく confirmed-zero 固定 + 再出現 ban）。

---

### A3: discovery の全数計測（confirmed-zero の根拠）

**カテゴリ**: データモデル
**背景**: 現 tree に表題 drift / H1 欠落が何件あるか。撲滅を伴う要件か。

**判断**: specs/** の全 registry block（children + references）を walk し、
entry 表題と対象 doc の最初の H1 を比較した結果: **entry 112 件中 drift
0 件・H1 欠落 0 件**。47d71cd5 が正規化を完了済みのため confirmed-zero
pin 戦略（REQ-394/396/397/399 踏襲）を採る。撲滅 commit は不要で、本要件
の src/ 変更はゼロ（read-only census）。

**根拠**: /tmp 計測 script（guard の firstHeading と同一規則）の実行結果。

**信頼性への影響**: REQ-406-002 の floor pin（titleChecked >= 112）を 🔵 で
確定。本 spec landing で 4 entry 追加され 116 になる。

---

### A4: 検証 silent skip の検出器（titleChecked 計数）

**カテゴリ**: 技術選択
**背景**: confirmed-zero guard の恒久の弱点は「検証自体が何も検出しなくなる
rot」（検出条件の拡大・対象読みの変更）ですべて GREEN のまま沈黙すること。

**判断**: audit report に「表題比較まで実施した entry 数」を `titleChecked`
として計上し floor pin する。検証対象の喪失は違反ではなく計数の落下として
検出する。REQ-405 の site/cluster floor pin（検出側の在庫 pin）の検証側
適用であり、filesChecked/anchorEdges/registryEntries pin（REQ-402）の
第 4 項目として追加する。

**根拠**: REQ-402 の inventory pin 実装との対称性。

**信頼性への影響**: REQ-406-002 に計数契約を同梱（🟡 → 実装と最初の RED
検証で 🔵）。

---

## 分析結果サマリー

### 確認できた事項

- steering 具名 symbol は cross-repo contamination（再確認）・実体がある
  のは make-run コミット分割指摘のみ
- 90c924db に表題 drift 2 件が実在し、47d71cd5 がその sweep 修復だった
  （guard があれば RED だった反実仮想を実測で確認）
- 現 tree は 112 entry 全て表題一致（confirmed-zero・src 変更ゼロ）

### 設計方針の決定事項

- REQ-402 guard への violation kind 2 件追加（TITLE_DRIFT / H1_MISSING）+
  `titleChecked` 計数契約
- 表題は H1 全文一致・children/references 両適用・並び順は契約外
- 撲滅なし confirmed-zero pin + MW-070 で teeth 実証（3 mutation）

### 残課題

- hub 側 doc-spine engine が `_doc_spine.yml` から registry block を再生成
  する際の表題出典（manifest の title field）が H1 と乖離する設計の場合、
  make-run 実行のたびに本 guard が RED になる — その時点で hub 側の表題
  出典を H1 に合わせる修正が要求される（本 repo では対処不可・REQ-406-007
  に明記）

### 信頼性レベル分布

**分析前**: 推定のみ（🔴 中心 — 指摘の実在性・drift の有無とも未測定）

**分析後**:

- 🔵 青信号: 5（A1〜A4 の実測判断・confirmed-zero baseline）
- 🟡 黄信号: 1（A4 の計数契約 → 実装後に 🔵 化）
- 🔴 赤信号: 0

## 関連文書

- **アーキテクチャ設計**: [architecture.md](../../speech-to-visuals/architecture.md)
- **要件定義**: [requirements.md](requirements.md)
- **コンテキストノート**: [note.md](note.md)
- **タスク概要**: [tasks/overview.md](tasks/overview.md)
