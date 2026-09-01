# rounding-mode census（同一式への Math.round/floor/ceil 混在）要件定義書（軽量版）

<!-- spine:anchor:begin -->
> **Spine anchor**: [Speech-to-Visuals システム憲法 V2.8](../../SYSTEM_CONSTITUTION.md)
>
> - parent: `SYSTEM_CONSTITUTION.md`
> - role: `feature_root`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-24
**要件ID**: REQ-404（Phase 205 / TASK-0289・0290・family 13）

## 概要

REQ-403（boundary strictness census・family 12）が**比較側**の境界解釈分裂
（同一 metric×threshold への strict/inclusive 演算子混在）を census で閉じた
のに対し、本要件は同じ境界 class の**出力側**を閉じる: 同一の正規化済み式が
複数 site で異なる Math mode（`round` / `floor` / `ceil`）で丸められる
mixed-rounding cluster の全数 census。

演算子選択が style でない理由: strict と inclusive が閾値ぴったりで不同意する
ように、`round` と `ceil` は**整数でない積すべて**で不同意する
（`2.04s × 30fps = 61.2` → round 61 / ceil 62・常に 1 frame 差）。2 つの
code path が「この duration は何 frame か」を異なる mode で計算すると、片方は
もう片方が保持する末尾の内容を静かに落とす — off-by-one-frame class であり、
従来は単発発見だったのを census で閉じる（REQ-403 が応えたのと同じ
make-run steering の "closed by census rather than by one-off discovery"
META-intent の継続）。

実測（family 13 discovery・production surface = repo src/ + installed
@stv/core core-four）: rounding site 242 / cluster 188 のうち mixed cluster は
**1 件のみ** — `duration * fps`:

| site | mode | 契約 |
|------|------|------|
| `src/export/animated-scene-renderer.ts:198` | `round` | **per-scene** Lottie layer frame 数。最近接 frame 構文（fade keyframe は公称 0.3s 目盛りに最も近い frame に置く・単調性 clamp `Math.floor(totalFrames/2)` はこの count から derive） |
| `src/export/enhanced-export-engine.ts:596` | `ceil` | **whole-export** render frame 数（`FrameData[]` 長）。coverage 構文（round サイズの render loop は最大半 frame の末尾内容を切り詰めうる・ceil は末尾を落とさない） |
| `src/workers/export-worker.ts:39` | `ceil` | engine 計算の worker 側 mirror（同一の whole-export 量・engine が自前の totalFrames を `buildFramesFromWorkerResult` に渡すため両者は同一 mode でなければならない） |

この cluster は **ALLOWED 分類**（unify ではなく）: `duration` identifier が
指す量が site 間で異なる（clamp 済み per-scene 秒 vs export 全体秒）という
"genuinely different domains の same-token 偶然" — REQ-403 が ALLOWED 概念と
して予言した shape の初の実測 instance。unify は不整合に見せかけた回帰になる
（pinned Lottie keyframe 契約を引き伸ばすか、export 末尾を under-cover するかの
いずれか）。

**信頼性レベル凡例**: 🔵 実測・既存正典・実 tree 観測から確実 / 🟡 拡張仮説・妥当な推測 / 🔴 未測定

**census pin**: `<!-- census-pin:F13:rounding-mode ALLOWED 3 key / ERADICATED 0 key -->`
（guard header と本書の併記 — three-way guard が roster 実測との一致を検証）

## 関連文書

- **分析記録**: [💬 interview-record.md](interview-record.md)
- **コンテキストノート**: [📝 note.md](note.md)
- **タスク概要**: [📋 tasks/overview.md](tasks/overview.md)
- **先行正典**: REQ-403 boundary-operator census（比較側の境界 class・`GOOD_DETECTION_CONFIDENCE_THRESHOLD` 0.6 正典）
- **先行 guard**: REQ-395 three-way（family 登録の規約）・REQ-402 spine edge census（本 spec landing の atomicity を強制）

## 主要機能要件

