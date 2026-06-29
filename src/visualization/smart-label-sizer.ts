/**
 * REQ-081: Smart Label Sizing
 *
 * Adjusts font size and applies line wrapping / ellipsis truncation
 * so that every node label fits within the node's bounding box.
 * Supports CJK (Japanese/Chinese/Korean) character-aware wrapping
 * where characters can break between any character without requiring spaces.
 */

import { PositionedNode } from '@/types/diagram';
import { getNodeWidth, getNodeHeight } from './node-dimensions';

/**
 * Unicode ranges for CJK characters that are typically rendered at ~2x the
 * width of a Latin character in monospace and most proportional fonts.
 */
const CJK_RANGES = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\uFF00-\uFFEF]/;

export function isCJKChar(ch: string): boolean {
  return CJK_RANGES.test(ch);
}

export function hasCJKText(text: string): boolean {
  return CJK_RANGES.test(text);
}

/**
 * Compute the display-width of a string in "char units", where CJK chars
 * count as 2 units and all other chars count as 1 unit.
 */
export function textWidth(text: string): number {
  let w = 0;
  for (const ch of text) {
    w += CJK_RANGES.test(ch) ? 2 : 1;
  }
  return w;
}

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
    const w = getNodeWidth(node, 120);
    const h = getNodeHeight(node, 60);
    results.set(node.id, sizeLabel(node.label, w, h, config));
  }

  return results;
}

// --- Internal helpers ---

interface WrapResult {
  lines: string[];
  fits: boolean;
}

/**
 * Compute display width of a prefix of `text` up to `maxLen` code points.
 * Returns the slice position (in code points) that fits within `maxWidthUnits`
 * display-width units, plus the actual display width used.
 */
function sliceToFitWidth(text: string, maxWidthUnits: number): { pos: number; width: number } {
  let w = 0;
  let i = 0;
  for (const ch of text) {
    const cw = CJK_RANGES.test(ch) ? 2 : 1;
    if (w + cw > maxWidthUnits) break;
    w += cw;
    i++;
  }
  return { pos: i, width: w };
}

function wrapLabel(
  text: string,
  availableWidth: number,
  fontSize: number,
  cfg: Required<LabelSizingConfig>,
  maxLines: number
): WrapResult {
  const scaledCharWidth = cfg.charWidthFactor * (fontSize / cfg.defaultFontSize);
  const maxLineDisplayWidth = Math.max(1, Math.floor(availableWidth / scaledCharWidth));
  const cjk = hasCJKText(text);
  const ellipsisDisplayWidth = textWidth(cfg.ellipsis);

  const lines: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (lines.length >= maxLines) {
      // Truncate last line with ellipsis
      if (lines.length > 0) {
        const lastLine = lines[lines.length - 1];
        const targetWidth = maxLineDisplayWidth - ellipsisDisplayWidth;
        const { pos } = sliceToFitWidth(lastLine, Math.max(1, targetWidth));
        lines[lines.length - 1] = lastLine.slice(0, pos) + cfg.ellipsis;
      }
      return { lines, fits: false };
    }

    const { pos: fitLen } = sliceToFitWidth(remaining, maxLineDisplayWidth);

    if (fitLen >= remaining.length) {
      // Entire remaining text fits on this line
      lines.push(remaining);
      remaining = '';
    } else if (cjk) {
      // CJK: break at any character boundary
      lines.push(remaining.slice(0, fitLen));
      remaining = remaining.slice(fitLen);
    } else {
      // Latin: prefer breaking at whitespace
      let breakAt = fitLen;
      const spaceIdx = remaining.lastIndexOf(' ', fitLen);
      if (spaceIdx > maxLineDisplayWidth * 0.25) {
        breakAt = spaceIdx;
      }
      lines.push(remaining.slice(0, breakAt));
      remaining = remaining.slice(breakAt).trimStart();
    }
  }

  return { lines, fits: true };
}
