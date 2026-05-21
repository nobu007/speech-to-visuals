---
title: Module src-components
genre: repository-analysis
type: entity
sources:
  - extract-skill-meta planning artifacts
related:
  - Module Index
  - Repository Risk Register
  - File Inventory
status: generated
---
# Module src-components

## Role

- Rationale: Files under src form a shared path-level boundary.
- Roots: src
- Languages: tsx, typescript
- Files: 52
- Bytes: 409157

## Key Files

- `src/components/__tests__/mobile-responsive.test.ts`
- `src/components/AudioUploader.tsx`
- `src/components/DiagramPreview.tsx`
- `src/components/EnhancedFileUploader.tsx`
- `src/components/EnhancedVideoPreview.tsx`
- `src/components/ErrorAlertSystem.tsx`
- `src/components/FrameworkDashboard.tsx`
- `src/components/FrameworkDashboardPage.tsx`

## Risk Signals

- RISK-0476 (medium, Persistence Or State) in `src/components/AudioUploader.tsx`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L1: import { useState, useRef, useCallback, memo } from 'react';
- RISK-0477 (medium, Concurrency Or Timing) in `src/components/EnhancedFileUploader.tsx`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L84: setTimeout(() => {
- RISK-0478 (medium, Persistence Or State) in `src/components/EnhancedFileUploader.tsx`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L16: import React, { useState, useCallback, useRef, DragEvent } from 'react';
- RISK-0479 (medium, Persistence Or State) in `src/components/EnhancedVideoPreview.tsx`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L14: import React, { useState, useRef, useEffect, useCallback } from 'react';
- RISK-0480 (medium, Concurrency Or Timing) in `src/components/ErrorAlertSystem.tsx`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L152: const executeRecovery = async (errorId: string, strategyName: string) => {
- RISK-0481 (medium, Persistence Or State) in `src/components/ErrorAlertSystem.tsx`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L7: import React, { useState, useEffect } from 'react';
- RISK-0482 (medium, Concurrency Or Timing) in `src/components/FrameworkDashboard.tsx`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L164: const fetchIterationData = async () => {
- RISK-0483 (medium, Persistence Or State) in `src/components/FrameworkDashboard.tsx`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L14: import React, { useState, useEffect } from 'react';
- RISK-0484 (medium, Concurrency Or Timing) in `src/components/FrameworkDashboardPage.tsx`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L32: const handleExecute = async (phase: string) => {
- RISK-0485 (medium, Concurrency Or Timing) in `src/components/InteractiveResultViewer.tsx`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L147: const generateSceneThumbnail = async (scene: Record<string, unknown>, index: number): Promise<string> => {
- RISK-0486 (medium, Persistence Or State) in `src/components/InteractiveResultViewer.tsx`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L41: interface ViewState {
- RISK-0487 (medium, Concurrency Or Timing) in `src/components/Iteration43Interface.tsx`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L110: await new Promise(resolve => setTimeout(resolve, 1000));
- RISK-0488 (medium, Persistence Or State) in `src/components/Iteration43Interface.tsx`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L1: import React, { useState, useEffect, useCallback } from 'react';
- RISK-0489 (low, High Attention File) in `src/components/Iteration43Interface.tsx`: The digest found several implementation signals worth manual review. Evidence: L38: memoryUsage: number;
- RISK-0490 (medium, Persistence Or State) in `src/components/PerformanceMetricsVisualization.tsx`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L13: import React, { useState, useEffect } from 'react';
- RISK-0491 (medium, Network Or IPC) in `src/components/PipelineProgress.tsx`: Cross-process or network boundaries can fail through protocol, timeout, and trust assumptions. Evidence: L4: * global progress bar, ETA, quality score, and WebSocket integration.
- RISK-0492 (low, High Attention File) in `src/components/PipelineProgress.tsx`: The digest found several implementation signals worth manual review. Evidence: L4: * global progress bar, ETA, quality score, and WebSocket integration.
- RISK-0493 (low, High Attention File) in `src/components/ProcessingStatus.tsx`: The digest found several implementation signals worth manual review. Evidence: L1: import { memo, useMemo } from 'react';
- RISK-0494 (medium, Concurrency Or Timing) in `src/components/ProductionDashboard.tsx`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L175: <Label htmlFor="timeout">Timeout (ms)</Label>
- RISK-0495 (medium, Parser Or Heuristic) in `src/components/ProductionDashboard.tsx`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L152: maxConcurrentJobs: parseInt(e.target.value) || 1
- RISK-0496 (medium, Persistence Or State) in `src/components/ProductionDashboard.tsx`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L7: import React, { useState, useEffect } from 'react';
- RISK-0497 (low, High Attention File) in `src/components/ProductionDashboard.tsx`: The digest found several implementation signals worth manual review. Evidence: L119: <Label>Available Memory</Label>
- RISK-0498 (medium, Network Or IPC) in `src/components/SimplePipelineInterface.tsx`: Cross-process or network boundaries can fail through protocol, timeout, and trust assumptions. Evidence: L10: TooltipContent,
- RISK-0499 (medium, Persistence Or State) in `src/components/SimplePipelineInterface.tsx`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L44: const [state, dispatch] = useReducer(pipelineReducer, initialPipelineState);
- RISK-0500 (low, High Attention File) in `src/components/SimplePipelineInterface.tsx`: The digest found several implementation signals worth manual review. Evidence: L10: TooltipContent,
- RISK-0501 (medium, Concurrency Or Timing) in `src/components/SimplePipelineStateMachine.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L4: * Any state can transition to error, error -> idle for retry/reset
- RISK-0502 (medium, Persistence Or State) in `src/components/SimplePipelineStateMachine.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: path contains `state`
- RISK-0503 (medium, Network Or IPC) in `src/components/StageIndicator.tsx`: Cross-process or network boundaries can fail through protocol, timeout, and trust assumptions. Evidence: L21: TooltipContent,
- RISK-0504 (low, High Attention File) in `src/components/StageIndicator.tsx`: The digest found several implementation signals worth manual review. Evidence: L7: import { memo, useMemo, type FC } from 'react';
- RISK-0505 (medium, Concurrency Or Timing) in `src/components/StreamingProcessor.tsx`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L79: const statsTimer = useRef<NodeJS.Timeout | null>(null);
- RISK-0506 (medium, Persistence Or State) in `src/components/StreamingProcessor.tsx`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L7: import React, { useState, useCallback, useRef, useEffect } from 'react';
- RISK-0507 (medium, Parser Or Heuristic) in `src/components/TutorialSystem.tsx`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L58: const parsed = JSON.parse(savedProgress);
- RISK-0508 (medium, Persistence Or State) in `src/components/TutorialSystem.tsx`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L7: import React, { useState, useEffect } from 'react';
- RISK-0509 (low, High Attention File) in `src/components/TutorialSystem.tsx`: The digest found several implementation signals worth manual review. Evidence: L46: // ISS-014: Wrap all localStorage access in try-catch for private browsing / quota errors
- RISK-0510 (medium, Persistence Or State) in `src/components/VideoGenerationPanel.tsx`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L6: import React, { useState, useCallback, useEffect } from 'react';
- RISK-0511 (medium, Parser Or Heuristic) in `src/components/VideoPreview.tsx`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L187: // Empty scenes fallback
- RISK-0512 (medium, Persistence Or State) in `src/components/VideoPreview.tsx`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L6: import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
- RISK-0513 (medium, Concurrency Or Timing) in `src/components/VideoRenderer.tsx`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L30: const handleRender = async () => {
- RISK-0514 (medium, Persistence Or State) in `src/components/VideoRenderer.tsx`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L1: import {useState, memo, useCallback, useMemo} from 'react';
- RISK-0515 (medium, Concurrency Or Timing) in `src/components/__tests__/AudioUploader.test.tsx`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L195: await new Promise(r => setTimeout(r, 0));
- RISK-0516 (low, High Attention File) in `src/components/__tests__/AudioUploader.test.tsx`: The digest found several implementation signals worth manual review. Evidence: L195: await new Promise(r => setTimeout(r, 0));
- RISK-0517 (medium, Concurrency Or Timing) in `src/components/__tests__/SimplePipelineInterface.test.tsx`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L172: it('should transition from error to idle on RETRY', () => {
- RISK-0518 (medium, Persistence Or State) in `src/components/__tests__/SimplePipelineInterface.test.tsx`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L177: state = pipelineReducer(state, { type: 'RETRY' });
- RISK-0519 (low, High Attention File) in `src/components/__tests__/SimplePipelineInterface.test.tsx`: The digest found several implementation signals worth manual review. Evidence: L172: it('should transition from error to idle on RETRY', () => {
- RISK-0520 (medium, Parser Or Heuristic) in `src/components/__tests__/StageIndicator.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L58: it('uses Date.now() as fallback when nowMs and completedAt are null', () => {
- RISK-0521 (medium, Concurrency Or Timing) in `src/components/pipeline-interface.tsx`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L103: const saveAudioFile = async (file: File): Promise<string> => {
- RISK-0522 (medium, Persistence Or State) in `src/components/pipeline-interface.tsx`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L1: import React, { useState, useCallback } from 'react';
- RISK-0523 (high, Security Boundary) in `src/components/ui/alert.tsx`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L2: import { cva, type VariantProps } from "class-variance-authority";
- RISK-0524 (high, Security Boundary) in `src/components/ui/badge.tsx`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L2: import { cva, type VariantProps } from "class-variance-authority";
- RISK-0525 (high, Security Boundary) in `src/components/ui/button.tsx`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L3: import { cva, type VariantProps } from "class-variance-authority";
- RISK-0526 (high, Security Boundary) in `src/components/ui/label.tsx`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L3: import { cva, type VariantProps } from "class-variance-authority";
- RISK-0527 (high, Security Boundary) in `src/components/ui/sheet.tsx`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L2: import { cva, type VariantProps } from "class-variance-authority";
- RISK-0528 (high, Security Boundary) in `src/components/ui/toast.tsx`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L3: import { cva, type VariantProps } from "class-variance-authority";
- RISK-0529 (medium, Network Or IPC) in `src/components/ui/tooltip.tsx`: Cross-process or network boundaries can fail through protocol, timeout, and trust assumptions. Evidence: L12: const TooltipContent = React.forwardRef<

## Files

- `src/components/AudioUploader.tsx` — tsx, 191 lines, attention 36
- `src/components/DiagramPreview.tsx` — tsx, 102 lines, attention 8
- `src/components/EnhancedFileUploader.tsx` — tsx, 329 lines, attention 22
- `src/components/EnhancedVideoPreview.tsx` — tsx, 478 lines, attention 22
- `src/components/ErrorAlertSystem.tsx` — tsx, 413 lines, attention 14
- `src/components/FrameworkDashboard.tsx` — tsx, 601 lines, attention 14
- `src/components/FrameworkDashboardPage.tsx` — tsx, 106 lines, attention 28
- `src/components/InteractiveResultViewer.tsx` — tsx, 629 lines, attention 14
- `src/components/Iteration43Interface.tsx` — tsx, 459 lines, attention 98
- `src/components/PerformanceMetricsVisualization.tsx` — tsx, 425 lines, attention 0
- `src/components/PipelineProgress.tsx` — tsx, 441 lines, attention 100
- `src/components/ProcessingStatus.tsx` — tsx, 71 lines, attention 84
- `src/components/ProductionDashboard.tsx` — tsx, 554 lines, attention 100
- `src/components/SimplePipelineInterface.tsx` — tsx, 478 lines, attention 100
- `src/components/SimplePipelineStateMachine.ts` — typescript, 187 lines, attention 50
- `src/components/StageIndicator.tsx` — tsx, 210 lines, attention 100
- `src/components/StreamingProcessor.tsx` — tsx, 681 lines, attention 56
- `src/components/TutorialSystem.tsx` — tsx, 443 lines, attention 70
- `src/components/VideoGenerationPanel.tsx` — tsx, 665 lines, attention 14
- `src/components/VideoPreview.tsx` — tsx, 397 lines, attention 50
- `src/components/VideoRenderer.tsx` — tsx, 212 lines, attention 14
- `src/components/__tests__/AudioUploader.test.tsx` — tsx, 795 lines, attention 100
- `src/components/__tests__/SimplePipelineInterface.test.tsx` — tsx, 441 lines, attention 70
- `src/components/__tests__/StageIndicator.test.ts` — typescript, 160 lines, attention 14
- `src/components/__tests__/VideoPreview.test.tsx` — tsx, 285 lines, attention 8
- `src/components/__tests__/mobile-responsive.test.ts` — typescript, 224 lines, attention 0
- `src/components/pipeline-interface.tsx` — tsx, 374 lines, attention 0
- `src/components/ui/__tests__/button.test.tsx` — tsx, 104 lines, attention 0
- `src/components/ui/__tests__/select.test.tsx` — tsx, 116 lines, attention 0
- `src/components/ui/alert-dialog.tsx` — tsx, 105 lines, attention 0
- `src/components/ui/alert.tsx` — tsx, 44 lines, attention 14
- `src/components/ui/badge.tsx` — tsx, 30 lines, attention 14
- `src/components/ui/button.tsx` — tsx, 48 lines, attention 14
- `src/components/ui/card.tsx` — tsx, 44 lines, attention 0
- `src/components/ui/checkbox.tsx` — tsx, 27 lines, attention 0
- `src/components/ui/dialog.tsx` — tsx, 96 lines, attention 0
- `src/components/ui/input.tsx` — tsx, 23 lines, attention 0
- `src/components/ui/label.tsx` — tsx, 18 lines, attention 14
- `src/components/ui/progress.tsx` — tsx, 24 lines, attention 0
- `src/components/ui/scroll-area.tsx` — tsx, 39 lines, attention 0
- `src/components/ui/select.tsx` — tsx, 144 lines, attention 0
- `src/components/ui/separator.tsx` — tsx, 21 lines, attention 0
- `src/components/ui/sheet.tsx` — tsx, 108 lines, attention 14
- `src/components/ui/skeleton.tsx` — tsx, 8 lines, attention 0
- `src/components/ui/slider.tsx` — tsx, 24 lines, attention 0
- `src/components/ui/sonner.tsx` — tsx, 28 lines, attention 0
- `src/components/ui/switch.tsx` — tsx, 28 lines, attention 0
- `src/components/ui/tabs.tsx` — tsx, 54 lines, attention 0
- `src/components/ui/toast.tsx` — tsx, 112 lines, attention 14
- `src/components/ui/toaster.tsx` — tsx, 25 lines, attention 14
- `src/components/ui/tooltip.tsx` — tsx, 29 lines, attention 42
- `src/components/ui/use-toast.ts` — typescript, 4 lines, attention 14
