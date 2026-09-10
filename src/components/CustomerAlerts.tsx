'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  alertEngine,
  dismissAlert,
  recordAlerts,
  resolveMarketSentimentSnapshot,
  type Alert,
  type AlertEngineInput,
  type AlertHistoryEntry,
  type AlertPriority,
  type MarketSentimentSnapshot,
} from '@/lib/alerts';

export interface CustomerAlertsProps {
  customerId?: string;
  /** Alert engine input derived from the same customer's health score + trend data. */
  alertData: AlertEngineInput | null | undefined;
  /** Prior alert history/audit trail for this customer (used for dedup, cooldown, and the historical view). */
  history?: AlertHistoryEntry[];
  /** Called whenever new alerts are triggered and appended to the audit trail. */
  onHistoryChange?: (history: AlertHistoryEntry[]) => void;
  isLoading?: boolean;
  error?: string | null;
}

const PRIORITY_LABELS: Record<AlertPriority, string> = {
  high: 'High Priority',
  medium: 'Medium Priority',
};

function getPriorityColorClasses(priority: AlertPriority): string {
  return priority === 'high'
    ? 'bg-red-100 text-red-800 border-red-300'
    : 'bg-yellow-100 text-yellow-800 border-yellow-300';
}

type SentimentLabel = MarketSentimentSnapshot['sentiment']['label'];

const SENTIMENT_LABELS: Record<SentimentLabel, string> = {
  positive: 'Positive',
  neutral: 'Neutral',
  negative: 'Negative',
};

/** Reuses `MarketIntelligenceWidget`'s green/yellow/red sentiment color-coding convention. */
function getSentimentColorClasses(label: SentimentLabel): string {
  if (label === 'positive') {
    return 'bg-green-100 text-green-800 border-green-300';
  }
  if (label === 'negative') {
    return 'bg-red-100 text-red-800 border-red-300';
  }
  return 'bg-yellow-100 text-yellow-800 border-yellow-300';
}

/** Strips characters that could enable markup injection when rendering market headline text. */
function sanitizeText(value: string): string {
  return value.replace(/[<>]/g, '');
}

function formatHeadlineDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Small sentiment badge shown on alerts enriched with market context. */
function MarketContextBadge({ sentiment }: { sentiment: MarketSentimentSnapshot['sentiment'] }) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${getSentimentColorClasses(
        sentiment.label
      )}`}
    >
      Market: {SENTIMENT_LABELS[sentiment.label]}
    </span>
  );
}

/** Headlines section shown in the alert detail panel, below recommended-action content. */
function MarketContextSection({ marketContext }: { marketContext: MarketSentimentSnapshot | null | undefined }) {
  if (!marketContext) {
    return (
      <p className="mt-3 border-t border-gray-200 pt-3 text-xs text-gray-500">
        Market context unavailable.
      </p>
    );
  }

  return (
    <div className="mt-3 border-t border-gray-200 pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-600">Market Context</p>
        <MarketContextBadge sentiment={marketContext.sentiment} />
      </div>
      {marketContext.headlines.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {marketContext.headlines.slice(0, 3).map((headline, index) => (
            <li key={`${headline.title}-${index}`} className="text-sm">
              <p className="font-medium text-gray-900">{sanitizeText(headline.title)}</p>
              <p className="text-xs text-gray-500">
                {sanitizeText(headline.source)} &middot; {formatHeadlineDate(headline.publishedAt)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-gray-600">No recent headlines available.</p>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div
      role="status"
      aria-label="Loading alerts"
      className="w-full animate-pulse rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-sm sm:p-5"
    >
      <div className="h-4 w-24 rounded bg-gray-200" />
      <div className="mt-3 space-y-2">
        <div className="h-10 rounded bg-gray-200" />
        <div className="h-10 rounded bg-gray-200" />
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="w-full rounded-lg border border-gray-300 bg-gray-100 p-4 text-gray-700 shadow-sm sm:p-5">
      <p className="text-sm font-medium">Alerts unavailable</p>
      <p className="mt-1 text-sm">{message}</p>
    </div>
  );
}

export default function CustomerAlerts({
  alertData,
  history = [],
  onHistoryChange,
  isLoading = false,
  error = null,
}: CustomerAlertsProps) {
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [localHistory, setLocalHistory] = useState<AlertHistoryEntry[]>(history);
  const [marketSnapshot, setMarketSnapshot] = useState<MarketSentimentSnapshot | null>(null);

  const company = alertData?.company;

  // Market context enrichment is best-effort and asynchronous relative to
  // core rule evaluation: the base alerts render immediately below using
  // `alertData` alone, and this fetch (bounded by the service's own timeout)
  // only adds `marketSnapshot` afterward — a slow/failed lookup never blocks
  // or breaks alert generation for the other rule types. The service layer's
  // existing 10-minute TTL cache avoids redundant refetches for the same
  // company within that window.
  useEffect(() => {
    let cancelled = false;
    setMarketSnapshot(null);

    if (!company) {
      return;
    }

    resolveMarketSentimentSnapshot(company).then((snapshot) => {
      if (!cancelled) {
        setMarketSnapshot(snapshot);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [company]);

  const evaluation = useMemo<{ alerts: Alert[]; error: string | null }>(() => {
    if (!alertData) {
      return { alerts: [], error: null };
    }
    try {
      return {
        alerts: alertEngine({ ...alertData, marketSnapshot }, { history: localHistory }),
        error: null,
      };
    } catch {
      return { alerts: [], error: 'Alert data is invalid.' };
    }
  }, [alertData, localHistory, marketSnapshot]);

  const effectiveHistory = useMemo(() => {
    if (evaluation.alerts.length === 0) return localHistory;
    return recordAlerts(localHistory, evaluation.alerts);
  }, [evaluation.alerts, localHistory]);

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!alertData) {
    return <ErrorState message="No alert data available for this customer." />;
  }

  if (evaluation.error) {
    return <ErrorState message={evaluation.error} />;
  }

  const activeAlerts = effectiveHistory.filter((entry) => !entry.dismissed);
  const dismissedAlerts = effectiveHistory.filter((entry) => entry.dismissed);
  const selectedAlert = activeAlerts.find((a) => a.id === selectedAlertId) ?? null;

  const handleDismiss = (alertId: string, actionTaken?: string) => {
    const updated = dismissAlert(effectiveHistory, alertId, actionTaken);
    setLocalHistory(updated);
    onHistoryChange?.(updated);
    if (selectedAlertId === alertId) {
      setSelectedAlertId(null);
    }
  };

  return (
    <div className="w-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="truncate text-base font-semibold text-gray-900 sm:text-lg">
          Predictive Alerts
        </h3>
        <button
          type="button"
          onClick={() => setShowHistory((prev) => !prev)}
          className="shrink-0 text-xs font-medium uppercase tracking-wide text-gray-600 hover:text-gray-800"
        >
          {showHistory ? 'Hide history' : 'History'}
        </button>
      </div>

      {activeAlerts.length === 0 && !showHistory && (
        <p className="mt-3 text-sm text-gray-600">No active alerts for this customer.</p>
      )}

      {activeAlerts.length > 0 && (
        <ul className="mt-3 space-y-2">
          {activeAlerts.map((alert) => (
            <li key={alert.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setSelectedAlertId((prev) => (prev === alert.id ? null : alert.id))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedAlertId((prev) => (prev === alert.id ? null : alert.id));
                  }
                }}
                className={`w-full cursor-pointer rounded-md border p-3 text-left ${getPriorityColorClasses(
                  alert.priority
                )}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{alert.title}</span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {alert.marketContext && <MarketContextBadge sentiment={alert.marketContext.sentiment} />}
                    <span className="rounded-full border border-current px-2 py-0.5 text-[10px] font-medium uppercase">
                      {PRIORITY_LABELS[alert.priority]}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-sm">{alert.message}</p>
              </div>

              {selectedAlert?.id === alert.id && (
                <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-600">
                    Recommended Action
                  </p>
                  <p className="mt-1 text-sm text-gray-800">{alert.recommendedAction}</p>
                  {alert.marketContext && <MarketContextSection marketContext={alert.marketContext} />}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleDismiss(alert.id, 'Action taken')}
                      className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                    >
                      Mark as actioned
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDismiss(alert.id)}
                      className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {showHistory && (
        <div className="mt-4 border-t border-gray-200 pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-600">
            Historical Alerts
          </p>
          {dismissedAlerts.length === 0 ? (
            <p className="mt-2 text-sm text-gray-600">No historical alerts yet.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {dismissedAlerts.map((entry) => (
                <li key={`${entry.id}-${entry.dismissedAt}`} className="text-sm text-gray-700">
                  <span className="font-medium">{entry.title}</span>
                  {entry.actionTaken ? ` — ${entry.actionTaken}` : ' — dismissed'}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
