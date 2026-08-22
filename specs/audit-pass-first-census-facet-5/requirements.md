# audit-pass-first census 第5 facet（stale-comment・type-narrow-as-any・any 漏出）要件定義書（軽量版）

<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals メイン要件定義書](../speech-to-visuals/requirements.md) REQ-391〜395 audit-pass-first census series
>
> - parent: `speech-to-visuals/requirements.md` (REQ-391〜395 census family)
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

## 概要

REQ-391〜395 が確立した **audit-pass-first census パターン**（repo 全生産
surface を `walkProductionSurface` で走査する guard を新設し、捏造・凍結・
契約違反の class を facet 別に個別発見・個別修正してきた滴りに対し、census
で future-regression を機械的に RED 化する）を、**第 5 facet** として
`stale-comment` / `type-narrow-as-any` / `any 漏出` の 3 class に適用する。
make-run steering 直近の指摘「次は同パターンを未着手の facet（例:
stale-comment、type-narrow-as-any、any 漏出など）に適用する候補を選定し
REQ-396/397 を計画すること」を具体化する。

| class | 既存観測 | 想定 census facet |
|-------|---------|------------------|
| **stale-comment** | src/ 内 TODO/FIXME/XXX/HACK marker 3 件のみ・deprecated/legacy/obsolete 自己宣言 comment は表面 grep で 0 件 — ただし REQ-391〜394 が度々「`// Would be calculated from actual results`」「`// assumes`」「`// Simulated`」のような自己申告 comment を**捏造の隠蔽**として発見してきた事実から、stale-comment を class として pin する diagnostic 価値は残る | ALLOWED・ERADICATED の 2分類（self-referential confession・未履行 stub の 2 sub-facet） |
| **type-narrow-as-any** | `as any` cast 47 site（src/ + test 含む）— 過半は ESM test mock / JSON.parse 結果の救済 / unknown→具体型 narrowing の正当用途だが、REQ-393 score-ladder で「fallback が legit-zero を隠す」class が `??`/`||` で複数発見されたのと同型で、narrow 失敗の catch-all として `as any` を使う site 群には同型リスクがある | ALLOWED・ERADICATED（narrow-by-as-any = info-silencer） |
| **any 漏出**（`: any` 注釈・`<any>` 汎用型・`Array<any>` / `Record<string, any>`）| `: any` 注釈 32 site・`<any>` 汎用型・Record<string, any> 多数 — ESM test mock の境界変数・`unknown` への移行で消せる site と、API 境界の incoming payload 型（req.body ほか）で構造的に残る site が混在 | ALLOWED・ERADICATED（boundary external input 以外の `: any` 注釈） |

**信頼性レベル凡例**:
- 🔵: 既存 census（REQ-391〜395）の直接延長・既存 grep / 観測から確実
- 🟡: 既存 census の拡張仮説・観測からの妥当な推測
- 🔴: 未測定

## 関連文書

- **分析記録**: [💬 interview-record.md](interview-record.md)
- **コンテキストノート**: [📝 note.md](note.md)
- **親 census series**: REQ-391〜395 in [speech-to-visuals/requirements.md](../speech-to-visuals/requirements.md)

## 主要機能要件

### 通常要件（REQ-396: stale-comment census）

- **REQ-396-001**: repo 全生産 surface（repo `src/` + `@stv-core/core-four`、
  REQ-391〜395 と同一 `walkProductionSurface` 粒度）を走査し、
  (a) `// Would be / Would be calculated from ...` 形の **自己申告
  confession**（実装予定を comment で予告し実測で置換していない site）
  (b) `// Simulated` / `// placeholder` 形の **stub disclosure**（凍結値を
  test-friendly 値と区別不能にする開示形）
  (c) `TODO`/`FIXME`/`XXX`/`HACK` マーカー
  (d) 「deprecated」/「legacy」/「obsolete」/「won't fix」/「don't use this」
  /「outdated」/「no longer used」を self-claim するコメント
  を 1 行 discovery で拾う census guard（**stale-comment-census**）を
  新設しなければならない 🔵 *REQ-393 発見「`// assumes`」「`// Would be
  calculated from actual results`」等の confession を REQ-391/393 の手動
  audit が都度発見してきた滴り*

