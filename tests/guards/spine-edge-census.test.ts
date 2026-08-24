/**
 * Spine edge 双方向 census — Phase 201 / TASK-0285 / REQ-402 / MW-066.
 * 表題 sync 拡張 — Phase 209 / TASK-0293 / REQ-406 / MW-070.
 *
 * anchor parent 宣言（child → parent）と parent 側 spine:children /
 * spine:references 登録（parent → child）の **edge 両端** が一致することを
 * exact sweep で担保する。656a0d58/bb844a0f → c818286f の事故（parent 側
 * 登録を同梱しない spec landing が GREEN で通り、修復が sweep commit に分離）
 * の再発を構造的に阻止する — make-run steering: SPEC_LANDING_ATOMICITY。
 *
 * REQ-406 は同じ事故 class の**表題面**を閉じる: 90c924db が子 spec の改題に
 * 親 index 側の表題更新を同梱せず、`chore(make-run): commit 2 remaining
 * change(s)`（47d71cd5）に正規化が分離した。entry 表題 ↔ 対象 doc の最初の
 * H1 の一致を exact sweep で強制することで、改題と index 同期が同一 tree に
 * 揃わない限り GREEN にならない（= 当該 class の sweep commit 根絶）。
 *
 * 構成は REQ-388（spine-anchor-role-census）と同じ: 純関数 module
 * （tests/guards/spine-edge-contract.ts）の合成 fixture 検出 + 実 specs tree
 * の exact-0 census。anchor 解析自体は REQ-388 側の guard が管轄。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { parseAnchorBlocks } from './spine-anchor-contract';
import {
  auditSpineEdges,
  firstHeading,
  parseSpineRegistries,
  resolveSpecsLink,
  type SpineEdgeViolation,
} from './spine-edge-contract';

// cwd は whisper-node の chdir 等 module-load 副作用で動きうるため
// import.meta.url 起点で anchor する（REQ-388 guard と同じ規律）。
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

/** 合成 fixture 用の正規形 anchor block（link は audit 上意味を持たないが実形に合わせる）。 */
function anchorBlock(parentRel: string, link: string): string {
  return [
    '<!-- spine:anchor:begin -->',
    `> **Spine anchor**: [p](${link})`,
    '>',
    `> - parent: \`${parentRel}\``,
    '> - role: `detailed`',
    '> - status: `canonical_child`',
    '<!-- spine:anchor:end -->',
  ].join('\n');
}

function childrenBlock(entries: Array<[string, string]>): string {
  return [
    '<!-- spine:children:begin -->',
    '## Spine: child documents',
    '',
    ...entries.map(([title, link]) => `- [${title}](${link})`),
    '',
    '<!-- spine:children:end -->',
  ].join('\n');
}

function referencesBlock(entries: Array<[string, string]>): string {
  return [
    '<!-- spine:references:begin -->',
    '## Spine: external references',
    '',
    ...entries.map(([title, link]) => `- [${title}](${link})`),
    '',
    '<!-- spine:references:end -->',
  ].join('\n');
}

/** 正規形の最小 tree（violations 0）。各検出 test はこれを 1 点だけ壊す。
 * 表題は対象 doc の H1 と完全一致（REQ-406 の表題 sync も正規形の一部）。 */
function canonicalTree(): Array<{ rel: string; content: string }> {
  return [
    {
      rel: 'speech-to-visuals/architecture.md',
      content:
        '# arch\n\n' +
        anchorBlock('SYSTEM_CONSTITUTION.md', '../../SYSTEM_CONSTITUTION.md') +
        '\n\n' +
        childrenBlock([['req', 'requirements.md'], ['ov', 'tasks/overview.md']]),
    },
    {
      rel: 'speech-to-visuals/requirements.md',
      content: '# req\n\n' + anchorBlock('speech-to-visuals/architecture.md', 'architecture.md'),
    },
    {
      rel: 'speech-to-visuals/tasks/overview.md',
      content:
        '# ov\n\n' + anchorBlock('speech-to-visuals/architecture.md', '../../architecture.md'),
    },
  ];
}

