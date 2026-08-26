# stv-core design sync（設計正本の出典パス現勢性）要件定義書（軽量版）

<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](../speech-to-visuals/architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-27
**要件ID**: REQ-420（Phase 229 / TASK-0312・第237回検証・stv-core コア分割の設計正本同期）

## 概要

stv-core コア分割（PR #7・2026-08-18・`src/{types,config,lib,utils}` → `@stv/core` v1.0.7 移管）に伴う同期は、requirements.md・acceptance-criteria.md 侧は第218回検証（REQ-310~312）で完了していたが、**設計正本3文書（architecture.md・dataflow.md・interfaces.ts）は 2026-08-06（第208/209回検証）のまま同期から漏れていた**:

- architecture.md ディレクトリ木に消滅済み `src/config`・`src/lib`・`src/types`・`src/utils` の4行が残存（現勢構造の誤記載）
- 3文書計53件の出典パスが dead path（`src/types/diagram.ts` 等）のまま — 移管済みモジュールへの出典として実在しない path を 🔵（確実）信頼性で引用
- `@stv/core` 外部コアパッケージ境界の設計記述が architecture.md に存在しない（0 mention・requirements.md は45 mention）

本要件はこの同期を完了させ（第237回検証・出典62箇所正規化・境界 section 新設）、再発を構造的に防止する guard（`tests/guards/design-doc-source-currency.test.ts`）を固定する。src/ 変更ゼロ（設計書・specs・test のみ）。

## 機能要件

### REQ-420-001: dead-path 出典の排除（exact-0）

- 設計正本3文書（`specs/speech-to-visuals/{architecture.md, dataflow.md, interfaces.ts}`）は `src/(types|utils|lib|config)/` 形式の出典パスを含んではならない（**exact-0**・guard leg 1）🔵 *第237回検証実測: architecture.md 22件・dataflow.md 7件・interfaces.ts 23件（regex `src/(types|utils|lib|config)/` で計52件）+ `src/lib/actualVideoRenderer.ts`→`src/pipeline/actual-video-renderer.ts` のリポジトリ内移管1件 = 計53件を正規化*
- 移管済みモジュールへの出典は `@stv/core/<area>/<module>` 形式（requirements.md 第218回検証と同一規約）とする 🔵 *requirements.md REQ-007/038/051 等の既存表記に整合*
- 歴史的 mutation 検証の記述（round 41/42/43 の M4/M8 注入対象としての旧 path）は出典ではなく履歴であるため、「当時 src 配下 utils/guards・現 @stv/core/utils/guards」の注記形で path 形式を残さない 🔵 *`src/.../` 形式を残すと exact-0 leg が履歴と出典を区別できず恒常 RED 化するため*

### REQ-420-002: ディレクトリ木の現勢性（導出検査）

- architecture.md のディレクトリ木は、`fs.readdir(src)` から導出した実ディレクトリ一覧（`__tests__` を除く18ディレクトリ）を全て列挙しなければならない（guard leg 2・**新規ディレクトリ追加で RED** = 導出式 pin）🔵 *2026-08-27 実測: analysis/api/components/export/framework/hooks/integrations/monitoring/optimization/pages/performance/pipeline/quality/remotion/test/transcription/visualization/workers*
- 消滅済み4ディレクトリ（config/lib/types/utils）は木に存在してはならない 🔵 *guard が `── <name>/` tree-entry 形で検査*

### REQ-420-003: @stv/core 境界の設計記載と pin 一致

- architecture.md は「外部コアパッケージ（@stv/core）」section を持たなければならない（guard leg 3）🔵
- 同 section の依存 pin 表記は package.json の `@stv/core` 指定と**完全一致**しなければならない（REQ-311 浮動 ref 禁止・バージョン更新時に不一致で RED = 更新の同一 commit 化を強制）🔵 *2026-08-27 時点: `github:nobu007/stv-core#v1.0.7`*
- 3文書はそれぞれ `@stv/core/` 出典を1件以上含まなければならない（同期済みであることの最小証拠）🔵

### REQ-420-004: MW-093 mutation 検証

- guard は (a) 3文書いずれかへの dead-path 出典再注入 (b) 木への消滅ディレクトリ行再注入 (c) 境界 section 見出し削除 の各変異で RED しなければならない 🔵 *mutation-witness-ledger MW-093 に記録*

## 最小限の非機能要件

- guard は cwd 非依存（`import.meta.url` 基準の repo root 解決）とする 🔵 *cwd-relative read の flake 回避（既存 guard 群の規約）*
- 本要件の変更は src/・scripts/ を含まない（設計書・specs・tests/guards のみ）🔵
