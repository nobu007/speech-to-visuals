# stv-core-design-sync タスク概要

<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](../../speech-to-visuals/architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-27
**プロジェクト期間**: 2026-08-27 - 2026-08-27（全 phase 完了）
**推定工数**: 1.5h（出典62箇所正規化 + 木4行除去 + 境界 section 新設 + guard 3 leg + MW-093 mutation 検証 — **単一 phase・単一 TASK の batch 形式**）
**総タスク数**: 1件

> **形式 note**: family 19 batch 形式（REQ-410 確立）に準拠 — 違反が設計書側の
> drift 一括（53件）で src 変更ゼロのため、spec 4 file・1 phase・1 TASK。

## 関連文書

- **要件定義書**: [📋 requirements.md](../requirements.md) REQ-420
- **分析記録**: [💬 interview-record.md](../interview-record.md)
- **先行正典**: REQ-310~312（第218回検証 — stv-core 分割の requirements 側同期）・REQ-311（git タグ完全 pin）
- **先行 guard**: REQ-402 spine-edge census（本 feature の親登録双方向性）・REQ-406 title-sync（index 表題一致）・REQ-419-005（V2.9 drift guard — pin 一致比較の同型先行例）

## フェーズ構成

### Phase 229: 設計正本の出典パス現勢性同期（REQ-420・2026-08-27）

- 出典パス62箇所正規化（dead-path 52+1件 + 履歴注記3件・Node script 件数 assert 付き）
- architecture.md ディレクトリ木から消滅4行除去・19ディレクトリ正規化・外部コアパッケージ section 新設
- interfaces.ts header に @stv/core 単一ソース規則明記
- `tests/guards/design-doc-source-currency.test.ts` 新設（3 leg・exact-0 + fs 導出 + pin 一致）
- MW-093 mutation 検証（(a)(b)(c) 各 RED・復元 GREEN）

### タスク一覧

- [x] [TASK-0312: 設計正本の出典パス現勢性同期 — dead-path 53件正規化 + @stv/core 境界 section + design-doc-source-currency guard + MW-093 検証](TASK-0312.md) - 1.5h (設計 stage) 🔵 ✅完了

### 依存関係

- 第218回検証（REQ-310~312）が requirements 側を同期済みであることが前提（出典表記規約 `@stv/core/<area>/<module>` の継承元）
- 本 feature の landing は spine-edge census（親登録双方向性）・title-sync（H1 一致）を同一 commit で通過（atomic dogfood）
