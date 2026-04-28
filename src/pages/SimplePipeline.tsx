import React from 'react';
import SimplePipelineInterface from '@/components/SimplePipelineInterface';

/**
 * SimplePipeline Page
 * Route: /pipeline
 * Wraps the SimplePipelineInterface component as a page-level component
 */
const SimplePipeline: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 py-8 px-4">
      <SimplePipelineInterface />
    </div>
  );
};

export default SimplePipeline;
