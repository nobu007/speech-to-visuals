# sort-receiver-mutation census — Context Note

<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals メインコンテキストノート](../speech-to-visuals/note.md) audit-pass-first census series context
>
> - parent: `speech-to-visuals/note.md` (REQ-391〜407 census family)
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-25 / **要件ID**: REQ-407（family 16）

## 1. family registry における位置

audit-pass-first census series の family 16。family 1〜4（REQ-391〜394）は
measurement fabrication 系、family 5〜7（REQ-396/397・facet-5）は comment/cast
系、family 8〜11（REQ-398〜401）は suppression/randomness/env/coercion 系、
family 12（REQ-403）は比較演算子解釈系、family 13（REQ-404）は丸め mode 系、
family 14（REQ-405）は欠損時代替値系、family 15（REQ-406）は spine 構造系。
family 16 は**破壊的配列操作の receiver 判別**系 — 値の解釈（12/13/14）が
「読む側」を閉じたのに対し、本 facet は**書く側**（read のつもりの
mutation）を閉じる。`compound update overwrites`（閉鎖済み class）の
配列操作面に相当する。

## 2. なぜ receiver 判別が load-bearing か

- `.sort()` / `.reverse()` は他の配列 read と異なり **receiver 自身を返す**。
  `return items.sort(byX)` は「sorted view を返す」のではなく
  「caller の配列を破壊的並べ替えして返す」。構文上この 2 つは完全に同一
- 実害は **downstream order fork**: animation 順・edge 描画順・pagination
  offset・percentile loop など「元の順序を再読みする」consumer が、sort の
  前後で異なる値を読む。`percentileCeil([...values].sort())` が
  `percentileCeil(values.sort())` に退化した瞬間、samples 配列の再利用が
  全て汚染される（MW-071 mutation (a) がこの incident shape を再現）
- copy 形（`[...x].sort` / `x.map(f).sort` / `Array.from(...).sort`）と
  in-place 形（`x.sort` / `this.q.sort`）の**使い分け自体は設計**。
  問題は in-place 形の receiver が LOCAL-BUILT / OWN-FIELD / aliased-input
  のどれかを機械的に検査する口がなかったこと

## 3. discovery の設計判断

- **receiver は call 直前の text から判別**: bare dotted chain（`data.times`・
  `this.queue`・末尾 `?` の optional-call 含む）→ in-place。`)` / `]` 終端
  （spread・producer call・index access）→ produced。call 結果に alias は
  生成されない（map/filter/slice/concat/flat は copy、values() は sort 不能
  な iterator）ため produced は安全側
- **chain continuation は前行 tail から解決**（≤3 行 look-back）:
  `const s = data.times\n  .sort(fn)` は in-place、
  `Array.from(...)\n  .flatMap(...)\n  .sort(fn)` は produced
- **site key は `file:line:receiver`**: family 14 と同じ分離規約
- **comparator-less `.sort()` を別 axis で計上**: 辞書順 default trap
  （`[10,9,100].sort()` → [10,100,9]）は receiver 判別と独立の欠陥面

## 4. ALLOWED 24 / ERADICATED 0 の判断構造

24 in-place site の内訳: LOCAL-BUILT 22（同一 function 内 accumulator の
sort による確定 17 + spread/filter/method-return copy 格納変数 5:
LayoutOptimizer nodes・user-guided automatedStrategies・tree-strategy roots・
export-artifact-store entries・improvement-detector opportunities）+
OWN-FIELD 2（load-balanced-executor requestQueue・
continuous-learner optimizationStrategies — persistent order が状態そのもの）。
**aliased-input site は 0 件** = ERADICATED 0 の confirmed-clean（family
8/9/15 lineage）。撲滅対象なしのため src 変更ゼロ — 仮に copy 化の統一を
強制すると local 確定 sort に無駄な copy を強いる churn になる（census
honesty: ALLOWED 理由で正しい使い分けを固定する）。

## 5. 手動受見 21 vs guard 24 — 3 site 追補

手動 grep + 受見分類では `export-artifact-store:201 entries`・
`improvement-detector:74 opportunities`（method return value の格納変数）・
`LayoutOptimizer:74 nodes`（spread copy 格納変数）を roster に含めていなかった。
guard の初回 RED（completeness）が 3 site を列挙し、全て LOCAL-BUILT と
判明 — family 15（REQ-401 手動 37 vs guard 38）と同じ「機械計測が受見を
上回る」実績。roster exact both-ways はこの差を未来に対して恒久化する。

## 6. 既知 ceiling（REQ-407-009）

- index access receiver（`arr[0].sort`）は produced 分類（発見から逃れる）。
  現存 0 件。comparator-less axis が別面の欠陥を捕捉する
- receiver は ≤3 行 continuation 内で可視なもののみ。より離れて計算された
  receiver は bare identifier として in-place 計上 → roster 判定対象になる
  （狙いどおりの挙動）
- `.toSorted(` / `.toReversed(` は copy API であり scope 外（正典 escape hatch）
- comparator の意味面（NaN operand・direction・tie-breaker）は
  rounding/boundary family 管轄。diagram-detector の sanitizeFinite 入れ
  comparator は既にその系の正典形
