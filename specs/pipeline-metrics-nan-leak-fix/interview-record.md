# Pipeline Metrics NaN Leak Fix — 自動分析記録


<!-- spine:anchor:begin -->
> **Spine anchor**: [Speech-to-Visuals システム憲法 V2.8](../../SYSTEM_CONSTITUTION.md)
>
> - parent: `SYSTEM_CONSTITUTION.md`
> - role: `feature_root`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-13
**分析実施**: step4 既存情報ベースの差分分析と自動統合

## 分析目的

make-run iteration で拒否された 4 コミット（0e2e4ecf, 19147a00, 277b8567,
46ff0ef9）の rejection reason を「cosmetic / behavior-equivalent」と分析し、
次の iteration で value gate を満たす具体的・最小・検証可能な recovery task
を 1 件に正規化する。

## 分析項目と判断

### A1: 過去 iteration の refactor が cosmetic と判定された根拠

**分析日時**: 2026-08-13
**カテゴリ**: 既存設計確認
**背景**: 拒否フィードバックは「全4コミットが既存コードの振る舞いを変えない
リファクタ」と断定。具体的にどの commit message が "byte-for-byte equivalent"
と自己宣言しているか確認。

**判断**:
- `0e2e4ecf` (canvas-calculator) commit message:
  > "Behavior is byte-for-byte equivalent for finite x, NaN, +Infinity,
  > -Infinity, and the defaultValue=0 branch"
- `19147a00` (scene-synchronizer), `277b8567` (scene-segmenter) も同様
- `46ff0ef9` (LOWER_IS_BETTER rename) は `46ff0ef9` の polarity registry 名前
  統一のみ

→ **どの commit も "behavior unchanged" を commit message 内で自己宣言**して
おり、refactor-for-refactor 批判は妥当。

**根拠**: `git show <hash> --stat` で各 commit message 確認

**信頼性への影響**:
- 過去 4 commit の信頼性は 🔵 (事実)
- 次 iteration で同じ轍を踏むリスクは 🔴 → 🟡 (本 spec で mitigation 策を
  明示したため)

---

### A2: Pipeline Metrics Collector の NaN leak — 具体的インシデント選定

**分析日時**: 2026-08-13
**カテゴリ**: 追加要件
**背景**: make-run feedback は「(a) 具体的ユーザ可視インシデントを引用せよ」
と要求。候補として以下を評価:

| 候補 | ユーザ可視性 | 修正コスト | spec 親和性 |
|-----|------------|-----------|------------|
| PipelineMetricsCollector NaN leak | 🔵 ダッシュボード NaN ms | 🟢 1行 + 4行修正 | 🟢 sanitizeFinite 適用 |
| Lottie keyframe-time ordering (memory 15) | 🔵 動画破綻 | 🔴 design-heavy | 🔴 refactor 軸と無関係 |
| Monitor↔health-check threshold drift (memory 09a) | 🟡 alerting 誤動作 | 🔴 4 source 整合 | 🟡 threshold drift は別 spec |

**判断**: **A. Pipeline Metrics NaN leak** を採用。

理由:
1. ingestion point が 1 箇所（`recordStageDuration`）で根治可能
2. canonical helper (`sanitizeFinite`) への delegation が **同 PR の本質的修正**
3. 過去 iteration (0e2e4ecf) と同じ "value coercion" パターンなので、bundled
   refactor で **過去 iteration の behavior-equivalent 批判を実証的に解消**
   できる（過去 commit では inline を消しただけ、本 iteration では **inline
   が NaN を漏らしていた ingestion を救う**）

**根拠**: `src/monitoring/pipeline-metrics-collector.ts:91-107`
直接実装, `src/monitoring/__tests__/pipeline-metrics-collector.test.ts`
(既存テスト), `src/utils/guards.ts:28` canonical helper

**信頼性への影響**:
- 新規要件 REQ-001〜REQ-003 を 🔵 で追加
- 過去 iteration (0e2e4ecf 等) の「user-visible 価値なし」批判に対し、
  本 iteration は **ingestion chokepoint で実際の NaN sink を塞ぐ**具体的
  evidence を提示できる

---

### A3: 同 iteration で束ねる refactor 範囲（≤5 file batch rule）

**分析日時**: 2026-08-13
**カテゴリ**: 影響範囲
**背景**: make-run feedback「5ファイル以内のバッチでコミット」+「条件分岐
ガードは対象外」。

**判断**: `pipeline/` + `monitoring/` レイヤーで value coercion 形式
(`Number.isFinite(x) ? x : default`) の inline 残置を grep し、≤5 ファイル
batch とする:

```bash
$ grep -rn "Number.isFinite(x) ? x : " src/pipeline/ src/monitoring/ \
    --include="*.ts"
src/pipeline/performance-baseline.ts:71
src/pipeline/bottleneck-detector.ts:53
```