### 必須機能（Must Have）

- REQ-404-001: システムは `tests/guards/rounding-mode-census.test.ts` を新設し、
  production surface（repo src/ + installed @stv/core core-four・他 census guard
  と同一の `walkProductionSurface`）を `Math.(round|floor|ceil)(` call shape で
  sweep すること。引数は**行内**で paren balance が閉じる場合のみ抽出し
  （複数行に wrap する call は ceiling として対象外・実測 231 call 中 2 件）、
  comment 行は skip すること（prose の丸め引用は decision ではない）🔵 *実測 baseline: rounding site 242 / cluster 188（family 13 discovery 手法の機械的抽出）*
- REQ-404-002: システムは site を**空白正規化済み引数 text** で cluster 化し
  （`duration  *  fps` ≡ `duration * fps`）、同一 cluster 内に 2 種以上の mode
  が存在する場合を mixed-rounding candidate として違反判定すること。operand
  順は正規化しない（`fps * duration` は別 cluster — 意味的同型の別綴りは
  single-source canon family の管轄とし ceiling として明示）🔵 *正規化の必要性は実測 whitespace 揺れで実証・commutation 除外は design decision*
- REQ-404-003: システムは tree を mixed-rounding cluster の**未分類 site
  exact-0** で検証し、ALLOWED roster は実測 1 cluster 3 site（`duration * fps`
  の 2 domain 分割・各 site に domain 理由を記載）で ship すること。ERADICATED
  は confirmed-zero（本 facet は unify ではなく分類で閉じたため）とし、新規
  mixed cluster は分類か unify のいずれかを経るまで RED を継続すること 🔵 *REQ-391〜403 audit-pass-first census pattern の roster pin 踏襲（ALLOWED 非空初適用は REQ-399 と同型）*
- REQ-404-004: システムは negative anchor で分類済み 3 site の mode を固定
  すること（`Math.round(duration * fps)` @ animated-scene-renderer・
  `Math.ceil(duration * fps)` @ enhanced-export-engine / export-worker）。
  mode の flip は stale-row / completeness / anchor のいずれかで RED になる
  こと 🔵 *3 site の実測 shape と ALLOWED 理由の機械的固定*
- REQ-404-005: システムは REQ-395 three-way guard に family 13 として REQ-404
  行を登録し（requirementsPath = 本書・`ALLOWED ${n} key` / `ERADICATED ${n} key`
  phrase）、census-pin marker `F13:rounding-mode` を guard header に併記する
  こと 🔵 *family 12 登録（boundary）と同一手順*
- REQ-404-006: 本 spec 一式（requirements / note / interview-record /
  tasks/overview / TASK-0289・0290）の landing は REQ-402
  SPEC_LANDING_ATOMICITY を dogfood すること: 各 file の anchor block と
  parent 側登録（architecture.md children 2 件・design-interview.md children
  1 件・speech-to-visuals/note.md references 1 件）を同一 commit に同梱し、
  spine-edge census が同 commit 内で GREEN になることで atomicity を実証する
  こと（sweep commit 残さず）🔵 *REQ-402-006 / REQ-403-006 の踏襲・REQ-402 guard が構造的に強制*
- REQ-404-007: mutation 検証（MW-068）は (a) roster 外 file への新規 mixed
  cluster 注入（`Math.floor(duration * options.fps)` probe・未判定 cluster の
  全 site が RED）、(b) engine 側 `ceil`→`round` flip（worker の ceil が
  cluster を mixed 保持するため ALLOWED row は live のまま — 検出は negative
  anchor 単独）、(c) renderer 側 `round`→`ceil` flip（cluster 単一 mode 化に
  よる stale-row 3 件 + anchor）の 3 独立 mutation で RED を実測し、
  mutation-witness ledger に 5 列 template 行を記載して PINNED_MIN_ENTRIES を
  64 に上げること 🔵 *Phase 197 で確立した実装+MW+receipt 単一 commit 同梱規約・(b)(c) の検出経路差は Phase 206 実測で確定*

