# dead-idiom batch census（複数 confirmed-zero イディオム class の一括 pin）要件定義書（軽量版）

<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](../speech-to-visuals/architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-25
**要件ID**: REQ-410（Phase 217 / TASK-0301・audit-pass-first census series family 19・**batch 形式**）

## 概要

make-run steering（REQ-405 採点後）の指示: family 15/16 はいずれも violation
ゼロの confirmed-zero pin に 6 file の spec + 2 phase + MW entry を投下しており
投資対効果が低下している。**要件化の前に discovery sweep を先走らせ**、
mixed cluster ゼロの class は複数を 1 つの軽量 batch guard（kind 追加のみ・
spec は軽量）にまとめ、実違反が計測された class に投資を集中せよ。

本要件はその最初の適用である。2026-08-25 の discovery sweep は production
surface（repo src/ + @stv/core core-four・331 file）で 7 candidate class を
計測し、**要件定義はその実測から build** した（従来は spec 先行→guard 後追い）:

| kind | 実測 | 判定 |
|------|------|------|
| coercing-isnan（global `isNaN(`） | **2 site（src）** | **VIOLATION — 同梱 unify**（`Number.isNaN` 化・semantic 等価） |
| coercing-isfinite（global `isFinite(`） | 1 site（core） | ALLOWED — `formatDuration(seconds: number)` typed param・package 所有 file |
| unguarded-for-in（own-key filter のない `for…in`） | 1 site（src・guarded） | ALLOWED — body 先頭が `if (key in result)` |
| unawaited-async-forEach（`.forEach(async`） | 0 | exact-0 pin |
| legacy-indexof-membership（`.indexOf(x) !== -1` 系） | 0 | exact-0 pin |
| loose-equality-nonnullish（`==`/`!=`・`== null` 除く） | 0 | exact-0 pin |
| bare-hasOwnProperty（`.hasOwnProperty(` 直呼び） | 0 | exact-0 pin |

Guard は単一 file `tests/guards/dead-idiom-batch-census.test.ts` の
**kind registry**（`IDIOM_KINDS` 7 entry）で、class 追加は 1 entry 追加のみ
（steering 契約）。roster は **ALLOWED 2 key** / **ERADICATED 2 key**（REQ-395
census-artifact three-way 句・実測から build）。

**信頼性レベル凡例**: 🔵 実測・既存正典・実 tree 観測から確実 / 🟡 拡張仮説・妥当な推測 / 🔴 未測定

## 関連文書

- **分析記録**: [💬 interview-record.md](interview-record.md)
- **コンテキストノート**: [📝 note.md](note.md)
- **タスク概要**: [📋 tasks/overview.md](tasks/overview.md)
- **先行正典**: REQ-405 fallback-default census（同一 chain の値でっち上げ面）・REQ-401 numeric-coercion census（radix-less parseInt）— 本要件は**述語・制御構文イディオム面**の batch
- **roster 規約**: REQ-395 census-artifact three-way（family 19 登録・phrase 一致）
- **landing 規約**: REQ-402 SPEC_LANDING_ATOMICITY・REQ-406 title-sync（本 spec landing が dogfood）

## 主要機能要件

### 必須機能（Must Have）

- REQ-410-001: システムは idiom class を **kind registry** として guard に
  保持すること: 各 kind は per-line detector（regex または predicate）+ 
  context class のみ optional な `guardedBy` rule（for-in は body 先頭の
  own-key filter `if (k in target)` / `.hasOwnProperty(` / `Object.hasOwn(` を
  for 行 indent の body 終端まで ≤12 行 scan）。class 追加は registry への
  1 entry 追加のみで完了すること（steering の batch 契約）🔵 *実装済み・liveness fixture (a)〜(h) で検出境界を検証*
- REQ-410-002: システムは実 production surface の hit を roster 判定すること:
  (a) 未 roster hit は completeness RED、(b) roster 行は live hit に対応
  （stale row RED）、(c) `guardedBy` 違反は **roster があっても RED**（roster
  は「書かれた site as-is」への判定で guard 削除を免除しない）、(d) 
  ERADICATED key の再出現は RED。roster は **ALLOWED 2 key / ERADICATED 2 key** 🔵 *実測 331 file walk・baseline pin（files >= 300・isFinite/for-in 各 >= 1）*
- REQ-410-003: coercing-isnan の 2 site（`src/remotion/srt-parser.ts:98`・
  `src/pipeline/quality-monitor.ts:637`）は **同一 commit で `Number.isNaN` に
  unify** すること。両 site とも operand が常に number（`parseInt(…, 10)` の
  返り値・REQ-375 typeof filter 通過後）であり挙動は等価 — 変更は coercing
  spelling の撲滅（未来の operand type 拡張で verdict が黙って反転する面の
  構造的遮断）。REQ-375 の typeof guard は維持すること
  （`Number.isNaN(null)` も false のため guard は依然 load-bearing）🔵 *該当 suite GREEN・negative anchor 2 件で spelling pin*
- REQ-410-004: liveness 検証は合成 fixture で各 kind の検出・非検出を証明
  すること: (a) global 述語の `Number.`/member 形除外、(b) async forEach の
  検出と sync/`for await` 除外、(c) indexOf membership の両極性（`!== -1`/
  `< 0`）検出と `includes`/`lastIndexOf` 除外、(d) `== null` nullish idiom
  と strict/comparison 演算子除外、(e) `Object.prototype.hasOwnProperty.call`/
  `Object.hasOwn` 除外、(f) for-in の guarded/unguarded 分岐、(g) comment 行
  skip、(h) roster 外 rogue hit の kind 帰着 🔵 *fixture (a)〜(h)*
- REQ-410-005: mutation 検証（MW-074）は 3 独立 mutation — (a) srt-parser
  unify の revert（coercing-isnan kind 単独発火）、(b) production file への
  `.forEach(async` 注入（unawaited-async-forEach kind 単独発火）、(c) 
  smart-parameter-tuner の `if (key in result)` own-key filter 削除
  （for-in context rule が **roster 保有下でも** RED）— で各 RED を実測し、
  mutation-witness ledger に section + appendix 行を記載して
  PINNED_MIN_ENTRIES を 67→68 に上げること 🔵 *Phase 197 確立の単一 commit 同梱規約*
- REQ-410-006: 本 spec 一式（requirements / note / interview-record /
  tasks/overview / TASK-0301）の landing は REQ-402 SPEC_LANDING_ATOMICITY と
  REQ-406 title-sync を dogfood すること: anchor と parent 側登録
  （architecture.md children 2 件・design-interview.md children 1 件・
  speech-to-visuals/note.md references 1 件）を guard・MW・ledger と**同一
  commit** に同梱し、登録前に spine-edge census が `PARENT_UNREGISTERED` で
  RED になることを実測してから登録して GREEN にすること（index 表題は対象
  doc の H1 と全文一致）🔵 *REQ-403〜407-005/006/007 の踏襲*
- REQ-410-007: census-artifact three-way へ family 19 を登録すること
  （REQ-410 行・requirementsPath = 本 spec・authority list 12 family）。本
  spec は measured roster から build された句 `ALLOWED 2 key` /
  `ERADICATED 2 key` を宣言すること 🔵 *REQ-395 promoted condition の適用*

### 基本的な制約

- REQ-410-008: 本契約の管轄外を guard header doc comment に明示すること —
  (a) detector は行単位（跨ぎ行の `==` や wrap した indexOf 比較は死角・
  現存 0 件・AST pass が必要な ceiling）、(b) nullish 除外は行粒度（同一行に
  `== null` と非 nullish `==` が混在すると行ごと skip）、(c) for-in guard
  scan は ≤12 行・既知 3 pattern（helper 経由の guard は unguarded 計上 =
  safe 方向の誤検出）、(d) 文字列 literal 内の idiom text は false-positive
  になり ALLOWED 判断を強制する（census の設計意図）、(e) `@stv/core` 側
  file の修正は in-tree 不可（roster の CORE-TYPED 判断は core 自身の CI
  への移譲）🟡 *契約範囲の明示（sibling census と同じ誠実さの慣行）*

## 簡易ユーザーストーリー

### ストーリー1: coercing 述語の黙判反転の遮断

**私は** pipeline 実装者 **として**
**operand type が将来拡張された global `isNaN` / `isFinite` を書いたときに**
**batch census が RED に差し戻すことで**
**`isFinite('12') === true` 型の黙判反転を landing 前に止められる。

**関連要件**: REQ-410-002・REQ-410-003

### ストーリー2: 次の class 追加が 1 entry で済む

**私は** 未来の実装者 **として**
**新しい dead-idiom class を pin したくなったときに**
**`IDIOM_KINDS` に 1 entry 追加するだけで**
**spec 6 file + 2 phase を儀式化せずに ratchet を得られる。

**関連要件**: REQ-410-001

## 基本的な受け入れ基準

### REQ-410-001〜004: batch census の検出と固定

**Given（前提条件）**: production surface 331 file に 7 class の hit が実測済み（2 unify 済み・2 roster・4 class exact-0）
**When（実行条件）**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns dead-idiom-batch-census` を実行する
**Then（期待結果）**: 8 test GREEN（authority + kind ratchet + completeness + guard-rule + stale-row + eradicated-reappear + negative anchors + liveness (a)〜(h)）

**テストケース**:

- [x] **TC-410-01**: authority（files >= 300・isFinite/for-in floor・kind 7 entry ratchet）🔵
- [x] **TC-410-02**: completeness / stale-row / guard-rule / eradicated-reappear の 4 面 🔵
- [x] **TC-410-03**: negative anchors 4 件（unify spelling 2・own-key filter・core 判定 spelling）🔵
- [x] **TC-410-04**: liveness fixture (a)〜(h) 🔵

### REQ-410-005: MW-074 mutation 検証

**Given**: guard が GREEN の tree
**When**: 3 独立 mutation（unify revert / `.forEach(async` 注入 / own-key filter 削除）を適用する
**Then**: 各 mutation で対応 kind が RED・revert で GREEN 復元

### REQ-410-006: atomic landing の dogfood

**Given**: 本 spec 一式が parent 側登録なしの状態
**When**: spine-edge census を実行する
**Then**: `PARENT_UNREGISTERED` ×4 で RED → parent 側 4 登録（表題 = 対象 doc H1 と全文一致）を同 commit で追加すると GREEN

## 最小限の非機能要件

- **性能**: 追加検証は既存 walk の行 scan のみ（file 再読みなし・guard 実行 < 1s）
- **保守性**: kind registry は純 data + 純関数 detector で export し合成 fixture で境界検証。src 変更は unify 2 site のみ（それ以外 read-only census）
