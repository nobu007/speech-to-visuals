# table-driven ガードハーネス抽出と fold 収束 census 自動分析記録

**作成日**: 2026-08-18
**分析実施**: step4 既存情報ベースの差分分析と自動統合
**対象 worktree**: /home/jinno/ai-hub/worktrees/speech-to-visuals-instruction-20260817-174502-751388（HEAD = c7fe762d）
**入力**: AI Hub make-run steering feedback（前 iteration VALUABLE 判定 + 継続 focus 3 項）

## 分析目的

fold 系列（round 41〜50）で繰り返されている guard boilerplate の実態を計測し、
（1）table-driven harness 抽出の要件化根拠、（2）残存 inline site の数値 census、
（3）CI 修復の green run 証拠採取、を既存実装から裏付ける。

---

### A1: guard boilerplate の解剖と定量化

**分析日時**: 2026-08-18
**カテゴリ**: 既存設計確認
**背景**: steering が「1 family あたり registry module 約 140 行 + test file
200〜280 行の同型 boilerplate が 3 フェーズ連続」と指摘。実態との照合が必要。

**判断**: 指摘は概ね正しいが構造が 2 つに分かれている:

1. **発見 sweep 部分は round 35 で既に data-row 化済み**。
   `tests/guards/frozen-literal-rules.ts`（124 行）が静的 import で
   `tests/guards/frozen-literal-families/`（42 file / 47 rule）を集約し、
   共有 walk engine `tests/guards/freeze-guard.ts`（139 行）+
   `frozen-literal-registry.test.ts` が全 entry を一括 sweep。
   新規 family = family file 1 つ + aggregator 2 行。
2. **未 data-row 化は per-family single-source test の機械的層**。
   `tests/guards/*-single-source.test.ts` は 36 file。round 46〜50 の 5 file
   は 2,341 行（673 / 490 / 440 / 373 / 365）で、うち:
   - Layer 1 verbatim oracle（退役式凍結 + corpus 等価ループ）— 機械的
   - Layer 2 semantic pin（live witness・クランプ証人）— family 固有
   - Layer 3 source anchor（readSource + 正規表現出現回数 + ban）— 機械的
   例: grid-packing-single-source.test.ts は Layer 1 が legacy 式 6 個の
   corpus 比較、Layer 3 が 13 file の delegation 形状 pin。

**根拠**: `wc -l tests/guards/{edge-anchor-geometry,node-box-center,ring-placement,default-node-extent,grid-packing}-single-source.test.ts`、
`frozen-literal-rules.ts`・`freeze-guard.ts`・`frozen-literal-families/grid-packing.ts` の通読。

**信頼性への影響**:

- REQ-001〜004（harness 抽出）を 🔵 で追加根拠付きで要件化
- 「registry 約 140 行」の指摘は aggregator+engine のみで、family module 自体は
  約 30〜40 行 — steering 指摘の行数は現状より大きいが（round 35 で解消済み）、
  「test file 側が未 data-row」という本質は正しい

---

### A2: 残存 inline site census（数値実測）

**分析日時**: 2026-08-18
**カテゴリ**: 未定義部分詳細化
**背景**: fold 系列の終了条件が読み取れないため、残存 inline site を
family × site 数 × 分類で数値化する（steering 指示）。

**判断**: 計測結果（production `src/` のみ・`__tests__` 除外）:

1. **既 fold family**: registry sweep（49 test）を本 worktree で実行 →
   **GREEN 2.037s・違反 0**。round 41〜50 の 10 family は全て執行済み。
2. **C1 汎用 clamp 家族** — 32 match / 20 file
   （`Math.max(…Math.min(…)` 20 + `Math.min(…Math.max(…)` 12。
   `src/utils/guards.ts`（正典）とコメント行を含む素朴合算）。
   正典 `clampFinite(value,min,max)` / `clamp01` は既存だが、bare inline 形は
   **NaN を透過**し clampFinite は **NaN→min に sanitize** する契約差がある
   （guards.ts の doc comment が明記）。よって移行は実挙動変更であり
   value-neutral ではない。
3. **C2 layout 既定 1920/1080 直書き** — 8 出現 / 4 file
   （pipeline-orchestrator.ts:191,211-212 / production-exporter.ts:138-139 /
   simple-pipeline.ts:114-115 / main-pipeline.ts:126-127）。
   同一値が別々の config object 既定値として存在 — 「canvas 正典の 1920」と
   「たまたま同じ値の config 既定」を正規表現で区別できず RED 不能
   （従来 from memory: low-ROI 判定と一致）。設計判断（config 出所の統一）要。
4. **C3 半径方向 push** — 4 site / 1 file
   （strategies/OverlapResolver.ts:257-260 の `±cos/sin(angle)*separation`）。
   round 48 正典 pointOnCircle は中心+絶対位置の別概念（delta push ではない）。
