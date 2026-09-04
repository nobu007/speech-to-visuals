# streaming-real-asr-inference タスク概要


<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](../../speech-to-visuals/architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-09-04
**プロジェクト期間**: 2026-09-04 - 2026-09-06（3日）
**推定工数**: 24時間
**総タスク数**: 4件

## 関連文書

- **要件定義書**: [📋 requirements.md](../../speech-to-visuals/requirements.md) REQ-424（Phase 195・提案ベース `- [ ]`）
- **受け入れ基準**: [✅ acceptance-criteria.md](../../speech-to-visuals/acceptance-criteria.md) TC-408-01〜04（未実施）
- **設計文書**: [📐 architecture.md](../architecture.md)（Acceptance criteria: AC-D6-1〜04）
- **データフロー図**: [🔄 dataflow.md](../dataflow.md)
- **分析記録**: [🧠 design-interview.md](../design-interview.md)
- **コンテキストノート**: [📝 note.md](../note.md)

## 背景

D-1〜D-3 は main 済み（e5853217 / dda5c055）・D-4/D-5 は specs/real-audio-e2e-regression/（PR #100・open）で進行中だが、いずれも **batch/server 経路**が対象。**streaming file 経路**（`StreamingTranscriber.transcribeStream`）は steering mission 文が「streaming-transcriber も chunk モック」と自認するとおり固定文シミュレーションのまま、`placeholder` flag も付かない偽成功を生産 UI（StreamingProcessor → 図解生成）に供給し続けている。設計正本（上記 3 docs・2026-09-04 作成・84e3ecfd）は両環境の実ASR（browser: Web Speech / Node: D-1 gate 付き whisper）への**委譲と開示**で経路を実質化する。本 overview はその実装タスク分割である。

## フェーズ構成

| フェーズ | 期間 | 成果物 | タスク数 | 工数 | ファイル |
|---------|------|--------|----------|------|----------|
| Phase 1 | 09-04 | Web Speech file mechanism の単一ソース化 | 1 | 6h | [TASK-0318](#phase-1-基盤) |
| Phase 2 | 09-04 - 09-05 | streaming 経路の実ASR routing と confidence semantics | 2 | 14h | [TASK-0319〜0320](#phase-2-経路実質化) |
| Phase 3 | 09-05 - 09-06 | 偽成功の UI 開示（TC-408 完結） | 1 | 4h | [TASK-0321](#phase-3-ui開示) |

## タスク番号管理

**使用済みタスク番号**: repo 全体で TASK-0001 〜 TASK-0313（本 branch 実測最大 = `specs/speech-to-visuals/tasks/TASK-0313.md`）+ **TASK-0314〜0317 は open な PR #100（specs/real-audio-e2e-regression/）が使用済み**
**本 feature 採番**: TASK-0318 〜 TASK-0321（PR #100 との衝突なし）
**次回開始番号**: TASK-0322

## 全体進捗

- [x] Phase 1: 基盤（Web Speech file engine 単一ソース化）— TASK-0318 完了 (2026-09-04)
- [ ] Phase 2: 経路実質化（routing 3 分岐 + confidence semantics）
- [ ] Phase 3: UI 開示（placeholder notice + 偽 stats 抑制）

## マイルストーン

- **M1: 単一ソース完成** (2026-09-04): Web Speech file mechanism が engine に集約され BrowserTranscriber が委譲（TC-408-02 Green）
- **M2: 経路実質化完成** (2026-09-05): `transcribeStream` が環境別実ASRへ routing し未測定 confidence が区別される（TC-408-01 / TC-408-04 Green・TC-408-03 result flag Green）
- **M3: 開示完成** (2026-09-06): StreamingProcessor が placeholder 経路を開示 — TC-408-01〜04 全 Green

---

## Phase 1: 基盤

**期間**: 2026-09-04
**目標**: file 再生 + SpeechRecognition の mechanism を第二実装不可の単一ソースに集約する
**成果物**: `src/transcription/web-speech-file-transcription.ts`（新設）+ BrowserTranscriber 委譲化 + engine 契約 test

### タスク一覧

- [x] [TASK-0318: Web Speech file engine 新設と BrowserTranscriber 単一ソース化（transcribeFileWithWebSpeech）](TASK-0318.md) - 6h (TDD) 🔵 ✅ 2026-09-04 完了

### 依存関係

```
（前提なし — Phase 2 の両 task の基盤）
TASK-0318 → TASK-0319（browser 分岐の委譲先）
```

---

## Phase 2: 経路実質化

**期間**: 2026-09-04 - 2026-09-05
**目標**: simulate chunk loop を廃止し、環境別実ASR routing（browser: engine / Node: whisper 委譲 / 不可: 開示 placeholder）と未測定 confidence semantics を実装する
**成果物**: routing 改修された `streaming-transcriber.ts` + routing/confidence 契約 test 群

### タスク一覧

- [x] [TASK-0319: transcribeStream routing 改修 — 環境別 3 分岐 + simulate chunk loop 廃止 + Node 構築可能化](TASK-0319.md) - 10h (TDD) 🔵 ✅ 2026-09-05 完了
- [ ] [TASK-0320: confidence 未測定 semantics — minConfidence filter と StreamingQualityMonitor の実測限定](TASK-0320.md) - 4h (TDD) 🔵

### 依存関係

```
TASK-0318 → TASK-0319
TASK-0319 → TASK-0320（routing 後の code path に対して適用）
TASK-0320 と TASK-0321 は並行可能
```

---

## Phase 3: UI開示

**期間**: 2026-09-05 - 2026-09-06
**目標**: 偽成功をユーザーに開示し実測表示と区別する — TC-408 完結
**成果物**: StreamingProcessor の placeholder notice + 偽 stats 抑制 + UI pin test

### タスク一覧

- [ ] [TASK-0321: UI 開示 — StreamingProcessor の placeholder notice と偽品質 stats 表示の抑制](TASK-0321.md) - 4h (TDD) 🔵（notice 形状のみ 🟡）

### 依存関係

```
TASK-0319 → TASK-0321（result.placeholder flag の供給）
```

---

## 信頼性レベルサマリー

### 全タスク統計

- **総タスク数**: 4件
- 🔵 **青信号**: 4件 (100%)（TASK-0321 はタスク全体 🔵・項目単位で 🟡 2件を含む）
- 🟡 **黄信号**: 0件 (0%)
- 🔴 **赤信号**: 0件 (0%)

### 項目単位集計（各 TASK file のサマリー合算）

| カテゴリ | 🔵 青 | 🟡 黄 | 🔴 赤 | 合計 |
|---------|-------|-------|-------|------|
| 実装詳細・完了条件 | 24 | 2 | 0 | 26 |
| テスト要件 | 8 | 0 | 0 | 8 |
| UI/UX 要件 | 1 | 1 | 0 | 2 |
| **合計** | **33** | **3** | **0** | **36** |

**品質評価**: 高品質（設計正本 architecture.md / dataflow.md が 3 経路の入出力形状・委譲先の行番号・非機能契約・テスト影響範囲（design-interview A10）まで実在コードに接地して特定済みで、タスクはその分割に過ぎない。🟡 3件はすべて設計が意図的に実装時判断とした UI 形状（notice・stats 非表示方法）と notice 内アラベル慣行）

## クリティカルパス

```
TASK-0318 → TASK-0319 → TASK-0320
                   └──→ TASK-0321
```

**クリティカルパス工数**: 20時間（0318→0319→0320）
**並行作業可能工数**: 4時間（TASK-0321 は TASK-0319 完了後 0320 と並行）

## 外部入力（maintainer 依存 — born-DONE にしない範囲の明示)

| 項目 | task | 内容 |
|------|------|------|
| whisper binary / ggml model 取得 | TASK-0319 の Node 分岐実走査 | D-1 と同一手順（gate が閉じている環境では Node 分岐の実測確認は mock test で代替し、実走査は gate 開放後。gate 閉でもフォールスルー契約は test 可能） |

browser 経路（Web Speech）は jsdom + SpeechRecognition mock で契約 test する（実 browser 実測は D-4/D-5 の corpus を用いる将来拡張 — design-interview A8 の通り本 feature scope 外）。

## 次のステップ

タスクを実装するには:

- 全タスク順番に実装: `/tsumiki:kairo-implement`
- 特定タスクを実装: `/tsumiki:kairo-implement TASK-0318`
