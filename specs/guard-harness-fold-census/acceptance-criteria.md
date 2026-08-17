# table-driven ガードハーネス抽出と fold 収束 census 受け入れ基準

**作成日**: 2026-08-18
**関連要件定義**: [requirements.md](requirements.md)
**関連ユーザストーリー**: [user-stories.md](user-stories.md)
**分析記録**: [interview-record.md](interview-record.md)

**【信頼性レベル凡例】**:

- 🔵 **青信号**: 既存実装・実測値・green run ログを参考にした確実な基準
- 🟡 **黄信号**: 既存実装・steering から妥当な推測による基準
- 🔴 **赤信号**: 参照資料にない自動推定による基準

**検証環境**: Node 24（CI = ci.yml 全 job・ローカル実測 v24.11.1）。
jest 実行は `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096'`
が必須（省略時 ESM/preset 検証エラー）。worktree では
`ln -s /home/jinno/speech-to-visuals/node_modules node_modules` 必須。

---

## REQ-001〜003: table-driven harness の提供 🔵

**信頼性**: 🔵 *round 46〜50 の 5 family 実測解剖より*

### Given（前提条件）

- `tests/guards/` に freeze-guard engine・frozen-literal-rules registry・42 family module が存在する
- round 46〜50 の per-family test が 3 層構造（verbatim oracle / semantic pin / source anchor）で存在する

### When（実行条件）

- harness モジュール（oracle row / anchor row の型と runner）を実装し、
  data row から describe/it ブロックを生成する

### Then（期待結果）

- oracle row は `object-is` / `delta<=ε`（witness 強制）の両 mode を生成できる
- anchor row は「正規表現が指定回数出現」と「コード行に ban 正規表現が出現しない」を検証する
- 不正 row（負の回数・空 corpus・ε 未指定 delta）は明示的 validation error で fail する（EDGE-001）

### テストケース

#### 正常系

- [ ] **TC-001-01**: harness 単体テスト — 各 mode の row が期待する it を生成する 🔵
  - **入力**: 最小 oracle row 2 件（object-is / delta）+ anchor row 2 件（allow / ban）
  - **期待結果**: 生成 it が全 GREEN・test 名に row id が含まれる
  - **信頼性**: 🔵 *既存 3 層構造からの直接写像*
- [ ] **TC-001-02**: readSource が `import.meta.url` 起点で動作する 🔵
  - **入力**: worker cwd が移動する既知条件（whisper-node chdir）
  - **期待結果**: census/anchor の読み取りが影響を受けない（NFR-101）
  - **信頼性**: 🔵 *source-anchor-cwd-discipline.test.ts の既存規律*

#### 異常系

- [ ] **TC-001-E01**: 不正 row の fail-loud 🔵
  - **入力**: 出現回数 -1・delta mode で ε 未指定
  - **期待結果**: 実行時に明示的 validation error（silent skip しない）
  - **信頼性**: 🔵 *fail-loud defaults の既存原則*

#### 境界値

- [ ] **TC-001-B01**: delta bound の vacuum 検出 🔵
  - **入力**: corpus 上一度も delta が発生しない delta row（witness なし）
  - **期待結果**: RED（witness あり row は deltas > 0 を要求して通る）
  - **信頼性**: 🔵 *grid-packing `expect(deltas).toBeGreaterThan(0)` の実績*

---

## REQ-004: 2 family 移行の等価証明 🔵

**信頼性**: 🔵 *round 35 fingerprint 手法の前例より*

### Given（前提条件）

- default-node-extent-single-source.test.ts（365 行）と
  grid-packing-single-source.test.ts（440 行）が現行形で存在する

### When（実行条件）

- 両 family の Layer 1 / Layer 3 を harness data row へ移行する

### Then（期待結果）

- 移行前後で test 名 + expectation 数の列挙が一致（差分は理由明記のみ）
- Layer 2 pin は per-family test に残る
- production コード（src/）に差分 0（REQ-401）

### テストケース

#### 正常系

- [ ] **TC-004-01**: fingerprint 一致 🔵
  - **入力**: 移行前後の test 列挙
  - **期待結果**: assertion 欠落 0
  - **信頼性**: 🔵 *round 35 before/after fingerprint の再利用*

#### 異常系

