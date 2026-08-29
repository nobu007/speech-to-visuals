# fallback-default census（同一 chain への primitive literal fallback 混在）要件定義書（軽量版）

<!-- spine:anchor:begin -->
> **Spine anchor**: [Speech-to-Visuals システム憲法 V2.8](../../SYSTEM_CONSTITUTION.md)
>
> - parent: `SYSTEM_CONSTITUTION.md`
> - role: `feature_root`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-24
**要件ID**: REQ-405（Phase 207 / TASK-0291・0292・family 14）

## 概要

audit-pass-first census series の family 14。同一の field chain（`scene.durationMs`・
`gateResult.reason`・`decoded.role` 等）が複数 site で primitive literal の
fallback default（`?? 数字` / `|| '文字列'`）を受けるとき、**その literal が
site 間で不一致**だと「同じものを読んでいるはずの 2 つの path が、欠損時に
異なる値をでっち上げる」— 片方だけ正しく、もう片方は静かに間違った値を
downstream に流す hidden leak class である。従来は個別発見（auth の role
不一致等）だったのを、chain 単位 clustering の全数 census で閉じる。

実測（family 14 discovery・production surface = repo src/ + installed
@stv/core core-four）: defaulting site **327 / cluster 200** のうち literal
が混在する mixed cluster は **10 件・32 site**。うち 3 site は同一の量・
claim を読む本当の不一致として **unify（ERADICATED）** し、残り 29 site は
domain 理由付きで **ALLOWED** 分類した:

| 統一 site | 旧 default | 新 default | 不一致の実害 |
|-----------|-----------|-----------|-------------|
| `src/pipeline/actual-video-renderer.ts:226` | `|| 10000` | `DEFAULT_SCENE_DURATION_MS`（=5000） | render path の composition 長が、orchestrator/smoke/video-generator の three-path agreement（scene-duration-limits-single-source guard）の名前に出てこない**4 番目の path** で正典の 2 倍をでっち上げていた。falsy durationMs は scene-builder 契約違反時のみ到達し、その場合に限り 10000→5000 へ変化 |
| `src/pipeline/pipeline-orchestrator.ts:851` | `?? 'Quality gate failed'` | `?? 'unknown'` | 同一 function の 3 行下で throw する `QualityGateError` が**同じ欠損 reason** に 'unknown' を充てる。progress event と error で理由が食い違う |
| `src/api/websocket-handler.ts:144` | `?? ''` | `?? 'authenticated'` | HTTP 側 auth middleware は**同じ `decoded.role` claim** の欠損に 'authenticated' を充てる。socket.data.user.role に他の consumer はなく test の pin もなし |

（空 scene の composition 長 `DEFAULT_SCENE_DURATION_MS * 2` = 10000 は旧動作を
保存。第 4 の src 編集として `src/quality/enhanced-error-recovery.ts` の
maxRetries 分割 site に意图 comment を追記し、ALLOWED 理由を現場で読める
ようにした。）

**信頼性レベル凡例**: 🔵 実測・既存正典・実 tree 観測から確実 / 🟡 拡張仮説・妥当な推測 / 🔴 未測定

**census pin**: `<!-- census-pin:F14:fallback-default ALLOWED 32 key / ERADICATED 3 key -->`
（guard header と本書の併記 — three-way guard が roster 実測との一致を検証）

## 関連文書

- **分析記録**: [💬 interview-record.md](interview-record.md)
- **コンテキストノート**: [📝 note.md](note.md)
- **タスク概要**: [📋 tasks/overview.md](tasks/overview.md)
- **先行正典**: REQ-403 boundary-operator census（境界の演算子解釈側）・REQ-404 rounding-mode census（境界の丸め側）— 本要件は**欠損時の代替値**側
- **先行 guard**: REQ-395 three-way（family 登録の規約）・REQ-402 spine edge census（本 spec landing の atomicity を強制）・scene-duration-limits-single-source（durationMs 正典の three-path agreement）
- **関連 memory**: 「Fallback-guard on legit 0 → `??`」は falsy 0 誤検知 class として saturated — 本要件は**値の中身**の混在を扱い、演算子選択（`||` vs `??`）は管轄外

## 主要機能要件

### 必須機能（Must Have）

