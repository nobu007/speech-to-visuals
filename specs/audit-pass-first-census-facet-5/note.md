# audit-pass-first census 第5 facet — Context Note

<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals メインコンテキストノート](../speech-to-visuals/note.md) REQ-391〜395 audit-pass-first census series context
>
> - parent: `speech-to-visuals/note.md` (REQ-391〜395 census family)
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-23
**目的**: make-run steering 直近の指摘「次は audit-pass-first パターンを
未着手の facet に適用する候補を選定し REQ-396/397 を計画すること」を
具体化する spec の技術的根拠・設計決定・pattern 整合を整理する。

---

## 0. make-run steering 直近原文（要旨）

```
audit-pass-first パターンが定着し有効に機能している。次は (a) 同パターンを
未着手の facet（例: stale-comment、type-narrow-as-any、any 漏出など）に
適用する候補を選定し REQ-396/397 を計画すること。
```

同時に同 steering は「collapse implementation + acceptance-receipt into a
single range」「similar tweaks batch into one canonical-anchor PR」を
hygiene 指摘としており、本 spec は:

- **実装 (REQ-396 + REQ-397) を同一 range で計画**（paired 新設 = 3 guard
  を 1 iteration に同梱）
- **3 guard を canonical-anchor 1 commit で batch**（個別 PR に分割しない）

の 2 点を hygiene 方針として明示する。

---

## 1. 選択した 3 class の妥当性

### 1.1 stale-comment class

**観測**:
- src/ 内 TODO/FIXME/XXX/HACK marker: 3 件（grep 実測）
- `// Would be / Would be calculated from` confession comment:
  REQ-393 TC-377-01 が `video-generator.ts` の `// 0.8 mask は
  legit-zero を隠す` を**本文が論じながら未修正のまま ship** していた
  事例をはじめ、REQ-391/393 の手動 audit が度々発見

**census 化の妥当性**:
- 既存観測で残件は **0 件** (after REQ-391〜394 撲滅同梱後) — REQ-394
  と同型の **confirmed-zero 固定** で十分
- self-confession を class として pin する**diagnostic 価値**あり
  （confession の再発は「捏造の隠蔽再導入」の兆候）
- 検出 regex は 4 軸（confession / disclosure / marker / self-claim）
  で十分カバレッジ可能

### 1.2 type-narrow-as-any class

**観測**:
- `as any` cast: 47 site (src/ + test)
- 過半は ESM test mock / JSON.parse 結果の `unknown` 経由 narrowing /
  React event handler の歴史的型の正当用途だが、generic cast
  （「型が複雑なので通すため」）が散在

**census 化の妥当性**:
- REQ-393 score-ladder の `??`/`||` 発見と**同型 class**（narrow
  失敗の catch-all = legit-narrowing を info-silencer 化）
- 47 site 規模は REQ-391 measurement-fixture の 31 key 漏れの規模感
  と類似 — audit-driven で**初手から発見・修正が必要**
- 4 分類（test-mock / json-parse-narrowing / external-boundary /
  third-party-type-gap）で ALLOWED 整理可能

### 1.3 any 漏出 class

**観測**:
- `: any` 注釈: 32 site (src/ + test 除く)
- `<any>` 汎用型・`Array<any>` / `Record<string, any>` 多数
- boundary external input (req.body・form payload・third-party SDK)
  と internal logic の parameter/return type が混在

**census 化の妥当性**:
- REQ-393 score-ladder の `?? 数字` が fail-closed 0 へ移行された
  のと**同型 class の型システム側**（`any` 注釈 = type-system 全体の
  fail-open — narrow 失敗を compile-time に黙殺）
- 32 site 規模は REQ-393 の 29→21 site 規模と類似 — paired audit-driven
  撲滅同梱が妥当
- boundary 4 分類（external-input / third-party-sdk / migration-shim /
  dynamic-config-load）で ALLOWED 整理可能

---

## 2. REQ 番号設計（REQ-396/397 への割当）

| REQ | class | paired 新設の根拠 |
|-----|-------|------------------|
| REQ-396 | stale-comment | 単独 REQ（他 class と直交） |
| REQ-397 | type-narrow-as-any + any-annotate | paired 新設（同根 type-system bypass の 2 表現） |

