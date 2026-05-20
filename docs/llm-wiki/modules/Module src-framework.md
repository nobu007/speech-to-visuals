---
title: Module src-framework
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
# Module src-framework

## Role

- Rationale: Files under src form a shared path-level boundary.
- Roots: src
- Languages: typescript
- Files: 6
- Bytes: 118069

## Key Files

- `src/framework/auto-improvement-engine.ts`
- `src/framework/continuous-learner.ts`
- `src/framework/iteration-manager.ts`
- `src/framework/recursive-custom-instructions.ts`
- `src/framework/__tests__/auto-improvement-engine.test.ts`
- `src/framework/__tests__/continuous-learner.test.ts`

## Risk Signals

- RISK-0566 (low, High Attention File) in `src/framework/__tests__/auto-improvement-engine.test.ts`: The digest found several implementation signals worth manual review. Evidence: L42: memoryUsage: 300,
- RISK-0567 (medium, Concurrency Or Timing) in `src/framework/__tests__/continuous-learner.test.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L280: it('should reflect data after recording processing results', async () => {
- RISK-0568 (medium, Persistence Or State) in `src/framework/__tests__/continuous-learner.test.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L660: // Access internal database to get IDs
- RISK-0569 (low, High Attention File) in `src/framework/__tests__/continuous-learner.test.ts`: The digest found several implementation signals worth manual review. Evidence: L166: ['timeout', 'memory_overflow'],
- RISK-0570 (low, High Attention File) in `src/framework/auto-improvement-engine.ts`: The digest found several implementation signals worth manual review. Evidence: L20: memoryUsage: number; // MB
- RISK-0571 (medium, Concurrency Or Timing) in `src/framework/continuous-learner.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L162: private async analyzeNewData(data: LearningData): Promise<void> {
- RISK-0572 (medium, Persistence Or State) in `src/framework/continuous-learner.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L54: private learningDatabase: LearningData[] = [];
- RISK-0573 (low, High Attention File) in `src/framework/continuous-learner.ts`: The digest found several implementation signals worth manual review. Evidence: L54: private learningDatabase: LearningData[] = [];
- RISK-0574 (medium, Concurrency Or Timing) in `src/framework/iteration-manager.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L20: export type RecoveryStrategy = 'retry' | 'fallback' | 'minimal' | 'manual';
- RISK-0575 (medium, Parser Or Heuristic) in `src/framework/iteration-manager.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L153: const threshold = parseInt(percentMatch[1]);
- RISK-0576 (low, High Attention File) in `src/framework/iteration-manager.ts`: The digest found several implementation signals worth manual review. Evidence: L20: export type RecoveryStrategy = 'retry' | 'fallback' | 'minimal' | 'manual';
- RISK-0577 (medium, Concurrency Or Timing) in `src/framework/recursive-custom-instructions.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L198: private async runQualityChecks(): Promise<QualityCheckResults> {
- RISK-0578 (medium, Persistence Or State) in `src/framework/recursive-custom-instructions.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L86: private currentState: IterationState;
- RISK-0579 (low, High Attention File) in `src/framework/recursive-custom-instructions.ts`: The digest found several implementation signals worth manual review. Evidence: L30: memoryUsage: number;

## Files

- `src/framework/__tests__/auto-improvement-engine.test.ts` — typescript, 465 lines, attention 100
- `src/framework/__tests__/continuous-learner.test.ts` — typescript, 780 lines, attention 98
- `src/framework/auto-improvement-engine.ts` — typescript, 450 lines, attention 100
- `src/framework/continuous-learner.ts` — typescript, 975 lines, attention 100
- `src/framework/iteration-manager.ts` — typescript, 448 lines, attention 100
- `src/framework/recursive-custom-instructions.ts` — typescript, 672 lines, attention 100
