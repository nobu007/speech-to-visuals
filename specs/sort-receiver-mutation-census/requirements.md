# sort-receiver-mutation census（破壊的配列操作の receiver 判別）要件定義書（軽量版）

<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](../speech-to-visuals/architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-25
**要件ID**: REQ-407（Phase 211 / TASK-0293・0294 に続く TASK-0295・0296・audit-pass-first census series family 16）

## 概要

`.sort()` / `.reverse()` は他の配列 read と異なり **receiver 自身を返す**。
`return items.sort(byX)` は caller の引数をその場で並べ替えて返す —
「sorted view を計算したつもり」が「共有入力の破壊的 mutation」になる。
本要件はこの **receiver 判別**（fresh-producer 形 vs in-place dotted 形）を
production surface 全数で census する family 16 である。

実測（Phase 211 discovery・本 spec landing 前）:

- `.sort(` site **74 件**（@stv/core core-four 含む production surface）うち
  in-place（dotted receiver）**24 件** — 全 site が LOCAL-BUILT（同一 function
  内で構築した accumulator / `Array.from`・`filter`・spread copy の格納変数）または
  OWN-FIELD（priority queue・学習済み strategy table など persistent order が
  状態そのもの）と判定され、**aliased-input（caller 引数・外部 object field を
  無断で並べ替える）site は 0 件** — confirmed-clean（ALLOWED 24 key /
  ERADICATED 0 key・family 8/9/15 lineage の confirmed-roster pin）
- `.reverse()` は 2 site とも copy 形（`[...this.errorQueue].reverse()`・
  `[...this.deadLetterQueue].reverse()`）— in-place **exact-0**
- comparator-less `.sort()`（辞書順 default trap: `[10,9,100].sort()` →
  [10,100,9]）は production surface **exact-0**（`__tests__` のみ）

23 件目の発見が census の存在理由を実証した: 手動 grep による受見では
`export-artifact-store` の `entries`・`improvement-detector` の
`opportunities`・`LayoutOptimizer` の `nodes`（spread copy 格納変数）の
3 site を分類漏れしており、guard の初回 RED がこれを捕捉した。**分類の
網羅は口約束では成立しない** — exact both-ways roster が未来の新規
in-place site を必ず RED にする歯になる。

**信頼性レベル凡例**: 🔵 実測・既存正典・実 tree 観測から確実 / 🟡 拡張仮説・妥当な推測 / 🔴 未測定

## 関連文書

- **分析記録**: [💬 interview-record.md](interview-record.md)
- **コンテキストノート**: [📝 note.md](note.md)
- **タスク概要**: [📋 tasks/overview.md](tasks/overview.md)
- **先行正典**: REQ-405 fallback-default census（値のでっち上げ面）・REQ-403 boundary-operator census（入力解釈面）・REQ-404 rounding-mode census（出力丸め面）— 本要件は**操作対象の aliasing 面**
- **roster 規約**: REQ-395 census-artifact three-way（family 16 登録・phrase 一致）
- **landing 規約**: REQ-402 SPEC_LANDING_ATOMICITY・REQ-406 title-sync（本 spec landing が両方を dogfood）

## 主要機能要件

### 必須機能（Must Have）

- REQ-407-001: システムは discovery primitive を guard に export すること:
  `discoverDestructiveArraySites(rel, content)` は `.sort(` / `.reverse(` 全
  call site を抽出し、call 直前の text から receiver を判別する — bare dotted
  chain（末尾 `?` の optional-call 形含む）は `inPlace: true` + chain text、
  `)` / `]` 終端（spread literal・producer 呼び出し・index access）は
  `inPlace: false`。行頭 `.sort(` の chain continuation は前の非 comment 行
  の tail から receiver を解決する（≤3 行 look-back）。`.sort()` の
  comparator-less 形を `comparatorless` flag で計上すること 🔵 *実測 74/24/2/0 の出所・liveness fixture 8 例で境界検証*
- REQ-407-002: システムは実 production surface を **roster exact both-ways**
  で検証すること: (a) 発見された全 in-place `.sort(` site が ALLOWED roster
  に key（`file:line:receiver`）+ 理由付きで存在、(b) roster の全行が実 site
  に対応（stale row は RED）。floor pin（sort site >= 72・in-place >= 24・
  reverse >= 2）で walk/regex の silent rot を計数落下として検出すること 🔵 *実測 baseline 74/24/2（初回 RED が手動分類漏れ 3 site を捕捉した実績付き）*
- REQ-407-003: システムは `.reverse()` の in-place 形を **exact-0** で検証し、
  両 live site の copy 形（`[...this.errorQueue].reverse()`・
  `[...this.deadLetterQueue].reverse()`）を negative anchor で固定すること 🔵 *実測 2 site とも copy 形*
- REQ-407-004: システムは comparator-less `.sort()` を production surface で
  **exact-0** で検証すること（辞書順 default trap の構造的遮断）🔵 *実測 0 件（test file のみ）*
- REQ-407-005: システムは合成 fixture で検出 liveness を検証すること:
  (a) param の in-place sort（incident shape）の receiver 抽出、(b) fresh
  producer 4 形（spread / map / Array.from / Object.entries）の非捕獲、
  (c) 跨ぎ行の chain continuation 解決、(d) producer 前行からの produced
  判定、(e) optional-call `x?.sort(`、(f) `this.field` chain、
  (g) comparator-less 計上 + reverse の receiver 判別、(h) comment 行 skip +
  index access の produced 分類（documented ceiling）🔵 *8 fixture*
- REQ-407-006: mutation 検証（MW-071）は実 tree への 3 独立 mutation —
  (a) canonical fresh 形の in-place 化（`[...values].sort` → `values.sort` =
  percentile 計算が caller の samples を破壊する incident 再現）、
  (b) roster 対象 site の receiver rename（completeness + stale-row の二重
  捕捉）、(c) copy 形 reverse の in-place 化（axis 2 単独発火）— で RED を
  実測し、mutation-witness ledger に section + appendix 行を記載して
  PINNED_MIN_ENTRIES を 66→67 に上げること 🔵 *Phase 197 で確立した実装+MW+receipt 単一 commit 同梱規約*
- REQ-407-007: 本 spec 一式（requirements / note / interview-record /
  tasks/overview / TASK-0295・0296）の landing は REQ-402
  SPEC_LANDING_ATOMICITY と REQ-406 title-sync を dogfood すること:
  anchor block と parent 側登録（architecture.md children 2 件・
  design-interview.md children 1 件・speech-to-visuals/note.md references
  1 件）を guard・MW・ledger と**同一 commit** に同梱し、登録前に
  spine-edge census が `PARENT_UNREGISTERED` で RED になることを実測して
  から登録して GREEN にすること（index 表題は対象 doc の H1 と全文一致）🔵 *REQ-403〜406-005/007 の踏襲*
- REQ-407-008: census-artifact three-way へ family 16 を登録すること
  （REQ-407 行・requirementsPath = 本 spec・authority list 11 family）。
  本 spec は measured roster から build された句 `ALLOWED 24 key` /
  `ERADICATED 0 key` を宣言すること 🔵 *REQ-395 promoted condition の適用*

### 基本的な制約

- REQ-407-009: 本契約の管轄外を guard header doc comment に明示すること —
  (a) index access receiver（`arr[0].sort`）は produced 分類になる
  （発見から逃れる ceiling・現存 0 件）、(b) receiver は call 行または ≤3 行
  の continuation から可視なもののみ（より離れた文で計算された receiver は
  bare identifier として in-place 計上され roster 判定対象になる — 目的どおり）、
  (c) `.toSorted(` / `.toReversed(`（copy API）は scope 外、(d) comparator
  の意味面（NaN operand・direction・tie-breaker）は丸め/境界 family の管轄 🟡 *契約範囲の明示（sibling census と同じ誠実さの慣行）*

## 簡易ユーザーストーリー

### ストーリー1: sorted view と shared input 破壊の混同遮断

**私は** pipeline 実装者 **として**
**sorted view を計算するつもりで書いた `.sort(` が**
**receiver 判別 census で in-place 形として RED に差し戻されることで**
**caller の配列を無断並べ替える事故を landing 前に止められる。

**関連要件**: REQ-407-001・REQ-407-002

### ストーリー2: 分類の網羅が口約束でなくなる

**私は** 未来の実装者 **として**
**in-place sort site を追加したときに**
**completeness が未分類 site を列挙し LOCAL-BUILT / OWN-FIELD / defect の
判断を強制することで**
**24 site の confirmed-roster が現状の正しさの固定ではなく未来の検査台帳になる。

**関連要件**: REQ-407-002

## 基本的な受け入れ基準

### REQ-407-001〜005: receiver 判別 census の検出と固定

**Given（前提条件）**: production surface に 74 の `.sort(` と 2 の `.reverse(` が存在する
**When（実行条件）**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns sort-receiver-mutation-census` を実行する
**Then（期待結果）**: in-place 24 site 全て roster 分類済み（exact both-ways）・`.reverse()` in-place exact-0・comparator-less exact-0・合成 fixture 8 例 GREEN

**テストケース**:

- [x] **TC-407-01**: discovery authority（floor pin 72/24/2）+ roster exact both-ways 🔵
- [x] **TC-407-02**: axis 2（reverse in-place exact-0）+ copy 形 negative anchor 2 件 🔵
- [x] **TC-407-03**: axis 3（comparator-less production exact-0）🔵
- [x] **TC-407-04**: liveness fixture 8 例（incident shape・fresh 4 形・continuation・optional-call・comment/index ceiling）🔵
- [x] **TC-407-05**: canonical 形 negative anchor（fresh view sort 3 件 + OWN-FIELD 2 件の spelling 固定）🔵

### REQ-407-006: MW-071 mutation 検証

**Given**: guard が GREEN の tree
**When**: 3 独立 mutation（fresh 形の in-place 化 / roster receiver rename / reverse copy 形の in-place 化）を適用する
**Then**: 各 mutation で census が RED（completeness / completeness+stale-row / axis-2）・revert で GREEN 復元

### REQ-407-007: atomic landing の dogfood

**Given**: 本 spec 一式が parent 側登録なしの状態
**When**: spine-edge census を実行する
**Then**: `PARENT_UNREGISTERED` ×4 で RED → parent 側 4 登録（表題 = 対象 doc H1 と全文一致）を同 commit で追加すると GREEN

## 最小限の非機能要件

- **性能**: 追加検証は既存 sweep の行 scan のみ（file 再読みなし）。guard suite の実行時間を増やさない
- **保守性**: discovery primitive は純関数として export し合成 fixture で境界を検証。src/ 変更はゼロ（read-only census・spec と guard と ledger のみ）
