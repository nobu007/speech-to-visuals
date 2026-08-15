# finite-safe-aggregation コンテキストノート

**作成日**: 2026-08-15
**出典**: make-run steering (AI_HUB_MAKE_RUN_FEEDBACK 次イテレーション指示) + 実コード調査

## 技術スタック

- TypeScript 5.x strict / Jest (jest.config.cjs, ESM)
- テスト実行: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs <pattern>`（NODE_OPTIONS 必須）
- 型チェック: `npx -p typescript tsc -p tsconfig.app.json --noEmit`

## 関連実装（正本・移行元）

| モジュール | 役割 |
|---|---|
| `src/utils/guards.ts:28` | `sanitizeFinite(value, default=0)` — スカラー値の非有限→既定値置換。既存の単一ソース |
| `src/lib/metrics-utils.ts` | `percentileCeil` / `percentChange` / `roundTo` 等。**safeSum / safeMean / safeMax / safeMin は未整備** |
| `tests/guards/frozen-literal-rules.ts` | frozen-literal registry（単一ファイル方針、~423 行。新 family = ~15 行エントリ） |
| `tests/guards/force-directed-params-single-source.test.ts` 等 | 単一ソース化の既存ガード形式（sweep + mutation pin） |

## 関連スペック（重複確認済み）

- `specs/pipeline-metrics-nan-leak-fix/` — `PipelineMetricsCollector` の **ingestion** chokepoint 化 + pipeline 層 2 サイトの value-coercion 集約。本 feature は**集計演算そのもの（配列→代表値）の横展開**で対象が直交。**更新統合ではなく新規**（同 feature の REQ-201 guard は inline coercion 検出であり reduce 集計は検出対象外）
- `specs/stochastic-layout-seeding/` — layout の非決定性。無関係

## 調査で確認した実装の現状（2026-08-15 時点）

- `sanitizeFinite` 直呼び + inline `reduce((a,b)=>a+b,0)` の合計 **125 サイト**（src/、tests 除外）
- うち要素ガード付き（`Number.isFinite` / `sanitizeFinite` per element）は**わずか 2 系**（`src/analysis/llm-cache.ts:226`、`src/analysis/scene-segmenter.ts:609/671/702/808` の一部）
- 未ガードで外部起因値を集計する代表例:
  - `src/analysis/llm-service.ts:724-732,795-796` — LLM 応答時間 mean（NaN 混入で adaptive timeout が NaN 化）
  - `src/analysis/diagram-detector.ts:1344` — testResults score mean
  - `src/analysis/scene-segmenter.ts:792` — segment duration mean（`endMs-startMs` は Date 系フィールド）
  - `Math.max(...scores)` spread 系: `diagram-detector.ts:436`、`quality/enhanced-error-recovery.ts:1452/1899-1900`（`Math.max(NaN, x) === NaN` 伝播）
  - 対して `scene-segmenter.ts:594`（`Math.max(...group.map(s=>sanitizeFinite(s.confidence)))`）と `transcription/streaming-quality-monitor.ts:210-211`（`.filter(c=>Number.isFinite(c))`）は**既にガード済み = 正規形の実例**

## 注意事項（実装フェーズへの引継ぎ）

1. **数値デルタ + fuzz 等価オラクルの 2 点セット必須**（steering 指示）。fuzz は `layout-rng.ts` の mulberry32 を流用して seed 固定。`Math.random` は registry で禁止
2. 挙動変化（NaN/Infinity が 0 等に落ちる）を含むサイトは commit message に **`behavior change:`** を明記（judge L3 判定根拠）
3. `.length` / `keyphrases.length` 系の sum（文字列長・個数）は非有限になり得ないため**移行対象外**
4. `Math.max(...arr)` は巨大配列で spread stack overflow の既知リスクもあるが、本 feature の主目的は非有限伝播の遮断。loop 実装で両方潰せるなら副次効果として記録
5. registry への追加は `frozen-literal-rules.ts` 単一ファイル方針（`docs/architecture.md`、423 行 < 800 行の上限）。分割はしない
6. cwd 相対 `readFileSync` は `--maxWorkers>1` で flake → `import.meta.url` 基準（TC-302/313 の教訓）
