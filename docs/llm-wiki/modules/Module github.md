---
title: Module github
genre: repository-analysis
type: entity
sources:
  - extract-skill-meta planning artifacts
related:
  - Module Index
  - Repository Risk Register
  - File Inventory
status: generated
---
# Module github

## Role

- Rationale: Files under .github form a shared path-level boundary.
- Roots: .github
- Languages: yaml
- Files: 2
- Bytes: 2274

## Key Files

- `.github/workflows/ci.yml`
- `.github/workflows/infrastructure.yml`

## Risk Signals

- RISK-0125 (medium, Persistence Or State) in `.github/workflows/ci.yml`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L17: cache: npm
- RISK-0126 (low, High Attention File) in `.github/workflows/ci.yml`: The digest found several implementation signals worth manual review. Evidence: L17: cache: npm

## Files

- `.github/workflows/ci.yml` — yaml, 70 lines, attention 70
- `.github/workflows/infrastructure.yml` — yaml, 35 lines, attention 0
