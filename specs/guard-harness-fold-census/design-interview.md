# guard-harness-fold-census 設計自動分析記録


<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals 設計自動分析記録](../speech-to-visuals/design-interview.md)
>
> - parent: `speech-to-visuals/design-interview.md`
> - role: `system`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-18
**分析実施**: kairo-design step4 既存情報ベースの差分分析と自動統合
**対象**: [requirements.md](requirements.md)（commit 16cb18aa で確定済み）

## 分析目的

要件定義・既存設計（specs/speech-to-visuals/architecture.md の round 記録・
freeze-guard レジストリ運用方針）・既存実装（tests/guards/ 42 family・
round 46〜50 の 5 single-source test）を照合し、要件が「設計フェーズで
確定」とした残課題（interview-record.md A5: harness data row の最終
TypeScript 型形状）を含む全設計判断を確定した。

## 分析項目と判断

### A1: harness の層割り — どの層を data row 化するか

**分析日時**: 2026-08-18
**カテゴリ**: アーキテクチャ
**背景**: per-family test は 3 層構造（Layer 1 verbatim oracle / Layer 2
semantic pin / Layer 3 source anchor）で、REQ-001 が「機械的層の row 化」
を要求するが、層の選定根拠が要件に明示されていない。

**判断**: Layer 1 + Layer 3 のみ row 化、Layer 2 は手書き残置。
**根拠**: round 50 grid-packing test（440 行）の実解剖 — Layer 1 は
「corpus × 2 関数の等価比較」、Layer 3 は「readSource + 計数」で完全に
機械的。一方 Layer 2 は LIVE witness（MatrixStrategy {x:460,y:510}）・
クランプ証人など family 固有の意味論で、data row 化すると型が
「任意の assertion」に発散する。REQ-004 も「Layer 2 pin は per-family
test に残る」と明記済み。

**信頼性への影響**:
- architecture.md D1 を 🔵 で追加（要件明示 + 実装解剖の双方の根拠）。

---

### A2: census 数値の再ベースライン — 要件表 32 と実測 30 の乖離

**分析日時**: 2026-08-18
**カテゴリ**: データモデル
**背景**: REQ-404 が「ドキュメント記載数値と guard pin は同一コマンド由来」
を要求するが、要件表の census 数値（C1 = 32 match / 20 file）は素朴
grep（コメント行込み）由来で、guard engine（コメント行除外）と数え方が
異なる。そのまま pin すると guard が常時 RED になる。

**判断**: census pin は engine 由来の数値で**再ベースライン**する
（C1 = 30 match / 20 file・コード行ベース 2026-08-18 実測）。要件表の
該当 cell は実装 Phase 2 でマーカー付きで更新。C2（1920/1080）は
素朴検索だと preset map（`'1080p': {width:1920,...}`）・
`production-config.ts:352`・`Video.tsx:54` 等の異概念行まで捕まえるため、
「config object 既定値」形状への pattern 精密化 + excludeLinePatterns
を先に行ってから pin する（実装時確定）。
**根拠**: 設計フェーズでの直接実測（grep + 既知 site の sed 確認。
pipeline-orchestrator.ts:191,211-212・main-pipeline.ts:126-127・
simple-pipeline.ts:114-115・production-exporter.ts:138-139 で直書き実在）。
C1 差分 2 match はコメント行。C3（4/1・OverlapResolver.ts:257-260）・
C4（1/1・advanced-layouts.ts:537）・C5（1/1・edge-crossing-minimizer.ts:336）
は要件表と一致。

**信頼性への影響**:
- D7 を 🔵 で追加。C2 の再計測のみ 🔴（実装時確定）だが項目全体は
  実測に基づくため architecture.md の信頼性集計では D7 🔵 に内包。
- EDGE-002（要件表 pin と guard pin の乖離）の解消方法を具体化。

---

### A3: fingerprint の機械化 — it.each 249 case の折りたたみ問題

