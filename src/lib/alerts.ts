/**
 * Predictive alerts engine for the Customer Intelligence Dashboard.
 * Consumes `HealthScoreResult` output from `lib/healthCalculator.ts` plus
 * supplementary trend/context data to evaluate a rule-based, multi-tier
 * alert system (High Priority / Medium Priority) with deduplication,
 * cooldown, prioritization, and audit-trail support.
 */

import type { HealthScoreResult } from './healthCalculator';
import {
  MarketIntelligenceError,
  getMarketIntelligence,
  type MarketIntelligenceData,
} from './marketIntelligenceService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertPriority = 'high' | 'medium';

export type AlertType =
  | 'payment-risk'
  | 'engagement-cliff'
  | 'contract-expiration-risk'
  | 'support-ticket-spike'
  | 'feature-adoption-stall'
  | 'market-sentiment-risk';

/**
 * A point-in-time snapshot of external market sentiment for a customer's
 * company, sourced from `lib/marketIntelligenceService.ts`. Shared between
 * the alert engine and `CustomerAlerts` so both agree on the enrichment
 * contract.
 */
export interface MarketSentimentSnapshot {
  company: string;
  sentiment: {
    score: number;
    label: 'positive' | 'neutral' | 'negative';
    confidence: number;
  };
  headlines: {
    title: string;
    source: string;
    publishedAt: string;
  }[];
  /** ISO 8601 timestamp for when this snapshot was fetched (service-level, TTL-cached). */
  fetchedAt: string;
}

/** A single point-in-time capture of a customer's health score, used to detect trends. */
export interface HealthScoreSnapshot {
  score: HealthScoreResult;
  /** ISO 8601 timestamp for when this snapshot was captured. */
  timestamp: string;
}

export interface PaymentAlertInput {
  /** Number of days the current balance has been overdue (0 if current). */
  daysOverdue: number;
}

export interface EngagementAlertInput {
  /** Average logins/day over the trailing 7 days. */
  last7DayLoginFrequency: number;
  /** Average logins/day over the trailing 30 days (rolling baseline). */
  last30DayAverageLoginFrequency: number;
  /** Number of distinct new features used in the last 30 days. */
  newFeatureUsageInLast30Days: number;
  /** Whether this account is classified as a "growing" account (relevant to adoption-stall rule). */
  isGrowingAccount: boolean;
  /** Support tickets opened in the trailing 7 days. */
  ticketsInLast7Days: number;
  /** Whether any open/recent ticket has been escalated. */
  hasEscalatedTicket: boolean;
}

export interface ContractAlertInput {
  /** Days until the current contract expires/renews (negative if past due). */
  daysUntilExpiration: number;
}

/**
 * All inputs required for a single alert-engine evaluation pass for one customer.
 * `currentHealth` and `priorHealthSnapshots` come from `lib/healthCalculator.ts`.
 */
export interface AlertEngineInput {
  customerId: string;
  currentHealth: HealthScoreResult;
  /** Historical snapshots used for score-delta based rules (e.g. score drop over 7 days). */
  priorHealthSnapshots?: HealthScoreSnapshot[];
  payment: PaymentAlertInput;
  engagement: EngagementAlertInput;
  contract: ContractAlertInput;
  /** Annual recurring revenue, used for prioritization/workload balancing. Never rendered verbatim in alert text. */
  arr: number;
  /** Evaluation timestamp (ISO 8601). Defaults to `new Date().toISOString()`. Overridable for testing. */
  now?: string;
  /**
   * Company name used to resolve external market sentiment (sourced from
   * `Customer.company`). Optional — when absent, the market-sentiment rule
   * and market context enrichment are simply skipped.
   */
  company?: string;
  /**
   * Pre-resolved market sentiment snapshot for `company`, typically fetched
   * asynchronously by the caller (e.g. `CustomerAlerts`) via
   * `resolveMarketSentimentSnapshot` ahead of calling `alertEngine`. Null
   * when unavailable, unresolved, or the fetch failed — evaluation degrades
   * gracefully rather than throwing.
   */
  marketSnapshot?: MarketSentimentSnapshot | null;
}

export interface Alert {
  /** Deterministic id: `${customerId}:${type}` — used for dedup/cooldown lookups. */
  id: string;
  customerId: string;
  type: AlertType;
  priority: AlertPriority;
  title: string;
  /** Non-sensitive, human readable description of the risk signal. */
  message: string;
  recommendedAction: string;
  triggeredAt: string;
  /** ARR at time of trigger, used only for internal prioritization (not for display copy). */
  arr: number;
  /**
   * External market sentiment context attached when the customer's company
   * has fetchable market data, capped to up to 3 headlines. Null/absent
   * when no market signal is available for this alert.
   */
  marketContext?: MarketSentimentSnapshot | null;
}

