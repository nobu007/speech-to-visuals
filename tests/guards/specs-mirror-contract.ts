/**
 * specs mirror marker contract — parser + validator (TASK-0249 / REQ-355 / 義務 B 前半).
 *
 * 義務 B（TASK-0243 §義務 B → TASK-0247 §残存 obligation で DoD concrete 化）は
 * 「requirements.md（正本）と architecture.md（mirror）の二重管理を人間の手作業に頼らず
 * 機械再生成可能にする」ことを目的とし、その第一步として **marker 契約を先行** させる
 * （契約なき自動生成は偽 sync を生む — TASK-0247 調査結果 3）。
 *
 * 契約（本ヘルパーが検証する唯一の構文）:
 *
 *   <!-- mirror:requirements.md#非機能要件:start tokens="60秒以内|25.2秒|…" -->
 *   …mirror region（正本の当該 ## 節の事実を prose で言い換えた領域）…
 *   <!-- mirror:requirements.md#非機能要件:end -->
 *
 * - `sourceFile` は marker を置くファイルと同じディレクトリ内の正本ファイル名。
 * - `section` は正本の `## <section>` 見出し（完全一致）。節は次の `## ` まで。
 * - `tokens` は `|` 区切りの verbatim トークン列。**双方向** に検証する:
 *     1. 各トークンが正本の当該節に存在すること（marker が正本に無い事実を
 *        正典と偽って主張しない）
 *     2. 各トークンが mirror region 内に存在すること（正本更新が mirror に
 *        伝播していない drift の検出）
 * - spine 系 marker（`<!-- spine:children:* -->` 等・ai-hub link:spine 管理）は
 *   **別系統**。本契約は spine ブロックの再生成を扱わない。
 *
 * ## sync-stamp（TASK-0250 / REQ-356 / 義務 B 後半で追加）
 *
 * 各 region の body 内に **machine-owned** の stamp 行を 1 つだけ持つ:
 *
 *   <!-- sync:mirror source-digest="a1b2c3d4e5f6" -->
 *
 * `source-digest` は正本の当該 ## 節 body の正規化 sha256（先頭 12 hex）。
 * 正本節への **あらゆる** 編集（token 化されていない事実の変更・追記・削除を
 * 含む）が stamp との不一致 = `STALE_SYNC_STAMP` として RED になる。機械的に
 * 解決できる部分（stamp 再生成）は `npm run specs:mirror:sync`（generator）が
 * 担い、token 事实上の drift（人手の curation が必要な部分）だけを人間に残す —
 * これが義務 B「人間の手作業経由ではなく build hook での再生成」の分割線。
 * stamp 行は generator 所有・marker 行と prose は人間所有。
 *
 * validator は純関数（ファイル読み込みは inject された reader 経由）なので、
 * 合成 fixture で drift 検出そのものを unit test できる。
 */

import { createHash } from 'node:crypto';

/** 1 组の mirror marker で囲まれた領域。行番号は 1-based。 */
export interface MirrorRegion {
  /** marker を含むファイルの相対パス表示名（violation detail 用） */
  mirrorFile: string;
  sourceFile: string;
  section: string;
  tokens: string[];
  startLine: number;
  endLine: number;
  /** start/end marker の間の行（marker 自身を含まない） */
  body: string;
}

export type MirrorViolationKind =
  | 'MALFORMED_MARKER'
  | 'NESTED_START'
  | 'ORPHAN_START'
  | 'ORPHAN_END'
  | 'EMPTY_REGION'
  | 'MISSING_SOURCE_FILE'
  | 'MISSING_SOURCE_SECTION'
  | 'TOKEN_MISSING_IN_SOURCE'
  | 'TOKEN_MISSING_IN_MIRROR'
  | 'MISSING_SYNC_STAMP'
  | 'DUPLICATE_SYNC_STAMP'
  | 'STALE_SYNC_STAMP';

export interface MirrorViolation {
  kind: MirrorViolationKind;
  detail: string;
}

export interface MirrorParseResult {
  regions: MirrorRegion[];
  violations: MirrorViolation[];
}

/** start marker を読んだ直後〜対応する end marker までの region の作業状態。 */
interface OpenMirrorRegion {
  sourceFile: string;
  section: string;
  tokens: string[];
  startLine: number;
  bodyLines: string[];
}