### 基本的な制約

- REQ-404-008: discovery の盲点は spec に明示すること — (a) 複数行 wrap call
  は対象外（行内 paren balance のみ・実測 2/231）、(b) clustering は引数の
  text 完全一致（空白正規化のみ）で operand 順・変数名違い・意味的同型綴り
  （`durationMs / 1000 * fps`）は join しない、(c) Math 以外の丸め
  （`x | 0`・`toFixed` + Number・bitrate trick）は対象外（別 idiom・別契約）。
  これらは ceiling として guard header に doc comment で宣言すること 🟡 *regex based discovery の構造上の限界の明示（sibling census と同じ誠実さの慣行）*

## 簡易ユーザーストーリー

### ストーリー1: frame 数の末端切り詰め根絶

**私は** 動画 export 利用者 **として**
**どんな duration でも**（整数 frame に落ちないものも含めて）
**render loop が末尾 frame を落とさない coverage 計算と keyframe が最近接 frame に置かれる Lottie が**
**意図した通りの長さ・タイミングで出力される。

**関連要件**: REQ-404-003・REQ-404-004

### ストーリー2: 新規 mixed-rounding の即時検出

**私は** 未来の実装者 **として**
**既存の式を別 mode で丸める code を書き込んだときに**
**guard が即 RED で差し戻すことで**
**1 frame の境界分裂が land する前に分かる。

**関連要件**: REQ-404-003

## 基本的な受け入れ基準

### REQ-404-001〜004: rounding-mode census guard

**Given（前提条件）**: production surface に rounding site 240+ / cluster 185+ が存在する
**When（実行条件）**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns rounding-mode-census` を実行する
**Then（期待結果）**: 未分類 mixed-rounding site exact-0（ALLOWED 3 key / ERADICATED 0 key）で GREEN・合成 fixture が off-by-one-frame shape（空白違い同一 cluster 検出・一貫 mode 不検出・operand 順 ceiling・3 mode 検出・複数行 / comment 対象外・nested paren 引数）を検証する

**テストケース**:

- [x] **TC-404-01**: real tree 未分類 site exact-0 + site/cluster floor pin
  （242/188 baseline・`>= 240` / `>= 185`）🔵
- [x] **TC-404-02**: 分類済み 3 site の negative anchor
  （`Math.round(duration * fps)` ×1・`Math.ceil(duration * fps)` ×2）🔵
- [x] **TC-404-03**: liveness — 空白違い同一 cluster 検出・一貫 mode 不検出・
  commutation（`fps * duration`）不検出・3 mode cluster 全 site 検出・comment 行 /
  複数行 wrap 対象外・nested paren 引数の完全 text cluster key 🔵
- [x] **TC-404-04**: three-way REQ-404 行 GREEN（ALLOWED 3 key / ERADICATED 0 key
  phrase 一致）・authority list 9 family 🔵

### REQ-404-006: atomic landing の dogfood

**Given**: 本 spec 一式が未登録の状態
**When**: spine-edge census を実行する
**Then**: `PARENT_UNREGISTERED` で RED → parent 側 4 登録を同 commit で追加すると GREEN

### REQ-404-007: MW-068 mutation 検証

**Given**: guard が GREEN の tree
**When**: 3 独立 mutation（新規 mixed cluster 注入・engine mode flip・renderer mode flip）を適用する
**Then**: 各 mutation で census が RED（completeness / stale-row / negative anchor）・revert で GREEN 復元

## 最小限の非機能要件

- **性能**: census は production surface 全走査（regex 行 scan のみ）で秒単位。
  guard suite の実行時間を増やさない
- **保守性**: guard は既存 `freeze-guard` helper（`readSource` /
  `isCommentLine` / `walkProductionSurface`）のみに依存し、純関数の discovery
  primitive は export して liveness test が合成 fixture で検証。実装は tests/
  配下（規模集計の実装予算外）
