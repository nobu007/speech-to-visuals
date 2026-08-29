# boundary strictness census — 自動分析記録

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

make-run steering（Phase 200 feedback）の「exact-rational boundary class は
census で close せよ」META-intent を、本 repo の実測に基づいて要件化する前提を
確定する — class の実在性・cluster の全数・統一方向の規約・正規化の必要性を
機械的 discovery と既存正典の照合で確定する。

## 分析項目と判断

### A1: class の実在性（steering 具象 symbol は phantom・class は実在）

**カテゴリ**: 優先順位
**背景**: steering は TASK-0357〜0359・z-score・deviation-score・effect-size・
difficulty-ranking を挙げた。これらは本 repo に実在するか。

**判断**: 具象 symbol は全て grep 0 件の cross-repo phantom（REQ-402 interview
record A4 が同じ結論・本 run も再確認）。しかし class 定義（computed float の
strict 比較による境界解釈）で機械的 sweep した結果、production surface の
comparison site 145 / cluster 126 中に **mixed-strictness cluster 3 件**を実測。
class は実在し、0.6 正典（diagram-detection-constants.ts）が記録した事故と
同型だった。

**根拠**: discovery script（identifier×literal×方向 clustering・literal 正規化
付き）の実行結果と、0.6 正典 JSDoc の事故記述の照合。

**信頼性への影響**: REQ-403-001〜004 を 🔵 で確定（cluster 3 件は file:line
付き実測）。

### A2: 統一方向 — なぜ inclusive（`>=`）か

**カテゴリ**: 設計判断
**背景**: split の統一方向に客観的根拠が必要（逆方向でも cluster は消える）。

**判断**: boundary-INCLUSIVE に統一。根拠は 3 点: (1) 0.6 正典の JSDoc が
「"is this good enough?" gate は EQUALS で合格」と規約化済み、(2) detector
test suite は一貫して `toBeGreaterThanOrEqual` で pin、(3) `/health` route
（user-facing）が既に `>= 0.95` healthy であり、health-check-service を
strict のまま route を `>` に倒すと 19/20 で healthy→degraded に**悪化**する
（逆方向は既存 user-visible 挙動の退行を伴う）。

**根拠**: diagram-detection-constants.ts 全読み・`src/analysis/__tests__/
diagram-detector*.test.ts` の境界 pin 検査・両 endpoint の現行挙動比較。

**信頼性への影響**: REQ-403-004 を 🔵 に確定。

### A3: literal 正規化の必要性（spelling drift の隠蔽）

**カテゴリ**: 未定義部分詳細化
**背景**: `0.8` と `0.80` は同じ数値だが text としては別物。cluster key に
literal text をそのまま使うと spelling違いが分裂を隠す。

**判断**: successRate @ 0.8 cluster がまさにその shape だった —
iteration-manager は `>= 0.8`・health-check-service は `> 0.80`。text そのまま
の clustering では同一 cluster にならず、この分裂は不可視のまま残る。
`String(Number(x))` 正規化を discovery に組み込み、liveness test (a) が
`0.80`/`0.8` spelling違いの同一 cluster 検出を固定する。

**根拠**: 正規化あり/なし両方で discovery を実行した差分（3 cluster vs 2 cluster）。

**信頼性への影響**: REQ-403-002 を 🔵 に確定（実 cluster で実証）。

### A4: 境界到達性 — 演算子選択が急所である条件

**カテゴリ**: 影響範囲
**背景**: strict/inclusive は値が threshold と一致する入力でのみ不同意する。
本 repo の 3 cluster でその入力は現実に到達可能か。

**判断**: 3 cluster とも ratio metric（単一除算）で、threshold×分母 が整数の
入力（19/20・4/5・1/2）で比較値は literal と同一 double になる = 完全一致が
到達可能。health-check 側は `realTimeMonitor.getSnapshot()` の実測 successRate
がそのまま入るため、監視 window の取り方次第で常に到達し得る。一方
`avgProcessingTime < 60000` 等の整数 threshold は表現誤差を持たず本 class の
外側 — 対象外とする設計判断の根拠。

**根拠**: IEEE 754 correctly-rounded 除算の性質・snapshot 経路（REQ-349 guard
コメント）の読み。

**信頼性への影響**: REQ-403-001 の整数除外を 🟡→🔵（到達性の実在）。

### A5: 修正の既存 test への影響

**カテゴリ**: リスク
**背景**: `>`→`>=` 変更が既存境界 test を壊すか。

**判断**: health-check-service test の境界 fixture は 0.98 / 0.85 / 0.70 /
0.60 / 0.50 — いずれも境界値（0.95/0.80/0.5）そのものを使わず、厳密な
不等号側に離れているため演算子変更の影響を受けない。detector 側は
evaluateDetection の判定結果が無消費（dead private method・呼び出し 0 件）で
挙動面は無影響、純粋な整合化。test title / comment の旧演算子引用 2 箇所は
stale 化するため同 commit で更新する。

**根拠**: `tests/unit/monitoring/health-check-service.test.ts` 境界 fixture
全数検査・`evaluateDetection` caller grep 0 件。

**信頼性への影響**: REQ-403-004 の撲滅を 🟡→🔵（全 run で GREEN 検証予定）。

## 分析結果サマリー

### 確認できた事項

- comparison site 145 / cluster 126 / mixed-strictness cluster 3（6 site）の実測
- 3 cluster 全てで境界値（19/20・4/5・1/2）が到達可能 — endpoint 間不同意は現実的
- 統一方向 inclusive は 0.6 正典・test pin・user-visible 挙動の 3 根拠で支持

### 設計方針の決定事項

- census 違反 = 同一 (identifier, 正規化 literal, 方向) cluster 内 strict/inclusive 混在
- ALLOWED 空（confirmed-zero）+ ERADICATED 3 site pin + negative anchor 6 件
- three-way family 12 登録・census-pin marker F12

### 残課題

- なし（MW-067 は TASK-0288 として同 commit で実施）

### 信頼性レベル分布

**分析後**: 🔵 5 / 🟡 1（REQ-403-008 ceiling 明示は regex 構造上の推論）/ 🔴 0

## 関連文書

- **要件定義書**: [requirements.md](requirements.md)
- **コンテキストノート**: [note.md](note.md)
