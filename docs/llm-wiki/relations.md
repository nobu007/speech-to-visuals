# Repository Relations — speech-to-visuals

現 repo から観測された外部依存・関連 repo のメモ (根拠: 実 file / 実 hash)。
実装で新たな外部関係が生じた際に更新する。

## Dependencies

### nobu007/stv-core (`@stv/core`)

- 関係: npm dependency (`package.json`: `"@stv/core": "github:nobu007/stv-core#v1.0.7"`)
- 消費規模: repo src 365 file が `@stv/core/*` を import (guards の `walkProductionSurface`
  も core-four を生産 surface に含める — REQ-391〜394)
- 実測 hash (今回の run で確認): `node_modules/@stv/core/package.json`
  sha256 先頭 16 = `918f3389b1f62783` (version 1.0.7)
- ローカル checkout なし (node_modules 経由のみ)

### その他

- 証拠の付いた他 repo 関係は今のところ無し (AI Hub chain の instruction は
  別系統の管理 repo 由来だが、本 repo の code/specs には依存しない)
