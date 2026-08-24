# sort-receiver-mutation census — 自動分析記録

<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals 設計自動分析記録](../speech-to-visuals/design-interview.md)
>
> - parent: `speech-to-visuals/design-interview.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-25
**分析実施**: step4 既存情報ベースの差分分析と自動統合

## 分析目的

破壊的配列操作（`.sort(` / `.reverse(`）の receiver に aliased-input（caller
引数・外部 object field）が実在するかを機械的 discovery で確定する — 全
call site 数・in-place site 数・各 receiver の分類（LOCAL-BUILT /
OWN-FIELD / defect）・reverse / comparator-less 軸の実測・既存正典との
照合を要件化の前提として確定する。

## 分析項目と判断

### A1: class の実在性（receiver 判別全数計測）

**カテゴリ**: 優先順位
**背景**: read のつもりの `.sort()` が共有配列を破壊する site が実在するか。
個別の copy 形修正（`[...this.errorQueue].reverse()` 等）はあるが receiver
軸の全数計測はされたことがない。

**判断**: production surface（repo src/ + @stv/core core-four）を
`.sort(` / `.reverse(` 全 call で sweep し receiver を判別した結果:
**`.sort(` 74 site 中 in-place 24 site・`.reverse(` 2 site とも copy 形・
comparator-less 0 site**。22 in-place site を受見分類した結果、
LOCAL-BUILT 22 + OWN-FIELD 2 で **aliased-input は 0 件** —
confirmed-clean census（ALLOWED 24 key / ERADICATED 0 key）として
roster を固定し、新規 in-place site を RED で差し戻す ratchet とした。

**根拠**: guard 初回 RED run（completeness が手動分類漏れ 3 site —
`export-artifact-store:201 entries`・`improvement-detector:74
opportunities`・`LayoutOptimizer:74 nodes` — を列挙）と全 24 site の
文脈読み（roster 理由として保存）。

**信頼性への影響**: REQ-407-001〜005 を 🔵 で確定（file:line 付き実測）。

### A2: 今期 steering の処理（phantom 確認・継続性）

**カテゴリ**: 整合性
**背景**: 今期の make-run steering は (1) make-run コミット分割単位修正、
(2) EDGE-130 multi-token coverage bonus、(3) EDGE-131/132 hidden-value
漏洩 channel 洗い出しの 3 件。

**判断**: (2)(3) の具名 symbol は前 2 期（REQ-405/406 の interview-record）
と同じく `grep -rln "EDGE-13\|SampleDetailModal"` で src/tests/specs/docs
すべて 0 件（前 2 期の分析記録のみに Hit）= **cross-repo phantom 確定**。
(1) のコミット分割単位は hub 側 harness 実装で本 repo 編集対象外 —
REQ-402/406 が既に「取り残し変更が sweep commit に漏れ出る経路を landing
時点で RED 化」する構造的答案を提供済みであり、本要件も REQ-407-007 で
同一 commit 同梱を dogfood する。steering の META-intent（可視 channel へ
の暗黙の整列・機械的な sibling 洗い出し）は「同じ操作の全 site を機械
計測して未分類を残さない」census 方法論として本要件に継承。

**根拠**: 当該 grep 実行結果（2026-08-25）・REQ-405/406 interview-record
の A2/背景項（同一処理の 3 期連続）。

**信頼性への影響**: 影響なし（phantom 判定の記録継続）。

### A3: ERADICATED 0（src 変更ゼロ）の妥当性

**カテゴリ**: 価値判断
**背景**: 撲滅対象 0 件の census に価値があるか。copy 形への統一を
強制すべきではないか。

**判断**: 統一不要。in-place sort の 20 LOCAL-BUILT site は「accumulator
を sort で確定して single hand-off する」正しい idiomatic 形であり copy
化は無駄割り当て。2 OWN-FIELD site は priority queue・学習 strategy table
の persistent order が状態そのもの。aliased-input 0 件なので撲滅対象なし
— family 8/9/15（confirmed-roster / confirmed-zero pin）と同じ形状。
census の価値は**未来の新規 site 検査**（completeness RED）と**判断の
台帳化**（roster 理由）にある。

**根拠**: 全 24 site の文脈読み（roster 保存済み）・family 9（ALLOWED 11 /
ERADICATED 0）・family 15（confirmed-zero pin）の先行採択。

**信頼性への影響**: REQ-407-002 の 🔵 確定（ERADICATED 0 key 宣言）。

### A4: reverse / comparator-less 独立 axis の必要性

**カテゴリ**: 設計
**背景**: receiver 軸だけで足りるか。

**判断**: 不足。`.reverse()` は copy 形との構文差が 1 token（`[...x]` の
有無）で最も事故化しやすく、2 live site の copy 形を negative anchor で
固定する。comparator-less `.sort()` は receiver が fresh でも欠陥になる
独立面（数値配列の辞書順 sort）。両 axis を exact-0 pin とし、MW-071
mutation (c) が reverse 軸の独立発火を、liveness fixture (g) が
comparator-less 計上を実証する。

**根拠**: 実測（reverse 2/2 copy 形・comparator-less production 0）・
`__tests__` にのみ `.sort()` が 13 file 存在する事実（production に入った
際の検知必要性）。

**信頼性への影響**: REQ-407-003/004 を 🔵 で確定。

## 分析結果の総合

class は機械的に閉じられる（receiver 判別は行 scan で完結・aliasing 判断
は roster 台帳化）。実 tree は confirmed-clean だが、guard の初回 RED が
手動分類の 3 site 漏れを実証しており、exact both-ways roster の teeth は
実効的。REQ-407-001〜009 として要件化する。
