/**
 * specs mirror marker contract guard (TASK-0249 / REQ-355 / 義務 B 前半 +
 * TASK-0250 / REQ-356 / 義務 B 後半の sync-stamp 拡張).
 *
 * 義務 B（TASK-0243 → TASK-0247 → TASK-0248 §残存 obligation で「未着手の最優先」）
 * の前半: requirements.md（正本）↔ architecture.md（mirror）の二重管理を marker 契約で
 * 機械検査可能にする。Phase 158〜161 で繰り返し発生した債務クラス（実装 commit が
 * specs 同期を漏らし 2〜3 フェーズ後の一括補填 = meta_washed commit 化）と、
 * ai-hub link:spine drift が作業 commit から漏れた ef80df93..463771ee の構造問題を、
 * 「spec tree が契約違反のまま commit されると CI で RED」に変える。
 *
 * 検証は 2 系統:
 *   1. real specs tree — specs/speech-to-visuals/*.md の marker が全て valid であること
 *      （drift が存在すれば即 RED）+ 契約自体の presence pin（marker 削除で RED）
 *   2. 合成 fixture — drift 検出ロジックそのものの正しさ（正本更新・mirror 汚染・
 *      孤立 marker・nest・空 region・正本欠落の各 case がそれぞれ検出できること）
 *
 * TASK-0250 拡張（REQ-356）: 各 region は machine-owned の sync-stamp 行
 * （正本節の正規化 sha256）を 1 つ持つ。stamp は正本節への **あらゆる** 編集を
 * `STALE_SYNC_STAMP` として検出し（token 化されていない変更も逃さない）、
 * 機械解決可能な分は scripts/sync-mirror-from-requirements.ts（npm run
 * specs:mirror:sync）が再生成する。generator 出力が本契約検証を通ること
 * （= 受入検査）も fixture で保証する。
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import {
  computeSourceDigest,
  extractSection,
  parseMirrorMarkers,
  renderSyncStamp,
  validateMirrorRegions,
  type MirrorViolation,
} from './specs-mirror-contract';
import { syncMirrorStamps } from '../../scripts/sync-mirror-from-requirements';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SPECS_DIR = join(REPO_ROOT, 'specs/speech-to-visuals');

function readRealSpecsTree(): { files: string[]; violations: MirrorViolation[] } {
  const files = readdirSync(SPECS_DIR).filter(f => f.endsWith('.md'));
  const violations: MirrorViolation[] = [];
  for (const file of files) {
    const content = readFileSync(join(SPECS_DIR, file), 'utf-8');
    const { regions, violations: structural } = parseMirrorMarkers(file, content);
    violations.push(
      ...validateMirrorRegions(regions, structural, sourceFile => {
        const path = join(SPECS_DIR, sourceFile);
        return existsSync(path) ? readFileSync(path, 'utf-8') : null;
      }),
    );
  }
  return { files, violations };
}

describe('specs mirror marker contract — real specs tree (REQ-355)', () => {
  const { violations } = readRealSpecsTree();

  it('has zero mirror-contract violations across specs/speech-to-visuals/*.md', () => {
    expect(violations).toEqual([]);
  });
});

describe('specs mirror marker contract — contract presence pin (REQ-355)', () => {
  // 契約自体を削除・縮小すると RED。tokens="…" の 10 トークンは
  // 2026-08-20 時点で requirements.md#非機能要件 と architecture.md
  // mirror region の両方に verbatim 存在することを手動検証済み。
  it('architecture.md mirrors requirements.md#非機能要件 with the pinned token set', () => {
    const content = readFileSync(join(SPECS_DIR, 'architecture.md'), 'utf-8');
    const { regions } = parseMirrorMarkers('architecture.md', content);
    const nfr = regions.find(
      r => r.sourceFile === 'requirements.md' && r.section === '非機能要件',
    );
    expect(nfr).toBeDefined();
    expect(nfr ? nfr.tokens : undefined).toEqual([
      '60秒以内',
      '25.2秒',
      '2秒以内',
      '0.5倍',
      '37-45 FPS',
      '20秒以内',
      '環境変数',
      'express-rate-limit',
      'Helmet',
      'Supabase',
    ]);
  });
});

describe('specs mirror marker contract — drift detection fixtures (REQ-355)', () => {
  const SOURCE = [
    '## 非機能要件',
    '',
    '- NFR-001: 処理時間は60秒以内でなければならない',
    '- NFR-004: LLM API レスポンス時間の P95 は20秒以内でなければならない',
    '',
    '## 次の節',
  ].join('\n');

  const START =
    '<!-- mirror:requirements.md#非機能要件:start tokens="60秒以内|20秒以内" -->';
  const END = '<!-- mirror:requirements.md#非機能要件:end -->';

  /** 正本内容に対応する現行の sync-stamp 行（REQ-356）。 */
  function stamp(source = SOURCE): string {
    return renderSyncStamp(
      computeSourceDigest(extractSection(source, '非機能要件') ?? ''),
    );
  }

  function validate(mirrorContent: string, source = SOURCE): MirrorViolation[] {
    const { regions, violations } = parseMirrorMarkers(
      'architecture.md',
      mirrorContent,
    );
    return validateMirrorRegions(regions, violations, () => source);
  }

  it('detects mirror-side drift (正本は 60秒以内・mirror は 90秒以内のまま)', () => {
    const violations = validate(
      ['## 非機能要件の実現方法', START, stamp(), '- 処理時間: 90秒以内（実績25.2秒）', '- LLM: P95 20秒以内', END].join('\n'),
    );
    expect(violations).toEqual([
      expect.objectContaining({ kind: 'TOKEN_MISSING_IN_MIRROR' }),
    ]);
    expect(violations[0].detail).toContain('60秒以内');
  });

  it('detects source-side drift (正本が 90秒以内に更新され mirror が stale)', () => {
    const updatedSource = SOURCE.replace('60秒以内', '90秒以内');
    const violations = validate(
      ['## 非機能要件の実現方法', START, stamp(updatedSource), '- 処理時間: 60秒以内（実績25.2秒）', '- LLM: P95 20秒以内', END].join('\n'),
      updatedSource,
    );
    expect(violations).toEqual([
      expect.objectContaining({ kind: 'TOKEN_MISSING_IN_SOURCE' }),
    ]);
    expect(violations[0].detail).toContain('60秒以内');
  });

  it('passes when both sides carry every declared token', () => {
    const violations = validate(
      ['## 非機能要件の実現方法', START, stamp(), '- 処理時間: 60秒以内（実績25.2秒）', '- LLM: P95 20秒以内', END].join('\n'),
    );
    expect(violations).toEqual([]);
  });

  it('detects an orphan start marker (end marker missing)', () => {
    const violations = validate(
      ['## 非機能要件の実現方法', START, '- 処理時間: 60秒以内'].join('\n'),
    );
    expect(violations.map(v => v.kind)).toContain('ORPHAN_START');
  });

  it('detects an orphan end marker (start marker missing)', () => {
    const violations = validate(
      ['## 非機能要件の実現方法', '- 処理時間: 60秒以内', END].join('\n'),
    );
    expect(violations.map(v => v.kind)).toContain('ORPHAN_END');
  });

  it('detects nested mirror regions', () => {
    const violations = validate(
      ['## 見出し', START, '- 60秒以内', START, '- 20秒以内', END, END].join('\n'),
    );
    expect(violations.map(v => v.kind)).toContain('NESTED_START');
  });

  it('detects an empty mirror region', () => {
    const violations = validate(['## 見出し', START, '', END].join('\n'));
    expect(violations.map(v => v.kind)).toContain('EMPTY_REGION');
  });

  it('detects a missing source file', () => {
    const { regions, violations } = parseMirrorMarkers(
      'architecture.md',
      ['## 見出し', START, '- 60秒以内', END].join('\n'),
    );
    const out = validateMirrorRegions(regions, violations, () => null);
    expect(out.map(v => v.kind)).toContain('MISSING_SOURCE_FILE');
  });

  it('detects a missing source section', () => {
    const violations = validate(
      ['## 見出し', START, '- 60秒以内', END].join('\n'),
      '## 別の節\n- 中身\n',
    );
    expect(violations.map(v => v.kind)).toContain('MISSING_SOURCE_SECTION');
  });

  it('section extraction is exact-match (prefix 見出しを誤 hit しない)', () => {
    // 誤って prefix 側（60秒以内のみ）を掴んだら 20秒以内 が source 側で欠落して RED になる
    const source = '## 非機能要件の実現方法\n- 60秒以内のみ\n\n## 非機能要件\n- 60秒以内・20秒以内\n';
    const violations = validate(
      ['## 見出し', START, stamp(source), '- 60秒以内', '- 20秒以内', END].join('\n'),
      source,
    );
    expect(violations).toEqual([]);
  });
});

