# Runbook: High P95 Latency

**Alert**: `SpeechToVisualsHighLatencyP95`
**Severity**: Warning
**Condition**: `http_request_duration_ms{quantile="0.95"} > 20000`

## Symptoms

- P95 request latency exceeds 20 seconds sustained over 5 minutes.
- API responses are noticeably slow for end users.

## Investigation

1. Check `/api/v1/monitoring/http-metrics` for per-route latency breakdown.
2. Identify which endpoints are slow (pipeline, export, transcription).
3. Check system resources: CPU, memory, disk I/O.
4. Review Remotion render queue depth.

## Mitigation

- **Pipeline endpoints slow**: Check Gemini API response times. Consider caching.
- **Export endpoints slow**: Check export queue depth at `/api/v1/export/jobs`.
- **Transcription slow**: Whisper model may need restart or GPU allocation.
- **General slowness**: Scale horizontally or increase instance resources.

## Resolution

1. Identify and address the bottleneck.
2. Confirm P95 latency returns below 20s.
3. Consider adjusting alert threshold if workload patterns changed.
