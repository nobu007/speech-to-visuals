/**
 * spine edge 双方向契約 — registry parser / link resolver / census auditor
 * (Phase 201 / TASK-0285 / REQ-402 / MW-066).
 *
 * REQ-388（spine-anchor-contract.ts）は anchor block **単体** の shape 契約
 * （parent 行・role 行の存在と導出値）を検証するが、anchor が宣言する
 * parent ↔ parent 側 `spine:children` / `spine:references` block の**edge の
 * 両端**は検証しない。その隙間を実証したのが 656a0d58/bb844a0f → c818286f:
 * facet-5 spec 2 件が `parent: speech-to-visuals/requirements.md` を宣言して
 * land した時点で、requirements.md 側には children block すら存在せず
 * （片方向 dangling anchor）、既存 guard は GREEN のまま通過した。修復は
 * `chore(make-run): commit 5 remaining change(s)` という後付け sweep commit に
 * 分離して land した — make-run steering 指摘（SPEC_LANDING_ATOMICITY）:
 * 「spec 本文を land させる commit に anchor parent 宣言と parent 側 children
 * 登録を同梱させ、sweep commit を残さない運用に変えること」。
 *
 * 運用だけでは再発する（人間が忘れた時点で終わり）。本モジュールは同じ事故
 * class を **構造的に RED 化** する census を提供する:
 *
 *   1. anchor 側（forward）— TASK file 以外の specs doc が anchor で parent P
 *      （specs 内 doc）を宣言するなら、P の children **または** references
 *      registry に本 doc が登録されていなければならない（PARENT_UNREGISTERED）。
 *      新規 spec の land / re-parent が parent 側登録なしでは通らなくなる
 *      = atomic landing の強制。TASK file（tasks/TASK-\d+.md）は登録粒度が
 *      tasks/overview.md であるため exempt（実在 288 TASK anchor が全て
 *      unregistered なのは engine schema 通り）。parent が `/` を含まない
 *      （repo root 直下 doc = SYSTEM_CONSTITUTION.md）場合は top-level root
 *      として exempt（role は REQ-388 census が feature_root で検証）。
 *   2. registry 側（reverse）— children entry は双方向（対象が holder を
 *      parent として anchor 宣言していること・CHILD_BACK_ANCHOR_MISSING）、
 *      children/references 両 entry の対象が specs に存在すること
 *      （REGISTRY_TARGET_MISSING）、link が specs-relative であること
 *      （REGISTRY_LINK_UNSUPPORTED）。references は engine schema 上
 *      one-way（対象側の anchor を要求しない — 実在 60 entry 中 58 が
 *      TASK file への one-way reference）。
 *   3. marker 構造 — begin/end marker の不一致（REGISTRY_BLOCK_UNCLOSED）。
 *      未閉鎖 block は parser から entries が silent drop され covenant の
 *      視野外になるため、件数不一致そのものを違反化する。
 *   4. 表題 sync（Phase 209 / REQ-406 追加）— children/references entry の
 *      `- [title](link)` の title は対象 doc の**最初の H1 見出し**と一致
 *      すること（REGISTRY_TITLE_DRIFT）。90c924db → 47d71cd5 の事故
 *      （子 spec の改題に親 index 側の表題更新を同梱し忘れ、正規化が
 *      `chore(make-run): commit 2 remaining change(s)` という後付け sweep
 *      commit に分離した）の class を構造的に RED 化する: 改題と index
 *      同期が同一 tree に揃わない限り guard は GREEN にならない = 当該
 *      class の sweep commit 根絶。H1 を持たない対象は検証不能として
 *      別 kind（REGISTRY_TARGET_H1_MISSING）で違反化する。
 *
 * 実在 tree（c818286f 修復後）は violations 0: anchor 318 / registry entry 86
 * （children 26 + references 60）/ feature-level 30 anchor 中 28 登録済み
 * （26 children + 2 references）+ root 2 件 exempt。表題 sync は 2026-08-25
 * 実測で 112 entry 中 drift 0（REQ-406 の初回 run = confirmed-zero pin）。
 *
 * REQ-388 と同じ構成: 純関数 module（書き込みなし）+ census test が実 tree
 * を readFileSync で sweep。anchor block の解析は REQ-388 の
 * parseAnchorBlocks に委譲（anchor 解析の単一実装）。
 */
