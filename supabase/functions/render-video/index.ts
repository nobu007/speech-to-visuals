import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { authenticateRequest, SupabaseAuthClient } from '../_shared/auth.ts';
import {
  corsResponse,
  optionsResponse,
  errorResponse,
  validateRequired,
} from '../_shared/error-handler.ts';
import { sanitizeUntrustedJsonValue } from '../_shared/untrusted-json.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Constants ───────────────────────────────────────────────────────────────

export const RENDER_TIMEOUT_MS = 120000;

const QUALITY_SETTINGS: Record<string, { scale: number; crf: number; preset: string }> = {
  low: { scale: 720, crf: 28, preset: 'fast' },
  medium: { scale: 1080, crf: 23, preset: 'medium' },
  high: { scale: 1080, crf: 18, preset: 'slow' },
};

const VALID_FORMATS = ['mp4', 'webm'];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RenderVideoRequest {
  scenes: unknown[];
  audioUrl?: string;
  totalDuration?: number;
  quality?: string;
  outputFormat?: string;
}

export interface RenderVideoResponse {
  success: boolean;
  videoUrl: string;
  metadata: {
    duration: number;
    frames: number;
    fps: number;
    quality: string;
    scenes: number;
    format: string;
    createdAt: string;
  };
}

// ─── Validation ──────────────────────────────────────────────────────────────

export function validateRenderRequest(body: RenderVideoRequest): void {
  validateRequired(body as Record<string, unknown>, ['scenes']);

  if (!Array.isArray(body.scenes)) {
    throw new Error('scenes must be an array');
  }

  if (body.scenes.length === 0) {
    throw new Error('scenes array must not be empty');
  }

  if (body.quality && !QUALITY_SETTINGS[body.quality]) {
    throw new Error('quality must be one of low, medium, high');
  }

  if (body.outputFormat && !VALID_FORMATS.includes(body.outputFormat)) {
    throw new Error(`outputFormat must be one of ${VALID_FORMATS.join(', ')}`);
  }
}

// ─── Handler (testable, extracted from serve) ────────────────────────────────

export async function handleRenderVideo(
  body: RenderVideoRequest,
  userId: string
): Promise<RenderVideoResponse> {
  validateRenderRequest(body);

  const { scenes, audioUrl, totalDuration = 0, quality = 'medium', outputFormat = 'mp4' } = body;

  console.log(`User ${userId}: Starting video render for ${scenes.length} scenes`);

  // Calculate video parameters
  const fps = 30;
  const duration = totalDuration || scenes.length * 5000; // Default 5s per scene
  const totalFrames = Math.ceil((duration / 1000) * fps);
  const outputName = `diagram-video-${Date.now()}`;
  const settings = QUALITY_SETTINGS[quality] || QUALITY_SETTINGS.medium;

  console.log(`User ${userId}: Render settings:`, {
    totalFrames,
    fps,
    quality: settings,
    outputName,
    format: outputFormat,
  });

  // In a real implementation, this would:
  // 1. Call Remotion's renderMedia function
  // 2. Upload the result to storage
  // 3. Return the public URL

  // Simulated render process
  const renderResult: RenderVideoResponse = {
    success: true,
    videoUrl: `https://example.com/videos/${outputName}.${outputFormat}`,
    metadata: {
      duration,
      frames: totalFrames,
      fps,
      quality,
      scenes: scenes.length,
      format: outputFormat,
      createdAt: new Date().toISOString(),
    },
  };

  console.log(`User ${userId}: Video render completed:`, renderResult.videoUrl);

  return renderResult;
}

// ─── Deno serve entry point ──────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(optionsResponse().body, {
      status: optionsResponse().status,
      headers: optionsResponse().headers,
    });
  }

  try {
    // Auth check
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseClient: SupabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey);
    const { userId } = await authenticateRequest(req, supabaseClient);

    // Parse body (sanitize at the trust boundary — no-op on valid JSON)
    const body: RenderVideoRequest = sanitizeUntrustedJsonValue(
      await req.json()
    ) as RenderVideoRequest;

    // Process
    const result = await handleRenderVideo(body, userId);

    const resp = corsResponse(result);
    return new Response(resp.body, { status: resp.status, headers: resp.headers });
  } catch (err) {
    const resp = errorResponse(err);
    return new Response(resp.body, { status: resp.status, headers: resp.headers });
  }
});
