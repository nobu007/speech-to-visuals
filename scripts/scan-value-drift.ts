/**
 * Value-drift scanner: finds DUPLICATE SITES whose values have DIVERGED.
 *
 * Round 111 lesson: a scan that groups literals by VALUE finds value-identical
 * duplicates; grouping by KEYSET instead (then diffing per-key values across
 * sites) finds the L3 cases — pairs that already drifted (round 13's
 * diagram-type titles, `flowchart` 「プロセスフロー」 vs 「フローチャート」).
 * This tool automates that grouping so the sweep is repeatable instead of
 * hand-rolled each round.
 *
 * Four extraction dimensions over src/ (production code; __tests__ entries are
 * still printed inside a group for context but groups need >=1 production site
 * to be reported):
 *   1. object literals  — same sorted keyset, same key with different values
 *   2. const names      — same identifier initialized to different primitives
 *   3. regex literals   — same pattern body across sites (flags divergence
 *                         is flagged separately)
 *   4. switch maps      — string cases -> primitive returns, same keyset
 *
 * Usage:
 *   npx tsx scripts/scan-value-drift.ts            # scan src/
 *   npx tsx scripts/scan-value-drift.ts src/api    # scan a subtree
 *
 * Triage rule: a group is a candidate only if the sites are the SAME concept
 * (same downstream meaning). Same-keyset data fixtures (id/label/x/y shapes),
 * per-instance records, and intentional per-preset tables are the vast
 * majority of hits — verify the concept before touching anything.
 */

import ts from 'typescript';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOTS = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['src'];

interface Extracted {
  file: string;
  /** Absolute char offset in the source file (NOT a line number). */
  offset: number;
  kv: Record<string, string>;
}

interface ConstEntry {
  name: string;
  value: string;
  file: string;
  offset: number;
}

interface RegexEntry {
  source: string;
  flags: string;
  file: string;
  offset: number;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(p);
  }
  return out;
}

const files: string[] = [];
for (const root of ROOTS) files.push(...walk(root));

const mapLikes: Extracted[] = [];
const consts: ConstEntry[] = [];
const regexes: RegexEntry[] = [];

/** Primitive-literal text, or null for anything non-primitive. */
function valText(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return 'true';
  if (node.kind === ts.SyntaxKind.FalseKeyword) return 'false';
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
    const inner = valText(node.operand);
    return inner === null ? null : '-' + inner;
  }
  return null;
}

function visitMapLike(source: ts.SourceFile, node: ts.Node): void {
  if (ts.isObjectLiteralExpression(node)) {
    const kv: Record<string, string> = {};
    let primitiveMembers = 0;
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const key =
        ts.isStringLiteral(prop.name) || ts.isIdentifier(prop.name)
          ? prop.name.text
          : null;
      const value = valText(prop.initializer);
      if (key !== null && value !== null) {
        kv[key] = value;
        primitiveMembers++;
      }
    }
    if (primitiveMembers >= 2) {
      mapLikes.push({ file: source.fileName, offset: node.getStart(source), kv });
    }
  }

  if (ts.isSwitchStatement(node) && node.caseBlock.clauses.length >= 3) {
    const kv: Record<string, string> = {};
    for (const clause of node.caseBlock.clauses) {
      if (!ts.isCaseClause(clause) || !ts.isStringLiteral(clause.expression)) continue;
      const key = clause.expression.text;
      let ret: string | null = null;
      const scan = (nd: ts.Node): void => {
        if (ret !== null) return;
        if (ts.isReturnStatement(nd) && nd.expression) {
          const v = valText(nd.expression);
          if (v !== null) ret = v;
          return;
        }
        ts.forEachChild(nd, scan);
      };
      scan(clause);
      if (ret !== null) kv[key] = ret;
    }
    if (Object.keys(kv).length >= 3) {
      mapLikes.push({ file: source.fileName, offset: node.getStart(source), kv });
    }
  }

  ts.forEachChild(node, (child) => visitMapLike(source, child));
}

