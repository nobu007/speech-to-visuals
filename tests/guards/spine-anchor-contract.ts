/**
 * spine anchor role 契約 — parser / role 導出 / normalizer / census auditor
 * (Phase 186 / TASK-0270 / REQ-388 / TC-372 / MW-052).
 *
 * specs 内 child ドキュメントの先頭に置かれる spine anchor block:
 *
 *   <!-- spine:anchor:begin -->
 *   > **Spine anchor**: [speech-to-visuals アーキテクチャ設計](../architecture.md)
 *   >
 *   > - parent: `speech-to-visuals/architecture.md`
 *   > - role: `detailed`
 *   > - status: `canonical_child`
 *   <!-- spine:anchor:end -->
 *
 * は hub 側 doc-spine engine（~/instructions/guides/principles/documentation/spine.py
 * — `_render_anchor_block` / `_classify_filename` / `_role_for_spine_node`）が
 * manifest の parent edge から機械生成するもの。manifest（specs/_doc_spine.yml）は
 * auto-generated・gitignored で clean checkout には存在しないため、engine の
 * sync_anchors は本 repo では常時走らず、role 行は各 run が手で 1〜2 file ずつ
 * 滴下する状態が恒常化していた（make-run steering 指摘: 「role行なしspecが90件超残る。
 * 2行ずつの滴下を繰り返さないこと」「末端掃込みコミットでanchorスキーマ修正を
 * 雑扱いしないこと」）。
 *
 * 本モジュールはその engine の **role 導出規則のみ** を TypeScript に移植し:
 *
 *   1. census auditor — specs/** の全 anchor block が (a) role 行を持ち
 *      (b) その値が導出規則と一致することを exact sweep で検証
 *      （新規 TASK file が anchor/role なしで land すると即 RED — 滴下の再発防止）
 *   2. normalizer — role 行の欠けた block への 1 行挿入と、tasks/TASK-*.md
 *      への anchor block 新規挿入（spine.py `_apply_anchor` と同じ挿入位置規則）
 *
 * を提供する。normalizer は純関数（書き込みは CLI 側）なので合成 fixture で
 * unit test できる。`--check` は census auditor と同じ検証を CLI で回す
 * drift detector（書き込みなし）。
 *
 * ⚠️ path 表現の罠（移植時の最大注意点）: `_classify_filename` は rel を
 * **specs/ からの相対**（例: `speech-to-visuals/tasks/TASK-0109.md`）として受ける。
 * repo-relative（`specs/...` prefix 付き）で渡すと "spec" substring が全 path に
 * hit して全件 `reference` に退化する（engine の旧 form 互換 `specs/<name>/...`
 * 受けでも同様の縮退が起きうる engine 側 quirk）。本モジュールの API は
 * specs-relative のみを受け付け、repo-relative を渡したら fail-loud に落とす。
 */

/** anchor block の境界 marker（spine.py SPINE_ANCHOR_BEGIN / SPINE_ANCHOR_END の移植）。 */
export const SPINE_ANCHOR_BEGIN = '<!-- spine:anchor:begin -->';
export const SPINE_ANCHOR_END = '<!-- spine:anchor:end -->';

/**
 * role 語彙 — spine.py `_classify_filename`（system/method/detailed/reference）
 * + `_role_for_spine_node` の top-level 2 値（feature_root/system_design_root）。
 * この語彙外の role 行は census で違反になる。
 */
export const SPINE_ROLES = [
  'system',
  'method',
  'detailed',
  'reference',
  'feature_root',
  'system_design_root',
] as const;
export type SpineRole = (typeof SPINE_ROLES)[number];

/** spine.py SYSTEM_DESIGN_TOKENS（token は basename の部分一致・大小同一視）。 */
const SYSTEM_DESIGN_TOKENS = ['architecture', 'DESIGN', 'system-design', 'system_design'];
/** spine.py METHOD_DESIGN_TOKENS。 */
const METHOD_DESIGN_TOKENS = ['method', 'approach', 'policy', 'playbook', 'guide'];
/** spine.py DETAILED_DESIGN_TOKENS。 */
const DETAILED_DESIGN_TOKENS = ['detail', 'implementation', 'spec'];

