# dead-idiom batch census（複数 confirmed-zero イディオム class の一括 pin）要件定義書（軽量版）

<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](../speech-to-visuals/architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-25
**要件ID**: REQ-410（Phase 217 / TASK-0301・audit-pass-first census series family 19・**batch 形式**）→ **REQ-411 で sweep #2 拡張**（Phase 218 / TASK-0302）→ **REQ-412 で sweep #3 拡張**（Phase 219 / TASK-0303）→ **REQ-413 で sweep #4 拡張**（Phase 220 / TASK-0304）→ **REQ-414 で sweep #5 拡張**（Phase 221 / TASK-0305）→ **REQ-415 で sweep #6 拡張**（Phase 222 / TASK-0306）→ **REQ-416 で sweep #7 拡張**（Phase 224 / TASK-0307）→ **REQ-417 で sweep #8 拡張**（Phase 225 / TASK-0308）→ **REQ-418 で sweep #9 拡張**（Phase 226 / TASK-0309）→ **REQ-419 で sweep #10 拡張**（Phase 227 / TASK-0310）

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
**kind registry**（`IDIOM_KINDS` 16 entry — REQ-411 sweep #2 で +9）で、
class 追加は 1 entry 追加のみ（steering 契約）。roster は **ALLOWED 3 key** /
**ERADICATED 2 key**（REQ-395 census-artifact three-way 句・実測から build）。

## REQ-411: 第二回 discovery sweep（同一 batch guard への kind 追加）

steering 契約の 2 回目の適用。2026-08-25 の **第二回 discovery sweep** は
同一 production surface（331 file）で **11 candidate class** を計測。
このうち 2 class（`with (…)`・`arguments.callee`）は **pin 前に棄却** —
TS/ESM strict では両方とも SyntaxError で tsc が常時弾くため、guard に
tsc の及ばない teeth が無い（冗長 pin は契約の趣旨に反する）。残る
**9 kind を registry に追加**（確認済み実測）:

| kind | 実測 | 判定 |
|------|------|------|
| direct-eval（`eval(` 直接呼び出し） | 0 | exact-0 pin |
| timer-string-arg（`setTimeout('…')` 文字列引数） | 0 | exact-0 pin |
| typeof-impossible-tag（`typeof x === 'array'` 等の不可能 tag） | 0 | exact-0 pin |
| json-clone-idiom（`JSON.parse(JSON.stringify(…))`） | **1 site（src）** | ALLOWED — 下記 REQ-411-002 |
| comparator-less-sort（comparator なし `.sort()`） | 0 | exact-0 pin |
| instanceof-array（`instanceof Array`） | 0 | exact-0 pin |
| empty-catch（空 catch・単行 shape） | 0 | exact-0 pin |
| legacy-substr（`.substr(`） | 0 | exact-0 pin |
| escape-unescape（`escape(` / `unescape(`） | 0 | exact-0 pin |

steering 第 2〜4 条（TASK-0378・`_TOL_*` 許容差・Fraction 鎖・Makefile
test-performance）は前回 Phase 217 に続き本 sweep でも再確認: 当該シンボル
は本 repo に存在せず（`grep -rn "TASK-0378\|_TOL_" specs docs tests src` 0 件・
Makefile 不在・npm scripts 運用）、**cross-repo contamination で本 repo には
適用不能**（interview-record.md REQ-411 分析を参照）。

## REQ-412: 第三回 discovery sweep（parseint-no-radix 5 site unify 同梱）

steering 契約の 3 回目の適用。2026-08-25 の**第三回 discovery sweep** は
同一 production surface（331 file）で **13 candidate class** を計測
（detector 最終形と同一 regex・comment 行 skip は guard と同一実装）。
このうち 1 class（`Math.pow(a, b)`）は **pin 前に棄却** — `a ** b` と
挙動が完全一致し（負底の小数指数は両方 NaN・非 deopt も同じ）13 実測
site に incident shape がゼロのため、pin は style 嗜好の恒久 roster
noise になるのみ。残る **12 kind を registry に追加**（確認済み実測）:

| kind | 実測 | 判定 |
|------|------|------|
| parseint-no-radix（radix なし `parseInt(s)`） | **5 site（src・同一 file）** | **VIOLATION — 同梱 unify**（`parseInt(…, 10)` 化・下記 REQ-412-002） |
| bitwise-truncation（`~~` / `\| 0`） | 0 | exact-0 pin（`>>> 0` は CRC32/mulberry32 の必須 bit 演算で class 外） |
| legacy-push-apply（`xs.push.apply(xs, ys)`） | 0 | exact-0 pin |
| apply-null-spread（`f.apply(null, args)`） | 0 | exact-0 pin |
| new-function-ctor（`new Function(…)`） | 0 | exact-0 pin |
| deprecated-date-api（getYear/setYear/toGMTString） | 0 | exact-0 pin |
| debugger-statement（stray `debugger`） | 0 | exact-0 pin |
| document-write（`document.write(ln)?(`） | 0 | exact-0 pin |
| arraylike-slice-call（`Array.prototype.slice.call`） | 0 | exact-0 pin |
| constructor-index-access（`.constructor`） | 0 | exact-0 pin |
| from-char-code（`String.fromCharCode(`） | **5 site（src）** | ALLOWED — 全 site が byte-domain（下記 REQ-412-003） |
| proto-key-literal（`__proto__` 出現） | **1 site（src）** | ALLOWED — sanitizer blocklist 自身（REQ-412-004） |

registry は **28 entry**（16 + 12・REQ-412 時点）。roster は **ALLOWED 9 key** /
**ERADICATED 7 key**（REQ-395 census-artifact three-way 句・実測から build）。

## REQ-413: 第四回 discovery sweep（var ambient 宣言 2 site ALLOWED 同梱）

steering 契約の 4 回目の適用。2026-08-25 の**第四回 discovery sweep** は
同一 production surface（331 file）で **10 candidate class** を計測
（detector 最終形と同一 regex・comment 行 skip は guard と同一実装）。
このうち 3 class は **pin 前に棄却**（下記 REQ-413-003）:
`.map(async …)` は可否が**消費側**で決まる（promise 配列が await される
かを行 detector は見られない — pin は純 noise。drop 形の `.forEach(async`
は既存 kind が管轄）、`new Array(n)` preallocation（7 src site）は
sized-assign / `.fill` 済みで hole-read 経路なし、`Math.max(...xs)` 系
spread-apply（25 site）は計測全 site が入力有界（segment group・node
座標・level key — cardinality は ~65k spread-arg 限界より桁違いに小さい）。
残る **7 kind を registry に追加**（確認済み実測）:

| kind | 実測 | 判定 |
|------|------|------|
| primitive-wrapper-ctor（`new Number/String/Boolean(`） | 0 | exact-0 pin |
| arguments-index-access（`arguments[`） | 0 | exact-0 pin |
| regexp-literal-ctor（完全 literal 単一引数 `new RegExp('…')`） | 0 | exact-0 pin（動的構築は class 外） |
| split-join-replaceall（`.split(sep).join(repl)`） | 0（production surface） | exact-0 pin（repo hit 2 件は off-walk `__tests__` fixture） |
| label-statement（`outer: for (`） | 0 | exact-0 pin |
| bare-encodeuri（裸 `encodeURI(`） | 0 | exact-0 pin |
| var-declaration（行頭 `var `） | **2 site（src・同一 file）** | ALLOWED — 両 site とも `declare global { … }` 内の**型のみの ambient 宣言**（REQ-413-002） |

registry は **35 entry**（28 + 7・REQ-413 時点）。roster は **ALLOWED 11 key** /
**ERADICATED 7 key**（REQ-395 census-artifact three-way 句・実測から build）。

## REQ-414: 第五回 discovery sweep（logger・process-exit・toLocaleString の 3 site ALLOWED 同梱）

steering 契約の 5 回目の適用。2026-08-25 の**第五回 discovery sweep** は
同一 production surface（331 file）で **17 candidate class** を計測
（detector 最終形と同一 regex・comment 行 skip は guard と同一実装）。
このうち 3 class は **pin 前に棄却**（下記 REQ-414-003）:
`.charCodeAt(`（15 src site・core 0）は計測全 site が code-unit-domain 正利用
（kana range は BMP・PNG/GIF chunk/header byte は ASCII・octal-escape
builder は Latin-1・security compare は code unit を要求）で fix ゼロ
（`Math.max(...xs)` と同じ投資不釣合型 — astral-plane text math site の
出現時点で再計測）、`if (x = y)` assignment-in-condition は計測 15 hit
全てが condition paren 内の arrow（`=>`）か正典 `while ((m = re.exec(src))
!== null)` loop で行 regex は arrow-fat と assignment-equals を区別でき
ない（検出不可能型）、`.charAt()` は bracket access と挙動等価（out-of-range
'' vs undefined — 両 falsy・incident shape なし・Math.pow と同じ挙動等価型）。
残る **14 kind を registry に追加**（確認済み実測）:

| kind | 実測 | 判定 |
|------|------|------|
| nan-comparison（`x === NaN` 双方向） | 0 | exact-0 pin |
| bitwise-not-indexof（`~xs.indexOf(y)` 系） | 0 | exact-0 pin |
| throw-string（`throw '…'` / `throw \`…\``） | 0 | exact-0 pin |
| legacy-endswith（`.lastIndexOf(x) === s.length - 1`） | 0 | exact-0 pin |
| legacy-datetime-now（`new Date().getTime()/.valueOf()`） | 0 | exact-0 pin |
| unary-plus-date（`+new Date`） | 0 | exact-0 pin |
| concat-empty-coercion（`x + ''`） | 0 | exact-0 pin |
| deprecated-keycode（`.keyCode` / `.which`） | 0 | exact-0 pin |
| caller-callee-access（`.caller` / `.callee`） | 0 | exact-0 pin |
| document-all（`document.all`） | 0 | exact-0 pin |
| array-prototype-generic-call（slice 以外の `Array.prototype.X.call`） | 0 | exact-0 pin |
| console-debug-log（`console.log/debug(`） | **1 site（core）** | ALLOWED — logger 自身の level-gated transport（REQ-414-002） |
| process-exit（`process.exit(`） | **1 site（src）** | ALLOWED — gracefulShutdown の epilogue（REQ-414-002） |
| tolocalestring-bare（引数なし `.toLocaleString()`） | **1 site（core）** | ALLOWED — safeToLocaleString 自身の有限数 delegation（REQ-414-002） |
| legacy-trim-side（`.trimLeft/trimRight(`） | 0 | exact-0 pin（REQ-415-001） |
| regexp-static-property（`RegExp.$1` 系 statics） | 0 | exact-0 pin |
| throw-object-literal（`throw {…}`） | 0 | exact-0 pin（throw-string と同 class） |
| throw-null（`throw null`） | 0 | exact-0 pin（同 class の退化形） |
| javascript-url（`'javascript:'` literal） | 0 | exact-0 pin（inline-handler vector・CSP 違反） |
| blocking-dialog（`alert/confirm/prompt(`） | **1 site（src）** | ALLOWED — GuardMetrics reset 破壊操作の confirm gate（REQ-415-002） |
| legacy-xhr（`XMLHttpRequest`） | 0 | exact-0 pin（fetch が正典） |
| minified-boolean-literal（`!0` / `!1`） | 0 | exact-0 pin |
| esm-require-call（`require(`） | 0 | exact-0 pin（`"type": "module"`・CJS 綴りは runtime crash） |
| esm-module-exports（`module.exports` / `exports.x =`） | 0 | exact-0 pin |
| esm-cjs-global（`__dirname` / `__filename`） | 0 | exact-0 pin |
| node-global-identifier（`global.`） | **5 site（src）** | **VIOLATION — 同梱 unify**（`global.gc` → `globalThis.gc` ×5 行・REQ-415-001） |
| direct-cookie-access（`document.cookie`） | 0 | exact-0 pin |
| useragent-sniffing（`navigator.userAgent`） | **3 site（src）** | ALLOWED — 全 site report-only（telemetry 文脈・browser 名 diagnostics・能力判定は feature detection・REQ-415-002） |
| localecompare-bare（引数 1 つ `.localeCompare(x)`） | 0 | exact-0 pin（default-locale sort drift） |
| intl-bare-default-locale（引数なし `new Intl.X()`） | 0 | exact-0 pin |
| inner-html-assignment（`.innerHTML =`） | 0 | exact-0 pin（XSS sink） |
| window-implicit-event（`window.event`） | 0 | exact-0 pin（IE event model） |
| event-returnvalue（`.returnValue =`） | 0 | exact-0 pin |
| string-html-method（`.bold()` 等 Annex B wrapper） | 0 | exact-0 pin |
| legacy-define-getter（`__defineGetter__` 系） | 0 | exact-0 pin |
| locale-sensitive-bare（引数なし `.toLocaleUpperCase/LowerCase()`） | 0 | exact-0 pin |
| legacy-substring（`.substring(`） | **23 site（src）** | **pin 前棄却 — 投資不釣合型**（全 site が 0-start 切り詰めか min/max 正規化 span で indexA>indexB swap 不可能・fix ゼロ・REQ-415-003） |

registry は **71 entry**（49 + 22・REQ-415 時点）。roster は **ALLOWED 18 key** /
**ERADICATED 12 key**（REQ-395 census-artifact three-way 句・実測から build）。

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
  ERADICATED key の再出現は RED。roster は **ALLOWED 3 key / ERADICATED 2
  key**（REQ-411 で json-clone 1 key 追加）🔵 *実測 331 file walk・baseline
  pin（files >= 300・isFinite/for-in/json-clone 各 >= 1）*
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
  spec は measured roster から build された句 `ALLOWED 3 key` /
  `ERADICATED 2 key` を宣言すること（REQ-411 時点の roster 実測値）🔵 *REQ-395 promoted condition の適用*
- REQ-411-001: 第二回 sweep の 9 kind を同一 registry に追加すること
  （class 追加 = 1 entry・新 spec dir も新 family も作らない）。各 kind の
  detector は liveness fixture (i)〜(q) で検出・非検出の両面を検証すること
  🔵 *fixture (i) eval・(j) timer-string・(k) impossible-tag・(l) json-clone・(m) comparator-less・(n) instanceof・(o) empty-catch・(p) substr・(q) escape*
- REQ-411-002: json-clone-idiom の 1 site
  （`src/optimization/adaptive-content-processor.ts:185`）は **ALLOWED 判断**
  とすること。根拠: (a) `ProcessingStrategy`（同 file :12）は
  string/number/enum-literal のみで構成され round-trip は損失なし、(b)
  `structuredClone` は Node 24 に存在するが **jest vm context には存在しない**
  （2026-08-25 実測 probe: typeof structuredClone === 'undefined' で fail）ため
  unify は test 基盤を破壊する、(c) repo に既存 deep-clone helper なし
  （`structuredClone|deepClone|cloneDeep` production 0 件）。interface に
  non-JSON field（Date/Map/Set/undefined）が加わった時点で再判断（専用
  clone 導入 or helper 化）を要すること 🔵 *実測 probe・型定義読み・ALLOWED row 理由文*
- REQ-411-003: pin 前棄却の記録: `with` 文と `arguments.callee` は
  TS/ESM strict 下で SyntaxError のため **kind にしないこと**（tsc が常時
  弾く class への guard は teeth が tsc と重複し冗長）。棄却判断は spec
  と guard header に記録すること 🔵 *tsc 両 config が baseline 0 である運用（Phase 169）との整合*
- REQ-411-004: empty-catch kind は**単行 shape のみ**を管轄すること
  （`catch (e) {` の `}` が後続行に置かれる形式・inline comment 入り空
  catch は行 detector の死角 — 現存 0 件を detector + `grep -A1` pass で
  確認済み）。ceiling は guard header の Documented ceilings に明記すること 🔵
- REQ-411-005: mutation 検証（MW-075）は新 kind を代表する 3 独立 mutation
  — (a) production file への `eval(` 注入（direct-eval 単独発火）、(b)
  `.sort()` 注入（comparator-less-sort 単独発火）、(c) rostered json-clone
  行の改変（negative anchor + stale-row 二段発火）— で RED を実測し、
  mutation-witness ledger に section を追記すること 🔵 *Phase 197 確立の単一 commit 同梱規約*
- REQ-412-001: 第三回 sweep の 12 kind を同一 registry に追加すること
  （class 追加 = 1 entry・新 spec dir も新 family も作らない・16→28 entry）。
  各 kind の detector は liveness fixture (r)〜(w) で検出・非検出の両面を
  検証すること（`Number.parseInt(v, 10)` 除外 lookbehind・`|| 0` falsy-guard
  と `>>> 0` 必須 bit 演算の除外・`fn.apply(this, args)` 除外・
  `getFullYear`/`createElement` 除外・`Array.from` 除外・`fromCodePoint`
  除外を含む）🔵 *fixture (r) parseint・(s) bitwise・(t) apply-spread・(u) ctor/debugger/document/deprecated・(v) slice-call/constructor・(w) fromCharCode/__proto__*
- REQ-412-002: parseint-no-radix の 5 site（`src/components/ProductionDashboard.tsx`
  :156/:170/:187/:320/:359 — すべて同一 shape `parseInt(e.target.value) || N`
  の number-input handler）は**同一 commit で `parseInt(…, 10)` に unify**
  すること。decimal 文字列の parse 結果は等価（radix 10 は `0x`/legacy `0`
  prefix 以外の default）・spelling は repo 正典形（`api/routes/monitoring.ts:34`
  等）に合流・`parseInt('0x10') === 16` の hex 誘導面を構造的に遮断。
  anchor は 5 site の spelling pin に加え**「5 件すべてが radix 形である
  こと」の count 検証**を含むこと（4/5 の部分 regress を捕捉）🔵 *該当 suite 17/17 GREEN・tsc 両 config 0*
- REQ-412-003: from-char-code の 5 site は **ALLOWED 判断**とすること。
  根拠: 全 site が byte-domain — apng-encoder/export-verifier は PNG/APNG/GIF
  の chunk-type・version 文字列を Uint8Array 要素読み（0..255）から構築し、
  intelligent-cache は RLE marker として固定 255 と `count < 255` loop guard
  で上限された count を渡す。fromCharCode は 0..255 で厳密。**teeth は生存**:
  `String.fromCharCode` は ToUint16 wrap するため code point > 0xFFFF は
  黙って破損し（`fromCharCode(65536) === '\0'`）、新規 site は unrostered
  RED として判断を強制される。`fromCodePoint` への置換は可（同一 commit で
  roster 行を shed する stale-row 連動）🔵 *5 site すべて引数域を実コード読みで確認*
- REQ-412-004: proto-key-literal の 1 site
  （`src/analysis/untrusted-json-core.ts:38`）は **ALLOWED 判断**とすること。
  根拠: hit は prototype-pollution 防御自身の blocklist
  （`PROTOTYPE_POLLUTION_KEYS` の string data）であり object-literal key では
  ない。surface 上の他の `__proto__` 出現は全て comment 行（discovery skip
  対象）。実 `__proto__:` key/assignment は unrostered RED 🔵 *detector 実測 1 hit・残り 4 出現の comment 行確認*
- REQ-412-005: pin 前棄却の記録（REQ-411-003 の系列）: `Math.pow(a, b)` は
  `a ** b` と挙動完全一致のため **kind にしないこと**（13 実測 site は
  backoff/exponent 計算の正当利用。pin は style 嗜好の恒久 ALLOWED noise
  のみを生む）。また bitwise-truncation kind は `~~` / `| 0` のみを管轄し
  `>>> 0`（CRC32/mulberry32 の unsigned coercion）は**意図的に class 外**
  とすることを guard header と本要件に明記すること 🔵 *挙動等価の実証（負底小数指数 NaN・deopt なし）と class 外 scoping の明示*
- REQ-413-001: 第四回 sweep の 7 kind を同一 registry に追加すること
  （class 追加 = 1 entry・新 spec dir も新 family も作らない・28→35 entry）。
  各 kind の detector は liveness fixture (x1)〜(x7) で検出・非検出の両面を
  検証すること（`Number(x)` 非 boxing 呼び出し除外・rest-param `args[0]`
  除外・regex literal と動的 `new RegExp(src, 'i')` 除外・`replaceAll` と
  split 単独除外・plain loop と object key 除外・`encodeURIComponent` 除外・
  `let`/`const` と comment 行除外を含む）🔵 *fixture (x) REQ-413 block*
- REQ-413-002: var-declaration の 2 site
  （`src/transcription/browser-transcriber.ts:497/:502`）は **ALLOWED 判断**
  とすること。根拠: 両 site とも `declare global { … }`（:449）block 内の
  **型のみの ambient 宣言**（`var X: { prototype; new (): T }` — DOM-lib
  正典形の `declare var SpeechRecognition` 相当）で runtime emit ゼロ。
  **teeth は生存**: runtime `var`（hoisting・block scope なし）はどこに
  現れても unrostered RED として判断を強制される。negative anchor は
  `declare global {` block 内の `var SpeechRecognition: {` 共存を pin する
  こと（block 外移動は completeness 発火・別 ambient spelling への変更は
  stale-row 発火）🔵 *declare global が :449 にあることを実コード読みで確認*
- REQ-413-003: pin 前棄却の記録（REQ-411-003・REQ-412-005 の系列）:
  (a) `.map(async …)` は kind にしないこと（可否は**消費側**で決まり行
  detector に見えない — drop 形の `.forEach(async` は既存 kind が管轄）、
  (b) `new Array(n)` preallocation（7 src site）は sized-assign / `.fill`
  済みで incident shape なし、(c) `Math.max(...xs)` 系 spread-apply
  （25 site）は計測全 site が入力有界 — per-site 有界性 prose は
  confirmed-clean class に full family 相当の投資を強いるため**無限界入力
  site が出現した時点で再計測**を guard header に明記すること 🔵 *3 class とも実測 site 全数を読んでの棄却根拠*
- REQ-413-004: mutation 検証（MW-077）は 4 独立 mutation — (a) production
  file への runtime `var` 注入（var-declaration 単独発火）、(b) `new Number(5)`
  注入（primitive-wrapper-ctor 単独発火）、(c) rostered ambient var の
  `var`→`let` 化（stale-row + var-declaration floor >= 2 の 2 面発火）、(d)
  `.split('.').join('-')` 注入（split-join-replaceall 単独発火）— で RED
  を実測し、mutation-witness ledger に section を追記すること 🔵 *4 mutation とも offender list で kind 帰着を確認・revert 後 8/8 GREEN*
- REQ-414-001: 第五回 sweep の 14 kind を同一 registry に追加すること
  （class 追加 = 1 entry・新 spec dir も新 family も作らない・35→49 entry）。
  各 kind の detector は liveness fixture (y1)〜(y14) で検出・非検出の両面を
  検証すること（`Object.is(x, NaN)` と `Number.isNaN` 除外・`includes` と
  単独 `indexOf` 除外・`new Error` throw 除外・`endsWith` 除外・
  `Date.now()`/`getHours()` 除外・binary 文字列連結 `+ new Date()` 除外・
  `String(x)`/`+ 'px'` 除外・`e.key` 除外・`.call`/`.map` 除外・
  `Array.from` と slice 形の kind 帰着・`console.info/warn/error` と
  `logger.debug` 除外・`process.exitCode` 除外・explicit-locale と
  helper 経由除外を含む）🔵 *fixture (y) REQ-414 block*
- REQ-414-002: console-debug-log・process-exit・tolocalestring-bare の
  各 1 site は **ALLOWED 判断**とすること。根拠: (a) core logger :20 は
  logger 自身の debug transport で隣接行の level gate
  （`currentLogLevel <= LogLevel.DEBUG`・monitoring.logLevel 駆動）が
 稼働、(b) `src/api/index.ts:64` は gracefulShutdown の epilogue で
  全 background service 停止・log 済みの後に到達する deliberate な終端
  （SIGTERM/SIGINT handler 経由）、(c) core guards :114 は
  safeToLocaleString 自身の有限数 branch（typeof+Number.isFinite gate の
  中）で helper の目的そのもの。**teeth は生存**: それ以外の surface での
  `console.log/debug`（stray debug trace）・library/pipeline/component 内の
  `process.exit`・bare locale-default formatting（特に export/CSV/PDF 経路
  — locale comma は data corruption）は unrostered RED。各 row に
  negative anchor（level gate 隣接・shutdown log 順序・finite branch 共存）
  を付けること 🔵 *3 site とも実コード読みで文脈を確認*
- REQ-414-003: pin 前棄却の記録（REQ-411-003・REQ-412-005・REQ-413-003 の
  系列）: (a) `.charCodeAt(` は 15 src site 全て code-unit-domain 正利用のため
  **kind にしないこと**（15 row の per-site prose は full family 相当の
  投資 — astral-plane text math site 出現時点で再計測を guard header に
  明記）、(b) assignment-in-condition は行 detector に不可視のため kind に
  しないこと（arrow `=>` と assignment `=` の区別に paren-depth parse が
  必要・計測 15 hit は全て arrow か正典 `while ((m = re.exec(src)))` loop）、
  (c) `.charAt()` は bracket access と挙動等価のため kind にしないこと
  （実測 0 site・incident shape なし）🔵 *3 class とも実測 site 全数を読んでの棄却根拠*
- REQ-414-004: mutation 検証（MW-078）は 4 独立 mutation — (a) production
  file 末尾への `+new Date` 注入（unary-plus-date 単独発火）、(b) `throw
  'rogue'` 注入（throw-string 単独発火）、(c) rostered `process.exit(0)` の
  `process.exitCode = 0` 化（stale-row + process-exit floor >= 1 の 2 面
  発火）、(d) `!!~items.indexOf(x)` 注入（bitwise-not-indexof 単独発火）—
  で RED を実測し、mutation-witness ledger に section を追記すること 🔵 *4 mutation とも offender list で kind 帰着を確認・revert 後 8/8 GREEN*

### 基本的な制約

- REQ-410-008: 本契約の管轄外を guard header doc comment に明示すること —
  (a) detector は行単位（跨ぎ行の `==` や wrap した indexOf 比較は死角・
  現存 0 件・AST pass が必要な ceiling）、(b) nullish 除外は行粒度（同一行に
  `== null` と非 nullish `==` が混在すると行ごと skip）、(c) for-in guard
  scan は ≤12 行・既知 3 pattern（helper 経由の guard は unguarded 計上 =
  safe 方向の誤検出）、(d) 文字列 literal 内の idiom text は false-positive
  になり ALLOWED 判断を強制する（census の設計意図）、(e) `@stv/core` 側
  file の修正は in-tree 不可（roster の CORE-TYPED 判断は core 自身の CI
  への移譲）、(f) **REQ-412 kind の行粒度 ceiling** — parseint-no-radix は
  単純単一引数 operand のみ（as-cast・nested-call operand は死角）、
  bitwise-truncation は `~~`/`| 0` のみ（`>> 0`/`<< 0` truncation 綴りと
  regex literal の `|0` alternation は非検出/誤検出の境界にある — 現行
  surface で該当なし）、(g) **REQ-413 kind の行粒度 ceiling** —
  split-join-replaceall は `[^)]*` 引数（nested paren を含む split 引数は
  死角）・regexp-literal-ctor は escaped-quote を含む完全 literal 文字列
  （`'\''` で早期終了し非検出）・label-statement は `for`/`while` の
  label 形式のみ（object key / ternary は構文的に不可能だが `default:`
  行の誤検出境界）、(h) **REQ-414 kind の行粒度 ceiling** —
  unary-plus-date は `=`/`(`/`return` 直後の unary 綴りのみ
  （`y || +new Date` は死角・binary 文字列連結 `'…' + new Date()` は
  lookbehind で除外済み）・concat-empty-coercion は `''`/`""` のみ
  （template literal 連結は死角）・deprecated-keycode の `.which` は
  正当な `which` property access も hit する（false-positive は ALLOWED
  判断を強制する census の設計意図）・tolocalestring-bare は引数ゼロ呼び
  出し形のみ・nan-comparison は演算子前後の空白込み一致
  （`x===NaN` 無空白形も検出・跨ぎ行は従来通り死角）🟡 *契約範囲の明示（sibling census と同じ誠実さの慣行）*

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

### REQ-411-001〜004: sweep #2 kind の検出と固定

**Given（前提条件）**: production surface 331 file に 9 class を追加計測（8 class exact-0・json-clone 1 site ALLOWED）
**When（実行条件）**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns dead-idiom-batch-census` を実行する
**Then（期待結果）**: 8 test GREEN（同一 guard 内で kind 16 entry ratchet・fixture (i)〜(q) 拡張・ALLOWED 3 key・three-way phrase 一致）

**テストケース**:

- [x] **TC-411-01**: authority の kind ratchet 16 entry・json-clone floor >= 1 🔵
- [x] **TC-411-02**: liveness fixture (i)〜(q)（9 kind の検出・非検出境界）🔵
- [x] **TC-411-03**: ALLOWED 3 key / ERADICATED 2 key の three-way 句一致 🔵
- [x] **TC-411-04**: json-clone ALLOWED row の negative anchor（spelling pin・stale-row 連動）🔵

### REQ-411-005: MW-075 mutation 検証

**Given**: guard が GREEN の tree
**When**: 3 独立 mutation（`eval(` 注入 / `.sort()` 注入 / rostered json-clone 行改変）を適用する
**Then**: 各 mutation で対応面が RED・revert で GREEN 復元

### REQ-412-001〜004: sweep #3 kind の検出と固定

**Given（前提条件）**: production surface 331 file に 12 class を追加計測（10 class exact-0・parseint-no-radix 5 site unify・from-char-code 5 site / proto-key-literal 1 site ALLOWED）
**When（実行条件）**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns dead-idiom-batch-census` を実行する
**Then（期待結果）**: 8 test GREEN（同一 guard 内で kind 28 entry ratchet・fixture (r)〜(w) 拡張・ALLOWED 9 key / ERADICATED 7 key・three-way 句一致）

**テストケース**:

- [x] **TC-412-01**: authority の kind ratchet 28 entry・from-char-code floor >= 3・proto-key-literal floor >= 1 🔵
- [x] **TC-412-02**: liveness fixture (r)〜(w)（12 kind の検出・非検出境界）🔵
- [x] **TC-412-03**: ALLOWED 9 key / ERADICATED 7 key の three-way 句一致 🔵
- [x] **TC-412-04**: unify 5 site の negative anchor（spelling pin ×1 + **全 5 件の radix count 検証**）と rostered ALLOWED 2 anchor（apng fromCharCode・untrusted-json-core blocklist）🔵
- [x] **TC-412-05**: ProductionDashboard suite 17/17 GREEN・tsc 両 config exit 0（unify の回帰なし）🔵

### REQ-412-005: MW-076 mutation 検証

**Given**: guard が GREEN の tree
**When**: 4 独立 mutation（`~~(1.9)` 注入 / unify site の radix revert / rostered fromCharCode 行の fromCodePoint 化 / `__proto__` literal 注入）を適用する
**Then**: 各 mutation で対応面が RED（completeness / eradicated-reappear / stale-row / anchor の独立 leg）・revert で GREEN 復元

### REQ-413-001〜004: sweep #4 kind の検出と固定

**Given（前提条件）**: production surface 331 file に 10 candidate class を追加計測（6 class exact-0・var-declaration 2 site ALLOWED・3 class pin 前棄却）
**When（実行条件）**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns dead-idiom-batch-census` を実行する
**Then（期待結果）**: 8 test GREEN（同一 guard 内で kind 35 entry ratchet・fixture (x1)〜(x7) 拡張・ALLOWED 11 key / ERADICATED 7 key・three-way 句一致）

**テストケース**:

- [x] **TC-413-01**: authority の kind ratchet 35 entry・var-declaration floor >= 2 🔵
- [x] **TC-413-02**: liveness fixture (x1)〜(x7)（7 kind の検出・非検出境界）🔵
- [x] **TC-413-03**: ALLOWED 11 key / ERADICATED 7 key の three-way 句一致 🔵
- [x] **TC-413-04**: var ambient 2 site の negative anchor（`declare global {` block 内共存 pin）🔵

### REQ-413-004: MW-077 mutation 検証

**Given**: guard が GREEN の tree
**When**: 4 独立 mutation（runtime `var` 注入 / `new Number(5)` 注入 / rostered ambient var の `let` 化 / `.split().join()` 注入）を適用する
**Then**: 各 mutation で対応面が RED（completeness / stale-row + floor の 2 面）・revert で GREEN 復元

### REQ-414-001〜004: sweep #5 kind の検出と固定

**Given（前提条件）**: production surface 331 file に 17 candidate class を追加計測（11 class exact-0・3 class 各 1 site ALLOWED・3 class pin 前棄却）
**When（実行条件）**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns dead-idiom-batch-census` を実行する
**Then（期待結果）**: 8 test GREEN（同一 guard 内で kind 49 entry ratchet・fixture (y1)〜(y14) 拡張・ALLOWED 14 key / ERADICATED 7 key・three-way 句一致）

**テストケース**:

- [x] **TC-414-01**: authority の kind ratchet 49 entry・console-debug-log / process-exit / tolocalestring-bare floor 各 >= 1 🔵
- [x] **TC-414-02**: liveness fixture (y1)〜(y14)（14 kind の検出・非検出境界・slice 形の kind 帰着を含む）🔵
- [x] **TC-414-03**: ALLOWED 14 key / ERADICATED 7 key の three-way 句一致 🔵
- [x] **TC-414-04**: ALLOWED 3 site の negative anchor（level gate 隣接・shutdown log → exit 順序・finite branch 共存）🔵

### REQ-414-004: MW-078 mutation 検証

**Given**: guard が GREEN の tree
**When**: 4 独立 mutation（`+new Date` 注入 / `throw 'rogue'` 注入 / rostered process.exit の exitCode 化 / `!!~items.indexOf(x)` 注入）を適用する
**Then**: 各 mutation で対応面が RED（completeness / stale-row + floor の 2 面）・revert で GREEN 復元

### REQ-415-001〜004: sweep #6 kind の検出と固定

**Given（前提条件）**: production surface 331 file に 23 candidate class を追加計測（20 class exact-0・blocking-dialog 1 site / useragent-sniffing 3 site ALLOWED・node-global-identifier 5 site unify・legacy-substring 23 site は pin 前棄却）
**When（実行条件）**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns dead-idiom-batch-census` を実行する
**Then（期待結果）**: 8 test GREEN（同一 guard 内で kind 71 entry ratchet・fixture (z1)〜(z18) 拡張・ALLOWED 18 key / ERADICATED 12 key・three-way 句一致）

**テストケース**:

- [x] **TC-415-01**: authority の kind ratchet 71 entry・blocking-dialog / useragent-sniffing floor（各 >= 1 / >= 3）🔵
- [x] **TC-415-02**: liveness fixture (z1)〜(z18)（22 kind の検出・非検出境界・CJS 4 綴り一括と window 修飾形式を含む）🔵
- [x] **TC-415-03**: ALLOWED 18 key / ERADICATED 12 key の three-way 句一致 🔵
- [x] **TC-415-04**: ALLOWED 4 site の negative anchor（confirm gate の破壊操作隣接・UA report-only 形）と unify 5 site の anchor + globalThis 出現 6 回 count pin（部分 revert 検出）🔵

### REQ-415-003: pin 前棄却 class の記録（投資不釣合型 3 例目）

- **`.substring(`（23 src site）**: 計測全 site が `substring(0, N)` 形の
  0-start 切り詰め（fallback label 40 字・summary truncate）か
  `Math.min/ Math.max` で正規化済みの span（diagram-detector :884 の
  contextText 抽出）であって、class 唯一の incident shape である
  indexA > indexB 引数 swap に到達しうる site が存在しない。fix ゼロの
  23 row per-site prose は full family 相当の投資（charCodeAt・
  Math.max(...xs) と同じ「投資不釣合型」・3 例目）。swap 可能形の site
  出現時点で再計測を guard header に明記して棚上げ。

### REQ-415-004: MW-079 mutation 検証

**Given**: guard が GREEN の tree
**When**: 4 独立 mutation（`new XMLHttpRequest()` 注入 / unify site の `global.gc` revert / rostered confirm gate の direct reset() 化 / `document.cookie` 読み注入）を適用する
**Then**: 各 mutation で対応面が RED（completeness / eradicated-reappear + anchor / stale-row + floor + anchor の 3 面）・revert で GREEN 復元

## REQ-416: 第七回 discovery sweep（同一 batch guard への kind 追加）

steering 契約の 7 回目の適用。2026-08-26 の **第七回 discovery sweep** は
同一 production surface（331 file・repo src/ .ts+.tsx と @stv/core core-four）
で **10 candidate class** を計測。このうち 3 class は **pin 前に棄却**（下記
REQ-416-003）。残る **7 kind を registry に追加**（全 exact-0・src 変更ゼロ・
ALLOWED/ERADICATED roster 不変）:

| kind | 実測 | 判定 |
|------|------|------|
| async-promise-executor（`new Promise(async …)`） | 0 | exact-0 pin — async executor 内の throw は promise chain から切り離され unhandled |
| array-delete-hole（`delete a[i]` bracket 形） | 0 | exact-0 pin — hole 化で length 不変・map/forEach が slot skip |
| instanceof-primitive-wrapper（`instanceof String/Number/Boolean`） | 0 | exact-0 pin — primitive は常に false（typeof が正形） |
| atob-btoa（`atob(` / `btoa(`） | 0 | exact-0 pin — Latin-1 codec で UTF-8 content に throw（TextEncoder/Decoder が正形） |
| inner-html-op-assign（`.innerHTML +=`） | 0 | exact-0 pin — inner-html-assignment の compound 形（`=` regex の死角側） |
| insert-adjacent-html（`.insertAdjacentHTML(`） | 0 | exact-0 pin — 引数を markup として parse する innerHTML の兄弟 sink |
| sparse-array-ctor（`new Array(<literal>)` 単一引数） | 0 | exact-0 pin — holey array（Array.from が正形） |

### REQ-416-001〜004: sweep #7 kind の検出と固定

**Given（前提条件）**: production surface 331 file に 10 candidate class を追加計測（7 class exact-0・3 class pin 前棄却・ALLOWED/ERADICATED roster は不変）
**When（実行条件）**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns dead-idiom-batch-census` を実行する
**Then（期待結果）**: 8 test GREEN（同一 guard 内で kind 78 entry ratchet・fixture (aa1)〜(aa7) 拡張・ALLOWED 18 key / ERADICATED 12 key 不変・three-way 句一致）

**テストケース**:

- [x] **TC-416-01**: authority の kind ratchet 78 entry（7 kind 追加の順序固定）🔵
- [x] **TC-416-02**: liveness fixture (aa1)〜(aa7)（7 kind の検出・非検出境界 — `instanceof Array` は既存 kind の検出域であることを負例で分離・同一行の atob+btoa は行単位 1 site も踏まえる）🔵
- [x] **TC-416-03**: ALLOWED 18 key / ERADICATED 12 key の three-way 句一致（本 sweep は roster 不変）🔵

### REQ-416-003: pin 前棄却 class の記録（投資不釣合型 4/5 例目・検出不可能型 2 例目）

- **`.length = 0`（10 src site）**: 計測全 site が instance-owned receiver の
  意図的 in-place drain（errorQueue / samples / records / CappedArray 自身の
  clear）で incident shape ゼロ。fix ゼロの 10 row per-site prose は
  恒久 ALLOWED noise（charCodeAt・Math.max(...xs)・.substring に続く
  投資不釣合型 4 例目）。
- **`.splice(…)`（27 src site）**: 全 site が queue primitive としての正当利用
  （優先度挿入・dequeue・DLQ purge）。receiver-mutation class は family 16
  （REQ-407）で概念正典化済みで、27 row の再分類は投資不釣合型 5 例目。
- **`return` inside `finally`（finally 13 site・return 0 site）**: incident
  （finally 内 return による例外握り潰し）は行を跨ぐため行 detector に不可視
  （block-scope parse 必要 — assignment-in-condition と同じ検出不可能型 2 例目）。
  加えて finally 行 detector の site 母集団は「全 finally block」（13 site すべて
  cleanup-only）で incident 母集団と不一致のため、pin は今後の正当な
  try/finally 追加すべてに roster 行を課す逆薬剤（site 母集団 ≠ incident
  母集団の初例として guard header に記録）。

### REQ-416-004: MW-080 mutation 検証

**Given**: guard が GREEN の tree
**When**: 4 独立 mutation（`src/analysis/untrusted-json-core.ts` 末尾への `new Promise(async …)` 注入 / `new Array(16)` 注入 / `instanceof Number` 注入 / `atob('Zm9v')` 注入）を適用する
**Then**: 各 mutation で completeness が RED（各 1 failed・offender list で kind 帰着を確認）・revert で 8/8 GREEN 復元・`git status --short src/` 空

## REQ-417: 第八回 discovery sweep（同一 batch guard への kind 追加）

steering 契約の 8 回目の適用。2026-08-26 の **第八回 discovery sweep** は
同一 production surface（331 file・repo src/ .ts+.tsx と @stv/core core-four）
で **16 candidate class** を計測（走査は canonical `walkProductionSurface`
を直接使用 — 初回 probe script が `.d.ts` 3 file の扱い違いで 330 file に
なったため、A-416-1 と同一の「走査面一致を評決の前提条件」手順で再計測）。
このうち 4 class は **pin 前に棄却**（下記 REQ-417-003）。残る
**12 kind を registry に追加**（10 kind exact-0・2 kind は ALLOWED 4 site
同梱・src 変更ゼロ）:

| kind | 実測 | 判定 |
|------|------|------|
| date-string-parse（`Date.parse(` + `new Date('…')` literal 形） | 0 | exact-0 pin — ISO profile 外の文字列 parse は実装依存（Safari の古典的 NaN 形） |
| bare-decodeuri（`decodeURI(`） | 0 | exact-0 pin — reserved 文字（%2F %3F %23）を decode しない・bare-encodeuri の decode 側 sibling |
| dead-ua-field（`navigator.app{Name,Version,CodeName}` / `product`） | 0 | exact-0 pin — 固定文字列（"Netscape"/"Gecko"）しか返さない死んだ UA field |
| react-legacy-root-api（`findDOMNode` / `unmountComponentAtNode` / `ReactDOM.render(`） | 0 | exact-0 pin — React 18 StrictMode で削除済みの legacy root trio |
| react-unsafe-lifecycle（`componentWill{Mount,ReceiveProps, Update}` + `UNSAFE_` 接頭形） | 0 | exact-0 pin — React 18 削除 unsafe lifecycle（`componentWillUnmount` は検出域外 — fixture (ab5) 負例で固定） |
| dangerously-set-innerhtml（`dangerouslySetInnerHTML`） | 0 | exact-0 pin — React markup sink・insert-adjacent-html の component 面 sibling |
| bare-array-ctor（`Array(<literal>)` call 形） | 0 | exact-0 pin — sparse-array-ctor の `new` 無し形（lookbehind で `new Array(n)` は従来 kind に帰着 — fixture (ab7) で分離固定） |
| postmessage-wildcard（`postMessage(…, '*')`） | 0 | exact-0 pin — origin 無資格 broadcast（worker の単一引数 postMessage に targetOrigin 引数は存在せず incident 外） |
| script-element-creation（`createElement('script')`） | 0 | exact-0 pin — script injection sink（将来 site には provenance 判断を同 commit で課す） |
| instanceof-object（`instanceof Object`） | 0 | exact-0 pin — 全 object で true・cross-realm で false・typeof が常に上位 |
| swallowed-rejection（`.catch(() => {})` / `=> null` / `undefined`） | **1 site（src）** | ALLOWED 1 key — whisper-transcriber:121 dynamic-import 可否 probe（README: 推論は実行しない・null は意図的破棄） |
| console-nondebug-sink（`console.{info,warn,error,trace}(`） | **3 site（core）** | ALLOWED 3 key — logger.ts:25/30/35 logger 自身の transport（:20 の console.debug LOGGER-IMPL row と同型・core 所有 file） |

ALLOWED **22 key** / ERADICATED **12 key**（不変）・kind registry **90 entry**
（78 → 90）。

### REQ-417-001〜004: sweep #8 kind の検出と固定

**Given（前提条件）**: production surface 331 file に 16 candidate class を追加計測（12 class kind 化・4 class pin 前棄却）
**When（実行条件）**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns dead-idiom-batch-census` を実行する
**Then（期待結果）**: 8 test GREEN（同一 guard 内で kind 90 entry ratchet・fixture (ab1)〜(ab12) 拡張・ALLOWED 22 key / ERADICATED 12 key の three-way 句一致）

**テストケース**:

- [x] **TC-417-01**: authority の kind ratchet 90 entry（12 kind 追加の順序固定）🔵
- [x] **TC-417-02**: liveness fixture (ab1)〜(ab12)（12 kind の検出・非検出境界 — `navigator.userAgent` は useragent-sniffing・`new Array(12)` は sparse-array-ctor・`console.log` は console-debug-log への帰着を負例で分離）🔵
- [x] **TC-417-03**: ALLOWED 22 key / ERADICATED 12 key の three-way 句一致（REQ-395 census-artifact guard 経由）🔵

### REQ-417-002: 既存 fixture 負例の検出域明け渡し（kind 分離契約の 3 例目）

REQ-416 の inner-html-op-assign と同じ契約: 既存 kind の detect は不変の
まま、新 kind が管轄を取る shape を既存 fixture の**負例側から明け渡す**。
本 sweep は 2 fixture が該当し、いずれも負例の差し替えで対応（既存 kind
の検出域は 1 行も変わらない）:

- **(y12) console-debug-log 負例**: `console.info/warn/error` が負例側に
  居た → `logger.info/warn/error` facade に差し替え（info/warn/error の
  帰着先は (ab12) が固定）。
- **(z14) inner-html-assignment 負例**: React の `dangerouslySetInnerHTML`
  prop が負例側に居た → `<div>{text}</div>` children 形に差し替え
  （prop 形の帰着先は (ab6) が固定）。

### REQ-417-003: pin 前棄却 class の記録（site≠incident 母集団 2 例目・挙動一致型 2 例目）

- **dom0-handler-assign（`.on{error,click,…} =`・6 src site）**: 全 site が
  SpeechRecognition / HTMLMediaElement（Audio）の **型付き onXxx handler
  property**（lib.dom 現行仕様の正形・`onerror = (ev) => …` は TS が
  型付けする公式 API）。死んだ慣用ではなく site 母集団 ≠ incident 母集団
  （REQ-416 finally の 2 例目）。addEventListener への統一は文書価値のみ。
- **throw-bare-error（`throw Error(…)` new 無し）**: Error は関数呼び出し
  でも自動 construct される（仕様）→ **挙動完全一致**・incident なし
  （sweep #3 の `a ** b`↔Math.pow 棄却と同型 2 例目）。
- **void-zero-undefined（`void 0`）**: 安全な undefined 読みの正形そのもの
  （`undefined` 再定義対策の正統綴り）。死んだ慣用ではないため pin 対象外。
- **bare `postMessage(` 呼び出し（5 worker site）**:
  DedicatedWorkerGlobalScope.postMessage に targetOrigin 引数は存在しない
  — incident 形は wildcard origin のみで postmessage-wildcard kind が
  pin 済み（概念の重複棄却）。

### REQ-417-004: MW-081 mutation 検証

**Given**: guard が GREEN の tree
**When**: 4 独立 mutation（`src/analysis/untrusted-json-core.ts` 末尾への `Date.parse('2026-01-01')` 注入 / `Array(16)` call 形注入 / `console.error('rogue')` 注入 / `postMessage(payload, '*')` 注入）を適用する
**Then**: 各 mutation で completeness が RED（各 1 failed・offender list で kind 帰着を確認）・revert で 8/8 GREEN 復元・`git status --short src/` 空

## REQ-418: 第九回 discovery sweep（同一 batch guard への kind 追加）

steering 契約の 9 回目の適用。2026-08-26 の **第九回 discovery sweep** は
同一 production surface（331 file・repo src/ .ts+.tsx と @stv/core core-four・
走査は canonical `walkProductionSurface` 直接使用）で **29 candidate class**
を計測。このうち 1 class は **pin 前に棄却**（下記 REQ-418-003）。残る
**28 kind を registry に追加**（26 kind exact-0・1 kind は ALLOWED 1 site
同梱・1 kind は unify 1 site 同梱）:

| kind | 実測 | 判定 |
|------|------|------|
| outer-html-assignment（`.outerHTML =` / `+=`） | 0 | exact-0 pin — inner-html-assignment の全要素 markup sink sibling（`==` 比較は検出域外） |
| srcdoc-assignment（`.srcdoc =`・大小文字無区別） | 0 | exact-0 pin — iframe markup sink・innerHTML の iframe-vector sibling |
| legacy-dispatch-event（`document.createEvent(`・`?.` 結合形含む） | 0 | exact-0 pin — pre-`new CustomEvent()` の initEvent 構築舞踏・MW-082 mutation (c) が optional-chain 検出域欠落を発見し初稿から修正 |
| ie-attach-event（`attachEvent` / `detachEvent`） | 0 | exact-0 pin — IE 専用 event API（全現行 engine で dead code） |
| ie-current-style（`.currentStyle`） | 0 | exact-0 pin — IE の computed-style member（getComputedStyle が正形） |
| window-execscript（`execScript(`・member 形含む） | 0 | exact-0 pin — global-scope eval の IE twin |
| window-navigate（`window.navigate(`） | 0 | exact-0 pin — IE の navigation 綴り（location.assign/href が正形） |
| element-set-capture（`setCapture` / `releaseCapture`） | 0 | exact-0 pin — IE mouse-capture pair（`setPointerCapture` は検出域外 — fixture (ac8) 負例で固定） |
| document-create-stylesheet（`createStyleSheet(`） | 0 | exact-0 pin — IE 専用 stylesheet 注入 |
| array-join-repeat（`Array(n).join(sep)`） | 0 | exact-0 pin — pre-`repeat` idiom（`Array(3).join('-')` が 2 本になる off-by-one 込み） |
| react-string-ref（`ref="…"`） | 0 | exact-0 pin — React legacy string ref（function component では削除済み） |
| react-create-class（`createClass(`） | 0 | exact-0 pin — pre-class/pre-hooks component factory（React 16 で削除） |
| react-is-mounted（`.isMounted(`） | 0 | exact-0 pin — 削除済み anti-pattern（unmount 後 setState guard） |
| legacy-context-api（`childContextTypes` / `getChildContext`） | 0 | exact-0 pin — 削除済み legacy context（createContext のみが現行形） |
| on-prefixed-event-name（`addEventListener('on…')`） | 0 | exact-0 pin — DOM event 名に `on` 接頭は存在しない・handler が一度も発火しない silent bug 形 |
| object-ctor（`new Object()`） | 0 | exact-0 pin — `{}` の無意味 ctor 綴り（`new ObjectType()` は検出域外 — fixture (ac16) 負例で固定） |
| document-domain-access（`document.domain`） | 0 | exact-0 pin — deprecated な same-origin relaxation（能力ではなく security hazard） |
| with-statement（`with (`） | 0 | exact-0 pin — strict-mode SyntaxError（ES2023 `.with(` array copy と `switch (` は検出域外） |
| window-showmodaldialog（`showModalDialog(`） | 0 | exact-0 pin — 削除済み IE/Firefox modal API（`<dialog>.showModal()` は別名で非該当） |
| document-selection-ie（`document.selection`） | 0 | exact-0 pin — IE selection model（getSelection が正形） |
| ie-do-scroll（`.doScroll(`） | 0 | exact-0 pin — IE scroll hack（scrollIntoView が正形） |
| event-cancel-bubble（`.cancelBubble =`） | 0 | exact-0 pin — IE の stopPropagation 綴り（現行 engine で無効代入） |
| event-src-element（`.srcElement`） | 0 | exact-0 pin — IE の event-target field（`.target` が正形） |
| document-layers（`document.layers`） | 0 | exact-0 pin — Netscape 4 DHTML API |
| console-assert-sink（`console.assert(`） | 0 | exact-0 pin — logger の level gate を迂回する debug 専用 sink（console-debug-log の assertion twin） |
| then-two-arg-rejection（`.then(undefined, …)` / `null` 第一引数） | 0 | exact-0 pin — `.catch()` の legacy 二引数形（実第一引数は正当な two-arg then で検出域外） |
| dead-ua-platform（`navigator.platform`） | **1 site（src）** | ALLOWED 1 key — production-error-handler:273 getBrowserInfo telemetry の第 3 field（:271 userAgent REPORT-ONLY row と同型・branch なし） |
| string-char-split（`.split('')`・空文字 separator） | **1 site（src）** | unify 1 site — language-detector:537 `text.split('')` → `[...text]`（ERADICATED 1 key 追加） |

ALLOWED **23 key** / ERADICATED **13 key**・kind registry **118 entry**
（90 → 118）。

### REQ-418-001〜004: sweep #9 kind の検出と固定

**Given（前提条件）**: production surface 331 file に 29 candidate class を追加計測（28 class kind 化・1 class pin 前棄却）
**When（実行条件）**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns dead-idiom-batch-census` を実行する
**Then（期待結果）**: 8 test GREEN（同一 guard 内で kind 118 entry ratchet・fixture (ac1)〜(ac28) 拡張・ALLOWED 23 key / ERADICATED 13 key の three-way 句一致）

**テストケース**:

- [x] **TC-418-01**: authority の kind ratchet 118 entry（28 kind 追加の順序固定）+ dead-ua-platform floor ≥ 1 🔵
- [x] **TC-418-02**: liveness fixture (ac1)〜(ac28)（28 kind の検出・非検出境界 — `Array(4).join` は bare-array-ctor との双 hit を変数長で分離・`navigator.platform` は (ab3) から明け渡し・`eval(` は direct-eval への帰着を負例で分離）🔵
- [x] **TC-418-03**: ALLOWED 23 key / ERADICATED 13 key の three-way 句一致（REQ-395 census-artifact guard 経由）🔵

### REQ-418-002: 既存 fixture 負例の検出域明け渡し（kind 分離契約の 4 例目）

REQ-417 と同じ契約: 既存 kind の detect は不変のまま、新 kind が管轄を
取る shape を既存 fixture の**負例側から明け渡す**。

- **(ab3) dead-ua-field 負例**: `navigator.platform` が負例側に居た →
  `navigator.language`（正当 API・いずれの kind の shape でもない）に
  差し替え（platform の帰着先は (ac19) が固定・REQ-417 の 2 例に続く
  3 連続 sweep での明け渡し適用）。

### REQ-418-003: pin 前棄却 class の記録（site≠incident 母集団 3 例目）

- **react-default-props（`defaultProps`・1 src site）**: 実測 site は
  `src/remotion/Root.tsx:42` の `<Composition defaultProps={…}>` — これは
  **Remotion Framework 自身の prop**（calculateMetadata への入力 API）で
  あり React の削除対象 `Component.defaultProps` とは無関係の同名衝突。
  site 母集団 ≠ incident 母集団（REQ-417 dom0-handler-assign の 3 例目）。

### REQ-418-004: MW-082 mutation 検証

**Given**: guard が GREEN の tree
**When**: 4 独立 mutation（language-detector:537 `[...text]` → `text.split('')` revert / `src/analysis/untrusted-json-core.ts` 末尾への `.outerHTML =` 注入 / 同位置への `document?.createEvent('HTMLEvents')` 注入 / 同位置への `addEventListener('onclick', …)` 注入）を適用する
**Then**: (a) は completeness + eradicated-reappear + negative anchor の **3 独立面** で RED（`:537 [string-char-split]` 帰着）・(b)(d) は各 1 failed completeness RED（`[outer-html-assignment]` / `[on-prefixed-event-name]` 帰着）・(c) は初稿 regex が optional-chain 形を見落として **GREEN のまま** → 検出域を `document\??\.createEvent` に修正して RED 化（mutation 検証が detector bug を発見した初例）・revert で 8/8 GREEN 復元・`git status --short src/` は unify 対象 1 file のみ

## REQ-419: 第十回 discovery sweep（同一 batch guard への kind 追加）

steering 契約の 10 回目の適用。2026-08-26 の **第十回 discovery sweep** は
同一 production surface（331 file・repo src/ .ts+.tsx と @stv/core core-four・
走査は canonical `walkProductionSurface` 直接使用）で、REQ-418 merge 後の
tree を対象に **8 candidate class** を計測。うち 5 class（`.outerHTML` 読み取り
形・`initEvent` 単独・`.cancelBubble` 読み取り形・`.split('')`・
`.then(null, …)`）は REQ-418 の kind（outer-html-assignment /
legacy-dispatch-event・ie-attach-event / event-cancel-bubble /
string-char-split / then-two-arg-rejection）が同一 shape を既に管轄していた
ため候補から除外（重複）。1 class は **pin 前に棄却**（下記 REQ-419-002）。
残る **7 kind を registry に追加**（すべて exact-0）:

| kind | 実測 | 判定 |
|------|------|------|
| filter-index-zero（`.filter(…)[0]`） | 0 | exact-0 pin — 全件 materialize して先頭 1 件を読む形（`.find()` が短絡正形） |
| inline-handler-attr（`setAttribute('on…', …)`） | 0 | exact-0 pin — CSP-unsafe inline handler 注入 vector（addEventListener が正形・javascript-url と並ぶ文字列 handler 2 vector の片方） |
| instanceof-function（`instanceof Function`） | 0 | exact-0 pin — cross-realm で false になる検査（`typeof x === 'function'` が正形） |
| object-setprototypeof（`Object.setPrototypeOf(`） | 0 | exact-0 pin — hidden-class deoptimize 要因（class extends / Object.create が正形） |
| exec-command-legacy（`document.execCommand(`） | 0 | exact-0 pin — deprecated clipboard/editing API（async API が正形・window-execscript とは別 kind） |
| setimmediate-call（bare `setImmediate(`） | 0 | exact-0 pin — IE/Node 専用 scheduling（browser では crash・`setTimeout` / `queueMicrotask` が可搬正形） |
| process-nexttick（`process.nextTick(`） | 0 | exact-0 pin — event-loop starvation + browser 未実装（`queueMicrotask` が正形・scripts/ の node shim は walk 対象外） |

ALLOWED **23 key** / ERADICATED **13 key**（不変）・kind registry **125 entry**
（118 → 125）。

### REQ-419-001: sweep #10 kind の検出と固定

**Given（前提条件）**: production surface 331 file に 8 candidate class を追加計測（7 class kind 化・1 class pin 前棄却・5 class は REQ-418 重複で候補除外）
**When（実行条件）**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns dead-idiom-batch-census` を実行する
**Then（期待結果）**: 8 test GREEN（同一 guard 内で kind 125 entry ratchet・fixture (ad1)〜(ad7) 拡張・ALLOWED 23 key / ERADICATED 13 key の three-way 句一致）

**テストケース**:

- [x] **TC-419-01**: authority の kind ratchet 125 entry（7 kind 追加の順序固定）🔵
- [x] **TC-419-02**: liveness fixture (ad1)〜(ad7)（7 kind の検出・非検出境界 — `xs.filter(…)[i]` 変数 index は検出域外・`handlers.setImmediate =` member 形は検出域外・`instanceof MyClass` / `execScript(` は既存 kind の shape と分離）🔵
- [x] **TC-419-03**: ALLOWED 23 key / ERADICATED 13 key の three-way 句一致（REQ-395 census-artifact guard 経由・sweep #10 は rosters 不変のため句も不変）🔵

### REQ-419-002: pin 前棄却 class の記録（記録済み判断との衝突回避）

- **legacy-get-elements（`getElementsBy*`・0 site）**: REQ-418 の fixture
  (ac26) が `document.getElementsByClassName('x')` を**意図的な負例**として
  pin 済み（「live HTMLCollection は現行 API・document.layers とは別概念」の
  判断が guard 本文に記録されている）。kind 追加はこの記録済み判断と直接
  矛盾するため pin 前棄却（棄却 taxonomy: 記録済み判断衝突型の初例 —
  live collection を dead と見なす判定は別 family の議論）。

### REQ-419-003: MW-083 mutation 検証

**Given**: guard が GREEN の tree
**When**: 4 独立 mutation（`src/analysis/untrusted-json-core.ts` 末尾への `xs.filter(isNum)[0]` 注入 / 同位置への `document.execCommand('copy')` 注入 / 同位置への `setImmediate(callback)` 注入 / 同位置への `process.nextTick(callback)` 注入）を適用する
**Then**: 4 mutation とも各 1 failed completeness RED（`:125 [filter-index-zero]` / `:126 [exec-command-legacy]` / `:127 [setimmediate-call]` / `:128 [process-nexttick]` 帰着）・revert で 8/8 GREEN 復元・`git status --short src/` 0 file（src 変更ゼロ sweep）

### REQ-419-004: filter-index-zero detector の false-positive guard 固定

**背景**: MW-083 採用時の detector regex `/\.filter\(.*\)\s*\[\s*0\s*\]/` は引数 span を greedy `.*` で表現しており、同一行に `.filter(…)` と別 receiver への `[0]` が並存する場合（`xs.filter(isOn); const a = m.get(k)[0];` / `if (xs.filter(isOn).length > 0) { const y = pair(a)[0]; }`）に `\)` が後続式の閉じ括弧まで跨り、redundant な hit を出して RED 化する脆さを抱える。PINNED guard は **fail-closed** が基本姿勢（誤検出は正当な CI を恒常 RED 化させる）であり、**fail-open 側**（見逃し）のリスク受容が好ましい。

**Given**: guard が GREEN の tree
**When**: detector を balanced-arg 版 `/\.filter\((?:[^()]|\([^()]*\))*\)\s*\[\s*0\s*\]/` に置換し、(ad1b) `xs.filter(isOn); const first = groups.get(k)[0];`（sibling-statement 形）と (ad1c) `if (xs.filter(isOn).length > 0) { const y = pair(a)[0]; }`（chained-call 形）の 2 negative fixture を追加する
**Then**:
- 9/9 GREEN 維持（8 既存 + ad1b / ad1c の 2 negative が同一 it 内で 0 site を確認）
- detector は positive 形 `xs.filter(isOn)[0]` を 1 hit で捕捉し続ける（MW-083 (a) の RED 経路を保持）
- 2 mutation 形（`xs.filter(isOn); const a = m.get(k)[0];` / `xs.filter(isOn).length + m.get(k)[0];`）は **8/8 GREEN** のまま（fail-open）— これが `REQ-419-004` の allowed 振る舞い

**走査影響**: kind registry は同数（filter-index-zero entry 1 件の detector 文字列のみ更新・sibling kind 増減なし）。PINNED_MIN_ENTRIES は MW-084 追加で 77→78。`tests/guards/mutation-witness-ledger.test.ts` の `entries.length` 期待は自動伸長するため手動更新不要。

## 最小限の非機能要件

- **性能**: 追加検証は既存 walk の行 scan のみ（file 再読みなし・guard 実行 < 1s）
- **保守性**: kind registry は純 data + 純関数 detector で export し合成 fixture で境界検証。src 変更は REQ-410 unify 2 site + REQ-412 unify 5 site + REQ-415 unify 5 site + REQ-418 unify 1 site（同一 feature check の綴り統一）のみ（それ以外 read-only census）。REQ-411 sweep #2・REQ-413 sweep #4・REQ-414 sweep #5・REQ-416 sweep #7・REQ-417 sweep #8・REQ-419 sweep #10 は **src 変更ゼロ**（実測 site は ALLOWED 判断・spec/guard のみ）
