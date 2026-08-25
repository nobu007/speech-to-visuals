# dead-idiom-batch-census タスク概要

<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](../../speech-to-visuals/architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-25
**プロジェクト期間**: 2026-08-25 - 2026-08-25（全 phase 完了）
**推定工数**: 4h（REQ-410 batch guard + unify 2 site + three-way family 19 登録 + atomic dogfood landing + MW-074 mutation 検証 — **単一 phase・単一 TASK の batch 形式**）
**総タスク数**: 1件

> **形式 note（family 19 の差分）**: steering ROI 指示（REQ-405 採点後）に
> より、violation が少量（2 site）かつ class 多数が confirmed-zero の
> family は spec 5 file・1 phase・1 TASK の batch 形式とする。従来の
> 2 phase / 2 TASK 構成（REQ-406・407 など）は実違反が多数の class に
> 投資を集中するために残る。

## 関連文書

- **要件定義書**: [📋 requirements.md](../requirements.md) REQ-410
- **コンテキストノート**: [📝 note.md](../note.md)
- **分析記録**: [💬 interview-record.md](../interview-record.md)
- **先行正典**: REQ-405 fallback-default census・REQ-401 numeric-coercion census — family 19 は述語・制御構文イディオム面の batch
- **先行 guard**: REQ-395 three-way（family 登録規約）・REQ-402 spine edge census（atomicity 強制）・REQ-406 title-sync（index 表題一致）

## フェーズ構成

| フェーズ | 期間 | 成果物 | タスク数 | 工数 | ステータス |
|---------|------|--------|----------|------|-----------|
| Phase 217 | 2026-08-25 | REQ-410 dead-idiom batch census guard（kind registry 7 entry）+ coercing-isnan 2 site unify + three-way family 19 登録 + 本 spec 一式の atomic landing + MW-074 mutation 検証 | 1 | 4h | ✅完了 |

## タスク番号管理

**使用済みタスク番号**: TASK-0301
**次回開始番号**: TASK-0302

（参考: TASK-0297〜0300 は parallel branch の family 17/18 が使用 —
`git log --all` で衝突確認済み）

## 全体進捗

- [x] Phase 217: REQ-410 batch guard + unify 2 site + three-way family 19 登録 + MW-074

## マイルストーン

- **M1: batch guard 完走** (Phase 217): kind registry 7 entry・liveness (a)〜(h)・ALLOWED 2 key / ERADICATED 2 key の exact both-ways・unify 2 site 同梱 ✅
- **M2: teeth 実証** (Phase 217): MW-074 で 3 独立 mutation（unify revert・`.forEach(async` 注入・own-key filter 削除）の kind 独立 RED 実測 ✅

---

## Phase 217: REQ-410 dead-idiom batch census（batch 形式）

**目標**: 複数の confirmed-zero / 少量違反 idiom class を単一 kind registry
guard にまとめ、coercing 述語の黙判反転面を構造的に遮断する。
**成果物**: tests/guards/dead-idiom-batch-census.test.ts + src 2 site unify + three-way family 19 行 + 本 spec 一式 + MW-074

### タスク一覧

- [x] [TASK-0301: dead-idiom batch census guard 新設 + coercing-isnan 2 site unify + three-way family 19 登録 + MW-074 mutation 検証 + atomic dogfood landing](TASK-0301.md) - 4h (TDD) 🔵 ✅完了

### 依存関係

- `freeze-guard` helper（`walkProductionSurface` / `readSource` / `isCommentLine`）に依存
- REQ-395 three-way guard への family 19 登録を含む
- REQ-402 spine edge census / REQ-406 title-sync（landing atomicity の検証器）
