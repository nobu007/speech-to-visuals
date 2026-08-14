/**
 * Structural stub for the `whisper-node` npm package.
 *
 * WHY THIS EXISTS. whisper-node's `src/shell.ts` runs `shell.cd(WHISPER_CPP_PATH)`
 * at MODULE LOAD (top-level side effect). `shell.cd` calls `process.chdir()`,
 * which mutates the WHOLE jest worker process — every suite that later runs in
 * the same worker sees a cwd deep inside node_modules, and every cwd-relative
 * `readFileSync('src/...')` / `globSync('src/**')` source-anchor guard then
 * fails with ENOENT. The failure count is nondeterministic (it depends on
 * which suites share the worker), which is exactly the "full suite is red with
 * dozens of unrelated guard failures" pattern. Production code already knows
 * about this hazard — `actualVideoRenderer.ts` walks up out of node_modules
 * "which can happen with whisper-node" — but tests had no defense.
 *
 * Mapping the module to this empty stub (jest.config.cjs moduleNameMapper,
 * same idiom as the dagre mock) keeps the real package (and its chdir, and its
 * top-level `make` / `process.exit(1)` fallback) out of the test process
 * entirely. No repo code consumes the real package under test: the only load
 * site is `whisper-transcriber.ts`'s availability probe
 * (`await import('whisper-node').catch(() => null)`), whose result is
 * discarded, and `whisper-transcriber.test.ts` already mocks it as `{}`.
 */
export {};