5. **C4 文字幅見積** — 1 site / 1 file（advanced-layouts.ts:537
   `text.length * 8 + 40`）。DEFAULT_CHAR_WIDTH=8 正典があるが単独 site。
6. **C5 反二乗反発** — 1 site / 1 file（edge-crossing-minimizer.ts:336）。
   force-directed-params 正典は regime 型（STRONG/MODERATE）の別公式。

**収束判定**: value-neutral 候補（同一概念・2 file 以上）= **0 family**。
→ fold 系列は value-neutral 作業について**収束済み**。残りは
実挙動変更必要（C1）/ 設計判断必要（C2）/ 異概念・閾値未満（C3〜C5）。

**再現コマンド**（REQ-404 の単一コマンド制約の素材）:

```sh
# registry 違反 0 の確認
NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' \
  npx jest --config jest.config.cjs --testPathPatterns 'frozen-literal-registry'
# C1 clamp 家族（正典 utils/guards.ts は除外・tests 除外）
grep -rn -E 'Math\.max\([^()]*Math\.min\(' src --include='*.ts' --include='*.tsx' | grep -v '__tests__' | grep -v 'utils/guards.ts' | wc -l   # → 20
grep -rn -E 'Math\.min\([^()]*Math\.max\(' src --include='*.ts' --include='*.tsx' | grep -v '__tests__' | grep -v 'utils/guards.ts' | grep -v 'clamp01\|//' | wc -l   # → 12
# C2 canvas 直書き（layout config object のみ抽出）
grep -rn '1920\|1080' src --include='*.ts' --include='*.tsx' | grep -v '__tests__' | grep -vE 'RESOLUTION|PRESET|1080p|720p|4k|/\*|\* '
# C3/C4/C5
grep -rn -E 'Math\.(cos|sin)\(' src --include='*.ts' | grep -v '__tests__' | grep -v layout-utils
grep -rn 'text\.length \* 8' src --include='*.ts' | grep -v '__tests__'
grep -rn 'dist \* dist' src/visualization/edge-crossing-minimizer.ts
```

⚠️ RTK hook は `rg` を破壊するため `grep -rn` を使用（from memory）。

**信頼性への影響**:

- REQ-005 / REQ-201 / REQ-202 を数値ベースライン付きで 🔵〜🟡 で要件化
- fold 系列の終了条件が初めて数値で定義された

---

### A3: CI 修復（infra/ci-repair）green run 証拠の採取

**分析日時**: 2026-08-18（runs は 2026-08-17 実行）
**カテゴリ**: 影響範囲・検証
**背景**: steering が「CI-repair record に green run URL / job-log excerpt を
添付すると verified L3 に格上げできる」と指摘。record が存在しなかったため
本記録が一次証拠になる。

**判断**: `gh run list` / `gh run view` で以下を確認（repo:
github.com/nobu007/speech-to-visuals）:

