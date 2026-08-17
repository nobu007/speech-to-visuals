# table-driven ガードハーネス抽出と fold 収束 census ユーザストーリー

**作成日**: 2026-08-18
**関連要件定義**: [requirements.md](requirements.md)
**分析記録**: [interview-record.md](interview-record.md)

**【信頼性レベル凡例】**:

- 🔵 **青信号**: 既存実装・実測値を参考にした確実なストーリー
- 🟡 **黄信号**: 既存実装・steering から妥当な推測によるストーリー
- 🔴 **赤信号**: 参照資料にない自動推定によるストーリー

---

## エピック1: table-driven guard harness（保守者）

### ストーリー 1.1: 新規 fold family を 1 data row で追加したい 🔵

**信頼性**: 🔵 *round 35 registry 分割（新規 family = 1 file + 2 行）の実績と round 46〜50 test 解剖より*

**私は** リポジトリ保守者 **として**
**新しい fold family の guard を oracle 行と anchor 行の data row だけで宣言したい**
**そうすることで** family 追加ごとに 365〜673 行の同型 test を書き直さず、検証漏れ（パターン・ban・corpus の書き忘れ）を構造的に防げる

**関連要件**: REQ-001, REQ-002, REQ-003, REQ-101

**詳細シナリオ**:

1. `tests/guards/frozen-literal-families/<family>.ts` に registry rule を追加（既存手順）
2. harness の data row に oracle 行（正典関数・凍結退役式・corpus・等価 mode）と anchor 行（file × 正規表現出現回数 × ban）を宣言
3. Layer 2 pin（live witness・semantic pin）だけを family 固有 test に書く
4. mutation 変異（ban 削除・回数変更・bound 緩和・corpus 縮小・witness 除去）が RED になることを確認

**前提条件**:

- fold 対象の重複式が特定され、正典 helper が単一ソース化済みであること
- 退役式が commit 時点で凍結取得できること

**制約事項**:

- REQ-401: production 挙動を変えない（assertion 等価移行）
- REQ-402: 正規表現は行ベース単一行

**優先度**: Must Have

---

### ストーリー 1.2: 移行が等価であることを fingerprint で証明したい 🔵

**信頼性**: 🔵 *round 35 の before/after fingerprint（id 列 + pattern shape + roots/files/excludes）手法の前例より*

**私は** リポジトリ保守者 **として**
**harness 移行の前後で実行される assertion 集合が等価であることを機械的に示したい**
**そうすることで** 「移行で guard が弱体化したのでは」という疑念を差分 1 枚で解消できる

**関連要件**: REQ-004, REQ-401

**詳細シナリオ**:

1. 移行前に per-family test の test 名 + expectation 数を列挙して保存
2. harness 移行後に同列挙を生成
3. 2 つの列挙を比較し、欠落 assertion が 0 であることを確認（あるいは増減の理由を明記）

**優先度**: Must Have

---

## エピック2: fold 収束 census（意思決定者）

### ストーリー 2.1: 残り作業の量と性質を数値で把握したい 🔵

**信頼性**: 🔵 *2026-08-18 census 実測（C1〜C5・コマンド付き・interview-record A2）より*

**私は** イテレーション指導者（AI Hub steering） **として**
**残存 inline site の census（family × site 数 × 分類）を guard test として取得したい**
**そうすることで** 「fold 系列を続けるべきか」「残りは value-neutral か実挙動変更か」を感情ではなく機械的に判定できる

**関連要件**: REQ-005, REQ-103, REQ-201, REQ-202, REQ-404

**詳細シナリオ**:

1. census guard test が C1〜C5 家族の site 数を pin して実行される
2. site 数が増えた場合 → RED（分類表の更新または新規 fold が必要）
3. site 数が減った場合 → pin 更新（0 になった家族は「収束」と明示的に記録）
4. census 表（requirements.md）と guard pin が同一 grep コマンド由来であることが担保される

**前提条件**:

- census 分類の基準（value-neutral / 実挙動変更 / 異概念 / 閾値未満）が合意されていること

**制約事項**:

- EDGE-102: 0 site 化で family 行を無声削除しない

**優先度**: Must Have

---

### ストーリー 2.2: fold 系列の終了を宣言したい 🟡

**信頼性**: 🟡 *終了条件の設計（実測ベースラインは 🔵 だが「終了」判定の運用は新設）より*

**私は** イテレーション指導者（AI Hub steering） **として**
**value-neutral 候補が 0 family になった時点で fold 系列の終了を明示したい**
**そうすることで** 以降のイテレーションが既定約の反復（すでに収束した領域の再 fold）に浪費されず、意思決定必要な残作業（C1 clamp NaN 契約・C2 config 出所）に注力できる

**関連要件**: REQ-201, REQ-202

**詳細シナリオ**:

1. census guard が value-neutral 候補数を常時計測
2. 0 family が継続する場合、要件定義書の収束判定を根拠に fold phase を閉じる
3. 新たな value-neutral 候補が出現した場合のみ fold phase を再開する

**優先度**: Should Have

---

## エピック3: CI 検証証拠（検証者）

### ストーリー 3.1: CI 修復の効果を実 run で確認したい 🔵

**信頼性**: 🔵 *run 32045615156（11/11 job ✓・test 16m44s・node 24）ほか green 3 run の実採取より*

**私は** インフラ検証者 **として**
**CI 修復（lock 同期・node 24・artifact・JSONC validate）が実 run で green であることを URL 付きで記録したい**
**そうすることで** workflow 修正が「書いた」から「動いた」に格上げされ、将来の workflow 変更のbaseline として使える

**関連要件**: REQ-104, REQ-405, REQ-301

**詳細シナリオ**:

1. run URL・job 構成・結論・対象 commit SHA を記録（interview-record A3 に実施済み）
2. infrastructure.yml の node 18 残留（37 行）を node 24 へ揃えるか、残す理由を文書化する
3. 以後の workflow 変更は green run URL を commit message / record に添付する

**優先度**: Must Have（記録部分は本要件作成時に完了済み・node 18 揃えは Should Have）

---

## ストーリーマップ

```
エピック1: table-driven guard harness
├── 1.1 新規 family を 1 data row で追加 (🔵 Must Have)
└── 1.2 移行等価を fingerprint で証明 (🔵 Must Have)

エピック2: fold 収束 census
├── 2.1 残り作業の数値 census と ratchet (🔵 Must Have)
└── 2.2 系列終了の宣言 (🟡 Should Have)

エピック3: CI 検証証拠
└── 3.1 green run の URL 付き記録 (🔵 Must Have / 完了済み + 残件 Should Have)
```

## 信頼性レベルサマリー

- 🔵 青信号: 4 件 (80%)
- 🟡 黄信号: 1 件 (20%)
- 🔴 赤信号: 0 件 (0%)

**品質評価**: 高品質（全ストーリーが実測値・実績手法に基づく）
