# dead-idiom-batch-census タスク概要

<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](../../speech-to-visuals/architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-25
**プロジェクト期間**: 2026-08-25 - 2026-08-25（全 phase 完了）
**推定工数**: 4h（REQ-410 batch guard + unify 2 site + three-way family 19 登録 + atomic dogfood landing + MW-074 mutation 検証 — **単一 phase・単一 TASK の batch 形式**）
**総タスク数**: 5件

> **形式 note（family 19 の差分）**: steering ROI 指示（REQ-405 採点後）に
> より、violation が少量（2 site）かつ class 多数が confirmed-zero の
> family は spec 5 file・1 phase・1 TASK の batch 形式とする。従来の
> 2 phase / 2 TASK 構成（REQ-406・407 など）は実違反が多数の class に
> 投資を集中するために残る。

## 関連文書

- **要件定義書**: [📋 requirements.md](../requirements.md) REQ-410
- **コンテキストノート**: [📝 note.md](../note.md)
- **分析記録**: [💬 interview-record.md](../interview-record.md)
- **先行正典**: REQ-405 fallback-default census・REQ-401 numeric-coercion census — family 19 は述語・制御構文イディオム面の batch
- **先行 guard**: REQ-395 three-way（family 登録規約）・REQ-402 spine edge census（atomicity 強制）・REQ-406 title-sync（index 表題一致）

## フェーズ構成

| フェーズ | 期間 | 成果物 | タスク数 | 工数 | ステータス |
|---------|------|--------|----------|------|-----------|
| Phase 217 | 2026-08-25 | REQ-410 dead-idiom batch census guard（kind registry 7 entry）+ coercing-isnan 2 site unify + three-way family 19 登録 + 本 spec 一式の atomic landing + MW-074 mutation 検証 | 1 | 4h | ✅完了 |
| Phase 218 | 2026-08-25 | REQ-411 第二回 sweep — 同一 guard へ 9 kind 追加（7→16 entry）+ json-clone 1 site ALLOWED（structuredClone jest 欠落の実 probe 根拠）+ 2 class pin 前棄却（with/arguments.callee・tsc strict 重複）+ MW-075 mutation 検証 | 1 | 3h | ✅完了 |
| Phase 219 | 2026-08-25 | REQ-412 第三回 sweep — 同一 guard へ 12 kind 追加（16→28 entry）+ parseint-no-radix 5 site unify（ProductionDashboard・radix 10）+ from-char-code 5 site / proto-key-literal 1 site ALLOWED（byte-domain・sanitizer blocklist 実コード根拠）+ Math.pow pin 前棄却（`**` と挙動完全一致）+ MW-076 mutation 検証 | 1 | 3h | ✅完了 |
| Phase 220 | 2026-08-25 | REQ-413 第四回 sweep — 同一 guard へ 7 kind 追加（28→35 entry）+ var ambient 2 site ALLOWED（declare global 内の型のみ宣言）+ 3 class pin 前棄却（`.map(async` 検出不可能型・`new Array(n)` hole なし・`Math.max(...xs)` 入力有界）+ MW-077 mutation 検証 | 1 | 2.5h | ✅完了 |
| Phase 221 | 2026-08-25 | REQ-414 第五回 sweep — 同一 guard へ 14 kind 追加（35→49 entry）+ console-debug-log / process-exit / tolocalestring-bare 各 1 site ALLOWED（level gate 隣接・gracefulShutdown epilogue・finite branch）+ 3 class pin 前棄却（charCodeAt 投資不釣合型・assignment-in-condition 検出不可能型・charAt 挙動等価型）+ MW-078 mutation 検証 | 1 | 2.5h | ✅完了 |

## タスク番号管理

**使用済みタスク番号**: TASK-0301〜0305
**次回開始番号**: TASK-0306

（参考: TASK-0297〜0300 は parallel branch の family 17/18 が使用 —
`git log --all` で衝突確認済み）

## 全体進捗

- [x] Phase 217: REQ-410 batch guard + unify 2 site + three-way family 19 登録 + MW-074
- [x] Phase 218: REQ-411 sweep #2 — 9 kind 追加 + json-clone ALLOWED + MW-075
- [x] Phase 219: REQ-412 sweep #3 — 12 kind 追加 + parseint-no-radix 5 site unify + MW-076
- [x] Phase 220: REQ-413 sweep #4 — 7 kind 追加 + var ambient ALLOWED + MW-077
- [x] Phase 221: REQ-414 sweep #5 — 14 kind 追加 + 3 site ALLOWED + MW-078

## マイルストーン

- **M1: batch guard 完走** (Phase 217): kind registry 7 entry・liveness (a)〜(h)・ALLOWED 2 key / ERADICATED 2 key の exact both-ways・unify 2 site 同梱 ✅
- **M2: teeth 実証** (Phase 217): MW-074 で 3 独立 mutation（unify revert・`.forEach(async` 注入・own-key filter 削除）の kind 独立 RED 実測 ✅
- **M3: sweep #2 定着** (Phase 218): REQ-411 で batch 契約の再適用（新 spec dir / family / phase 群なし・kind 追加のみ）を実証 — 9 kind 追加・2 class pin 前棄却・MW-075 で代表 3 kind の独立 RED 実測 ✅
- **M4: sweep #3/#4/#5 の反復定着** (Phase 219〜221): 3 回連続で同一 registry への kind 追加（12+7+14 = 33 entry・計 49）と棄却理由型の再利用（挙動等価型×2・検出不可能型×2・投資不釣合型×2）を継続実証 ✅

---

## Phase 217: REQ-410 dead-idiom batch census（batch 形式）

**目標**: 複数の confirmed-zero / 少量違反 idiom class を単一 kind registry
guard にまとめ、coercing 述語の黙判反転面を構造的に遮断する。
**成果物**: tests/guards/dead-idiom-batch-census.test.ts + src 2 site unify + three-way family 19 行 + 本 spec 一式 + MW-074

### タスク一覧

- [x] [TASK-0301: dead-idiom batch census guard 新設 + coercing-isnan 2 site unify + three-way family 19 登録 + MW-074 mutation 検証 + atomic dogfood landing](TASK-0301.md) - 4h (TDD) 🔵 ✅完了

### 依存関係

- `freeze-guard` helper（`walkProductionSurface` / `readSource` / `isCommentLine`）に依存
- REQ-395 three-way guard への family 19 登録を含む
- REQ-402 spine edge census / REQ-406 title-sync（landing atomicity の検証器）


---

## Phase 218: REQ-411 第二回 discovery sweep（同一 guard への kind 追加）

**目標**: batch 契約（kind 追加 = 1 entry）を 2 回目の適用で定着させる。
11 candidate を計測し、tsc が常時弾く 2 class は棄却、9 kind を追加、
唯一の実測 hit（json-clone）は structuredClone の jest vm context 欠落
（実 probe）を根拠に ALLOWED 判断。
**成果物**: guard 9 kind 追加 + ALLOWED 1 key + fixture (i)〜(q) + spec 同梱更新 + MW-075

### タスク一覧

- [x] [TASK-0302: 第二回 discovery sweep — 同一 batch guard へ 9 kind 追加 + json-clone ALLOWED 判断 + MW-075 mutation 検証](TASK-0302.md) - 3h (TDD) 🔵 ✅完了

### 依存関係

- Phase 217 の `IDIOM_KINDS` registry と discovery primitive に直接追記
  （新規 guard file なし — batch 契約の趣旨）
- structuredClone 利用可否は jest 環境の実 probe で判定（型だけでは判断しない）

---

## Phase 219: REQ-412 第三回 discovery sweep（parseint-no-radix unify 同梱）

**目標**: batch 契約（kind 追加 = 1 entry）の 3 回目の適用。13 candidate
を計測し、10 class を exact-0 pin、Math.pow を挙動等価根拠で pin 前棄却、
唯一の VIOLATION cluster（parseint-no-radix 5 site・同一 file 同一 shape）を
unify、from-char-code / proto-key-literal の実測 site は引数域・由来を
実コード読みで確認して ALLOWED roster 化。
**成果物**: guard 12 kind 追加 + src 5 site unify + ALLOWED 6 key / ERADICATED 5 key + fixture (r)〜(w) + spec 同梱更新 + MW-076

### タスク一覧

- [x] [TASK-0303: 第三回 discovery sweep — 同一 batch guard へ 12 kind 追加 + parseint-no-radix 5 site unify + 2 class ALLOWED + MW-076 mutation 検証](TASK-0303.md) - 3h (TDD) 🔵 ✅完了

### 依存関係

- Phase 217/218 の `IDIOM_KINDS` registry と discovery primitive に直接追記
  （新規 guard file なし — batch 契約の趣旨）
- byte-domain / blocklist 判定は引数域を実コード読みで確認
  （型だけでは判断しない — Phase 218 の structuredClone probe と同系列）

## Phase 220: REQ-413 第四回 discovery sweep（var ambient 2 site ALLOWED 同梱）

**目標**: batch 契約（kind 追加 = 1 entry）の 4 回目の適用。10 candidate
を計測し、6 class を exact-0 pin、var-declaration 2 site を ambient 宣言
根拠で ALLOWED roster 化、3 class（`.map(async`・`new Array(n)`・
`Math.max(...xs)` 系）を検出不可能型/投資不釣合型として pin 前棄却。
**成果物**: guard 7 kind 追加 + ALLOWED 2 key + fixture (x1)〜(x7) +
spec 同梱更新 + MW-077

### タスク一覧

- [x] [TASK-0304: 第四回 discovery sweep — 同一 batch guard へ 7 kind 追加 + var ambient 2 site ALLOWED + 3 class pin 前棄却 + MW-077 mutation 検証](TASK-0304.md) - 2.5h (TDD) 🔵 ✅完了

### 依存関係

- Phase 217〜219 の `IDIOM_KINDS` registry と discovery primitive に直接追記
  （新規 guard file なし — batch 契約の趣旨）
- `declare global` 判定は block 開始行（:449）を実コード読みで確認
  （「var が 2 つある」だけでなく ambient 文脈を検証）

## Phase 221: REQ-414 第五回 discovery sweep（3 site ALLOWED 同梱）

**目標**: batch 契約（kind 追加 = 1 entry）の 5 回目の適用。17 candidate
を計測し、11 class を exact-0 pin、console-debug-log / process-exit /
tolocalestring-bare の各 1 site を文脈根拠（level gate 隣接・
gracefulShutdown epilogue・finite branch）で ALLOWED roster 化、
3 class（charCodeAt・assignment-in-condition・charAt）を
投資不釣合型/検出不可能型/挙動等価型として pin 前棄却。
**成果物**: guard 14 kind 追加 + ALLOWED 3 key + fixture (y1)〜(y14) +
spec 同梱更新 + MW-078

### タスク一覧

- [x] [TASK-0305: 第五回 discovery sweep — 同一 batch guard へ 14 kind 追加 + 3 site ALLOWED + 3 class pin 前棄却 + MW-078 mutation 検証](TASK-0305.md) - 2.5h (TDD) 🔵 ✅完了

### 依存関係

- Phase 217〜220 の `IDIOM_KINDS` registry と discovery primitive に直接追記
  （新規 guard file なし — batch 契約の趣旨）
- ALLOWED 3 site の文脈（level gate 隣接・shutdown log → exit 順序・
  finite branch 共存）を実コード読みで確認し negative anchor で pin
  （「hit が 1 つある」だけでなく文脈を検証）
