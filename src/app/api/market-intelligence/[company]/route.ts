import { NextRequest, NextResponse } from 'next/server';
import {
  generateMockMarketData,
  calculateMockSentiment,
} from '@/data/mock-market-intelligence';

export interface MarketIntelligenceResponse {
  company: string;
  sentiment: {
    score: number;
    label: 'positive' | 'neutral' | 'negative';
    confidence: number;
  };
  articleCount: number;
  headlines: {
    title: string;
    source: string;
    publishedAt: string;
    url?: string;
  }[];
  lastUpdated: string;
}

const MAX_COMPANY_LENGTH = 100;
// Allow letters, numbers, spaces, and a small set of common punctuation.
const SAFE_COMPANY_PATTERN = /^[a-zA-Z0-9 .,&'\-]+$/;

/**
 * Validates and sanitizes the `company` route param.
 * Returns the sanitized value, or null if the input is invalid.
 */
function sanitizeCompanyParam(rawCompany: string | undefined | null): string | null {
  if (!rawCompany) {
    return null;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(rawCompany);
  } catch {
    return null;
  }

  const trimmed = decoded.trim();

  if (trimmed.length === 0 || trimmed.length > MAX_COMPANY_LENGTH) {
    return null;
  }

  if (!SAFE_COMPANY_PATTERN.test(trimmed)) {
    return null;
  }

  return trimmed;
}

/** Resolves after a bounded random delay to simulate realistic network latency. */
function simulateNetworkDelay(): Promise<void> {
  const MIN_DELAY_MS = 200;
  const MAX_DELAY_MS = 600;
  const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ company: string }> }
) {
  try {
    const { company: rawCompany } = await context.params;
    const company = sanitizeCompanyParam(rawCompany);

    if (!company) {
      return NextResponse.json(
        { error: 'Invalid company name. Provide a non-empty company name using standard characters.' },
        { status: 400 }
      );
    }

    await simulateNetworkDelay();

    const marketData = generateMockMarketData(company);
    const sentiment = calculateMockSentiment(marketData.headlines);

    const response: MarketIntelligenceResponse = {
      company,
      sentiment,
      articleCount: marketData.articleCount,
      headlines: marketData.headlines,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch {
    // Never leak internal error details (stack traces, file paths) to the client.
    return NextResponse.json(
      { error: 'Unable to retrieve market intelligence at this time.' },
      { status: 500 }
    );
  }
}
