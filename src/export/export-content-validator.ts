/**
 * Defense-in-depth content validator for the export pipeline.
 *
 * Inspects SceneGraph string fields for dangerous patterns BEFORE format-specific
 * escaping runs. The primary protection is the per-format escaping functions
 * (escapeXML, escapePDFString, </script> regex). This validator provides
 * defense-in-depth across HTML, JS, PDF, CSS, and data-URI injection vectors:
 *
 * 1. Audit trail — logs warnings when dangerous content is detected
 * 2. Fail-safe — if escaping is ever bypassed, content is still caught
 * 3. Monitoring — security teams can alert on repeated findings
 */

import type { SceneGraph, NodeDatum, EdgeDatum } from '../types/diagram';
import { logger } from '../utils/logger';
import { securityMetricsCollector } from './security-metrics-collector';

export interface ContentFinding {
  field: string;
  pattern: string;
  severity: 'high' | 'medium';
  preview: string;
}

export interface ValidationResult {
  passed: boolean;
  findings: ContentFinding[];
}

// HTML5 event handler names commonly exploited in XSS attacks.
// Extracted to a named constant array for maintainability — prevents
// copy-paste drift when new event types need to be added.
const EVENT_HANDLER_NAMES = [
  'click', 'load', 'error', 'mouseover', 'mouseout', 'mouseenter',
  'mouseleave', 'focus', 'blur', 'input', 'change', 'submit', 'reset',
  'toggle', 'drag', 'dragstart', 'dragend', 'dragenter', 'dragleave',
  'dragover', 'drop', 'wheel', 'scroll', 'resize', 'pointerdown',
  'pointerup', 'pointermove', 'pointerover', 'pointerout', 'pointerenter',
  'pointerleave', 'animationstart', 'animationend', 'animationiteration',
  'transitionend', 'contextmenu', 'copy', 'paste', 'cut', 'canplay',
  'play', 'playing', 'seeked', 'seeking', 'stalled', 'suspend', 'waiting',
  'loadeddata', 'loadedmetadata', 'loadstart', 'durationchange', 'ended',
  'abort', 'ratechange', 'timeupdate', 'volumechange', 'progress',
  'hashchange', 'offline', 'online', 'pagehide', 'pageshow', 'popstate',
  'storage', 'unload', 'beforeunload', 'message', 'afterprint',
  'beforeprint', 'securitypolicyviolation', 'begin', 'end', 'repeat',
] as const;

const EVENT_HANDLER_RE = new RegExp(
  `on(${EVENT_HANDLER_NAMES.join('|')})\\s*=`,
  'i',
);