/**
 * `_classify_filename` の移植（specs-relative path → bucket role）。
 *
 * 評価順（spine.py と同じ・順序が契約）:
 *   1. basename に SYSTEM token 部分一致 → `system`
 *   2. basename に METHOD token 部分一致 → `method`
 *   3. basename に DETAILED token 部分一致 → `detailed`
 *   4. path に `/api` / `schema` / `spec` → `reference`
 *   5. fallback → `detailed`
 *
 * 実例（本 repo の実在値が全てこの規則で再現される）:
 * design-interview.md → system・architecture.md → system・
 * api-endpoints.md → reference・TASK-*.md → detailed。
 */
export function classifySpineFilename(specsRel: string): SpineRole {
  assertSpecsRelative(specsRel);
  const low = specsRel.toLowerCase();
  // tsconfig.test の lib は ES2020（Array.prototype.at が無い）なので添字算出。
  const segs = specsRel.split('/');
  const name = (segs[segs.length - 1] ?? specsRel).toLowerCase();
  if (SYSTEM_DESIGN_TOKENS.some(t => name.includes(t.toLowerCase()))) return 'system';
  if (METHOD_DESIGN_TOKENS.some(t => name.includes(t.toLowerCase()))) return 'method';
  if (DETAILED_DESIGN_TOKENS.some(t => name.includes(t.toLowerCase()))) return 'detailed';
  if (low.includes('/api') || low.includes('schema') || low.includes('spec')) {
    return 'reference';
  }
  return 'detailed';
}

/**
 * `_feature_id_from_path` の移植。specs-relative の第 1 path 成分が feature id
 * （`speech-to-visuals/tasks/TASK-0109.md` → `speech-to-visuals`）。
 * 第 1 成分しか無い（= feature dir 直下ではなく specs 直下の file）なら null。
 */
export function featureIdFromPath(specsRel: string): string | null {
  assertSpecsRelative(specsRel);
  const parts = specsRel.split('/');
  return parts.length >= 2 ? parts[0] : null;
}

/**
 * `_role_for_spine_node` の移植 — anchor の parent edge から role を導出。
 *
 * engine では manifest tree の top-level 判定を使うが、manifest は本 repo に
 * 常在しないため、ここでは **anchor 自身の parent 表記** で代用する:
 * parent が repo root 直下（path に `/` を含まない = `SYSTEM_CONSTITUTION.md` 等）
 * なら top-level 扱い。これは manifest topology の近似だが、実在 241 block の
 * 親子関係（root 親 = feature_root 2 件・それ以外は全て feature 内 parent）を
 * 破壊しない。top-level なら feature id が切れる場合 `feature_root`、
 * 切れない場合 `system_design_root`（spine.py と同じ分岐）。
 */
export function deriveSpineRole(
  specsRel: string,
  parentRel: string | null,
): SpineRole {
  const isTopLevel = parentRel !== null && !parentRel.includes('/');
  if (isTopLevel) {
    return featureIdFromPath(specsRel) !== null ? 'feature_root' : 'system_design_root';
  }
  return classifySpineFilename(specsRel);
}

/** 解析済み anchor block。行番号は 1-based（block 全体を含む）。 */
export interface SpineAnchorBlock {
  /** 1-based・block 全体（begin〜end marker 含む）の行範囲 */
  startLine: number;
  endLine: number;
  /** `> - parent: \`...\` の値（無ければ null = 構造違反） */
  parentRel: string | null;
  /** `> - role: \`...\` の値（欠けていれば null = 挿入対象 / 違反対象） */
  role: string | null;
  /** `> - status: \`...\` の値 */
  status: string | null;
}

/** anchor block を全て解析。block 内の最初の該当 field 行を採る。 */
export function parseAnchorBlocks(content: string): SpineAnchorBlock[] {
  const blocks: SpineAnchorBlock[] = [];
  const lines = content.split('\n');
  let current: { startLine: number; lines: string[] } | null = null;
  lines.forEach((line, idx) => {
    if (line.trim() === SPINE_ANCHOR_BEGIN) {
      current = current ?? { startLine: idx + 1, lines: [] };
    } else if (line.trim() === SPINE_ANCHOR_END && current !== null) {
      blocks.push(toBlock(current.lines, current.startLine, idx + 1));
      current = null;
    } else if (current !== null) {
      current.lines.push(line);
    }
  });
  // 閉じ marker の無い begin も block としては数えない（spine.py の
  // 非破損 block との意味論を揃える）。その file は census 側で
  // 「正規形 block が 0 個」として違反になるため、ここで特別扱いしない。
  return blocks;
}