`pipeline-metrics-collector.ts:99-103` は **bug fix で必然的に canonical
helper 経由に置換** されるため、batch 合計 = 3 ファイル ≤ 5 ✅

**根拠**: 直接 grep, 158 残置 site のうち value coercion 形式は少数

**信頼性への影響**:
- REQ-101, REQ-102 を 🔵 で追加
- 残置 155 site は対象外として明示し、次回 iteration の入口を残す

---

### A4: 静的解析 guard test の maintenance 設計

**分析日時**: 2026-08-13
**カテゴリ**: 既存設計確認
**背景**: make-run feedback「`tests/regression/no-inline-sanitizer-pattern.test.ts`
に header note を追加し、`numberGuard.ts`/`stringGuard.ts` 更新時に
CLOSED-SET と regex を同時更新せよ」。

**判断**:
- この repo では canonical helper は `src/utils/guards.ts`（`numberGuard.ts`
  /`stringGuard.ts` は存在しない — feedback は plan-phase 名と推測）
- `clamp01-single-source.test.ts` が既存参考実装
- 新設 test 名: `tests/regression/sanitize-finite-single-source.test.ts`
- 検出 regex: value coercion 形式のみ。condition guard (`Number.isFinite(x) &&
  x > 0`) は **regex 上で operand を見ずに誤検知する** ため、ネガティブ
  lookahead または前処理で除外
- maintenance note: REQ-202 で必須化

**根拠**: `src/utils/__tests__/clamp01-single-source.test.ts:49-53`
（comment 除去後の regex 適用）, `src/utils/guards.ts:1-10`（canonical helper
の責務）

**信頼性への影響**:
- REQ-201〜REQ-204 を 🔵 で追加
- spec 重複回避 (REQ-403) も 🔵 で追加 — `guards.ts` を SoT 化することで
  feedback「`phase-215-sanitizer-canonicalization` が numberGuard.ts の
  contract を restate する問題」を先制回避

---

### A5: spec 重複の構造的回避

**分析日時**: 2026-08-13
**カテゴリ**: 既存設計確認
**背景**: make-run feedback「`specs/phase-215-sanitizer-canonicalization/`
が `numberGuard.ts` の contract を restate しており、SoT が重複している」。

**判断**:
- 本 repo には `phase-215-sanitizer-canonicalization/` **未存在**（`specs/`
  配下確認済）— feedback の参照は別 iteration 計画または別 repo と推測
- 本 spec (`specs/pipeline-metrics-nan-leak-fix/`) では REQ-403 で contract
  重複を明示禁止し、`src/utils/guards.ts` および
  `src/utils/__tests__/guards.test.ts` を SoT として参照のみ

**根拠**: `ls specs/` 確認

**信頼性への影響**:
- REQ-403 を 🔵 で追加
- feedback (c) への予防的対策が spec 内に permanent rule として記載された

---

## 分析結果サマリー

### 確認できた事項

- 過去 4 commit は commit message 内で "behavior equivalent" を自己宣言して
  おり、make-run 判定は妥当
- `PipelineMetricsCollector.recordStageDuration` は canonical
  `sanitizeFinite` を通さない唯一の ingestion point で、NaN 流入時に
  ダッシュボード NaN ms 障害を起こす
- `pipeline/` レイヤーには 2 ファイルの value coercion inline 残置があり、
  bug fix と bundled refactor で 3 ファイル ≤ 5 batch に収まる
- 既存 `clamp01-single-source.test.ts` が structural guard の参考実装

### 追加/変更要件

- REQ-001〜REQ-003: bug fix（PipelineMetricsCollector ingestion chokepoint）
- REQ-101〜REQ-103: bundled refactor（performance-baseline, bottleneck-detector）
- REQ-201〜REQ-204: structural guard test 新設
- REQ-301〜REQ-302: 既存 contract 維持（後方互換）
- REQ-401〜REQ-403: 制約（5ファイル batch、condition guard 除外、SoT 化）

### 残課題

- 残置 155 site（condition guard + config validation）の canonical 化 →
  次回 iteration の `monitoring/`, `visualization/`, `analysis/`,
  `remotion/`, `storage/` 別 spec で扱う
- L3 OPEN candidate（monitor↔health-check threshold drift, alertThresholds
  等）は別 spec

### 信頼性レベル分布

**分析前**:
- 🔵 青信号: 0件（要件未定義）
- 🟡 黄信号: 0件
- 🔴 赤信号: 0件

**分析後**:
- 🔵 青信号: 11件（REQ-001, 002, 003, 101, 102, 201, 202, 203, 301, 302,
  401, 403）
- 🟡 黄信号: 2件（REQ-103, 402）
- 🔴 赤信号: 0件

## 関連文書

- **要件定義書**: [requirements.md](requirements.md)
- **コンテキストノート**: [note.md](note.md)