/**
 * Phase 37: Multi-Format Export Engine
 *
 * Enables flexible diagram export in multiple formats:
 * - SVG: Vector graphics for scalability
 * - PNG: Raster images for presentations
 * - PDF: Print-ready documents
 * - JSON: Data interchange
 *
 * Custom Instructions Alignment:
 * - Section 6: Web UI Development - Export functionality
 * - Section 9.2: Continuous Improvement - UX enhancements
 */

import type { SceneGraph } from '@/types/diagram';
import { safeArray } from '../lib/safe-array';
import { ExportError, FormatValidationError } from '@/pipeline/pipeline-errors';
import type { NodeDatum, EdgeDatum } from '@/types/diagram';
import { logger } from '../utils/logger';
import { sanitizeFilename } from '../utils/sanitize';
import { validateSceneGraphForExport, isStrictValidationEnabled } from './export-content-validator';
import { escapeXml } from './xml-escape';
import { securityMetricsCollector } from './security-metrics-collector';
import { getNodeWidth, getNodeHeight } from '../visualization/node-dimensions';
import { textWidth } from '../visualization/smart-label-sizer';

export type ExportFormat = 'svg' | 'png' | 'pdf' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  width?: number;
  height?: number;
  backgroundColor?: string;
  includeMetadata?: boolean;
  quality?: number; // For PNG (0-1)
  dpi?: number; // For PDF
}

export interface ExportResult {
  success: boolean;
  data?: Blob | string;
  mimeType?: string;
  filename?: string;
  error?: string;
  metadata?: {
    format: ExportFormat;
    sizeBytes: number;
    dimensions: { width: number; height: number };
    generatedAt: string;
  };
}

/**
 * Multi-format export engine for diagrams
 */
export class MultiFormatExporter {
  private defaultWidth = 1920;
  private defaultHeight = 1080;

  // --- PDF WYSIWYG parity constants (match the on-screen DiagramScene render) ---
  // Node corner radius — on-screen NodeAnimation `borderRadius: 8`, SVG `rx="8"`,
  // Canvas `roundRect(x,y,w,h,8)`. PDF has no rounded-rect operator, so the body
  // is a hand-built cubic-Bézier path using this radius.
  private static readonly PDF_NODE_CORNER_RADIUS = 8;
  // Cubic-Bézier quarter-circle approximation factor (4/3·(√2−1) ≈ 0.5523): the
  // control-point distance along each axis that best fits a true arc.
  private static readonly PDF_BEZIER_K = 0.5523;
  // Node label font size — on-screen/SVG/Canvas all use 14px for node labels.
  private static readonly PDF_NODE_LABEL_FONT_SIZE = 14;
  // Baseline-to-vertical-center offset. PDF `Tj` draws glyphs sitting on the text
  // origin (baseline); SVG/Canvas center via `dominant-baseline="middle"` /
  // `textBaseline="middle"`, whose glyph CENTER sits on the line. Placing the PDF
  // origin at the node's vertical center therefore leaves the glyphs ~0.35×fontSize
  // too HIGH. Dropping the origin by this fraction centers them (Helvetica cap/x
  // height ≈ 0.35em from baseline to visual midline).
  private static readonly PDF_LABEL_BASELINE_OFFSET = 0.35;

