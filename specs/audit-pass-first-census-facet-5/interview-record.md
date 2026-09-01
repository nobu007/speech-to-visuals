# audit-pass-first census 第5 facet — 自動分析記録

<!-- spine:anchor:begin -->
> **Spine anchor**: [Speech-to-Visuals システム憲法 V2.8](../../SYSTEM_CONSTITUTION.md)
>
> - parent: `SYSTEM_CONSTITUTION.md`
> - role: `feature_root`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-23
**分析実施**: step4 既存情報ベースの差分分析と自動統合

## 分析目的

REQ-391〜395 で確立した **audit-pass-first census パターン**の直近実装
（REQ-395 three-way guard + ratchet teardown）後の次 iteration を、
make-run steering 直近の指摘「次は同パターンを未着手の facet（例:
stale-comment、type-narrow-as-any、any 漏出など）に適用する候補を選定し
REQ-396/397 を計画すること」具体化する。具体的には:

1. **census pattern 適用候補 facet の選定** — steering が例示した
   stale-comment / type-narrow-as-any / any 漏出 の 3 class が本 repo
   で観測されるか・census 化に適するかを既存観測から判定
2. **REQ-396/397 への割当** — 各 class をどの REQ に切り出すか・同一
   commit で paired 新設するか・separate かを pattern precedent から判定
3. **REQ-395 three-way guard への組み込み** — 新規 3 guard が family
   5/6/7 として THREE_WAY table に登録される設計

## 分析項目と判断

### A1: census pattern 適用候補 facet の選定

**分析日時**: 2026-08-23
**カテゴリ**: 既存設計確認
**背景**: make-run steering 直近の「audit-pass-first パターンが定着し
有効に機能している。次は同パターンを未着手の facet に適用する候補を選定
し REQ-396/397 を計画すること」指摘。

**判断**:
**steering が明示する 3 class**（stale-comment / type-narrow-as-any /
any 漏出）を**そのまま採用**する。

理由:
1. **stale-comment** — REQ-391/393 手動 audit が度々 confession
   comment（「`// Would be calculated from actual results`」ほか）を
   捏造の隠蔽として発見してきた滴りがある（REQ-393 TC-377-01 の
   `video-generator.ts` `?? 0.8` は「`// 0.8 mask は legit-zero を隠す`」
   self-confession を**本文が論じながら**未修正のまま ship していた）。
   self-confession を class として pin する diagnostic 価値あり。
2. **type-narrow-as-any** — `as any` cast 47 site（src/ + test）観測。
   REQ-393 score-ladder が `??`/`||` の silent-legit-zero 隠蔽を
   発見したのと**同型 class の type-system 側**（narrow 失敗の
   catch-all = legit-narrowing を info-silencer 化）。
3. **any 漏出** — `: any` 注釈 32 site・`<any>` 汎用型多数観測。
   REQ-393 score-ladder の `?? 数字` が fail-closed 0 へ移行された
   のと**同型 class の型システム側**（`any` 注釈 = type-system 全体
   の fail-open — narrow 失敗を compile-time に黙殺）。

**根拠**:
- `grep -rnE "as any" src/ --include="*.ts" --include="*.tsx"` → 47 行
- `grep -rnE ":\s*any\b" src/ --include="*.ts" --include="*.tsx"` → 32 行
- REQ-391〜394 requirements.md の手動 audit 経緯参照

**信頼性への影響**:
- 新規要件 REQ-396/REQ-397 を 🔵 で追加（既存観測から確実）
- 3 class の census 化候補は 🔵 で確定

---

### A2: REQ-396/397 への割当（REQ 番号設計）

**分析日時**: 2026-08-23
**カテゴリ**: 既存設計確認
**背景**: make-run steering の「REQ-396/397 を計画」明示。

**判断**:
- **REQ-396 = stale-comment census**（1 class = 1 REQ 規約）
- **REQ-397 = type-narrow-as-any + any 漏出 paired census**（2 class
  を 1 REQ に同梱 — type-system bypass 軸の 2 表現を paired 新設する
  方が guard 間 cross-check（`as any` が正当でも `: any` 注釈が
  residual なら ERADICATED 候補等）が構造的に可能）