import { isTaskFile, parseAnchorBlocks } from './spine-anchor-contract';

/** registry block の種別。children = 構造 tree edge・references = one-way 参照。 */
export type SpineRegistryKind = 'children' | 'references';

/** registry marker（hub 側 doc-spine engine が manifest から機械生成する形式）。 */
export const SPINE_REGISTRY_BEGIN: Record<SpineRegistryKind, string> = {
  children: '<!-- spine:children:begin -->',
  references: '<!-- spine:references:begin -->',
};
export const SPINE_REGISTRY_END: Record<SpineRegistryKind, string> = {
  children: '<!-- spine:children:end -->',
  references: '<!-- spine:references:end -->',
};

/** 解析済み registry entry。行番号は 1-based（entry の `- [..](..)` 行）。 */
export interface SpineRegistryEntry {
  kind: SpineRegistryKind;
  /** entry が置かれた file（specs-relative）*/
  holderRel: string;
  /** `- [title](link)` の link を specs-relative に解決した値。解決不能なら null */
  targetRel: string | null;
  /** 生 link 文字列（違反 detail 用）*/
  link: string;
  title: string;
  startLine: number;
}

const REGISTRY_KINDS: readonly SpineRegistryKind[] = ['children', 'references'];

const REGISTRY_ENTRY_RE = /^-\s+\[([^\]]*)\]\(([^)]+)\)/;

/**
 * markdown 相対 link を holder の置かれた dir 基準で specs-relative path に解決。
 * `http(s)://` 等の scheme 付き・`/` absolute・`..` で specs/ の外へ出る link は
 * 本契約の対象外（specs 内 doc でない）として null を返す。
 */
export function resolveSpecsLink(holderRel: string, link: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(link) || link.startsWith('/')) {
    return null;
  }
  const stack = holderRel.split('/').slice(0, -1);
  for (const part of link.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (stack.length === 0) return null;
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join('/');
}

/**
 * 1 file 分の registry block を解析し、block 内の全 `- [title](link)` 行を
 * entry として返す。閉じ marker の無い block の行は末尾まで entry として
 * 数える（marker 件数の不一致は scanSpineRegistryMarkerDefects が別途違反化
 * するため、ここでは silent に落とさない）。
 */
export function parseSpineRegistries(
  holderRel: string,
  content: string,
): SpineRegistryEntry[] {
  const entries: SpineRegistryEntry[] = [];
  let current: SpineRegistryKind | null = null;
  content.split('\n').forEach((line, idx) => {
    const trimmed = line.trim();
    const beginKind = REGISTRY_KINDS.find(k => trimmed === SPINE_REGISTRY_BEGIN[k]);
    const endKind = REGISTRY_KINDS.find(k => trimmed === SPINE_REGISTRY_END[k]);
    if (beginKind !== undefined) {
      if (current === null) current = beginKind;
      return;
    }
    if (endKind !== undefined) {
      current = null;
      return;
    }
    if (current === null) return;
    const m = line.match(REGISTRY_ENTRY_RE);
    if (m === null) return;
    entries.push({
      kind: current,
      holderRel,
      targetRel: resolveSpecsLink(holderRel, m[2]),
      link: m[2],
      title: m[1],
      startLine: idx + 1,
    });
  });
  return entries;
}

/**
 * begin/end marker の件数不一致を違反化。未閉鎖 block は
 * parseSpineRegistries が entries を block 外として落とす（または末尾まで
 * 巻き込む）ため、件数が揃っていれば block 単位の網羅が担保される。
 */
export function scanSpineRegistryMarkerDefects(
  holderRel: string,
  content: string,
): SpineEdgeViolation[] {
  const out: SpineEdgeViolation[] = [];
  const lines = content.split('\n');
  for (const kind of REGISTRY_KINDS) {
    const begins = lines.filter(l => l.trim() === SPINE_REGISTRY_BEGIN[kind]).length;
    const ends = lines.filter(l => l.trim() === SPINE_REGISTRY_END[kind]).length;
    if (begins !== ends) {
      out.push({
        kind: 'REGISTRY_BLOCK_UNCLOSED',
        detail: `${holderRel}: spine:${kind} marker の begin ${begins} 件 / end ${ends} 件が不一致（未閉鎖 block は entries が census の視野外になる）`,
      });
    }
  }
  return out;
}

