/**
 * Spine Manifest Validator
 *
 * Validates specs/_doc_spine.yml by:
 * 1. Parsing all referenced paths from the manifest
 * 2. Verifying every path exists on disk
 * 3. Detecting orphaned spec files not referenced by the manifest
 *
 * Usage: tsx scripts/validate-spine-manifest.ts
 * Exit code: 0 = valid, 1 = errors found
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SpineValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  checkedPaths: number;
  orphanedFiles: string[];
}

const REPO_ROOT = path.resolve(__dirname, '..');
const SPINE_PATH = path.join(REPO_ROOT, 'specs', '_doc_spine.yml');
const SPECS_DIR = path.join(REPO_ROOT, 'specs');

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

  walk(SPECS_DIR, '');
  return results;
}

/** Main validation function. */
export function validateSpineManifest(): SpineValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Check spine file exists
  if (!fs.existsSync(SPINE_PATH)) {
    return {
      valid: false,
      errors: [`specs/_doc_spine.yml not found at ${SPINE_PATH}`],
      warnings: [],
      checkedPaths: 0,
      orphanedFiles: [],
    };
  }

  const content = fs.readFileSync(SPINE_PATH, 'utf-8');

  // 2. Check required top-level fields
  const requiredFields = ['constitution', 'entrypoints', 'system_design', 'references'];
  for (const field of requiredFields) {
    const regex = new RegExp(`^${field}:`, 'm');
    if (!regex.test(content)) {
      errors.push(`Missing required field: '${field}'`);
    }
  }

  // 3. Extract and validate all paths
  // Paths are resolved relative to repo root first, then specs/ as fallback
  const referencedPaths = extractPathsFromSpine(content);

  for (const relPath of referencedPaths) {
    const rootPath = path.join(REPO_ROOT, relPath);
    const specsPath = path.join(REPO_ROOT, 'specs', relPath);
    if (!fs.existsSync(rootPath) && !fs.existsSync(specsPath)) {
      errors.push(`Referenced path does not exist: ${relPath} (checked both ${relPath} and specs/${relPath})`);
    }
  }

  // 4. Detect orphaned spec files (md files in specs/ not referenced by spine)
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
  };
}

// CLI entry point
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMainModule) {
  const result = validateSpineManifest();

  console.log(`\n=== Spine Manifest Validation ===`);
  console.log(`Checked paths: ${result.checkedPaths}`);
  console.log(`Errors: ${result.errors.length}`);
  console.log(`Warnings: ${result.warnings.length}`);

  if (result.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    for (const err of result.errors) {
      console.log(`  - ${err}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    for (const warn of result.warnings) {
      console.log(`  - ${warn}`);
    }
  }

  if (result.valid) {
    console.log('\n✅ Spine manifest is valid.');
    process.exit(0);
  } else {
    console.log('\n❌ Spine manifest validation FAILED.');
    process.exit(1);
  }
}
