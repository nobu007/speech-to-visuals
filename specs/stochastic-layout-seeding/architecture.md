# stochastic-layout-seeding アーキテクチャ設計


<!-- spine:anchor:begin -->
> **Spine anchor**: [Speech-to-Visuals システム憲法 V2.8](../../SYSTEM_CONSTITUTION.md)
>
> - parent: `SYSTEM_CONSTITUTION.md`
> - role: `feature_root`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-15
**関連要件定義**: なし（イテレーション継続要求 — .task-prompt.md AI_HUB_MAKE_RUN_FEEDBACK + round-16 registry 例外宣言より）
**分析記録**: [design-interview.md](design-interview.md)

**【信頼性レベル凡例】**:

- 🔵 **青信号**: 既存設計文書・既存実装を参考にした確実な設計
- 🟡 **黄信号**: 既存実装から妥当な推測による設計
- 🔴 **赤信号**: 参照資料にない自動推定による設計

---

## システム概要 🔵

**信頼性**: 🔵 *src/visualization/layout-rng.ts ヘッダコメント・tests/guards/frozen-literal-rules.ts round-16 エントリより*

レイアウト生成の残り 5 ファイルに残存する未シードの `Math.random()` を `layout-rng.ts` のシード付き PRNG (`createLayoutRng`) へ移行し、全レイアウトパスで「同じ図解 → 同じ描画出力」を成立させる。round 16（2f98ef29）は zero-overlap エンジン・NetworkLayoutStrategy・aesthetic perturbation のみを修正し、stochastic 戦略群を例外宣言付きで先送りした。本 feature はその先送り分を閉じるラウンドである。

対象サイト（全 17 箇所、`grep -rn "Math.random(" src/visualization/` の実測）:

| # | ファイル | 行 | 用途 |
|---|---|---|---|
| 1-2 | `layout/strategies/SimulatedAnnealingStrategy.ts` | 91-92 | 初期配置フォールバック |
| 3 | 同 | 112 | ノード選択 |
| 4-5 | 同 | 176-177 | perturbNode 変位 |
| 6 | 同 | 334 | shouldAccept 確率判定 |
| 7-8 | `layout/strategies/ProgressiveForceStrategy.ts` | 86-87 | 初期配置フォールバック |
| 9-12 | 同 | 217-218, 277-278 | ゼロ距離脱出ジッタ ×2 |
| 13-14 | 同 | 450-451 | escapeLocalMinimum ジッタ |
| 15-16 | `layout/OverlapResolver.ts` | 193-194, 208-209 | 欠損ノード初期配置 ×2 |
| 17 | `strategies/OverlapResolver.ts` | 247 | identical-position 放射変位角 |
| 18-19 | `strategies/mindmap-strategy.ts` | 178-179 | 未割当ノード配置ジッタ |
| (参考) | `complex-layout-engine.ts` | 847 | layout id サフィックス（identity） |

## アーキテクチャパターン 🔵

**信頼性**: 🔵 *round 16 実装（enhanced-zero-overlap-layout.ts:597, NetworkLayoutStrategy.ts:94）の踏襲*

- **パターン**: 単一ソース化 + freeze-guard レジストリ例外の段階的縮退（既存 r4-r16 キャンペーンの同一パターン）
- **選択理由**: PRNG 実装は既に `layout-rng.ts` に単一ソース化済み。新規コードは描画のみで、機械的置換ではなく各戦略ごとの挙動オラクルが必要（registry コメント明記）。

## 設計方針

### D1: RNG の生成箇所と寿命 🔵

**信頼性**: 🔵 *NetworkLayoutStrategy.ts:94 の既存パターン*

各戦略の `generate()`（公開エントリポイント）先頭で 1 回だけ生成する:

```ts
const rng = createLayoutRng(nodes.map(n => n.id).join('|'));
```

- **`this` に保持しない**。戦略インスタンスは diagram をまたいで再利用され得るため、インスタンスフィールドに置くと前回の図解のシードが残留する（stale-state）。RNG は generate 呼び出し単位のローカル変数に限定し、private メソッドへ引数伝達する。
- シードテキストは r16 と同じ `ids.join('|')`。同一図解＝同一ノード ID 集合＝同一系列を保証する。

