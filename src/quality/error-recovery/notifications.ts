/**
 * User-facing error notification payloads for the enhanced error-recovery
 * system. Pure helpers moved verbatim from enhanced-error-recovery.ts —
 * no instance state.
 */

import type { NotificationPayload } from './types';

/**
 * Create a user notification payload from an error.
 *
 * @param error - The error that occurred
 * @param context - Context including stage and severity
 * @returns NotificationPayload for user display
 */
export function createErrorNotificationPayload(
error: Error,
context: { stage?: string; severity: 'low' | 'medium' | 'high' | 'critical' },
): NotificationPayload {
  const message = error.message;
  const severity = context.severity;
  const stage = context.stage ?? 'unknown';
  const isCritical = severity === 'critical';

  const suggestedActions = getNotificationSuggestedActions(message, severity);
  const recoverable = isRecoverableError(message);

  return {
    message,
    severity,
    stage,
    timestamp: Date.now(),
    recoverable,
    requiresUserAction: isCritical || !recoverable,
    suggestedActions,
  };
}

/**
 * Determine suggested actions based on error message.
 */
function getNotificationSuggestedActions(message: string, severity: string): string[] {
  const actions: string[] = [];
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('rate limit') || lowerMessage.includes('quota')) {
    actions.push('Wait a few seconds and retry');
    actions.push('Reduce the frequency of requests');
  } else if (lowerMessage.includes('network') || lowerMessage.includes('connection')) {
    actions.push('Check your internet connection');
    actions.push('Retry the operation');
  } else if (lowerMessage.includes('memory') || lowerMessage.includes('heap')) {
    actions.push('Close other applications to free memory');
    actions.push('Try processing a smaller file');
  } else if (lowerMessage.includes('timeout')) {
    actions.push('Retry with a shorter input');
    actions.push('Increase the processing timeout');
  } else {
    actions.push('Retry the operation');
    if (severity === 'high' || severity === 'critical') {
      actions.push('Contact support if the issue persists');
    }
  }

  return actions;
}

/**
 * Check if an error message indicates a recoverable error.
 */
function isRecoverableError(message: string): boolean {
  const unrecoverablePatterns = [
    /invalid api key/i,
    /authentication failed/i,
    /permission denied/i,
  ];
  return !unrecoverablePatterns.some((pattern) => pattern.test(message));
}

// ========================================
// Error Grouping & Deduplication
// ========================================

/**
 * Generate a stable fingerprint for an error context.
 * Two error contexts with the same stage, component, and error message
 * produce the same fingerprint, regardless of timestamp or retry count.
 */
