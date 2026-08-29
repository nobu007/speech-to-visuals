# boundary strictness census（同一 metric×threshold の strict/inclusive 演算子混在）要件定義書（軽量版）

<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](../speech-to-visuals/architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-23
**要件ID**: REQ-403（Phase 203 / TASK-0287・0288・family 12）

## 概要

`diagram-detection-constants.ts` が既に 1 件正典化している divergent-operator bug —
`DiagramDetector` が `confidence >= 0.6`（0.6 は PASS）で受け入れた同じ 0.6 を
`SimplePipeline` が `confidence > 0.6` / `<= 0.6`（0.6 は FAIL）で低信頼度扱いする
境界解釈の分裂 — と同型の shape が、正典化対象の 0.6 ペア以外に tree のどこに
残っているかを**単発発見ではなく census で閉じる**要件。make-run steering
（Phase 200 feedback）の「computed float と decimal threshold の strict 比較
sweep で境界 class を census で close せよ」という META-intent の具体化。
steering が挙げた具象 symbol（TASK-0357〜0359・z-score・effect-size・difficulty
ranking）は REQ-402 interview record A4 が実証済みの cross-repo phantom だが、
class 自体は本 repo に実測 3 cluster（6 site）存在した:

| cluster | strict 側 | inclusive 側 | 境界値の到達性 |
|---------|----------|-------------|---------------|
| successRate @ 0.95 | `health-check-service.ts:434`（degraded 判定）| `api/routes/monitoring.ts:195` /health（healthy 判定）| 19/20 = 0.95（単一除算は正しく丸められ literal と完全一致）|
| successRate @ 0.8 | `health-check-service.ts:437`（`0.80` 表記）| `framework/iteration-manager.ts:680` | 4/5 = 0.8 |
| confidence @ 0.5 | `diagram-detector.ts:1037` goodConfidence | `diagram-detector.ts:1116` highConfidenceTypes filter | 1/2 = 0.5 |

演算子選択が style でない理由: ratio metric（successRate = 成功数/総数）は単一の
correctly-rounded 除算なので、threshold × 総数 が整数になる入力（19/20・4/5・1/2）
で比較値は threshold と**完全に一致**する。この入力で strict site と inclusive
site は不同意する — 同じ測定値に対して片方の endpoint が healthy・もう片方が
degraded を報告する。3 cluster は全て boundary-INCLUSIVE（`>=`）に統一した
（0.6 正典の「EQUALS this value has met the threshold」規約・detector test suite
の `toBeGreaterThanOrEqual` pin と同じ方向）。

**信頼性レベル凡例**: 🔵 実測・既存正典・実 tree 観測から確実 / 🟡 拡張仮説・妥当な推測 / 🔴 未測定

**census pin**: `<!-- census-pin:F12:boundary-operator ALLOWED 0 key / ERADICATED 3 key -->`
（guard header と本書の併記 — three-way guard が roster 実測との一致を検証）

## 関連文書

- **分析記録**: [💬 interview-record.md](interview-record.md)
- **コンテキストノート**: [📝 note.md](note.md)
- **タスク概要**: [📋 tasks/overview.md](tasks/overview.md)
- **先行正典**: `GOOD_DETECTION_CONFIDENCE_THRESHOLD`（src/analysis/diagram-detection-constants.ts・0.6 ペアの value+operator 一元化）
- **先行 guard**: REQ-395 three-way（family 登録の規約）・REQ-402 spine edge census（本 spec landing の atomicity を強制）

## 主要機能要件

### 必須機能（Must Have）

- REQ-403-001: システムは `tests/guards/boundary-operator-census.test.ts` を新設し、
  production surface（repo src/ + installed @stv/core core-four・他 census guard と
  同一の `walkProductionSurface`）を `identifier )? 比較演算子 DECIMAL literal` shape
  で sweep すること。comment 行は skip し（prose の gate 引用は decision ではない）、
  整数 literal は対象外とすること（整数は float で正確に表現できるため strict/inclusive
  分歧は別 class・`avgProcessingTime < 60000` 等は既存 operator pin の管轄）🔵 *実測 baseline: comparison site 145 / cluster 126（family 12 discovery 手法の機械的抽出）*
- REQ-403-002: システムは site を (metric identifier, **正規化 literal**, 方向) で
  cluster 化し、同一 cluster 内に strict と inclusive が両存在する場合を
  split-interpretation candidate として違反判定すること。literal は
  `String(Number(x))` で正規化し（`0.80` ≡ `0.8` — successRate @ 0.8 cluster は
  この正規化なしには不可視だった）、方向は {>,>=} と {<,<=} を区別すること
  （if-leg `>= 0.8` と else-leg `< 0.8` の相補 ladder は違反ではない）🔵 *正規化の必要性は実 cluster で実証済み*
- REQ-403-003: システムは tree を mixed-strictness cluster **exact-0** で検証し、
  ALLOWED roster は空（ALLOWED 0 key）で ship すること。新規 mixed cluster は
  分類（ genuinely 別 domain の same-token 偶然等の正当理由）か統一のいずれかを
  経るまで RED を継続すること 🔵 *REQ-391〜401 audit-pass-first census pattern の confirmed-zero pin 踏襲*
- REQ-403-004: システムは実測 3 cluster の strict 側 3 site（health-check-service
  `> 0.95` / `> 0.80`・diagram-detector `> 0.5`）を inclusive に統一して撲滅し、
  これを ERADICATED roster 3 key に pin すること（strict 表記の再出現は
  completeness + eradicated-reappear の二重 RED）。統一方向は 0.6 正典の
  boundary-INCLUSIVE 規約に従い、`/health` route と health-check-service が
  exactly-95%（19/20）で同じ verdict を返すことを negative anchor で固定すること 🔵 *cluster 実測・既存 test の境界値 fixture（0.98/0.85/0.70 は境界未満・超過のみで壊れないことを全 run で検証）*
- REQ-403-005: システムは REQ-395 three-way guard に family 12 として REQ-403 行を
  登録し（requirementsPath = 本書・`ALLOWED ${n} key` / `ERADICATED ${n} key` phrase）、
  census-pin marker `F12:boundary-operator` を guard header に併記すること 🔵 *family 5/6/7 登録（facet-5）と同一手順*
- REQ-403-006: 本 spec 一式（requirements / note / interview-record / tasks/overview /
  TASK-0287・0288）の landing は REQ-402 SPEC_LANDING_ATOMICITY を dogfood すること:
  各 file の anchor block と parent 側登録（architecture.md children 2 件・
  design-interview.md children 1 件・speech-to-visuals/note.md references 1 件）を
  同一 commit に同梱し、spine-edge census が同 commit 内で GREEN になることで
  atomicity を実証すること（sweep commit 残さず）🔵 *REQ-402-006 の踏襲・REQ-402 guard が構造的に強制*
- REQ-403-007: mutation 検証（MW-067）は (a) health-check-service `>= 0.95` の
  strict revert、(b) 未分類 file への新規 mixed cluster 注入、(c) diagram-detector
  `>= 0.5` の strict revert の 3 独立 mutation で RED を実測し、mutation-witness
  ledger に 5 列 template 行を記載して PINNED_MIN_ENTRIES を 63 に上げること 🔵 *Phase 197 で確立した実装+MW+receipt 単一 commit 同梱規約*

### 基本的な制約

- REQ-403-008: discovery の盲点は spec に明示すること — (a) LHS attribution は
  演算子直前の末尾 identifier（閉じ括弧のみ介在可。`Math.abs(correlation) > 0.7`
  は `correlation` に attribution）で、複数行 LHS や literal-on-left（`0.5 < x`）
  は対象外、(b) 文字列埋め込み比較（alert-rules の PromQL `rate(...) > 0.5`）は
  DSL/config text として対象外、(c) 整数 threshold は対象外（REQ-403-001 と同理由）。
  これらは ceiling として guard header に doc comment で宣言すること 🟡 *regex based discovery の構造上の限界の明示（sibling census と同じ誠実さの慣行）*

## 簡易ユーザーストーリー

### ストーリー1: 境界値で endpoint 間不同意の根絶

**私は** 運用監視者 **として**
**成功率 95% ぴったりの system** を見るときに
**/health route と health-check service が同じ verdict を返すことで**
**どちらの dashboard を見ても同じ健全性判断を得られる。

**関連要件**: REQ-403-004

### ストーリー2: 新規 split の即時検出

**私は** 未来の実装者 **として**
**既存 metric と同じ threshold に strict 比較を書き込んだときに**
**guard が即 RED で差し戻すことで**
**境界解釈の分裂が land する前に分かる。

**関連要件**: REQ-403-003

## 基本的な受け入れ基準

### REQ-403-001〜004: boundary-operator census guard

**Given（前提条件）**: production surface に comparison site 140+ / cluster 120+ が存在する
**When（実行条件）**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns boundary-operator-census` を実行する
**Then（期待結果）**: mixed-strictness cluster exact-0（ALLOWED 0 key / ERADICATED 3 key）で GREEN・合成 fixture が 0.6-incident shape（spelling違い・相補 ladder 陰性・括弧 attribution）を検出する

**テストケース**:

- [x] **TC-403-01**: real tree mixed cluster exact-0 + site/cluster floor pin（145/126
  baseline・`>= 140` / `>= 120`）🔵
- [x] **TC-403-02**: 撲滅 3 site の negative anchor（`successRate >= 0.95` / 
  `>= 0.8\d*` ×2・`metrics.confidence >= 0.5`・`s.confidence >= 0.5`）🔵
- [x] **TC-403-03**: liveness — `0.80`/`0.8` spelling違い同一 cluster 検出・相補
  ladder（`>=`/`<`）不検出・別 metric 同 threshold 不検出・`Math.abs(x)` 括弧
  attribution・comment 行 / 整数 threshold 対象外 🔵
- [x] **TC-403-04**: three-way REQ-403 行 GREEN（ALLOWED 0 key / ERADICATED 3 key
  phrase 一致）・authority list 8 family 🔵

### REQ-403-006: atomic landing の dogfood

**Given**: 本 spec 一式が未登録の状態
**When**: spine-edge census を実行する
**Then**: `PARENT_UNREGISTERED` で RED → parent 側 4 登録を同 commit で追加すると GREEN

### REQ-403-007: MW-067 mutation 検証

**Given**: guard が GREEN の tree
**When**: 3 独立 mutation（strict revert ×2・新規 mixed cluster 注入）を適用する
**Then**: 各 mutation で census が RED（completeness / eradicated-reappear /
negative anchor）・revert で GREEN 復元

## 最小限の非機能要件

- **性能**: census は production surface 全走査（regex 行 scan のみ）で秒単位。
  guard suite の実行時間を増やさない
- **保守性**: guard は既存 `freeze-guard` helper（`readSource` /
  `isCommentLine` / `walkProductionSurface`）のみに依存し、純関数の discovery
  primitive は export して liveness test が合成 fixture で検証。実装は tests/
  配下（規模集計の実装予算外）
