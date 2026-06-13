# Runbook: LLM Budget Overage

**Alert**: `SpeechToVisualsLLMBudgetOverage`
**Severity**: Warning
**Condition**: Sustained slow requests combined with long uptime (proxy metric for budget approach)

## Symptoms

- LLM API costs are approaching the configured budget limit.
- Analysis pipeline may degrade as fallback strategies engage.

## Investigation

1. Check `/api/v1/monitoring/cost` for detailed cost breakdown and token usage.
2. Review which features consume the most Gemini API tokens.
3. Identify any runaway loops or excessive API calls in logs.
4. Check if batch processing is running unexpectedly.

## Mitigation

- **Excessive calls**: Throttle or disable batch processing temporarily.
- **Budget near limit**: Switch to Gemini Flash (cheaper) instead of Pro.
- **Unnecessary calls**: Disable AI analysis and use rule-based fallback.
- **Rate limiting**: Implement per-user API quotas.

## Resolution

1. Reduce token consumption to sustainable levels.
2. Review and adjust budget limits if usage patterns have changed.
3. Consider implementing request caching to reduce redundant API calls.
