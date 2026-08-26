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
**総タスク数**: 7件

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
| Phase 222 | 2026-08-25 | REQ-415 第六回 sweep — 同一 guard へ 22 kind 追加（49→71 entry）+ global.gc→globalThis.gc 5 site unify（batch 形式初の browser-portability cluster）+ 4 site ALLOWED（confirm gate・UA report-only ×3）+ legacy-substring pin 前棄却（投資不釣合型 3 例目）+ MW-079 mutation 検証 | 1 | 3h | ✅完了 |
| Phase 224 | 2026-08-26 | REQ-416 第七回 sweep — 同一 guard へ 7 kind 追加（71→78 entry）+ 3 class pin 前棄却（`.length = 0`/`.splice` 投資不釣合型 4/5 例目・`return` in finally 検出不可能型 2 例目 + site 母集団≠incident 母集団の初例）+ REQ-414/415 cherry-pick 移植を前段化 + MW-080 mutation 検証 | 1 | 2h | ✅完了 |

## タスク番号管理

**使用済みタスク番号**: TASK-0301〜0307
**次回開始番号**: TASK-0308

（参考: TASK-0297〜0300 は parallel branch の family 17/18 が使用 —
`git log --all` で衝突確認済み）

## 全体進捗

- [x] Phase 217: REQ-410 batch guard + unify 2 site + three-way family 19 登録 + MW-074
- [x] Phase 218: REQ-411 sweep #2 — 9 kind 追加 + json-clone ALLOWED + MW-075
- [x] Phase 219: REQ-412 sweep #3 — 12 kind 追加 + parseint-no-radix 5 site unify + MW-076
- [x] Phase 220: REQ-413 sweep #4 — 7 kind 追加 + var ambient ALLOWED + MW-077
- [x] Phase 221: REQ-414 sweep #5 — 14 kind 追加 + 3 site ALLOWED + MW-078
- [x] Phase 222: REQ-415 sweep #6 — 22 kind 追加 + global.gc 5 site unify + 4 site ALLOWED + MW-079
- [x] Phase 224: REQ-416 sweep #7 — 7 kind 追加 + 3 class pin 前棄却 + MW-080

## マイルストーン

- **M1: batch guard 完走** (Phase 217): kind registry 7 entry・liveness (a)〜(h)・ALLOWED 2 key / ERADICATED 2 key の exact both-ways・unify 2 site 同梱 ✅
- **M2: teeth 実証** (Phase 217): MW-074 で 3 独立 mutation（unify revert・`.forEach(async` 注入・own-key filter 削除）の kind 独立 RED 実測 ✅
- **M3: sweep #2 定着** (Phase 218): REQ-411 で batch 契約の再適用（新 spec dir / family / phase 群なし・kind 追加のみ）を実証 — 9 kind 追加・2 class pin 前棄却・MW-075 で代表 3 kind の独立 RED 実測 ✅
- **M4: sweep #3/#4/#5 の反復定着** (Phase 219〜221): 3 回連続で同一 registry への kind 追加（12+7+14 = 33 entry・計 49）と棄却理由型の再利用（挙動等価型×2・検出不可能型×2・投資不釣合型×2）を継続実証 ✅
- **M5: sweep #6 で portability cluster 収穫** (Phase 222): REQ-415 で browser/Node 兼側面の class 群（`global.`・XHR・CJS 綴り・UA sniffing・legacy HTML API）を計測 — `global.gc` 5 site を batch 形式初の portability unify として同梱 ✅
- **M6: sweep #7 で棄却理由の枠組み拡張** (Phase 224): REQ-416 で site 母集団 ≠ incident 母集団（finally 13 site すべて cleanup-only）という棄却軸を追加 — completeness 契約が正当イディオムの税になる class は pin しない判断基準を成文化 ✅

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

## Phase 222: REQ-415 第六回 discovery sweep（global.gc 5 site unify 同梱）

