/**
 * REQ-081: Smart Label Sizing
 *
 * Adjusts font size and applies line wrapping / ellipsis truncation
 * so that every node label fits within the node's bounding box.
 */

import { PositionedNode } from '@/types/diagram';

export interface LabelSizingConfig {
  /** Default font size in px (default: 14) */
  defaultFontSize?: number;
  /** Minimum font size in px (default: 8) */
  minFontSize?: number;
  /** Character width factor (default: 8 — approx px per character at default size) */
  charWidthFactor?: number;
  /** Line height factor relative to fontSize (default: 1.2) */
  lineHeightFactor?: number;
  /** Maximum number of lines before truncation (default: 3) */
  maxLines?: number;
  /** Ellipsis string (default: '…') */
  ellipsis?: string;
}

export interface LabelSizingResult {
  /** Adjusted font size */
  fontSize: number;
  /** Lines after wrapping (may be truncated with ellipsis) */
  lines: string[];
  /** Whether the label was truncated */
  truncated: boolean;
}

const DEFAULTS: Required<LabelSizingConfig> = {
  defaultFontSize: 14,
  minFontSize: 8,
  charWidthFactor: 8,
  lineHeightFactor: 1.2,
  maxLines: 3,
  ellipsis: '…',
};

/**
 * Size a single label to fit within the given width/height.
 */
export function sizeLabel(
  label: string,
  nodeWidth: number,
  nodeHeight: number,
  config?: LabelSizingConfig
): LabelSizingResult {
  const cfg = { ...DEFAULTS, ...config };

  // Empty label → return defaults
  if (!label || label.length === 0) {
    return {
      fontSize: cfg.defaultFontSize,
      lines: [''],
      truncated: false,
    };
  }

  const padding = cfg.charWidthFactor * 2; // 1 char padding each side
  const availableWidth = nodeWidth - padding;
  const lineHeight = cfg.defaultFontSize * cfg.lineHeightFactor;
  const maxLinesByHeight = Math.max(1, Math.floor(nodeHeight / lineHeight));
  const effectiveMaxLines = Math.min(cfg.maxLines, maxLinesByHeight);

  // Try at default font size first
  let fontSize = cfg.defaultFontSize;
  let result = wrapLabel(label, availableWidth, fontSize, cfg, effectiveMaxLines);

  if (!result.fits) {
    // Try shrinking font to fit
    while (fontSize > cfg.minFontSize && !result.fits) {
      fontSize -= 1;
      const scaledWidth = availableWidth * (fontSize / cfg.defaultFontSize);
      result = wrapLabel(label, scaledWidth, fontSize, cfg, effectiveMaxLines);
    }
  }

  const truncated = result.lines.length > effectiveMaxLines ||
    result.lines[result.lines.length - 1]?.endsWith(cfg.ellipsis);

  return {
    fontSize,
    lines: result.lines.slice(0, effectiveMaxLines),
    truncated,
  };
}

/**
 * Size labels for all nodes in a layout.
 * Returns a map of node ID → LabelSizingResult.
 */
export function sizeAllLabels(
  nodes: PositionedNode[],
  config?: LabelSizingConfig
): Map<string, LabelSizingResult> {
  const results = new Map<string, LabelSizingResult>();

  for (const node of nodes) {
    const w = node.w ?? node.width ?? 120;
    const h = node.h ?? node.height ?? 60;
    results.set(node.id, sizeLabel(node.label, w, h, config));
  }

  return results;
}

// --- Internal helpers ---

interface WrapResult {
  lines: string[];
  fits: boolean;
}

function wrapLabel(
  text: string,
  availableWidth: number,
  fontSize: number,
  cfg: Required<LabelSizingConfig>,
  maxLines: number
): WrapResult {
  const scaledCharWidth = cfg.charWidthFactor * (fontSize / cfg.defaultFontSize);
  const charsPerLine = Math.max(1, Math.floor(availableWidth / scaledCharWidth));

  const lines: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (lines.length >= maxLines) {
      // Truncate last line with ellipsis
      if (lines.length > 0) {
        const lastLine = lines[lines.length - 1];
        const ellipsisChars = Math.ceil(cfg.ellipsis.length * scaledCharWidth / scaledCharWidth);
        const truncateAt = Math.max(1, charsPerLine - ellipsisChars);
        lines[lines.length - 1] = lastLine.slice(0, truncateAt) + cfg.ellipsis;
      }
      return { lines, fits: false };
    }

    if (remaining.length <= charsPerLine) {
      lines.push(remaining);
      remaining = '';
    } else {
      // Find a good break point (prefer whitespace)
      let breakAt = charsPerLine;
      const spaceIdx = remaining.lastIndexOf(' ', charsPerLine);
      if (spaceIdx > charsPerLine * 0.5) {
        breakAt = spaceIdx;
      }
      lines.push(remaining.slice(0, breakAt));
      remaining = remaining.slice(breakAt).trimStart();
    }
  }

  return { lines, fits: true };
}
