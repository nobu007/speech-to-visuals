/**
 * Evidence runner: wraps any command and prints ONE greppable, timestamped
 * measurement line so performance/quantity claims in specs cite actual
 * execution output instead of commit-message prose.
 *
 * Phase 140 (REQ-326 / TC-323). The steering feedback for the previous
 * round noted that claims like "690s → 79s" or "CI ~4-5min" lived only in
 * commit messages — nothing on disk tied the number to a run. This script
 * is the canonical way to produce that tie: run the command through it and
 * paste the emitted [EVIDENCE] line into the spec / interview-record.
 *
 * Usage:
 *   npm run evidence -- --label=full-suite npm test
 *   npx tsx scripts/collect-evidence.ts -- npm run verify:all
 *
 * Output (child stdio passes through untouched, then):
 *   [EVIDENCE] started=2026-08-19T14:03:11+09:00 ended=2026-08-19T14:04:28+09:00 \
 *     exit=0 elapsed_s=77.21 label=full-suite cmd=npm test commit=97fa0c24 branch=main
 *
 * Contract (pinned by tests/scripts/collect-evidence.test.ts):
 *   - the line starts with "[EVIDENCE] " (grep '^\[EVIDENCE\]' friendly);
 *   - timestamps are local-time ISO 8601 with numeric offset (matches the
 *     JST-stamped CI logs this repo already quotes);
 *   - elapsed_s carries 2 decimals, measured around the child process only;
 *   - exit code is PROPAGATED as the process exit code, and exit=127 marks
 *     a spawn failure (never a silent success).
 */

import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** Fields of one evidence line. `command` is argv (unquoted). */
export interface EvidenceRecord {
  startedAt: Date;
  endedAt: Date;
  /** Child exit code; 127 for spawn failure. */
  exitCode: number;
  command: readonly string[];
  label?: string;
  commit: string;
  branch: string;
}

/** Greppable prefix every evidence line starts with. */
export const EVIDENCE_LINE_PREFIX = '[EVIDENCE]';

/** Matches a well-formed evidence line (used by tests and spec audits). */
export const EVIDENCE_LINE_RE =
  /^\[EVIDENCE\] started=\S+ ended=\S+ exit=\d+ elapsed_s=\d+\.\d{2}( label=\S+)? cmd=.+ commit=\S+ branch=\S+$/;

/** Local-time ISO 8601 with numeric offset: 2026-08-19T14:03:11+09:00 */
export function isoLocalWithOffset(date: Date): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMinutes);
  const offset = `${sign}${pad(Math.floor(absOffset / 60))}:${pad(absOffset % 60)}`;
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${offset}`
  );
}

/** POSIX shell quoting: quote only when the argument is not already one word. */
export function shellQuote(arg: string): string {
  if (arg !== '' && /^[-A-Za-z0-9_@%+=:,./]+$/.test(arg)) return arg;
  // ES2020 lib: replaceAll needs es2021 — plain regex replace keeps the
  // script compilable under the repo's tsconfig.test.json target.
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

/** Render argv as a shell-copyable command string. */
export function shellJoin(argv: readonly string[]): string {
  return argv.map(shellQuote).join(' ');
}

/** The single greppable measurement line. */
export function formatEvidenceLine(record: EvidenceRecord): string {
  const elapsedS = (record.endedAt.getTime() - record.startedAt.getTime()) / 1000;
  const label = record.label !== undefined ? ` label=${shellQuote(record.label)}` : '';
  return (
    `${EVIDENCE_LINE_PREFIX} started=${isoLocalWithOffset(record.startedAt)}` +
    ` ended=${isoLocalWithOffset(record.endedAt)}` +
    ` exit=${record.exitCode}` +
    ` elapsed_s=${elapsedS.toFixed(2)}` +
    `${label}` +
    ` cmd=${shellJoin(record.command)}` +
    ` commit=${record.commit}` +
    ` branch=${shellQuote(record.branch)}`
  );
}

/** Result of one runEvidence call (stdio:'pipe' captures the line). */
export interface EvidenceRunResult {
  exitCode: number;
  line: string;
}

/** Spawn failure marker (127 = command not found, never silent success). */
export const SPAWN_FAILURE_EXIT = 127;

export function runEvidenceSync(
  argv: readonly string[],
  options: { stdio: 'inherit' | 'pipe'; env?: NodeJS.ProcessEnv } = { stdio: 'inherit' },
): EvidenceRunResult {
  const startedAt = new Date();
  const child = spawnSync(argv[0], argv.slice(1), {
    stdio: options.stdio,
    env: options.env ?? process.env,
    encoding: 'utf8',
  });
  const endedAt = new Date();
  const exitCode =
    child.status ?? (child.signal !== null ? 128 + 15 : SPAWN_FAILURE_EXIT);

  const commit =
    spawnSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).stdout?.trim() ||
    'unknown';
  const branch =
    spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).stdout?.trim() ||
    'unknown';

  const line = formatEvidenceLine({
    startedAt,
    endedAt,
    exitCode,
    command: argv,
    commit,
    branch,
  });
  // With stdio 'pipe' the child's own output stays here; print it so a
  // captured run keeps both the measurement line and the tail of the log.
  if (options.stdio === 'pipe' && typeof child.stdout === 'string' && child.stdout.length > 0) {
    process.stdout.write(child.stdout);
  }
  process.stdout.write(`${line}\n`);
  return { exitCode, line };
}

/** Parse `tsx collect-evidence.ts [--label=x] -- cmd args…` into argv. */
export function parseEvidenceArgv(
  args: readonly string[],
): { label?: string; command: string[] } | { error: string } {
  const command = [...args];
  let label: string | undefined;
  while (command.length > 0 && command[0].startsWith('--') && command[0] !== '--') {
    const flag = command.shift() as string;
    if (flag.startsWith('--label=')) label = flag.slice('--label='.length);
    else return { error: `unknown option: ${flag}` };
  }
  if (command[0] === '--') command.shift();
  if (command.length === 0) {
    return { error: 'no command given — usage: collect-evidence.ts [--label=x] -- <command> [args…]' };
  }
  return { label, command };
}

const isMain =
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const parsed = parseEvidenceArgv(process.argv.slice(2));
  if ('error' in parsed) {
    process.stderr.write(`${parsed.error}\n`);
    process.exit(2);
  }
  const result = runEvidenceSync(parsed.command, { stdio: 'inherit' });
  process.exit(result.exitCode);
}
