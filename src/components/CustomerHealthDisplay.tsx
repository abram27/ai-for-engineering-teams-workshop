'use client';

import { useMemo, useState } from 'react';
import {
  calculateHealthScore,
  type HealthScoreInput,
  type HealthScoreResult,
  type RiskLevel,
} from '@/lib/healthCalculator';

export interface CustomerHealthDisplayProps {
  customerId?: string;
  healthData: HealthScoreInput | null | undefined;
  isLoading?: boolean;
  error?: string | null;
}

const RISK_LABELS: Record<RiskLevel, string> = {
  healthy: 'Healthy',
  warning: 'Warning',
  critical: 'Critical',
};

function getHealthColorClasses(score: number): string {
  if (score <= 30) {
    return 'bg-red-100 text-red-800 border-red-300';
  }
  if (score <= 70) {
    return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  }
  return 'bg-green-100 text-green-800 border-green-300';
}

const FACTOR_LABELS: Record<keyof HealthScoreResult['breakdown'], string> = {
  payment: 'Payment',
  engagement: 'Engagement',
  contract: 'Contract',
  support: 'Support',
};

function LoadingState() {
  return (
    <div
      role="status"
      aria-label="Loading health score"
      className="w-full animate-pulse rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-sm sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="h-4 w-24 rounded bg-gray-200" />
        <div className="h-6 w-12 rounded-full bg-gray-200" />
      </div>
      <div className="mt-3 border-t border-gray-200 pt-3">
        <div className="h-3 w-32 rounded bg-gray-200" />
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="w-full rounded-lg border border-gray-300 bg-gray-100 p-4 text-gray-700 shadow-sm sm:p-5">
      <p className="text-sm font-medium">Health score unavailable</p>
      <p className="mt-1 text-sm">{message}</p>
    </div>
  );
}

export default function CustomerHealthDisplay({
  healthData,
  isLoading = false,
  error = null,
}: CustomerHealthDisplayProps) {
  const [expanded, setExpanded] = useState(false);

  const result = useMemo<{ value: HealthScoreResult | null; error: string | null }>(() => {
    if (!healthData) {
      return { value: null, error: null };
    }
    try {
      return { value: calculateHealthScore(healthData), error: null };
    } catch {
      return { value: null, error: 'Health score data is invalid.' };
    }
  }, [healthData]);

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!healthData || !result.value) {
    return <ErrorState message={result.error ?? 'No health score data available for this customer.'} />;
  }

  const { overallScore, riskLevel, breakdown } = result.value;
  const colorClasses = getHealthColorClasses(overallScore);

  return (
    <div className={`w-full rounded-lg border p-4 shadow-sm sm:p-5 ${colorClasses}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-gray-900 sm:text-lg">
            Customer Health
          </h3>
          <p className="truncate text-sm text-gray-700">{RISK_LABELS[riskLevel]}</p>
        </div>

        <span className="shrink-0 rounded-full border border-current px-2.5 py-1 text-xs font-medium">
          {overallScore}
        </span>
      </div>

      <div className="mt-3 border-t border-current/20 pt-3">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          className="text-xs font-medium uppercase tracking-wide text-gray-600 hover:text-gray-800"
        >
          {expanded ? 'Hide breakdown' : 'Show breakdown'}
        </button>

        {expanded && (
          <ul className="mt-2 space-y-1">
            {(Object.keys(breakdown) as Array<keyof HealthScoreResult['breakdown']>).map(
              (factor) => (
                <li
                  key={factor}
                  className="flex items-center justify-between text-sm text-gray-800"
                >
                  <span>{FACTOR_LABELS[factor]}</span>
                  <span className="font-medium">{breakdown[factor].score}</span>
                </li>
              )
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
