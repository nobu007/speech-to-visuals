# real-audio-e2e-regression タスク概要


<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](../../speech-to-visuals/architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-09-03
**プロジェクト期間**: 2026-09-03 - 2026-09-05（3日）
**推定工数**: 28時間
**総タスク数**: 4件

## 関連文書

- **要件定義書**: [📋 requirements.md](../../speech-to-visuals/requirements.md) REQ-422 / REQ-423（Phase 194・提案ベース `- [ ]`）
- **受け入れ基準**: [✅ acceptance-criteria.md](../../speech-to-visuals/acceptance-criteria.md) TC-406-01〜03 / TC-407-01〜02（未実施）
- **設計文書**: [📐 architecture.md](../architecture.md)（Acceptance criteria: AC-D4-1〜3 / AC-D5-1〜2）
- **データフロー図**: [🔄 dataflow.md](../dataflow.md)
- **分析記録**: [🧠 design-interview.md](../design-interview.md)
- **コンテキストノート**: [📝 note.md](../note.md)

## 背景

D-1（gated real whisper.cpp 推論）・D-2（WER/CER harness）・D-3（図解検出精度実測化）は main 済み（e5853217 / dda5c055）。残る D-4/D-5 は TASK-0313（`specs/speech-to-visuals/tasks/`）で要件化のみ行われ、実装が本 feature に委譲されている。設計正本（上記 3 docs・2026-09-03 作成）に基づき実装タスクに分割する。

## フェーズ構成

| フェーズ | 期間 | 成果物 | タスク数 | 工数 | ファイル |
|---------|------|--------|----------|------|----------|
| Phase 1 | 09-03 - 09-04 | RTF 分母の単一ソース + 実音声コーパス | 2 | 10h | [TASK-0314〜0315](#phase-1-基盤) |
| Phase 2 | 09-04 | corpus 駆動 E2E 測定経路（D-4 本体） | 1 | 12h | [TASK-0316](#phase-2-測定経路) |
| Phase 3 | 09-05 | 測定値の出典強制（guard + §8.6） | 1 | 6h | [TASK-0317](#phase-3-記録と-gate) |

## タスク番号管理

**使用済みタスク番号**: repo 全体で TASK-0001 〜 TASK-0313（最大 = `specs/speech-to-visuals/tasks/TASK-0313.md`）
**本 feature 採番**: TASK-0314 〜 TASK-0317（衝突なし）
**次回開始番号**: TASK-0318

## 全体進捗

- [ ] Phase 1: 基盤（wav-duration helper + コーパス整備）
- [ ] Phase 2: 測定経路（E2E script 実質化）
- [ ] Phase 3: 記録と gate（QUALITY_METRICS + guard）

## マイルストーン

- **M1: 測定の前提完成** (2026-09-04): RTF 分母の helper と ja/en コーパスが揃う（ja 録音のみ maintainer input）
- **M2: 測定経路完成** (2026-09-04): `npm run pipeline:test:audio` が corpus 駆動で WER/RTF/総処理時間を JSON report 化・fail-loud gate 化
- **M3: 出典強制完成** (2026-09-05): §8.6 測定器セクション + §3.1 未測定維持 guard + artifact 一致 guard — TC-406/407 全 Green

---

## Phase 1: 基盤

**期間**: 2026-09-03 - 2026-09-04
**目標**: 測定の分母（音声長）と分子（実音声 + 参照文字起こし）を実在させる
**成果物**: `src/transcription/wav-duration.ts` + `public/audio/` コーパス（CORPUS.md 含む）+ 契約 test

### タスク一覧

- [ ] [TASK-0314: WAV header 由来音声長導出 helper（readWavDurationMs / parseWavHeader)](TASK-0314.md) - 4h (TDD) 🔵
- [ ] [TASK-0315: 実音声評価コーパス整備（D-5・public/audio + CORPUS.md + 契約 test）](TASK-0315.md) - 6h (TDD) 🔵（ja 録音のみ maintainer input）

### 依存関係

```
TASK-0314 → TASK-0315（parseWavHeader 再利用 — 第二の fmt parser を作らない）
```

---

## Phase 2: 測定経路

**期間**: 2026-09-04
**目標**: D-4 本体 — hardcoded 入力・console 出力・`qualityScore >= 70` heuristic gate の測定経路への置換
**成果物**: 実質化された `scripts/test-complete-audio-pipeline.ts` + 構造 pin test

### タスク一覧

- [ ] [TASK-0316: E2E 測定 script 実質化（D-4・corpus 駆動 + JSON report + fail-loud gate）](TASK-0316.md) - 12h (TDD) 🔵

### 依存関係

```
TASK-0314 → TASK-0316（RTF 分母）
TASK-0315 → TASK-0316（実走査での動作確認 — 構造 pin 自体は corpus 不要）
```

---

## Phase 3: 記録と gate

**期間**: 2026-09-05
**目標**: 測定証跡なしの数値更新を構造的に不可能にする
**成果物**: QUALITY_METRICS §8.6 + §3.1 未測定維持 guard + artifact 一致 guard

### タスク一覧

- [ ] [TASK-0317: 測定記録基盤（QUALITY_METRICS §8.6 + §3.1 guard + artifact 規約）](TASK-0317.md) - 6h (TDD + DIRECT) 🔵

### 依存関係

```
TASK-0315 → TASK-0317（guard が corpus 実体を読む）
TASK-0316 → TASK-0317（artifact 形式の確定）
```

---

## 信頼性レベルサマリー

### 全タスク統計

- **総タスク数**: 4件
- 🔵 **青信号**: 3件 (75%)
- 🟡 **黄信号**: 1件 (25%) — TASK-0315（jfk excerpt 範囲確定・maintainer 録音の実体）
- 🔴 **赤信号**: 0件 (0%)

### 項目単位集計（各 TASK file のサマリー合算）

| カテゴリ | 🔵 青 | 🟡 黄 | 🔴 赤 | 合計 |
|---------|-------|-------|-------|------|
| 実装詳細 | 13 | 5 | 0 | 18 |
| テスト要件 | 6 | 0 | 0 | 6 |
| 依存・その他 | 12 | 2 | 0 | 14 |
| **合計** | **31** | **7** | **0** | **38** |

**品質評価**: 高品質（設計正本 architecture.md / dataflow.md が全対象 path・委譲先 export・fail-loud 条件・argv・file 規約を実在コードに接地して特定済みで、タスクはその分割に過ぎない。🟡 は maintainer の人的確認事項（ja 録音・jfk 参照突合）と実装時確定事項（guard 形状・fallback 要否）のみ）

## クリティカルパス

```
TASK-0314 → TASK-0315 → TASK-0316 → TASK-0317
```

**クリティカルパス工数**: 28時間
**並行作業可能工数**: 0時間（TASK-0316 の構造 pin 部分は TASK-0315 と並行化可能だが、依存は直列が正）

## 外部入力（maintainer 依存 — born-DONE にしない範囲の明示）

| 項目 | task | 内容 |
|------|------|------|
| ja 実音声の録音 | TASK-0315 | WAV PCM 16kHz mono・60 秒以内・原稿 = 旧 `test-audio.txt`・CC0 提供宣言 |
| whisper binary / model 取得 | TASK-0317 の実測 run | §8.6 手順（repo に commit しない） |

いずれも AI が合成音・捏造値で代替することは fail-loud 契約違反（測定ではない run の green 化禁止）。提供まで該当行は RED のままが正しい状態。

## 次のステップ

タスクを実装するには:

- 全タスク順番に実装: `/tsumiki:kairo-implement`
- 特定タスクを実装: `/tsumiki:kairo-implement TASK-0314`
