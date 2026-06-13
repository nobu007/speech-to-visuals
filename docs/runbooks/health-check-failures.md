# Runbook: Health Check Failures

**Alert**: `SpeechToVisualsHealthCheckFailures`
**Severity**: Critical
**Condition**: `sum(increase(http_errors_total{path=~"/health.*"}[10m])) >= 3`

## Symptoms

- Health check endpoints (`/health`, `/healthz`) are returning errors.
- Load balancer or orchestrator may be marking the service as unhealthy.

## Investigation

1. Directly access `/health` to see component-level status.
2. Check if the issue is the health endpoint itself or a downstream dependency.
3. Review recent deployments that may have broken health checks.
4. Check if the process is OOM-killed: `dmesg | grep -i oom`.

## Mitigation

- **Process crash**: Restart the service: `systemctl restart speech-to-visuals`.
- **Dependency failure**: Check Whisper, Gemini API, and database connectivity.
- **Port conflict**: Verify no other process is bound to the API port.
- **Resource exhaustion**: Check disk space and memory.

## Resolution

1. Restore health check endpoint to returning 200.
2. Verify the orchestrator re-registers the service as healthy.
3. Add monitoring for the root cause that caused health check failures.