/** census 違反の種別。detail は file:line 付きで人間が読める形。 */
export type SpineEdgeViolationKind =
  /** anchor parent（`/` 含む）が specs/ に存在しない（typo / 消滅 doc）*/
  | 'PARENT_DOC_MISSING'
  /** TASK file 以外の doc が parent を宣言したが parent 側 registry に登録が無い（= 656a0d58 が踏んだ sweep 分離 class）*/
  | 'PARENT_UNREGISTERED'
  /** children/references entry の対象 doc が specs/ に存在しない（phantom / 消滅登録）*/
  | 'REGISTRY_TARGET_MISSING'
  /** registry link が specs-relative path でない（http / 絶対 / specs 外）*/
  | 'REGISTRY_LINK_UNSUPPORTED'
  /** children entry の対象が holder を parent として anchor 宣言していない（双方向 tree edge の破壊）*/
  | 'CHILD_BACK_ANCHOR_MISSING'
  /** begin/end marker の件数不一致 */
  | 'REGISTRY_BLOCK_UNCLOSED'
  /** entry の表題が対象 doc の最初の H1 と不一致（= 47d71cd5 が sweep 修復した stale 表題 class）*/
  | 'REGISTRY_TITLE_DRIFT'
  /** entry の対象 doc が H1 見出しを持たない（表題 sync の検証不能）*/
  | 'REGISTRY_TARGET_H1_MISSING';

export interface SpineEdgeViolation {
  kind: SpineEdgeViolationKind;
  detail: string;
}

export interface SpineEdgeCensusReport {
  filesChecked: number;
  /** parent 行を持つ anchor block の数（parent 行なし block は REQ-388 census の管轄）*/
  anchorEdges: number;
  /** children + references entry の総数 */
  registryEntries: number;
  /** 表題 sync を検証した entry 数（対象が存在した entry）。検証が silent skip すると減る */
  titleChecked: number;
  violations: SpineEdgeViolation[];
}

/**
 * doc の最初の `# ` 見出しの text（前後空白を除去）。H1 が無い／空 の場合は
 * null — 呼び出し側は REGISTRY_TARGET_H1_MISSING として違反化する。
 */
