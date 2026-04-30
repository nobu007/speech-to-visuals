import {
  handleRenderVideo,
  validateRenderRequest,
  RENDER_TIMEOUT_MS,
} from '../../../supabase/functions/render-video/index';

const USER_ID = 'user-test-003';

const BASIC_SCENES = [
  { type: 'flow', nodes: [], edges: [], startMs: 0, durationMs: 5000 },
];

// ─── validateRenderRequest Tests ─────────────────────────────────────────────

describe('validateRenderRequest', () => {
  it('should pass for valid request with scenes', () => {
    expect(() =>
      validateRenderRequest({ scenes: BASIC_SCENES })
    ).not.toThrow();
  });

  it('should throw when scenes is missing', () => {
    expect(() =>
      validateRenderRequest({} as Record<string, unknown>)
    ).toThrow('scenes is required');
  });

  it('should throw when scenes is not an array', () => {
    expect(() =>
      validateRenderRequest({ scenes: 'not-array' } as unknown as import('../../../supabase/functions/render-video/index').RenderVideoRequest)
    ).toThrow('scenes must be an array');
  });

  it('should throw when scenes array is empty', () => {
    expect(() =>
      validateRenderRequest({ scenes: [] })
    ).toThrow('scenes array must not be empty');
  });

  it('should throw for invalid quality', () => {
    expect(() =>
      validateRenderRequest({ scenes: BASIC_SCENES, quality: 'ultra' })
    ).toThrow('quality must be one of low, medium, high');
  });

  it('should accept valid quality values', () => {
    for (const q of ['low', 'medium', 'high']) {
      expect(() =>
        validateRenderRequest({ scenes: BASIC_SCENES, quality: q })
      ).not.toThrow();
    }
  });

  it('should throw for invalid outputFormat', () => {
    expect(() =>
      validateRenderRequest({ scenes: BASIC_SCENES, outputFormat: 'avi' })
    ).toThrow('outputFormat must be one of mp4, webm');
  });

  it('should accept valid output formats', () => {
    for (const fmt of ['mp4', 'webm']) {
      expect(() =>
        validateRenderRequest({ scenes: BASIC_SCENES, outputFormat: fmt })
      ).not.toThrow();
    }
  });

  it('should pass when quality and outputFormat are not provided', () => {
    expect(() =>
      validateRenderRequest({ scenes: BASIC_SCENES })
    ).not.toThrow();
  });
});

// ─── handleRenderVideo Tests ─────────────────────────────────────────────────

describe('handleRenderVideo', () => {
  it('should return a successful render result', async () => {
    const result = await handleRenderVideo(
      { scenes: BASIC_SCENES, totalDuration: 5000 },
      USER_ID
    );

    expect(result.success).toBe(true);
    expect(result.videoUrl).toContain('.mp4');
    expect(result.metadata).toBeDefined();
    expect(result.metadata.duration).toBe(5000);
    expect(result.metadata.scenes).toBe(1);
    expect(result.metadata.fps).toBe(30);
    expect(result.metadata.quality).toBe('medium');
    expect(result.metadata.format).toBe('mp4');
    expect(result.metadata.createdAt).toBeDefined();
  });

  it('should use default duration per scene when totalDuration is not provided', async () => {
    const scenes = [
      { type: 'flow', nodes: [], edges: [], startMs: 0, durationMs: 3000 },
      { type: 'flow', nodes: [], edges: [], startMs: 3000, durationMs: 4000 },
    ];

    const result = await handleRenderVideo({ scenes }, USER_ID);

    // Default: scenes.length * 5000 = 10000
    expect(result.metadata.duration).toBe(10000);
  });

  it('should respect quality parameter', async () => {
    const result = await handleRenderVideo(
      { scenes: BASIC_SCENES, totalDuration: 5000, quality: 'high' },
      USER_ID
    );

    expect(result.metadata.quality).toBe('high');
  });

  it('should default to medium quality', async () => {
    const result = await handleRenderVideo(
      { scenes: BASIC_SCENES, totalDuration: 5000 },
      USER_ID
    );

    expect(result.metadata.quality).toBe('medium');
  });

  it('should respect outputFormat parameter', async () => {
    const result = await handleRenderVideo(
      { scenes: BASIC_SCENES, totalDuration: 5000, outputFormat: 'webm' },
      USER_ID
    );

    expect(result.videoUrl).toContain('.webm');
    expect(result.metadata.format).toBe('webm');
  });

  it('should calculate frames correctly', async () => {
    const result = await handleRenderVideo(
      { scenes: BASIC_SCENES, totalDuration: 10000 },
      USER_ID
    );

    // 10 seconds * 30 fps = 300 frames
    expect(result.metadata.frames).toBe(300);
  });

  it('should include all scenes count', async () => {
    const scenes = [
      { type: 'flow', nodes: [], edges: [] },
      { type: 'tree', nodes: [], edges: [] },
      { type: 'cycle', nodes: [], edges: [] },
    ];

    const result = await handleRenderVideo(
      { scenes, totalDuration: 15000 },
      USER_ID
    );

    expect(result.metadata.scenes).toBe(3);
  });

  it('should throw validation error for empty scenes', async () => {
    await expect(
      handleRenderVideo({ scenes: [] }, USER_ID)
    ).rejects.toThrow('scenes array must not be empty');
  });

  it('should throw validation error for invalid quality', async () => {
    await expect(
      handleRenderVideo({ scenes: BASIC_SCENES, quality: '4k' }, USER_ID)
    ).rejects.toThrow('quality must be one of low, medium, high');
  });

  it('should default to 120s timeout', () => {
    expect(RENDER_TIMEOUT_MS).toBe(120000);
  });
});