**目標**: batch 契約（kind 追加 = 1 entry）の 6 回目の適用。23 candidate
を計測し、19 class を exact-0 pin、blocking-dialog 1 site /
useragent-sniffing 3 site を文脈根拠（破壊操作の confirm gate・UA
report-only）で ALLOWED roster 化、node-global-identifier 5 site を
`globalThis.gc` へ unify（batch 形式初の browser-portability cluster）、
legacy-substring 23 site を投資不釣合型（3 例目）として pin 前棄却。
**成果物**: guard 22 kind 追加 + src 5 site unify + ALLOWED 4 key /
ERADICATED 5 key + fixture (z1)〜(z18) + spec 同梱更新 + MW-079

### タスク一覧

- [x] [TASK-0306: 第六回 discovery sweep — 同一 batch guard へ 22 kind 追加 + global.gc 5 site unify + 4 site ALLOWED + legacy-substring pin 前棄却 + MW-079 mutation 検証](TASK-0306.md) - 3h (TDD) 🔵 ✅完了

### 依存関係

- Phase 217〜221 の `IDIOM_KINDS` registry と discovery primitive に直接追記
  （新規 guard file なし — batch 契約の趣旨）
- `global.gc` unify の等価性根拠は Node 仕様（`global === globalThis`・
  browser は globalThis のみ定義）— 実行挙動に依存しない綴り統一
- ALLOWED 4 site の文脈（confirm gate が破壊操作を guard・UA が telemetry
  /diagnostics の field のみで挙動分岐なし）を実コード読みで確認し
  negative anchor で pin

## Phase 224: REQ-416 第七回 discovery sweep（7 kind 追加 + 3 class 棄却）

**目標**: batch 契約（kind 追加 = 1 entry）の 7 回目の適用。10 candidate
を計測し、7 class を exact-0 pin、`.length = 0`（10 site）と `.splice(…)`
（27 site）を投資不釣合型（4/5 例目）、`return` in `finally`（finally 13
site・return 0）を検出不可能型（2 例目）+ site 母集団 ≠ incident 母集団
の初例として pin 前棄却。前段として main 未到達の REQ-414/415 を
cherry-pick 移植（71 kind 状態）から開始。
**成果物**: guard 7 kind 追加 + fixture (aa1)〜(aa7) + ALLOWED 18 key /
ERADICATED 12 key 不変 + spec 同梱更新 + MW-080

### タスク一覧

- [x] [TASK-0307: 第七回 discovery sweep — 同一 batch guard へ 7 kind 追加 + 3 class pin 前棄却（投資不釣合型 4/5 例目・検出不可能型 2 例目） + MW-080 mutation 検証](TASK-0307.md) - 2h (TDD) 🔵 ✅完了

### 依存関係

- Phase 217〜222 の `IDIOM_KINDS` registry と discovery primitive に直接追記
  （新規 guard file なし — batch 契約の趣旨）
- REQ-414/415（sweep #5/#6）の cherry-pick 移植（0c8fa4a0・b5d49c47）を
  前段とする（71 kind 状態からの追加分類）
- 棄却 3 class とも実測 site 全数（10 + 27 + 13）を読んでの根拠 —
  incident 出現時点の再計測条件を guard header に明記

## Phase 225: REQ-417 第八回 discovery sweep（12 kind 追加 + 4 class 棄却）

**目標**: batch 契約（kind 追加 = 1 entry）の 8 回目の適用。16 candidate
を計測し、10 class を exact-0 pin、2 class を ALLOWED 4 site 同梱
（whisper dynamic-import probe・logger transport 3 行）、4 class
（dom0-handler-assign / throw-bare-error / void-zero-undefined / bare
postMessage）を pin 前棄却（母集団不一致 2 例目・挙動一致型 2 例目）。
**成果物**: guard 12 kind 追加 + fixture (ab1)〜(ab12) + 既存負例
明け渡し 2 件 + ALLOWED 22 key / ERADICATED 12 key + spec 同梱更新 +
MW-081

### タスク一覧

- [x] [TASK-0308: 第八回 discovery sweep — 同一 batch guard へ 12 kind 追加 + 4 class pin 前棄却（母集団不一致 2 例目・挙動一致型 2 例目） + MW-081 mutation 検証](TASK-0308.md) - 2h (TDD) 🔵 ✅完了

### 依存関係

- Phase 217〜224 の `IDIOM_KINDS` registry と discovery primitive に直接追記
  （新規 guard file なし — batch 契約の趣旨）
