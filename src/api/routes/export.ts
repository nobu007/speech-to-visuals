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
import { logger } from '@stv/core/utils/logger';
import { UUID_V4_RE } from '../uuid-validation';

// Characters that must be stripped from Content-Disposition header values
// to prevent CRLF injection (HTTP response splitting).
// eslint-disable-next-line no-control-regex -- intentionally matches control characters
const HEADER_INJECTION_RE = /[\r\n\x00-\x1f\x7f"]/g;

/**
 * Sanitize a value for safe inclusion in an HTTP response header.
 *
 * Strips CR/LF (response splitting), control characters, and double quotes
 * to prevent header injection attacks. This is a defense-in-depth layer —
 * the primary protection is UUID validation on artifactId.
 */
function sanitizeHeaderValue(value: string): string {
  return value.replace(HEADER_INJECTION_RE, '');
}

// Format to MIME type mapping
/** All artifact formats accepted by the export API (animated + basic). */
type ArtifactFormat =
  | 'mp4' | 'webm' | 'gif' | 'apng'
  | 'interactive-html' | 'pdf-animated' | 'svg-animated' | 'json-lottie'
  | 'json' | 'svg' | 'pdf' | 'html';

const FORMAT_MIME: Record<ArtifactFormat, string> = {
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

const DEFAULT_LIST_LIMIT = parseInt(process.env['EXPORT_LIST_DEFAULT_LIMIT'] ?? '', 10) || 50;
const MAX_LIST_LIMIT = parseInt(process.env['EXPORT_LIST_MAX_LIMIT'] ?? '', 10) || 200;

/**
 * Effective list limit for GET /artifacts.
 *
 * Both paths — the no-`?limit` default AND an explicit `?limit=` — MUST be
 * clamped by `maxLimit`. Previously only the explicit path was clamped, so a
 * misconfigured env pair (`EXPORT_LIST_DEFAULT_LIMIT=1000` with
 * `EXPORT_LIST_MAX_LIMIT=200`) made cap-less default responses while every
 * explicit request stayed capped at 200.
 */
export function resolveListLimit(
  rawLimit: number,
  defaultLimit: number,
  maxLimit: number,
): number {
  const base = Number.isNaN(rawLimit) ? defaultLimit : rawLimit;
  return Math.min(base, maxLimit);
}

export function createExportRouter(artifactStore: ExportArtifactStore): Router {
  const router = Router();

  // -- REQ-238: List artifacts ---------------------------------------------

  router.get('/artifacts', (req: Request, res: Response) => {
    const format = req.query.format as string | undefined;
    const rawLimit = parseInt(req.query.limit as string, 10);
    const rawOffset = parseInt(req.query.offset as string, 10);

    // Validate format parameter if provided. hasOwnProperty, NOT `in`: `in`
    // walks the prototype chain, so `?format=constructor` / `?format=toString`
    // previously passed validation and returned a silent empty 200.
    if (format !== undefined && !Object.prototype.hasOwnProperty.call(FORMAT_MIME, format)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid format. Allowed: ${Object.keys(FORMAT_MIME).join(', ')}`,
        },
      });
      return;
    }

    // Reject negative or astronomically large limit/offset values
    const MAX_SAFE_PARAM = 1_000_000;
    if (!Number.isNaN(rawLimit) && (rawLimit < 0 || rawLimit > MAX_SAFE_PARAM)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `limit must be between 0 and ${MAX_SAFE_PARAM}`,
        },
      });
      return;
    }
    if (!Number.isNaN(rawOffset) && (rawOffset < 0 || rawOffset > MAX_SAFE_PARAM)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `offset must be between 0 and ${MAX_SAFE_PARAM}`,
        },
      });
      return;
    }

    const limit = resolveListLimit(rawLimit, DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const offset = Number.isNaN(rawOffset) ? 0 : rawOffset;

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

    // Determine content type — validate format is in the known set to prevent
    // spoofed MIME types from stored artifacts
    const contentType = FORMAT_MIME[artifact.format as ArtifactFormat] || 'application/octet-stream';
    // Sanitize format for filename — strip any chars that aren't alphanumeric or hyphen
    const safeFormat = sanitizeHeaderValue(artifact.format);
    const filename = `export-${artifactId}.${safeFormat}`;

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
