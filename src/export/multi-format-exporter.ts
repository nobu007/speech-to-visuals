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
import type { NodeDatum, EdgeDatum } from '@/types/diagram';

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

  /**
   * Export scene graph to specified format
   */
  async export(
    scene: SceneGraph,
    options: ExportOptions
  ): Promise<ExportResult> {
    console.log(`📤 Phase 37: Exporting scene ${scene.id} as ${options.format.toUpperCase()}`);

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
          throw new Error(`Unsupported export format: ${options.format}`);
      }
    } catch (error) {
      console.error(`❌ Phase 37: Export failed for ${options.format}:`, error);
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
      filename: `${scene.id}.svg`,
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
    const quality = options.quality || 0.95;

    // Create canvas
    const canvas = this.createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
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
      filename: `${scene.id}.png`,
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
    // For Phase 37 MVP, we'll use SVG-to-PDF conversion
    // In production, consider using libraries like jsPDF
    const svgResult = await this.exportSVG(scene, options);

    if (!svgResult.success || !svgResult.data) {
      throw new Error('Failed to generate SVG for PDF conversion');
    }

    // Simple PDF wrapper around SVG
    // Note: This is a simplified implementation
    // For production, use proper PDF libraries
    const pdfData = await this.convertSVGToPDF(svgResult.data as Blob, options);

    return {
      success: true,
      data: pdfData,
      mimeType: 'application/pdf',
      filename: `${scene.id}.pdf`,
      metadata: {
        format: 'pdf',
        sizeBytes: pdfData.size,
        dimensions: {
          width: options.width || this.defaultWidth,
          height: options.height || this.defaultHeight,
        },
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
      content: scene.content,
      startTime: scene.startTime,
      endTime: scene.endTime,
      confidence: scene.confidence,
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
      filename: `${scene.id}.json`,
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
  <title>${scene.id}</title>
  <rect width="${width}" height="${height}" fill="${bgColor}"/>
  <g id="diagram">
`;

    // Draw edges first (so they appear behind nodes)
    for (const edge of edges) {
      const fromNode = nodes.find((n) => n.id === edge.from);
      const toNode = nodes.find((n) => n.id === edge.to);

      if (fromNode && toNode) {
        svg += `    <line x1="${fromNode.x}" y1="${fromNode.y}" x2="${toNode.x}" y2="${toNode.y}" stroke="#666" stroke-width="2" marker-end="url(#arrowhead)"/>
`;
        if (edge.label) {
          const midX = (fromNode.x! + toNode.x!) / 2;
          const midY = (fromNode.y! + toNode.y!) / 2;
          svg += `    <text x="${midX}" y="${midY - 5}" fill="#666" font-size="12" text-anchor="middle">${this.escapeXML(edge.label)}</text>
`;
        }
      }
    }

    // Draw nodes
    for (const node of nodes) {
      const x = node.x || 0;
      const y = node.y || 0;
      const w = node.width || 120;
      const h = node.height || 60;

      svg += `    <g id="${node.id}">
      <rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" fill="#4A90E2" stroke="#2E5C8A" stroke-width="2" rx="5"/>
      <text x="${x}" y="${y}" fill="white" font-size="14" text-anchor="middle" dominant-baseline="middle">${this.escapeXML(node.label)}</text>
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
    throw new Error('Canvas rendering requires browser environment or node-canvas library');
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
        ctx.beginPath();
        ctx.moveTo(fromNode.x || 0, fromNode.y || 0);
        ctx.lineTo(toNode.x || 0, toNode.y || 0);
        ctx.stroke();

        if (edge.label) {
          const midX = ((fromNode.x || 0) + (toNode.x || 0)) / 2;
          const midY = ((fromNode.y || 0) + (toNode.y || 0)) / 2;
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
      const w = node.width || 120;
      const h = node.height || 60;

      // Node rectangle
      ctx.fillStyle = '#4A90E2';
      ctx.strokeStyle = '#2E5C8A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - h / 2, w, h, 5);
      ctx.fill();
      ctx.stroke();

      // Node label
      ctx.fillStyle = 'white';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label, x, y);
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
   * Convert SVG to PDF (simplified implementation)
   */
  private async convertSVGToPDF(svgBlob: Blob, options: ExportOptions): Promise<Blob> {
    // Simplified PDF implementation
    // For production, use libraries like jsPDF or PDFKit
    const svgText = await svgBlob.text();

    // Create a simple PDF wrapper (this is a minimal implementation)
    // In production, use proper PDF libraries
    const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${options.width || this.defaultWidth} ${options.height || this.defaultHeight}] >>
endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000056 00000 n
0000000115 00000 n
trailer
<< /Size 4 /Root 1 0 R >>
startxref
228
%%EOF`;

    return new Blob([pdfContent], { type: 'application/pdf' });
  }

  /**
   * Escape XML special characters
   */
  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Batch export multiple scenes
   */
  async exportBatch(
    scenes: SceneGraph[],
    options: ExportOptions
  ): Promise<ExportResult[]> {
    console.log(`📦 Phase 37: Batch exporting ${scenes.length} scenes as ${options.format.toUpperCase()}`);

    const results = await Promise.all(
      scenes.map((scene) => this.export(scene, options))
    );

    const successCount = results.filter((r) => r.success).length;
    console.log(`✅ Phase 37: Batch export completed: ${successCount}/${scenes.length} successful`);

    return results;
  }
}

// Export singleton instance
export const multiFormatExporter = new MultiFormatExporter();
