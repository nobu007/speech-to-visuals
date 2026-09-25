---
title: Repo Wiki Log
genre: repository-analysis
type: concept
sources:
  - extract-skill-meta planning artifacts
related:
  - Repository Wiki Index
  - Repository Overview
  - Repository Risk Register
status: generated
---
# Repo Wiki Log

## ingest | speech-to-visuals

- target: `/home/jinno/speech-to-visuals`
- files: 1427
- logical modules: 36
- risk findings: 1252
- created_or_updated:
  - [[Repository Wiki Index]]
  - [[Repository Overview]]
  - [[Repository Risk Register]]
  - [[Processing Progress]]
  - [[Module Index]]
  - [[File Inventory]]
  - [[Repo Wiki Schema]]
- decision_reason: Generated during extract-skill-meta planning so repository understanding and risk context compound alongside skill extraction.

## 2026-09-26 — 親候補の推定草案を追記

contracts の llm-wiki-discipline 原則に基づき、relations.md に親候補（business_operation_notes・推定）を追記した。既存の生成スナップショット wiki（index.md その他の生成ページ）は変更していない。

- **Verification**: README.md の処理フロー記載、原則 `registry/principles/llm-wiki-discipline.yaml`（contracts リポ commit 3ab5768）。

## 2026-09-26 — 親の確定（jinno確定）

relations.md の親草案を確定版へ訂正した（親: business_operation_notes）。

**Verification**: contracts registry `registry/organization/repositories/speech-to-visuals.yaml` の spec.parent と一致することを確認（contracts commit ecbc226、validate/lint 0 errors 済み）。
