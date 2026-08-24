# fallback-default census — Context Note

<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals メインコンテキストノート](../speech-to-visuals/note.md) audit-pass-first census series context
>
> - parent: `speech-to-visuals/note.md` (REQ-391〜405 census family)
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-24 / **要件ID**: REQ-405（family 14・第12 facet）

## 1. family registry における位置

audit-pass-first census series の family 14。family 1〜4（REQ-391〜394）は
measurement fabrication 系、family 5〜7（REQ-396/397・facet-5）は comment/cast
系、family 8〜11（REQ-398〜401）は suppression/randomness/env/coercion 系
（parallel lineage で land）、family 12（REQ-403）は比較の演算子解釈系、
family 13（REQ-404）は丸めの mode 解釈系。family 14 は**欠損時の代替値**
（fallback default の中身）系 — 境界 class が「入力側の解釈（12）」「出力側
の丸め（13）」を閉じたのに対し、本 facet は**値が存在しないときに何を
でっち上げるか**を閉じる。

## 2. 前例: auth role 不一致・ad-hoc duration

本 repo の事故記録でこの class の単発修正は既にある: HTTP auth と socket
auth の role claim 解釈・`durationMs` 系の ms/s 変換事故（単位は closed だが
代替値の整合は未計測だった）・`gateResult.reason` の二重 message。従来は
個別 site の修正 + pin で対応してきたが、**同じ chain に対する別 literal の
組合せ**は census なしには見えない — 本 facet が初めて全数計測した。

## 3. なぜ literal 不一致が実害になるか

- fallback は**契約違反・欠損時のみ**到達する。通常運転では全 path が同値を
  読むため不一致が潜伏し、障害時に初めて「片方だけ正しい値・もう片方は
  静かに間違った値」で具現化する — 最悪の発見タイミング
- 代替値は downstream で契約の前提になる（composition 長・error message の
  埋め込み・認可 tier）。renderer の旧 `|| 10000` は three-path agreement
  guard の名前に出てこない 4 番目の path として、正典 5000ms の 2 倍を
  でっち上げていた
- `??` vs `||` の**演算子選択**は別 class（falsy 0 誤検知・satuated）。
  本 facet は演算子が同じでも**中身**が食み違う分裂を扱う

## 4. discovery の設計判断

- **chain-adjacency**: LHS は演算子の直前にある dotted chain のみ。call 結果
  （`parseInt(x) || 1`）・TS cast・Map-accumulator seed（`counts.get(k) || 0`）
  を誤捕獲しない（初期版の `)*` 許容が 7-site 偽 cluster を作った実測で排除）
- **standalone-RHS lookahead**: `'A' in window || 'B' in window` の probe OR・
  文字列埋め込みを除外
- **canonical literal**: `60.0` ≡ `60`（String(Number())）・`'x'` ≡ `"x"`
  （JSON.stringify）。quote・桁表記の揺れだけで分裂させない
- **site key は `file:line:chain`**: `{ width: w ?? 1920, height: h ?? 1080 }`
  の同一行複数 default を分離（実測で key 衝突を発見し修正）

## 5. ALLOWED 32 site / ERADICATED 3 site の判断構造

10 mixed cluster のうち 7 cluster は same-token 別 domain の偶然
（message=route 別 400 copy・stage=label vs lookup-lane・width/height=canvas
FRAME vs node BOX・options.quality=tier enum vs compression fraction・
scene.id=machine '' vs human label・status=health vs iteration・
maxRetries=engine 既定 vs stage-boundary tight profile）— REQ-403/404 が
予言した "genuinely different domains" shape。config.nodeSeparation は
2026-08-08f の refutation（per-strategy tuning は正）を引用。3 site のみ
「同一の量・claim を読む本当の不一致」として unify した（REQ-405-003 表）。

## 6. 既知 ceiling（REQ-405-009）

- 演算子軸（同一 literal への `||`/`??` 混在）は falsy-guard class として
  saturated — 管轄外
- ternary else arm・identifier fallback（`|| DEFAULT_X`）は対象外（正典形・
  single-source family 管轄）
- chain text 完全一致 clustering: receiver rename（`opts.stage` vs `stage`）
  は join しない。MW-069 mutation (b) がこの textual attribution ceiling を
  副次発見した
- ERADICATED key は chain 表記必須 — bare field 名（`durationMs`）は
  discovery key と一致せず eradicated-reappear が vacuous pass する
  （MW-069 mutation (a) が発見）
