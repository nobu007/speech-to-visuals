# spine registry title-sync census — Context Note

<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals メインコンテキストノート](../speech-to-visuals/note.md) spine landing 規約 context
>
> - parent: `speech-to-visuals/note.md` (REQ-402/406 spine edge 規約)
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-25 / **要件ID**: REQ-406（REQ-402 guard の表題面拡張）

## 1. spine 規約系列における位置

spine 整備の系譜: REQ-386（spine anchor 一括正規化）→ REQ-388（anchor
block 単体の role 契約）→ REQ-402（edge 両端の存在契約 = landing
atomicity）→ **REQ-406（edge の表題 sync）**。REQ-402 までで「登録の有無」
は機械強制されたが、「登録行の中身（表題 text）」は検証対象外で、改題時の
index 同期は人間の規約に頼っていた — 90c924db→47d71cd5 がその依存が
壊れる実例。

## 2. 事故の構造（一次資料）

- **90c924db**（REQ-404 本体 commit）: boundary / rounding の子 spec H1 を
  改題して land。親 architecture.md children index の表題は旧表記
  （`boundary strictness（混在演算子）census …` / `rounding-mode（混在丸め）
  census …`）のまま = **drift 2 件を抱えた GREEN な commit**
- **47d71cd5**（`chore(make-run): commit 2 remaining change(s)`）: 表題同期
  + REQ 順への並べ替えを sweep commit として分離 land。make-run steering が
  「子仕様の新規作成・改題 commit に index 再生成を同梱させ、取り残し chore
  commit を消せ」と 2 回指摘した対象の実体
- **反実仮想（実測済み）**: 本 guard が 90c924db の時点に存在すれば
  `REGISTRY_TITLE_DRIFT` ×2 で RED → 改題と index 同期を同一 commit に
  揃えるまで landing 不可 → sweep commit は構造的に発生しない

make-run のコミット分割単位の修正自体は hub 側 harness（本 repo の編集
対象外）の責務。本 repo 側の取り得る答案は「同期漏れを landing 時点で
RED にする」ことのみであり、それを歯として実装する。

## 3. 設計判断

- **根拠は H1 のみ**: 対象 doc の最初の `# ` 見出し（行頭 strict・空 H1 は
  無し）。title は manifest 等ではなく doc 本文から読む — 実 doc と
  index の不一致を検出する契約が doc 以外の複製を根拠にすると複製間の
  一致で満たされてしまう
- **children / references 両方に適用**: entry は閲覧入口であり、表題の
  stale 化が閲覧事故であることは片方向・双方向を問わない（REQ-402 が
  back-anchor を children のみに要求したのと対象軸が違う）
- **全文一致**: 接頭辞省略・要約記法を許すと「どの程度の一致なら良いか」
  が裁定案件になり機械契約として死ぬ。長い H1 は doc 側の責任
- **`titleChecked` 計数**: 検証実施数の floor pin。検証ループの rot（対象
  読み漏れ・条件の拡大による除外）は違反が出ないまま沈黙するので、
  計数そのものを契約にする（REQ-405 の site/cluster floor pin と同じ
  発想の検証側適用）
- **confirmed-zero pin**: 撲滅を伴わない固定要件。REQ-394/396/397/399 が
  確立した第 3 の pin 戦略（初回 run で違反 0 を確認し、以後の再出現を
  RED で差し戻す）

## 4. 実行コマンド

```bash
NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns spine-edge-census
```

mutation 検証（MW-070）も同一 suite。tsc は `node_modules/.bin/tsc -p
tsconfig.app.json --noEmit` + `tsconfig.test.json`（guard は tests/ 配下）。

## 5. 注意事項

- 本 spec 一式の parent 側登録（architecture children 2・design-interview
  children 1・note references 1）は guard・ledger と**同一 commit** に同梱
  する（REQ-406-005・REQ-402-006 踏襲）。session 終了時に未 commit 変更を
  残さない = make-run の sweep commit 発生条件そのものを潰す
- **dogfood 実績（2026-08-25 landing 时）**: 登録前に census が
  `PARENT_UNREGISTERED` ×4 で RED。さらに登録作業中、本 spec の
  tasks/overview.md H1 を sibling 規約（folder-slug 形）と異なる表記で
  作成した際に guard が `REGISTRY_TITLE_DRIFT` を即捕捉した — 初回本番
  run の段階で実 drift を検出した receipt となる
- registry block の並び順（REQ 順等）は人間規約のままで機械契約外
  （REQ-406-007）