/** 違反 1 種を期待する test 用 helper（narrow して non-null assertion を避ける）。 */
function kindsOf(violations: SpineEdgeViolation[]): string[] {
  return violations.map(v => v.kind);
}

function firstOfKind(violations: SpineEdgeViolation[], kind: string): SpineEdgeViolation {
  const v = violations.find(x => x.kind === kind);
  if (v === undefined) {
    throw new Error(`違反 ${kind} が検出されていない（検出そのものの回帰）: ${JSON.stringify(violations)}`);
  }
  return v;
}

describe('spine edge 双方向 census — 実 tree exact-0（REQ-402-005）', () => {
  it('specs/** の全 edge が契約を満たす（violations 0・ceiling ではない）', () => {
    const report = auditSpineEdges(readSpecsTree());
    // exact-0: 新規 file が違反 shape で land したら即 RED。
    expect(report.violations).toEqual([]);
  });

  it('在庫の回帰 pin（files / anchorEdges / registryEntries は floor）', () => {
    const report = auditSpineEdges(readSpecsTree());
    // 2026-08-23 実測: files 333（+本 spec 6 file）/ anchorEdges 324（318+6）/
    // registryEntries 100（86 + 本 spec の atomic 登録 4 + 初回 run が発見した
    // tasks/overview.md orphan references block の修復 10）。spec 追加で増える
    // ことは常にあるので floor pin。
    expect(report.filesChecked).toBeGreaterThanOrEqual(333);
    expect(report.anchorEdges).toBeGreaterThanOrEqual(324);
    expect(report.registryEntries).toBeGreaterThanOrEqual(100);
  });

  it('表題 sync（REQ-406-002）: 全 registry entry の表題が対象 doc の H1 と一致（exact-0 + 検証数 floor）', () => {
    const report = auditSpineEdges(readSpecsTree());
    const titleViolations = report.violations.filter(
      v => v.kind === 'REGISTRY_TITLE_DRIFT' || v.kind === 'REGISTRY_TARGET_H1_MISSING',
    );
    // exact-0: 子の改題 / 親 index 側の表題編集のどちらかが単独で land したら
    // 即 RED（= 47d71cd5 class の sweep commit 根絶）。2026-08-25 実測 baseline
    // は 112 entry 中 drift 0（confirmed-zero pin・ landing 前測定）。
    expect(titleViolations).toEqual([]);
    // titleChecked は「対象が存在し表題比較まで走った entry 数」。検証の
    // silent skip（対象読み rot・比較除外の拡大）はこの計数の落下として検出。
    expect(report.titleChecked).toBeGreaterThanOrEqual(112);
  });

  it('bare parent（repo root 直下 doc）の観測集合は SYSTEM_CONSTITUTION.md のみ（exact pin）', () => {
    const bare = new Set<string>();
    for (const { rel, content } of readSpecsTree()) {
      for (const block of parseAnchorBlocks(content)) {
        if (block.parentRel !== null && !block.parentRel.includes('/')) {
          bare.add(block.parentRel);
        }
      }
    }
    // 新規 root doc への anchor は意識的な追加としてこの pin に引っかかる。
    expect([...bare].sort()).toEqual(['SYSTEM_CONSTITUTION.md']);
  });

  it('本 spec 一式の atomic dogfood: 自 spec が parent 側登録を持つ（REQ-402-006）', () => {
    // exact-0 test が全体を担保するが、REQ-402 の動機となった事故 class
    // （spec land 時の parent 側登録 同梱漏れ）が本 spec 自身に無いことを
    // 名指しで pin する（sweep commit 残さない運用の構造実証）。
    const arch = readFileSync(join(SPECS_DIR, 'speech-to-visuals/architecture.md'), 'utf-8');
    expect(arch).toContain('../spine-edge-bidirectional-census/requirements.md');
    expect(arch).toContain('../spine-edge-bidirectional-census/tasks/overview.md');
    const di = readFileSync(join(SPECS_DIR, 'speech-to-visuals/design-interview.md'), 'utf-8');
    expect(di).toContain('../spine-edge-bidirectional-census/interview-record.md');
    const note = readFileSync(join(SPECS_DIR, 'speech-to-visuals/note.md'), 'utf-8');
    expect(note).toContain('../spine-edge-bidirectional-census/note.md');
  });
});

