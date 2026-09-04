# table-driven ガードハーネス抽出と fold 収束 census 要件定義書


<!-- spine:anchor:begin -->
> **Spine anchor**: [Speech-to-Visuals システム憲法 V2.8](../../SYSTEM_CONSTITUTION.md)
>
> - parent: `SYSTEM_CONSTITUTION.md`
> - role: `feature_root`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-18
**feature_id**: guard-harness-fold-census
**作業規模**: フル機能開発（3 workstream: ハーネス抽出 / census 機械化 / CI 検証証拠）
**出典**: AI Hub make-run steering feedback（前イテレーション VALUABLE 判定・継続指示 3 項）

## 概要

round 41〜50 の fold 系列（重複レイアウト幾何の単一ソース化）は 42 family /
47 rule の frozen-literal registry で機械執行され、違反 0 を維持している
（2026-08-18 時点で registry sweep 49 test GREEN を確認）。一方、1 family あたり
「registry family module（約 30〜40 行・既に data-row 化済み）+ per-family
single-source test（365〜673 行・3 層構造）」の後者が round 46〜50 の 5 フェーズで
計 2,341 行ほぼ同型で繰り返されており、fold 1 family 追加のコストと検証漏れ
リスクが段々と増大している。また fold 系列の終了条件がどこにも数値化されて
おらず、残り作業が value-neutral か実挙動変更必要かを機械判定できない。

本要件は次の 3 点を要件化する:

1. **table-driven guard harness**: per-family test の機械的部分（verbatim
   oracle / source anchor / ban）を data row 化した共通 harness を
   `tests/guards/` に抽出し、新規 fold family を「registry 1 行 + harness
   1 data row + Layer 2 pin 群」で追加できる構造にする。
2. **fold 収束 census**: 残存 inline site を family × site 数 × 分類
   （value-neutral / 実挙動変更必要 / 異概念 / 閾値未満）で数値化した
   census を guard test として機械化し、系列の収束・終了を機械判定可能にする。
3. **CI 修復の検証証拠記録**: infra/ci-repair（commit 2fcbd4f0）の green run
   URL・job 構成を記録に残し、workflow 修正を plausible から verified に
   格上げする（本要件作成時に実測 evidence を採取済み → interview-record A3）。

## 関連文書

- **分析記録**: [💬 interview-record.md](interview-record.md)
- **ユーザストーリー**: [📖 user-stories.md](user-stories.md)
- **受け入れ基準**: [✅ acceptance-criteria.md](acceptance-criteria.md)
- **コンテキストノート**: [📝 note.md](note.md)
- **親アーキテクチャ（round 記録）**: [../speech-to-visuals/architecture.md](../speech-to-visuals/architecture.md)
- **先行類例（registry data-row 化）**: round 35 静的 family 分割（`tests/guards/frozen-literal-rules.ts` ヘッダコメント）

## 機能要件（EARS記法）

**【信頼性レベル凡例】**:

- 🔵 **青信号**: 既存実装・実測値・green run ログを参考にした確実な要件
- 🟡 **黄信号**: 既存実装・steering から妥当な推測による要件
- 🔴 **赤信号**: 参照資料にない自動推定による要件

### 通常要件

- REQ-001: システムは、per-family guard test の機械的 3 層のうち
  Layer 1（verbatim oracle: 正典関数と凍結した退役式のコーパス等価比較）と
  Layer 3（source anchor: 移行済みファイルの delegation 形状正規表現 + ban
  正規表現の行カウント）を、data row（行データ）として宣言する共通
  table-driven harness モジュールを `tests/guards/` 配下に提供しなければ
  ならない 🔵 *round 46〜50 の 5 family 実測解剖（grid-packing 440 行・
  default-node-extent 365 行等、全 3 層が同型）より*
- REQ-002: harness は oracle row について等価 mode として
  `object-is`（ビット同一）と `delta<=ε`（ULP 級再グループ化差の上限、
  witness 付きで非 vacuum を強制）の 2 種をサポートしなければならない 🔵
  *round 48 ring placement・round 50 grid packing の stamp A/B 2 正典問題で
  実績のある比較方式より*
- REQ-003: harness は anchor row について
  「指定 file に正規表現が指定回数だけ出現すること」と
  「指定 file のコード行（コメント行除外）に正規表現が出現しないこと」を
  1 行で宣言できなければならない 🔵 *既存 `codeLines()` filter +
  `readSource` パターン（grid-packing-single-source.test.ts:325-329）より*
- REQ-004: システムは、既存 5 family（round 46〜50）のうち少なくとも
  2 family（default-node-extent・grid-packing）を harness 移行し、移行前後で
  実行される assertion 集合が等価であることを fingerprint（test 名 +
  expectation 数の列挙）で証明しなければならない 🔵 *round 35 registry 分割
  の before/after fingerprint 手法の前例より*
