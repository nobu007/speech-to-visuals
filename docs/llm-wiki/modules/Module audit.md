---
title: Module audit
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
# Module audit

## Role

- Rationale: Files under .audit form a shared path-level boundary.
- Roots: .audit
- Languages: yaml
- Files: 1
- Bytes: 3164

## Key Files

- `.audit/purpose_driven_plan.yml`

## Risk Signals

- RISK-0001 (high, Security Boundary) in `.audit/purpose_driven_plan.yml`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L45: title: "Enforce JWT authentication on pipeline routes in production"
- RISK-0002 (high, Destructive Mutation) in `.audit/purpose_driven_plan.yml`: Deletion or forceful mutation needs clear guardrails and recovery behavior. Evidence: L45: title: "Enforce JWT authentication on pipeline routes in production"
- RISK-0003 (medium, Network Or IPC) in `.audit/purpose_driven_plan.yml`: Cross-process or network boundaries can fail through protocol, timeout, and trust assumptions. Evidence: L13: title: "Add UUID validation to WebSocket join:job/leave:job handlers"
- RISK-0004 (medium, Parser Or Heuristic) in `.audit/purpose_driven_plan.yml`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L11: note: "Replaced manual type assertions with Zod safeParse."
- RISK-0005 (low, High Attention File) in `.audit/purpose_driven_plan.yml`: The digest found several implementation signals worth manual review. Evidence: L11: note: "Replaced manual type assertions with Zod safeParse."

## Files

- `.audit/purpose_driven_plan.yml` — yaml, 72 lines, attention 84
