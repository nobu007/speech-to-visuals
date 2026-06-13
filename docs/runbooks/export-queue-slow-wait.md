# Runbook: Export Queue Slow Wait Time

**Alert**: `SpeechToVisualsExportQueueSlowWait`
**Severity**: Warning
**Condition**: `export_queue_wait_time_ms > 10000` sustained over 5 minutes

## Symptoms

- Average export job queue wait time exceeds 10 seconds.
- Jobs spend excessive time waiting before processing begins.

## Investigation

1. Check `/api/v1/export/jobs` for active jobs and processing status.
2. Review average job processing time to identify slow exports.
3. Check if large video renders are blocking concurrency slots.
4. Review export format distribution (mp4/webm renders take longer).

## Mitigation

- **Long-running renders blocking slots**: Reduce per-job timeout.
- **Low concurrency**: Increase `maxConcurrent` in ExportJobQueue options.
- **High-priority starvation**: Verify priority queue ordering is working.
- **Disk I/O bottleneck**: Move render temp directory to faster storage.

## Resolution

1. Reduce wait times below 10 seconds average.
2. Profile slow exports to identify optimization opportunities.
3. Consider format-specific concurrency pools (fast formats separate from slow).
4. Verify `recordQueueWaitTimeMs` is being called on dequeue.