- 計測は canonical `walkProductionSurface` 直接使用（初回 probe 330 file
  → 331 file 再計測 — A-416-1 手順の再適用）
- 棄却 4 class とも実測 site 全数（6 + 0 + 0 + 5）を読んでの根拠 —
  incident 出現時点の再計測条件を requirements に明記

## Phase 226: REQ-418 第九回 discovery sweep（28 kind 追加 + unify 1 site + 1 class 棄却）

**目標**: batch 契約（kind 追加 = 1 entry）の 9 回目の適用。29 candidate
を計測し、26 class を exact-0 pin、1 class（dead-ua-platform）を ALLOWED
1 site 同梱、1 class（string-char-split）を unify 1 site 同梱
（`split('')` → `[...text]`・classifyChar range との交差ゼロで ratio
完全等価）、1 class（react-default-props）を pin 前棄却（母集団不一致
3 例目 — Remotion `<Composition defaultProps>` は Framework prop の同名）。
**成果物**: guard 28 kind 追加 + fixture (ac1)〜(ac28) + 既存負例
明け渡し 1 件 + ALLOWED 23 key / ERADICATED 13 key + src unify 1 site +
spec 同梱更新 + MW-082（mutation 検証が detector optional-chain 抜けを
発見した初例 — `document\??\.createEvent` へ修正して RED 化）

### タスク一覧

- [x] [TASK-0309: 第九回 discovery sweep — 同一 batch guard へ 28 kind 追加 + string-char-split unify 1 site + 1 class pin 前棄却（母集団不一致 3 例目） + MW-082 mutation 検証](TASK-0309.md) - 2h (TDD) 🔵 ✅完了

### 依存関係

- Phase 217〜225 の `IDIOM_KINDS` registry と discovery primitive に直接追記
  （新規 guard file なし — batch 契約の趣旨）
- 計測は canonical `walkProductionSurface` 直接使用（331 file・
  A-416-1 手順の維持）
- unify の等価性は @stv/core unicode-script-ranges の range 実値との
  交差確認で保証（surrogate block 0xD800-0xDFFF と不交差）+
  language-detector test 68/68 GREEN
- 棄却 1 class は site 実コード読み — incident 出現時点の再計測条件を
  requirements に明記

## Phase 227: REQ-419 第十回 discovery sweep（34 kind 追加 + ALLOWED 4 site + 2 class 棄却 + detector 初稿 bug 3 件修正）

**目標**: batch 契約（kind 追加 = 1 entry）の 10 回目の適用。36 candidate
を計測し、33 class を exact-0 pin、1 class（localedatestring-bare）を
ALLOWED 4 site 同梱（dashboard 表示専用壁時計・DISPLAY-ONLY）、2 class
（inner-text-assign・array-literal-concat）を pin 前棄却（挙動一致型
3 例目・機能本質型の初例）。**src 変更ゼロ**。
**成果物**: guard 34 kind 追加 + fixture (ad1)〜(ad34) + ALLOWED 27 key /
ERADICATED 13 key + spec 同梱更新 + MW-083。計測・liveness fixture 工程
が detector 初稿の検出域 bug 3 件（偽陽性 2 件 + `createDecipher`
検出漏れ 1 件）を発見・修正 — REQ-419-002 に成文化。

### タスク一覧

- [x] [TASK-0310: 第十回 discovery sweep — 同一 batch guard へ 34 kind 追加 + ALLOWED 4 key + 2 class pin 前棄却（挙動一致型 3 例目・機能本質型 1 例目） + 計測・fixture 発見の detector 初稿 bug 3 件修正 + MW-083 mutation 検証](TASK-0310.md) - 2h (TDD) 🔵 ✅完了

### 依存関係

- Phase 217〜226 の `IDIOM_KINDS` registry と discovery primitive に直接追記
  （新規 guard file なし — batch 契約の趣旨）
- 計測は canonical `walkProductionSurface` 直接使用（331 file・
  A-416-1 手順の維持）
- detector 初稿 bug 3 件とも計測偽陽性（clean surface hit）または
  fixture 正面例の RED で再現確認し、境界を fixture 両側で固定
- 棄却 2 class とも綴り域全体の挙動読み — incident 出現時点の再計測条件を
  requirements に明記