const START_RE =
  /^<!--\s*mirror:([^#\s]+)#([^:]+):start(?:\s+tokens="([^"]*)")?\s*-->$/;
const END_RE = /^<!--\s*mirror:([^#\s]+)#([^:]+):end\s*-->$/;

/**
 * 1 ファイル分の mirror marker を parse する。
 * 構造違反（nest / orphan / empty）はここで violation 化する。
 */
export function parseMirrorMarkers(
  mirrorFile: string,
  content: string,
): MirrorParseResult {
  const regions: MirrorRegion[] = [];
  const violations: MirrorViolation[] = [];
  // CRLF 安全化: 行末 \r が marker の $ マッチを壊さないようにする
  const lines = content.split('\n').map(l => l.replace(/\r$/, ''));

  // 未閉鎖 region の hold。`= null` initializer を付けると CFA が closure 内の
  // 代入を見られず（forEach callback でのみ代入される）外側の read を
  // `null` 狭化のまま固定し、ループ後の `if (open)` truthy 分岐を `never` に
  // 落とす（TS2339）。initializer なし + 宣言型に undefined を含める holder
  // なら read は宣言型のまま narrow され TS2454 も発火しない（Phase 168 の
  // `.catch()` holder と同じ gotcha 家系）。
  let open: OpenMirrorRegion | undefined;

  lines.forEach((line, idx) => {
    const lineNumber = idx + 1;
    const start = line.match(START_RE);
    const end = line.match(END_RE);

    if (start) {
      if (open) {
        violations.push({
          kind: 'NESTED_START',
          detail: `${mirrorFile}:${lineNumber} — mirror region を nest できない（${open.sourceFile}#${open.section} が未閉鎖のまま新しい start がある）`,
        });
        return;
      }
      const tokens = (start[3] ?? '')
        .split('|')
        .map(t => t.trim())
        .filter(t => t.length > 0);
      open = {
        sourceFile: start[1],
        section: start[2],
        tokens,
        startLine: lineNumber,
        bodyLines: [],
      };
      return;
    }

    if (end) {
      if (!open) {
        violations.push({
          kind: 'ORPHAN_END',
          detail: `${mirrorFile}:${lineNumber} — 対応する start の無い end marker（${end[1]}#${end[2]}）`,
        });
        return;
      }
      if (
        open.sourceFile !== end[1] ||
        open.section !== end[2]
      ) {
        violations.push({
          kind: 'MALFORMED_MARKER',
          detail: `${mirrorFile}:${lineNumber} — start（${open.sourceFile}#${open.section}）と end（${end[1]}#${end[2]}）の対が不一致`,
        });
        return;
      }
      const body = open.bodyLines.join('\n');
      if (body.trim().length === 0) {
        violations.push({
          kind: 'EMPTY_REGION',
          detail: `${mirrorFile}:${open.startLine} — mirror region が空（再生成対象の prose が無い）`,
        });
      }
      regions.push({
        mirrorFile,
        sourceFile: open.sourceFile,
        section: open.section,
        tokens: open.tokens,
        startLine: open.startLine,
        endLine: lineNumber,
        body,
      });
      open = undefined;
      return;
    }

    if (open) {
      open.bodyLines.push(line);
    }
  });

  if (open) {
    violations.push({
      kind: 'ORPHAN_START',
      detail: `${mirrorFile}:${open.startLine} — 対応する end marker が無い（${open.sourceFile}#${open.section}）`,
    });
  }

  return { regions, violations };
}

/**
 * 正本ファイルから `## <section>` 節（次の `## ` まで）を抽出する。
 * 見出しは完全一致（`## 非機能要件` のみ hit・`## 非機能要件の実現方法` は非 hit）。
 */
export function extractSection(
  sourceContent: string,
  section: string,
): string | null {
  const lines = sourceContent.split('\n').map(l => l.replace(/\r$/, ''));
  const heading = `## ${section}`;
  const start = lines.findIndex(l => l.trim() === heading);
  if (start === -1) {
    return null;
  }
  const rest = lines.slice(start + 1);
  const nextH2 = rest.findIndex(l => /^## /.test(l));
  const body = nextH2 === -1 ? rest : rest.slice(0, nextH2);
  return body.join('\n');
}

/** stamp 行の検出（値の形式は問わず「stamp 行である」ことの判定のみ）。 */
export const SYNC_STAMP_DETECT_RE = /^<!--\s*sync:mirror\b/;
/** stamp 行から source-digest 値を抽出する（形式が正しい場合のみ match）。 */
export const SYNC_STAMP_VALUE_RE =
  /^<!--\s*sync:mirror\s+source-digest="([0-9a-f]+)"\s*-->$/;

/**
 * 節 body の正規化: 行末 \r と行末空白を落とし、前後の空行を除去する。
 * 改行種・trailing whitespace の違いで digest が揺れないための正規化であり、
 * 内容の意味変更は正規化で消えない（= 検出漏れにならない）。
 */
function normalizeSectionBody(body: string): string {
  const lines = body
    .split('\n')
    .map(l => l.replace(/\r$/, '').replace(/[ \t]+$/, ''));
  while (lines.length > 0 && lines[0].trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
  return lines.join('\n');
}

/** 正本節 body の正規化 sha256（先頭 12 hex）— sync-stamp の値。 */
export function computeSourceDigest(sectionBody: string): string {
  return createHash('sha256')
    .update(normalizeSectionBody(sectionBody), 'utf-8')
    .digest('hex')
    .slice(0, 12);
}

/** digest 値から stamp 行を組み立てる（generator が挿入する唯一の形式）。 */
export function renderSyncStamp(digest: string): string {
  return `<!-- sync:mirror source-digest="${digest}" -->`;
}

/**
 * parse 済み region 群を 正本 内容と照合して drift を検出する。
 * `readSource` は sourceFile 名 → 内容（or null = ファイル無し）を返す inject 可能 reader。
 */
export function validateMirrorRegions(
  regions: MirrorRegion[],
  structural: MirrorViolation[],
  readSource: (sourceFile: string) => string | null,
): MirrorViolation[] {
  const violations = [...structural];

  for (const region of regions) {
    const where = `${region.mirrorFile}:${region.startLine}`;
    const src = readSource(region.sourceFile);
    if (src === null) {
      violations.push({
        kind: 'MISSING_SOURCE_FILE',
        detail: `${where} — 正本ファイル ${region.sourceFile} が読めない`,
      });
      continue;
    }
    const sectionBody = extractSection(src, region.section);
    if (sectionBody === null) {
      violations.push({
        kind: 'MISSING_SOURCE_SECTION',
        detail: `${where} — 正本 ${region.sourceFile} に節 '## ${region.section}' が無い`,
      });
      continue;
    }
    for (const token of region.tokens) {
      if (!sectionBody.includes(token)) {
        violations.push({
          kind: 'TOKEN_MISSING_IN_SOURCE',
          detail: `${where} — トークン "${token}" が正本 ${region.sourceFile}#${region.section} に無い（正本と marker のどちらかが stale）`,
        });
      }
      if (!region.body.includes(token)) {
        violations.push({
          kind: 'TOKEN_MISSING_IN_MIRROR',
          detail: `${where} — トークン "${token}" が mirror region に無い（正本更新が mirror に未伝播 = drift）`,
        });
      }
    }

    // sync-stamp: 正本節の現 digest と region 内 stamp の一致（TASK-0250 / REQ-356）。
    // token 検証は「契約化された事実」の変化だけを見る。stamp は正本節への
    // あらゆる編集を検知し、機械解決可能な分（stamp 再生成）を generator に渡す。
    const stampLines = region.body
      .split('\n')
      .filter(l => SYNC_STAMP_DETECT_RE.test(l));
    if (stampLines.length === 0) {
      violations.push({
        kind: 'MISSING_SYNC_STAMP',
        detail: `${where} — sync-stamp 行（<!-- sync:mirror source-digest="…" -->）が無い。npm run specs:mirror:sync で挿入される`,
      });
    } else if (stampLines.length > 1) {
      violations.push({
        kind: 'DUPLICATE_SYNC_STAMP',
        detail: `${where} — sync-stamp 行が ${stampLines.length} 個ある（1 region に 1 つ）`,
      });
    } else {
      const match = stampLines[0].match(SYNC_STAMP_VALUE_RE);
      if (!match) {
        violations.push({
          kind: 'MALFORMED_MARKER',
          detail: `${where} — sync-stamp 行の形式が不正: "${stampLines[0].trim()}"（renderSyncStamp の形式であること）`,
        });
      } else if (match[1] !== computeSourceDigest(sectionBody)) {
        violations.push({
          kind: 'STALE_SYNC_STAMP',
          detail: `${where} — 正本 ${region.sourceFile}#${region.section} が更新されたあと stamp が再生成されていない（stamp=${match[1]}・現 digest=${computeSourceDigest(sectionBody)}）。npm run specs:mirror:sync で再生成し、token 事实上の変更があれば marker と prose も更新すること`,
        });
      }
    }
  }

  return violations;
}