理由:
- REQ-395 直近 precedent では 1 commit に複数 guard の paired ship
  を許容（three-way guard は family 4 REQ を一括 cover）
- type-narrow-as-any と any-annotate は**検出 regex は異なるが
 対象 class は同根**（type-system bypass の 2 表現）であり、
 ALLOWED 分類の共通化（boundary external input の 4 分類）が
 cross-check 効率を上げる
- 一方 stale-comment は class として**他 2 と直交**（comment vs
 type system）であり、別 REQ で独立 audit した方が reason 衛生が
 保ちやすい

**根拠**: REQ-395 three-way guard の family 1〜4 paired 規約 +
REQ-391〜394 各 REQ が 1〜複数 class を担当する precedent

**信頼性への影響**:
- REQ 番号設計を 🔵 で確定
- 3 guard のうち 2 guard が REQ-397 に同梱される paired 新設設計を
  🔵 で確定

---

### A3: REQ-395 three-way guard への family 登録

**分析日時**: 2026-08-23
**カテゴリ**: 影響範囲
**背景**: REQ-395 で「census/fold 系 REQ は同一 commit で (i) guard
roster (ii) requirements.md の数値宣言 (iii)
`census-artifact-three-way.test.ts` の THREE_WAY 行の 3 artifact を
ship すること」が acceptance 化済み。

**判断**:
- **REQ-396 = family 5** (stale-comment-census)
- **REQ-397 = family 6** (type-narrow-as-any-census)
- **REQ-397 = family 7** (any-annotate-census)

の 3 family を `census-artifact-three-way.test.ts` の THREE_WAY table
に追加。`census-pin:F5:` / `census-pin:F6:` / `census-pin:F7:` doc
marker を各 guard の header に付与。

**根拠**: REQ-395 three-way guard 規約 — family 1〜4 が REQ-391〜394
として登録済みの precedent

**信頼性への影響**:
- REQ-205 を 🔵 で追加
- counter liveness（quoted key・bare identifier key・4-space 継続行・
  comment 行・不在 block）は REQ-394 規約が全 family で一貫 🔵

---

### A4: 撲滅同梱 vs confirmed-zero 固定の判定

**分析日時**: 2026-08-23
**カテゴリ**: 既存設計確認
**背景**: REQ-391/393 は同 commit に撲滅 site の発見・修正を同梱、
REQ-394 は confirmed-zero 状態を固定し撲滅同梱なし（残件 0 のため）。

**判断**:
- **stale-comment-census**: src/ 内 TODO/FIXME/XXX/HACK 3 件のみ・
  deprecated/legacy/obsolete 自己宣言 0 件 — **REQ-394 同型で
  confirmed-zero 固定**（手動 audit で残件 0 確認後に新規 site を
  意識的分類する gate のみ ship）
- **type-narrow-as-any-census / any-annotate-census**: 47 site +
  32 site 規模 — **REQ-391/393 同型で audit-driven 撲滅を同梱**
  するか、audit 結果次第で REQ-394 confirmed-zero に切り替え

**理由**:
- stale-comment は REQ-393 滴り（confession comment）の**残骸**で
  あり、過去 iteration が撲滅済み — confirmed-zero 固定で十分
- any 系は**まだ手付かず**の class であり、過去 iteration の
  撲滅 site はゼロ — audit-driven で初手から発見・修正が必要

**根拠**: REQ-391 audit 31 key 手動漏れ発見 + REQ-394 confirmed-zero
固定 precedent + REQ-393 score-ladder 29→21 site 撲滅 precedent

**信頼性への影響**:
- REQ-396-003 confirmed-zero 固定設計を 🔵 で確定
- REQ-397-006 audit-driven 撲滅同梱設計を 🟡 で確定（audit 結果次第）

---

### A5: 検測上限（multiline confession / cast / annotation）

**分析日時**: 2026-08-23
**カテゴリ**: 既存設計確認
**背景**: REQ-393 score-ladder は multiline ladder を header で discovery
上限として正直 doc 化、negative anchor で別途捕捉する precedent あり。

