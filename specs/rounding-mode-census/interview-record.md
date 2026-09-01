# rounding-mode census — 自動分析記録

<!-- spine:anchor:begin -->
> **Spine anchor**: [Speech-to-Visuals システム憲法 V2.8](../../SYSTEM_CONSTITUTION.md)
>
> - parent: `SYSTEM_CONSTITUTION.md`
> - role: `feature_root`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-24
**分析実施**: step4 既存情報ベースの差分分析と自動統合

## 分析目的

REQ-403（family 12）が閉じた比較側の境界 class について、出力側（丸め mode）
の同型 class が本 repo に実在するかを機械的 discovery で確定する —
cluster の全数・mixed cluster の有無・分類（ALLOWED）と unify の是非・
既存 test への影響を既存正典と照合して要件化の前提を確定する。

## 分析項目と判断

### A1: class の実在性（mixed-rounding cluster の全数計測）

**カテゴリ**: 優先順位
**背景**: 同一式への Math mode 混在が実在するか。従来の frame 系修正は
個別 site の pin で、mode の組合せは計測されたことがない。

**判断**: production surface（repo src/ + @stv/core core-four）を
`Math.(round|floor|ceil)(` で sweep し、引数を空白正規化して clustering
した結果: **site 242 / cluster 188 中、mixed cluster 1 件（3 site）**のみ
—— `duration * fps`（renderer `round` vs engine/worker `ceil`）。他 187
cluster は一貫 mode。class は実在するが既存 single-source pin の効果もあり
発生率は低い — census は「閉じたこと」の証明として価値を持つ。

**根拠**: 行内 paren-balance 抽出の discovery 実行結果（複数行 wrap 2 件は
ceiling として除外）。

**信頼性への影響**: REQ-404-001〜003 を 🔵 で確定（file:line 付き実測）。

### A2: 分類か unify か — `duration * fps` の 2 domain 分割

**カテゴリ**: 設計判断
**背景**: 唯一の mixed cluster を統一すべきか分類すべきか。cluster が消える
だけであれば unify の方が guard は単純になる。

**判断**: **ALLOWED 分類**（統一しない）。`duration` が指す量が site 間で
異なる: (1) `animated-scene-renderer.ts:198` は clampSceneDuration 済みの
**per-scene** 秒（Lottie layer の keyframe timing は最近接 frame 構文が正しい
— fade は公称 0.3s 目盛りに最も近い frame に置く。test suite が frame
9/141/150 を pin）、(2) `enhanced-export-engine.ts:596` は settings.duration
|| 全 scene 合算の **whole-export** 秒（`FrameData[]` の長さ = render loop の
回数。round にすると積が x.5 以上のとき末尾の内容を半 frame 切り詰める =
coverage 契約違反）、(3) `export-worker.ts:39` は (2) の worker 側 mirror
（engine が自前の totalFrames を buildFramesFromWorkerResult に渡すため
両者は同 mode 必須）。統一は (a) keyframe を引き伸ばすか (b) 末尾を
under-cover するかの回帰。REQ-403 が ALLOWED 概念として予言した
「genuinely different domains の same-token 偶然」の初実測。

**根拠**: 3 site の context 全読み・`tests/unit/export/animated-svg-lottie-export.test.ts`
の keyframe pin・engine→worker の totalFrames 受け渡し経路。

**信頼性への影響**: REQ-404-003/004 を 🔵 に確定。

### A3: cluster key の正規化範囲（text 完全一致の限界）

**カテゴリ**: 未定義部分詳細化
**背景**: 引数 text をどこまで正規化するか。commutation・意味的同型綴りを
join すべきか。

**判断**: 空白正規化のみ。`duration  *  fps` ≡ `duration * fps` は同一
cluster に必要（実測 tree に空白揺れが存在）。一方 `fps * duration`（operand
順）や `durationMs / 1000 * fps`（意味的同型）は join しない — 誤 join は
別概念（fps 換算の別契約）を同じ cluster に混ぜ、ALLOWED roster を肥大化
させる。同型綴りの重複は fold series（converged・REQ-201）と single-source
canon family の管轄。liveness test (c) が commutation 不検出を固定。

**根拠**: 正規化範囲を変えた discovery の差分と fold-census-families の
収束宣言。

**信頼性への影響**: REQ-404-002 を 🔵（空白揺れ実測）・REQ-404-008 を 🟡
（ceiling 明示は regex 構造上の推論）。

### A4: 分類 site への mode 固定（negative anchor）の妥当性

**カテゴリ**: 影響範囲
**背景**: ALLOWED 3 site は mode flip しても cluster が再混合されない
経路があるか（flip が無検出にならないか）。

**判断**: 3 独立の検出経路が存在: (1) renderer を ceil に flip すると
cluster が単一 mode 化し 3 site 全てが mixed cluster から外れる →
stale-row test が 3 件 RED、(2) engine を round に flip しても worker の
ceil が cluster を mixed 保持するため engine site は live のまま — 検出は
negative anchor が単独で担う（cluster を消さない flip の捕獲経路）、
(3) roster 外 file へ `Math.floor(duration * options.fps)` を注入すると
新規 mixed cluster → completeness RED（未判定 cluster の全 site が RED）。
MW-068 の 3 mutation はこの経路をそれぞれ実測した。

**根拠**: discovery の cluster 機構に対する mutation シミュレーション。

**信頼性への影響**: REQ-404-007 を 🔵 で確定（RED 実測予定）。

### A5: 修正が実装に与える影響（振る舞い変更ゼロ）

**カテゴリ**: リスク
**背景**: 本 facet は撲滅（mode 変更）を伴わない。src 変更はあるか。

**判断**: なし — 本 facet の変更面は guard 新設 + roster + three-way 登録 +
spine landing のみ。src の 3 site は現行 mode のまま negative anchor で
固定される。振る舞い変更ゼロのため既存 unit test への影響もない
（lottie keyframe pin は現行 round 挙動のまま）。

**根拠**: 3 site の diff なし・guard の read-only 性。

**信頼性への影響**: REQ-404-004 を 🔵 に確定。

## 分析結果サマリー

### 確認できた事項

- rounding site 242 / cluster 188 / mixed cluster 1（3 site）の実測
- 唯一の mixed cluster は 2 domain 分割（per-scene keyframe timing vs
  whole-export render coverage）で ALLOWED 分類が正当
- mode flip 3 経路が独立に RED になる検出構造

### 設計方針の決定事項

- census 違反 = 同一空白正規化引数 cluster 内 2 mode 以上の混在
- ALLOWED 3 key（domain 理由付き）+ ERADICATED confirmed-zero + negative
  anchor 3 件
- three-way family 13 登録・census-pin marker F13

### 残課題

- なし（MW-068 は TASK-0290 として同 commit で実施）

### 信頼性レベル分布

**分析後**: 🔵 5 / 🟡 1（REQ-404-008 ceiling 明示）/ 🔴 0

## 関連文書

- **要件定義書**: [requirements.md](requirements.md)
- **コンテキストノート**: [note.md](note.md)
