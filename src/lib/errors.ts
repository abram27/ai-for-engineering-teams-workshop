/**
 * Shared error types and lightweight client-side logging for the
 * Customer Intelligence Dashboard's production hardening layer.
 *
 * Logged entries never include stack traces or raw customer PII —
 * only category/widget/message/timestamp, safe to surface in the UI
 * or forward to a telemetry endpoint.
 */

export type ErrorCategory =
  | 'widget-render'
  | 'widget-load'
  | 'export'
  | 'rate-limit'
  | 'validation'
  | 'unknown';

export interface ErrorContext {
  category: ErrorCategory;
  widget?: string;
  message: string;
  timestamp: string;
}

export class WidgetLoadError extends Error {
  category: ErrorCategory = 'widget-load';
  widget: string;
  timestamp: string;

  constructor(widget: string, message = 'Widget failed to load.') {
    super(message);
    this.name = 'WidgetLoadError';
    this.widget = widget;
    this.timestamp = new Date().toISOString();
  }
}

export class ExportError extends Error {
  category: ErrorCategory = 'export';
  context?: Record<string, unknown>;
  timestamp: string;

  constructor(message = 'Export failed.', context?: Record<string, unknown>) {
    super(message);
    this.name = 'ExportError';
    this.context = context;
    this.timestamp = new Date().toISOString();
  }
}

export class RateLimitError extends Error {
  category: ErrorCategory = 'rate-limit';
  timestamp: string;

  constructor(message = 'Too many requests. Please try again later.') {
    super(message);
    this.name = 'RateLimitError';
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Records an error entry for logging/telemetry purposes without leaking
 * stack traces or internal identifiers. Safe to call from client code.
 */
export function logError(entry: ErrorContext): void {
  // In production this would forward to a telemetry/log endpoint.
  // Intentionally logs only the sanitized, user-safe fields.
  console.error('[dashboard-error]', {
    category: entry.category,
    widget: entry.widget,
    message: entry.message,
    timestamp: entry.timestamp,
  });
}

/** User-facing message that never leaks stack traces or internal details. */
export function toUserMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof WidgetLoadError || error instanceof ExportError || error instanceof RateLimitError) {
    return error.message;
  }
  return fallback;
}