- [ ] **TC-004-E01**: mutation RED（最低 5 種） 🔵
  - **入力**: ban 削除 / 回数 ±1 / oracle ε 緩和 / corpus 縮小 / witness 除去
  - **期待結果**: 各変異で対応生成 test が RED
  - **信頼性**: 🔵 *round 43〜50 の mutation-RED 規律（5 種以上が慣行）*

#### 境界値

- [ ] **TC-004-B01**: 実行時間 ±20% 以内（REQ-403） 🔵
  - **入力**: `--testPathPatterns 'default-node-extent|grid-packing'` の移行前後所要時間
  - **期待結果**: 合計時間が移行前の ±20% 以内
  - **信頼性**: 🔵 *registry sweep 2.0s・CI test job 16m44s からの予算設定*

---

## REQ-005 / REQ-201〜202: census guard と収束判定 🟡

**信頼性**: 🟡 *実測ベースラインは 🔵 だが ratchet 機構は新設*

### Given（前提条件）

- census ベースライン（2026-08-18）: 既 fold 違反 0 / C1 = 32 match 20 file
  （実挙動変更）/ C2 = 8 出現 4 file（設計判断）/ C3〜C5 = 各 1 file（異概念・閾値未満）
- value-neutral 候補 = 0 family

### When（実行条件）

- census guard test（site 数 pin + ratchet）を実装して実行する

### Then（期待結果）

- 現状 site 数で GREEN（pin 一致）
- site 増加は RED・減少は pin 更新要求（EDGE-102: 0 化は family 行の明示記録）
- census 表（requirements.md）と pin が同一 grep コマンド由来（REQ-404）

### テストケース

#### 正常系

- [ ] **TC-005-01**: ベースライン pin GREEN 🔵
  - **入力**: census guard 実行
  - **期待結果**: C1〜C5 の pin 数値が現況と一致（C1 = 20+12 match 等）
  - **信頼性**: 🔵 *2026-08-18 実測値*
- [ ] **TC-005-02**: コード行フィルタの安定性 🔵
  - **入力**: コメントに ban 形状を含む行（例: ezo clamp01 コメント）
  - **期待結果**: コメント行は計測対象外（EDGE-002）
  - **信頼性**: 🔵 *codeLines() の既存実績*

#### 異常系

- [ ] **TC-005-E01**: ratchet 🔵
  - **入力**: C1 に新たな inline clamp を 1 site 追加した状態
  - **期待結果**: census guard RED
  - **信頼性**: 🔵 *pin+ratchet の既存手法（frozen-literal registry と同型）*

#### 境界値

- [ ] **TC-005-B01**: 0 site 化 🔵
  - **入力**: 家族の site 数が 0 になった状態
  - **期待結果**: pin 更新要求（0 へ）・family 行は残置
  - **信頼性**: 🔵 *EDGE-102 設計*

---

## REQ-104 / REQ-405 / REQ-301: CI 検証証拠 🔵

**信頼性**: 🔵 *実採取 green run より*

### Given（前提条件）

