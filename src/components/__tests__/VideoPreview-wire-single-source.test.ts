/**
 * TASK-0322 (REQ-426 (b)(d)・TC-410-02): VideoPreview 結線の単一ソース witness。
 *
 * page test (src/pages/__tests__/Index.complete-state.test.tsx) が mount を
 * 立証するのに対し、本 suite は結線後の「形」を source pin で固定する
 * (RED は mount 欠落側が生むため、ここは REMAINS guard として実装後の形を pin する):
 *
 * 1. VideoPreview.tsx は composition を `@/remotion/Video` の既存正典
 *    `SpeechToVisualsVideo` から `calculateTotalFrames` / `DEFAULT_FPS` と
 *    ともに消費している (第二の composition 実装を作らない)
 * 2. `src/` 全域で `SpeechToVisualsVideo` の export 定義は
 *    `src/remotion/Video.tsx` のみ
 * 3. VideoRenderer.tsx は `@remotion/player` を import しない
 *    (死 import 削除の回帰防止 — VideoRenderer が Player を使い始めると
 *    第二の player 実装になる)
 *
 * source 読み取りは import.meta.url 基準 (cwd-relative read は --maxWorkers>1
 * で flake する既知 class — TC-302/313 と同一対処)。
 */
import { readdirSync, readFileSync } from 'fs';
import { join, relative, resolve } from 'path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const srcRoot = resolve(here, '..', '..'); // src/

const videoPreviewSource = readFileSync(
  join(srcRoot, 'components', 'VideoPreview.tsx'),
  'utf-8',
);
const videoRendererSource = readFileSync(
  join(srcRoot, 'components', 'VideoRenderer.tsx'),
  'utf-8',
);

/** src/ 配下の .ts/.tsx 全ファイルを再帰走査して相対 path の一覧を返す */
const walkSourceFiles = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(relative(srcRoot, full));
    }
  }
  return out;
};

describe('TASK-0322 / TC-410-02: VideoPreview 結線の単一ソース', () => {
  it('VideoPreview.tsx は SpeechToVisualsVideo を @/remotion/Video から calculateTotalFrames/DEFAULT_FPS とともに消費している', () => {
    expect(videoPreviewSource).toMatch(
      /import\s*\{\s*SpeechToVisualsVideo,\s*calculateTotalFrames,\s*DEFAULT_FPS\s*\}\s*from\s*'@\/remotion\/Video';/,
    );
  });

  it('src/ 全域で SpeechToVisualsVideo の export 定義は src/remotion/Video.tsx のみであること (第二 composition 実装の不存在)', () => {
    const definitions = walkSourceFiles(srcRoot).filter((rel) =>
      /export\s+(?:const|function|class)\s+SpeechToVisualsVideo\b/.test(
        readFileSync(join(srcRoot, rel), 'utf-8'),
      ),
    );

    expect(definitions).toEqual(['remotion/Video.tsx']);
  });

  it('VideoRenderer.tsx は @remotion/player を import していないこと (死 import 削除の回帰防止)', () => {
    expect(videoRendererSource).not.toMatch(/@remotion\/player/);
  });
});