/** 正規形は `> - parent: `value``（backtick は値のみを包む）。値が無ければ null。 */
const ANCHOR_FIELD_RES: Record<'parent' | 'role' | 'status', RegExp> = {
  parent: /^>\s*-\s*parent:(?:\s*`([^`]+)`)?/,
  role: /^>\s*-\s*role:(?:\s*`([^`]+)`)?/,
  status: /^>\s*-\s*status:(?:\s*`([^`]+)`)?/,
};

function toBlock(bodyLines: string[], startLine: number, endLine: number): SpineAnchorBlock {
  const pick = (key: 'parent' | 'role' | 'status'): string | null => {
    for (const line of bodyLines) {
      const m = line.match(ANCHOR_FIELD_RES[key]);
      if (m !== null) return m[1] ?? null;
    }
    return null;
  };
  return {
    startLine,
    endLine,
    parentRel: pick('parent'),
    role: pick('role'),
    status: pick('status'),
  };
}

/**
 * spine.py `_render_anchor_block` の移植 — parent・role・status が揃った
 * 正規形 block を生成（title/link は呼び出し側が parent doc から解決して渡す）。
 */
export function renderAnchorBlock(args: {
  title: string;
  link: string;
  parentRel: string;
  role: SpineRole;
  status?: string;
}): string {
  const status = args.status ?? 'canonical_child';
  return [
    SPINE_ANCHOR_BEGIN,
    `> **Spine anchor**: [${args.title}](${args.link})`,
    '>',
    `> - parent: \`${args.parentRel}\``,
    `> - role: \`${args.role}\``,
    `> - status: \`${status}\``,
    SPINE_ANCHOR_END,
  ].join('\n');
}

/** normalizer が 1 file に施した操作。`none` = 何も変えていない（冪等）。 */
export type AnchorNormalizeAction =
  | 'none'
  /** anchor block は有るが role 行が無い → 導出 role の 1 行を parent 行の直後に挿入 */
  | 'inserted-role'
  /** tasks/TASK-*.md に anchor block が無い → 正規形 block を H1 直後に挿入 */
  | 'inserted-block';

export interface AnchorNormalizeResult {
  content: string;
  action: AnchorNormalizeAction;
  /** 挿入/検証に使った導出 role（`none` の場合も既存 role の再導出値を返す） */
  role: SpineRole;
}

/**
 * anchor 未挿入の TASK file への既定 parent。実在 216 block の親子関係が
 * これを規定する: TASK file の parent は**自 feature の architecture.md ではなく
 * root feature（SYSTEM_CONSTITUTION 直下に anchor する feature）の
 * architecture.md**（sibling feature の tasks/overview.md も同 parent）。
 */
export interface TaskAnchorDefaults {
  /** root feature の architecture.md（specs-relative・例: `speech-to-visuals/architecture.md`） */
  parentRel: string;
  /** その doc の H1 title（anchor link text に使う） */
  parentTitle: string;
}

/**
 * 全 specs file の既存 anchor block から root feature を発見して
 * {@link TaskAnchorDefaults} を導出。root 判定は deriveSpineRole と同じ
 * 近似（parent が `/` を含まない = repo root 直下 doc が親）。
 * root の architecture.md が複数 hit したら sort 順 1 件目、無ければ fail-loud。
 */