**判断**:
- **stale-comment-census**: 検出は 1 行 comment 単位のため multiline
  上限は block-comment 冒頭のみ。`**` 開始行を hit させる regex で
 十分
- **type-narrow-as-any-census**: `as any` cast は 1 行に収まる形式が
  canonical だが、`as\n any` の multiline cast は discovery 上限
- **any-annotate-census**: `: any` 注釈は 1 行・`<any>` 汎用型も
  1 行 — multiline 上限はほぼ無い（interface field 改行は同 AST 上
  で 1 注釈扱い）

3 guard いずれも REQ-203 で multiline 上限を header に正直 doc 化し、
REQ-204 negative anchor で backup regex を 1 個以上同梱する。

**根拠**: REQ-393 multiline ladder discovery 上限 + REQ-392 negative
anchor 規約

**信頼性への影響**:
- REQ-203, REQ-204 を 🔵 で追加
- 3 guard 共通の multiline 上限正直 doc 化 + negative anchor backup を 🔵 で確定

---

## 分析結果サマリー

### 確認できた事項

- make-run steering 直近の「audit-pass-first パターンを未着手の facet に
  適用」指摘は、stale-comment / type-narrow-as-any / any 漏出 の 3 class
  が既存観測で実在することを 🔵 で確認
- REQ-391〜395 で確立した audit-pass-first pattern は本 3 class に
  機械的に適用可能（walkProductionSurface 単一実装・ALLOWED/ERADICATED
  分類規約・three-way guard family registration・reason hygiene 規約
  をそのまま流用）
- REQ-395 three-way guard family registration 規約は新規 3 family
  （F5/6/7）を構造的に受け入れる設計

### 追加/変更要件

- REQ-396-001〜005: stale-comment census（5 件・🔵）
- REQ-397-001〜007: type-narrow-as-any + any-annotate paired census
  （7 件・🔵/🟡）
- REQ-201〜205: 構造的ガード要件（5 件・🔵）
- REQ-301〜302: 状態要件（2 件・🔵）
- REQ-401〜405: 制約要件（5 件・🔵）
- EDGE-101〜202: Edgeケース（4 件・🔵）

### 残課題

- `as any` 47 site・`: any` 注釈 32 site の**初期 roster 確定**
  は audit pass 完了後 — 本 spec では初期値を audit 結果と
  一致させる pin（REQ-405）で担保
- ALLOWED 分類の 4 分類（test-mock / json-parse-narrowing /
  external-boundary / third-party-type-gap）に該当しない site が
  出た場合は**新分類追加**が別途 REQ 必要（REQ-402 reason-hygiene
  で防止）
- @stv-core/core-four（vendored）側の `as any` / `: any` は
  REQ-391/392 と同じ扱いで ALLOWED・ERADICATED 分類に含めるか
  別途扱いは**初期 audit で確定**

### 信頼性レベル分布

**分析前**:
- 🔵 青信号: 0件（要件未定義）
- 🟡 黄信号: 0件
- 🔴 赤信号: 0件

**分析後**:
- 🔵 青信号: 26件（REQ-396-001, 002, 004, 005, REQ-397-001, 002, 003,
  004, 005, 007, REQ-201, 202, 203, 204, 205, REQ-301, 302, REQ-401,
  402, 403, 404, 405, REQ-103 design 各種, EDGE-101, 102, 201, 202）
- 🟡 黄信号: 2件（REQ-396-003, REQ-397-006 — 撲滅同梱 vs
  confirmed-zero 切替は audit 結果次第）
- 🔴 赤信号: 0件

## 関連文書

- **要件定義書**: [requirements.md](requirements.md)
- **コンテキストノート**: [note.md](note.md)
- **親 census series**: REQ-391〜395 in [speech-to-visuals/requirements.md](../speech-to-visuals/requirements.md)
- **直近 predecessor**: [TASK-0277](../speech-to-visuals/tasks/TASK-0277.md)
- **直近 steering**: AI_HUB_MAKE_RUN_FEEDBACK 2026-08-23 / REQ-396/397 計画指示