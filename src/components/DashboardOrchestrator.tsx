'use client';

import {
  Suspense,
  lazy,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import type { Customer } from '@/data/mock-customers';
import { mockCustomers } from '@/data/mock-customers';
import { calculateHealthScore, type HealthScoreInput } from '@/lib/healthCalculator';
import type { AlertEngineInput, AlertHistoryEntry } from '@/lib/alerts';
import CustomerSelector from './CustomerSelector';
import DashboardErrorBoundary from './DashboardErrorBoundary';
import WidgetErrorBoundary from './WidgetErrorBoundary';
import {
  generateExport,
  type Alert as ExportAlert,
  type ExportDataType,
  type ExportFilters,
  type ExportFormat,
  type ExportProgress,
} from '@/lib/exportUtils';
import { ExportError, RateLimitError, toUserMessage } from '@/lib/errors';

// Code-split: the initial bundle only includes this shell + CustomerSelector.
// CustomerHealthDisplay, CustomerAlerts, and MarketIntelligenceWidget are
// loaded on demand, each in its own chunk, via React.lazy + Suspense.
const CustomerHealthDisplay = lazy(() => import('./CustomerHealthDisplay'));
const CustomerAlerts = lazy(() => import('./CustomerAlerts'));
const MarketIntelligenceWidget = lazy(() => import('./MarketIntelligenceWidget'));

export interface DashboardOrchestratorProps {
  customers?: Customer[];
  /** Health score inputs keyed by customer id, consumed by CustomerHealthDisplay and health exports. */
  healthInputsByCustomerId?: Record<string, HealthScoreInput>;
  /**
   * Alert engine inputs keyed by customer id (payment/engagement/contract trend
   * signals), consumed by CustomerAlerts. `currentHealth` is derived here from
   * `healthInputsByCustomerId` via `lib/healthCalculator.ts` so callers don't
   * have to duplicate that calculation.
   */
  alertInputsByCustomerId?: Record<string, Omit<AlertEngineInput, 'currentHealth' | 'customerId'>>;
  /** Alert history/audit log, consumed by the alerts export. */
  alerts?: ExportAlert[];
}

function WidgetSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading widget"
      className="w-full animate-pulse rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-sm sm:p-5"
    >
      <div className="h-4 w-24 rounded bg-gray-200" />
      <div className="mt-3 h-3 w-32 rounded bg-gray-200" />
    </div>
  );
}

function WidgetComingSoon({ label }: { label: string }) {
  return (
    <div className="flex w-full items-center justify-center rounded-lg border border-dashed border-gray-300 p-8 text-center">
      <p className="text-sm text-gray-500">{label} is not yet available.</p>
    </div>
  );
}

interface WidgetRegionCallbacks {
  onWidgetError?: (widgetName: string, message: string) => void;
  onWidgetRetry?: (widgetName: string) => void;
}

const HealthWidgetRegion = memo(function HealthWidgetRegion({
  customer,
  healthData,
  onWidgetError,
  onWidgetRetry,
}: {
  customer: Customer | null;
  healthData: HealthScoreInput | null;
} & WidgetRegionCallbacks) {
  return (
    <WidgetErrorBoundary
      widget={{ name: 'Customer Health', ariaLabel: 'Customer health score' }}
      onWidgetError={onWidgetError}
      onWidgetRetry={onWidgetRetry}
    >
      <Suspense fallback={<WidgetSkeleton />}>
        {customer ? (
          <CustomerHealthDisplay healthData={healthData} />
        ) : (
          <WidgetComingSoon label="Select a customer to view health" />
        )}
      </Suspense>
    </WidgetErrorBoundary>
  );
});

const AlertsWidgetRegion = memo(function AlertsWidgetRegion({
  customer,
  alertData,
  history,
  onHistoryChange,
  onWidgetError,
  onWidgetRetry,
}: {
  customer: Customer | null;
  alertData: AlertEngineInput | null;
  history: AlertHistoryEntry[];
  onHistoryChange: (history: AlertHistoryEntry[]) => void;
} & WidgetRegionCallbacks) {
  return (
    <WidgetErrorBoundary
      widget={{ name: 'Customer Alerts', ariaLabel: 'Customer alerts' }}
      onWidgetError={onWidgetError}
      onWidgetRetry={onWidgetRetry}
    >
      <Suspense fallback={<WidgetSkeleton />}>
        {customer ? (
          <CustomerAlerts alertData={alertData} history={history} onHistoryChange={onHistoryChange} />
        ) : (
          <WidgetComingSoon label="Select a customer to view alerts" />
        )}
      </Suspense>
    </WidgetErrorBoundary>
  );
});