export function deriveTaskAnchorDefaults(
  files: Array<{ rel: string; content: string }>,
): TaskAnchorDefaults {
  const rootDocs = files
    .filter(({ content }) =>
      parseAnchorBlocks(content).some(b => b.parentRel !== null && !b.parentRel.includes('/')),
    )
    .map(({ rel }) => rel);
  const architecture = rootDocs.filter(rel => rel.split('/').pop() === 'architecture.md');
  const chosen = architecture[0] ?? rootDocs[0];
  if (chosen === undefined) {
    throw new Error(
      'root feature doc（parent が repo root 直下の anchor を持つ architecture.md）が specs/ に存在しない — TASK file への既定 parent を導出できない',
    );
  }
  const rootDoc = files.find(f => f.rel === chosen);
  if (rootDoc === undefined) {
    throw new Error(`root feature doc の内容が読めない: ${chosen}`);
  }
  const h1 = rootDoc.content.match(/^# .+$/m);
  return { parentRel: chosen, parentTitle: h1 !== null ? h1[0].slice(2) : chosen };
}

/**
 * 1 file 分の bounded 正規化（純関数・書き込みなし）。
 *
 * 既存 role 行が導出値と**不一致**の場合は書き換えない（fail-loud 方針:
 * 静かな書き換えは人間の curation を踏み潰す。不一致は census auditor が
 * 違反として差し戻す）。冪等: 正規形の file は `none` を返す。
 *
 * block 新規挿入の位置は spine.py `_apply_anchor` と同じ:
 * frontmatter の後 → 無ければ最初の H1 の後 → 無ければ file 先頭。
 */
export function normalizeAnchorRole(
  specsRel: string,
  content: string,
  defaults: TaskAnchorDefaults,
): AnchorNormalizeResult {
  const blocks = parseAnchorBlocks(content);
  if (blocks.length > 0) {
    const block = blocks[0];
    const role = deriveSpineRole(specsRel, block.parentRel);
    if (block.role !== null) {
      return { content, action: 'none', role };
    }
    return { content: insertRoleLine(content, block, role), action: 'inserted-role', role };
  }

  // anchor block が無い file: tasks/TASK-*.md に限り正規形 block を挿入する。
  // （それ以外の specs file の anchor の有無は spine engine の outsider 判断に
  // 属する — normalizer が edge を捏造しない、という境界。）
  if (!isTaskFile(specsRel)) {
    return { content, action: 'none', role: classifySpineFilename(specsRel) };
  }
  const role = deriveSpineRole(specsRel, defaults.parentRel);
  const block = renderAnchorBlock({
    title: defaults.parentTitle,
    link: relativeLink(specsRel, defaults.parentRel),
    parentRel: defaults.parentRel,
    role,
  });
  return { content: insertBlockAfterHeading(content, block), action: 'inserted-block', role };
}

/** from file（specs-relative）の置かれた dir から to（specs-relative）への相対 link。 */
export function relativeLink(fromFile: string, toFile: string): string {
  const fromParts = fromFile.split('/').slice(0, -1);
  const toParts = toFile.split('/');
  let common = 0;
  while (common < fromParts.length && common < toParts.length - 1 && fromParts[common] === toParts[common]) {
    common++;
  }
  const ups = fromParts.length - common;
  const downs = toParts.slice(common).join('/');
  return ups === 0 ? downs : `${'../'.repeat(ups)}${downs}`;
}

/**
 * `specs/<feature>/tasks/TASK-\d+.md` shape 判定（単一実装 — spine-edge-contract
 * の TASK exempt 判定もここに委譲。REQ-402）。
 */
export function isTaskFile(specsRel: string): boolean {
  const parts = specsRel.split('/');
  return parts.length === 3 && parts[1] === 'tasks' && /^TASK-\d+\.md$/.test(parts[2]);
}

function insertRoleLine(content: string, block: SpineAnchorBlock, role: SpineRole): string {
  const lines = content.split('\n');
  // parent 行（block 内）の直後へ。parent 行が無い block は構造違反なので
  // 触らない（census が別途違反として扱う）— 壊れた block の周辺を書き換えると偽 sync になる。
  for (let i = block.startLine - 1; i < block.endLine - 1; i++) {
    const line = lines[i];
    if (line !== undefined && /^>\s*-\s*`?parent`?:/.test(line)) {
      lines.splice(i + 1, 0, `> - role: \`${role}\``);
      return lines.join('\n');
    }
  }
  return content;
}

function insertBlockAfterHeading(content: string, block: string): string {
  // spine.py _apply_anchor と同じ挿入位置: frontmatter → H1 → 先頭。
  const fm = content.match(/^(---|\+\+\+)\n[\s\S]*?\n\1\n/);
  if (fm !== null) {
    return content.slice(0, fm[0].length) + '\n' + block + '\n' + content.slice(fm[0].length);
  }
  const h1 = content.match(/^# .+$/m);
  if (h1 !== null && h1.index !== undefined) {
    const insertAt = h1.index + h1[0].length + 1; // H1 行末の \n の直後
    return content.slice(0, insertAt) + '\n' + block + '\n' + content.slice(insertAt);
  }
  return block + '\n' + content;
}

/** census 違反の種別。detail は file:line 付きで人間が読める形。 */
export type AnchorViolationKind =
  /** anchor block 内に role 行が無い（滴下の再発 = まさに今回撲滅対象） */
  | 'ROLE_LINE_MISSING'
  /** role 行の値が導出規則と不一致（engine が再生成すると違う値になる） */
  | 'ROLE_VALUE_MISMATCH'
  /** role 行の値が語彙外 */
  | 'ROLE_UNKNOWN'
  /** parent 行が無い（role 導出の入力にならない構造違反） */
  | 'PARENT_LINE_MISSING'
  /** tasks/TASK-*.md に anchor block が無い（新規 TASK file の land 忘れ） */
  | 'TASK_ANCHOR_MISSING';

export interface AnchorViolation {
  kind: AnchorViolationKind;
  detail: string;
}

export interface AnchorCensusReport {
  filesChecked: number;
  anchorBlocks: number;
  roleLines: number;
  violations: AnchorViolation[];
}

/**
 * specs/** 全 file の census。渡す files は specs-relative rel + 読み済み content
 * （純関数: test は合成 fixture で違反検出を unit test できる）。
 *
 * 検査は **exact sweep**（ceiling pin ではない）: 新規 file が違反 shape で
 * land した時点で RED。pin するのは件数ではなく「全ての block が正規形である」こと。
 */
export function auditSpineAnchors(
  files: Array<{ rel: string; content: string }>,
): AnchorCensusReport {
  const violations: AnchorViolation[] = [];
  let anchorBlocks = 0;
  let roleLines = 0;

  for (const { rel, content } of files) {
    const blocks = parseAnchorBlocks(content);
    anchorBlocks += blocks.length;

    if (isTaskFile(rel) && blocks.length === 0) {
      violations.push({
        kind: 'TASK_ANCHOR_MISSING',
        detail: `${rel}: TASK file に spine anchor block が無い（H1 直後に正規形 block が必要）`,
      });
    }

    for (const block of blocks) {
      if (block.parentRel === null) {
        violations.push({
          kind: 'PARENT_LINE_MISSING',
          detail: `${rel}:${block.startLine}: anchor block に parent 行が無い`,
        });
        continue;
      }
      const derived = deriveSpineRole(rel, block.parentRel);
      if (block.role === null) {
        violations.push({
          kind: 'ROLE_LINE_MISSING',
          detail: `${rel}:${block.startLine}: role 行が無い（導出値: \`${derived}\`）`,
        });
      } else {
        roleLines++;
        if (!isSpineRole(block.role)) {
          violations.push({
            kind: 'ROLE_UNKNOWN',
            detail: `${rel}:${block.startLine}: role \`${block.role}\` は語彙外 (${SPINE_ROLES.join('/')})`,
          });
        } else if (block.role !== derived) {
          violations.push({
            kind: 'ROLE_VALUE_MISMATCH',
            detail: `${rel}:${block.startLine}: role \`${block.role}\` は導出値 \`${derived}\` と不一致`,
          });
        }
      }
    }
  }

  return {
    filesChecked: files.length,
    anchorBlocks,
    roleLines,
    violations,
  };
}

function isSpineRole(value: string): value is SpineRole {
  return (SPINE_ROLES as readonly string[]).includes(value);
}

function assertSpecsRelative(specsRel: string): void {
  if (specsRel.startsWith('specs/') || specsRel.startsWith('/')) {
    throw new Error(
      `spine-anchor-contract は specs-relative path を受ける（recieved: \`${specsRel}\`）。` +
        ' repo-relative を渡すと "spec" substring が全件 `reference` に退化する（_classify_filename の既知 quirk）。',
    );
  }
}
