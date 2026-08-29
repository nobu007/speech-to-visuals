# finite-safe-aggregation タスク概要


<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](../../speech-to-visuals/architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-15
**プロジェクト期間**: 2026-08-18 - 2026-08-20（3日）
**推定工数**: 27時間
**総タスク数**: 9件

## 関連文書

- **要件定義書**: [📋 requirements.md](../requirements.md)
- **設計文書**: [📐 architecture.md](../architecture.md)
- **データフロー図**: [🔄 dataflow.md](../dataflow.md)
- **設計自動分析記録**: [💬 design-interview.md](../design-interview.md)
- **要件分析記録**: [💬 interview-record.md](../interview-record.md)
- **コンテキストノート**: [📝 note.md](../note.md)

（api-endpoints.md / database-schema.sql / interfaces.ts は対象外 — ライブラリ内部変更で新規 API/DB 無し）

## フェーズ構成

| フェーズ | 期間 | 成果物 | タスク数 | 工数 | ファイル |
|---------|------|--------|----------|------|----------|
| Phase 1 | 8/18 | sweep 再確定 + helper 4 関数 + オラクル | 2件 | 6h | [TASK-0001~0002](#phase-1-基盤) |
| Phase 2 | 8/18-8/19 | T1 サイト移行 ×4 ウェーブ + T2/T3 確定分 | 5件 | 16h | [TASK-0003~0007](#phase-2-サイト移行) |
| Phase 3 | 8/20 | registry family + 総合検証 | 2件 | 5h | [TASK-0008~0009](#phase-3-ガードと総合検証) |

## タスク番号管理

**使用済みタスク番号**: TASK-0001 ~ TASK-0011
**次回開始番号**: TASK-0012

## 全体進捗

- [x] Phase 1: 基盤（sweep + helper）— 2026-08-15 完了（TASK-0001 sweep メモ + TASK-0002 commit 6fa7d591、36/36 GREEN）
- [x] Phase 2: サイト移行（ウェーブ 2-6）— 2026-08-15 完了（cef513cd / d2fff302 / a37db62d / 4a3c2da3 / fe4af157、全ウェーブ per-site オラクル付き）
- [x] Phase 3: ガードと総合検証（ウェーブ 7 + criteria クローズ）— registry 0adc147a（RED 検証済み）、criteria [x] 化
- [x] 拡張ラウンド 19（2026-08-16, TASK-0010）: sweep 宣言済み未実行の enhanced-error-recovery interface mean 6 サイト + 未 triage の src/monitoring 大陸（production-monitor: raw mean / hand-rolled floor-rank percentile 最後の twin / incremental mean 永久 NaN）+ health-tracker avgRecovery。registry round 19（site pins・monitoring root・percentile index 禁止 rule）。round 20 候補（framework/api 大陸）は TASK-0010 対象外表に理由付きで正本化
- [x] 拡張ラウンド 20（2026-08-16, TASK-0011）: framework/api 大陸を sweep 正本リスト化し移行 5 サイト（batch summary interface フィールド sum+mean / rci 誤述語 `typeof` filter / learner userFeedback `|| 0` 0 置換）+ 対象外 12 サイトは理由付きで確定。registry round 20（site pins +3・discovery roots に framework/api 追加・continuous-learner 除外登録）。全大陸（analysis/quality/export/monitoring/framework/api）の triage 完了

## マイルストーン

- **M1: helper 完成** (8/18): safeSum/mean/max/min + オラクル GREEN（移行前でも価値ある単独コミット）✅ 2026-08-15 達成（6fa7d591）
- **M2: T1 移行完了** (8/19): 外部起因 NaN 伝播の遮断（llm-service / diagram-detector / scene-segmenter / error-recovery）✅ 2026-08-15 達成（cef513cd〜4a3c2da3）
- **M3: feature 完了** (8/20): registry ガード + 全 suite GREEN + criteria [x] ✅ 2026-08-15 達成（0adc147a + criteria クローズ）

---

## Phase 1: 基盤

**期間**: 2026-08-18
**目標**: 移行の入力となる正本リストの確定と、単一ソース helper の実装
**成果物**: sweep リスト / `src/lib/metrics-utils.ts` 4 関数 / `tests/guards/finite-safe-aggregation.test.ts`

### タスク一覧

- [x] [TASK-0001: 移行対象サイトの sweep 再確定](TASK-0001.md) - 2h (DIRECT) 🔵 — 正本リスト: [sweep-20260815.md](sweep-20260815.md)
- [x] [TASK-0002: finite-safe helper 4 関数の実装と仕様・fuzz オラクル](TASK-0002.md) - 4h (TDD) 🔵 — commit 6fa7d591

### 依存関係

```
TASK-0001 ∥ TASK-0002（並行可）
TASK-0001 → TASK-0003〜0007
TASK-0002 → TASK-0003〜0007
```

---

## Phase 2: サイト移行

**期間**: 2026-08-18 - 2026-08-19
**目標**: design ウェーブ 2-6。T1（外部起因）を先に、T2/T3 は sweep 確定分を移行
**成果物**: 移行済み 5 コミット（`behavior change:` ラベル要否はサイトごとに D2 基準で判定）+ 各サイトの数値デルタオラクル

### タスク一覧

- [x] [TASK-0003: llm-service 応答時間 mean の safeMean 移行](TASK-0003.md) - 3h (TDD) 🔵 — cef513cd
- [x] [TASK-0004: diagram-detector score mean + pattern max の移行](TASK-0004.md) - 3h (TDD) 🔵 — d2fff302
- [x] [TASK-0005: scene-segmenter duration mean の移行](TASK-0005.md) - 3h (TDD) 🔵 — a37db62d
- [x] [TASK-0006: enhanced-error-recovery timestamp min/max spread の移行](TASK-0006.md) - 3h (TDD) 🔵 — 4a3c2da3
- [x] [TASK-0007: T2/T3 確定分（export / performance / visualization）の移行](TASK-0007.md) - 4h (TDD) 🟡 — fe4af157（exporter 687/780 のみ。performance/visualization は sweep で対象外確定）

### 依存関係

```
TASK-0001 + TASK-0002 → {TASK-0003, TASK-0004, TASK-0005, TASK-0006}（4 タスク並行可）
TASK-0001 → TASK-0007（sweep 判定が前提）
```

---

## Phase 3: ガードと総合検証

**期間**: 2026-08-20
**目標**: design ウェーブ 7 + feature 完了条件の実行証拠
**成果物**: registry family エントリ（単一ファイル維持）/ criteria [x] 化

### タスク一覧

- [x] [TASK-0008: frozen-literal registry family の追加](TASK-0008.md) - 3h (TDD) 🟡 — 0adc147a（RED 検証済み、20/20 GREEN）
- [x] [TASK-0009: 総合検証と acceptance criteria のクローズ](TASK-0009.md) - 2h (DIRECT) 🔵 — criteria 全 [x]、実行証拠は各タスクファイルに記載

### 依存関係

```
TASK-0003〜0007 → TASK-0008 → TASK-0009
```

---

## 信頼性レベルサマリー

### 全タスク統計

- **総タスク数**: 9件
- 🔵 **青信号**: 7件 (78%)
- 🟡 **黄信号**: 2件 (22%)（TASK-0007: sweep 依存の対象確定度 / TASK-0008: registry 検出パターンの実効性）
- 🔴 **赤信号**: 0件 (0%)

### フェーズ別信頼性

| フェーズ | 🔵 青 | 🟡 黄 | 🔴 赤 | 合計 |
|---------|-------|-------|-------|------|
| Phase 1 | 2 | 0 | 0 | 2 |
| Phase 2 | 4 | 1 | 0 | 5 |
| Phase 3 | 1 | 1 | 0 | 2 |

**品質評価**: 高品質（全タスクが architecture.md D1-D7 の確定済み設計に直結。🔴 なし。🟡 は sweep・実効性という検証可能な不確定要素のみ）

## クリティカルパス

```
TASK-0002 → TASK-0003 → TASK-0008 → TASK-0009
```

**クリティカルパス工数**: 12時間
**並行作業可能工数**: 15時間（TASK-0001 並行 + Phase 2 の 4 タスク並行）

## 次のステップ

タスクを実装するには:

- 全タスク順番に実装: `/tsumiki:kairo-implement`
- 特定タスクを実装: `/tsumiki:kairo-implement TASK-0002`