export interface AlertHistoryEntry extends Alert {
  dismissed?: boolean;
  dismissedAt?: string;
  actionTaken?: string;
}

export interface AlertEngineOptions {
  /** Prior alert history/audit trail, used for dedup + cooldown. */
  history?: AlertHistoryEntry[];
  /** Cooldown window in milliseconds before a resolved/dismissed alert type can re-trigger. Default 24h. */
  cooldownMs?: number;
  /** Minimum sentiment confidence (0-1) required to trigger the market-sentiment-risk rule. Default 0.6. */
  marketSentimentConfidenceThreshold?: number;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Throws a descriptive, non-sensitive error if required structural inputs are missing. */
function validateInput(input: AlertEngineInput): void {
  if (!input || typeof input !== 'object') {
    throw new Error('Alert engine input is required');
  }
  if (!input.customerId || typeof input.customerId !== 'string') {
    throw new Error('Alert engine input requires a valid customerId');
  }
  if (!input.currentHealth || typeof input.currentHealth.overallScore !== 'number') {
    throw new Error('Alert engine input requires a valid currentHealth score result');
  }
  if (!input.payment || !input.engagement || !input.contract) {
    throw new Error('Alert engine input requires payment, engagement, and contract data');
  }
  if (!isFiniteNumber(input.arr) || input.arr < 0) {
    throw new Error('Alert engine input requires a valid non-negative arr value');
  }
}

// ---------------------------------------------------------------------------
// Trend helpers
// ---------------------------------------------------------------------------

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MARKET_SENTIMENT_CONFIDENCE_THRESHOLD = 0.6;
const MAX_MARKET_CONTEXT_HEADLINES = 3;

/** Finds the health snapshot closest to `now - 7 days` and returns the score delta (current - prior). */
function getSevenDayScoreDelta(
  currentScore: number,
  snapshots: HealthScoreSnapshot[] | undefined,
  now: number
): number | null {
  if (!snapshots || snapshots.length === 0) return null;

  const target = now - SEVEN_DAYS_MS;
  let closest: HealthScoreSnapshot | null = null;
  let closestDiff = Infinity;

  for (const snap of snapshots) {
    const t = Date.parse(snap.timestamp);
    if (Number.isNaN(t)) continue;
    const diff = Math.abs(t - target);
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = snap;
    }
  }

  if (!closest || typeof closest.score?.overallScore !== 'number') return null;
  return currentScore - closest.score.overallScore;
}

// ---------------------------------------------------------------------------
// Rule functions (pure)
// ---------------------------------------------------------------------------

function ruleHighPaymentRisk(input: AlertEngineInput, now: number): Alert | null {
  const overdue = isFiniteNumber(input.payment.daysOverdue) ? input.payment.daysOverdue : 0;
  const delta = getSevenDayScoreDelta(input.currentHealth.overallScore, input.priorHealthSnapshots, now);
  const scoreDropped = delta !== null && delta <= -20;

  if (overdue > 30 || scoreDropped) {
    return buildAlert(input, now, {
      type: 'payment-risk',
      priority: 'high',
      title: 'Payment Risk',
      message: overdue > 30
        ? 'Payment is significantly overdue.'
        : 'Health score dropped sharply over the last 7 days.',
      recommendedAction: 'Reach out to confirm payment status and address any billing blockers.',
    });
  }
  return null;
}

function ruleEngagementCliff(input: AlertEngineInput, now: number): Alert | null {
  const { last7DayLoginFrequency, last30DayAverageLoginFrequency } = input.engagement;
  if (!isFiniteNumber(last7DayLoginFrequency) || !isFiniteNumber(last30DayAverageLoginFrequency)) {
    return null;
  }
  if (last30DayAverageLoginFrequency <= 0) return null;

  const dropRatio = 1 - last7DayLoginFrequency / last30DayAverageLoginFrequency;
  if (dropRatio > 0.5) {
    return buildAlert(input, now, {
      type: 'engagement-cliff',
      priority: 'high',
      title: 'Engagement Cliff',
      message: 'Login frequency has dropped sharply versus the 30-day average.',
      recommendedAction: 'Schedule a check-in call to understand usage blockers.',
    });
  }
  return null;
}