// Patterns that indicate active injection attempts in string data.
// These are checked against raw (pre-escaping) content — if found, they
// indicate that user-controlled data contains exploit payloads.
const HIGH_SEVERITY_PATTERNS: Array<{ regex: RegExp; name: string }> = [
  // [\s/>] catches <script/...> slash-separated bypass vectors (e.g. <script/src=//evil.com>)
  { regex: /<script[\s/>]/i, name: 'script-tag' },
  { regex: /<img[^>]+\bonerror\s*=/i, name: 'img-onerror' },
  { regex: /<svg[^>]+\bonload\s*=/i, name: 'svg-onload' },
  { regex: /<iframe[\s/>]/i, name: 'iframe-tag' },
  { regex: /javascript\s*:\s*\S/i, name: 'javascript-protocol' },
  { regex: /vbscript\s*:\s*\S/i, name: 'vbscript-protocol' },
  { regex: /<embed[\s/>]/i, name: 'embed-tag' },
  { regex: /<object[\s/>]/i, name: 'object-tag' },
  { regex: /<base[\s/>]/i, name: 'base-tag' },
  { regex: /\) Tj \(/i, name: 'pdf-operator-injection' },
  // CSS-based injection vectors
  { regex: /expression\s*\(/i, name: 'css-expression' },
  { regex: /-moz-binding\s*:/i, name: 'css-moz-binding' },
  { regex: /url\s*\(\s*['"]?\s*javascript:/i, name: 'css-url-javascript' },
];

const MEDIUM_SEVERITY_PATTERNS: Array<{ regex: RegExp; name: string }> = [
  { regex: EVENT_HANDLER_RE, name: 'event-handler' },
  { regex: /<a[^>]+\bhref\s*=\s*["']?\s*(javascript|data):/i, name: 'dangerous-href' },
  { regex: /<meta[\s/>]/i, name: 'meta-tag' },
  { regex: /\0/, name: 'null-byte' },
  // CSS injection vectors (lower severity than active script execution)
  { regex: /@import\s+['"]?\s*url\s*\(/i, name: 'css-import' },
  { regex: /behavior\s*:\s*url\s*\(/i, name: 'css-behavior' },
  { regex: /url\s*\(\s*['"]?\s*data:text\/html/i, name: 'data-html-uri' },
];

const MAX_PREVIEW_LENGTH = 80;

function truncate(value: string): string {
  return value.length > MAX_PREVIEW_LENGTH
    ? value.substring(0, MAX_PREVIEW_LENGTH) + '...'
    : value;
}

/**
 * Check a single string value against all dangerous patterns.
 */
function checkString(
  value: string,
  fieldPath: string,
  findings: ContentFinding[]
): void {
  if (typeof value !== 'string' || value.length === 0) return;

  for (const { regex, name } of HIGH_SEVERITY_PATTERNS) {
    if (regex.test(value)) {
      findings.push({
        field: fieldPath,
        pattern: name,
        severity: 'high',
        preview: truncate(value),
      });
    }
  }

  for (const { regex, name } of MEDIUM_SEVERITY_PATTERNS) {
    if (regex.test(value)) {
      findings.push({
        field: fieldPath,
        pattern: name,
        severity: 'medium',
        preview: truncate(value),
      });
    }
  }
}

/**
 * Recursively check all string values in an arbitrary object.
 */
function checkObject(
  obj: unknown,
  fieldPath: string,
  findings: ContentFinding[],
  depth = 0
): void {
  if (depth > 10) return; // prevent deep-recursion DoS

  if (typeof obj === 'string') {
    checkString(obj, fieldPath, findings);
    return;
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      checkObject(obj[i], `${fieldPath}[${i}]`, findings, depth + 1);
    }
    return;
  }

  if (obj !== null && typeof obj === 'object') {
    for (const [key, val] of Object.entries(obj)) {
      checkObject(val, fieldPath ? `${fieldPath}.${key}` : key, findings, depth + 1);
    }
  }
}

/**
 * Validate a SceneGraph for dangerous content patterns before export.
 *
 * Returns a ValidationResult with all findings. In non-strict mode (default),
 * findings are logged as warnings but do not block the export — the downstream
 * escaping functions are the primary protection. In strict mode, any high-severity
 * finding causes the validation to fail.
 *
 * @param scene - SceneGraph to validate
 * @param options.strict - If true, fail on any high-severity finding
 * @returns ValidationResult with findings array
 */
export function validateSceneGraphForExport(
  scene: SceneGraph,
  options?: { strict?: boolean }
): ValidationResult {
  const findings: ContentFinding[] = [];

  // Check top-level string fields
  checkString(scene.id ?? '', 'id', findings);
  checkString(scene.summary, 'summary', findings);
  checkString(scene.title ?? '', 'title', findings);
  checkString(scene.content ?? '', 'content', findings);
  checkString(scene.diagramType ?? '', 'diagramType', findings);

  // Check keyphrases array
  if (Array.isArray(scene.keyphrases)) {
    scene.keyphrases.forEach((kp, i) => {
      checkString(kp, `keyphrases[${i}]`, findings);
    });
  }

  // Check node fields
  scene.nodes?.forEach((node: NodeDatum, i: number) => {
    checkString(node.id, `nodes[${i}].id`, findings);
    checkString(node.label, `nodes[${i}].label`, findings);
    checkString(node.type ?? '', `nodes[${i}].type`, findings);
    if (node.meta) {
      checkObject(node.meta, `nodes[${i}].meta`, findings);
    }
  });

  // Check edge fields
  scene.edges?.forEach((edge: EdgeDatum, i: number) => {
    checkString(edge.from, `edges[${i}].from`, findings);
    checkString(edge.to, `edges[${i}].to`, findings);
    checkString(edge.label ?? '', `edges[${i}].label`, findings);
    checkString(edge.id ?? '', `edges[${i}].id`, findings);
  });

  // Check layout (recursively, since it has nested structures)
  if (scene.layout) {
    checkObject(scene.layout, 'layout', findings);
  }

  const strict = options?.strict ?? false;
  const hasHighSeverity = findings.some((f) => f.severity === 'high');
  const passed = !(strict && hasHighSeverity);

  if (findings.length > 0) {
    const highCount = findings.filter((f) => f.severity === 'high').length;
    const medCount = findings.filter((f) => f.severity === 'medium').length;
    const msg =
      `[ExportValidator] ${findings.length} content finding(s) ` +
      `(${highCount} high, ${medCount} medium) in scene ${scene.id ?? '<unnamed>'}: ` +
      findings.map((f) => `${f.field}=${f.pattern}`).join(', ');
    if (strict && hasHighSeverity) {
      logger.error(msg);
    } else {
      logger.warn(msg);
    }
    // Record metrics for defense-in-depth observability
    const layer = strict && hasHighSeverity ? 'strict-mode-block' : 'content-validator';
    securityMetricsCollector.recordFindings(
      layer,
      findings.map((f) => ({ severity: f.severity, pattern: f.pattern })),
    );
  }

  return { passed, findings };
}

/**
 * Check whether strict export validation is enabled via environment variable.
 *
 * When `EXPORT_STRICT_VALIDATION=true`, the export pipeline will reject
 * payloads containing high-severity injection patterns instead of merely
 * logging warnings. This provides defense-in-depth beyond per-format
 * escaping functions.
 */
export function isStrictValidationEnabled(): boolean {
  return process.env.EXPORT_STRICT_VALIDATION === 'true';
}

/**
 * Validate an arbitrary export payload (e.g. SceneData in EnhancedExportEngine)
 * for dangerous content patterns. This is a generalized defense-in-depth scan
 * that recursively checks all string values in the payload object.
 *
 * In non-strict mode (default), findings are logged as warnings but do not
 * block the export — the downstream escaping functions are the primary
 * protection. In strict mode, any high-severity finding causes validation
 * to fail.
 *
 * @param payload - Arbitrary object to scan (typically scene data)
 * @param contextLabel - Label for log messages (e.g. job ID)
 * @param options.strict - If true, fail on any high-severity finding
 * @returns ValidationResult with findings array
 */
export function validateExportPayload(
  payload: unknown,
  contextLabel?: string,
  options?: { strict?: boolean }
): ValidationResult {
  const findings: ContentFinding[] = [];
  checkObject(payload, '', findings, 0);

  const strict = options?.strict ?? false;
  const hasHighSeverity = findings.some((f) => f.severity === 'high');
  const passed = !(strict && hasHighSeverity);

  if (findings.length > 0) {
    const highCount = findings.filter((f) => f.severity === 'high').length;
    const medCount = findings.filter((f) => f.severity === 'medium').length;
    const msg =
      `[ExportValidator] ${findings.length} content finding(s) ` +
      `(${highCount} high, ${medCount} medium) in export payload` +
      (contextLabel ? ` (${contextLabel})` : '') + ': ' +
      findings.map((f) => `${f.field}=${f.pattern}`).join(', ');
    if (strict && hasHighSeverity) {
      logger.error(msg);
    } else {
      logger.warn(msg);
    }
    // Record metrics for defense-in-depth observability
    const layer = strict && hasHighSeverity ? 'strict-mode-block' : 'content-validator';
    securityMetricsCollector.recordFindings(
      layer,
      findings.map((f) => ({ severity: f.severity, pattern: f.pattern })),
    );
  }

  return { passed, findings };
}