describe('specs mirror contract — sync-stamp fixtures (REQ-356)', () => {
  const SOURCE = [
    '## 非機能要件',
    '',
    '- NFR-001: 処理時間は60秒以内でなければならない',
    '- NFR-004: LLM API レスポンス時間の P95 は20秒以内でなければならない',
    '',
    '## 次の節',
  ].join('\n');

  const START =
    '<!-- mirror:requirements.md#非機能要件:start tokens="60秒以内|20秒以内" -->';
  const END = '<!-- mirror:requirements.md#非機能要件:end -->';

  function validate(mirrorContent: string, source = SOURCE): MirrorViolation[] {
    const { regions, violations } = parseMirrorMarkers(
      'architecture.md',
      mirrorContent,
    );
    return validateMirrorRegions(regions, violations, () => source);
  }

  it('detects a missing sync-stamp (npm run specs:mirror:sync で挿入されるべき)', () => {
    const violations = validate(
      ['## 見出し', START, '- 処理時間: 60秒以内', '- LLM: P95 20秒以内', END].join('\n'),
    );
    expect(violations).toEqual([
      expect.objectContaining({ kind: 'MISSING_SYNC_STAMP' }),
    ]);
  });

  it('detects a stale sync-stamp when the source section gained a non-token line (token 検証を素通りする編集でも検出)', () => {
    const updatedSource = `${SOURCE.replace('## 次の節', '- NFR-999: 1動画あたりコストは$0.10以下（token 未宣言の事実）\n\n## 次の節')}`;
    const oldStamp = renderSyncStamp(
      computeSourceDigest(extractSection(SOURCE, '非機能要件') ?? ''),
    );
    const violations = validate(
      ['## 見出し', START, oldStamp, '- 処理時間: 60秒以内', '- LLM: P95 20秒以内', END].join('\n'),
      updatedSource,
    );
    // token は両側に存在する（TOKEN_MISSING_* なし）— stamp だけが正本編集を検出する
    expect(violations).toEqual([
      expect.objectContaining({ kind: 'STALE_SYNC_STAMP' }),
    ]);
  });

  it('detects duplicate sync-stamp lines', () => {
    const s = renderSyncStamp(
      computeSourceDigest(extractSection(SOURCE, '非機能要件') ?? ''),
    );
    const violations = validate(
      ['## 見出し', START, s, s, '- 60秒以内', '- 20秒以内', END].join('\n'),
    );
    expect(violations).toEqual([
      expect.objectContaining({ kind: 'DUPLICATE_SYNC_STAMP' }),
    ]);
  });

  it('detects a malformed sync-stamp line', () => {
    const violations = validate(
      ['## 見出し', START, '<!-- sync:mirror source-digest="not-hex!" -->', '- 60秒以内', '- 20秒以内', END].join('\n'),
    );
    expect(violations).toEqual([
      expect.objectContaining({ kind: 'MALFORMED_MARKER' }),
    ]);
  });

  it('digest normalization ignores trailing whitespace and CRLF noise', () => {
    // 正規化（行末空白・\r・前後空行）を挟んだ同じ内容は同一 digest → 違反ゼロ
    const noisy = (extractSection(SOURCE, '非機能要件') ?? '')
      .split('\n')
      .map(l => `${l}   `)
      .join('\r\n');
    const normalized = renderSyncStamp(computeSourceDigest(noisy));
    const violations = validate(
      ['## 見出し', START, normalized, '- 60秒以内', '- 20秒以内', END].join('\n'),
    );
    expect(violations).toEqual([]);
  });
});

