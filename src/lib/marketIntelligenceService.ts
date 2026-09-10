/**
 * Service layer for the MarketIntelligenceWidget.
 * Wraps the market-intelligence API route, adding per-company caching with a
 * TTL and a typed error class so the UI never has to deal with raw fetch
 * failures or unhandled exceptions.
 */

export interface MarketIntelligenceSentiment {
  score: number;
  label: 'positive' | 'neutral' | 'negative';
  confidence: number;
}

export interface MarketIntelligenceHeadline {
  title: string;
  source: string;
  publishedAt: string;
  url?: string;
}

export interface MarketIntelligenceData {
  company: string;
  sentiment: MarketIntelligenceSentiment;
  articleCount: number;
  headlines: MarketIntelligenceHeadline[];
  lastUpdated: string;
}

export type MarketIntelligenceErrorReason = 'invalid-input' | 'fetch-failure' | 'timeout';

export class MarketIntelligenceError extends Error {
  public readonly reason: MarketIntelligenceErrorReason;

  constructor(message: string, reason: MarketIntelligenceErrorReason) {
    super(message);
    this.name = 'MarketIntelligenceError';
    this.reason = reason;
  }
}

interface CacheEntry {
  data: MarketIntelligenceData;
  expiresAt: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const FETCH_TIMEOUT_MS = 5000;

const cache = new Map<string, CacheEntry>();

/** Normalizes a company name for use as a cache key. */
function normalizeCompanyKey(company: string): string {
  return company.trim().toLowerCase();
}

/** Reads a non-expired cache entry for the given company, if one exists. */
function getCached(key: string): MarketIntelligenceData | null {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }
  if (Date.now() >= entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key: string, data: MarketIntelligenceData): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Clears all cached entries. Intended for tests. */
export function clearMarketIntelligenceCache(): void {
  cache.clear();
}

async function fetchMarketIntelligence(company: string): Promise<MarketIntelligenceData> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(
      `/api/market-intelligence/${encodeURIComponent(company)}`,
      { signal: controller.signal }
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new MarketIntelligenceError(
        'Market intelligence request timed out. Please try again.',
        'timeout'
      );
    }
    throw new MarketIntelligenceError(
      'Unable to reach market intelligence service.',
      'fetch-failure'
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 400) {
    throw new MarketIntelligenceError(
      'Invalid company name provided.',
      'invalid-input'
    );
  }

  if (!response.ok) {
    throw new MarketIntelligenceError(
      'Market intelligence service returned an error.',
      'fetch-failure'
    );
  }

  try {
    return (await response.json()) as MarketIntelligenceData;
  } catch {
    throw new MarketIntelligenceError(
      'Received an invalid market intelligence response.',
      'fetch-failure'
    );
  }
}

/**
 * Retrieves market intelligence for a company, serving cached data when
 * available and within the TTL window.
 */
export async function getMarketIntelligence(company: string): Promise<MarketIntelligenceData> {
  const trimmed = company.trim();
  if (!trimmed) {
    throw new MarketIntelligenceError('Company name must not be empty.', 'invalid-input');
  }

  const key = normalizeCompanyKey(trimmed);
  const cached = getCached(key);
  if (cached) {
    return cached;
  }

  const data = await fetchMarketIntelligence(trimmed);
  setCached(key, data);
  return data;
}

export class MarketIntelligenceService {
  getMarketIntelligence(company: string): Promise<MarketIntelligenceData> {
    return getMarketIntelligence(company);
  }

  clearCache(): void {
    clearMarketIntelligenceCache();
  }
}

export default MarketIntelligenceService;
