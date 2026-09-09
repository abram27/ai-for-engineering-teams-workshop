# Feature: MarketIntelligenceWidget Component

## Context
- Market intelligence widget for the Customer Intelligence Dashboard
- Provides market sentiment and recent news headlines for a customer's company
- Consumes mock data from `src/data/mock-market-intelligence.ts` (`generateMockMarketData`, `calculateMockSentiment`) via a new API route and service layer
- Integrated into the main Dashboard alongside CustomerCard and other widgets, receiving the company name from the currently selected customer
- Demonstrates spec-driven context compression and multi-widget composition consistency

## Requirements

### API Layer
- Route: `src/app/api/market-intelligence/[company]/route.ts` (Next.js 15 Route Handler, `GET`)
- Validate and sanitize the `company` route param (non-empty, reasonable length, strip/reject unsafe characters) before use
- Use `generateMockMarketData(company)` and `calculateMockSentiment(headlines)` from `src/data/mock-market-intelligence.ts` to build the response
- Simulate realistic network latency (e.g. random delay in the few-hundred-ms range) before responding
- Return a consistent JSON response shape:
  ```ts
  {
    company: string;
    sentiment: { score: number; label: 'positive' | 'neutral' | 'negative'; confidence: number };
    articleCount: number;
    headlines: { title: string; source: string; publishedAt: string; url?: string }[];
    lastUpdated: string; // ISO timestamp
  }
  ```
- On invalid input return `400` with a sanitized error message; on unexpected failure return `500` with a generic message (no internal error details leaked)

### Service Layer
- File: `src/lib/marketIntelligenceService.ts`
- `MarketIntelligenceService` class (or equivalent pure-function module) that:
  - Fetches from the API route (or wraps the mock data generators directly, mirroring how other widgets separate data access from UI)
  - Caches successful results per company with a 10-minute TTL, keyed by normalized company name
  - Exposes a custom `MarketIntelligenceError` class for failures (invalid input, fetch failure, timeout)
  - Uses pure functions where possible for testability
- Cache lookup must expire and refetch after TTL elapses; repeated calls within TTL return cached data without re-invoking the generator/fetch

### UI Component
- Component file: `src/components/MarketIntelligenceWidget.tsx`
- Props interface `MarketIntelligenceWidgetProps` (exported), accepting `company: string` (from selected customer)
- Text input for manually entering/overriding a company name, with basic client-side validation (non-empty)
- Displays:
  - Sentiment indicator, color-coded: green (positive), yellow (neutral), red (negative)
  - Article count and "last updated" timestamp
  - Top 3 headlines, each with title, source, and publication date
- Loading state while fetching, matching the visual style used for loading in other widgets
- Error state (invalid company, fetch failure) that never crashes the widget and shows a user-safe message

### Dashboard Integration
- Rendered from the main Dashboard component (`src/app/page.tsx` or its successor) alongside other widgets
- Receives `company` derived from the currently selected customer (`Customer.company` from `src/data/mock-customers.ts`)
- Follows the same prop-passing and state-management pattern used for other dashboard widgets (e.g. re-renders when the selected customer changes)
- Fits into the existing responsive grid layout (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`) with consistent spacing

## Constraints

### Technical Stack
- Next.js 15 (App Router) with Route Handlers
- React 19
- TypeScript with strict mode for all interfaces
- Tailwind CSS for styling, matching existing dashboard design system colors

### Design Constraints
- Responsive breakpoints: mobile (320px+), tablet (768px+), desktop (1024px+)
- Same green/yellow/red color coding system used by `CustomerCard`'s health indicators
- Consistent spacing, typography, and card structure with other dashboard widgets
- Loading and error state visuals consistent with other widgets

### File Structure and Naming
- API route: `src/app/api/market-intelligence/[company]/route.ts`
- Service: `src/lib/marketIntelligenceService.ts`
- Component: `src/components/MarketIntelligenceWidget.tsx`
- Props interface `MarketIntelligenceWidgetProps` exported from the component file
- PascalCase for components/classes, camelCase for functions/instances

### Security Considerations
- Sanitize and validate the `company` path parameter to prevent injection via the URL
- Sanitize all mock-data-derived strings before rendering (XSS prevention)
- Error messages returned to the client must never leak internal details (stack traces, file paths)
- No external network calls — all data is generated locally via mock data, eliminating external API attack surface
- Simulated timeouts/delays must not block the event loop or allow resource exhaustion (bounded delay only)

### Performance Requirements
- Cached responses (within 10-minute TTL) return without re-running mock data generation
- No layout shift during loading/error/success transitions
- Efficient re-renders when the selected customer changes (avoid redundant fetches for the same company)

## Acceptance Criteria

- [ ] API route returns sentiment, article count, headlines, and last-updated timestamp in the documented JSON shape
- [ ] API route validates/sanitizes the `company` param and returns `400` on invalid input
- [ ] API route simulates a realistic delay and never leaks internal error details on `500`
- [ ] Service layer caches results per company for 10 minutes and serves cached data without redundant fetches within that window
- [ ] Service layer throws/exposes `MarketIntelligenceError` on failure instead of an unhandled exception
- [ ] Widget displays color-coded sentiment (green/yellow/red matching positive/neutral/negative)
- [ ] Widget shows article count, last-updated timestamp, and top 3 headlines with source and date
- [ ] Widget shows a loading state while fetching and an error state on failure, without crashing
- [ ] Widget includes a company-name input with basic validation
- [ ] Widget is integrated into the Dashboard, receives company from the selected customer, and updates when selection changes
- [ ] Responsive design works on mobile (320px+), tablet (768px+), and desktop (1024px+)
- [ ] Proper TypeScript interfaces defined and exported for props and API response
- [ ] No console errors or warnings
- [ ] Passes TypeScript strict mode checks
- [ ] Follows project code style and conventions
