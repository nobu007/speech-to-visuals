/**
 * Spine Manifest Validator
 *
 * Validates specs/_doc_spine.yml by:
 * 1. Parsing all referenced paths from the manifest
 * 2. Verifying every path exists on disk
 * 3. Detecting orphaned spec files not referenced by the manifest
 * 4. Validating YAML schema (required keys for each section)
 *
 * Usage: tsx scripts/validate-spine-manifest.ts
 * Exit code: 0 = valid, 1 = errors found
 */

import * as fs from 'fs';
import * as path from 'path';

export interface SpineValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  checkedPaths: number;
  orphanedFiles: string[];
  schemaErrors: string[];
}

/** Resolve repo root from process.cwd() (works in both CLI and test contexts). */
function getRepoRoot(): string {
  return process.cwd();
}

function getSpinePath(): string {
  return path.join(getRepoRoot(), 'specs', '_doc_spine.yml');
}

function getSpecsDir(): string {
  return path.join(getRepoRoot(), 'specs');
}

/** Extract all path: values from the spine YAML. */
export function extractPathsFromSpine(content: string): string[] {
  const paths: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    // Match lines like "- path: speech-to-visuals/architecture.md"
    const match = line.match(/^\s*-\s*path:\s*(.+)$/);
    if (match) {
      const p = match[1].trim();
      if (p && !p.startsWith('null')) {
        paths.push(p);
      }
    }
    // Match lines like "  path: speech-to-visuals/architecture.md" (inline within a list item)
    const inlineMatch = line.match(/^\s+path:\s*(.+)$/);
    if (inlineMatch && !line.includes('- path:')) {
      const p = inlineMatch[1].trim();
      if (p && !p.startsWith('null')) {
        paths.push(p);
      }
    }
    // Match references section: "- doc: speech-to-visuals/api-endpoints.md"
    const docMatch = line.match(/^\s*-\s*doc:\s*(.+)$/);
    if (docMatch) {
      const p = docMatch[1].trim();
      if (p && !p.startsWith('null')) {
        paths.push(p);
      }
    }
  }

  // Also extract constitution path
  const constitutionMatch = content.match(/^constitution:\s*(.+)$/m);
  if (constitutionMatch) {
    const p = constitutionMatch[1].trim();
    if (p && p !== 'null') {
      paths.push(p);
    }
  }

  return [...new Set(paths)]; // deduplicate
}

/** Parse a minimal YAML-like structure for spine entries (avoids full YAML dependency). */
interface SpineEntry {
  path?: string;
  audience?: string;
  doc?: string;
  children?: SpineEntry[];
  referenced_by?: string[];
}

/** Map YAML section name to result key. */
const SECTION_MAP: Record<string, 'entrypoints' | 'systemDesign' | 'references'> = {
  entrypoints: 'entrypoints',
  system_design: 'systemDesign',
  references: 'references',
};

/** Parse entrypoints / system_design / references sections from spine YAML. */
export function parseSpineSections(content: string): {
  entrypoints: SpineEntry[];
  systemDesign: SpineEntry[];
  references: SpineEntry[];
} {
  const result = { entrypoints: [] as SpineEntry[], systemDesign: [] as SpineEntry[], references: [] as SpineEntry[] };
  const lines = content.split('\n');

  let currentKey: 'entrypoints' | 'systemDesign' | 'references' | null = null;
  let currentEntry: SpineEntry | null = null;
  let inChildren = false;

  for (const line of lines) {
    // Top-level section detection
    const sectionMatch = line.match(/^(entrypoints|system_design|references):\s*$/);
    if (sectionMatch) {
      currentKey = SECTION_MAP[sectionMatch[1]];
      currentEntry = null;
      inChildren = false;
      continue;
    }

    // Other top-level fields (constitution, purpose) end section
    if (/^[a-z_]+:/.test(line) && !line.startsWith(' ')) {
      currentKey = null;
      currentEntry = null;
      inChildren = false;
      continue;
    }

    if (!currentKey) continue;

    // New list item at section level (dash at any indent 0-4)
    const itemMatch = line.match(/^(?: {0,4})-\s+(\w+):\s*(.*)$/);
    if (itemMatch) {
      inChildren = false;
      currentEntry = {};
      const key = itemMatch[1] as keyof SpineEntry;
      (currentEntry as Record<string, unknown>)[key] = itemMatch[2].trim();
      result[currentKey].push(currentEntry);
      continue;
    }

    // Property of current entry (indented, not a list item)
    const propMatch = line.match(/^(?: {2,6})(\w+):\s*(.+)$/);
    if (propMatch && currentEntry) {
      const key = propMatch[1] as keyof SpineEntry;
      const val = propMatch[2].trim();
      if (key === 'children') {
        inChildren = true;
      } else {
        (currentEntry as Record<string, unknown>)[key] = val;
      }
      continue;
    }

    // Children item (indented dash + path)
    const childMatch = line.match(/^(?: {2,6})-\s+path:\s*(.+)$/);
    if (childMatch && currentEntry) {
      if (!currentEntry.children) currentEntry.children = [];
      currentEntry.children.push({ path: childMatch[1].trim() });
      continue;
    }

    // referenced_by items (indented dash)
    const refByMatch = line.match(/^(?: {2,6})-\s+(.+)$/);
    if (refByMatch && currentEntry && inChildren === false) {
      if (!currentEntry.referenced_by) currentEntry.referenced_by = [];
      currentEntry.referenced_by.push(refByMatch[1].trim());
      continue;
    }
  }

  return result;
}