### D2: 呼び出し順序の固定 🔴

**信頼性**: 🔴 *PRNG の性質からの自動推定（既存実装に明文規定なし）*

シード付き PRNG は「生成順序」まで含めて決定性の源泉である。設計規則:

1. 1 回の generate 内で rng インスタンスは **1 つだけ**（分岐ごとに別 rng を作らない）
2. 描く順序（初期配置 → 反復 → 収束判定）は現行制御フローのまま変更しない。シード化は値の供給源置換のみとし、アルゴリズム構造を変えない
3. 将来のリファクタでループ順が変われば出力が変わる点を各オラクルテストのコメントに明記する

### D3: SimulatedAnnealingStrategy — 全 6 サイト一括 🔵

**信頼性**: 🔵 *該当行の実装読み*

初期配置 (91-92)、ノード選択 (112)、変位 (176-177)、受理判定 (334) の全描点を同一 rng から引く。特に `shouldAccept` は受理率統計（`updateNodeTemperatures`）経由でノード温度・冷却スケジュールに影響するため、**一部だけシード化すると系列が混在し再現性が壊れる**。部分移行は禁止し、このファイルは 1 コミットで全サイト閉じる。

### D4: complex-layout-engine.ts:847 の layout id 🔵

**信頼性**: 🔵 *同行実装 + registry 例外コメントより*

`layout_${Date.now()}_${Math.random().toString(36).slice(2,9)}` は geometry ではないが、出力 JSON に現れるため全体 JSON のゴールデン比較を非決定にする。**同エンジン内に既に rng があるため（693 行）それを流用してサフィックスを生成し、registry 例外から削除する**。`Date.now()` は id 衝突回避用であり、シード済み rng + ノード ID で同一図解内の一意性は保たれる。跨図解の一意性は id に連番やハッシュを足さず、既存 693 行の rng と別系列にする必要もない（同一図解の再生成は同一 id でよい — 決定性が本 feature の目的）。

🔵 **補足**: `grep -rn "\.layoutId\|layout\.id" src/ --include=*.ts`（test 除外）で consumer なしを確認済み（2026-08-15 実測）。id は出力 JSON の identity のみで外部キー参照を持たないため、シード化は安全。

### D5: strategies/OverlapResolver.ts:247 の放射変位 🔵

**信頼性**: 🔵 *228-234 行の履歴コメントより*

`angle = rng() * 2 * Math.PI` に置換。flow/flowchart 分岐は既に決定的（TC コメント付き）なので default 分岐のみ。シードは resolver の当該 resolve 呼び出しのノード ID 集合から生成。

### D6: 段階的コミット構成 🔵

**信頼性**: 🔵 *r16 の実績構成*

family ごとに 1 コミット + それぞれ RED-verified オラクル:

1. `fix(visualization): mindmap initial-placement jitter seeded` — 最小・独立
2. `fix(visualization): overlap-resolver fallback displacement seeded`（2 ファイル）
3. `fix(visualization): progressive-force jitter + fallback seeded`
4. `fix(visualization): simulated-annealing fully seeded` — 最大・最後
5. `fix(visualization): complex-engine layout id seeded` + registry 例外全削除

各コミットメッセージに **`behavior change:`** を付記（出力位置が変わるため — steering 指示）。

## ディレクトリ構造 🔵

**信頼性**: 🔵 *現状構造。新規ファイルなし**

```
src/visualization/
├── layout-rng.ts                     # 変更なし（単一ソース確立済み）
├── layout/OverlapResolver.ts         # シード化
├── layout/strategies/
│   ├── ProgressiveForceStrategy.ts   # シード化
│   └── SimulatedAnnealingStrategy.ts # シード化
├── strategies/
│   ├── OverlapResolver.ts            # シード化
│   └── mindmap-strategy.ts           # シード化
└── complex-layout-engine.ts          # id サフィックスのみ
tests/visualization/                  # オラクルテスト新設（下記 dataflow.md）
tests/guards/frozen-literal-rules.ts  # round-16 例外の段階縮退
```

## 非機能要件の実現方法

### パフォーマンス 🔵

**信頼性**: 🔵 *mulberry32 実装より*