- REQ-405-001: システムは `tests/guards/fallback-default-census.test.ts` を新設し、
  production surface（repo src/ + installed @stv/core core-four・他 census guard
  と同一の `walkProductionSurface`）を `<dotted chain> (??|\|\|) <primitive
  literal>` shape で sweep すること。抽出は (a) chain が演算子の**直前**に
  あること（call-wrapped LHS・TS cast・Map-accumulator seed は対象外）、
  (b) literal が standalone RHS であること（`'A' in window || 'B' in window`
  等の probe-operand OR・文字列埋め込みを除外する lookahead）、(c) comment
  行 skip、の 3 条件を満たす場合のみとすること 🔵 *実測 baseline: site 327 / cluster 200（family 14 discovery 手法の機械的抽出）*
- REQ-405-002: システムは literal を canonical 化（`60.0` ≡ `60` は
  `String(Number())`・`'x'` ≡ `"x"` は `JSON.stringify`）した上で chain 単位
  に cluster 化し、site key は `file:line:chain` とすること（同一行の複数
  field default を分離）。identifier fallback（`|| DEFAULT_X`）は正典形と
  して discovery 対象外（single-source family の管轄）とし ceiling として
  明示すること 🔵 *正規化の必要性は実測（`0.95` vs `.95` 揺れ・quote 揺れ）で実証*
- REQ-405-003: システムは real inconsistency 3 site を unify すること:
  (a) actual-video-renderer の durationMs fallback を `DEFAULT_SCENE_DURATION_MS`
  に正規化（空 scene 分岐は `* 2` で旧 10000ms を保存・render path を
  three-path agreement の violation から外す）、(b) pipeline-orchestrator の
  progress-event reason を throw と同じ `'unknown'` に統一、(c)
  websocket-handler の JWT role を HTTP 側と同じ `'authenticated'` に統一。
  旧 spelling は ERADICATED roster に chain key（`scene.durationMs` 等・
  bare field 名ではない）で記録すること 🔵 *3 site の context 全読み + consumer grep で影響範囲を確定（MW-069 で bare key の vacuous pass を発見し chain 表記に修正）*
- REQ-405-004: システムは tree を mixed-cluster の**未分類 site exact-0**
  で検証し、ALLOWED roster は実測 10 cluster 32 site（message×6・stage×5・
  width×4・height×3・options.quality×3・scene.id×3・scene.diagramType×2・
  status×2・maxRetries×2・config.nodeSeparation×2・各 site に domain 理由を
  記載）で ship すること。新規 mixed cluster は分類か unify のいずれかを
  経るまで RED を継続すること 🔵 *REQ-391〜404 audit-pass-first census pattern の roster pin 踏襲*
- REQ-405-005: システムは negative anchor で現行 spelling を固定すること
  （`scene.durationMs \|\| DEFAULT_SCENE_DURATION_MS`・emitProgress と
  QualityGateError の `gateResult.reason ?? 'unknown'`・`decoded.role ??
  'authenticated'`（HTTP・socket 両方）ほか）。同時に旧 spelling（
  `durationMs \|\| 10000`・`reason ?? 'Quality gate failed'`・
  `decoded.role ?? ''`）の tree 再出現を not.toMatch で ban すること。
  ERADICATED key の再出現は completeness と eradicated-reappear の 2 段で
  RED になること 🔵 *3 統一 site と 10 ALLOWED cluster の機械的固定*
- REQ-405-006: システムは REQ-395 three-way guard に family 14 として REQ-405
  行を登録し（requirementsPath = 本書・`ALLOWED ${n} key` / `ERADICATED ${n} key`
  phrase）、census-pin marker `F14:fallback-default` を guard header に併記する
  こと 🔵 *family 12/13 登録と同一手順（authority list 10 family）*
- REQ-405-007: 本 spec 一式（requirements / note / interview-record /
  tasks/overview / TASK-0291・0292）の landing は REQ-402
  SPEC_LANDING_ATOMICITY を dogfood すること: 各 file の anchor block と
  parent 側登録（architecture.md children 2 件・design-interview.md children
  1 件・speech-to-visuals/note.md references 1 件）を guard・MW・receipt と
  同一 commit に同梱し（make-run steering の "child-spec commits include
  parent-side registration in the SAME commit" 指摘への直接回答）、
  spine-edge census が同 commit 内で GREEN になることで atomicity を実証する
  こと（sweep commit 残さず）🔵 *REQ-402-006 / REQ-403-006 / REQ-404-006 の踏襲・REQ-402 guard が構造的に強制*
