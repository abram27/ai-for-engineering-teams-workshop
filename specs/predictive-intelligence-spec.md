# Feature: PredictiveIntelligence Integration

## Context
- Integrated predictive risk system for the Customer Intelligence Dashboard that combines the rule-based predictive alerts engine (`src/lib/alerts.ts`) with external market signal data (`src/lib/marketIntelligenceService.ts`)
- Extends internal churn-risk monitoring (health score, engagement, payment, support signals) with an external market context signal (company news sentiment), and enriches triggered alerts with relevant market headlines for account teams
- Builds on `specs/customer-health-monitoring-spec.md` (health scoring + alert engine) and `specs/market-intelligence-spec.md` (market sentiment + news widget) — this spec is the integration layer between them, not a replacement for either
- Demonstrates advanced spec-driven integration: combining two independently-specified requirement sets into a single cross-cutting feature

## Requirements

### Functional Requirements

#### Market Signal Alert Rule
- New Medium Priority alert rule: **Negative Market Sentiment Risk** — triggers when `MarketIntelligenceService` returns `sentiment.label === 'negative'` with `sentiment.confidence` above a configurable threshold (default 0.6) for the customer's company
- Rule is a pure function in `src/lib/alerts.ts` (e.g. `evaluateMarketSentimentRisk`) consistent with the other rule functions, accepting the existing `HealthScoreResult`/customer data plus a `MarketSentimentSnapshot` input
- Market-derived alerts follow the same priority scoring, cooldown, and deduplication logic as existing alert types (no separate code path for spam prevention)
- Rule degrades gracefully (does not trigger, does not throw) when market data is unavailable, stale, or the company name cannot be resolved from customer data

#### Alert Context Enrichment
- Any triggered alert for a customer whose company has fetchable market data is enriched with up to 3 relevant headlines (reused from the existing `MarketIntelligenceService` response) attached as contextual metadata on the `Alert` object
- Enrichment is best-effort and asynchronous relative to core rule evaluation: a slow or failed market data fetch must never block or fail alert generation for the other rule types
- Enrichment data is cached per the existing 10-minute TTL in `MarketIntelligenceService`; alert evaluation does not trigger redundant fetches within that window

#### Correlated Risk View
- `alertEngine` output includes a `marketContext` field (nullable) on alerts where applicable, containing sentiment label/score and the enriched headlines
- Alert history/audit trail records whether an alert included a market signal component, to support later effectiveness analysis (does market sentiment correlate with real churn outcomes)

### User Interface Requirements
- `CustomerAlerts` widget displays a market-context indicator (small sentiment badge, using the existing green/yellow/red scheme) on alerts that include `marketContext`
- Alert detail panel shows the attached headlines (title, source, date) when `marketContext` is present, positioned below the existing recommended-action content
- No new top-level widget is introduced — market context is a supplementary section within the existing alert detail UI, not a duplicate of `MarketIntelligenceWidget`
- Loading/error states: if market context enrichment fails or is pending, the alert still renders fully with recommended actions; the market-context section is simply omitted or shows a lightweight "context unavailable" note

### Data Requirements
- `MarketSentimentSnapshot` type: `{ company: string; sentiment: { score: number; label: 'positive'|'neutral'|'negative'; confidence: number }; headlines: { title: string; source: string; publishedAt: string }[]; fetchedAt: string }`
- `Alert` type extended with optional `marketContext: MarketSentimentSnapshot | null`
- Company name for lookup is sourced from `Customer.company` (already present on the existing `Customer` type); no new customer fields required
- Handles customers with no resolvable company/market data without errors (treated as "no market signal available", not a failure)

### Integration Requirements
- `src/lib/alerts.ts` calls `src/lib/marketIntelligenceService.ts` (or an injected equivalent) to obtain `MarketSentimentSnapshot` per customer during rule evaluation
- Market fetch failures use the existing `MarketIntelligenceError` handling from the service layer; `alertEngine` catches these and proceeds without market context rather than propagating the error
- `CustomerAlerts` and `CustomerHealthDisplay` continue to update together on customer selection change (per `customer-health-monitoring-spec.md`); market context enrichment is additive and does not change that existing data flow
- Shared TypeScript types (`MarketSentimentSnapshot`, extended `Alert`) are exported from a location importable by both `src/lib/alerts.ts` and `src/components/CustomerAlerts.tsx`

## Constraints

### Technical Stack
- Next.js 15 (App Router)
- React 19
- TypeScript with strict mode
- Tailwind CSS for styling

### Performance Requirements
- Market sentiment lookups reuse the existing 10-minute TTL cache; no additional caching layer introduced
- Rule evaluation for hundreds of customers remains non-blocking: market fetches run with a bounded timeout and never stall the core alert evaluation loop
- No layout shift in `CustomerAlerts` when market context loads asynchronously after the base alert renders

### Design Constraints
- Responsive breakpoints: mobile (320px+), tablet (768px+), desktop (1024px+)
- Reuses the existing green/yellow/red sentiment color coding from `MarketIntelligenceWidget` and the red/yellow alert priority coding from `CustomerAlerts` — no new color scheme
- Consistent spacing and typography with the existing alert detail panel

