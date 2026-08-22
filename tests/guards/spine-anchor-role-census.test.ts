/**
 * Spine anchor role census — Phase 186 / TASK-0270 / REQ-388 / TC-372 / MW-052.
 *
 * specs 配下の全 spine anchor block が (a) role 行を持ち (b) その値が hub 側
 * doc-spine engine（spine.py `_classify_filename` / `_role_for_spine_node`）の
 * 導出規則と一致することを exact sweep で担保する。さらに
 * specs/<feature>/tasks/TASK-*.md が必ず anchor block を持つことを検証する —
 * 新規 TASK file が anchor/role なしで land した瞬間に RED（滴下の再発防止）。
 *
 * make-run steering（Phase 185 feedback）:
 *   「repo内に依然90件超のrole行なしspecが残る。2行ずつの滴下を繰り返さないこと」
 *   「末端掃込みコミット('chore(make-run)')でanchorスキーマ修正を雑扱いしないこと」
 *
 * 修正は generator（scripts/sync-spine-anchor-roles.ts）が担う。本 guard は
 * 純関数 module（tests/guards/spine-anchor-contract.ts）の検証と実 file の
 * census の両方を持つ（mirror contract guard と同じ構成）。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import {
  SPINE_ROLES,
  auditSpineAnchors,
  classifySpineFilename,
  deriveSpineRole,
  deriveTaskAnchorDefaults,
  featureIdFromPath,
  normalizeAnchorRole,
  parseAnchorBlocks,
  relativeLink,
  renderAnchorBlock,
} from './spine-anchor-contract';

// cwd は whisper-node の chdir 等 module-load 側作用で動きうるため
// import.meta.url 起点で anchor する（source-anchor-cwd-discipline guard と同じ規律）。
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SPECS_DIR = join(REPO_ROOT, 'specs');

function listSpecsMd(dir: string, prefix: string): Array<{ rel: string; abs: string }> {
  const out: Array<{ rel: string; abs: string }> = [];
  for (const name of readdirSync(dir).sort()) {
    const abs = join(dir, name);
    const rel = prefix === '' ? name : `${prefix}/${name}`;
    if (statSync(abs).isDirectory()) {
      out.push(...listSpecsMd(abs, rel));
    } else if (name.endsWith('.md')) {
      out.push({ rel, abs });
    }
  }
  return out;
}

function readSpecsTree(): Array<{ rel: string; content: string }> {
  return listSpecsMd(SPECS_DIR, '').map(({ rel, abs }) => ({
    rel,
    content: readFileSync(abs, 'utf-8'),
  }));
}

describe('spine anchor role census (REQ-388)', () => {
  it('specs/** の全 anchor block が role 行を持ち導出規則と一致（exact sweep・violations 0）', () => {
    const report = auditSpineAnchors(readSpecsTree());
    // exact-0: ceiling ではない。新規 file が違反 shape で land したら即 RED。
    expect(report.violations).toEqual([]);
    // 正規化 (Phase 186) 後の在庫: 241 既存 + 62 挿入 block。
    expect(report.anchorBlocks).toBeGreaterThanOrEqual(303);
    expect(report.roleLines).toBe(report.anchorBlocks);
  });

  it('TASK file は必ず anchor block を持つ（census が上記で検証・ここでは在庫の回帰pin）', () => {
    const isTaskRel = (rel: string): boolean => {
      const parts = rel.split('/');
      return (
        parts.length === 3 && parts[1] === 'tasks' && /^TASK-\d+\.md$/.test(parts[2] ?? '')
      );
    };
    const taskFiles = readSpecsTree().filter(({ rel }) => isTaskRel(rel));
    // 262 (speech-to-visuals) + 11 (finite-safe-aggregation) + 4 (guard-
    // harness-fold-census) = 277。TASK file の追加は常にあるので floor pin。
    expect(taskFiles.length).toBeGreaterThanOrEqual(277);
    const missing = taskFiles
      .filter(({ content }) => parseAnchorBlocks(content).length === 0)
      .map(({ rel }) => rel);
    expect(missing).toEqual([]);
  });
});

describe('classifySpineFilename — spine.py _classify_filename の移植', () => {
  // 実在 file 名で表を作る（語彙と評価順の契約）。
  it.each([
    ['speech-to-visuals/architecture.md', 'system'],
    ['speech-to-visuals/design-interview.md', 'system'],
    ['speech-to-visuals/tasks/TASK-0109.md', 'detailed'],
    ['speech-to-visuals/api-endpoints.md', 'reference'],
    ['speech-to-visuals/database-schema.sql.md', 'reference'],
    ['speech-to-visuals/method.md', 'method'],
    ['speech-to-visuals/implementation-notes.md', 'detailed'],
  ])('%s → %s', (rel, expected) => {
    expect(classifySpineFilename(rel)).toBe(expected);
  });

  it('repo-relative path（specs/ prefix）は fail-loud（"spec" substring 退化の罠）', () => {
    expect(() => classifySpineFilename('specs/speech-to-visuals/architecture.md')).toThrow(
      /specs-relative/,
    );
  });

  it('語彙は 6 role（spine.py _classify_filename + top-level 2 値）', () => {
    expect([...SPINE_ROLES]).toEqual([
      'system',
      'method',
      'detailed',
      'reference',
      'feature_root',
      'system_design_root',
    ]);
  });
});

describe('deriveSpineRole — spine.py _role_for_spine_node の移植', () => {
  it('parent が repo root 直下（/ を含まない）なら top-level: feature_root', () => {
    expect(deriveSpineRole('speech-to-visuals/architecture.md', 'SYSTEM_CONSTITUTION.md')).toBe(
      'feature_root',
    );
  });

  it('top-level でも specs 直下の file なら system_design_root', () => {
    expect(deriveSpineRole('README.md', 'SYSTEM_CONSTITUTION.md')).toBe('system_design_root');
  });

  it('feature 内 child は filename 分類（実在 241 block の値を再現）', () => {
    expect(deriveSpineRole('speech-to-visuals/tasks/TASK-0001.md', 'speech-to-visuals/architecture.md')).toBe('detailed');
    expect(deriveSpineRole('finite-safe-aggregation/architecture.md', 'speech-to-visuals/architecture.md')).toBe('system');
  });
});

describe('featureIdFromPath', () => {
  it.each([
    ['speech-to-visuals/architecture.md', 'speech-to-visuals'],
    ['README.md', null],
  ])('%s → %s', (rel, expected) => {
    expect(featureIdFromPath(rel)).toBe(expected);
  });
});

describe('parseAnchorBlocks', () => {
  const canonical = [
    '# title',
    '',
    '<!-- spine:anchor:begin -->',
    '> **Spine anchor**: [parent](../architecture.md)',
    '>',
    '> - parent: `speech-to-visuals/architecture.md`',
    '> - role: `detailed`',
    '> - status: `canonical_child`',
    '<!-- spine:anchor:end -->',
  ].join('\n');

  it('parent/role/status を解析し行番号は block 全体（1-based）', () => {
    const blocks = parseAnchorBlocks(canonical);
    expect(blocks).toHaveLength(1);
    const block = blocks[0];
    if (block === undefined) throw new Error('canonical fixture が block として parse されない');
    expect(block.startLine).toBe(3);
    expect(block.endLine).toBe(9);
    expect(block.parentRel).toBe('speech-to-visuals/architecture.md');
    expect(block.role).toBe('detailed');
    expect(block.status).toBe('canonical_child');
  });

  it('role 行が無い block は role: null（census の挿入対象）', () => {
    const noRole = canonical.replace('> - role: `detailed`\n', '');
    const block = parseAnchorBlocks(noRole)[0];
    if (block === undefined) throw new Error('no-role fixture が block として parse されない');
    expect(block.role).toBeNull();
  });

  it('閉じ marker の無い begin は block として数えない', () => {
    const unclosed = canonical.split('<!-- spine:anchor:end -->')[0] ?? canonical;
    expect(parseAnchorBlocks(unclosed)).toHaveLength(0);
  });
});

describe('normalizeAnchorRole（bounded 正規化・純関数）', () => {
  const defaults = deriveTaskAnchorDefaultsFixture();

  function deriveTaskAnchorDefaultsFixture() {
    return deriveTaskAnchorDefaults([
      {
        rel: 'speech-to-visuals/architecture.md',
        content: '# speech-to-visuals アーキテクチャ設計\n\n<!-- spine:anchor:begin -->\n>\n> - parent: `SYSTEM_CONSTITUTION.md`\n> - role: `feature_root`\n<!-- spine:anchor:end -->\n',
      },
      {
        rel: 'speech-to-visuals/requirements.md',
        content: '# requirements\n',
      },
    ]);
  }

  it('role 行欠け block へ導出 role 1 行を parent 行の直後に挿入', () => {
    const content = [
      '<!-- spine:anchor:begin -->',
      '> **Spine anchor**: [p](../architecture.md)',
      '>',
      '> - parent: `speech-to-visuals/architecture.md`',
      '> - status: `canonical_child`',
      '<!-- spine:anchor:end -->',
    ].join('\n');
    const result = normalizeAnchorRole('speech-to-visuals/tasks/TASK-0001.md', content, defaults);
    expect(result.action).toBe('inserted-role');
    expect(result.role).toBe('detailed');
    expect(result.content).toBe(
      [
        '<!-- spine:anchor:begin -->',
        '> **Spine anchor**: [p](../architecture.md)',
        '>',
        '> - parent: `speech-to-visuals/architecture.md`',
        '> - role: `detailed`',
        '> - status: `canonical_child`',
        '<!-- spine:anchor:end -->',
      ].join('\n'),
    );
  });

  it('role 行が既に有る file は none（冪等）', () => {
    const content = renderAnchorBlock({
      title: 't',
      link: '../architecture.md',
      parentRel: 'speech-to-visuals/architecture.md',
      role: 'detailed',
    });
    const result = normalizeAnchorRole('speech-to-visuals/tasks/TASK-0001.md', content, defaults);
    expect(result.action).toBe('none');
    expect(result.content).toBe(content);
  });

  it('role 値の不一致は書き換えない（fail-loud: census が違反として差し戻す）', () => {
    const content = renderAnchorBlock({
      title: 't',
      link: '../architecture.md',
      parentRel: 'speech-to-visuals/architecture.md',
      role: 'system',
    });
    const result = normalizeAnchorRole('speech-to-visuals/tasks/TASK-0001.md', content, defaults);
    expect(result.action).toBe('none');
  });

  it('TASK file で anchor 無し → H1 直後に正規形 block（spine.py _apply_anchor と同じ位置）', () => {
    const content = '# TASK-9999: x\n\n**タスクID**: TASK-9999\n';
    const result = normalizeAnchorRole('speech-to-visuals/tasks/TASK-9999.md', content, defaults);
    expect(result.action).toBe('inserted-block');
    expect(result.role).toBe('detailed');
    const lines = result.content.split('\n');
    expect(lines[0]).toBe('# TASK-9999: x');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe('<!-- spine:anchor:begin -->');
    // parent 行は root feature の architecture.md + 相対 link
    expect(result.content).toContain('> - parent: `speech-to-visuals/architecture.md`');
    expect(result.content).toContain('](../architecture.md)');
    // 冪等: もう一度通すと none
    expect(normalizeAnchorRole('speech-to-visuals/tasks/TASK-9999.md', result.content, defaults).action).toBe('none');
  });

  it('sibling feature の TASK file は root feature への相対 link（../../ 経由）', () => {
    const result = normalizeAnchorRole(
      'finite-safe-aggregation/tasks/TASK-0001.md',
      '# TASK-0001: x\n',
      defaults,
    );
    expect(result.content).toContain('](../../speech-to-visuals/architecture.md)');
  });

  it('frontmatter 付き file は frontmatter の直後に挿入', () => {
    const content = '---\ntitle: t\n---\n# h\n';
    const result = normalizeAnchorRole('speech-to-visuals/tasks/TASK-0001.md', content, defaults);
    expect(result.action).toBe('inserted-block');
    expect(result.content.startsWith('---\ntitle: t\n---\n\n<!-- spine:anchor:begin -->')).toBe(true);
  });

  it('TASK file 以外の anchor 無し file には触れない（engine の outsider 判断を捏造しない）', () => {
    const content = '# note\n';
    const result = normalizeAnchorRole('pipeline-metrics-nan-leak-fix/note.md', content, defaults);
    expect(result.action).toBe('none');
    expect(result.content).toBe(content);
  });
});

describe('deriveTaskAnchorDefaults / relativeLink', () => {
  it('root 判定は parent が repo root 直下の anchor（実在 tree で speech-to-visuals を導出）', () => {
    const defaults = deriveTaskAnchorDefaults(readSpecsTree());
    expect(defaults.parentRel).toBe('speech-to-visuals/architecture.md');
    expect(defaults.parentTitle).toBe('speech-to-visuals アーキテクチャ設計');
  });

  it.each([
    ['speech-to-visuals/tasks/TASK-0001.md', 'speech-to-visuals/architecture.md', '../architecture.md'],
    ['finite-safe-aggregation/tasks/TASK-0001.md', 'speech-to-visuals/architecture.md', '../../speech-to-visuals/architecture.md'],
    ['finite-safe-aggregation/architecture.md', 'speech-to-visuals/architecture.md', '../speech-to-visuals/architecture.md'],
  ])('relativeLink(%s → %s) = %s', (from, to, expected) => {
    expect(relativeLink(from, to)).toBe(expected);
  });
});

/** 違反 1 件を期待する test 用 helper（narrow して non-null assertion を避ける）。 */
function firstViolation(report: ReturnType<typeof auditSpineAnchors>) {
  const v = report.violations[0];
  if (v === undefined) throw new Error('違反が検出されていない（検出そのものの回帰）');
  return v;
}