for (const file of files) {
  const sourceFile = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );

  visitMapLike(sourceFile, sourceFile);

  // const-name and regex dimensions need their own walk (declarations /
  // literals can appear anywhere visitMapLike already covers, but keeping the
  // extractors separate keeps each dimension independently auditable).
  const visitOther = (node: ts.Node): void => {
    if (
      ts.isVariableDeclarationList(node) &&
      (node.flags & ts.NodeFlags.Const) !== 0
    ) {
      for (const decl of node.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer) {
          const value = valText(decl.initializer);
          if (value !== null) {
            consts.push({
              name: decl.name.text,
              value,
              file: sourceFile.fileName,
              offset: decl.getStart(sourceFile),
            });
          }
        }
      }
    }
    if (ts.isRegularExpressionLiteral(node)) {
      const lastSlash = node.text.lastIndexOf('/');
      regexes.push({
        source: node.text.slice(1, lastSlash),
        flags: node.text.slice(lastSlash + 1),
        file: sourceFile.fileName,
        offset: node.getStart(sourceFile),
      });
    }
    ts.forEachChild(node, visitOther);
  };
  visitOther(sourceFile);
}

function hasProductionSite(entries: { file: string }[]): boolean {
  return entries.some((e) => !e.file.includes('__tests__'));
}

// --- 1) same-keyset map-likes with per-key value divergence ---
const byKeyset = new Map<string, Extracted[]>();
for (const entry of mapLikes) {
  const keyset = Object.keys(entry.kv).sort().join('|');
  const bucket = byKeyset.get(keyset) ?? [];
  bucket.push(entry);
  byKeyset.set(keyset, bucket);
}

console.log('=== MAP-LIKE KEYSET DIVERGENCE (same key, different value across sites) ===');
let groups = 0;
for (const [keyset, entries] of byKeyset) {
  if (entries.length < 2 || !hasProductionSite(entries)) continue;
  const keys = keyset.split('|');
  const divergent = keys.filter(
    (k) => new Set(entries.map((e) => e.kv[k])).size > 1
  );
  if (divergent.length === 0) continue;
  groups++;
  console.log(
    `\n--- keyset [${keyset}] (${entries.length} sites) divergent keys: ${divergent.join(', ')}`
  );
  for (const entry of entries) {
    console.log(`  ${entry.file}:${entry.offset}: ${JSON.stringify(entry.kv)}`);
  }
}
console.log(`\n(${groups} divergent keyset groups with a production site)`);

// --- 2) same const name, divergent primitive value ---
const byConstName = new Map<string, ConstEntry[]>();
for (const entry of consts) {
  const bucket = byConstName.get(entry.name) ?? [];
  bucket.push(entry);
  byConstName.set(entry.name, bucket);
}

console.log('\n=== CONST-NAME DIVERGENCE (production sites only) ===');
for (const [name, entries] of byConstName) {
  if (entries.length < 2 || !hasProductionSite(entries)) continue;
  const values = new Set(entries.map((e) => e.value));
  if (values.size === 1) continue;
  console.log(`\n${name}: ${[...values].join(' VS ')}`);
  for (const entry of entries) console.log(`  ${entry.file}:${entry.offset}`);
}

// --- 3) duplicate regex bodies ---
const byRegexSource = new Map<string, RegexEntry[]>();
for (const entry of regexes) {
  const bucket = byRegexSource.get(entry.source) ?? [];
  bucket.push(entry);
  byRegexSource.set(entry.source, bucket);
}

console.log('\n=== REGEX SOURCE DUPLICATES (production sites only) ===');
for (const [source, entries] of byRegexSource) {
  if (entries.length < 2 || !hasProductionSite(entries)) continue;
  const flagSets = new Set(entries.map((e) => e.flags));
  const mark = flagSets.size > 1 ? ' ⚠️FLAGS-DIVERGE' : '';
  console.log(`\n/${source}/ ×${entries.length}${mark}`);
  for (const entry of entries) {
    console.log(`  ${entry.file}:${entry.offset} flags=${entry.flags}`);
  }
}
