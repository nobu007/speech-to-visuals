# CLAUDE.md

**正本は `AGENTS.md`。必ず最初に読むこと** (本ファイルは要約ポインタ。内容が食い違う場合は AGENTS.md が優先)。

- 概要 / 技術スタック / 構造 / SDEC サイクル / コーディング規約 / テスト規約
  → AGENTS.md に全文がある。
- 追加で AGENTS.md 末尾の **「全自動開発ループ運用 (Autonomous Loop Ops)」** は必読:
  マージフロー (`gh pr merge --auto`)、検証コマンド使い分け (`verify:all`)、
  CI 構成、jest 並列、ガード文化 (verbatim 移動・アンカー再指向・private-poke 互換)、行数バジェット。

## 最低限のクイックスタート

```bash
npm run verify:all   # push 前フルゲート (CI 同構成)
npm test -- "<path-regex>"                 # 対象テストのみ高速実行
gh pr merge --auto --merge --delete-branch # checks green で自動 merge
```