  /**
   * Export scene graph to specified format
   */
  async export(
    scene: SceneGraph,
    options: ExportOptions
  ): Promise<ExportResult> {

    // Defense-in-depth: validate scene content before format-specific escaping.
    // When EXPORT_STRICT_VALIDATION=true, high-severity findings block the export.
    const validation = validateSceneGraphForExport(
      scene, { strict: isStrictValidationEnabled() },
    );
    if (!validation.passed) {
      const highFindings = validation.findings.filter((f) => f.severity === 'high');
      throw new FormatValidationError(
        `Export blocked: ${highFindings.length} high-severity injection pattern(s) detected` +
        ` (${highFindings.map((f) => f.pattern).join(', ')})`,
        options.format,
        { findings: highFindings.map((f) => ({ field: f.field, pattern: f.pattern })) },
      );
    }

    // Defense-in-depth observability: when validation found dangerous content but
    // did not block (non-strict mode), the format-specific escape functions will
    // neutralize it. Record this so the 'escape-function' layer metrics reflect
    // how often escaping is actively protecting against flagged content.
    const findings = safeArray(validation.findings);
    if (findings.length > 0) {
      securityMetricsCollector.recordFindings(
        'escape-function',
        findings.map((f) => ({ severity: f.severity, pattern: f.pattern })),
      );
    }

    try {
      switch (options.format) {
        case 'svg':
          return await this.exportSVG(scene, options);
        case 'png':
          return await this.exportPNG(scene, options);
        case 'pdf':
          return await this.exportPDF(scene, options);
        case 'json':
          return this.exportJSON(scene, options);
        default:
          throw new ExportError(`Unsupported export format: ${options.format}`, options.format);
      }
    } catch (error) {
      logger.error(`Phase 37: Export failed for ${options.format}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Export as SVG (vector graphics)
   */
  private async exportSVG(
    scene: SceneGraph,
    options: ExportOptions
  ): Promise<ExportResult> {
    const width = options.width || this.defaultWidth;
    const height = options.height || this.defaultHeight;
    const bgColor = options.backgroundColor || '#ffffff';

    const svg = this.generateSVG(scene, width, height, bgColor);
    const blob = new Blob([svg], { type: 'image/svg+xml' });

    return {
      success: true,
      data: blob,
      mimeType: 'image/svg+xml',
      filename: `${sanitizeFilename(scene.id)}.svg`,
      metadata: {
        format: 'svg',
        sizeBytes: blob.size,
        dimensions: { width, height },
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Export as PNG (raster image)
   */
  private async exportPNG(
    scene: SceneGraph,
    options: ExportOptions
  ): Promise<ExportResult> {
    const width = options.width || this.defaultWidth;
    const height = options.height || this.defaultHeight;
    // `??` not `||`: ExportOptions.quality is a 0-1 value, so a legitimate 0
    // must pass through to the encoder rather than collapsing to the 0.95 default.
    const quality = options.quality ?? 0.95;

    // Create canvas
    const canvas = this.createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new ExportError('Failed to get canvas context', 'png');
    }

    // Draw background
    ctx.fillStyle = options.backgroundColor || '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Render diagram to canvas
    this.renderToCanvas(ctx, scene, width, height);

    // Convert to blob
    const blob = await this.canvasToBlob(canvas, 'image/png', quality);

    return {
      success: true,
      data: blob,
      mimeType: 'image/png',
      filename: `${sanitizeFilename(scene.id)}.png`,
      metadata: {
        format: 'png',
        sizeBytes: blob.size,
        dimensions: { width, height },
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Export as PDF (print-ready document)
   */
  private async exportPDF(
    scene: SceneGraph,
    options: ExportOptions
  ): Promise<ExportResult> {
    const width = options.width || this.defaultWidth;
    const height = options.height || this.defaultHeight;
    const bgColor = options.backgroundColor || '#ffffff';

    const pdfData = this.renderSceneToPDF(scene, width, height, bgColor);

    return {
      success: true,
      data: pdfData,
      mimeType: 'application/pdf',
      filename: `${sanitizeFilename(scene.id)}.pdf`,
      metadata: {
        format: 'pdf',
        sizeBytes: pdfData.size,
        dimensions: { width, height },
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Export as JSON (structured data)
   */
  private exportJSON(
    scene: SceneGraph,
    options: ExportOptions
  ): ExportResult {
    const jsonData = {
      id: scene.id,
      type: scene.type,
      nodes: scene.nodes,
      edges: scene.edges,
      startMs: scene.startMs,
      durationMs: scene.durationMs,
      summary: scene.summary,
      keyphrases: scene.keyphrases,
      layout: scene.layout,
      metadata: options.includeMetadata
        ? {
            generatedAt: new Date().toISOString(),
            exportFormat: 'json',
            version: '1.0',
          }
        : undefined,
    };

    const jsonString = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    return {
      success: true,
      data: blob,
      mimeType: 'application/json',
      filename: `${sanitizeFilename(scene.id)}.json`,
      metadata: {
        format: 'json',
        sizeBytes: blob.size,
        dimensions: { width: 0, height: 0 },
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Generate SVG markup from scene
   */
  private generateSVG(
    scene: SceneGraph,
    width: number,
    height: number,
    bgColor: string
  ): string {
    const nodes = scene.layout?.nodes || [];
    const edges = scene.layout?.edges || [];

    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <title>${escapeXml(scene.id)}</title>
  <rect width="${width}" height="${height}" fill="${bgColor}"/>
  <g id="diagram">
`;

    // Draw edges first (so they appear behind nodes)
    for (const edge of edges) {
      const fromNode = nodes.find((n) => n.id === edge.from);
      const toNode = nodes.find((n) => n.id === edge.to);

      if (fromNode && toNode) {
        const fw = getNodeWidth(fromNode);
        const fh = getNodeHeight(fromNode);
        const tw = getNodeWidth(toNode);
        const th = getNodeHeight(toNode);
        const fx = (fromNode.x || 0) + fw / 2;
        const fy = (fromNode.y || 0) + fh / 2;
        const tx = (toNode.x || 0) + tw / 2;
        const ty = (toNode.y || 0) + th / 2;
        svg += `    <line x1="${fx}" y1="${fy}" x2="${tx}" y2="${ty}" stroke="#666" stroke-width="2" marker-end="url(#arrowhead)"/>
`;
        if (edge.label) {
          const midX = (fx + tx) / 2;
          const midY = (fy + ty) / 2;
          svg += `    <text x="${midX}" y="${midY - 5}" fill="#666" font-size="12" font-family="sans-serif" text-anchor="middle">${escapeXml(edge.label)}</text>
`;
        }
      }
    }

    // Draw nodes
    for (const node of nodes) {
      const x = node.x || 0;
      const y = node.y || 0;
      const w = getNodeWidth(node);
      const h = getNodeHeight(node);

      svg += `    <g id="${escapeXml(node.id)}">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#3b82f6" stroke="#2E5C8A" stroke-width="2" rx="8"/>
      <text x="${x + w / 2}" y="${y + h / 2}" fill="white" font-size="14" font-weight="bold" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle">${escapeXml(node.label)}</text>
    </g>
`;
    }

    // Add arrow marker definition
    svg += `  </g>
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
    </marker>
  </defs>
</svg>`;

    return svg;
  }

  /**
   * Create canvas element (browser or Node.js compatible)
   */
  private createCanvas(width: number, height: number): HTMLCanvasElement {
    // Browser environment
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    }

    // Node.js environment - would need node-canvas library
    throw new ExportError('Canvas rendering requires browser environment or node-canvas library', 'canvas');
  }

  /**
   * Render diagram to canvas context
   */
  private renderToCanvas(
    ctx: CanvasRenderingContext2D,
    scene: SceneGraph,
    width: number,
    height: number
  ): void {
    const nodes = scene.layout?.nodes || [];
    const edges = scene.layout?.edges || [];

    // Draw edges
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    for (const edge of edges) {
      const fromNode = nodes.find((n) => n.id === edge.from);
      const toNode = nodes.find((n) => n.id === edge.to);

      if (fromNode && toNode) {
        const fw = getNodeWidth(fromNode);
        const fh = getNodeHeight(fromNode);
        const tw = getNodeWidth(toNode);
        const th = getNodeHeight(toNode);
        const fx = (fromNode.x || 0) + fw / 2;
        const fy = (fromNode.y || 0) + fh / 2;
        const tx = (toNode.x || 0) + tw / 2;
        const ty = (toNode.y || 0) + th / 2;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(tx, ty);
        ctx.stroke();

        if (edge.label) {
          const midX = (fx + tx) / 2;
          const midY = (fy + ty) / 2;
          ctx.fillStyle = '#666';
          ctx.font = '12px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(edge.label, midX, midY - 5);
        }
      }
    }

    // Draw nodes
    for (const node of nodes) {
      const x = node.x || 0;
      const y = node.y || 0;
      const w = getNodeWidth(node);
      const h = getNodeHeight(node);

      // Node rectangle (#3b82f6 — matches the on-screen DiagramScene fill so
      // downloads are WYSIWYG with the rendered video). Corner radius 8 matches
      // the on-screen `borderRadius: 8` (previously a divergent 5).
      ctx.fillStyle = '#3b82f6';
      ctx.strokeStyle = '#2E5C8A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 8);
      ctx.fill();
      ctx.stroke();

      // Node label — bold sans-serif matches the on-screen `fontWeight: 'bold'`
      // / `fontFamily: 'sans-serif'` (previously regular-weight Arial).
      ctx.fillStyle = 'white';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label, x + w / 2, y + h / 2);
    }
  }