const MarketWidgetRegion = memo(function MarketWidgetRegion({
  customer,
  onWidgetError,
  onWidgetRetry,
}: {
  customer: Customer | null;
} & WidgetRegionCallbacks) {
  return (
    <WidgetErrorBoundary
      widget={{ name: 'Market Intelligence', ariaLabel: 'Market intelligence' }}
      onWidgetError={onWidgetError}
      onWidgetRetry={onWidgetRetry}
    >
      <Suspense fallback={<WidgetSkeleton />}>
        {customer ? (
          <MarketIntelligenceWidget company={customer.company} />
        ) : (
          <WidgetComingSoon label="Select a customer to view market intelligence" />
        )}
      </Suspense>
    </WidgetErrorBoundary>
  );
});

interface ExportPanelProps {
  isOpen: boolean;
  isExporting: boolean;
  progress: ExportProgress | null;
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: (type: ExportDataType, format: ExportFormat, filters: ExportFilters) => void;
  onCancel: () => void;
}

const ExportPanel = memo(function ExportPanel({
  isOpen,
  isExporting,
  progress,
  errorMessage,
  onClose,
  onSubmit,
  onCancel,
}: ExportPanelProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [type, setType] = useState<ExportDataType>('customers');
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.focus();
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, input, select, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg focus:outline-none"
      >
        <h2 id="export-dialog-title" className="text-lg font-semibold text-gray-900">
          Export data
        </h2>

        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-gray-700">Data type</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as ExportDataType)}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="customers">Customer data</option>
              <option value="health-report">Health report</option>
              <option value="alerts">Alert history</option>
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-gray-700">Format</span>
            <select
              value={format}
              onChange={(event) => setFormat(event.target.value as ExportFormat)}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </label>

          <div className="flex gap-2">
            <label className="block text-sm flex-1">
              <span className="text-gray-700">From</span>
              <input
                type="date"
                value={start}
                onChange={(event) => setStart(event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block text-sm flex-1">
              <span className="text-gray-700">To</span>
              <input
                type="date"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
          </div>
        </div>

        {errorMessage && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        {isExporting && progress && (
          <div className="mt-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-gray-600">
              {progress.processed} / {progress.total} ({progress.percentage}%)
            </p>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={isExporting ? onCancel : onClose}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {isExporting ? 'Cancel' : 'Close'}
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={() =>
              onSubmit(type, format, {
                dateRange: start && end ? { start, end } : undefined,
              })
            }
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isExporting ? 'Exporting…' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
});

export default function DashboardOrchestrator({
  customers = mockCustomers,
  healthInputsByCustomerId = {},
  alertInputsByCustomerId = {},
  alerts = [],
}: DashboardOrchestratorProps) {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [liveMessage, setLiveMessage] = useState('');
  const [isExportOpen, setExportOpen] = useState(false);
  const [isExporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportErrorMessage, setExportErrorMessage] = useState<string | null>(null);
  const [alertHistoryByCustomerId, setAlertHistoryByCustomerId] = useState<
    Record<string, AlertHistoryEntry[]>
  >({});
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      // Ensure any in-flight export is aborted on unmount to avoid leaks.
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleSelectCustomer = useCallback((customer: Customer) => {
    setSelectedCustomer(customer);
  }, []);

  const handleWidgetError = useCallback((widgetName: string, message: string) => {
    setLiveMessage(`${widgetName} failed: ${message}`);
  }, []);

  const handleWidgetRetry = useCallback((widgetName: string) => {
    setLiveMessage(`Retrying ${widgetName}…`);
  }, []);

  const selectedHealthData = useMemo(
    () => (selectedCustomer ? healthInputsByCustomerId[selectedCustomer.id] ?? null : null),
    [selectedCustomer, healthInputsByCustomerId]
  );

  const selectedAlertData = useMemo<AlertEngineInput | null>(() => {
    if (!selectedCustomer) return null;
    const trendInput = alertInputsByCustomerId[selectedCustomer.id];
    if (!trendInput || !selectedHealthData) return null;
    try {
      return {
        ...trendInput,
        customerId: selectedCustomer.id,
        currentHealth: calculateHealthScore(selectedHealthData),
      };
    } catch {
      return null;
    }
  }, [selectedCustomer, selectedHealthData, alertInputsByCustomerId]);

  const selectedAlertHistory = useMemo(
    () => (selectedCustomer ? alertHistoryByCustomerId[selectedCustomer.id] ?? [] : []),
    [selectedCustomer, alertHistoryByCustomerId]
  );

  const handleAlertHistoryChange = useCallback(
    (history: AlertHistoryEntry[]) => {
      if (!selectedCustomer) return;
      setAlertHistoryByCustomerId((prev) => ({ ...prev, [selectedCustomer.id]: history }));
    },
    [selectedCustomer]
  );

  const handleExportSubmit = useCallback(
    async (type: ExportDataType, format: ExportFormat, filters: ExportFilters) => {
      setExportErrorMessage(null);
      setExporting(true);
      setExportProgress({ processed: 0, total: customers.length, percentage: 0 });
      setLiveMessage('Export started.');

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const result = await generateExport(
          { type, format, filters },
          {
            customers,
            healthInputs: healthInputsByCustomerId,
            alerts,
            signal: controller.signal,
            onProgress: (progress) => {
              setExportProgress(progress);
              setLiveMessage(`Export progress: ${progress.percentage}%`);
            },
          }
        );

        const blob = new Blob([result.content], { type: result.mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = result.filename;
        link.click();
        URL.revokeObjectURL(url);

        setLiveMessage(`Export complete: ${result.filename}`);
        setExportOpen(false);
      } catch (error) {
        const message =
          error instanceof RateLimitError
            ? 'Too many export requests. Please try again later.'
            : toUserMessage(error, 'Export failed. Please try again.');
        setExportErrorMessage(message);
        setLiveMessage(message);
        if (!(error instanceof ExportError)) {
          // Unexpected error shape; still avoid leaking internals to the UI.
        }
      } finally {
        setExporting(false);
        abortControllerRef.current = null;
      }
    },
    [customers, healthInputsByCustomerId, alerts]
  );

  const handleExportCancel = useCallback(() => {
    abortControllerRef.current?.abort();
    setLiveMessage('Export cancelled.');
  }, []);

  return (
    <DashboardErrorBoundary>
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-blue-600 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to main content
      </a>

      <div className="min-h-screen w-full bg-gray-50">
        <header className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Customer Intelligence Dashboard</h1>
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Export data
            </button>
          </div>
        </header>

        <div aria-live="polite" className="sr-only">
          {liveMessage}
        </div>

        <nav aria-label="Customer selector" className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
          <CustomerSelector
            customers={customers}
            selectedCustomerId={selectedCustomer?.id}
            onSelectCustomer={handleSelectCustomer}
          />
        </nav>

        <main id="dashboard-main" className="px-4 py-6 sm:px-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <HealthWidgetRegion
              customer={selectedCustomer}
              healthData={selectedHealthData}
              onWidgetError={handleWidgetError}
              onWidgetRetry={handleWidgetRetry}
            />
            <AlertsWidgetRegion
              customer={selectedCustomer}
              alertData={selectedAlertData}
              history={selectedAlertHistory}
              onHistoryChange={handleAlertHistoryChange}
              onWidgetError={handleWidgetError}
              onWidgetRetry={handleWidgetRetry}
            />
            <MarketWidgetRegion
              customer={selectedCustomer}
              onWidgetError={handleWidgetError}
              onWidgetRetry={handleWidgetRetry}
            />
          </div>
        </main>
      </div>

      <ExportPanel
        isOpen={isExportOpen}
        isExporting={isExporting}
        progress={exportProgress}
        errorMessage={exportErrorMessage}
        onClose={() => setExportOpen(false)}
        onSubmit={handleExportSubmit}
        onCancel={handleExportCancel}
      />
    </DashboardErrorBoundary>
  );
}