**paired 新設の判断根拠**:
- REQ-395 three-way guard precedent — 1 commit に複数 guard を
  paired ship 可能
- type-narrow-as-any と any-annotate は**検出 regex は異なるが対象
  class は同根**（type-system bypass の 2 表現）
- ALLOWED 分類の共通化（boundary external input の 4 分類）が
  cross-check 効率を上げる
- 一方 stale-comment は class として**他 2 と直交**（comment vs
  type system）であり、別 REQ で独立 audit した方が reason 衛生が
  保ちやすい

---

## 3. REQ-395 three-way guard family registration

```
family 1 = REQ-391 = measurement-fixture-census
family 2 = REQ-392 = optional-metric-producer-census
family 3 = REQ-393 = score-ladder-census
family 4 = REQ-394 = measurement-statement-literal-census
family 5 = REQ-396 = stale-comment-census            ← 新規
family 6 = REQ-397 = type-narrow-as-any-census        ← 新規
family 7 = REQ-397 = any-annotate-census              ← 新規（paired）
```

各 family は:
- `tests/guards/<name>-census.test.ts` 1 個
- `census-pin:F<N>:` doc marker 1 個 (header)
- `census-artifact-three-way.test.ts` THREE_WAY table に 1 行
- `requirements.md` の数値宣言（実測 roster から構築される phrase）

の 4 artifact を **同一 commit で ship** (REQ-395 規約)。

---

## 4. 撲滅同梱 vs confirmed-zero 固定の判定

| class | 撲滅方針 | 根拠 |
|-------|---------|------|
| stale-comment | **confirmed-zero 固定**（REQ-394 同型） | 既存観測で残件 0 — REQ-391〜394 撲滅済みの残骸 |
| type-narrow-as-any | **audit-driven 撲滅同梱**（REQ-391/393 同型） | 47 site 規模 — 過去 iteration 未着手 |
| any-annotate | **audit-driven 撲滅同梱**（REQ-391/393 同型） | 32 site 規模 — 過去 iteration 未着手 |

---

## 5. pattern 整合性チェック

| 規約 | REQ-391〜395 | REQ-396/397 |
|------|-------------|-------------|
| walkProductionSurface 単一実装 | ✅ | ✅ REQ-302 で再利用 |
| ALLOWED 分類規約 | ✅ 5 分類 | ✅ 4 分類（class 別） |
| ERADICATED + negative anchor backup | ✅ | ✅ REQ-204 |
| reason hygiene | ✅ | ✅ REQ-402 |
| counter liveness | ✅ | ✅ REQ-205 |
| test 除外規約 | ✅ | ✅ REQ-397-007 |
| multiline discovery 上限 honest doc | ✅ | ✅ REQ-203 |
| three-way guard family registration | ✅ | ✅ REQ-205 |
| spec 重複禁止 (guards.ts は SoT) | ✅ | ✅ REQ-403 |
| guards 配下 test 配置 | ✅ | ✅ REQ-201 |
| maintenance note header | ✅ | ✅ REQ-202 |
| 5 file batch | ✅ | ✅ REQ-401（3 guard で 8 file） |

---

## 6. 関連タスク・進捗

- 直近 predecessor: [TASK-0277](../speech-to-visuals/tasks/TASK-0277.md)
  （REQ-395 three-way guard + ratchet teardown — 完了 2026-08-22）
- 次 iteration: **本 spec を TASK-0278 として具体化** する想定
  （REQ-396/397 paired 新設・3 guard 実装 + audit-driven 撲滅）
- 想定工数: REQ-395 TASK-0277 の 2h precedent + 3 guard 新設 + audit
  撲滅で **6〜8h** 規模

---

## 7. 残課題（本 spec 内で対応外）

- ALLOWED 分類の 4 分類に該当しない site が出た場合は**新分類追加**
  が別途 REQ 必要（REQ-402 reason-hygiene で防止）
- @stv-core/core-four（vendored）側の `as any` / `: any` の扱い
  （REQ-391/392 と同じ扱いで ALLOWED・ERADICATED 分類に含めるか
  別途扱いは**初期 audit で確定**）
- `eslint-disable-next-line` / `eslint-disable` 行を type-narrow-as-any
  の軸に含めるか別 census とするか（EDGE-102 で判断）