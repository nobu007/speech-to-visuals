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
import { validateSpineManifest, extractPathsFromSpine, validateSpineSchema, parseSpineSections } from '../scripts/validate-spine-manifest';

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

  describe('validateSpineSchema', () => {
    it('should return no errors for the current spine manifest', () => {
      const content = fs.readFileSync(SPINE_PATH, 'utf-8');
      const errors = validateSpineSchema(content);
      expect(errors).toEqual([]);
    });

    it('should detect entrypoint missing path', () => {
      const yaml = `entrypoints:\n  - audience: contributor\n`;
      const errors = validateSpineSchema(yaml);
      expect(errors.some((e) => e.includes("missing required key 'path'"))).toBe(true);
    });

    it('should detect entrypoint missing audience', () => {
      const yaml = `entrypoints:\n  - path: README.md\n`;
      const errors = validateSpineSchema(yaml);
      expect(errors.some((e) => e.includes("missing required key 'audience'"))).toBe(true);
    });

    it('should detect system_design item missing path', () => {
      const yaml = `system_design:\n  - children:\n`;
      const errors = validateSpineSchema(yaml);
      expect(errors.some((e) => e.includes("missing required key 'path'"))).toBe(true);
    });

    it('should detect reference missing doc', () => {
      const yaml = `references:\n  - referenced_by:\n    - architecture.md\n`;
      const errors = validateSpineSchema(yaml);
      expect(errors.some((e) => e.includes("missing required key 'doc'"))).toBe(true);
    });

    it('should accept a well-formed manifest', () => {
      const yaml = [
        'constitution: SYSTEM_CONSTITUTION.md',
        'purpose: null',
        'entrypoints:',
        '  - path: README.md',
        '    audience: contributor',
        'system_design:',
        '  - path: architecture.md',
        '    children:',
        '      - path: acceptance-criteria.md',
        'references:',
        '  - doc: api-endpoints.md',
        '    referenced_by:',
        '      - architecture.md',
      ].join('\n');
      const errors = validateSpineSchema(yaml);
      expect(errors).toEqual([]);
    });

    it('should be integrated into validateSpineManifest results', () => {
      const result = validateSpineManifest();
      expect(result.schemaErrors).toBeDefined();
      expect(Array.isArray(result.schemaErrors)).toBe(true);
      // Current manifest should have zero schema errors
      expect(result.schemaErrors).toHaveLength(0);
    });
  });

  describe('parseSpineSections', () => {
    it('should parse entrypoints with path and audience', () => {
      const yaml = [
        'entrypoints:',
        '  - path: README.md',
        '    audience: contributor',
        '  - path: AGENTS.md',
        '    audience: ai-agent',
      ].join('\n');
      const sections = parseSpineSections(yaml);
      expect(sections.entrypoints).toHaveLength(2);
      expect(sections.entrypoints[0].path).toBe('README.md');
      expect(sections.entrypoints[0].audience).toBe('contributor');
      expect(sections.entrypoints[1].path).toBe('AGENTS.md');
    });

    it('should parse system_design with children', () => {
      const yaml = [
        'system_design:',
        '  - path: architecture.md',
        '    children:',
        '      - path: acceptance-criteria.md',
        '      - path: dataflow.md',
      ].join('\n');
      const sections = parseSpineSections(yaml);
      expect(sections.systemDesign).toHaveLength(1);
      expect(sections.systemDesign[0].path).toBe('architecture.md');
      expect(sections.systemDesign[0].children).toHaveLength(2);
      expect(sections.systemDesign[0].children![0].path).toBe('acceptance-criteria.md');
      expect(sections.systemDesign[0].children![1].path).toBe('dataflow.md');
    });

    it('should parse references with doc key', () => {
      const yaml = [
        'references:',
        '  - doc: api-endpoints.md',
        '    referenced_by:',
        '      - architecture.md',
      ].join('\n');
      const sections = parseSpineSections(yaml);
      expect(sections.references).toHaveLength(1);
      expect(sections.references[0].doc).toBe('api-endpoints.md');
    });

    it('should parse the actual spine manifest', () => {
      const content = fs.readFileSync(SPINE_PATH, 'utf-8');
      const sections = parseSpineSections(content);
      expect(sections.entrypoints.length).toBeGreaterThanOrEqual(3);
      expect(sections.systemDesign.length).toBeGreaterThanOrEqual(1);
      // All entrypoints should have both path and audience
      sections.entrypoints.forEach((ep) => {
        expect(ep.path).toBeDefined();
        expect(ep.audience).toBeDefined();
      });
    });
  });
});