describe('auditSpineEdges — 合成 fixture で 6 violation kind を検出（REQ-402-001〜004）', () => {
  it('正規形のみなら violations 0', () => {
    const report = auditSpineEdges(canonicalTree());
    expect(report.violations).toEqual([]);
    expect(report.anchorEdges).toBe(3);
    expect(report.registryEntries).toBe(2);
    expect(report.titleChecked).toBe(2);
  });

  it('c818286f~1 事故 shape: children block を持たない doc への parent 宣言 → PARENT_UNREGISTERED', () => {
    const files = [
      ...canonicalTree(),
      {
        rel: 'audit-pass-first-census-facet-5/requirements.md',
        content:
          '# f5\n\n' +
          anchorBlock('speech-to-visuals/requirements.md', '../speech-to-visuals/requirements.md'),
      },
    ];
    const report = auditSpineEdges(files);
    expect(kindsOf(report.violations)).toEqual(['PARENT_UNREGISTERED']);
    const v = firstOfKind(report.violations, 'PARENT_UNREGISTERED');
    expect(v.detail).toContain('audit-pass-first-census-facet-5/requirements.md');
    expect(v.detail).toContain('speech-to-visuals/requirements.md');
  });

  it('TASK file は forward 検査から exempt（登録粒度 = tasks/overview.md）', () => {
    const files = [
      ...canonicalTree(),
      {
        rel: 'audit-pass-first-census-facet-5/tasks/TASK-9999.md',
        content: '# t\n\n' + anchorBlock('speech-to-visuals/requirements.md', '../../speech-to-visuals/requirements.md'),
      },
    ];
    // 実在 288 TASK anchor と同じく個別登録なしでも違反にしない（engine schema）。
    expect(auditSpineEdges(files).violations).toEqual([]);
  });

  it('parent doc が specs に存在しない → PARENT_DOC_MISSING', () => {
    const files = [
      ...canonicalTree(),
      {
        rel: 'speech-to-visuals/dataflow.md',
        content: '# d\n\n' + anchorBlock('speech-to-visuals/missing.md', 'missing.md'),
      },
    ];
    expect(kindsOf(auditSpineEdges(files).violations)).toEqual(['PARENT_DOC_MISSING']);
  });

  it('children entry の対象が存在しない → REGISTRY_TARGET_MISSING（phantom 登録）', () => {
    const files = canonicalTree().map(f =>
      f.rel === 'speech-to-visuals/architecture.md'
        ? { ...f, content: f.content.replace('- [req](requirements.md)', '- [req](requirements.md)\n- [t](../ghost-feature/requirements.md)') }
        : f,
    );
    const report = auditSpineEdges(files);
    expect(kindsOf(report.violations)).toContain('REGISTRY_TARGET_MISSING');
    expect(firstOfKind(report.violations, 'REGISTRY_TARGET_MISSING').detail).toContain(
      'ghost-feature/requirements.md',
    );
  });

  it('registry link が specs-relative でない → REGISTRY_LINK_UNSUPPORTED', () => {
    const files = canonicalTree().map(f =>
      f.rel === 'speech-to-visuals/architecture.md'
        ? { ...f, content: f.content + '\n' + referencesBlock([['t', 'https://example.com/x.md'], ['t', '../../README.md']]) }
        : f,
    );
    const report = auditSpineEdges(files);
    expect(kindsOf(report.violations)).toEqual([
      'REGISTRY_LINK_UNSUPPORTED',
      'REGISTRY_LINK_UNSUPPORTED',
    ]);
  });

  it('children entry の対象が holder を parent 宣言していない → CHILD_BACK_ANCHOR_MISSING（references 登録では forward は満たす）', () => {
    // dataflow は requirements の references に登録（forward OK = note→note
    // wiring と同じ受容）だが architecture の children からは back-anchor 無し。
    const files = [
      ...canonicalTree().map(f =>
        f.rel === 'speech-to-visuals/architecture.md'
          ? { ...f, content: f.content.replace('- [req](requirements.md)', '- [req](requirements.md)\n- [d](dataflow.md)') }
          : f,
      ),
      {
        rel: 'speech-to-visuals/requirements.md',
        content:
          '# req\n\n' +
          anchorBlock('speech-to-visuals/architecture.md', 'architecture.md') +
          '\n\n' +
          referencesBlock([['d', 'dataflow.md']]),
      },
      {
        rel: 'speech-to-visuals/dataflow.md',
        content: '# d\n\n' + anchorBlock('speech-to-visuals/requirements.md', 'requirements.md'),
      },
    ];
    const report = auditSpineEdges(files);
    expect(kindsOf(report.violations)).toEqual(['CHILD_BACK_ANCHOR_MISSING']);
    expect(firstOfKind(report.violations, 'CHILD_BACK_ANCHOR_MISSING').detail).toContain(
      'speech-to-visuals/dataflow.md',
    );
  });

  it('begin marker のみで閉じ無し → REGISTRY_BLOCK_UNCLOSED', () => {
    const files = canonicalTree().map(f =>
      f.rel === 'speech-to-visuals/architecture.md'
        ? { ...f, content: f.content + '\n<!-- spine:references:begin -->\n- [t](dataflow.md)' }
        : f,
    );
    const report = auditSpineEdges(files);
    expect(kindsOf(report.violations)).toContain('REGISTRY_BLOCK_UNCLOSED');
  });

  it('事故の修復後 shape（architecture children 登録）は violations 0 に戻る', () => {
    const files = [
      ...canonicalTree().map(f =>
        f.rel === 'speech-to-visuals/architecture.md'
          ? { ...f, content: f.content.replace('- [ov](tasks/overview.md)', '- [ov](tasks/overview.md)\n- [f5](../audit-pass-first-census-facet-5/requirements.md)') }
          : f,
      ),
      {
        rel: 'audit-pass-first-census-facet-5/requirements.md',
        content:
          '# f5\n\n' +
          anchorBlock('speech-to-visuals/architecture.md', '../speech-to-visuals/architecture.md'),
      },
    ];
    expect(auditSpineEdges(files).violations).toEqual([]);
  });

  it('47d71cd5 事故 shape: 子 doc の改題だけ land し親 index の表題が旧まま → REGISTRY_TITLE_DRIFT（REQ-406-001）', () => {
    // 90c924db の実事故: 子 spec が改題され、親 architecture.md children の
    // 表題更新が同 commit に入らず 47d71cd5 の sweep commit に分離した。
    // 本 guard では 90c924db の tree state が RED になる。
    const retitled = canonicalTree().map(f =>
      f.rel === 'speech-to-visuals/requirements.md'
        ? { ...f, content: f.content.replace('# req\n', '# req v2（改題後）\n') }
        : f,
    );
    const report = auditSpineEdges(retitled);
    expect(kindsOf(report.violations)).toEqual(['REGISTRY_TITLE_DRIFT']);
    const v = firstOfKind(report.violations, 'REGISTRY_TITLE_DRIFT');
    expect(v.detail).toContain('speech-to-visuals/architecture.md');
    expect(v.detail).toContain('req v2（改題後）');
    // 修復 = 親 index 側の表題を新 H1 に同期（同一 tree に揃える）。
    const repaired = retitled.map(f =>
      f.rel === 'speech-to-visuals/architecture.md'
        ? { ...f, content: f.content.replace('- [req](requirements.md)', '- [req v2（改題後）](requirements.md)') }
        : f,
    );
    expect(auditSpineEdges(repaired).violations).toEqual([]);
  });

  it('親 index 側の表題 typo（対象は不変）も同一違反 → REGISTRY_TITLE_DRIFT', () => {
    const files = canonicalTree().map(f =>
      f.rel === 'speech-to-visuals/architecture.md'
        ? { ...f, content: f.content.replace('- [ov](tasks/overview.md)', '- [overview（旧表題）](tasks/overview.md)') }
        : f,
    );
    const report = auditSpineEdges(files);
    expect(kindsOf(report.violations)).toEqual(['REGISTRY_TITLE_DRIFT']);
    expect(report.titleChecked).toBe(2);
  });

  it('対象 doc が H1 を持たない → REGISTRY_TARGET_H1_MISSING（表題 sync の検証不能）', () => {
    const files = canonicalTree().map(f =>
      f.rel === 'speech-to-visuals/requirements.md'
        ? { ...f, content: '## h2 しかない doc\n\n' + anchorBlock('speech-to-visuals/architecture.md', 'architecture.md') }
        : f,
    );
    const report = auditSpineEdges(files);
    expect(kindsOf(report.violations)).toEqual(['REGISTRY_TARGET_H1_MISSING']);
    expect(firstOfKind(report.violations, 'REGISTRY_TARGET_H1_MISSING').detail).toContain(
      'speech-to-visuals/requirements.md',
    );
  });
});

