---
title: Module src-api
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
# Module src-api

## Role

- Rationale: Files under src form a shared path-level boundary.
- Roots: src
- Languages: typescript
- Files: 25
- Bytes: 146944

## Key Files

- `src/api/server.ts`
- `src/api/__tests__/server-route-regression.test.ts`
- `src/api/__tests__/server.test.ts`
- `src/api/batch-processing-api.ts`
- `src/api/index.ts`
- `src/api/startup-warmup.ts`
- `src/api/websocket-handler.ts`
- `src/api/__tests__/graceful-shutdown.test.ts`

## Risk Signals

- RISK-0409 (medium, Network Or IPC) in `src/api/__tests__/graceful-shutdown.test.ts`: Cross-process or network boundaries can fail through protocol, timeout, and trust assumptions. Evidence: L8: import type { Server } from 'http';
- RISK-0410 (low, High Attention File) in `src/api/__tests__/graceful-shutdown.test.ts`: The digest found several implementation signals worth manual review. Evidence: L94: const patchedOn = jest.fn((event: string, handler: (...args: unknown[]) => void) => {
- RISK-0411 (high, Destructive Mutation) in `src/api/__tests__/server-route-regression.test.ts`: Deletion or forceful mutation needs clear guardrails and recovery behavior. Evidence: L101: l => /healthRouter/.test(l) && /app\.(use|get|post|put|delete|patch)/.test(l),
- RISK-0412 (medium, Concurrency Or Timing) in `src/api/__tests__/startup-warmup.test.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L38: test('calls warmupCache when LLM service is enabled', async () => {
- RISK-0413 (medium, Persistence Or State) in `src/api/__tests__/startup-warmup.test.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L2: * REQ-202: Startup cache warmup integration test
- RISK-0414 (low, High Attention File) in `src/api/__tests__/startup-warmup.test.ts`: The digest found several implementation signals worth manual review. Evidence: L2: * REQ-202: Startup cache warmup integration test
- RISK-0415 (high, Security Boundary) in `src/api/batch-processing-api.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L85: cancelToken: { cancelled: boolean };
- RISK-0416 (medium, Concurrency Or Timing) in `src/api/batch-processing-api.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L202: const p = (async () => {
- RISK-0417 (medium, Parser Or Heuristic) in `src/api/batch-processing-api.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L171: // Fallback for non-standard File objects (test mocks)
- RISK-0418 (low, High Attention File) in `src/api/batch-processing-api.ts`: The digest found several implementation signals worth manual review. Evidence: L76: * In-memory job storage (for Phase 37 MVP)
- RISK-0419 (medium, Network Or IPC) in `src/api/index.ts`: Cross-process or network boundaries can fail through protocol, timeout, and trust assumptions. Evidence: L1: import { Server } from 'http';
- RISK-0420 (medium, Concurrency Or Timing) in `src/api/index.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L10: const SHUTDOWN_TIMEOUT_MS = 30_000;
- RISK-0421 (medium, Parser Or Heuristic) in `src/api/index.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L9: const PORT = parseInt(process.env.PORT || '3001', 10);
- RISK-0422 (high, Security Boundary) in `src/api/middleware/__tests__/auth-integration.test.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: path contains `auth`
- RISK-0423 (medium, Parser Or Heuristic) in `src/api/middleware/__tests__/auth-integration.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L8: * Uses REAL jsonwebtoken (no mocks) so actual JWT verification is tested.
- RISK-0424 (low, High Attention File) in `src/api/middleware/__tests__/auth-integration.test.ts`: The digest found several implementation signals worth manual review. Evidence: L2: * REQ-111: authMiddleware Express パイプライン統合テスト
- RISK-0425 (high, Security Boundary) in `src/api/middleware/__tests__/auth.test.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: path contains `auth`
- RISK-0426 (medium, Parser Or Heuristic) in `src/api/middleware/__tests__/auth.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L4: * Uses REAL jsonwebtoken (no mock) so tests verify actual JWT verification
- RISK-0427 (low, High Attention File) in `src/api/middleware/__tests__/auth.test.ts`: The digest found several implementation signals worth manual review. Evidence: L2: * authMiddleware unit tests.
- RISK-0428 (high, Security Boundary) in `src/api/middleware/__tests__/error-handler.test.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L5: AuthenticationError,
- RISK-0429 (low, High Attention File) in `src/api/middleware/__tests__/error-handler.test.ts`: The digest found several implementation signals worth manual review. Evidence: L5: AuthenticationError,
- RISK-0430 (high, Security Boundary) in `src/api/middleware/__tests__/mock-consistency.test.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L5: * with the JWT methods actually used by auth.ts.  If auth.ts starts using
- RISK-0431 (medium, Concurrency Or Timing) in `src/api/middleware/__tests__/mock-consistency.test.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L43: it('TC-112-02: auth.ts uses jwt.verify which maps to mock verify', async () => {
- RISK-0432 (medium, Parser Or Heuristic) in `src/api/middleware/__tests__/mock-consistency.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L2: * REQ-112: jsonwebtoken モック整合性自動検証
- RISK-0433 (low, High Attention File) in `src/api/middleware/__tests__/mock-consistency.test.ts`: The digest found several implementation signals worth manual review. Evidence: L2: * REQ-112: jsonwebtoken モック整合性自動検証
- RISK-0434 (high, Security Boundary) in `src/api/middleware/auth.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: path contains `auth`
- RISK-0435 (medium, Parser Or Heuristic) in `src/api/middleware/auth.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L2: import * as jwt from 'jsonwebtoken';
- RISK-0436 (low, High Attention File) in `src/api/middleware/auth.ts`: The digest found several implementation signals worth manual review. Evidence: L2: import * as jwt from 'jsonwebtoken';
- RISK-0437 (high, Security Boundary) in `src/api/middleware/error-handler.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L25: export class AuthenticationError extends AppError {
- RISK-0438 (low, High Attention File) in `src/api/middleware/error-handler.ts`: The digest found several implementation signals worth manual review. Evidence: L25: export class AuthenticationError extends AppError {
- RISK-0439 (medium, Concurrency Or Timing) in `src/api/middleware/rate-limit.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L27: message: 'Upload rate limit exceeded',
- RISK-0440 (high, Destructive Mutation) in `src/api/middleware/timeout.ts`: Deletion or forceful mutation needs clear guardrails and recovery behavior. Evidence: L4: * Enforces a maximum duration for each HTTP request. When the timeout
- RISK-0441 (medium, Network Or IPC) in `src/api/middleware/timeout.ts`: Cross-process or network boundaries can fail through protocol, timeout, and trust assumptions. Evidence: L4: * Enforces a maximum duration for each HTTP request. When the timeout
- RISK-0442 (medium, Concurrency Or Timing) in `src/api/middleware/timeout.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: path contains `timeout`
- RISK-0443 (low, High Attention File) in `src/api/middleware/timeout.ts`: The digest found several implementation signals worth manual review. Evidence: L2: * Request timeout middleware.
- RISK-0444 (high, Security Boundary) in `src/api/routes/__tests__/monitoring.test.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L100: expect(response.body.data.totalInputTokens).toBe(0);
- RISK-0445 (medium, Concurrency Or Timing) in `src/api/routes/__tests__/monitoring.test.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L54: it('should reflect recorded request data', async () => {
- RISK-0446 (low, High Attention File) in `src/api/routes/__tests__/monitoring.test.ts`: The digest found several implementation signals worth manual review. Evidence: L54: it('should reflect recorded request data', async () => {
- RISK-0447 (high, Security Boundary) in `src/api/routes/__tests__/pipeline-auth.test.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: path contains `auth`
- RISK-0448 (high, Destructive Mutation) in `src/api/routes/__tests__/pipeline-auth.test.ts`: Deletion or forceful mutation needs clear guardrails and recovery behavior. Evidence: L5: * enforce JWT authentication when NODE_ENV === 'production',
- RISK-0449 (medium, Parser Or Heuristic) in `src/api/routes/__tests__/pipeline-auth.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L11: import * as jwt from 'jsonwebtoken';
- RISK-0450 (medium, Persistence Or State) in `src/api/routes/__tests__/pipeline-auth.test.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L17: function createAuthApp(stateManager?: PipelineStateManager, enforceAuth = true) {
- RISK-0451 (low, High Attention File) in `src/api/routes/__tests__/pipeline-auth.test.ts`: The digest found several implementation signals worth manual review. Evidence: L2: * ISS-030: Pipeline endpoints authentication tests
- RISK-0452 (medium, Persistence Or State) in `src/api/routes/__tests__/pipeline-iterations-cap.test.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L5: import { PipelineStateManager } from '../pipeline';
- RISK-0453 (medium, Concurrency Or Timing) in `src/api/routes/__tests__/pipeline.test.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L336: it('should reflect updated state', async () => {
- RISK-0454 (medium, Persistence Or State) in `src/api/routes/__tests__/pipeline.test.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L336: it('should reflect updated state', async () => {
- RISK-0455 (high, Security Boundary) in `src/api/routes/batch.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L55: cancelToken: { cancelled: boolean };
- RISK-0456 (medium, Persistence Or State) in `src/api/routes/batch.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L32: export type JobState = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
- RISK-0457 (low, High Attention File) in `src/api/routes/batch.ts`: The digest found several implementation signals worth manual review. Evidence: L53: interface InternalJob {
- RISK-0458 (high, Security Boundary) in `src/api/routes/monitoring.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L6: * - GET /cost     - LLM cost metrics (token usage, budget)
- RISK-0459 (medium, Parser Or Heuristic) in `src/api/routes/monitoring.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L27: .transform(val => (val ? parseInt(val, 10) : 300000))
- RISK-0460 (medium, Persistence Or State) in `src/api/routes/monitoring.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L110: cacheHitRate: dashData.summary.cacheHitRate,
- RISK-0461 (low, High Attention File) in `src/api/routes/monitoring.ts`: The digest found several implementation signals worth manual review. Evidence: L6: * - GET /cost     - LLM cost metrics (token usage, budget)
- RISK-0462 (medium, Parser Or Heuristic) in `src/api/routes/pipeline.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L176: const parsed = RenderRequestSchema.safeParse(req.body);
- RISK-0463 (medium, Persistence Or State) in `src/api/routes/pipeline.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L85: // Pipeline state manager (in-memory singleton)
- RISK-0464 (low, High Attention File) in `src/api/routes/pipeline.ts`: The digest found several implementation signals worth manual review. Evidence: L85: // Pipeline state manager (in-memory singleton)
- RISK-0465 (high, Security Boundary) in `src/api/server.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L12: import { authMiddleware, AuthenticatedRequest } from './middleware/auth';
- RISK-0466 (high, Destructive Mutation) in `src/api/server.ts`: Deletion or forceful mutation needs clear guardrails and recovery behavior. Evidence: L30: // ISS-030: Conditional auth — enforced in production, bypassed in dev/test
- RISK-0467 (medium, Concurrency Or Timing) in `src/api/server.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L11: import { requestTimeout } from './middleware/timeout';
- RISK-0468 (medium, Parser Or Heuristic) in `src/api/server.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L37: // JSON body parser — ISS-044: limit from centralized config
- RISK-0469 (low, High Attention File) in `src/api/server.ts`: The digest found several implementation signals worth manual review. Evidence: L11: import { requestTimeout } from './middleware/timeout';
- RISK-0470 (medium, Persistence Or State) in `src/api/startup-warmup.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L2: * REQ-202: Startup cache warmup helper
- RISK-0471 (low, High Attention File) in `src/api/startup-warmup.ts`: The digest found several implementation signals worth manual review. Evidence: L2: * REQ-202: Startup cache warmup helper
- RISK-0472 (high, Security Boundary) in `src/api/websocket-handler.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L11: * - JWT auth middleware on connection
- RISK-0473 (medium, Network Or IPC) in `src/api/websocket-handler.ts`: Cross-process or network boundaries can fail through protocol, timeout, and trust assumptions. Evidence: path contains `socket`
- RISK-0474 (medium, Parser Or Heuristic) in `src/api/websocket-handler.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L15: import * as jwt from 'jsonwebtoken';
- RISK-0475 (low, High Attention File) in `src/api/websocket-handler.ts`: The digest found several implementation signals worth manual review. Evidence: L2: * TASK-0047: WebSocket Real-time Progress Notification

## Files

- `src/api/__tests__/graceful-shutdown.test.ts` — typescript, 166 lines, attention 84
- `src/api/__tests__/server-route-regression.test.ts` — typescript, 132 lines, attention 42
- `src/api/__tests__/server.test.ts` — typescript, 89 lines, attention 0
- `src/api/__tests__/startup-warmup.test.ts` — typescript, 186 lines, attention 100
- `src/api/batch-processing-api.ts` — typescript, 558 lines, attention 100
- `src/api/index.ts` — typescript, 65 lines, attention 42
- `src/api/middleware/__tests__/auth-integration.test.ts` — typescript, 277 lines, attention 100
- `src/api/middleware/__tests__/auth.test.ts` — typescript, 227 lines, attention 100
- `src/api/middleware/__tests__/error-handler.test.ts` — typescript, 258 lines, attention 100
- `src/api/middleware/__tests__/mock-consistency.test.ts` — typescript, 87 lines, attention 100
- `src/api/middleware/auth.ts` — typescript, 56 lines, attention 100
- `src/api/middleware/error-handler.ts` — typescript, 94 lines, attention 100
- `src/api/middleware/rate-limit.ts` — typescript, 31 lines, attention 42
- `src/api/middleware/timeout.ts` — typescript, 42 lines, attention 100
- `src/api/routes/__tests__/monitoring.test.ts` — typescript, 312 lines, attention 100
- `src/api/routes/__tests__/pipeline-auth.test.ts` — typescript, 215 lines, attention 100
- `src/api/routes/__tests__/pipeline-iterations-cap.test.ts` — typescript, 63 lines, attention 0
- `src/api/routes/__tests__/pipeline.test.ts` — typescript, 451 lines, attention 14
- `src/api/routes/batch.ts` — typescript, 370 lines, attention 100
- `src/api/routes/health.ts` — typescript, 15 lines, attention 0
- `src/api/routes/monitoring.ts` — typescript, 127 lines, attention 100
- `src/api/routes/pipeline.ts` — typescript, 274 lines, attention 100
- `src/api/server.ts` — typescript, 81 lines, attention 100
- `src/api/startup-warmup.ts` — typescript, 78 lines, attention 100
- `src/api/websocket-handler.ts` — typescript, 277 lines, attention 100
