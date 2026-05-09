/**
 * TASK-0144: Cost Estimator (REQ-098)
 *
 * Estimates USD cost for Gemini Flash/Pro API calls based on
 * published pricing per million tokens.
 *
 * Pricing source (as of 2025-05):
 *   Gemini 2.5 Flash: $0.075/M input, $0.30/M output
 *     https://ai.google.dev/pricing
 *   Gemini 2.5 Pro:   $1.25/M input, $5.00/M output
 *     https://ai.google.dev/pricing
 */

import type { ModelType, StageType, TokenUsageRecord } from './token-usage-tracker';

// Pricing per million tokens
const PRICING: Record<ModelType, { inputPerMillion: number; outputPerMillion: number }> = {
  'gemini-2.5-flash': { inputPerMillion: 0.075, outputPerMillion: 0.30 },
  'gemini-2.5-pro':   { inputPerMillion: 1.25,  outputPerMillion: 5.00 },
};

export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

export interface CostEstimate {
  flashCost: number;
  proCost: number;
  totalCost: number;
  costByStage: Record<StageType, number>;
}

/**
 * Calculate cost for a single model/token pair.
 */
export function calculateModelCost(
  model: ModelType,
  inputTokens: number,
  outputTokens: number,
): CostBreakdown {
  const pricing = PRICING[model];
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;
  return { inputCost, outputCost, totalCost: inputCost + outputCost };
}

/**
 * Build a full cost estimate from a list of token usage records.
 * Groups by model and stage.
 */
export function estimateCost(records: TokenUsageRecord[]): CostEstimate {
  const costByStage: Record<StageType, number> = {
    analysis: 0,
    fallback: 0,
    'cache-warmup': 0,
  };

  let flashCost = 0;
  let proCost = 0;

  for (const r of records) {
    const cost = calculateModelCost(r.model, r.inputTokens, r.outputTokens);
    costByStage[r.stage] += cost.totalCost;

    if (r.model === 'gemini-2.5-flash') {
      flashCost += cost.totalCost;
    } else {
      proCost += cost.totalCost;
    }
  }

  return {
    flashCost,
    proCost,
    totalCost: flashCost + proCost,
    costByStage,
  };
}
