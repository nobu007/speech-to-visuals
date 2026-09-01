# guard-harness-fold-census タスク概要


<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](../../speech-to-visuals/architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-18
**プロジェクト期間**: 2026-08-18 - 2026-08-19（2日）
**推定工数**: 14時間
**総タスク数**: 4件

## 関連文書

- **要件定義書**: [📋 requirements.md](../requirements.md)
- **技術設計**: [📐 architecture.md](../architecture.md)
- **型定義**: [📝 interfaces.ts](../interfaces.ts)
- **データフロー**: [🔄 dataflow.md](../dataflow.md)
- **受け入れ基準**: [✅ acceptance-criteria.md](../acceptance-criteria.md)
- **分析記録**: [💬 interview-record.md](../interview-record.md)
- **コンテキストノート**: [📝 note.md](../note.md)

## フェーズ構成

| フェーズ | 期間 | 成果物 | タスク数 | 工数 | ファイル |
|---------|------|--------|----------|------|----------|
| Phase 1 | 2026-08-18 | harness + 2 family 移行 + fingerprint | 2 | 9h | [TASK-0001〜0002](#phase-1-harness-抽出) |
| Phase 2 | 2026-08-18 | census engine + guard + 要件表再ベースライン | 1 | 4h | [TASK-0003](#phase-2-census-機械化) |
| Phase 3 | 2026-08-19 | node 24 統一・手順文書化・CI 証拠運用 | 1 | 1h | [TASK-0004](#phase-3-ci-証拠残件) |

Phase 1 と Phase 2 は独立（並行可）。production `src/` は変更ゼロ（REQ-401）。

## タスク番号管理

**使用済みタスク番号**: TASK-0001 ~ TASK-0004
**次回開始番号**: TASK-0005

## 全体進捗

- [x] Phase 1: harness 抽出
- [x] Phase 2: census 機械化
- [x] Phase 3: CI 証拠残件

## マイルストーン

- **M1: harness 完成** (2026-08-18): describeSingleSource + 2 family 移行 + fingerprint pin
- **M2: census 機械化** (2026-08-18): ratchet + doc-pin 3 者一致
- **M3: 証拠残件** (2026-08-19): node 24 統一 + green run 記録運用

---

## Phase 1: harness 抽出

**期間**: 2026-08-18
**目標**: 新規 fold family を 1 data row で追加できる構造
**成果物**: single-source-harness.ts(+test) / 2 family 移行 / harness-fingerprint.test.ts

### タスク一覧

- [x] [TASK-0001: table-driven single-source harness の実装](TASK-0001.md) - 4h (TDD) 🔵
- [x] [TASK-0002: 2 family 移行と fingerprint 等価証明](TASK-0002.md) - 5h (TDD) 🔵

### 依存関係

```
TASK-0001 → TASK-0002
```

---

## Phase 2: census 機械化

**期間**: 2026-08-18
**目標**: fold 系列の収束・残作業分類の機械判定
**成果物**: fold-census-families.ts / fold-census-guard.test.ts / 要件表 marker

### タスク一覧

- [x] [TASK-0003: fold 収束 census の機械化](TASK-0003.md) - 4h (TDD) 🔵🟡

### 依存関係

```
（Phase 1 と独立）
```

---

## Phase 3: CI 証拠残件

**期間**: 2026-08-19
**目標**: workflow policy 統一と手順の文書化
**成果物**: infrastructure.yml node 24 / registry ヘッダ手順 / green run 記録

### タスク一覧

- [x] [TASK-0004: node 24 統一・新規 family 手順の文書化・CI 証拠運用](TASK-0004.md) - 1h (DIRECT) 🔵

### 依存関係

```
（任意タイミングで単独実施可）
```

---

## 信頼性レベルサマリー

### 全タスク統計

- **総タスク数**: 4件
- 🔵 **青信号**: 3件 (75%)
- 🟡 **黄信号**: 1件 (25%)（TASK-0003・C2 pattern 精密化は実測確定待ち）
- 🔴 **赤信号**: 0件 (0%)

| フェーズ | 🔵 青 | 🟡 黄 | 🔴 赤 | 合計 |
|---------|-------|-------|-------|------|
| Phase 1 | 2 | 0 | 0 | 2 |
| Phase 2 | 0 | 1 | 0 | 1 |
| Phase 3 | 1 | 0 | 0 | 1 |

**品質評価**: 高品質（要件・設計・型が実測に基づき確定済み）

## クリティカルパス

```
TASK-0001 → TASK-0002（Phase 2/3 は並行独立）
```

**クリティカルパス工数**: 9時間
**並行作業可能工数**: 5時間

## 次のステップ

- 全タスク順番に実装: `/tsumiki:kairo-implement`
- 特定タスクを実装: `/tsumiki:kairo-implement TASK-0001`
