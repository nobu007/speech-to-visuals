/**
 * TASK-0144: Token Usage Tracker (REQ-098)
 *
 * Records input/output token counts for each LLM API call,
 * grouped by stage (analysis, fallback, cache-warmup).
 */

export type ModelType = 'gemini-2.5-flash' | 'gemini-2.5-pro';

export type StageType = 'analysis' | 'fallback' | 'cache-warmup';

export interface TokenUsageRecord {
  requestId: string;
  model: ModelType;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  timestamp: number;
  stage: StageType;
}

export interface TokenUsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  recordCount: number;
  byStage: Record<StageType, { inputTokens: number; outputTokens: number; totalTokens: number }>;
  byModel: Record<ModelType, { inputTokens: number; outputTokens: number; totalTokens: number }>;
}

let idCounter = 0;

export class TokenUsageTracker {
  private records: TokenUsageRecord[] = [];
  private maxRecords: number;
  private maxTokensPerRequest: number;
  private tokenWarnings: Array<{ requestId: string; totalTokens: number; maxTokens: number }> = [];

  constructor(options?: { maxRecords?: number; maxTokensPerRequest?: number }) {
    this.maxRecords = options?.maxRecords ?? 10_000;
    this.maxTokensPerRequest = options?.maxTokensPerRequest ?? Infinity;
  }

  /**
   * Record a token usage entry for an LLM API call.
   * Returns the created record.
   */
  recordTokenUsage(params: {
    model: ModelType;
    inputTokens: number;
    outputTokens: number;
    stage: StageType;
    requestId?: string;
  }): TokenUsageRecord {
    const totalTokens = params.inputTokens + params.outputTokens;
    const requestId = params.requestId ?? `tu_${Date.now()}_${++idCounter}`;

    const record: TokenUsageRecord = {
      requestId,
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      totalTokens,
      timestamp: Date.now(),
      stage: params.stage,
    };

    this.records.push(record);

    // Trim oldest records if over limit
    if (this.records.length > this.maxRecords) {
      this.records.shift();
    }

    // Check token limit per request
    if (totalTokens > this.maxTokensPerRequest) {
      this.tokenWarnings.push({ requestId, totalTokens, maxTokens: this.maxTokensPerRequest });
    }

    return record;
  }

  /**
   * Get all recorded token usage entries.
   */
  getRecords(): TokenUsageRecord[] {
    return [...this.records];
  }

  /**
   * Get token warnings for requests that exceeded the per-request token limit.
   */
  getTokenWarnings(): ReadonlyArray<{ requestId: string; totalTokens: number; maxTokens: number }> {
    return [...this.tokenWarnings];
  }

  /**
   * Get a summary of token usage across all records.
   */
  getSummary(): TokenUsageSummary {
    const summary: TokenUsageSummary = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      recordCount: this.records.length,
      byStage: {
        analysis: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        fallback: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        'cache-warmup': { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      },
      byModel: {
        'gemini-2.5-flash': { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        'gemini-2.5-pro': { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      },
    };

    for (const r of this.records) {
      summary.totalInputTokens += r.inputTokens;
      summary.totalOutputTokens += r.outputTokens;
      summary.totalTokens += r.totalTokens;

      summary.byStage[r.stage].inputTokens += r.inputTokens;
      summary.byStage[r.stage].outputTokens += r.outputTokens;
      summary.byStage[r.stage].totalTokens += r.totalTokens;

      summary.byModel[r.model].inputTokens += r.inputTokens;
      summary.byModel[r.model].outputTokens += r.outputTokens;
      summary.byModel[r.model].totalTokens += r.totalTokens;
    }

    return summary;
  }

  /**
   * Clear all records and warnings.
   */
  reset(): void {
    this.records = [];
    this.tokenWarnings = [];
  }
}