| run | 対象 | workflow | 結果 | 時間 |
|---|---|---|---|---|
| [32045615156](https://github.com/nobu007/speech-to-visuals/actions/runs/32045615156) | infra/ci-repair（PR #3・commit 2fcbd4f0） | CI | ✅ **success（11/11 job）** | 18m9s |
| [32047074800](https://github.com/nobu007/speech-to-visuals/actions/runs/32047074800) | main merge PR #3（e53ccde3） | CI | ✅ success | 15m39s |
| [32047436015](https://github.com/nobu007/speech-to-visuals/actions/runs/32047436015) | PR #1（docs review） | CI | ✅ success | 15m48s |
| [32051182417](https://github.com/nobu007/speech-to-visuals/actions/runs/32051182417) | main merge PR #1（**c7fe762d = 本 worktree HEAD**） | CI | ✅ **success（11/11 job・test 含む）** — 2026-08-18 再採取で完了確認 | 16m02s（17:37:54→17:53:56Z） |

run 32045615156 の job 構成（全 ✓）:
`monitoring-config-validate` 36s / `type-check` 36s / `spine-validate` 32s /
`code-size-audit` 32s / `edge-sanitizer-sync` 27s / `monitoring-drift-check` 26s /
**`test` 16m44s** / `lint` 45s / `build` 34s / `security-fuzz` 38s /
`all-checks-pass` 2s。

- node-version: ci.yml 全 10 job が `24`（実測 grep・10 箇所）✓
- **残留発見**: `.github/workflows/infrastructure.yml:37`
  （`monitoring-schema-validate` job）のみ `node-version: 18` が残存
  （run 自体は 47〜51s で success）→ REQ-301 として要件化
- annotation: checkout@v4 / setup-node@v4 が Node 20 廃止で node 24 強制の
  警告（REQ-301/302 参照）。code-size-audit の行数超過警告は informational
  （limit 超過でも job は ✓）
- ローカル再現: 本 worktree（node v24.11.1・HEAD c7fe762d）で registry
  sweep GREEN・type-check / lint の結果は acceptance-criteria の TC に反映

**信頼性への影響**:

- REQ-104 / REQ-405 を 🔵 で要件化。CI 修復は「plausible」→「run URL 付き
  verified」に格上げされた

**追記（2026-08-18・round 51 実装 commit・REQ-405 運用）**: 本 feature の
実装 commit 群（TASK-0004 完了条件の「実装 commit の green run URL 追記」は
push/merge 後の運用追記とする）:

- `9892df5a` docs(specs): タスク分割
- `137695b5` test(guards): harness 抽出 + 2 family 移行 + fingerprint 台帳
- `39bd9517` test(guards): fold census 機械化
- （本 commit）infra: infrastructure.yml node 24 統一 + registry ヘッダ手順

push 後に `gh run list --head <branch>` で green run URL を本表へ追記する。

---

### A4: 既存要件との統合判断

**分析日時**: 2026-08-18
**カテゴリ**: 優先順位・統合
**背景**: steering feedback を既存 `specs/speech-to-visuals/requirements.md`
（REQ-001〜301・製品パイプライン要件）へ追記するか、独立 feature にするか。

**判断**: **独立 feature `guard-harness-fold-census` を新設**（本ディレクトリ）。

- 類例: `finite-safe-aggregation`（2026-08-15）・`stochastic-layout-seeding`
  は test-infra / 不変量系を独立 feature として切り出す前例
- 本件は製品挙動でなく guard/test-infra の構造改善であり、親
  speech-to-visuals の REQ 番号空間（REQ-302+）を消費しない
- spine anchor は親 `../speech-to-visuals/architecture.md`（role: detailed）
  で同様の child 構成。`specs/_doc_spine.yml` は gitignore で absent のため
  spine-validate への影響なし（absence は expected・CI green 実績）
- round 記録の正本（architecture.md）は本 feature 実装時に round 51 として
  追記される想定（設計フェーズで確定）

**根拠**: specs/ 4 feature の構成、tests/spine-manifest.test.ts の
absence-skip 挙動、finite-safe-aggregation/requirements.md の構成。

**信頼性への影響**: 統合方針（分割統合なし・新規 feature）を明記。

---

### A5: 作業規模の自動推定

**分析日時**: 2026-08-18
**カテゴリ**: 優先順位
**背景**: kairo step2 の自動推定。

**判断**: **フル機能開発**。harness 抽出（test-infra 設計）+ census 機械化
（guard 設計）+ CI 証拠記録の 3 workstream があり、受け入れ基準・検証コマンド
・完了判定を備えた user-stories / acceptance-criteria が必要。参照文書は
実装・実測ログで充足（PRD なし・ヒアリング不要）。

---

## 分析結果サマリー

### 確認できた事項

- registry は round 35 で data-row 化済み（42 file / 47 rule / 49 test GREEN / 違反 0）
- 未 data-row 化は per-family test の Layer 1 + Layer 3（round 46〜50 で 2,341 行）
- value-neutral な残り fold 候補 = 0 family（系列収束）。C1 clamp 32 site / 20 file は NaN 契約差で実挙動変更、C2 は設計判断、C3〜C5 は 1 file 内のみ
- CI 修復 run 32045615156（11/11 job ✓・node 24）ほか green run 3 本を実 URL で確認
- infrastructure.yml にのみ node 18 が残留（job は green）

### 追加/変更要件

- 追加: REQ-001〜005 / 101〜104 / 201〜202 / 301〜302 / 401〜405 + NFR 3 件 + EDGE 4 件

### 残課題

- harness data row の最終型（TypeScript 型形状）は設計フェーズで確定（REQ-001 は形を要件化、型は未拘束）
- C1 clamp 家族を clampFinite へ移行するかは本 feature のスコープ外（実挙動変更を伴うため別 feature / 意思決定待ち）
- run 32051182417（HEAD c7fe762d）は 2026-08-18 再採取で success（11/11 job）確認済み。以後の workflow 変更時も green run URL の再添付を運用とする

### 信頼性レベル分布

**分析前**（要件 0 件）: 🔵 0 / 🟡 0 / 🔴 0

**分析後**（要件定義書一式）: 🔵 36 / 🟡 12 / 🔴 0（全 4 ファイル 48 項目 = REQ/NFR/EDGE 25 + ストーリー 5 + TC 18・内訳は各ファイルのサマリー参照）

## 関連文書

- **要件定義書**: [requirements.md](requirements.md)
- **ユーザストーリー**: [user-stories.md](user-stories.md)
- **受け入れ基準**: [acceptance-criteria.md](acceptance-criteria.md)
- **コンテキストノート**: [note.md](note.md)