**分析日時**: 2026-08-18
**カテゴリ**: 技術選択
**背景**: default-node-extent test の Layer 1 は `it.each(NODE_CORPUS)`
（249 case × 4 expect = 996 expectation）で、row 化すると 1 it の corpus
ループに折りたたむ必要がある。「差分は理由明記のみ」（TC-004-01）と
等価証明の両立方法が要件で確定していなかった。

**判断**: 等価の尺度を **expectation 数**（assertion 呼び出し数）に置く。
`countExpectations(row)` を純関数で定義し、object-is row = corpus 長 /
delta row = corpus 長 + 1（witness）/ anchor row = 1。
`harness-fingerprint.test.ts` が `family:rowId:expectations` 列挙を pin。
it.each → ループの折りたたみは test 名列挙の変化だが expectation 総数
（996）は保存され、「it.each を corpus ループ 1 it に折りたたみ」という
理由記載付きで許容。それ以外の差分（row 削除・corpus 縮小・mode 変更）は
列挙変化 = RED。
**根拠**: round 35 registry 分割の fingerprint 手法（id 列挙 + pattern
shape + before/after diff）の適用。TC-004-E01（corpus 縮小変異）を恒久
guard に昇格する形。

**信頼性への影響**:
- D6 を 🔵 で追加。interfaces.ts に FingerprintEntry / countExpectations
  を型定義（要件残課題の解決）。

---

### A4: ban scope の保存 — r49 の source-scope ban をどう移行するか

**分析日時**: 2026-08-18
**カテゴリ**: アーキテクチャ
**背景**: default-node-extent の ban は `expect(src).not.toMatch(RAW_PAIR_W)`
（source scope・コメント込み）だが、round 49/50 の GOTCHA では委譲
コメントが retired 形状を引用して code-scope ban が自爆した例がある。
既定をどちらにするかで移行の等価性が変わる。

**判断**: 既定 scope = 'code'（自爆回避）。ただし**移行時は元 test の
scope を正確に保存**（r49 の source-scope ban は 'source' で移行）—
REQ-401（等価移行）優先。新規 family は 'code' 推奨。
**根拠**: grid-packing test:346,353,368,384,400 の `codeLines(...).some(...)`
（code scope）と default-node-extent の `expect(src).not.toMatch(...)`
（source scope）の実形状比較。

**信頼性への影響**:
- D3 を 🔵 で追加。AnchorScope 型を interfaces.ts に定義。

---

### A5: doc-pin マーカー機構 — REQ-404 をどう機械検証するか

**分析日時**: 2026-08-18
**カテゴリ**: データモデル
**背景**: 「ドキュメント記載数値と guard pin は同一コマンド由来」は要件
上の規律だが、doc 更新と pin 更新は別 commit になり得るため、規律だけでは
逆方向（doc のみ更新）の乖離を検出できない。

**判断**: requirements.md census 表に `<!-- census-pin:C1:sites=30:files=20 -->`
形式の HTML コメントマーカーを埋め、fold-census-guard.test.ts が
engine 実測・data pin・doc マーカーの 3 者一致を検証。マーカーは
Markdown レンダリングに影響しない。
**根拠**: D9 設計判断（source-anchor 規律の doc 版。freeze-guard の
readSource を要件ファイル読み取りにも再利用）。

**信頼性への影響**:
- D9 を 🟡 で追加（要件の規律を機械化する新規機構だが構成要素は既存）。
- CensusPinMarker 型を interfaces.ts に定義（🟡・形式は実装時確定）。

---

### A6: 既存設計との差分・統合判定

**分析日時**: 2026-08-18
**カテゴリ**: アーキテクチャ
**背景**: kairo-design step4 は既存設計との重複・統合判定を要求する。