describe('specs mirror sync generator (scripts/sync-mirror-from-requirements.ts / REQ-356)', () => {
  const SOURCE = [
    '## 非機能要件',
    '',
    '- NFR-001: 処理時間は60秒以内でなければならない',
    '- NFR-004: LLM API レスポンス時間の P95 は20秒以内でなければならない',
    '',
    '## 次の節',
  ].join('\n');

  const START =
    '<!-- mirror:requirements.md#非機能要件:start tokens="60秒以内|20秒以内" -->';
  const END = '<!-- mirror:requirements.md#非機能要件:end -->';

  const currentStamp = () =>
    renderSyncStamp(
      computeSourceDigest(extractSection(SOURCE, '非機能要件') ?? ''),
    );

  it('inserts the current sync-stamp into a stamp-less region and is idempotent', () => {
    const content = ['## 見出し', START, '- 処理時間: 60秒以内', '- LLM: P95 20秒以内', END].join('\n');
    const result = syncMirrorStamps('architecture.md', content, () => SOURCE);
    expect(result.errors).toEqual([]);
    expect(result.changedRegions).toBe(1);
    expect(result.content).toContain(currentStamp());
    // 2 回目は no-op（冪等）— build hook として何度実行しても差分が安定する
    const second = syncMirrorStamps('architecture.md', result.content, () => SOURCE);
    expect(second.content).toBe(result.content);
    expect(second.changedRegions).toBe(0);
  });

  it('replaces a stale sync-stamp with the current digest (正本更新後の機械再生成)', () => {
    const stale = renderSyncStamp('000000000000');
    const content = ['## 見出し', START, stale, '- 60秒以内', '- 20秒以内', END].join('\n');
    const result = syncMirrorStamps('architecture.md', content, () => SOURCE);
    expect(result.errors).toEqual([]);
    expect(result.changedRegions).toBe(1);
    expect(result.content).not.toContain(stale);
    expect(result.content).toContain(currentStamp());
  });

  it('refuses to touch a file with structural violations (fail-loud・偽 sync 防止)', () => {
    const content = ['## 見出し', START, '- 60秒以内'].join('\n'); // 孤立 start
    const result = syncMirrorStamps('architecture.md', content, () => SOURCE);
    expect(result.content).toBe(content);
    expect(result.changedRegions).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('skips a region whose source section is missing, leaving content untouched', () => {
    const content = ['## 見出し', START, '- 60秒以内', END].join('\n');
    const result = syncMirrorStamps('architecture.md', content, () => '## 別の節\n- 中身\n');
    expect(result.content).toBe(content);
    expect(result.changedRegions).toBe(0);
    expect(result.errors[0]).toContain('## 非機能要件');
  });

  it('refuses to guess when a region carries duplicate stamps', () => {
    const s = renderSyncStamp('aaaaaaaaaaaa');
    const content = ['## 見出し', START, s, s, '- 60秒以内', END].join('\n');
    const result = syncMirrorStamps('architecture.md', content, () => SOURCE);
    expect(result.content).toBe(content);
    expect(result.errors.join('\n')).toContain('sync-stamp 行が 2 個');
  });

  it('generator output passes the full contract validation（受入検査 = TASK-0249 契約）', () => {
    // 義務 B 後半の受入条件: generator が再生成した region は
    // tokens 双方向検証 + sync-stamp 検証を含む契約検証全体を通る
    const content = ['## 見出し', START, '- 処理時間: 60秒以内', '- LLM: P95 20秒以内', END].join('\n');
    const generated = syncMirrorStamps('architecture.md', content, () => SOURCE).content;
    const { regions, violations } = parseMirrorMarkers('architecture.md', generated);
    expect(validateMirrorRegions(regions, violations, () => SOURCE)).toEqual([]);
  });
});