describe('auditSpineAnchors（合成 fixture で違反検出を unit test）', () => {
  const okFile = {
    rel: 'speech-to-visuals/tasks/TASK-0001.md',
    content: renderAnchorBlock({
      title: 't',
      link: '../architecture.md',
      parentRel: 'speech-to-visuals/architecture.md',
      role: 'detailed',
    }),
  };

  it('正規形のみなら violations 0', () => {
    const report = auditSpineAnchors([okFile]);
    expect(report.violations).toEqual([]);
    expect(report.anchorBlocks).toBe(1);
    expect(report.roleLines).toBe(1);
  });

  it('role 行欠け → ROLE_LINE_MISSING（滴下の再発 shape）', () => {
    const report = auditSpineAnchors([
      { rel: okFile.rel, content: okFile.content.replace('> - role: `detailed`\n', '') },
    ]);
    expect(report.violations).toHaveLength(1);
    expect(firstViolation(report).kind).toBe('ROLE_LINE_MISSING');
    expect(firstViolation(report).detail).toContain('TASK-0001.md');
  });

  it('role 値不一致 → ROLE_VALUE_MISMATCH', () => {
    const report = auditSpineAnchors([
      { rel: okFile.rel, content: okFile.content.replace('`detailed`', '`system`') },
    ]);
    expect(firstViolation(report).kind).toBe('ROLE_VALUE_MISMATCH');
  });

  it('語彙外 role → ROLE_UNKNOWN', () => {
    const report = auditSpineAnchors([
      { rel: okFile.rel, content: okFile.content.replace('`detailed`', '`detailed-spec`') },
    ]);
    expect(firstViolation(report).kind).toBe('ROLE_UNKNOWN');
  });

  it('anchor 無し TASK file → TASK_ANCHOR_MISSING', () => {
    const report = auditSpineAnchors([{ rel: okFile.rel, content: '# TASK-0001\n' }]);
    expect(firstViolation(report).kind).toBe('TASK_ANCHOR_MISSING');
  });

  it('parent 行無し → PARENT_LINE_MISSING', () => {
    const report = auditSpineAnchors([
      {
        rel: okFile.rel,
        content: okFile.content.replace('> - parent: `speech-to-visuals/architecture.md`\n', ''),
      },
    ]);
    expect(firstViolation(report).kind).toBe('PARENT_LINE_MISSING');
  });
});
