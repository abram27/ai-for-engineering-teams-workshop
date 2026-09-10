/**
 * Data export utilities for the Customer Intelligence Dashboard.
 *
 * Reads from the same data sources each widget already consumes
 * (`mock-customers`, `lib/healthCalculator.ts`) rather than duplicating
 * fetch/calculation logic. Export generation runs in small chunks
 * (via streamExport's async generator) so the UI never blocks and
 * long-running exports can be cancelled through an AbortSignal.
 */

import type { Customer } from '@/data/mock-customers';
import { calculateHealthScore, type HealthScoreInput, type HealthScoreResult } from './healthCalculator';
import { ExportError } from './errors';

export type ExportFormat = 'csv' | 'json';
export type ExportDataType = 'customers' | 'health-report' | 'alerts';

/** Minimal alert shape, defined here until `lib/alerts.ts` exists. */
export interface Alert {
  id: string;
  customerId: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  createdAt: string;
}

export interface ExportDateRange {
  start: string; // ISO date
  end: string; // ISO date
}

export interface ExportFilters {
  dateRange?: ExportDateRange;
  segments?: Array<Customer['subscriptionTier']>;
  fields?: string[];
}

export interface ExportRequest {
  type: ExportDataType;
  format: ExportFormat;
  filters?: ExportFilters;
}

export interface ExportProgress {
  processed: number;
  total: number;
  percentage: number;
}

export interface ExportResult {
  filename: string;
  content: string;
  mimeType: string;
}

const MAX_EXPORT_REQUESTS_PER_MINUTE = 5;
const rateLimitLog: number[] = [];

/** Simple in-memory rate limiter for export requests (per browser session). */
export function checkExportRateLimit(now: number = Date.now()): { allowed: boolean; retryAfterMs?: number } {
  const windowStart = now - 60_000;
  while (rateLimitLog.length > 0 && rateLimitLog[0] < windowStart) {
    rateLimitLog.shift();
  }
  if (rateLimitLog.length >= MAX_EXPORT_REQUESTS_PER_MINUTE) {
    const retryAfterMs = rateLimitLog[0] + 60_000 - now;
    return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 0) };
  }
  rateLimitLog.push(now);
  return { allowed: true };
}

/** Strips characters that could enable CSV/formula injection or break JSON. */
export function sanitizeExportValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str = String(value);
  // Neutralize leading characters that spreadsheet apps treat as formulas.
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }
  return str
    .split('')
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('');
}

function toCsvRow(values: unknown[]): string {
  return values
    .map((value) => {
      const sanitized = sanitizeExportValue(value);
      return /[",\n]/.test(sanitized) ? `"${sanitized.replace(/"/g, '""')}"` : sanitized;
    })
    .join(',');
}

function matchesFilters(customer: Customer, filters?: ExportFilters): boolean {
  if (!filters) return true;
  if (filters.segments && filters.segments.length > 0) {
    if (!filters.segments.includes(customer.subscriptionTier)) return false;
  }
  if (filters.dateRange && customer.createdAt) {
    const created = new Date(customer.createdAt).getTime();
    const start = new Date(filters.dateRange.start).getTime();
    const end = new Date(filters.dateRange.end).getTime();
    if (Number.isFinite(start) && created < start) return false;
    if (Number.isFinite(end) && created > end) return false;
  }
  return true;
}

/** Builds an ISO-timestamped, descriptive filename, e.g. `health-report_2026-09-09T12-00-00.csv`. */
export function buildExportFilename(type: ExportDataType, format: ExportFormat, now: Date = new Date()): string {
  const iso = now.toISOString().replace(/:/g, '-').replace(/\..+$/, '');
  return `${type}_${iso}.${format}`;
}

export interface StreamExportOptions {
  customers: Customer[];
  healthInputs?: Record<string, HealthScoreInput>;
  alerts?: Alert[];
  onProgress?: (progress: ExportProgress) => void;
  signal?: AbortSignal;
}

/**
 * Streams export rows in small batches, yielding to the event loop between
 * batches so the main thread and UI stay responsive. Cancellable via `signal`.
 */
export async function* streamExportRows(
  request: ExportRequest,
  options: StreamExportOptions
): AsyncGenerator<string[], void, void> {
  const filtered = options.customers.filter((customer) => matchesFilters(customer, request.filters));
  const batchSize = 25;

  for (let i = 0; i < filtered.length; i += batchSize) {
    if (options.signal?.aborted) {
      throw new ExportError('Export cancelled by user.', { type: request.type });
    }

    const batch = filtered.slice(i, i + batchSize);
    for (const customer of batch) {
      if (request.type === 'customers') {
        yield [customer.id, customer.name, customer.company, String(customer.healthScore), customer.subscriptionTier ?? ''];
      } else if (request.type === 'health-report') {
        const input = options.healthInputs?.[customer.id];
        let result: HealthScoreResult | null = null;
        try {
          result = input ? calculateHealthScore(input) : null;
        } catch {
          result = null;
        }
        yield [
          customer.id,
          customer.name,
          String(result?.overallScore ?? customer.healthScore),
          result?.riskLevel ?? 'unknown',
          String(result?.breakdown.payment.score ?? ''),
          String(result?.breakdown.engagement.score ?? ''),
          String(result?.breakdown.contract.score ?? ''),
          String(result?.breakdown.support.score ?? ''),
        ];
      } else if (request.type === 'alerts') {
        const customerAlerts = (options.alerts ?? []).filter((alert) => alert.customerId === customer.id);
        for (const alert of customerAlerts) {
          yield [alert.id, customer.name, alert.severity, alert.message, alert.createdAt];
        }
      }
    }

    options.onProgress?.({
      processed: Math.min(i + batchSize, filtered.length),
      total: filtered.length,
      percentage: Math.round((Math.min(i + batchSize, filtered.length) / Math.max(filtered.length, 1)) * 100),
    });

    // Yield to the event loop so the UI thread never blocks on large exports.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

const HEADERS: Record<ExportDataType, string[]> = {
  customers: ['id', 'name', 'company', 'healthScore', 'tier'],
  'health-report': ['id', 'name', 'overallScore', 'riskLevel', 'payment', 'engagement', 'contract', 'support'],
  alerts: ['id', 'customer', 'severity', 'message', 'createdAt'],
};

/** Generates a full export (CSV or JSON), reporting progress and honoring cancellation. */
export async function generateExport(request: ExportRequest, options: StreamExportOptions): Promise<ExportResult> {
  const rateLimit = checkExportRateLimit();
  if (!rateLimit.allowed) {
    throw new ExportError('Too many export requests. Please try again later.', {
      retryAfterMs: rateLimit.retryAfterMs,
    });
  }

  const rows: string[][] = [];
  for await (const row of streamExportRows(request, options)) {
    rows.push(row);
  }

  const filename = buildExportFilename(request.type, request.format);

  if (request.format === 'json') {
    const headers = HEADERS[request.type];
    const records = rows.map((row) =>
      Object.fromEntries(headers.map((header, idx) => [header, row[idx] ?? '']))
    );
    return {
      filename,
      content: JSON.stringify(records, null, 2),
      mimeType: 'application/json',
    };
  }

  const csvLines = [toCsvRow(HEADERS[request.type]), ...rows.map((row) => toCsvRow(row))];
  return {
    filename,
    content: csvLines.join('\n'),
    mimeType: 'text/csv',
  };
}