- **REQ-396-002**: stale-comment-census は分類台帳
  **ALLOWED**（documentation of intentional design choice・defect-N 台帳
  への refer・legal/license header）と **ERADICATED**（confession of
  unrealized measurement・stub disclosure・unfulfilled TODO marker・
  self-claim of deprecation without follow-through action）の 2 分類を
  持ち、各 row は理由必須（reason 衛生 = REQ-391 の "4 分類 5 分類" 命名
  規約に揃える）とする 🔵 *REQ-391 ALLOWED 37 key 分類規約を踏襲*

- **REQ-396-003**: stale-comment-census の初回 run では **手動 audit で
  残件 0 を確認**した上で confirmed-zero 状態を固定する pin（REQ-394 の
  confirmed-zero audit-pass-first precedent）とし、撲滅を同梱するかは
  audit 結果次第とする（残件 0 の場合 REQ-394 同型で新規 site を意識的
  分類する gate のみ ship）🟡 *REQ-394 confirmed-zero 固定の拡張*

- **REQ-396-004**: stale-comment-census 検出範囲は `//` 行 comment と
  `/* */` block comment の冒頭行とし、`/** */` doc-comment は対象外と
  する（doc-comment は typedoc の consumer であり stale-comment class と
  は別）🔵 *JSDoc 標準*

- **REQ-396-005**: 3-detection 軸（confession / disclosure / marker /
  self-claim）の regex は **AND 結合禁止** — 1 site が複数軸に同時 hit
  する場合は最初に hit した軸で 1 度のみ計上する（REQ-394 counter
  liveness「quoted key・bare identifier key は計上・4-space 継続行・comment
  行は非計上」原則を踏襲）🔵 *REQ-394 counter liveness 規約*

### 通常要件（REQ-397: type-narrow-as-any + any 漏出 census）

- **REQ-397-001**: repo 全生産 surface を `as any` cast で走査する
  **type-narrow-as-any census** を新設しなければならない。検出 regex は
  (a) `as any`（narrow-by-cast — `unknown` 経由が canonical）
  (b) `as any as`（double-cast — ESLint `no-useless-cast` で本来検出
  されるが bypass 形はここでも捕捉）
  (c) `// @ts-ignore` / `// @ts-expect-error`（cast と同型の type system
  bypass）[[ doc-comments / `eslint-disable` 行も含む]] 🔵
  *REQ-393 score-ladder が `??`/`||` の silent-legit-zero 隠蔽を発見した
  のと**同型 class の type-system 側**（narrow 失敗の catch-all =
  legit-narrowing を info-silencer 化）*

- **REQ-397-002**: `as any` の正当用途（ESM test mock の境界変数・
  `JSON.parse` 結果の `unknown` 経由 narrowing・React event handler の
  `e: any` 歴史的型）は **site 個別 row の ALLOWED 分類**で許可し、
  generic `as any`（「型が複雑なので通すため」「既存実装がそうなっていた
  ので引き継ぎ」等の構造的理由なし）は ERADICATED とする。ALLOWED 各 row
  は理由カテゴリ（test-mock / json-parse-narrowing / external-boundary /
  third-party-type-gap）と該当 site 引用を必須とする 🔵 *REQ-391
  ALLOWED 分類規約*

- **REQ-397-003**: repo 全生産 surface を `: any` 注釈・`<any>` 汎用型・
  `Array<any>` / `Record<string, any>` の **any-annotate census** を
  新設しなければならない。検出 regex は (a) `: any`（注釈 — interface
  field・parameter・return type・generic argument の 4 形）
  (b) `<any>`（generic 引数 — `Array<any>`・`Record<string, any>`・
  `Promise<any>` ほか）
  (c) `any[]`（bare array form）
  の 3 形。注釈形は 47 site 規模（src + test）が見込まれ、boundary
  external input（req.body・form payload・third-party SDK 入力）のみを
  ALLOWED、それ以外（特に `internal`/`private` function の parameter /
  return type）は `unknown` 移行を canonical とし ERADICATED 候補とする
  🔵 *REQ-393 score-ladder の `?? 数字` が fail-closed 0 へ移行された
  のと**同型 class の型システム側**（`any` 注釈 = type-system 全体の
  fail-open）*

