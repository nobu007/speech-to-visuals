/**
 * REQ-234/238~240: Export Artifact Routes (Phase 101/103)
 *
 * REST endpoints for managing export artifacts:
 * - GET    /api/v1/export/artifacts                     — List artifacts (paginated, filterable)
 * - GET    /api/v1/export/artifacts/:artifactId          — Get artifact metadata
 * - GET    /api/v1/export/artifacts/:artifactId/download — Download artifact data
 * - DELETE /api/v1/export/artifacts/:artifactId          — Remove an artifact
 * - GET    /api/v1/export/artifacts/usage                — Usage statistics
 */

import { Router, Request, Response } from 'express';
import { ExportArtifactStore } from '../../export/export-artifact-store';
import { logger } from '../../utils/logger';

// UUID v4 validation regex
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Format to MIME type mapping
const FORMAT_MIME: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  gif: 'image/gif',
  apng: 'image/apng',
  'interactive-html': 'text/html',
  'pdf-animated': 'application/pdf',
  'svg-animated': 'image/svg+xml',
  'json-lottie': 'application/json',
  json: 'application/json',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  html: 'text/html',
};

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

export function createExportRouter(artifactStore: ExportArtifactStore): Router {
  const router = Router();

  // -- REQ-238: List artifacts ---------------------------------------------

  router.get('/artifacts', (req: Request, res: Response) => {
    const format = req.query.format as string | undefined;
    const rawLimit = parseInt(req.query.limit as string, 10);
    const rawOffset = parseInt(req.query.offset as string, 10);

    // Validate format parameter if provided
    if (format !== undefined && !(format in FORMAT_MIME)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid format. Allowed: ${Object.keys(FORMAT_MIME).join(', ')}`,
        },
      });
      return;
    }

    const limit = Number.isNaN(rawLimit) ? DEFAULT_LIST_LIMIT : Math.min(rawLimit, MAX_LIST_LIMIT);
    const offset = Number.isNaN(rawOffset) ? 0 : Math.max(rawOffset, 0);

    const result = artifactStore.list({ format, limit, offset });

    res.json({ success: true, data: result });
  });

  // -- REQ-240: Usage statistics -------------------------------------------

  router.get('/artifacts/usage', (_req: Request, res: Response) => {
    const usage = artifactStore.getUsage();
    res.json({ success: true, data: usage });
  });

  // -- REQ-239: Get artifact metadata --------------------------------------

  router.get('/artifacts/:artifactId', (req: Request, res: Response) => {
    const artifactId = req.params.artifactId as string;

    if (!artifactId || !UUID_V4_RE.test(artifactId)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid artifactId format (expected UUID v4)' },
      });
      return;
    }

    const meta = artifactStore.getMetadata(artifactId);
    if (!meta) {
      res.status(404).json({
        success: false,
        error: { code: 'ARTIFACT_NOT_FOUND', message: 'Artifact not found or has expired' },
      });
      return;
    }

    res.json({ success: true, data: meta });
  });

  // -- REQ-234: Download artifact ------------------------------------------

  router.get('/artifacts/:artifactId/download', (req: Request, res: Response) => {
    const artifactId = req.params.artifactId as string;
    const token = req.query.token as string | undefined;

    // Validate artifactId format
    if (!artifactId || !UUID_V4_RE.test(artifactId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid artifactId format (expected UUID v4)',
        },
      });
      return;
    }

    // Validate token presence
    if (!token || !UUID_V4_RE.test(token)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing or invalid download token',
        },
      });
      return;
    }

    // Resolve download URL (validates token + expiry)
    const artifact = artifactStore.resolveDownloadUrl(artifactId, token);
    if (!artifact) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ARTIFACT_NOT_FOUND',
          message: 'Artifact not found, token invalid, or download URL expired',
        },
      });
      return;
    }

    // Determine content type
    const contentType = FORMAT_MIME[artifact.format] || 'application/octet-stream';
    const filename = `export-${artifactId}.${artifact.format}`;

    logger.info(`[ExportRouter] Downloading artifact ${artifactId} (${artifact.format}, ${artifact.sizeBytes} bytes)`);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', artifact.sizeBytes);
    res.setHeader('X-Artifact-Id', artifactId);
    res.send(Buffer.from(artifact.data));
  });

  // -- REQ-239: Delete artifact --------------------------------------------

  router.delete('/artifacts/:artifactId', (req: Request, res: Response) => {
    const artifactId = req.params.artifactId as string;

    if (!artifactId || !UUID_V4_RE.test(artifactId)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid artifactId format (expected UUID v4)' },
      });
      return;
    }

    const removed = artifactStore.remove(artifactId);
    if (!removed) {
      res.status(404).json({
        success: false,
        error: { code: 'ARTIFACT_NOT_FOUND', message: 'Artifact not found' },
      });
      return;
    }

    logger.info(`[ExportRouter] Deleted artifact ${artifactId}`);
    res.json({ success: true, data: { artifactId, deleted: true } });
  });

  return router;
}
