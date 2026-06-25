/**
 * Tests for spine manifest validation.
 *
 * Ensures specs/_doc_spine.yml:
 * - Has all required top-level fields
 * - References only paths that exist on disk
 * - Does not accumulate orphaned spec files
 */

import * as fs from 'fs';
import * as path from 'path';
import { validateSpineManifest, extractPathsFromSpine } from '../scripts/validate-spine-manifest';

const REPO_ROOT = process.cwd();
const SPINE_PATH = path.join(REPO_ROOT, 'specs', '_doc_spine.yml');

describe('Spine Manifest Validation', () => {
  describe('validateSpineManifest', () => {
    it('should return valid=true for current manifest', () => {
      const result = validateSpineManifest();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should check all referenced paths exist', () => {
      const result = validateSpineManifest();
      expect(result.checkedPaths).toBeGreaterThan(0);

      // Every path should exist — no errors
      expect(result.errors.filter((e) => e.includes('does not exist'))).toHaveLength(0);
    });

    it('should have required top-level fields', () => {
      const result = validateSpineManifest();
      expect(result.errors.filter((e) => e.includes('Missing required field'))).toHaveLength(0);
    });

    it('should detect orphaned spec files as warnings (not errors)', () => {
      const result = validateSpineManifest();
      // Orphaned files are warnings, not blocking errors
      // The current manifest may have some orphans — that's OK as long as they're reported
      for (const orphan of result.orphanedFiles) {
        expect(result.warnings.some((w) => w.includes(orphan))).toBe(true);
      }
    });
  });

  describe('extractPathsFromSpine', () => {
    it('should extract path values from list items', () => {
      const yaml = `
entrypoints:
- path: README.md
  audience: contributor
- path: AGENTS.md
  audience: ai-agent
`;
      const paths = extractPathsFromSpine(yaml);
      expect(paths).toContain('README.md');
      expect(paths).toContain('AGENTS.md');
    });

    it('should extract constitution path', () => {
      const yaml = `constitution: SYSTEM_CONSTITUTION.md\npurpose: null`;
      const paths = extractPathsFromSpine(yaml);
      expect(paths).toContain('SYSTEM_CONSTITUTION.md');
    });

    it('should handle null constitution gracefully', () => {
      const yaml = `constitution: null\npurpose: null`;
      const paths = extractPathsFromSpine(yaml);
      expect(paths).not.toContain('null');
    });

    it('should deduplicate paths', () => {
      const yaml = `
entrypoints:
- path: README.md
system_design:
- path: README.md
`;
      const paths = extractPathsFromSpine(yaml);
      expect(paths.filter((p) => p === 'README.md')).toHaveLength(1);
    });

    it('should extract nested children paths', () => {
      const yaml = `
system_design:
- path: architecture.md
  children:
  - path: acceptance-criteria.md
  - path: dataflow.md
`;
      const paths = extractPathsFromSpine(yaml);
      expect(paths).toContain('architecture.md');
      expect(paths).toContain('acceptance-criteria.md');
      expect(paths).toContain('dataflow.md');
    });
  });

  describe('Spine manifest file structure', () => {
    let spineContent: string;

    beforeAll(() => {
      spineContent = fs.readFileSync(SPINE_PATH, 'utf-8');
    });

    it('should exist as a file', () => {
      expect(fs.existsSync(SPINE_PATH)).toBe(true);
    });

    it('should have constitution field', () => {
      expect(spineContent).toMatch(/^constitution:\s*\S+/m);
    });

    it('should have entrypoints section', () => {
      expect(spineContent).toMatch(/^entrypoints:/m);
    });

    it('should have system_design section', () => {
      expect(spineContent).toMatch(/^system_design:/m);
    });

    it('should have at least one entrypoint with audience', () => {
      expect(spineContent).toMatch(/audience:\s*\S+/);
    });

    it('should reference SYSTEM_CONSTITUTION.md', () => {
      expect(spineContent).toContain('SYSTEM_CONSTITUTION.md');
    });

    it('should reference architecture.md in system_design', () => {
      expect(spineContent).toContain('architecture.md');
    });

    it('should not contain task file references (TASK-*.md)', () => {
      // Per spine rules, TASK-*.md files should NOT be in the spine
      expect(spineContent).not.toMatch(/TASK-\d+\.md/);
    });
  });

  describe('All spine-referenced paths exist on disk', () => {
    it('should verify every path exists', () => {
      const content = fs.readFileSync(SPINE_PATH, 'utf-8');
      const paths = extractPathsFromSpine(content);

      const missing: string[] = [];
      for (const relPath of paths) {
        const rootPath = path.join(REPO_ROOT, relPath);
        const specsPath = path.join(REPO_ROOT, 'specs', relPath);
        if (!fs.existsSync(rootPath) && !fs.existsSync(specsPath)) {
          missing.push(relPath);
        }
      }

      expect(missing).toEqual([]);
    });
  });
});