- **REQ-397-004**: any-annotate census の ALLOWED 分類は **boundary**
  カテゴリ（external-input / third-party-sdk / migration-shim /
  dynamic-config-load）の 4 分類に限定し、internal logic の parameter
  / return type は ALLOWED に上げない。`unknown` 移行で消せる site は
 撲滅候補とし、`unknown` 移行が design-heavy な site（例:
  ESLint config object の user override・大型 interface field 一括定義）
  は ALLOWED で個別 row 許可 🔵 *REQ-391 ALLOWED 分類規約*

- **REQ-397-005**: type-narrow-as-any census と any-annotate census は
  **同一 commit 內で paired 新設**する（REQ-395 three-way guard の
  family registration — 本 2 guard 追加で CENSUS_FAMILIES に新規 2 family
  が登録される）🔵 *REQ-395 three-way guard 規約*

- **REQ-397-006**: type-narrow-as-any census と any-annotate census は
  初回 run で **手動 audit 完了**を前提とし、撲滅 site の発見・修正は
  REQ-396-003 と同じ audit-driven で別 commit に分離する（REQ-391 滴り
 撲滅 = 同 commit・REQ-394 confirmed-zero = 撲滅同梱なし の 2 precedent
  に対応）🟡 *REQ-391/394 precedent の併存*

- **REQ-397-007**: 本 2 census 検出範囲は `src/` 配下の `.ts` / `.tsx`
  ファイルのみとし、`**/__tests__/**` と `**/__mocks__/**` は ALLOWED
  として一律分類する（ESM test mock の境界変数は spec が課す test-only
  contract であり production code と同列に ERADICATED 化できない）
  🔵 *REQ-391 walkProductionSurface の test 除外規約*

### 構造的ガード要件

- **REQ-201**: stale-comment-census / type-narrow-as-any-census /
  any-annotate-census の 3 guard は REQ-391〜394 と同一 format で
  `tests/guards/<name>-census.test.ts` に配置しなければならない 🔵
  *REQ-391〜394 test 配置規約*

- **REQ-202**: 3 guard の冒頭には「guards.ts の helper 追加・改名・削除・
  regex 追加に合わせて CLOSED-SET と regex を更新せよ」旨の maintenance
  note を記載しなければならない 🔵 *REQ-391 maintenance pairing 要件*

- **REQ-203**: 3 guard の regex は **MULTILINE に割れた confession /
  cast / annotation** を発見できない上限を header に正直 doc 化する
  こと（REQ-393 score-ladder の multiline ladder 上限 precedent を踏襲）
  🔵 *REQ-393 検出上限の正直 doc 化*

- **REQ-204**: 3 guard の **negative anchor**（ERADICATED 候補 literal の
  再出現を単独で ban する regex）は、REQ-392 precedent に従い
  ALLOWED・ERADICATED ledger の他に**code 行単位で ban する backup
  regex** を 1 個以上同梱する 🔵 *REQ-392 negative anchor 規約*

- **REQ-205**: 3 guard は REQ-395 three-way guard の THREE_WAY table に
  登録され、family 追加で `census-artifact-three-way.test.ts` の
  THREE_WAY 行が更新される（family 5/6/7 として — REQ-391〜394 は
  family 1〜4）🔵 *REQ-395 three-way guard 規約*

### 状態要件

- **REQ-301**: 既存 census guard（measurement-fixture-census /
  optional-metric-producer-census / score-ladder-census /
  measurement-statement-literal-census / spine-anchor-role-census）の
  test name・export・配置 import は変更してはならない 🔵 *consumer
  保護*

- **REQ-302**: 3 guard の `walkProductionSurface` 実装は REQ-391 の
  既存実装を `import { walkProductionSurface } from '../helpers/...'`
  形式で再利用し、新たな surface enumeration を追加してはならない
  🔵 *REQ-391 walkProductionSurface 単一実装*

### 制約要件

- **REQ-401**: 本 iteration は **3 guard 新設 + (任意で) 撲滅 site
  修正**を伴い、扱うファイル数は **8 以下** とする（3 guard test + 3
  negative anchor site + REQ-395 three-way guard 更新 + optional
  撲滅 ≤ 5 file）🔵 *5 file batch 規約*