**判断**: 統合対象（merge_targets）= **なし（完全再利用・新規追加のみ）**。
**根拠**:
- `specs/speech-to-visuals/architecture.md`（親正本・1,057 行）: round 8〜50
  の記録と「freeze-guard レジストリ運用方針」を含む。本 feature はこの
  運用方針の**拡張**（per-family test の機械的層の data row 化 + census）
  であり、親記録の改竄ではなく子 feature として追加。spine anchor
  （parent / role: detailed / status: canonical_child）で接続。
- `specs/finite-safe-aggregation/*`: 様式手本として参照（D 番号設計判断・
  spine anchor block・信頼性サマリー）。内容の重複なし。
- legacy `docs/design/` 配下に本 feature と同一責務の設計は存在しない
  （tests/guards 系の設計書は specs/ 正本のみ）。
- database-schema.sql / api-endpoints.md: 対象外（test-infra で DB・API
  なし — 要件の機能範囲が tests/guards/ と .github/workflows/ のみ）。

**信頼性への影響**:
- 統合 0 件・新規 4 file（architecture / dataflow / design-interview /
  interfaces）。既存ファイルの変更は requirements.md への census-pin
  マーカー追記（実装 Phase 2）のみ。

---

## 分析結果サマリー

### 確認できた事項

- registry data-row 化（round 35）と per-family test 手書き層（round
  46〜50）の実測構造 — harness 化対象は後者の Layer 1+3 のみ。
- census 実測: C1 = 30 match / 20 file（コード行）・C3 = 4/1・C4 = 1/1・
  C5 = 1/1。C2 は pattern 精密化が前提。
- C1 の契約差: `src/utils/guards.ts` clampFinite は NaN→min、bare 形は
  NaN 透過 — 「実挙動変更必要」分類の根拠。
- CI green run 4 件（HEAD c7fe762d で 11/11 job ✓）・
  infrastructure.yml:37 のみ node 18 残留。
- `@tests` alias → `<rootDir>/tests`・codeLines 重複は 2 file
  （grid-packing / default-node-extent）。

### 設計方針の決定事項（D1〜D11 — architecture.md 参照）

- D1: Layer 1+3 のみ row 化 / D2: delta は witness 強制 /
  D3: ban 既定 'code'・移行は scope 保存 / D4: retired 式は test 内残置 /
  D5: 2 段 fail-loud / D6: expectation 数の解析的 pin /
  D7: census は code-line 再ベースライン / D8: ratchet 両方向 + 行残置 /
  D9: doc-pin マーカー 3 者突合 / D10: 移行は 2 family のみ /
  D11: CI 証拠は interview-record A3 正本

### 残課題（実装 phase で解消）

- C2（1920/1080）の pattern 精密化後の再計測・pin 確定（Phase 2）。
- census-pin マーカーの要件表への追記と 3 者突合の初回 GREEN（Phase 2）。
- 本 feature 実装 commit の CI green run URL+SHA を A3 記録へ追記（Phase 3）。

### 信頼性レベル分布

**分析前**（要件段階の想定）:

- 🔵 青信号: 18（要件明示項目）
- 🟡 黄信号: 6（設計判断必要と要件が明示した項目）
- 🔴 赤信号: 3（census 再計測・fingerprint 具体・doc-pin 機構）

**分析後**（4 設計文書の集計）:

- 🔵 青信号: 62 (+44)
- 🟡 黄信号: 6 (±0 — D8/D9・ Phase 構成・excludeLinePatterns・
  CensusPinMarker 等、いずれも構成要素は既存実装由来)
- 🔴 赤信号: 0 (−3 — 実測と型化で解消)

## 関連文書

- **アーキテクチャ設計**: [architecture.md](architecture.md)
- **データフロー**: [dataflow.md](dataflow.md)
- **型定義**: [interfaces.ts](interfaces.ts)
- **要件定義**: [requirements.md](requirements.md)
- **受け入れ基準**: [acceptance-criteria.md](acceptance-criteria.md)
- **要件分析記録**: [interview-record.md](interview-record.md)
