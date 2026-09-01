# stv-core design sync 自動分析記録

<!-- spine:anchor:begin -->
> **Spine anchor**: [Speech-to-Visuals システム憲法 V2.8](../../SYSTEM_CONSTITUTION.md)
>
> - parent: `SYSTEM_CONSTITUTION.md`
> - role: `feature_root`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-27
**分析実施**: kairo-design step4 既存情報ベースの差分分析と自動統合（第237回検証・Phase 229 / TASK-0312・REQ-420）

## 分析目的

stv-core コア分割（PR #7・2026-08-18）後に設計正本3文書が実装から取り残されている疑い（note.md L85 の「旧 src/config・src/lib・src/types・src/utils は @stv/core 移管で消滅」と architecture.md ディレクトリ木の記載不一致）を検証し、必要な統合を行う。

## 分析項目と判断

### A1: 設計正本3文書の stv-core 分割同期状況

**分析日時**: 2026-08-27
**カテゴリ**: アーキテクチャ
**背景**: 第218回検証（REQ-310~312）は requirements.md・acceptance-criteria.md を同期したが、設計文書側の同期成否が未確認。

**判断**: **未同期（drift 実在）**。実測:
- `grep -c 'stv/core'` → architecture.md 0・dataflow.md 0・interfaces.ts 0（requirements.md 45・note.md 7 は同期済み）
- dead-path 出典 `src/(types|utils|lib|config)/` → architecture.md 22件・dataflow.md 7件・interfaces.ts 23件（計52件 + actualVideoRenderer rename 1件）
- architecture.md ディレクトリ木に消滅4行残存・`├── src/` は無注記
- 出典の実在性: `@stv/core` dist の実モジュール一覧（types/{diagram,pipeline,api,workspace,llm,cache,quality}・utils/11・config/8・lib/7）と全 dead-path の写像先を確認（写像不能なものは actualVideoRenderer の1件のみ → `src/pipeline/actual-video-renderer.ts` へのリポジトリ内移管と判明）

**根拠**: grep・find・`node_modules/@stv/core/package.json` exports map・`ls node_modules/@stv/core/dist/{types,utils,lib,config}` の実測。

**信頼性への影響**:
- architecture.md・dataflow.md・interfaces.ts の当該出典53箇所は 🔵（確実）を主張しつつ実在しない path を引用していた → 正規化により主張と実態を一致（信頼性レベルの変更なし・出典の現勢化）
- 新設「外部コアパッケージ（@stv/core）」section は 🔵（SYSTEM_CONSTITUTION V2.8 改正・package.json・実測に基づく）

### A2: 履歴記述と現勢出典の区別（exact-0 の成立条件）

**分析日時**: 2026-08-27
**カテゴリ**: データモデル（guard 設計）
**背景**: architecture.md の round 41/42/43 単一ソース化記述には、mutation 検証当時の注入対象として `src/utils/guards.ts` が**歴史的事実**として現れる（当時は実在）。raw grep の exact-0 はこれと出典を区別できない。

**判断**: 履歴は「当時 src 配下 utils/guards・現 @stv/core/utils/guards」の注記形へ書き換え（`src/.../` path 形式を除去・事実関係は不変）。これにより regex `src/(types|utils|lib|config)/` は**出典のみ**を検出する純度を得る。slash なしの言及（「src/lib で禁止」等）は元々 regex の検査対象外。

**根拠**: 3件の該当箇所（M4/M4/M8）を確認しそれぞれ注記形へ変換。guard の false-positive 恒常 RED を避ける規約として requirements REQ-420-001 に明文化。

### A3: steering 指示の phantom 判定（cross-repo contamination チェック）

**分析日時**: 2026-08-27
**カテゴリ**: プロセス
**背景**: AI Hub make-run feedback が `INV-STAT-006`・`impl/app/`・`grade_distribution.py`・V2.8→V2.9 rename の commit 文面指定を指示。

**判断**: 
- `INV-STAT-006`・`impl/app/`・`grade_distribution.py` → **cross-repo phantom**（repo 内 0 hit・find 全域 0 件）
- `scripts/code-size-audit.ts` は実在するが、指示内容は既に着地した commit（bfc41ef3・2026-08-26）の commit message を遡って書き換える要求で**実行不可能**（history 書換は非破壊運用に反する）。代替として本 TASK の commit 文面に label-only 変更である種類の明記規約を適用する慣行は既に 3e23d0b2 が満たしている
- META-intent（substantive・verifiable な diff の継続）は 🔵 実在 → 本分析（A1 の drift 修正）として具体化

**根拠**: `grep -rn` repo 全域・`find / -name grade_distribution.py`（0 件）・git log。

### A4: 再発防止の構造化（guard 設計）

**分析日時**: 2026-08-27
**カテゴリ**: アーキテクチャ（テスト基盤）
**背景**: 同種の drift は第218回検証でも「同期対象の取りこぼし」として発生していた（requirements 側のみ同期・設計側は未検査）。

**判断**: `tests/guards/design-doc-source-currency.test.ts` を3 leg で新設:
1. **dead-path exact-0**（3文書・`src/(types|utils|lib|config)/`）— 出典の現勢性
2. **ディレクトリ木現勢性**（`fs.readdir(src)` 導出との突合・新規 dir で RED）— 裸 pin でなく導出式（session 234 教訓: 裸 pin は unify 時に stale 化して CI 恒常 RED）
3. **境界 section + pin 一致**（package.json 実値との完全一致比較 — REQ-419-005 V2.9 drift guard と同型）— ドキュメント間定数 desync の検出

**根拠**: REQ-419-005（pin 一致比較の先行例）・pre-fold-count-monotonic（specs ファイルを readFileSync で検査する既存 guard 形式・import.meta.url 基準）・MW-093 mutation 検証で各 leg の RED を実証予定。

## 分析結果サマリー

### 確認できた事項

- 設計正本3文書の drift 実在（dead-path 53件・境界記述ゼロ・木に消滅4行）
- 全 dead-path の @stv/core 写像先確認（dist 実測・写像不能は1件のみで src/pipeline への移管）
- steering 具象指示の大半は cross-repo phantom

### 設計方針の決定事項

- 出典表記は requirements.md 第218回検証と同一規約（`@stv/core/<area>/<module>`）
- 履歴記述は注記形で保持（改変しない）
- 再発防止は導出式 guard（裸 pin 不使用）

### 残課題

- `tests/` 数・依存パッケージ数等の header 統計値（570ファイル等）は第209回時点の値のまま — 実測更新は次回の正本更新時に一括で行う（本TASKは出典・構造の現勢性に限定）

### 信頼性レベル分布

**分析前**（対象3文書の出典53箇所）: 🔵 53件（実態とは不一致の 🔵）

**分析後**: 🔵 53件（実在 path へ正規化・主張と実態一致）+ 新設 section 🔵 — 分布の変化なし・根拠の現勢化

## 関連文書

- **アーキテクチャ設計**: [../speech-to-visuals/architecture.md](../speech-to-visuals/architecture.md)
- **要件定義**: [requirements.md](requirements.md)（REQ-420）
- **タスク**: [tasks/TASK-0312.md](tasks/TASK-0312.md)