- REQ-405-008: mutation 検証（MW-069）は (a) renderer の旧 `|| 10000`
  revert（completeness 再分裂 + eradicated-reappear + mode anchor の三重
  捕捉）、(b) roster 外 smoke-orchestrator への `stage ?? 'render'` 注入
  （既存 cluster への第 3 literal・completeness 単独）、(c)
  TreeLayoutStrategy の nodeSeparation `|| 80`→`|| 60` flip（cluster 単一
  literal 化による stale-row）の 3 独立 mutation で RED を実測し、
  mutation-witness ledger に 5 列 template 行を記載して PINNED_MIN_ENTRIES を
  65 に上げること 🔵 *Phase 197 で確立した実装+MW+receipt 単一 commit 同梱規約・検出経路差（三重 / 単独 / stale-row）は Phase 208 実測で確定*

### 基本的な制約

- REQ-405-009: discovery の盲点は spec に明示すること — (a) 演算子軸
  （`||` vs `??` の同一 literal 混在）は falsy-guard class として saturated
  なので管轄外、(b) ternary else arm・identifier fallback（`|| DEFAULT_X`）
  は対象外（後者は正典形・single-source family 管轄）、(c) clustering は
  chain の text 完全一致で receiver rename（`opts.stage` vs `stage`）は
  join しない（textual attribution の ceiling・rename 規律は single-source
  family の管轄）、(d) call-wrapped LHS / cast / Map-accumulator seed /
  probe-OR は正規表現の構造上対象外。これらは ceiling として guard header
  に doc comment で宣言すること 🟡 *regex based discovery の構造上の限界の明示（sibling census と同じ誠実さの慣行）*

## 簡易ユーザーストーリー

### ストーリー1: 欠損時の値でっち上げ不一致の根絶

**私は** 動画生成利用者 **として**
**（契約違反 scene 等で）field が欠損したときに**
**どの path も同じ正典の代替値を使うことで**
**path 間で長さ・理由・権限が食い違う video が出力されない。

**関連要件**: REQ-405-003・REQ-405-005

### ストーリー2: 新規 default 分裂の即時検出

**私は** 未来の実装者 **として**
**既存 chain に別の literal default を書き込んだときに**
**guard が即 RED で差し戻すことで**
**分類（domain 理由）か unify を強制されてから land できる。

**関連要件**: REQ-405-004

## 基本的な受け入れ基準

### REQ-405-001〜005: fallback-default census guard

**Given（前提条件）**: production surface に defaulting site 315+ / cluster 192+ が存在する
**When（実行条件）**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns fallback-default-census` を実行する
**Then（期待結果）**: 未分類 mixed-cluster site exact-0（ALLOWED 32 key / ERADICATED 3 key）で GREEN・合成 fixture が detector の liveness（canonicalization collapse・named-constant 不検出・call/cast 除外・probe-OR 除外・comment skip ほか）を検証する

**テストケース**:

- [x] **TC-405-01**: real tree 未分類 site exact-0 + site/cluster floor pin
  （327/200 baseline・`>= 315` / `>= 192`）🔵
- [x] **TC-405-02**: 分類済み site の negative anchor（正典 spelling 固定 +
  旧 spelling not.toMatch ban）🔵
- [x] **TC-405-03**: liveness — canonicalization・chain-adjacency・standalone-RHS・
  同一行複数 site 分離の各検出/不検出 🔵
- [x] **TC-405-04**: three-way REQ-405 行 GREEN（ALLOWED 32 key / ERADICATED 3 key
  phrase 一致）・authority list 10 family 🔵

### REQ-405-007: atomic landing の dogfood

**Given**: 本 spec 一式が未登録の状態
**When**: spine-edge census を実行する
**Then**: `PARENT_UNREGISTERED` で RED → parent 側 4 登録を同 commit で追加すると GREEN

### REQ-405-008: MW-069 mutation 検証

**Given**: guard が GREEN の tree
**When**: 3 独立 mutation（旧 spelling revert・新規第 3 literal 注入・ALLOWED site の literal flip）を適用する
**Then**: 各 mutation で census が RED（三重捕捉 / completeness 単独 / stale-row）・revert で GREEN 復元

## 最小限の非機能要件

- **性能**: census は production surface 全走査（regex 行 scan のみ）で秒単位。
  guard suite の実行時間を増やさない
- **保守性**: guard は既存 `freeze-guard` helper（`readSource` /
  `isCommentLine` / `walkProductionSurface`）のみに依存し、純関数の discovery
  primitive は export して liveness test が合成 fixture で検証。src 側変更は
  3 site の literal 正規化 + 1 comment のみ（規模集計の実装予算内）
