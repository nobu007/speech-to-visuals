---
title: Module src-config
genre: repository-analysis
type: entity
sources:
  - extract-skill-meta planning artifacts
related:
  - Module Index
  - Repository Risk Register
  - File Inventory
created: 2026-05-20
updated: 2026-05-20
status: generated
---
# Module src-config

## Role

- Rationale: Files under src form a shared path-level boundary.
- Roots: src
- Languages: typescript
- Files: 9
- Bytes: 50045

## Key Files

- `src/config/code-size-audit.ts`
- `src/config/env.ts`
- `src/config/index.ts`
- `src/config/limits.ts`
- `src/config/production-config.ts`
- `src/config/schema.ts`
- `src/config/validate.ts`
- `src/config/__tests__/env.test.ts`

## Risk Signals

- RISK-0530 (medium, Parser Or Heuristic) in `src/config/__tests__/env.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L1: import { getConfig, resetConfig, parseBoolean, parseNumber, maskSensitiveValue, getMaskedConfig } from '../env';
- RISK-0531 (low, High Attention File) in `src/config/__tests__/env.test.ts`: The digest found several implementation signals worth manual review. Evidence: L1: import { getConfig, resetConfig, parseBoolean, parseNumber, maskSensitiveValue, getMaskedConfig } from '../env';
- RISK-0532 (medium, Persistence Or State) in `src/config/__tests__/validate.test.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L11: cacheSize: 200,
- RISK-0533 (medium, Parser Or Heuristic) in `src/config/code-size-audit.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L186: const pkg = JSON.parse(raw) as {
- RISK-0534 (medium, Parser Or Heuristic) in `src/config/env.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L8: * Parses a string environment variable as a boolean.
- RISK-0535 (medium, Persistence Or State) in `src/config/env.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L4: /** Cached singleton config instance */
- RISK-0536 (low, High Attention File) in `src/config/env.ts`: The digest found several implementation signals worth manual review. Evidence: L4: /** Cached singleton config instance */
- RISK-0537 (medium, Parser Or Heuristic) in `src/config/index.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L8: export { getConfig, resetConfig, parseBoolean, parseNumber, maskSensitiveValue, getMaskedConfig } from './env';
- RISK-0538 (medium, Concurrency Or Timing) in `src/config/limits.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L41: /** Default request timeout in milliseconds */
- RISK-0539 (low, High Attention File) in `src/config/limits.ts`: The digest found several implementation signals worth manual review. Evidence: L4: * All magic numbers that govern rate limiting, job concurrency,
- RISK-0540 (medium, Concurrency Or Timing) in `src/config/production-config.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L32: timeoutMs: number;
- RISK-0541 (medium, Parser Or Heuristic) in `src/config/production-config.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L86: * Safely get NODE_ENV with browser-compatible fallback (ISS-012)
- RISK-0542 (medium, Persistence Or State) in `src/config/production-config.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L33: cacheStrategy: 'memory' | 'redis' | 'hybrid';
- RISK-0543 (low, High Attention File) in `src/config/production-config.ts`: The digest found several implementation signals worth manual review. Evidence: L31: memoryLimit: number; // in MB
- RISK-0544 (medium, Persistence Or State) in `src/config/schema.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L12: cacheSize: number;
- RISK-0545 (high, Security Boundary) in `src/config/validate.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L138: export function validateJwtSecret(secret: string): ValidationError[] {
- RISK-0546 (medium, Persistence Or State) in `src/config/validate.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L72: if (config.cacheSize !== undefined) {
- RISK-0547 (low, High Attention File) in `src/config/validate.ts`: The digest found several implementation signals worth manual review. Evidence: L72: if (config.cacheSize !== undefined) {

## Files

- `src/config/__tests__/env.test.ts` — typescript, 246 lines, attention 100
- `src/config/__tests__/validate.test.ts` — typescript, 254 lines, attention 28
- `src/config/code-size-audit.ts` — typescript, 214 lines, attention 28
- `src/config/env.ts` — typescript, 109 lines, attention 100
- `src/config/index.ts` — typescript, 10 lines, attention 14
- `src/config/limits.ts` — typescript, 80 lines, attention 100
- `src/config/production-config.ts` — typescript, 499 lines, attention 100
- `src/config/schema.ts` — typescript, 18 lines, attention 28
- `src/config/validate.ts` — typescript, 235 lines, attention 84