/** Validate the structural schema of spine entries. Returns list of schema errors. */
export function validateSpineSchema(content: string): string[] {
  const errors: string[] = [];
  const sections = parseSpineSections(content);

  // Entrypoints: must have 'path' and 'audience'
  for (let i = 0; i < sections.entrypoints.length; i++) {
    const ep = sections.entrypoints[i];
    if (!ep.path) {
      errors.push(`entrypoints[${i}]: missing required key 'path'`);
    }
    if (!ep.audience) {
      errors.push(`entrypoints[${i}] (${ep.path ?? '?'}): missing required key 'audience'`);
    }
  }

  // System design items: must have 'path'
  for (let i = 0; i < sections.systemDesign.length; i++) {
    const sd = sections.systemDesign[i];
    if (!sd.path) {
      errors.push(`system_design[${i}]: missing required key 'path'`);
    }
    // Children (if present): must have 'path'
    if (sd.children) {
      for (let j = 0; j < sd.children.length; j++) {
        if (!sd.children[j].path) {
          errors.push(`system_design[${i}].children[${j}]: missing required key 'path'`);
        }
      }
    }
  }

  // References: must have 'doc'
  for (let i = 0; i < sections.references.length; i++) {
    const ref = sections.references[i];
    if (!ref.doc) {
      errors.push(`references[${i}]: missing required key 'doc'`);
    }
  }

  return errors;
}

/** Get all .md files under specs/ directory recursively. */
function getAllSpecFiles(): string[] {
  const results: string[] = [];

  function walk(dir: string, prefix: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        walk(fullPath, relPath);
      } else if (entry.name.endsWith('.md') && entry.name !== '_doc_spine.yml') {
        results.push(`specs/${relPath}`);
      }
    }
  }

  walk(getSpecsDir(), '');
  return results;
}

/** Main validation function. */
export function validateSpineManifest(): SpineValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const spinePath = getSpinePath();
  const repoRoot = getRepoRoot();

  // 1. Check spine file exists
  if (!fs.existsSync(spinePath)) {
    return {
      valid: false,
      errors: [`specs/_doc_spine.yml not found at ${spinePath}`],
      warnings: [],
      checkedPaths: 0,
      orphanedFiles: [],
      schemaErrors: [],
    };
  }

  const content = fs.readFileSync(spinePath, 'utf-8');

  // 2. Check required top-level fields
  const requiredFields = ['constitution', 'entrypoints', 'system_design', 'references'];
  for (const field of requiredFields) {
    const regex = new RegExp(`^${field}:`, 'm');
    if (!regex.test(content)) {
      errors.push(`Missing required field: '${field}'`);
    }
  }

  // 3. Schema validation — check required keys per section
  const schemaErrors = validateSpineSchema(content);
  errors.push(...schemaErrors);

  // 4. Extract and validate all paths
  // Paths are resolved relative to repo root first, then specs/ as fallback
  const referencedPaths = extractPathsFromSpine(content);

  for (const relPath of referencedPaths) {
    const rootPath = path.join(repoRoot, relPath);
    const specsPath = path.join(repoRoot, 'specs', relPath);
    if (!fs.existsSync(rootPath) && !fs.existsSync(specsPath)) {
      errors.push(`Referenced path does not exist: ${relPath} (checked both ${relPath} and specs/${relPath})`);
    }
  }

  // 5. Detect orphaned spec files (md files in specs/ not referenced by spine)
  const allSpecFiles = getAllSpecFiles();
  const orphanedFiles: string[] = [];

  // Normalize spine paths for comparison
  // Spine paths may be relative to repo root or specs/ — normalize both
  const normalizedSpinePaths = new Set<string>();
  for (const p of referencedPaths) {
    normalizedSpinePaths.add(p);
    normalizedSpinePaths.add(p.replace(/^specs\//, ''));
    normalizedSpinePaths.add(`specs/${p}`);
  }

  for (const specFile of allSpecFiles) {
    const relToSpecs = specFile.replace(/^specs\//, '');
    // Skip task files (TASK-*.md) — they're transitively referenced via tasks/overview.md
    if (relToSpecs.match(/tasks\/TASK-\d+\.md$/)) continue;
    // Skip overview.md — it's referenced as a child of architecture.md
    if (relToSpecs.endsWith('tasks/overview.md')) continue;
    // The spine references it as speech-to-visuals/tasks/overview.md
    if (!normalizedSpinePaths.has(relToSpecs)) {
      orphanedFiles.push(specFile);
    }
  }

  if (orphanedFiles.length > 0) {
    warnings.push(
      `${orphanedFiles.length} spec file(s) not referenced in spine manifest: ${orphanedFiles.join(', ')}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    checkedPaths: referencedPaths.length,
    orphanedFiles,
    schemaErrors,
  };
}

// CLI entry point — guarded so tests can import this module safely
const isMainModule = process.argv[1] && path.basename(process.argv[1]) === 'validate-spine-manifest.ts';
if (isMainModule) {
  const result = validateSpineManifest();

  console.log(`\n=== Spine Manifest Validation ===`);
  console.log(`Checked paths: ${result.checkedPaths}`);
  console.log(`Errors: ${result.errors.length}`);
  console.log(`Warnings: ${result.warnings.length}`);

  if (result.schemaErrors.length > 0) {
    console.log(`Schema errors: ${result.schemaErrors.length}`);
  }

  if (result.errors.length > 0) {
    console.log('\n\u274c ERRORS:');
    for (const err of result.errors) {
      console.log(`  - ${err}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log('\n\u26a0\ufe0f  WARNINGS:');
    for (const warn of result.warnings) {
      console.log(`  - ${warn}`);
    }
  }

  if (result.valid) {
    console.log('\n\u2705 Spine manifest is valid.');
    process.exit(0);
  } else {
    console.log('\n\u274c Spine manifest validation FAILED.');
    process.exit(1);
  }
}
