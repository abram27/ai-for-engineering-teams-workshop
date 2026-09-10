'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  MarketIntelligenceError,
  getMarketIntelligence,
  type MarketIntelligenceData,
} from '@/lib/marketIntelligenceService';

export interface MarketIntelligenceWidgetProps {
  company: string;
}

type SentimentLabel = 'positive' | 'neutral' | 'negative';

function getSentimentColorClasses(label: SentimentLabel): string {
  if (label === 'positive') {
    return 'bg-green-100 text-green-800 border-green-300';
  }
  if (label === 'negative') {
    return 'bg-red-100 text-red-800 border-red-300';
  }
  return 'bg-yellow-100 text-yellow-800 border-yellow-300';
}

const SENTIMENT_LABELS: Record<SentimentLabel, string> = {
  positive: 'Positive',
  neutral: 'Neutral',
  negative: 'Negative',
};

/** Strips characters that could enable markup injection when rendering mock strings. */
function sanitizeText(value: string): string {
  return value.replace(/[<>]/g, '');
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function LoadingState() {
  return (
    <div
      role="status"
      aria-label="Loading market intelligence"
      className="w-full animate-pulse rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-sm sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="h-4 w-32 rounded bg-gray-200" />
        <div className="h-6 w-16 rounded-full bg-gray-200" />
      </div>
      <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
        <div className="h-3 w-full rounded bg-gray-200" />
        <div className="h-3 w-5/6 rounded bg-gray-200" />
        <div className="h-3 w-2/3 rounded bg-gray-200" />
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="w-full rounded-lg border border-gray-300 bg-gray-100 p-4 text-gray-700 shadow-sm sm:p-5">
      <p className="text-sm font-medium">Market intelligence unavailable</p>
      <p className="mt-1 text-sm">{message}</p>
    </div>
  );
}

function isValidCompanyInput(value: string): boolean {
  return value.trim().length > 0;
}

export default function MarketIntelligenceWidget({ company }: MarketIntelligenceWidgetProps) {
  const [inputValue, setInputValue] = useState(company);
  const [activeCompany, setActiveCompany] = useState(company);
  const [inputError, setInputError] = useState<string | null>(null);

  const [data, setData] = useState<MarketIntelligenceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Keep the widget in sync with the currently selected customer.
  useEffect(() => {
    setInputValue(company);
    setActiveCompany(company);
    setInputError(null);
  }, [company]);

  useEffect(() => {
    let cancelled = false;

    if (!isValidCompanyInput(activeCompany)) {
      setData(null);
      setFetchError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setFetchError(null);

    getMarketIntelligence(activeCompany)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setIsLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof MarketIntelligenceError
            ? error.message
            : 'Unable to load market intelligence right now.';
        setFetchError(message);
        setData(null);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeCompany]);

  const topHeadlines = useMemo(() => data?.headlines.slice(0, 3) ?? [], [data]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidCompanyInput(inputValue)) {
      setInputError('Company name is required.');
      return;
    }
    setInputError(null);
    setActiveCompany(inputValue.trim());
  }

  return (
    <div className="w-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-gray-900 sm:text-lg">Market Intelligence</h3>
        <form onSubmit={handleSubmit} className="mt-2 flex gap-2">
          <label htmlFor="market-intelligence-company" className="sr-only">
            Company name
          </label>
          <input
            id="market-intelligence-company"
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="Enter company name..."
            className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Search
          </button>
        </form>
        {inputError && <p className="mt-1 text-xs text-red-700">{inputError}</p>}
      </div>

      {isLoading && <LoadingState />}

      {!isLoading && fetchError && <ErrorState message={fetchError} />}

      {!isLoading && !fetchError && data && (
        <div className="rounded-lg border border-gray-100 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm text-gray-700">{sanitizeText(data.company)}</p>
              <p className="text-xs text-gray-500">
                {data.articleCount} article{data.articleCount === 1 ? '' : 's'} &middot; Updated{' '}
                {formatDate(data.lastUpdated)}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${getSentimentColorClasses(
                data.sentiment.label
              )}`}
            >
              {SENTIMENT_LABELS[data.sentiment.label]}
            </span>
          </div>

          <div className="mt-3 border-t border-gray-200 pt-3">
            {topHeadlines.length > 0 ? (
              <ul className="space-y-2">
                {topHeadlines.map((headline, index) => (
                  <li key={`${headline.title}-${index}`} className="text-sm">
                    <p className="font-medium text-gray-900">{sanitizeText(headline.title)}</p>
                    <p className="text-xs text-gray-500">
                      {sanitizeText(headline.source)} &middot; {formatDate(headline.publishedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-600">No recent headlines available.</p>
            )}
          </div>
        </div>
      )}

      {!isLoading && !fetchError && !data && (
        <p className="text-sm text-gray-500">Enter a company name to view market intelligence.</p>
      )}
    </div>
  );
}