### File Structure and Naming
- Alert engine extension: `src/lib/alerts.ts` (add `evaluateMarketSentimentRisk` rule function; extend `alertEngine`)
- Shared types: extend the existing alert types module (e.g. `src/lib/alerts.ts` or a shared `src/lib/types.ts` if one exists) with `MarketSentimentSnapshot` and the extended `Alert` interface
- No new component files — extend `src/components/CustomerAlerts.tsx` and its `CustomerAlertsProps`
- PascalCase for components/types, camelCase for functions

### Security Considerations
- Market-derived headline text rendered in alert detail panels must be sanitized before display (XSS prevention), consistent with `market-intelligence-spec.md`
- No sensitive customer data included in market-context enrichment requests (only the company name is sent to the service layer)
- Market fetch failures return generic, non-leaking error states in the UI, consistent with existing alert error handling
- Rate limiting on alert generation (per `customer-health-monitoring-spec.md`) applies uniformly regardless of whether market context is attached

## Acceptance Criteria

- [ ] Negative Market Sentiment Risk rule triggers only when sentiment is negative and confidence exceeds the configured threshold
- [ ] Market-derived alerts participate in the same deduplication and cooldown logic as other alert types
- [ ] Market data fetch failure or unavailability never blocks or breaks unrelated alert rule evaluation
- [ ] Triggered alerts include up to 3 relevant headlines when market data is available, attached via `marketContext`
- [ ] Market context fetches respect the existing 10-minute TTL cache and do not redundantly refetch
- [ ] `CustomerAlerts` displays a sentiment badge and headlines for alerts with `marketContext`, and renders normally (without error) when it is absent
- [ ] Alert history records whether each alert included a market signal component
- [ ] No sensitive customer data is sent to or exposed via the market intelligence integration
- [ ] Headline text is sanitized before rendering in the alert detail panel
- [ ] Responsive design works on mobile (320px+), tablet (768px+), and desktop (1024px+)
- [ ] Proper TypeScript interfaces defined, exported, and shared between the alert engine and market intelligence service
- [ ] No console errors or warnings
- [ ] Passes TypeScript strict mode checks
- [ ] Follows project code style and conventions

## Integration Architecture

### Component Interaction Diagram

```
CustomerSelector (selection state)
        │
        ▼
  selectedCustomerId ──────────────────────┐
        │                                  │
        ▼                                  ▼
lib/healthCalculator.ts           Customer.company
  calculateHealthScore()                   │
        │                                  ▼
        ▼                    src/lib/marketIntelligenceService.ts
  HealthScoreResult                  (cached, TTL 10min)
        │                                  │
        ▼                                  ▼
lib/alerts.ts  ◄─────────────────  MarketSentimentSnapshot
  alertEngine()                    (or null on failure/timeout)
        │
        ▼
  Alert[] { ..., marketContext? }
        │
        ▼
  CustomerAlerts widget
  (priority list, detail panel with
   sentiment badge + headlines when present)
```

### Data Flow Description
1. `CustomerSelector` sets the active customer; `lib/alerts.ts` evaluation is triggered as in `customer-health-monitoring-spec.md`.
2. In parallel with the core health/engagement/payment/support rule inputs, `alertEngine` resolves `Customer.company` and requests a `MarketSentimentSnapshot` from `MarketIntelligenceService`.
3. If the market fetch succeeds within the timeout, `evaluateMarketSentimentRisk` runs alongside the other rule functions and may produce a Medium Priority alert; any triggered alert (market-driven or otherwise) for that customer is enriched with the snapshot's headlines as `marketContext`.
4. If the market fetch fails, times out, or the company is unresolvable, rule evaluation proceeds without market context — no error propagates to the rest of `alertEngine`.
5. The resulting `Alert[]` (with optional `marketContext`) is rendered by `CustomerAlerts`; the alert history/audit trail records the presence of a market signal for later effectiveness analysis.
6. Changing the selected customer re-runs steps 1-5; cached market data within the TTL window is reused rather than refetched.

### Key Integration Points
- **Alerts → Market data contract**: `MarketSentimentSnapshot` is the shared interface between `src/lib/alerts.ts` and `src/lib/marketIntelligenceService.ts`; both must agree on this shape.
- **Failure isolation**: the market signal path is strictly additive and fault-isolated — `MarketIntelligenceError` is caught within `alertEngine` and never allowed to fail core rule evaluation.
- **Cache reuse**: the alert engine does not introduce its own cache; it relies entirely on `MarketIntelligenceService`'s existing 10-minute TTL cache to avoid duplicate fetches across widgets.
- **UI reuse**: `CustomerAlerts` reuses `MarketIntelligenceWidget`'s color-coding conventions and headline display format rather than defining new UI primitives.

### Dependencies on Previously Created Specs
- Depends on `specs/customer-health-monitoring-spec.md` for the `lib/alerts.ts` alert engine, `Alert` type, `CustomerAlerts` component, and the existing alert priority/dedup/cooldown behavior this feature extends.
- Depends on `specs/market-intelligence-spec.md` for the `MarketIntelligenceService`, `MarketIntelligenceError`, sentiment/headline response shape, and color-coding conventions this feature consumes.