- REQ-005: システムは、残存 inline site の census を
  family × site 数 × 分類（value-neutral / 実挙動変更必要 / 異概念 /
  閾値未満）の表として保持し、census 数値を pin した guard test によって
  「site 数が増えたら RED、減ったら pin 更新要」という ratchet を提供しな
  ければならない 🟡 *steering 指示「census を数値で記載し機械判定」から*
  （census 実測値は interview-record A2 参照）

### 条件付き要件

- REQ-101: 新規 fold family を追加する場合、システムは
  「registry family module 1 ファイル + registry aggregator 2 行 +
  harness data row（oracle 行 + anchor 行）+ Layer 2 pin（family 固有の
  live witness / semantic pin）」以外の新規 boilerplate を要求してはならない 🟡
  *現状 365〜673 行/家族のうち機械的部分が大半を占める実測からの推測*
- REQ-102: harness の data row を変異させる場合（ban 正規表現の削除・
  出現回数の変更・oracle 上限の緩和・corpus の縮小・witness 除去）、
  対応する生成 test は RED にならなければならない 🔵 *既存 mutation-RED
  検証規律（round 43〜50・各 round 5 種以上の変異検証）より*
- REQ-103: census guard test が site 数の増加を検出した場合、システムは
  分類表（`specs/guard-harness-fold-census/requirements.md` census 表）の
  更新を伴わない増加を失敗させなければならない 🟡 *ratchet 設計からの推測*
- REQ-104: `gh` CLI で CI run 状態を照会できる場合、CI 検証証拠記録
  （interview-record A3）は run URL・job 一覧・結論の形式で再生可能な
  参照を保持しなければならない 🔵 *本要件作成時に実採取した run
  32045615156 / 32047074800 の形式より*

### 状態要件

- REQ-201: census 上で「value-neutral な fold 候補（同一概念が 2 ファイル
  以上に inline）」が 0 family になった状態にある場合、システムは fold 系列
  を収束（終了）と判定し、以降の fold phase を提案しないと明記しなければ
  ならない 🟡 *終了条件の数値化という steering 指示からの設計*
  （2026-08-18 実測では value-neutral 候補 0 family・詳細は census 表）
- REQ-202: fold 系列が収束状態にある場合、残存 inline 家族は
  「実挙動変更必要（NaN 契約など設計判断を要する）」または
  「異概念 / 閾値未満（1 ファイル内のみ）」のいずれかに分類されていなけ
  ればならない 🔵 *2026-08-18 census 実測（C1: clamp 32 site / 20 file =
  実挙動変更、C3〜C5 = 1 ファイル内のみ）より*

### オプション要件

- REQ-301: システムは、`infrastructure.yml` の
  `monitoring-schema-validate` job の `node-version: 18`（同ファイル 37 行）
  を ci.yml と同じ 24 に揃えてもよい（現状 green だが policy 不一致） 🔵
  *実測（ci.yml は全 10 job が 24・infrastructure.yml 37 行のみ 18）より*
- REQ-302: システムは、GitHub Actions の Node 20 非推奨 annotation
  （checkout@v4 / setup-node@v4 が node 24 強制）を解消するため actions
  version を将来 bump してもよい 🟡 *run annotation の警告文からの推測*

### 制約要件

- REQ-401: harness 移行において、生成される assertion の意味論は移行前の
  per-family test と等価でなければならず、本要件の範囲で production コード
  （`src/`）の挙動を変更してはならない 🔵 *value-neutral 原則（fold 系列
  の既定約）より*
- REQ-402: harness の正規表現 row は行ベース（単一行マッチ）でなければ
  ならず、複数行 shape を 1 pattern で扱ってはならない 🔵 *round 32 の
  教訓（複数行 regex = false-pass・registry パターンは行ベース単一行）より*
- REQ-403: harness・census guard を含む test suite の実行時間は、移行前の
  該当 family test 合計に対して実質等価（±20% 以内）でなければならない 🔵
  *registry sweep 実測 2.0s・full suite 予算（CI test job 16m44s 実績）より*
- REQ-404: census の site 数計測はコード行ベース（コメント行除外）で
  再現可能な単一コマンドでなければならず、ドキュメント記載数値と
  guard test の pin は同一コマンド由来でなければならない 🔵
  *「ドキュメント数値と guard pin の乖離」防止（source-anchor 規律の
  census 版）より*
- REQ-405: CI 検証証拠記録は run URL を含み、記録時点の commit SHA を
  付記しなければならない 🔵 *証拠の再現性（どの commit の green か）より*

## 非機能要件

### パフォーマンス

- NFR-001: registry sweep + harness 生成 test の合計実行時間は 10 秒以内
  （現状 registry 49 test = 2.0s） 🔵 *実測より*

### セキュリティ

- NFR-101: harness・census guard は `readFileSync` によるソース走査を
  `import.meta.url` 起点で行い、cwd 相対 read を禁止する 🔵
  *既存規律（cwd-relative reads FLAKE・source-anchor 規律）より*

