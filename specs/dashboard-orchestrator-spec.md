# Feature: DashboardOrchestrator

## Context
- Top-level, production-ready shell for the Customer Intelligence Dashboard
- Composes and coordinates all previously built widgets (`CustomerSelector`, `CustomerCard`, `CustomerHealthDisplay`, `CustomerAlerts`, `MarketIntelligenceWidget`) into a single resilient, accessible, exportable application
- Owns cross-cutting production concerns — error isolation, data export, performance, accessibility, and security hardening — that individual widgets should not each reimplement
- Transforms the dashboard from a working prototype into a deployment-ready application per `requirements/production-ready-dashboard.md`

## Requirements

### Functional Requirements

#### Error Handling and Resilience
- `DashboardErrorBoundary` wraps the entire dashboard; catches unhandled render errors and displays a full-page fallback with retry
- `WidgetErrorBoundary` wraps each individual widget (`CustomerHealthDisplay`, `CustomerAlerts`, `MarketIntelligenceWidget`) so one widget's failure never takes down the rest of the dashboard
- Custom error classes (e.g. `WidgetLoadError`, `ExportError`) carry category and context for logging and user messaging
- Retry mechanism with a bounded retry count per widget; after exceeding the limit, shows a persistent fallback with a manual "reload widget" action
- Errors are reported/logged (category, widget, message, timestamp) without leaking stack traces or internal details to the UI
- Fallback UI keeps the rest of the dashboard (selector, unaffected widgets) fully interactive

#### Data Export and Portability
- Export customer data, health score reports (with per-factor breakdown), and alert history/audit logs
- Supported formats: CSV and JSON
- Configurable filters: date range, customer segment/tier, and selected data fields
- Streaming export for large datasets so the UI never blocks on export generation
- Progress indicator during export generation and a cancellation control for long-running exports
- Exported filenames include a type label and ISO timestamp (e.g. `health-report_2026-09-09T12-00-00.csv`)

#### Performance Optimization
- Widgets and expensive subtrees wrapped in `React.memo`; derived values memoized with `useMemo`, callbacks stabilized with `useCallback`
- Code-split, lazily loaded widgets (`React.lazy` + `Suspense`) so initial bundle only includes the dashboard shell and `CustomerSelector`
- Virtual scrolling reused from `CustomerSelector` for large customer lists; orchestrator does not re-render unaffected widgets on selection change
- No memory leaks from export streams, timers, or widget subscriptions across mount/unmount cycles

#### Accessibility Compliance
- WCAG 2.1 AA compliant landmark structure (`header`, `main`, `nav`, per-widget `region` with `aria-label`)
- Full keyboard navigation across selector, widgets, and export controls, including a skip link to main content
- Live region announcing widget loading/error/retry state changes and export progress/completion
- Visible focus indicators meeting WCAG contrast requirements; focus trap for the export dialog/modal

