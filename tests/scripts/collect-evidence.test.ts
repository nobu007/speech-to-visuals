/**
 * collect-evidence.test.ts — TC-323 (Phase 140, REQ-326).
 *
 * The evidence runner's contract is what specs will quote: a greppable
 * [EVIDENCE] line with local-ISO timestamps, 2-decimal elapsed seconds, the
 * propagated exit code, and shell-copyable command text. A line that drifts
 * out of this shape breaks the "claims cite execution output" convention, so
 * the shape itself is pinned here.
 *
 * Also pins the two failure behaviors that would silently corrupt evidence:
 *   - spawn failure must report exit=127 (never a silent exit=0 line);
 *   - bad argv must exit 2 with a usage message (never run a half-parsed
 *     command like "--label" being executed as the command).
 */
import { describe, it, expect } from '@jest/globals';
import {
  EVIDENCE_LINE_RE,
  formatEvidenceLine,
  isoLocalWithOffset,
  parseEvidenceArgv,
  runEvidenceSync,
  shellJoin,
  shellQuote,
  type EvidenceRecord,
} from '../../scripts/collect-evidence';

const baseRecord: EvidenceRecord = {
  startedAt: new Date('2026-08-19T14:03:11+09:00'),
  endedAt: new Date('2026-08-19T14:04:28.21+09:00'),
  exitCode: 0,
  command: ['npm', 'test'],
  commit: '97fa0c24',
  branch: 'main',
};

describe('isoLocalWithOffset', () => {
  it('renders local-time ISO 8601 with a numeric offset', () => {
    const date = new Date('2026-08-19T05:03:11Z'); // renders in this process's TZ
    const rendered = isoLocalWithOffset(date);
    expect(rendered).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
    expect(new Date(rendered).getTime()).toBe(date.getTime()); // round-trips
  });
});

describe('shellQuote / shellJoin', () => {
  it('leaves plain words unquoted', () => {
    expect(shellQuote('npm')).toBe('npm');
    expect(shellQuote('--testPathPatterns=x')).toBe('--testPathPatterns=x');
    expect(shellJoin(['npm', 'test', '--', '--shard=1/4'])).toBe('npm test -- --shard=1/4');
  });

  it('quotes words with spaces and escapes embedded single quotes', () => {
    expect(shellQuote('two words')).toBe("'two words'");
    expect(shellQuote("it's")).toBe("'it'\\''s'");
    expect(shellJoin(['node', '-e', 'process.exit(3)'])).toBe("node -e 'process.exit(3)'");
  });

  it('quotes the empty argument (it is a real argv slot, not absence)', () => {
    expect(shellQuote('')).toBe("''");
  });
});

describe('formatEvidenceLine (TC-323 shape pin)', () => {
  it('emits a line matching EVIDENCE_LINE_RE with 2-decimal elapsed_s', () => {
    const line = formatEvidenceLine(baseRecord);
    // 14:03:11 → 14:04:28.21 = 77.21s
    expect(line).toBe(
      '[EVIDENCE] started=2026-08-19T14:03:11+09:00 ended=2026-08-19T14:04:28+09:00 ' +
        'exit=0 elapsed_s=77.21 cmd=npm test commit=97fa0c24 branch=main',
    );
    expect(line).toMatch(EVIDENCE_LINE_RE);
    expect(line.startsWith('[EVIDENCE] ')).toBe(true);
  });

  it('includes the label slot only when a label is given', () => {
    const withLabel = formatEvidenceLine({ ...baseRecord, label: 'full-suite' });
    expect(withLabel).toContain(' label=full-suite cmd=npm test');
    expect(withLabel).toMatch(EVIDENCE_LINE_RE);

    const withoutLabel = formatEvidenceLine(baseRecord);
    expect(withoutLabel).not.toContain('label=');
    expect(withoutLabel).toMatch(EVIDENCE_LINE_RE);
  });

  it('quotes a command that needs quoting and still matches the line regex', () => {
    const line = formatEvidenceLine({
      ...baseRecord,
      command: ['npx', 'tsx', 'scripts/collect-evidence.ts', '--', 'node', '-e', 'process.exit(3)'],
    });
    expect(line).toContain("cmd=npx tsx scripts/collect-evidence.ts -- node -e 'process.exit(3)'");
    expect(line).toMatch(EVIDENCE_LINE_RE);
  });

  it('renders a spawn-failure record as exit=127 (never silent success)', () => {
    const line = formatEvidenceLine({ ...baseRecord, exitCode: 127 });
    expect(line).toContain('exit=127');
    expect(line).toMatch(EVIDENCE_LINE_RE);
  });
});

describe('parseEvidenceArgv', () => {
  it('splits label and command around the -- separator', () => {
    expect(parseEvidenceArgv(['--label=x', '--', 'npm', 'test'])).toEqual({
      label: 'x',
      command: ['npm', 'test'],
    });
  });

  it('accepts a bare command with no separator and no label', () => {
    expect(parseEvidenceArgv(['npm', 'run', 'verify:all'])).toEqual({
      label: undefined,
      command: ['npm', 'run', 'verify:all'],
    });
  });

  it('rejects unknown options and empty commands instead of half-running them', () => {
    expect(parseEvidenceArgv(['--oops=1', '--', 'npm', 'test'])).toEqual({
      error: 'unknown option: --oops=1',
    });
    expect(parseEvidenceArgv(['--'])).toHaveProperty('error');
    expect(parseEvidenceArgv([])).toHaveProperty('error');
  });
});

describe('runEvidenceSync (end-to-end against node)', () => {
  it('propagates a non-zero child exit code into exit= and the return value', () => {
    const result = runEvidenceSync(['node', '-e', 'process.exit(3)'], { stdio: 'pipe' });
    expect(result.exitCode).toBe(3);
    expect(result.line).toContain('exit=3');
    expect(result.line).toMatch(EVIDENCE_LINE_RE);
  });

  it('measures elapsed around the child only (>= the child sleep)', () => {
    const result = runEvidenceSync(['node', '-e', 'setTimeout(() => process.exit(0), 120)'], {
      stdio: 'pipe',
    });
    const elapsedS = Number(/ elapsed_s=(\d+\.\d{2}) /.exec(result.line)?.[1]);
    expect(Number.isFinite(elapsedS)).toBe(true);
    expect(elapsedS).toBeGreaterThanOrEqual(0.12);
  });

  it('reports exit=127 for a command that cannot spawn', () => {
    const result = runEvidenceSync(['definitely-not-a-real-command-xyz'], { stdio: 'pipe' });
    expect(result.exitCode).toBe(127);
    expect(result.line).toContain('exit=127');
  });
});
