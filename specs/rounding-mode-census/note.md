# rounding-mode census — Context Note

<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals メインコンテキストノート](../speech-to-visuals/note.md) audit-pass-first census series context
>
> - parent: `speech-to-visuals/note.md` (REQ-391〜404 census family)
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-24 / **要件ID**: REQ-404（family 13・第11 facet）

## 1. family registry における位置

audit-pass-first census series の family 13。family 1〜4（REQ-391〜394）は
measurement fabrication 系、family 5〜7（REQ-396/397・facet-5）は comment/cast
系、family 8〜11（REQ-398〜401）は suppression/randomness/env/coercion 系
（parallel lineage で land）、family 12（REQ-403）は比較の**演算子解釈**系。
family 13 は丸めの**mode 解釈**系 — REQ-403 が境界の「入力側」（比較）を
閉じたのに対し、本 facet は境界の「出力側」（丸め）を閉じる。

## 2. 前例: off-by-one-frame class の単発修正

本 repo が記録してきた frame 系事故（Lottie keyframe 単調性 clamp・
scene-synchronizer fps finiteness・durationMs 系 ms/s 変換）は全て
「frame 換算の端数処理が site 間で一致しないと 1 frame のずれ・切り詰め・
keyframe 逆転が生じる」同じ急所を持つ。従来は個別 site の修正 + pin で
対応してきたが、mode 分裂の**組合せ**（どの式がどの mode で丸められているか）
は census なしには見えない — 本 facet が初めて全数計測した。

## 3. なぜ round/ceil 分歧が実害になるか（比較回数の違い）

- REQ-403（strict vs inclusive）は**閾値ぴったり**（19/20 = 0.95 等）でのみ
  不同意した。round vs ceil は**積が整数でないすべての入力**で不同意する
  （`2.04 × 30 = 61.2` → 61 vs 62）— 到達頻度が桁違いに高い
- frame 数は downstream で配列長・keyframe 位置・progress 分母として消費
  されるため、1 frame 差は「半 frame の切り詰め」（render loop）または
  「keyframe の 1 frame 引き伸ばし」（Lottie）として具現化する
- `floor` が混ざる cluster では常に切り捨て側に寄る — 3 mode 混在は
  liveness fixture (d) で検証対象

## 4. discovery の設計判断

- **行内 paren balance のみ**: 複数行 wrap call（実測 2/231）は対象外。
  行単位 scan の他 census と同じ規律で、ceiling として明示
- **空白正規化のみの text key**: `duration  *  fps` ≡ `duration * fps` は
  同一 cluster。operand 順（`fps * duration`）・変数名違い・意味的同型綴り
  （`durationMs / 1000 * fps`）は join しない — 後者は single-source canon
  family の管轄（重複式の正典化は fold series が converged 済み）
- **mode 集合 ≥2 で mixed**: 一貫 cluster（全 site 同一 mode）は義務なし。
  REQ-403 の相補 ladder 除外と同じ「正規形は違反ではない」原則

## 5. ALLOWED 非空の初適用（REQ-399 と同型）

family 12（REQ-403）は ALLOWED 0 key で ship した（same-token 偶然は
measure されなかった）。本 facet は same-token 偶然（`duration * fps`・
`duration` が per-scene 量と whole-export 量を指す 2 domain 分割）を初めて
実測し、**domain 理由を付けて ALLOWED 3 key で分類**した。unify しない
理由: (a) renderer 側 round は fade keyframe の最近接 frame 構文 + 単調性
clamp の derivative であり test suite が pin（`tests/unit/export/animated-svg-lottie-export.test.ts`
の frame 9/141/150 期待値）、(b) engine 側 ceil は render loop の coverage
契約（末尾半 frame の内容を落とさない）。統一はどちらかの契約を壊す
回帰になる。

## 6. 既知 ceiling（REQ-404-008）

- 複数行 wrap call・Math 以外の丸め（`| 0`・`toFixed`）は対象外
- comment 行の丸め引用は documentation なので skip（stale-comment census
  (REQ-396) が comment 側の健全性を管轄）
- text key の限界: commutation・rename・意味的同型は single-source canon
  family の管轄