#### Security Hardening
- CSP configured to block inline scripts/styles beyond an allowlist; blocks unauthorized external origins
- Security headers set: `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`
- All user input (search, export filters) and widget-consumed API responses validated/sanitized before use or render
- Rate limiting on export requests and any API endpoints the orchestrator calls, with a user-facing "try again later" message on throttling
- No sensitive customer data (raw PII beyond what's already shown) written to client-side logs or error reports

### User Interface Requirements
- Single dashboard shell rendering `CustomerSelector` alongside a responsive grid of widgets (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`), matching existing widget spacing/typography
- Per-widget error fallback visually consistent with existing loading/error states (`CustomerHealthDisplay`, `MarketIntelligenceWidget`)
- Export control (button + filter panel) accessible from the dashboard header
- Health check status indicator not shown to end users (surfaced only via the health check endpoint, not the UI)

### Data Requirements
- Consumes existing typed outputs from all composed widgets/modules: `Customer`, `HealthScoreResult`, `Alert[]`, market intelligence response shape
- Export input: current customer list, selected customer's health/alert data or all-customer aggregate depending on filter scope
- TypeScript interfaces for export request/response, error context, and widget registration metadata
- Handles partial data (one widget's data present, another's failed) without blocking export or rendering of unaffected sections

### Integration Requirements
- Renders `CustomerSelector` as the primary selection source; selection state flows to all wrapped widgets exactly as it does today
- Wraps `CustomerHealthDisplay`, `CustomerAlerts`, and `MarketIntelligenceWidget` individually in `WidgetErrorBoundary`, without changing their existing props contracts
- Export system reads from the same data sources each widget already consumes (`lib/healthCalculator.ts`, `lib/alerts.ts`, market intelligence service) rather than duplicating data-fetching logic
- Does not modify existing widget/service internals — orchestration and hardening are additive at the composition layer

## Constraints

### Technical Stack
- Next.js 15 (App Router) with production configuration (security headers, CSP)
- React 19 (Suspense, `React.lazy`, error boundaries)
- TypeScript with strict mode
- Tailwind CSS for styling

### Performance Requirements
- Initial page load under 3 seconds on standard broadband
- First Contentful Paint under 1.5s, Largest Contentful Paint under 2.5s, Cumulative Layout Shift under 0.1, Time to Interactive under 3.5s
- Smooth 60fps interactions; no unnecessary re-renders of unaffected widgets
- Export generation does not block the main thread or degrade dashboard interactivity

### Design Constraints
- Responsive breakpoints: mobile (320px+), tablet (768px+), desktop (1024px+)
- Error/loading/empty states visually consistent with existing widget patterns
- Color coding consistency (red/yellow/green) preserved across all wrapped widgets

### File Structure and Naming
- Orchestrator component: `components/DashboardOrchestrator.tsx`
- Error boundaries: `components/DashboardErrorBoundary.tsx`, `components/WidgetErrorBoundary.tsx`
- Export module: `lib/exportUtils.ts`
- Health check route: `src/app/api/health/route.ts`
- Props interface: `DashboardOrchestratorProps` exported from the component file
- PascalCase for components/classes, camelCase for functions/instances

### Security Considerations
- Sanitize all export filter inputs and widget-sourced data before inclusion in exported files
- Enforce CSP, security headers, and HTTPS in production configuration
- Rate limit export and API endpoints; validate/authorize export requests before streaming data
- Error messages shown to users never include stack traces, file paths, or internal identifiers

## Acceptance Criteria

- [ ] `DashboardErrorBoundary` catches application-level errors and shows a full-page fallback with retry, without crashing the app
- [ ] Each widget is individually wrapped in `WidgetErrorBoundary`; one widget failing does not affect the others or the selector
- [ ] Retry mechanism respects a bounded retry limit before falling back to a persistent manual-reload state
- [ ] Export supports CSV and JSON for customer data, health reports, and alert history, with configurable date range and segment filters
- [ ] Large exports stream with a progress indicator and can be cancelled mid-export
- [ ] Exported files use timestamped, descriptive filenames
- [ ] Widgets are code-split and lazily loaded; initial bundle excludes non-critical widget code
- [ ] No unnecessary re-renders of unaffected widgets on selection or data changes
- [ ] Meets WCAG 2.1 AA: landmarks, keyboard navigation, skip link, live-region announcements, visible focus indicators
- [ ] CSP and security headers configured; all user/API input sanitized before use or render
- [ ] Export and API endpoints are rate-limited with a user-facing throttling message
- [ ] No sensitive data leaked in logs, error messages, or exported files beyond what's already user-visible
- [ ] Loading times meet target Core Web Vitals thresholds (FCP < 1.5s, LCP < 2.5s, CLS < 0.1, TTI < 3.5s)
- [ ] Responsive design works on mobile (320px+), tablet (768px+), and desktop (1024px+)
- [ ] Proper TypeScript interfaces defined and exported
- [ ] No console errors or warnings
- [ ] Passes TypeScript strict mode checks
- [ ] Follows project code style and conventions

## Integration Architecture

### Component Interaction Diagram

```
                        DashboardOrchestrator
                                │
        ┌───────────────────────┼────────────────────────┐
        ▼                       ▼                         ▼
DashboardErrorBoundary   CustomerSelector          Export Controls
   (app-level fallback)   (selection state)         (lib/exportUtils.ts)
        │                       │                         │
        ▼                       ▼                         ▼
  ┌─────────────┬───────────────┴───────────────┬─────────────┐
  ▼             ▼                               ▼             ▼
WidgetErrorBoundary                     WidgetErrorBoundary   WidgetErrorBoundary
  │                                             │                     │
  ▼                                             ▼                     ▼
CustomerHealthDisplay + CustomerAlerts   MarketIntelligenceWidget  (future widgets)
  (lib/healthCalculator.ts, lib/alerts.ts)  (marketIntelligenceService.ts)
```

### Data Flow Description
1. `DashboardOrchestrator` mounts `DashboardErrorBoundary` at the root, then renders `CustomerSelector` and the widget grid inside it.
2. `CustomerSelector` owns selection state exactly as in `specs/customer-selector-spec.md`; the orchestrator passes the selected customer down to each wrapped widget.
3. Each widget (`CustomerHealthDisplay`, `CustomerAlerts`, `MarketIntelligenceWidget`) is individually mounted inside its own `WidgetErrorBoundary` and lazily loaded via `React.lazy`/`Suspense`.
4. Widgets fetch/compute data through their existing modules (`lib/healthCalculator.ts`, `lib/alerts.ts`, `marketIntelligenceService.ts`) unchanged; the orchestrator does not intercept this data path except to catch render errors.
5. On export, `lib/exportUtils.ts` reads from the same underlying data sources (customer list, health results, alert history, market data), applies the requested filters, and streams the formatted output while reporting progress back to the export UI.
6. A widget error is caught by its `WidgetErrorBoundary`, logged with category/context, and rendered as a fallback in place — sibling widgets and the selector remain unaffected and exports of unaffected data continue to work.

### Key Integration Points
- **Composition-only boundary**: the orchestrator wraps existing widgets and services without altering their props contracts or internal logic, keeping this spec additive to `health-widget-spec.md`, `customer-health-monitoring-spec.md`, `market-intelligence-spec.md`, and `customer-selector-spec.md`.
- **Selection remains the single source of truth**: `CustomerSelector`'s state continues to drive all widgets; the orchestrator only adds error/perf wrapping around consumers of that state.
- **Export reads, never writes, widget state**: `lib/exportUtils.ts` treats each widget's underlying data module as a read-only source, avoiding duplicated fetch/calculation logic.
- **Isolation boundary is per-widget, not per-feature**: `CustomerHealthDisplay` and `CustomerAlerts` share a `WidgetErrorBoundary` region since they are already tightly coupled per `customer-health-monitoring-spec.md`; `MarketIntelligenceWidget` gets its own independent boundary.

### Dependencies on Previously Created Specs
- Depends on `specs/customer-selector-spec.md` for selection state and the composition pattern all widgets plug into.
- Depends on `specs/customer-card-spec.md` for the customer data shape rendered within `CustomerSelector`.
- Depends on `specs/health-widget-spec.md` for the `CustomerHealthDisplay` contract wrapped by this orchestrator.
- Depends on `specs/customer-health-monitoring-spec.md` for the `CustomerAlerts` contract and its coupling to health score data.
- Depends on `specs/market-intelligence-spec.md` for the `MarketIntelligenceWidget` contract and its service layer.
