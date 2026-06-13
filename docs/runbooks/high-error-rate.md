# Runbook: High Error Rate

**Alert**: `SpeechToVisualsHighErrorRate`
**Severity**: Critical
**Condition**: `rate(http_errors_total[5m]) / rate(http_requests_total[5m]) > 0.05`

## Symptoms

- HTTP error rate exceeds 5% sustained over 2 minutes.
- Users may see 500-level responses on API endpoints.

## Investigation

1. Check `/api/v1/monitoring/error-recovery` for error recovery telemetry.
2. Inspect application logs for stack traces: `journalctl -u speech-to-visuals | grep ERROR`.
3. Identify affected routes via `/api/v1/monitoring/http-metrics`.
4. Check downstream service health (Whisper, Gemini API, Remotion).

## Mitigation

- **Gemini API failures**: Verify `GOOGLE_API_KEY` is valid. Rule-based fallback should engage automatically.
- **Whisper timeout**: Restart the Whisper process or switch to Web Speech API.
- **Remotion render failures**: Check disk space and Chromium availability.
- **Database/connection errors**: Check connection pool and restart the API server.

## Resolution

1. Fix the underlying error source.
2. Verify error rate drops below threshold.
3. Review error recovery logs to confirm automatic recovery engaged.