export function firstHeading(content: string): string | null {
  for (const line of content.split('\n')) {
    const m = line.match(/^#\s+(.+)$/);
    if (m !== null) return m[1].trim();
  }
  return null;
}

/**
 * specs/** 全 file の双方向 census（純関数: test は合成 fixture で違反検出を
 * unit test できる）。検査は **exact sweep**（ceiling pin ではない）: 新規
 * file が違反 shape で land した時点で RED。
 */
export function auditSpineEdges(
  files: Array<{ rel: string; content: string }>,
): SpineEdgeCensusReport {
  const violations: SpineEdgeViolation[] = [];
  const fileSet = new Set(files.map(f => f.rel));
  /** rel → content（表題 sync の検証対象読み。walk 結果の重複 rel は後勝ち）*/
  const contentByRel = new Map(files.map(f => [f.rel, f.content] as const));
  /** file → その file の各 anchor block が宣言した parent の list */
  const anchorParents = new Map<string, string[]>();
  const registries: SpineRegistryEntry[] = [];
  let anchorEdges = 0;
  let titleChecked = 0;

  for (const { rel, content } of files) {
    for (const block of parseAnchorBlocks(content)) {
      if (block.parentRel === null) continue;
      anchorEdges += 1;
      const arr = anchorParents.get(rel) ?? [];
      arr.push(block.parentRel);
      anchorParents.set(rel, arr);
    }
    registries.push(...parseSpineRegistries(rel, content));
    violations.push(...scanSpineRegistryMarkerDefects(rel, content));
  }

  /** doc → その doc を登録している {holder, kind} の list */
  const registeredOn = new Map<string, Array<{ holderRel: string; kind: SpineRegistryKind }>>();
  for (const entry of registries) {
    if (entry.targetRel === null) {
      violations.push({
        kind: 'REGISTRY_LINK_UNSUPPORTED',
        detail: `${entry.holderRel}:${entry.startLine}: ${entry.kind} entry の link \`${entry.link}\` は specs-relative path でない`,
      });
      continue;
    }
    if (!fileSet.has(entry.targetRel)) {
      violations.push({
        kind: 'REGISTRY_TARGET_MISSING',
        detail: `${entry.holderRel}:${entry.startLine}: ${entry.kind} entry \`${entry.link}\` の対象 \`${entry.targetRel}\` が specs/ に存在しない`,
      });
      continue;
    }
    // 表題 sync（REQ-406）— entry title は対象 doc の最初の H1 と一致する。
    // children / references 両方に適用する同一規則（entry は閲覧入口であり、
    // 表題の stale 化は片方向・双方向を問わない閲覧事故）。
    // 検証した entry 数は titleChecked として報告し、floor pin が
    // 検証の silent skip（対象の見逃し）を差し戻す。
    const targetContent = contentByRel.get(entry.targetRel);
    if (targetContent !== undefined) {
      titleChecked += 1;
      const h1 = firstHeading(targetContent);
      if (h1 === null) {
        violations.push({
          kind: 'REGISTRY_TARGET_H1_MISSING',
          detail: `${entry.holderRel}:${entry.startLine}: ${entry.kind} entry \`${entry.link}\` の対象 \`${entry.targetRel}\` が H1 見出しを持たない（表題 sync の検証不能）`,
        });
      } else if (h1 !== entry.title) {
        violations.push({
          kind: 'REGISTRY_TITLE_DRIFT',
          detail: `${entry.holderRel}:${entry.startLine}: ${entry.kind} entry の表題 \`${entry.title}\` が対象 \`${entry.targetRel}\` の H1 \`${h1}\` と不一致（子の改題を親 index に同一 commit で同期すること — 47d71cd5 sweep 分離 class）`,
        });
      }
    }
    const arr = registeredOn.get(entry.targetRel) ?? [];
    arr.push({ holderRel: entry.holderRel, kind: entry.kind });
    registeredOn.set(entry.targetRel, arr);
  }

  // children は双方向 tree edge: 対象が holder を parent 宣言していること。
  // references は one-way（engine schema）なので対象側 anchor は要求しない。
  for (const entry of registries) {
    if (entry.kind !== 'children' || entry.targetRel === null) continue;
    if (!fileSet.has(entry.targetRel)) continue;
    const declared = anchorParents.get(entry.targetRel);
    if (declared === undefined || !declared.includes(entry.holderRel)) {
      violations.push({
        kind: 'CHILD_BACK_ANCHOR_MISSING',
        detail: `${entry.holderRel}:${entry.startLine}: children entry \`${entry.targetRel}\` は parent \`${entry.holderRel}\` を anchor 宣言していない（宣言値: ${declared === undefined ? 'anchor block なし' : declared.join(', ')}）`,
      });
    }
  }

  for (const [rel, parents] of anchorParents) {
    for (const parent of parents) {
      // `/` を含まない parent は repo root 直下 doc（SYSTEM_CONSTITUTION.md）=
      // top-level root。parent 側 registration 義務なし（role は REQ-388 が検証）。
      if (!parent.includes('/')) continue;
      if (!fileSet.has(parent)) {
        violations.push({
          kind: 'PARENT_DOC_MISSING',
          detail: `${rel}: anchor parent \`${parent}\` が specs/ に存在しない`,
        });
        continue;
      }
      // TASK file の登録粒度は tasks/overview.md（engine schema・実在 288 TASK
      // anchor が全て個別登録なし）。それ以外の doc は landing atomicity が要求。
      if (isTaskFile(rel)) continue;
      const registered = (registeredOn.get(rel) ?? []).some(r => r.holderRel === parent);
      if (!registered) {
        violations.push({
          kind: 'PARENT_UNREGISTERED',
          detail: `${rel}: anchor parent \`${parent}\` 側に本 doc の spine:children / spine:references 登録が無い（spec land 時の parent 側登録 同梱漏れ — c818286f が sweep 修復した事故 class）`,
        });
      }
    }
  }

  return {
    filesChecked: files.length,
    anchorEdges,
    registryEntries: registries.length,
    titleChecked,
    violations,
  };
}
