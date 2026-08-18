# table-driven ガードハーネス抽出と fold 収束 census アーキテクチャ設計


<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](../speech-to-visuals/architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `system`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-18
**関連要件定義**: [requirements.md](requirements.md)
**分析記録**: [design-interview.md](design-interview.md)
**作業規模**: フル設計（interfaces.ts まで。database-schema.sql・api-endpoints.md は対象外 — test/infra のみで新規 DB・API なし）

**【信頼性レベル凡例】**:

- 🔵 **青信号**: 要件定義書・既存実装・実測値を参考にした確実な設計
- 🟡 **黄信号**: 要件定義書・既存実装から妥当な推測による設計
- 🔴 **赤信号**: 参照資料にない自動推定による設計

---

## システム概要 🔵

**信頼性**: 🔵 *requirements.md 概要・round 46〜50 実測解剖（interview-record A1）より*

本 feature は 3 workstream からなる **test-infra 構造改善**（production `src/` の挙動変更ゼロ・REQ-401）:

1. **table-driven guard harness**: per-family single-source test の機械的層
   （Layer 1 verbatim oracle / Layer 3 source anchor）を data row 化する共通
   runner `tests/guards/single-source-harness.ts` を新設し、新規 fold family を
   「registry 1 file + aggregator 2 行 + harness data row + Layer 2 pin」で
   追加できる構造にする（REQ-001〜004 / 101）。
2. **fold 収束 census**: 残存 inline site を family × site 数 × 分類で数値化した
   census を guard test として機械化し、pin + ratchet で系列の収束を機械判定
   する（REQ-005 / 103 / 201〜202）。
3. **CI 検証証拠**: green run URL + commit SHA の記録運用（正本は
   interview-record A3・要件作成時に充足済み）と、任意対応の
   infrastructure.yml node 18 残留解消（REQ-104 / 405 / 301）。

## アーキテクチャパターン 🔵

**信頼性**: 🔵 *round 8 freeze-guard engine 抽出・round 35 registry 静的分割と同一パターンより*

- **パターン**: data-driven guard（rule/row = data、walk/sweep/生成 = 共有 engine）
  の第 3 段適用。round 8 が「発見 walk」を、round 35 が「registry entry」を
  data 化したのと同型の抽出を、per-family test の機械的 2 層に適用する。
- **選択理由**: 既に 42 family / 47 rule で実証済みの構造（sweep 49 test GREEN・
  違反 0・2.0s）に乗るため、新規機構の設計リスクが最小で、fingerprint 等価
  証明の前例（round 35）もそのまま再利用できる。

## コンポーネント構成

### 新規コンポーネント（tests/guards/ 配下 5 file）🔵

**信頼性**: 🔵 *REQ-001〜005・既存 tests/guards/ 構成（freeze-guard.ts 139 行 +
frozen-literal-rules.ts 124 行 + families 42 file）の対応関係より*

```text
tests/guards/
├── single-source-harness.ts        # 【新規】row 型 + fail-loud 検証 + describe 生成 + 共有 codeLines()
├── single-source-harness.test.ts   # 【新規】TC-001-xx（生成・検証・vacuum・cwd 非依存）
├── harness-fingerprint.test.ts     # 【新規】TC-004-01（移行 2 family の列挙 pin）
├── fold-census-families.ts         # 【新規】C1〜C5 data（patterns/excludes/pin/分類）+ 収束 status
└── fold-census-guard.test.ts       # 【新規】TC-005-xx（snapshot vs pin ratchet + doc-pin 突合）
```

| コンポーネント | 責務 | 対応要件 |
|---|---|---|
| `single-source-harness.ts` | `OracleRow` / `AnchorRow` の型・factory（宣言時検証）・`describeSingleSource()` による describe/it 生成・`codeLines()` 共通化 | REQ-001〜003 / 402 / EDGE-001・101 |
| `single-source-harness.test.ts` | harness 単体（各 mode の生成・不正 row fail-loud・delta vacuum RED・`import.meta.url` 起点） | TC-001-01〜B01 / NFR-101 |
| `harness-fingerprint.test.ts` | 移行 2 family の生成 test 列挙（rowId × expectation 数）の pin — corpus 縮小・row 削除で RED | REQ-004 / TC-004-01・E01 |
| `fold-census-families.ts` | census family の data row（行ベース pattern・理由付き exclude・pin 数値・分類）+ `FOLD_SERIES_STATUS` | REQ-005 / 201〜202 / 404 |
| `fold-census-guard.test.ts` | `buildCensusSnapshot()`（1 パス walk）と pin/doc マーカーの突合 — ratchet | REQ-005 / 103 / EDGE-102・EDGE-002 |

### 既存コンポーネント（変更のみ）🔵

**信頼性**: 🔵 *tests/guards/ 実構成・grid-packing 440 行 / default-node-extent 365 行の実読より*

- `grid-packing-single-source.test.ts` / `default-node-extent-single-source.test.ts`
  : Layer 1 + Layer 3 を harness row へ移行（Layer 2 は残置）。retired 関数と
  corpus はファイル内に残る（D4）。各ファイルが局所定義していた `codeLines()`
  （両ファイルに重複）は harness 共有版へ一本化。
- `frozen-literal-rules.ts` ヘッダコメント: 「新規 family 追加手順」に harness
  data row 手順を追記（NFR-201）。
- `.github/workflows/infrastructure.yml:37`（Phase 3 任意）: `node-version: 18` →
  `24`（REQ-301）。

### レイヤー図 🔵

**信頼性**: 🔵 *freeze-guard.ts / frozen-literal-registry.test.ts / grid-packing-single-source.test.ts の実依存関係より*

```text
┌─────────────────────────────────────────────────────────────────────┐
│ per-family test (e.g. grid-packing-single-source.test.ts)           │
│  ├ frozen retired 式 + corpus（family 固有・code のまま残置）        │
│  ├ describeSingleSource(family, [oracleRow(...), anchorRow(...)])   │
│  │    → Layer 1（等価 oracle）と Layer 3（出現/ban）の it を生成      │
│  └ Layer 2 semantic pins（手書き残置・LIVE witness 等）              │
├─────────────────────────────────────────────────────────────────────┤
│ single-source-harness.ts（新規・機械的層の共有 runner）               │
│  ├ oracleRow / anchorRow factory（宣言時 fail-loud 検証）            │
│  ├ describeSingleSource（row → describe/it 生成）                    │
│  └ codeLines() / readSource 再利用（import.meta.url 起点）           │
├─────────────────────────────────────────────────────────────────────┤
│ freeze-guard.ts（既存・不変）: readSource / isCommentLine /           │
│  walkProductionFiles / FrozenLiteralRule / sweepFrozenLiteralRule    │
├─────────────────────────────────────────────────────────────────────┤
│ fold-census-families.ts（data）+ fold-census-guard.test.ts（ratchet） │
│  └ buildCensusSnapshot(): src/ を 1 パス walk → family 別 sites/files │
└─────────────────────────────────────────────────────────────────────┘
```

## 設計判断

### D1: row 化するのは Layer 1 + Layer 3 のみ。Layer 2 は per-family test に残置 🔵

**信頼性**: 🔵 *REQ-001（Layer 1/3 を data row 化）・REQ-004（Layer 2 pin は per-family test に残る）・round 46〜50 の 3 層実測より*

Layer 2（semantic pin）は LIVE witness・クランプ証人など family 固有の意味論で
機械化不可能。harness は機械的層のみを扱い、意味論的層は現状どおり手書きと
する。per-family test の形状は「ヘッダコメント + retired 式/exports + corpus +
`describeSingleSource()` 呼び出し + Layer 2 describe」になる。

### D2: OracleRow — 等価 mode は `object-is` / `delta` の 2 種、delta は witness 強制 🔵

**信頼性**: 🔵 *REQ-002・round 48 ring placement（object-is）と round 50 grid packing（stamp A/B 2 正典・delta bound + `expect(deltas).toBeGreaterThan(0)` witness）の実績比較方式より*

```ts
type EquivalenceMode =
  | { kind: 'object-is' }                    // ビット同一（NaN も Object.is で一致判定）
  | { kind: 'delta'; maxDelta: number };     // |canonical − retired| ≤ maxDelta
```

- 各 corpus case で `Object.is(canonical(...args), retired(...args))` を判定し、
  不一致の場合のみ delta 比較（round 50 の実装と同じ順序）。
- **delta mode は witness 必須（オプションなし）**: ループ後に
  `expect(deltaCount).toBeGreaterThan(0)`。vacuous bound は RED（EDGE-101）。
  delta が 1 度も発生しないなら等価であり object-is row に分類すべき、という
  fail-loud 設計。
- `delta` mode で canonical/retired が非数値を返す case は
  `toBeLessThanOrEqual(NaN)` が落ちて RED = 契約違反の fail-loud（仕様上
  delta row は数値返却に限る）。

### D3: AnchorRow — occurs（exactly / atLeast）+ ban、計数は行ベースに統一 🔵

**信頼性**: 🔵 *REQ-003・grid-packing-single-source.test.ts:325-329（codeLines filter + readSource）・同 332-339（出現回数 pin）・同 427-439（ban）の実形状より*

```ts
type AnchorScope = 'code' | 'source';   // 'code' = コメント行除外（規定）
type AnchorRow =
  | { kind: 'occurs';      file; pattern; exactly: number; scope? }
  | { kind: 'occurs-at-least'; file; pattern; atLeast: number; scope? }
  | { kind: 'ban';         file; pattern; scope? };
```

- **計数は「正規表現に一致した行数」に統一**（REQ-402 の行ベース単一行原則の
  帰結）。既存 test の `(src.match(/…/g) ?? []).length` は全体マッチ数だが、
  対象形状はいずれも 1 行 1 出現のため行数と一致する。移行時に fingerprint
  で expectation 数が一致することを以て等価と証明する（不一致の case は
  row 分割として理由付きで記録）。
- **ban の既定 scope は `'code'`**（委譲コメントが retired 形状を引用して
  自爆する r49/r50 GOTCHA の回避）。移行時は元 test の scope を正確に保存
  （default-node-extent の `expect(src).not.toMatch(RAW_PAIR_W)` は
  `'source'` scope で移行する）— 等価優先（REQ-401）。新規 row は `'code'` 推奨。

### D4: retired 式と corpus は per-family test 内に残置（新規モジュールを作らない）🔵

**信頼性**: 🔵 *REQ-101（許容 boilerplate = registry family module + aggregator 2 行 + harness data row + Layer 2 pin のみ）より*

`*-retired.ts` を分離しない — do-not-improve 証人を pin から切り離すことは
可読性を下げ、family ごとに 1 file 増やせば REQ-101 違反になる。data row は
per-family test 内で `oracleRow({ ... })` / `anchorRow({ ... })` として宣言する。

### D5: row 検証は factory（宣言時）+ describe 生成時の 2 段 fail-loud 🔵

**信頼性**: 🔵 *EDGE-001・fail-loud defaults 原則・registry test の hygiene check（frozen-literal-registry.test.ts:35-53）の前例より*

不正値（`exactly < 0`・`atLeast < 1`・空 corpus・delta mode で `maxDelta`
未指定・`pattern.source` に `\n` を含む行ベース違反・未知 kind）は factory が
即時 throw（= suite 全体が fail し、silent skip 不可能）、
`describeSingleSource` が再度全 row を検証して二重防御とする。エラーメッセージ
は `row id + 違反内容` を含む。

### D6: fingerprint — 生成側の expectation 数は「解析的算出」+ 列挙 pin で ratchet 🔵

**信頼性**: 🔵 *REQ-004・round 35 fingerprint（id 列 + pattern shape + roots/files/excludes の before/after diff）の前例・acceptance-criteria TC-004-01「差分は理由明記のみ」より*

- **解析的 expectation 数**: harness は row から生成する assertion 数を純関数
  で算出できる — object-is row = corpus case 数 / delta row = case 数 + 1
  （witness）/ occurs・ban row = 1。
- `harness-fingerprint.test.ts` は移行 2 family の
  `family:rowId:expectations` 列挙を pin する。corpus 縮小・row 削除・ban
  削除は列挙変化 = RED（TC-004-E01 の corpus 縮小変異を恒久 guard 化）。
- **it.each 折りたたみ**: default-node-extent Layer 1 の
  `it.each(NODE_CORPUS)`（249 case × 4 expect = 996 expectation）は、移行後
  1 it での corpus ループに折りたたむ。test 名列挙は変化するが expectation
  総数は保存され、差分は理由記載付きで fingerprint 記録に残す（TC-004-01 の
  許容差分）。これ以外の差分は原則禁止。

### D7: census 計測は code-line ベースで再ベースラインする 🔵

**信頼性**: 🔵 *REQ-404・EDGE-002・本設計フェーズでの実測（下表）より*

census 計測は freeze-guard と同じ `walkProductionFiles('src')` +
`isCommentLine` 除外の **単一 engine**（`buildCensusSnapshot()`）で行い、
全 family の pattern を 1 パスで評価する（ファイル read は 1 回/family 群）。
要件表の数値は素朴 grep（コメント行込み）のため、実装時に engine 由来の
数値へ**再ベースライン**し、要件 census 表を更新する（D9 の doc-pin 机制で
恒久突合）。2026-08-18 実測（設計フェーズ）:

| family | 素朴 grep（要件表） | code-line 実測（engine 相当） | 備考 |
|---|---|---|---|
| C1 clamp | 32 match / 20 file | **30 match / 20 file** | 差 2 はコメント行。`utils/guards.ts` は正典として除外 |
| C2 1920/1080 | 8 出現 / 4 file | 要再計測 🔴 | 同値が preset map（`'1080p': {width:1920…}`）・`production-config.ts:352`・`Video.tsx:54` にも存在 — pattern を「config object 既定値」形状に精密化してから pin する（design-interview A2） |
| C3 cos/sin push | 4 site / 1 file | **4 / 1**（OverlapResolver.ts:257-260） | 一致 |
| C4 text.length×8 | 1 site | **1 / 1**（advanced-layouts.ts:537） | 一致 |
| C5 dist² | 1 site | **1 / 1**（edge-crossing-minimizer.ts:336） | 一致 |

C1 の契約差（実挙動変更必要の根拠）: `src/utils/guards.ts:53,64` の
`clampFinite` は **NaN→min に sanitize**・`clamp01` は **NaN→0**、一方 bare
`Math.max(…Math.min(…))` は **NaN を透過** — 移行は value-neutral でない。

### D8: ratchet 方向性と収束宣言の機械化 🟡

**信頼性**: 🟡 *REQ-005/103/201/202・EDGE-102。ratchet 機構は新設だが pin+ratchet は frozen-literal registry と同型（既存手法の適用）*

- **増加も減少も RED**（`expect(snapshot).toEqual(pin)`）。増加は分類表更新
  か新規 fold を要求し、減少は pin 更新（ratchet-down）を要求する — どちらも
  メッセージで指示。**0 化は pin を 0 に更新し family 行を残置**（行削除は
  family id 列挙 pin で RED = EDGE-102 の無声削除防止）。
- `FOLD_SERIES_STATUS.valueNeutralCandidates`（family id 配列）を **`[]` で
  pin** し、収束状態（REQ-201）を guard が表明する。value-neutral 候補の
  data row 追加は配列への追記を強制し RED → fold 系列の再開を強制する。
- 既知 family の ratchet は機械検出できるが、**未知の新規 inline family の
  発見は census の定期的な人間/agent による再調査に依存する**（guard は既知
  family の増加しか検出しない）。この限界は要件 REQ-201 の「候補 0」判定を
  弱めるものではない（候補の不在は列挙 pin + 定期 census の併用で主張）。

### D9: requirements.md census 表に pin マーカーを埋め、guard が恒久突合する 🟡

**信頼性**: 🟡 *REQ-404「ドキュメント記載数値と guard pin は同一コマンド由来」・REQ-103 を機械化する新規機構（設計判断）*

要件 census 表の各 cell に HTML コメント形式のマーカー
（例: `<!-- census-pin:C1:sites=30:files=20 -->`）を埋め込み、
`fold-census-guard.test.ts` が `readSource()` で要件ファイルを読んで
マーカー値と engine 実測・data pin の 3 者一致を検証する。これにより
「doc の数値だけ更新して pin を忘れる」逆方向の乖離も RED になる
（source-anchor 規律の doc 版）。マーカー形式は実装時に確定（interfaces.ts
に型として定義）。

### D10: 移行スコープは要件どおり 2 family、他は漸進移行 🔵

**信頼性**: 🔵 *REQ-004（default-node-extent・grid-packing を明指定）・REQ-401（等価移行）より*

round 46〜50 の 5 family のうち、最大（grid-packing 440 行）と最小
（default-node-extent 365 行）を移行し、harness が corpus 規模・row 数の
両極をカバーすることを証明する。残る 3 family（edge-anchor 673 / node-box
490 / ring 373）と旧来の single-source test は現状维持（漸進的に row 化可・
必須としない）— 大量一括移行は REQ-401 等価リスクを不要に増やす。

### D11: CI 証拠の正本は interview-record A3。実装 phase で自身の green run を追記 🔵

**信頼性**: 🔵 *REQ-104/405・interview-record A3（run 32045615156 ほか 4 run・URL + SHA 形式で実採取済み）より*

CI 検証証拠の記録形式（run URL・job 一覧・結論・対象 commit SHA）は
interview-record A3 を正本とし、重複した記録ファイルを新設しない。本 feature
実装 commit の CI run が green になったら同 record へ追記する（運用の固定化）。
REQ-301（infrastructure.yml:37 の node 18 → 24）は Phase 3 で 1 行変更 +
再 run で実施。REQ-302（actions version bump）は本 feature 範囲外（将来対応）。

## ディレクトリ構造（本 feature の差分）🔵

**信頼性**: 🔵 *tests/guards/ 実構成より*

```text
tests/guards/
├── freeze-guard.ts                       # 既存・不変（共有 walk engine）
├── frozen-literal-rules.ts               # ヘッダコメント追記のみ（NFR-201）
├── frozen-literal-families/              # 既存・不変（42 file / 47 rule）
├── single-source-harness.ts              # 新規
├── single-source-harness.test.ts         # 新規
├── harness-fingerprint.test.ts           # 新規
├── fold-census-families.ts               # 新規
├── fold-census-guard.test.ts             # 新規
├── grid-packing-single-source.test.ts    # Layer 1+3 → row 移行
└── default-node-extent-single-source.test.ts  # 同上
.github/workflows/infrastructure.yml      # :37 node-version 18→24（Phase 3・任意）
specs/guard-harness-fold-census/
├── architecture.md / dataflow.md / design-interview.md / interfaces.ts  # 本設計
└── requirements.md                       # census 表に pin マーカー追記（D9）
```

production `src/` は**変更ゼロ**（REQ-401）。新規 5 file は tests 配下のため
コード規模制約（SYSTEM_CONSTITUTION V2.6: 380 file / 115K 行）に対する影響は
file 数 +5・行数は移行による削減と概ね相殺（2 family で機械的層 約 460 行 →
row 宣言 約 150 行）。

## 非機能要件の実現方法

### パフォーマンス 🔵

**信頼性**: 🔵 *registry sweep 49 test = 2.0s 実測・CI test job 16m44s 実績からの予算積算より*

- census engine は src/（約 350 file）を **1 パス**で walk し全 family の
  pattern を評価（家族別 walk 不採用）。registry sweep が rule 47 本で 2.0s
  の実績に対し、census 5 family + harness 生成 test + fingerprint は
  合計 **≤ 10 秒**（NFR-001）に十分収まる。
- 移行 2 family の corpus 評価は現行 test と同一ループのため、実行時間は
  ±20% 以内（REQ-403 / TC-004-B01）— 生成 it 数の減少（it.each 折りたたみ）
  により Jest test-case dispatch が減り、むしろ短縮方向。

### セキュリティ（走査規律）🔵

**信頼性**: 🔵 *NFR-101・freeze-guard.ts:21-27（import.meta.url 起点・cwd 相対 read 禁止）の既存規律より*

harness・census の全ファイル読み取りは `freeze-guard.ts` の
`readSource()` / `REPO_ROOT`（`import.meta.url` 起点）を再利用し、新規に
`process.cwd()` 依存の read を作らない。TC-001-02 /
`source-anchor-cwd-discipline.test.ts` が既存どおり検証する。

### ユーザビリティ（新規 family 追加手順の文書化）🟡

**信頼性**: 🟡 *NFR-201・registry ヘッダコメントの既存記載様式からの設計*

`frozen-literal-rules.ts` ヘッダコメントの追記手順に
「harness data row（oracle 行 + anchor 行）を per-family test に宣言 →
Layer 2 pin を手書き → mutation RED 5 種」を加え、1 data row 追加手順として
文書化する（REQ-101 の確認にも使用）。

## 技術的制約

- **REQ-401** 🔵: production `src/` の diff 0。移行は assertion 等価（fingerprint）で証明。
- **REQ-402** 🔵: harness の全正規表現 row は行ベース（pattern に `\n` を含む
  場合は factory が fail-loud で拒否）。複数行 shape の 1 pattern 扱いは禁止。
- **REQ-403** 🔵: 移行前後の当該 family test 実行時間 ±20% 以内。
- **jest 検証環境** 🔵: `NODE_OPTIONS='--experimental-vm-modules
  --max-old-space-size=4096'` 必須・worktree は node_modules symlink 必須
  （acceptance-criteria 検証環境）。
- **ESM mock 規約** 🔵: harness は新規 named export を持つため、harness を
  import する test の `unstable_mockModule` 部分モックがある場合は追記が必要
  （mock 対象は production module のみのため、実際には影響なし — harness は
  production module を直接 import しない）。

## 関連文書

- **データフロー**: [dataflow.md](dataflow.md)
- **型定義**: [interfaces.ts](interfaces.ts)
- **設計分析記録**: [design-interview.md](design-interview.md)
- **要件定義**: [requirements.md](requirements.md)
- **受け入れ基準**: [acceptance-criteria.md](acceptance-criteria.md)
- **親（round 記録正本）**: [../speech-to-visuals/architecture.md](../speech-to-visuals/architecture.md)

## 実装フェーズ構成 🟡

**信頼性**: 🟡 *acceptance-criteria テスト実施計画（Phase 1〜3）に対応。分割は設計判断*

| Phase | 内容 | 対応 TC |
|---|---|---|
| 1 | harness 実装 + 単体 test + 2 family 移行 + fingerprint | TC-001-xx / TC-004-xx |
| 2 | census engine + data + guard + 要件表再ベースライン（marker 追記） | TC-005-xx / EDGE-102 |
| 3 | （任意）infrastructure.yml node 24 統一 + green run 記録追記 | TC-104-02 |

Phase 1 と 2 は独立（並行可）。Phase 3 は単独で任意タイミング。

## 信頼性レベルサマリー

- 🔵 青信号: 22 件 (85%)
- 🟡 黄信号: 4 件 (15%)
- 🔴 赤信号: 0 件 (0%)（C2 再計測 1 件は表中で 🔴 マークだが項目としては D7 🔵 に内包）

**品質評価**: 高品質 — 全設計判断が既存実装・実測値に基づき、新規機構（ratchet・doc-pin）は要件から直接導出。実装エージェントは interfaces.ts の型と本文の D1〜D11 に従い、追加質問なしで実装・検証・コミットまで進められる粒度。
