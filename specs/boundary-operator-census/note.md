# boundary strictness census — Context Note

<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals メインコンテキストノート](../speech-to-visuals/note.md) audit-pass-first census series context
>
> - parent: `speech-to-visuals/note.md` (REQ-391〜403 census family)
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-23 / **要件ID**: REQ-403（family 12・第10 facet）

## 1. family registry における位置

audit-pass-first census series の family 12。family 1〜4（REQ-391〜394）は
measurement fabrication 系、family 5〜7（REQ-396/397・facet-5）は comment/cast
系、family 8〜11（REQ-398〜401）は suppression/randomness/env/coercion 系
（parallel lineage で land）。family 12 は**演算子解釈**系の初 facet —
value の捏造ではなく、正しい value に対する境界解釈の分裂を検出する。

## 2. 前例: 0.6 正典（diagram-detection-constants.ts）

`GOOD_DETECTION_CONFIDENCE_THRESHOLD = 0.6` の JSDoc が本 class の定義書:

- `DiagramDetector` は `>= 0.6`（0.6 PASS）・`SimplePipeline` は `> 0.6` /
  `<= 0.6`（0.6 FAIL）→ exactly-0.6 で detector が受け入れた結果を pipeline が
  同時に低信頼度扱いした
- 修正は value と operator の**両方**を単一委譲先（`meetsGoodDetectionConfidence`）
  に集約 — 「Centralizing the value AND the operator resolves it」

本 facet はこの 0.6 ペアの一般化。0.6 正典は「"good enough" 系 gate は
boundary-INCLUSIVE」という規約も確立している（"a detection whose confidence
EQUALS this value has met the threshold"）。REQ-403 の 3 統一は全てこの方向。

## 3. なぜ strict/inclusive 分歧が実害になるか（float の性質）

- ratio metric（successRate = 成功数/総数）は**単一の correctly-rounded 除算**。
  19/20 の exact 値 0.95 は double に正しく丸められ、literal `0.95` の parse 結果
  と**同一 bit 列**になる → 比較は真の等価判定として作動する
-（対照的に加算累積の average は 1-ULP drift し得るが、本 census の論点は
  「等価が到達可能か」ではなく「等価に達したとき両 site が同じ答えを返すか」）
- よって `>= 0.95` と `> 0.95` は 19/20 入力で不同意する。system-health の
  verdict が endpoint ごとに割れる = user-visible な不一致
- 整数 threshold（`< 60000` 等）は float で正確に表現できるため同じ急所を持たず、
  本 census の対象外（REQ-403-001）

## 4. discovery の設計判断

- **literal 正規化**（`String(Number(x))`）: successRate @ 0.8 cluster は片側が
  `0.80` 表記で、正規化なしには spelling違いが別 cluster に隠れた。実 cluster が
  この正規化の必要性を実証
- **方向区別**（{>,>=} vs {<,<=}）: if-leg `>= 0.8` / else-leg `< 0.8` の相補
  ladder は正規形であり違反ではない。違反は「同じ方向の質問に strict と
  inclusive が混在」する場合のみ
- **末尾 identifier attribution**: `metrics.confidence` → `confidence`、
  `Math.abs(correlation)` → `correlation`。`successRate` token は
  `dashData.summary.successRate` でも同一 cluster に入る — metric 名の一致が
  domain 推論の proxy（誤マージは ALLOWED roster で正当理由付き分類する）

## 5.既知 ceiling（REQ-403-008）

- 文字列埋め込み比較（alert-rules PromQL）・literal-on-left・複数行 LHS は
  対象外
- comment 行の gate 引用は documentation なので skip（stale-comment census
  (REQ-396) が comment 側の健全性を管轄）