- CI 修復（2fcbd4f0）以降の green run が存在:
  [32045615156](https://github.com/nobu007/speech-to-visuals/actions/runs/32045615156)（infra/ci-repair・11/11 job ✓・test 16m44s）、
  [32047074800](https://github.com/nobu007/speech-to-visuals/actions/runs/32047074800)（main PR #3 ✓）、
  [32047436015](https://github.com/nobu007/speech-to-visuals/actions/runs/32047436015)（PR #1 ✓）
- ci.yml 全 10 job が node 24。infrastructure.yml:37 のみ node 18 残留
- ローカル（node v24.11.1・HEAD c7fe762d）: tsc exit 0・eslint exit 0・registry sweep 49 test GREEN

### When（実行条件）

- 記録の検証、および（任意対応）infrastructure.yml の node-version 統一

### Then（期待結果）

- 証拠記録が run URL + 対象 commit SHA を含む（本 interview-record A3 で充足済み）
- node 18 残留は 24 へ統一されるか、残す理由が workflow コメントに明記される

### テストケース

#### 正常系

- [ ] **TC-104-01**: 記録 invariants 🔵
  - **入力**: interview-record A3
  - **期待結果**: 全 run エントリが URL と SHA/branch を含む
  - **信頼性**: 🔵 *本記録の実測形式*
- [ ] **TC-104-02**: node-version 統一（REQ-301 対応時） 🔵
  - **入力**: `grep -n 'node-version' .github/workflows/*.yml`
  - **期待結果**: 24 のみ（または 18 残留理由のコメント付き）
  - **信頼性**: 🔵 *2026-08-18 実測（ci.yml×10 = 24・infrastructure.yml:37 = 18）*

#### 境界値

- [x] **TC-104-B01**: HEAD run の結論確認 🔵
  - **入力**: `gh run view 32051182417`（c7fe762d）
  - **期待結果**: success — **2026-08-18 再採取で 11/11 job ✓ を確認済み**
  - **信頼性**: 🔵 *2026-08-18 完了時点の実測（status completed / conclusion success）*

---

## 非機能要件テスト

### NFR-001: パフォーマンス 🟡

**信頼性**: 🟡 *registry 2.0s 実測からの新設予算*

- [ ] **TC-NFR-001-01**: harness + census guard の合計 10 秒以内
  - **測定項目**: `--testPathPatterns 'frozen-literal-registry|guard-harness|fold-census'` 所要時間
  - **目標値**: ≤ 10 秒
  - **測定条件**: node 24・CI test job と同一コマンド

### NFR-101: セキュリティ（走査規律） 🔵

- [ ] **TC-NFR-101-01**: cwd 非依存
  - **検証内容**: worker cwd 移動下で census/anchor readSource が正しいファイルを読む
  - **期待結果**: 全 read が `import.meta.url` 起点（既知 FLAKE 回帰 0）

---

## Edgeケーステスト

### EDGE-001 / EDGE-101: harness 入力の境界 🟡

- [ ] **TC-EDGE-001-01**: fail-loud row 検証（TC-001-E01 と同梱）
  - **条件**: 不正 row 値
  - **期待結果**: 明示 error（silent skip なし）

### EDGE-102: census 0 site 化 🟡

- [ ] **TC-EDGE-102-01**: family 行の無声削除防止
  - **条件**: census で 0 になった家族
  - **期待結果**: 「0（収束）」として行が残る

---

## テストケースサマリー

### カテゴリ別件数

| カテゴリ | 正常系 | 異常系 | 境界値 | 合計 |
|---------|--------|--------|--------|------|
| 機能要件（harness / census / CI） | 7 | 3 | 4 | 14 |
| 非機能要件 | 2 | 0 | 0 | 2 |
| Edgeケース | 0 | 1 | 1 | 2 |
| **合計** | 9 | 4 | 5 | 18 |

### 信頼性レベル分布

- 🔵 青信号: 15 件 (83%)
- 🟡 黄信号: 3 件 (17%)
- 🔴 赤信号: 0 件 (0%)

**品質評価**: 高品質（実測ベースライン・実績手法の再利用中心）

### 優先度別テストケース

- **Must Have**: 16 件（harness 生成・等価証明・mutation RED・census ratchet・CI 記録・NFR 計測）
- **Should Have**: 2 件（node 18 統一 TC-104-02 / HEAD run 再採取 TC-104-B01）

---

## テスト実施計画

### Phase 1: harness 抽出（Must Have）

- REQ-001〜004 / TC-001-xx・TC-004-xx
- 実施予定: 次イテレーション（design フェーズ後）

### Phase 2: census 機械化（Must Have）

- REQ-005 / 103 / 201〜202 / TC-005-xx
- 実施予定: Phase 1 と同一イテレーション可（独立）

### Phase 3: CI 証拠残件（Should Have）

- REQ-301 / TC-104-02〜B01
- 実施予定: 任意タイミング（workflow 1 行変更 + 再 run）

## 共通検証コマンド

```sh
# worktree 初期化（未実施の場合）
ln -s /home/jinno/speech-to-visuals/node_modules node_modules

# guard 系（registry + 移行 family + census）
NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' \
  npx jest --config jest.config.cjs \
  --testPathPatterns 'frozen-literal-registry|single-source|fold-census'

# 型チェック・lint
node_modules/.bin/tsc -p tsconfig.app.json --noEmit
npx eslint .

# CI 状態
gh run list --repo nobu007/speech-to-visuals --limit 5
```
