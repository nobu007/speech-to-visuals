# guard-harness-fold-census コンテキストノート


<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](../speech-to-visuals/architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-18
**feature_id**: guard-harness-fold-census
**最終更新**: 2026-08-18（初回作成・kairo-requirements による自動生成）

## 技術スタック（本 feature 直接関連のみ）

- TypeScript 5.x strict / ESM（`"type": "module"`）・パスエイリアス `@` → `./src`
- Jest 30 + ts-jest（ESM。`NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096'` 必須）
- Node 24（CI = ci.yml 全 job・ローカル実測 v24.11.1）
- GitHub Actions（gh CLI で run 照会可）

## 関連実装（guard アーキテクチャ現状マップ）

### registry 系（round 8 生成・round 35 静的分割）

- `tests/guards/freeze-guard.ts`（139 行）— 共有 walk engine・`readSource`・`FrozenLiteralRule` 型
- `tests/guards/frozen-literal-rules.ts`（124 行）— 静的 import 集約（新規 family = 2 行追加）
- `tests/guards/frozen-literal-families/`（42 file / 47 rule）— family 単位の data row
- `tests/guards/frozen-literal-registry.test.ts` — 全 entry 一括 sweep（49 test・実測 2.0s GREEN）

### per-family single-source test（36 file・本 feature の data-row 化対象）

3 層構造（round 46〜50 で 2,341 行 / 5 file）:

- Layer 1 verbatim oracle — 退役式の凍結 + corpus 等価（`object-is` または delta bound + witness）
- Layer 2 semantic pin — live witness・クランプ証人（**family 固有・移行対象外**）
- Layer 3 source anchor — `readSource` + 正規表現出現回数 pin + コード行 ban

代表実装: `tests/guards/grid-packing-single-source.test.ts`（440 行・3 層の完全な例）

### 正典モジュール（fold 先）

- `src/visualization/layout-utils.ts`（653 行・distance / overlap / extent / clamp / grid / ring / center 系）
- `src/visualization/node-dimensions.ts`（141 行・寸法系）
- `src/visualization/strategy-edges.ts` / `strategy-graph.ts`（エッジ・グラフ系）
- `src/utils/guards.ts`（clampFinite / clamp01 — NaN 契約が bare inline と**異なる**点に注意）

## 開発ルール（本 feature 固有の注意）

1. **mutation RED 検証必須**: guard 追加・移行後は ban 削除・回数変更・bound 緩和等
   5 種以上の変異で RED を実証する（行ベース正規表現は複数行 shape で false-pass する）
2. **registry パターンは行ベース単一行**（round 32 教訓）
3. **readSource は `import.meta.url` 起点**（cwd 相対は whisper-node chdir で FLAKE）
4. **ESM mock**: 新 named export を import したら該当 `unstable_mockModule` 部分モックへ追記
5. **worktree**: `ln -s /home/jinno/speech-to-visuals/node_modules node_modules` 未実施だと
   jest preset Validation Error
6. **検索**: RTK hook が `rg` を破壊するため `grep -rn` を使用
7. **退役式は「改善しない」**: Layer 1 の凍結式は旧挙動の証人（do-not-improve 規約）

## 設計文書・記録

- 親: `specs/speech-to-visuals/architecture.md`（round 記録の正本・round 50 まで）
- 本 feature: `specs/guard-harness-fold-census/`（requirements / interview-record /
  user-stories / acceptance-criteria / note）
- 先行類例: round 35 registry 分割（fingerprint + RED probe の手順が
  `frozen-literal-rules.ts` ヘッダコメントに記録）

## Acceptance criteria（完了条件）

詳細は [acceptance-criteria.md](acceptance-criteria.md)。要約:

- [ ] harness が oracle row / anchor row を生成し、fail-loud・vacuum 検出を持つ（TC-001-xx）
- [ ] default-node-extent + grid-packing の移行が fingerprint 等価・mutation RED 5 種・±20% 時間（TC-004-xx）
- [ ] census guard が C1〜C5 を pin し ratchet する（TC-005-xx）
- [ ] CI 証拠記録（run URL + SHA）が maintain される・node 18 残留が解決または理由明記（TC-104-xx）
- [ ] census 表と guard pin が同一 grep コマンド由来（REQ-404）

## 注意事項

- GOOGLE_API_KEY は本 feature で不要（テスト/インフラのみ）
- census の grep は `__tests__` と正典モジュールを除外すること（ベースライン数値の再現性）
- C1 clamp 家族を clampFinite へ移行する案件は**実挙動変更**を伴うため本 feature スコープ外
  （NaN 透過 → NaN→min の契約差・per-site 判断が必要）