function ruleContractExpirationRisk(input: AlertEngineInput, now: number): Alert | null {
  const { daysUntilExpiration } = input.contract;
  if (!isFiniteNumber(daysUntilExpiration)) return null;

  if (daysUntilExpiration < 90 && input.currentHealth.overallScore < 50) {
    return buildAlert(input, now, {
      type: 'contract-expiration-risk',
      priority: 'high',
      title: 'Contract Expiration Risk',
      message: 'Contract renewal is approaching while health score is low.',
      recommendedAction: 'Prioritize a renewal/retention conversation before the contract lapses.',
    });
  }
  return null;
}

function ruleSupportTicketSpike(input: AlertEngineInput, now: number): Alert | null {
  const { ticketsInLast7Days, hasEscalatedTicket } = input.engagement;
  const tickets = isFiniteNumber(ticketsInLast7Days) ? ticketsInLast7Days : 0;

  if (tickets > 3 || hasEscalatedTicket) {
    return buildAlert(input, now, {
      type: 'support-ticket-spike',
      priority: 'medium',
      title: 'Support Ticket Spike',
      message: hasEscalatedTicket
        ? 'A support ticket has been escalated.'
        : 'Support ticket volume has spiked in the last 7 days.',
      recommendedAction: 'Review recent tickets and ensure timely resolution.',
    });
  }
  return null;
}

function ruleFeatureAdoptionStall(input: AlertEngineInput, now: number): Alert | null {
  const { newFeatureUsageInLast30Days, isGrowingAccount } = input.engagement;
  if (!isGrowingAccount) return null;
  const usage = isFiniteNumber(newFeatureUsageInLast30Days) ? newFeatureUsageInLast30Days : 0;

  if (usage === 0) {
    return buildAlert(input, now, {
      type: 'feature-adoption-stall',
      priority: 'medium',
      title: 'Feature Adoption Stall',
      message: 'No new feature usage in the last 30 days for a growing account.',
      recommendedAction: 'Share relevant feature recommendations or schedule a product walkthrough.',
    });
  }
  return null;
}

/**
 * Negative Market Sentiment Risk (Medium Priority): triggers when the
 * customer's company has a fetched `MarketSentimentSnapshot` with a
 * negative sentiment label above the configured confidence threshold.
 * Pure function — degrades gracefully (returns null, never throws) when
 * market data is unavailable, stale, or the company could not be resolved;
 * `input.marketSnapshot` is expected to already reflect that (null/undefined).
 */
function evaluateMarketSentimentRisk(
  input: AlertEngineInput,
  now: number,
  options: AlertEngineOptions
): Alert | null {
  const snapshot = input.marketSnapshot;
  if (!snapshot) return null;

  const threshold =
    isFiniteNumber(options.marketSentimentConfidenceThreshold)
      ? options.marketSentimentConfidenceThreshold
      : DEFAULT_MARKET_SENTIMENT_CONFIDENCE_THRESHOLD;

  const { label, confidence } = snapshot.sentiment ?? {};
  if (label !== 'negative' || !isFiniteNumber(confidence) || confidence <= threshold) {
    return null;
  }

  return buildAlert(input, now, {
    type: 'market-sentiment-risk',
    priority: 'medium',
    title: 'Negative Market Sentiment Risk',
    message: 'Recent news coverage of this customer\'s company shows negative sentiment.',
    recommendedAction: 'Review recent coverage and consider a proactive outreach to address concerns.',
  });
}

const CORE_RULES: Array<(input: AlertEngineInput, now: number) => Alert | null> = [
  ruleHighPaymentRisk,
  ruleEngagementCliff,
  ruleContractExpirationRisk,
  ruleSupportTicketSpike,
  ruleFeatureAdoptionStall,
];

function buildAlert(
  input: AlertEngineInput,
  now: number,
  fields: Pick<Alert, 'type' | 'priority' | 'title' | 'message' | 'recommendedAction'>
): Alert {
  return {
    id: `${input.customerId}:${fields.type}`,
    customerId: input.customerId,
    arr: input.arr,
    triggeredAt: new Date(now).toISOString(),
    ...fields,
  };
}

// ---------------------------------------------------------------------------
// Dedup / cooldown / prioritization
// ---------------------------------------------------------------------------

function isWithinCooldown(entry: AlertHistoryEntry, now: number, cooldownMs: number): boolean {
  const reference = entry.dismissedAt ?? entry.triggeredAt;
  const t = Date.parse(reference);
  if (Number.isNaN(t)) return false;
  return now - t < cooldownMs;
}

const PRIORITY_ORDER: Record<AlertPriority, number> = { high: 0, medium: 1 };

/** Sorts by priority tier first, then by ARR (customer value) descending, for workload balancing. */
function prioritizeAlerts(alerts: Alert[]): Alert[] {
  return [...alerts].sort((a, b) => {
    const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.arr - a.arr;
  });
}

