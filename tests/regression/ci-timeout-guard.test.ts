/**
 * Regression test: CI workflow timeout-minutes configuration (REQ-254).
 *
 * Verifies that every job in .github/workflows/ci.yml has a timeout-minutes
 * property set, preventing runaway CI jobs from consuming excessive runner time.
 * Also verifies that ELAPSED timing instrumentation is present.
 */

import * as fs from 'fs';
import * as path from 'path';

function parseYamlJobs(yamlContent: string): Map<string, string> {
  const jobs = new Map<string, string>();
  const lines = yamlContent.split('\n');

  let inJobsSection = false;
  let currentJob: string | null = null;
  let currentIndent = -1;

  for (const line of lines) {
    // Find "jobs:" at top level
    if (/^jobs:/.test(line)) {
      inJobsSection = true;
      continue;
    }

    if (!inJobsSection) continue;

    // Job name lines are indented exactly 2 spaces with no further indentation
    const jobMatch = line.match(/^  (\S+):/);
    if (jobMatch) {
      currentJob = jobMatch[1];
      currentIndent = 2;
      jobs.set(currentJob, line);
      continue;
    }

    // Collect lines for current job to check for timeout-minutes
    if (currentJob && line.startsWith('  ') && !line.startsWith('    ')) {
      // This is a direct property of the job
      if (/^  \S/.test(line)) {
        // Could be a new property or a nested key
      }
    }
  }

  return jobs;
}

function extractJobBlocks(yamlContent: string): Map<string, string[]> {
  const jobBlocks = new Map<string, string[]>();
  const lines = yamlContent.split('\n');

  let inJobsSection = false;
  let currentJob: string | null = null;
  let jobLines: string[] = [];
  let jobIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^jobs:/.test(line)) {
      inJobsSection = true;
      continue;
    }

    if (!inJobsSection) continue;

    // Detect job headers (2-space indent, name followed by colon, not a comment)
    if (/^\s*#/.test(line)) continue;
    const jobMatch = line.match(/^( {2})(\S[^:]*):(?:\s|$)/);
    if (jobMatch) {
      // Save previous job
      if (currentJob && jobLines.length > 0) {
        jobBlocks.set(currentJob, jobLines);
      }
      currentJob = jobMatch[2];
      jobIndent = jobMatch[1].length;
      jobLines = [line];
      continue;
    }

    if (currentJob !== null) {
      // Check if this line belongs to the current job (indented more than job level)
      if (line.startsWith('  ') && line.trim() !== '') {
        jobLines.push(line);
      } else if (line.trim() === '') {
        jobLines.push(line);
      } else {
        // End of jobs section or new top-level key
        if (currentJob && jobLines.length > 0) {
          jobBlocks.set(currentJob, jobLines);
        }
        currentJob = null;
        jobLines = [];
      }
    }
  }

  // Save last job
  if (currentJob && jobLines.length > 0) {
    jobBlocks.set(currentJob, jobLines);
  }

  return jobBlocks;
}

describe('REQ-254: CI timeout-minutes configuration', () => {
  const projectRoot = path.resolve(__dirname, '../../');
  const ciYmlPath = path.join(projectRoot, '.github', 'workflows', 'ci.yml');

  test('ci.yml exists', () => {
    expect(fs.existsSync(ciYmlPath)).toBe(true);
  });

  test('every job in ci.yml has timeout-minutes set', () => {
    const content = fs.readFileSync(ciYmlPath, 'utf-8');
    const jobBlocks = extractJobBlocks(content);

    expect(jobBlocks.size).toBeGreaterThanOrEqual(9); // at least 9 jobs

    const missing: string[] = [];
    for (const [jobName, lines] of jobBlocks) {
      // Check if any line in this job block has timeout-minutes
      const hasTimeout = lines.some(l => /^\s+timeout-minutes\s*:/.test(l));
      if (!hasTimeout) {
        missing.push(jobName);
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `Jobs missing timeout-minutes: ${missing.join(', ')}.\n` +
        'Every CI job must have timeout-minutes set per REQ-254.'
      );
    }
  });

  test('timeout-minutes values are within reasonable bounds', () => {
    const content = fs.readFileSync(ciYmlPath, 'utf-8');
    const timeoutMatches = content.matchAll(/timeout-minutes\s*:\s*(\d+)/g);

    for (const match of timeoutMatches) {
      const value = parseInt(match[1], 10);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(60);
    }
  });

  test('ELAPSED timing instrumentation is present in at least one job', () => {
    const content = fs.readFileSync(ciYmlPath, 'utf-8');
    // Check for ELAPSED pattern in the workflow
    expect(content).toContain('ELAPSED');
    expect(content).toContain('START=$(date +%s)');
    expect(content).toContain('END=$(date +%s)');
  });

  test('budget_exceeded flag mechanism is present', () => {
    const content = fs.readFileSync(ciYmlPath, 'utf-8');
    expect(content).toContain('budget_exceeded');
    expect(content).toContain('THRESHOLD');
  });

  test('gate job enforces budget_exceeded from all timed jobs', () => {
    const content = fs.readFileSync(ciYmlPath, 'utf-8');

    // The gate job must check budget_exceeded outputs, not just print a message.
    // REQ-254 enforcement: informational ::warning is insufficient;
    // the gate must exit 1 if any job's budget_exceeded is "true".
    const gateJobStart = content.indexOf('all-checks-pass:');
    expect(gateJobStart).toBeGreaterThan(-1);

    const gateJobSection = content.slice(gateJobStart);

    // Must reference budget_exceeded from needs context
    expect(gateJobSection).toContain('budget_exceeded');

    // Must have an exit 1 path when budget is exceeded
    expect(gateJobSection).toContain('exit 1');

    // Must reference the outputs from individual jobs
    expect(gateJobSection).toContain('needs.code-size-audit.outputs.budget_exceeded');
    expect(gateJobSection).toContain('needs.lint.outputs.budget_exceeded');
    expect(gateJobSection).toContain('needs.test.outputs.budget_exceeded');
    expect(gateJobSection).toContain('needs.build.outputs.budget_exceeded');
    expect(gateJobSection).toContain('needs.security-fuzz.outputs.budget_exceeded');
    expect(gateJobSection).toContain('needs.spine-validate.outputs.budget_exceeded');

    // Must NOT be a passive "just print success" step (the old behavior)
    // If the step body contains only echo lines without conditional logic, it's passive.
    const assertStepStart = gateJobSection.indexOf('Assert no job exceeded time budget');
    const assertStepSection = gateJobSection.slice(assertStepStart);
    expect(assertStepSection).toContain('check_budget');
    expect(assertStepSection).toContain('BUDGET_FAILURES');
  });
});

describe('REQ-254: Infrastructure workflow timeout-minutes', () => {
  const projectRoot = path.resolve(__dirname, '../../');
  const infraYmlPath = path.join(projectRoot, '.github', 'workflows', 'infrastructure.yml');

  test('infrastructure.yml exists', () => {
    expect(fs.existsSync(infraYmlPath)).toBe(true);
  });

  test('every job in infrastructure.yml has timeout-minutes set', () => {
    const content = fs.readFileSync(infraYmlPath, 'utf-8');
    const jobBlocks = extractJobBlocks(content);

    const missing: string[] = [];
    for (const [jobName, lines] of jobBlocks) {
      const hasTimeout = lines.some(l => /^\s+timeout-minutes\s*:/.test(l));
      if (!hasTimeout) {
        missing.push(jobName);
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `Infrastructure jobs missing timeout-minutes: ${missing.join(', ')}`
      );
    }
  });
});