- **REQ-402**: 3 guard の ALLOWED 各 row は **理由カテゴリ + site 引用**
  を必須とし、理由なき ALLOWED row を 1 件でも ship した場合
  reason-hygiene 規約違反として RED にする 🔵 *REQ-391 reason 衛生規約*

- **REQ-403**: 3 guard は `src/utils/guards.ts` の **contract 重複
  記述**をしてはならない。新 helper の追加が必要な場合は `guards.ts`
  に single source として追加し、spec は参照のみとする 🔵 *spec 重複
  禁止*

- **REQ-404**: stale-comment-census は本 iteration で **手動 audit
  完了した site 数**を ALLOWED/ERADICATED の初期 roster とし、guard
  初回 run の自動計上と一致することを pin する（REQ-395 three-way
  guard drift 教訓の proactive 反映）🔵 *REQ-395 drift 教訓*

- **REQ-405**: type-narrow-as-any-census と any-annotate-census は
  同上。audit 前に guard を ship する場合は **initial roster = 0** と
  明示し、初回 run が発見した site を audit と一致確認の上で
  ERADICATED に登録する 🔵 *REQ-395 drift 教訓*

## 簡易ユーザーストーリー

### ストーリー 1: コードレビュアーが新しい regression を機械的に検出できる 🔵

**私は** コードレビュアー **として**
**stale-comment / `as any` / `: any` 注釈の新規 site が ship される
直前に RED で止まることを期待する**
**そうすることで** レビュー時に「この confession は実測に置換済みか」
「この narrowing は `unknown` 経由か」を毎回確認するコストを削減できる

**関連要件**: REQ-396-001, REQ-396-002, REQ-397-001, REQ-397-003

### ストーリー 2: 次世代メンテナーが census family の全体像を把握できる 🔵

**私は** 新規参加メンテナー **として**
**audit-pass-first census が現在どの facet を cover しているか・各
census がどの class を対象にしているかを一覧で参照したい**
**そうすることで** 新規 facet を追加する際の手順（family registration
+ three-way guard 更新 + ALLOWED/ERADICATED 規約）を誤らずに済む

**関連要件**: REQ-205, REQ-301, REQ-302, REQ-401〜405

### ストーリー 3: リファクタ担当が `any` を `unknown` へ移行する動機づけを得る 🟡

**私は** リファクタ担当 **として**
**any-annotate-census の ERADICATED 候補 row を見て「ここを
`unknown` に書き換えれば ERADICATED 1 件消える」という具体的な目標を得たい**
**そうすることで** boundary external input 以外で蔓延する `any` を
優先順位付きで段階的に削減できる

**関連要件**: REQ-397-003, REQ-397-004, REQ-397-006

## 基本的な受け入れ基準

### REQ-396-001: stale-comment-census 検出ロジック 🔵

**Given（前提条件）**: REQ-391〜394 の `walkProductionSurface` が
src/ + `@stv-core/core-four` の surface を列挙済み
**When（実行条件）**: stale-comment-census test を jest で実行
**Then（期待結果）**:
- confession / disclosure / marker / self-claim の 4 軸で hit した
  site の file:line:column が列挙される
- ALLOWED / ERADICATED の 2 分類で初期 roster と一致
- 4-space 継続行・comment 行の counter liveness は REQ-394 規約に準拠

**テストケース**:
- [ ] 正常系: 4 軸 regex がそれぞれ最低 1 site を hit する 🔵
- [ ] 正常系: 検出 site が `walkProductionSurface` 列挙 surface の
  範囲内に限定される（test 除外規約）🔵
- [ ] 異常系: `/** */` doc-comment は検出されない 🔵
- [ ] 異常系: 複数軸同時 hit する site は 1 度のみ計上される 🔵

### REQ-397-001: type-narrow-as-any census 検出ロジック 🔵

**Given**: `walkProductionSurface` 完了
**When**: type-narrow-as-any census test を実行
**Then**:
- `as any` / `as any as` / `// @ts-ignore` / `// @ts-expect-error` の
  4 軸で検出
- 検出 site に ALLOWED（test-mock / json-parse-narrowing /
  external-boundary / third-party-type-gap の 4 分類）と ERADICATED
  （generic cast）が mark される
- ERADICATED 各 row は negative anchor regex で backup される