/**
 * Evaluates all alert rules for a customer against the current health score and
 * supplementary trend/context data. Handles missing/incomplete optional fields
 * gracefully (rules that depend on absent data simply do not trigger), but
 * throws a descriptive error for structurally invalid required input.
 *
 * Deduplicates against `options.history` (only one active alert per
 * customer/issue type) and honors a cooldown window to avoid re-triggering an
 * alert that was recently raised or dismissed for the same issue.
 */
export function alertEngine(input: AlertEngineInput, options: AlertEngineOptions = {}): Alert[] {
  validateInput(input);

  const now = input.now ? Date.parse(input.now) : Date.now();
  const cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const history = options.history ?? [];

  const historyById = new Map<string, AlertHistoryEntry>();
  for (const entry of history) {
    const existing = historyById.get(entry.id);
    if (!existing || Date.parse(entry.triggeredAt) > Date.parse(existing.triggeredAt)) {
      historyById.set(entry.id, entry);
    }
  }

  const rules: Array<(input: AlertEngineInput, now: number) => Alert | null> = [
    ...CORE_RULES,
    (ruleInput, ruleNow) => evaluateMarketSentimentRisk(ruleInput, ruleNow, options),
  ];

  const raw: Alert[] = [];
  const seen = new Set<string>();

  for (const rule of rules) {
    const alert = rule(input, now);
    if (!alert) continue;
    // Deduplication: only one alert per customer/issue type per evaluation.
    if (seen.has(alert.id)) continue;
    seen.add(alert.id);

    // Cooldown: suppress re-triggering the same issue too soon after it was
    // last raised/dismissed.
    const priorEntry = historyById.get(alert.id);
    if (priorEntry && isWithinCooldown(priorEntry, now, cooldownMs)) {
      continue;
    }

    raw.push(alert);
  }

  // Best-effort enrichment: any triggered alert for a customer whose company
  // has fetchable market data gets the snapshot's headlines (capped to 3)
  // attached as `marketContext`. Never blocks/fails alert generation — the
  // snapshot is already resolved (or null) by the time it reaches here.
  const enriched = input.marketSnapshot
    ? raw.map((alert) => ({ ...alert, marketContext: buildMarketContext(input.marketSnapshot!) }))
    : raw;

  return prioritizeAlerts(enriched);
}

/** Caps a market sentiment snapshot's headlines to the max shown in alert context. */
function buildMarketContext(snapshot: MarketSentimentSnapshot): MarketSentimentSnapshot {
  return {
    ...snapshot,
    headlines: snapshot.headlines.slice(0, MAX_MARKET_CONTEXT_HEADLINES),
  };
}

/**
 * Resolves a `MarketSentimentSnapshot` for the given company via
 * `marketIntelligenceService.ts`, reusing its existing 10-minute TTL cache
 * (no additional caching layer here). Returns `null` — never throws — when
 * the company is unresolvable/empty or the underlying fetch fails, times
 * out, or errors, so a slow/failed market lookup never blocks or fails
 * alert generation for the other rule types.
 */
export async function resolveMarketSentimentSnapshot(
  company: string | undefined | null
): Promise<MarketSentimentSnapshot | null> {
  if (!company || !company.trim()) {
    return null;
  }

  try {
    const data: MarketIntelligenceData = await getMarketIntelligence(company);
    return {
      company: data.company,
      sentiment: { ...data.sentiment },
      headlines: data.headlines.map((headline) => ({
        title: headline.title,
        source: headline.source,
        publishedAt: headline.publishedAt,
      })),
      fetchedAt: data.lastUpdated,
    };
  } catch (error) {
    // Includes MarketIntelligenceError (invalid-input/fetch-failure/timeout)
    // and any unexpected error — market signal is simply unavailable.
    void (error instanceof MarketIntelligenceError ? error.reason : error);
    return null;
  }
}

/** Appends newly triggered alerts to an existing audit trail (immutable append). */
export function recordAlerts(history: AlertHistoryEntry[], alerts: Alert[]): AlertHistoryEntry[] {
  return [...history, ...alerts.map((alert) => ({ ...alert }))];
}

/** Marks a history entry as dismissed, optionally recording the action taken. */
export function dismissAlert(
  history: AlertHistoryEntry[],
  alertId: string,
  actionTaken?: string
): AlertHistoryEntry[] {
  const now = new Date().toISOString();
  return history.map((entry) =>
    entry.id === alertId && !entry.dismissed
      ? { ...entry, dismissed: true, dismissedAt: now, actionTaken }
      : entry
  );
}
