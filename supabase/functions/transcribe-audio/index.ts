import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { authenticateRequest, SupabaseAuthClient } from '../_shared/auth.ts';
import {
  CORS_HEADERS,
  corsResponse,
  optionsResponse,
  errorResponse,
  validateRequired,
  createTimeout,
  fetchWithTimeout,
} from '../_shared/error-handler.ts';
import { sanitizeUntrustedJsonValue } from '../_shared/untrusted-json.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Handler (testable, extracted from serve) ────────────────────────────────

export const TRANSCRIBE_TIMEOUT_MS = 30000;

export interface TranscribeRequest {
  audioUrl: string;
  language?: string;
}

export interface TranscribeSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  confidence?: number;
}

export interface TranscribeResponse {
  transcript: string;
  segments: TranscribeSegment[];
  duration: number;
  language?: string;
}

/**
 * Process a transcription request.
 * This function is extracted for testability.
 */
export async function handleTranscribe(
  body: TranscribeRequest,
  userId: string,
  env: { LOVABLE_API_KEY: string },
  timeoutMs: number = TRANSCRIBE_TIMEOUT_MS
): Promise<TranscribeResponse> {
  validateRequired(body as Record<string, unknown>, ['audioUrl']);

  const { audioUrl, language } = body;

  console.log(`User ${userId}: Downloading audio from ${audioUrl}`);

  // Download audio file with timeout
  const audioResponse = await fetchWithTimeout(audioUrl, {
    method: 'GET',
    timeout: timeoutMs,
  }, timeoutMs);

  if (!audioResponse.ok) {
    throw new Error(`Failed to download audio file: ${audioResponse.status}`);
  }

  const audioBlob = await audioResponse.blob();
  const audioBuffer = await audioBlob.arrayBuffer();

  console.log(`User ${userId}: Audio downloaded, size: ${audioBuffer.byteLength}`);

  if (audioBuffer.byteLength === 0) {
    throw new Error('Downloaded audio file is empty');
  }

  // Prepare form data for Whisper API
  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer]), 'audio.mp3');
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities', JSON.stringify(['segment']));

  if (language) {
    formData.append('language', language);
  }

  if (!env.LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY not configured');
  }

  console.log(`User ${userId}: Calling Whisper transcription...`);

  // Call Whisper API with timeout
  const transcriptionResponse = await fetchWithTimeout(
    'https://ai.gateway.lovable.dev/v1/audio/transcriptions',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.LOVABLE_API_KEY}`,
      },
      body: formData,
    },
    timeoutMs
  );

  if (!transcriptionResponse.ok) {
    const errorText = await transcriptionResponse.text();
    console.error(`User ${userId}: Transcription error: ${errorText}`);
    throw new Error(`Transcription failed: ${transcriptionResponse.status}`);
  }

  // Sanitize at the trust boundary: a malformed gateway response could carry
  // `1e400`→Infinity into `duration`/`start`/`end` (poisoning frame arithmetic)
  // or `__proto__` keys. No-op on well-formed Whisper output.
  const transcription = sanitizeUntrustedJsonValue(
    await transcriptionResponse.json()
  ) as {
    text: string;
    duration?: number;
    language?: string;
    segments?: Array<{ id?: number; start: number; end: number; text: string; avg_logprob?: number }>;
  };

  // Process segments with confidence scores
  const segments: TranscribeSegment[] = (transcription.segments || []).map(
    (seg: { id?: number; start: number; end: number; text: string; avg_logprob?: number }, idx: number) => ({
      id: seg.id ?? idx,
      start: seg.start,
      end: seg.end,
      text: seg.text,
      confidence: seg.avg_logprob !== undefined ? Math.round(Math.exp(seg.avg_logprob) * 100) / 100 : undefined,
    })
  );

  console.log(`User ${userId}: Transcription complete`);

  return {
    transcript: transcription.text,
    segments,
    duration: transcription.duration || 0,
    language: language || transcription.language,
  };
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
    const body: TranscribeRequest = sanitizeUntrustedJsonValue(
      await req.json()
    ) as TranscribeRequest;

    // Process
    const result = await handleTranscribe(body, userId, {
      LOVABLE_API_KEY: Deno.env.get('LOVABLE_API_KEY') ?? '',
    });

    const resp = corsResponse(result);
    return new Response(resp.body, { status: resp.status, headers: resp.headers });
  } catch (err) {
    const resp = errorResponse(err);
    return new Response(resp.body, { status: resp.status, headers: resp.headers });
  }
});
