import { qualityMonitor } from '@/quality';
import type { PipelineResult, PipelineStage } from '@/pipeline/types';

// Minimal quality check runner aligned with the spec
// Uses a lightweight mock result so this can run without a full pipeline execution.

async function main() {
  console.log('🧪 Running quality checks...');

  const mockStages: PipelineStage[] = [
    { name: 'transcription', success: true, processingTime: 1200, retries: 0 },
    { name: 'analysis', success: true, processingTime: 800, retries: 0 },
    { name: 'layout', success: true, processingTime: 600, retries: 0 },
  ];

  const mockResult: PipelineResult = {
    success: true,
    scenes: [],
    processingTime: 2800,
    stages: mockStages,
    metrics: {
      totalProcessingTime: 2800,
      transcriptionTime: 1200,
      analysisTime: 800,
      layoutTime: 600,
      renderTime: 0,
      memoryUsage: 128 * 1024 * 1024,
    },
  } as any;

  const assessment = await qualityMonitor.assessPipelineQuality(mockResult);
  console.log('✅ Quality check completed.');
  console.log(`Overall: ${(assessment.overallScore * 100).toFixed(1)}% | Performance: ${(assessment.performanceScore * 100).toFixed(1)}% | Accuracy: ${(assessment.accuracyScore * 100).toFixed(1)}% | Reliability: ${(assessment.reliabilityScore * 100).toFixed(1)}%`);
}

main().catch((err) => {
  console.error('❌ Quality check failed:', err);
  process.exit(1);
});