  /**
   * Convert canvas to blob
   */
  private canvasToBlob(
    canvas: HTMLCanvasElement,
    mimeType: string,
    quality: number
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob from canvas'));
          }
        },
        mimeType,
        quality
      );
    });
  }

  /**
   * Render scene graph directly to PDF using native PDF drawing operators.
   *
   * PDF coordinate origin is bottom-left; node coordinates use top-left,
   * so Y is flipped: pdfY = pageHeight - svgY.
   */
  private renderSceneToPDF(
    scene: SceneGraph,
    pageWidth: number,
    pageHeight: number,
    bgColor: string
  ): Blob {
    const nodes = scene.layout?.nodes || [];
    const edges = scene.layout?.edges || [];

    // Build content stream
    const parts: string[] = [];

    // Background
    parts.push(this.pdfColorFill(bgColor));
    parts.push(`0 0 ${pageWidth} ${pageHeight} re f`);

    // Draw edges (behind nodes)
    parts.push('0.4 0.4 0.4 RG'); // stroke #666
    parts.push('2 w');
    for (const edge of edges) {
      const from = nodes.find((n) => n.id === edge.from);
      const to = nodes.find((n) => n.id === edge.to);
      if (from && to) {
        // node.x/y is the top-LEFT corner (matching generateSVG/renderToCanvas
        // and the on-screen NodeAnimation), so the center is corner + half
        // size. The previous form used the raw corner as the endpoint, which
        // only matched a CENTER convention — shifting every edge endpoint
        // up-left by half a node relative to the other formats.
        const fx = (from.x || 0) + getNodeWidth(from) / 2;
        const fy = (from.y || 0) + getNodeHeight(from) / 2;
        const tx = (to.x || 0) + getNodeWidth(to) / 2;
        const ty = (to.y || 0) + getNodeHeight(to) / 2;
        parts.push(`${fx} ${pageHeight - fy} m ${tx} ${pageHeight - ty} l S`);
        if (edge.label) {
          const midX = (fx + tx) / 2;
          const midY = pageHeight - (fy + ty) / 2;
          // Offset the text origin left by half the label width so the label is
          // horizontally centered on the edge midpoint — matching SVG/Canvas
          // (text-anchor / textAlign middle). Without this, `Td` anchors the
          // left edge at midX and the label extends right, half a width off.
          const edgeLabelX = midX - this.estimatePdfTextWidth(edge.label, 12) / 2;
          parts.push('BT');
          parts.push('/F1 12 Tf');
          parts.push('0.4 0.4 0.4 rg');
          parts.push(`${edgeLabelX} ${midY + 5} Td`);
          parts.push(`(${this.escapePDFString(edge.label)}) Tj`);
          parts.push('ET');
        }
      }
    }

    // Draw nodes
    for (const node of nodes) {
      const x = node.x || 0;
      const y = node.y || 0;
      const w = getNodeWidth(node);
      const h = getNodeHeight(node);
      // PDF rect lower-left corner. node.x/y is the top-left corner (matching
      // generateSVG/renderToCanvas and the on-screen NodeAnimation); flip to
      // PDF's bottom-left origin. The previous `x - w/2` / `y - h/2` treated
      // node.x/y as the CENTER, shifting every node up-left by half its size
      // relative to SVG/PNG and the on-screen render.
      const rx = x;
      const ry = pageHeight - y - h;

      // Node background (#3b82f6 — matches on-screen DiagramScene fill). Rounded
      // corners (radius 8) match the on-screen `borderRadius: 8`, SVG `rx="8"` and
      // Canvas `roundRect(...,8)`. PDF has no rounded-rect operator, so the body
      // is drawn as a cubic-Bézier path (4 quarter-circle corners) then filled +
      // stroked with `B` (previously a sharp `re B`).
      parts.push('0.23 0.51 0.96 rg');
      parts.push('0.18 0.36 0.54 RG');
      parts.push('2 w');
      for (const op of this.pdfRoundedRectOps(rx, ry, w, h)) {
        parts.push(op);
      }
      parts.push('B');

      // Node label centered on the rect center (corner + half size), matching
      // SVG/Canvas text-anchor middle. Offset the origin left by half the label
      // width so it sits on the center instead of extending right. Bold
      // Helvetica (/F2) matches the on-screen `fontWeight: 'bold'`, SVG
      // `font-weight="bold"` and Canvas `bold 14px` (previously regular /F1).
      parts.push('BT');
      parts.push(`/F2 ${MultiFormatExporter.PDF_NODE_LABEL_FONT_SIZE} Tf`);
      parts.push('1 1 1 rg');
      const nodeLabelX = x + w / 2 - this.estimatePdfTextWidth(node.label, MultiFormatExporter.PDF_NODE_LABEL_FONT_SIZE) / 2;
      // Drop the origin below the node center by ~0.35×fontSize so the glyph
      // bodies — which extend UP from the PDF baseline — sit visually centered,
      // matching SVG `dominant-baseline="middle"` / Canvas `textBaseline="middle"`
      // (previously the origin sat exactly at center, leaving labels ~0.35em high).
      const nodeLabelY = pageHeight - (y + h / 2) - MultiFormatExporter.PDF_NODE_LABEL_FONT_SIZE * MultiFormatExporter.PDF_LABEL_BASELINE_OFFSET;
      parts.push(`${nodeLabelX} ${nodeLabelY} Td`);
      parts.push(`(${this.escapePDFString(node.label)}) Tj`);
      parts.push('ET');
    }

    const streamContent = parts.join('\n');

    // Build minimal valid PDF with a content stream
    const objects: string[] = [];
    const offsets: number[] = [];
    let pdf = '%PDF-1.4\n';

    // Object 1: Catalog
    offsets.push(pdf.length);
    pdf += '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';

    // Object 2: Pages
    offsets.push(pdf.length);
    pdf += '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';

    // Object 3: Page — /F1 (Helvetica, regular) for edge labels, /F2 (Helvetica-Bold)
    // for node labels, matching SVG/Canvas `font-weight="bold"` on nodes only.
    offsets.push(pdf.length);
    pdf += `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n`;

    // Object 4: Content stream
    offsets.push(pdf.length);
    pdf += `4 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj\n`;

    // Object 5: Font (Helvetica — regular, used for edge labels)
    offsets.push(pdf.length);
    pdf += '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n';

    // Object 6: Font (Helvetica-Bold — used for node labels, matching on-screen
    // `fontWeight: 'bold'` / SVG `font-weight="bold"` / Canvas `bold`).
    offsets.push(pdf.length);
    pdf += '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n';

    // Cross-reference table
    const xrefOffset = pdf.length;
    pdf += 'xref\n';
    pdf += `0 7\n`;
    pdf += '0000000000 65535 f \n';
    for (const off of offsets) {
      pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
    }

    // Trailer
    pdf += 'trailer\n';
    pdf += `<< /Size 7 /Root 1 0 R >>\n`;
    pdf += 'startxref\n';
    pdf += `${xrefOffset}\n`;
    pdf += '%%EOF';

    return new Blob([pdf], { type: 'application/pdf' });
  }

  /**
   * Build the PDF path operators for a rounded rectangle, tracing four
   * quarter-circle corners with cubic Béziers and connecting them with lines.
   *
   * PDF has no native rounded-rect operator (only the sharp `re`), so to match
   * the on-screen `borderRadius: 8` / SVG `rx="8"` / Canvas `roundRect(...,8)`
   * each corner is approximated by a cubic Bézier whose control points sit at
   * `k = radius·0.5523` along the two adjacent edges — the standard quarter-circle
   * approximation (deviates <0.1% from a true arc, visually identical to SVG's
   * circular corners). The caller fills + strokes the resulting path with `B`.
   *
   * @param rx  lower-left x (PDF bottom-left origin; node top-left flipped by caller)
   * @param ry  lower-left y
   * @param w   width
   * @param h   height
   * @returns   ordered PDF path operators (`m`/`l`/`c`/`h`), no paint operator
   */
  private pdfRoundedRectOps(rx: number, ry: number, w: number, h: number): string[] {
    // Clamp the radius so it can never exceed half the smaller dimension (two
    // corners would otherwise overlap and invert the path on tiny nodes).
    const cr = Math.max(0, Math.min(MultiFormatExporter.PDF_NODE_CORNER_RADIUS, w / 2, h / 2));
    const k = cr * MultiFormatExporter.PDF_BEZIER_K;
    // Round to 2 dp to keep the content stream compact and deterministic.
    const f = (n: number): string => (Math.round(n * 100) / 100).toString();

    // Trace counter-clockwise (PDF y-up) from the bottom edge, just right of the
    // bottom-left corner, around all four corners.
    return [
      `${f(rx + cr)} ${f(ry)} m`,
      `${f(rx + w - cr)} ${f(ry)} l`,
      // bottom-right corner: arc from below-center to right-of-center
      `${f(rx + w - cr + k)} ${f(ry)} ${f(rx + w)} ${f(ry + cr - k)} ${f(rx + w)} ${f(ry + cr)} c`,
      `${f(rx + w)} ${f(ry + h - cr)} l`,
      // top-right corner: arc from right-of-center to above-center
      `${f(rx + w)} ${f(ry + h - cr + k)} ${f(rx + w - cr + k)} ${f(ry + h)} ${f(rx + w - cr)} ${f(ry + h)} c`,
      `${f(rx + cr)} ${f(ry + h)} l`,
      // top-left corner: arc from above-center to left-of-center
      `${f(rx + cr - k)} ${f(ry + h)} ${f(rx)} ${f(ry + h - cr + k)} ${f(rx)} ${f(ry + h - cr)} c`,
      `${f(rx)} ${f(ry + cr)} l`,
      // bottom-left corner: arc from left-of-center to below-center
      `${f(rx)} ${f(ry + cr - k)} ${f(rx + cr - k)} ${f(ry)} ${f(rx + cr)} ${f(ry)} c`,
      `h`,
    ];
  }

  /**
   * Convert a hex color string (#RRGGBB) to PDF fill operator
   */
  private pdfColorFill(hex: string): string {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    const rn = Number.isFinite(r) ? r / 255 : 1;
    const gn = Number.isFinite(g) ? g / 255 : 1;
    const bn = Number.isFinite(b) ? b / 255 : 1;
    return `${rn.toFixed(3)} ${gn.toFixed(3)} ${bn.toFixed(3)} rg`;
  }

  /**
   * Estimate the rendered width (in PDF user-space units ≈ px) of a text label
   * at the given font size, for horizontal centering.
   *
   * Why this exists: SVG/Canvas/on-screen all center labels via the renderer's
   * `text-anchor="middle"` / `textAlign="center"` (which use exact font
   * metrics). PDF here is a hand-rolled content stream with no access to those
   * metrics, so the `Td` operator places the text ORIGIN (left edge) and `Tj`
   * draws left→right — leaving every label shifted right by half its width
   * relative to the other formats. To center, we offset the origin left by
   * half the estimated width.
   *
   * The estimate reuses the CJK-aware `textWidth` char-unit model (CJK glyphs
   * count as 2 units, Latin as 1) scaled by ~0.5×fontSize — Helvetica (the
   * embedded /F1) averages ~0.5em per Latin glyph and ~1em per CJK glyph, so
   * the double-counting of CJK lands at the right magnitude. It is an
   * approximation (not pixel-exact), but it removes the gross half-width
   * asymmetry and brings PDF label placement into WYSIWYG parity with the
   * other export formats and the on-screen render.
   */
  private estimatePdfTextWidth(text: string, fontSize: number): number {
    return textWidth(text) * fontSize * 0.5;
  }

  /**
   * Escape special characters for PDF string literal (defense-in-depth).
   *
   * PDF spec §7.3.4.2: Within a literal string, backslash starts an escape
   * sequence. Unbalanced parentheses or raw control characters could be
   * misinterpreted by lenient parsers, so we escape them explicitly.
   */
  private escapePDFString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t')
      .replace(/\f/g, '\\f')
      .replace(/\0/g, '')
      // eslint-disable-next-line no-control-regex
      .replace(/[\x01-\x08\x0b\x0e-\x1f\x7f]/g, (ch) => {
        const oct = ch.charCodeAt(0).toString(8).padStart(3, '0');
        return `\\${oct}`;
      });
  }

  /**
   * Batch export multiple scenes
   */
  async exportBatch(
    scenes: SceneGraph[],
    options: ExportOptions
  ): Promise<ExportResult[]> {

    const results = await Promise.all(
      scenes.map((scene) => this.export(scene, options))
    );

    const successCount = results.filter((r) => r.success).length;

    return results;
  }
}

// Export singleton instance
export const multiFormatExporter = new MultiFormatExporter();