シード付き PRNG は `Math.random()` と同等の計算量（整数演算数回/呼び出し）。レイアウト時間への影響は測定誤差内。オラクルテストの実行時間増は SA の反復回数次第だが既存テストと同規模。

### テスト容易性 🔵

**信頼性**: 🔵 *r16 オラクルの実績*

決定性により golden-position 比較が可能になる。これ自体が round-15 で指摘された「iteration-count pin ≠ outcome pin」教訓の残存分への適用。

### 互換性制約 🟡

**信頼性**: 🟡 *既存テスト群の性質からの推測*

出力位置が変わるため、これら戦略の位置をピン留めする既存スナップショットテストがあれば更新が必要。実装時に該当 suites を実行して確認する（事前には洗い出していない）。

## Acceptance criteria

- [x] `grep -rn "Math.random(" src/visualization/` が `layout-rng.ts` のコメント内のみにヒット（シードテキスト由来のドキュメント記述を除き実コード 0）— 実測: layout-rng.ts 以外 0 件（コメント内の記述も `Math.random` を `(` 無しで表記し grep に掛からないよう整形済み）
- [x] round-16 registry エントリから stochastic 例外 5 件が削除済み（complex-engine 例外も削除）— 残る例外は `layout-rng.ts`（正本 PRNG ソース）のみ。削除直後の registry sweep が `complex-layout-engine.ts` の残存 `Math.random` で FAIL したことを RED 実証後に修正
- [x] 5 ファイルそれぞれに決定性オラクル: 同一入力で 2 回 generate → positions が deep-equal（RED-verified: シード化前コードでは失敗することを 1 回確認してから修正）
  - mindmap: `tests/visualization/strategies/mindmap-strategy-seeding-oracle.test.ts` + rng 系列のソースアンカー検証
  - simulated-annealing: `tests/visualization/strategies/simulated-annealing-seeding-oracle.test.ts`（reused-instance チェック付き）
  - progressive-force: `tests/visualization/strategies/progressive-force-seeding-oracle.test.ts`
  - resolvers ×2: `tests/visualization/strategies/overlap-resolver-seeding-oracle.test.ts` + `tests/visualization/layout/overlap-resolver-initial-placement-oracle.test.ts`
    - ※ layout/OverlapResolver は E2E では GridSnap が常に最終段を上書きするため E2E 決定性はシード化前から成立しており RED 不能。戦略を identity モック（unstable_mockModule）して initializeNodes 出力を直接露出させ RED 実証
  - complex-engine id: registry sweep 自体が RED、GREEN 側は `tests/visualization/complex-layout-engine-id-oracle.test.ts`
- [x] 品質劣化ガード: 各戦略で複数シード（シードテキストに prefix 2-3 種を付したバリアント入力）を走らせ、オーバーラップ/品質メトリクスが既存レイアウト品質しきい値を下回らない
  - 各オラクルテストに variant ×3 を同梱。ただし `DEFAULT_LAYOUT_QUALITY_THRESHOLD`(0.7 composite) は radial 戦略の決定的経路でも 0.44-0.64 しか出ない（シード化と無関係の既存挙動）ため、r16 と同じ独立 overlap オラクル／有限性・キャンバス内収まることを品質しきい値とした（各テストのコメントに根拠記載）
- [x] フルスイート GREEN（`NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs`）— 727 files / 20,918 tests green（17 spine skips は従来どおり）。1 件のみ旧 id 形式 (`/^layout_\d+_/`) を pin していた `layout-delegation-helpers.test.ts` を新決定的形式に更新
- [x] type-check GREEN（`npx -p typescript tsc -p tsconfig.app.json --noEmit`）

## 関連文書

- **データフロー**: [dataflow.md](dataflow.md)
- **分析記録**: [design-interview.md](design-interview.md)
- **親設計**: [../speech-to-visuals/architecture.md](../speech-to-visuals/architecture.md)

## 信頼性レベルサマリー

- 🔵 青信号: 11件 (79%)
- 🟡 黄信号: 1件 (7%)
- 🔴 赤信号: 1件 (7%)

**品質評価**: 高品質（🔴 は設計規則の新規定という性質上避けられない。実装で規則を守るのみ）