### ユーザビリティ

- NFR-201: 新規 fold family 追加の手順は registry ヘッダコメントに
  「1 data row 追加」手順として文書化されていなければならない 🟡
  *既存 registry ヘッダの記載様式からの推測*

## Edgeケース

### エラー処理

- EDGE-001: data row に不正な値（負の出現回数・空 corpus・ε 未指定の
  delta mode）が宣言された場合、harness は test 実行時に明示的な
  validation error で fail しなければならない 🟡 *fail-loud 原則からの推測*
- EDGE-002: census grep がコメント行・テストファイルを除外し損ねた場合、
  pin 数値との不一致で RED により検出されなければならない 🔵
  *REQ-404 の単一コマンド制約により機械検出可能*

### 境界値

- EDGE-101: oracle row の delta bound が corpus 上一度も exercise されない
  場合（vacuous bound）、harness は witness なしの場合 RED にしなければ
  ならない 🔵 *round 50「deltas > 0 witness で vacuum を排除」の実績より*
- EDGE-102: census 対象 family の site 数が 0 になった場合、ratchet は
  pin 更新を要求し（0 への更新）、family 行自体の無声削除を許しては
  ならない 🟡 *「0 = 収束」を隠蔽する silent-delete 防止の設計*

## census（2026-08-18 実測・ REQ-005 / REQ-201 のベースライン）

計測コマンドと生ログは interview-record A2 を参照。集計
（round 51 で REQ-404 準拠の engine 実測値に再ベースライン —
`tests/guards/fold-census-guard.test.ts` が marker = data pin = engine 実測の
3 者一致を検証する。A2 素朴 grep 値との差: C1 はコメント行除外で
32→30・file 20→17、C2 は精密 pattern（config object 既定 `width: 1920` 形・
resolution preset 行除外）で 8→16/4→8、C5 は engine 全走査が A2 の
ファイル限定 grep の見逃し 2 site を発見し 1→3/1→3）:

| 区分 | family / 項目 | 正典 | 残存 inline site（engine 実測） | 分類 |
|---|---|---|---|---|
| 既fold（執行済） | registry 42 family / 47 rule | layout-utils / node-dimensions / strategy-* へ委譲 | **違反 0**（sweep 49 test GREEN） | 収束済み |
| C1 | 汎用 clamp `max(min,max(v))` 系 | `src/utils/guards.ts` clampFinite/clamp01 | 29 site / 16 file <!-- census-pin:C1:sites=29:files=16 --> | **実挙動変更必要**（bare 形は NaN 透過、clampFinite は NaN→min へ sanitize = 契約差） |
| C2 | layout 既定 1920/1080 直書き | DEFAULT_CANVAS_WIDTH/HEIGHT | 16 site / 8 file <!-- census-pin:C2:sites=16:files=8 --> | **設計判断必要**（同一値の別 config・RED 不能） |
| C3 | 半径方向 push `cos/sin(angle)·sep` | pointOnCircle は絶対位置で別概念 | 4 site / 1 file（strategies/OverlapResolver.ts:257-260）<!-- census-pin:C3:sites=4:files=1 --> | 異概念 / 閾値未満（1 file） |
| C4 | 文字幅見積 `text.length * 8 + 40` | DEFAULT_CHAR_WIDTH=8（layout-utils） | 1 site / 1 file（advanced-layouts.ts:537）<!-- census-pin:C4:sites=1:files=1 --> | 閾値未満（1 file） |
| C5 | 反二乗反発 `(k·w)/dist²` | force-directed-params は regime 型で別公式 | 3 site / 3 file（edge-crossing-minimizer.ts:336・complex-layout-engine.ts:742・network-strategy.ts:118）<!-- census-pin:C5:sites=3:files=3 --> | 異概念 |

**収束判定**: value-neutral な fold 候補（同一概念・2 file 以上・委譲で
ビット等価）= **0 family**。fold 系列は value-neutral 作業について収束
（REQ-201 の終了状態を現時点で既に満たす）。残る C1/C2 は意思決定が必要な
別系列（C1 は NaN 契約の per-site 判断、C2 は config 出所の設計）であり、
fold 系列の延長では自動処理しない。

## 品質判定

- 要件の曖昧さ: なし（全 REQ に実測値・既存実装の出典を付記）
- 入出力定義: 完全（harness data row 形状・census コマンド・fingerprint 手法を acceptance-criteria に明記）
- 制約条件: 明確（REQ-401〜405）
- 実装可能性: 確実（round 35 の registry data-row 化と同一手法の適用）
- 信頼性分布: requirements.md 25 項目中 🔵 17 / 🟡 8 / 🔴 0（REQ 18・NFR 3・EDGE 4）

次のお勧めステップ: `/tsumiki:kairo-design guard-harness-fold-census` で技術設計文書を作成。