describe('resolveSpecsLink / parseSpineRegistries（純関数の境界）', () => {
  it.each([
    ['speech-to-visuals/architecture.md', 'requirements.md', 'speech-to-visuals/requirements.md'],
    ['speech-to-visuals/tasks/overview.md', '../../speech-to-visuals/architecture.md', 'speech-to-visuals/architecture.md'],
    ['finite-safe-aggregation/note.md', '../speech-to-visuals/note.md', 'speech-to-visuals/note.md'],
    ['speech-to-visuals/architecture.md', './dataflow.md', 'speech-to-visuals/dataflow.md'],
  ])('resolveSpecsLink(%s, %s) = %s', (holder, link, expected) => {
    expect(resolveSpecsLink(holder, link)).toBe(expected);
  });

  it.each([
    ['speech-to-visuals/architecture.md', 'https://example.com/x.md'],
    ['speech-to-visuals/architecture.md', '/absolute/x.md'],
    ['speech-to-visuals/architecture.md', '../../outside-root.md'],
  ])('specs 外 link は null: resolveSpecsLink(%s, %s)', (holder, link) => {
    expect(resolveSpecsLink(holder, link)).toBeNull();
  });

  it('registry block 内の entry 行のみを解析（block 外の list 行・checkbox 行は無視）', () => {
    const content = [
      '# d',
      '',
      '- [block 外](requirements.md)',
      '',
      childrenBlock([['t', 'a.md'], ['t', './b.md']]),
      '',
      '- [x] checkbox は entry でない',
      '',
      referencesBlock([['t', '../c.md']]),
    ].join('\n');
    const entries = parseSpineRegistries('speech-to-visuals/architecture.md', content);
    expect(entries.map(e => [e.kind, e.targetRel])).toEqual([
      ['children', 'speech-to-visuals/a.md'],
      ['children', 'speech-to-visuals/b.md'],
      ['references', 'c.md'],
    ]);
  });

  it.each([
    ['# title\nbody', 'title'],
    ['前言あり\n\n# 後出し title\n', '後出し title'],
    ['  # インデント付きは H1 とみなさない（行頭 strict）', null],
    ['## h2 のみ\n', null],
    ['# \n空 H1 のみ', null],
    ['body のみ（見出し無し）', null],
  ])('firstHeading(%j) = %j', (content, expected) => {
    expect(firstHeading(content)).toBe(expected);
  });
});
