/**
 * specs mirror marker contract guard (TASK-0249 / REQ-355 / 義務 B 前半).
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
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import {
  parseMirrorMarkers,
  validateMirrorRegions,
  type MirrorViolation,
} from './specs-mirror-contract';

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

  function validate(mirrorContent: string, source = SOURCE): MirrorViolation[] {
    const { regions, violations } = parseMirrorMarkers(
      'architecture.md',
      mirrorContent,
    );
    return validateMirrorRegions(regions, violations, () => source);
  }

  it('detects mirror-side drift (正本は 60秒以内・mirror は 90秒以内のまま)', () => {
    const violations = validate(
      ['## 非機能要件の実現方法', START, '- 処理時間: 90秒以内（実績25.2秒）', '- LLM: P95 20秒以内', END].join('\n'),
    );
    expect(violations).toEqual([
      expect.objectContaining({ kind: 'TOKEN_MISSING_IN_MIRROR' }),
    ]);
    expect(violations[0].detail).toContain('60秒以内');
  });

  it('detects source-side drift (正本が 90秒以内に更新され mirror が stale)', () => {
    const updatedSource = SOURCE.replace('60秒以内', '90秒以内');
    const violations = validate(
      ['## 非機能要件の実現方法', START, '- 処理時間: 60秒以内（実績25.2秒）', '- LLM: P95 20秒以内', END].join('\n'),
      updatedSource,
    );
    expect(violations).toEqual([
      expect.objectContaining({ kind: 'TOKEN_MISSING_IN_SOURCE' }),
    ]);
    expect(violations[0].detail).toContain('60秒以内');
  });

  it('passes when both sides carry every declared token', () => {
    const violations = validate(
      ['## 非機能要件の実現方法', START, '- 処理時間: 60秒以内（実績25.2秒）', '- LLM: P95 20秒以内', END].join('\n'),
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
    const violations = validate(
      ['## 見出し', START, '- 60秒以内', '- 20秒以内', END].join('\n'),
      '## 非機能要件の実現方法\n- 60秒以内のみ\n\n## 非機能要件\n- 60秒以内・20秒以内\n',
    );
    expect(violations).toEqual([]);
  });
});
