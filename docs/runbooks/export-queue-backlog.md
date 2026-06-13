# Runbook: Export Queue Backlog

**Alert**: `SpeechToVisualsExportQueueBacklog`
**Severity**: Warning
**Condition**: `export_queue_size > 50` sustained over 3 minutes

## Symptoms

- Export job queue has more than 50 jobs waiting.
- Users experience long wait times for export job completion.

## Investigation

1. Check `/api/v1/export/jobs` for current queue stats and active jobs.
2. Review the priority distribution to see if high-priority jobs are blocked.
3. Check if any export workers are stuck or crashed.
4. Review system resources (CPU, memory, disk space for renders).

## Mitigation

- **Stuck workers**: Restart the export worker processes.
- **Resource exhaustion**: Free disk space or increase memory allocation.
- **Sudden traffic spike**: Enable rate limiting on POST `/api/v1/export/jobs`.
- **Concurrency too low**: Increase `maxConcurrent` in ExportJobQueue options.

## Resolution

1. Process the backlog until queue size drops below 50.
2. Identify and fix the root cause (worker crash, resource exhaustion).
3. Consider auto-scaling export workers based on queue depth.
4. Verify export queue metrics are being recorded correctly.