**テストケース**:
- [ ] 正常系: 47 site のうち ALLOWED 比率が事前 audit と一致 🔵
- [ ] 異常系: ESM test mock の `as any` は test 除外で hit しない 🔵
- [ ] 境界値: multiline cast（`as\n  any`）は discovery 上限で
  検出されない旨を header に明記 🔵

### REQ-397-003: any-annotate census 検出ロジック 🔵

**Given**: `walkProductionSurface` 完了
**When**: any-annotate census test を実行
**Then**:
- `: any` 注釈 / `<any>` 汎用型 / `any[]` bare array の 3 軸で検出
- boundary（external-input / third-party-sdk / migration-shim /
  dynamic-config-load）以外は ALLOWED に上げられない
- `unknown` 移行可能な ERADICATED 候補は個別 row で site 引用必須

**テストケース**:
- [ ] 正常系: 32 site のうち boundary 分類が事前 audit と一致 🔵
- [ ] 異常系: `unknown` 注釈は any-annotate に hit しない 🔵
- [ ] 境界値: `Record<string, any>` は `<any>` 軸で 1 度のみ計上 🔵

### REQ-205: REQ-395 three-way guard family registration 🔵

**Given**: REQ-395 three-way guard が REQ-391〜394 を family 1〜4 と
  して登録済み
**When**: 3 guard を新規 ship
**Then**:
- `census-artifact-three-way.test.ts` の THREE_WAY table に family 5/6/7
  行が追加される
- phrase は各 guard の実測 roster から構築され requirements.md verbatim
  含有が要求される
- `census-pin:F5:` / `census-pin:F6:` / `census-pin:F7:` doc marker
  が各 guard の header に付与される

**テストケース**:
- [ ] 正常系: family 5/6/7 行が THREE_WAY table に存在 🔵
- [ ] 異常系: roster を 1 件変更して spec 編集なし → RED 🔵
- [ ] 異常系: spec 数値のみ更新して roster 未変更 → RED 🔵

## 最小限の非機能要件

- **パフォーマンス**: 3 guard 合計の実行時間が 30s 以内
  （REQ-394 census 6/6 GREEN で 26s 実測・新規 3 guard は同等規模
  のため +10s 程度を想定）🔵 *既存実測*
- **保守性**: REQ-391 ALLOWED 分類規約（reason 必須・5 分類命名）に
  3 guard が揃うこと。命名揺れは REQ-402 reason-hygiene RED で
  機械検出 🔵 *REQ-391 規約*
- **境界整合**: REQ-395 three-way guard の family 1〜4 に新規 3 family
  が追加され、counter liveness（quoted key・bare identifier key・
  comment 行・不在 block）が全 family で一貫 🔵 *REQ-395 規約*

## Edgeケース

### 検出精度の境界

- **EDGE-101**: multiline confession / cast / annotation は discovery
  上限で検出されない（header に明記）。multiline 候補の代表例を
  negative anchor で別途捕捉する backup を必須とする 🔵 *REQ-393
  precedent*

- **EDGE-102**: `eslint-disable-next-line` / `eslint-disable` 行は
  `// @ts-ignore` と同型で type-narrow-as-any の軸に含めるか別
  census とするかを ERADICATED row の site 引用で明示する 🔵

### spec 整合

- **EDGE-201**: 3 guard 新設で `census-artifact-three-way.test.ts`
  の THREE_WAY table が更新される際、REQ-395 の drift 教訓に従い
  phrase は**実測 roster から構築**され spec 数値と一致することを
  pin する 🔵 *REQ-395 教訓*

- **EDGE-202**: ALLOWED row の理由が「test-mock」の site は src/
  配下では 0 件であるべき（test 除外規約）。src/ 配下に test-mock
  分類の row が出現した場合は ALLOWED 規約違反として RED 🔵 *test
  除外規約*

## 関連文書

- **分析記録**: [interview-record.md](interview-record.md)
- **コンテキストノート**: [note.md](note.md)
- **親 census series**: REQ-391〜395 in [speech-to-visuals/requirements.md](../speech-to-visuals/requirements.md)
- **直近 predecessor**: [TASK-0277](../speech-to-visuals/tasks/TASK-0277.md)（REQ-395 three-way guard + ratchet teardown）