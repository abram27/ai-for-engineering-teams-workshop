# Feature: CustomerHealthMonitoring Integration

## Context
- Integrated health scoring and predictive alerting system for the Customer Intelligence Dashboard
- Combines the health score calculator (`lib/healthCalculator.ts`) with a rule-based predictive alerts engine (`lib/alerts.ts`)
- Provides proactive churn-risk monitoring: health scores drive alert rule evaluation, and alerts surface actionable risk signals to account teams
- Builds on the existing `CustomerHealthDisplay` widget and `CustomerSelector` container component

## Requirements

### Functional Requirements

#### Health Score Calculation
- Calculate customer health scores on a 0-100 scale with risk level categorization
- Multi-factor weighted scoring: Payment (40%), Engagement (30%), Contract (20%), Support (10%)
- Risk level classification: Healthy (71-100), Warning (31-70), Critical (0-30)
- Individual pure scoring functions per factor (payment, engagement, contract, support) plus a combining `calculateHealthScore` function
- Input validation and descriptive error handling for all data inputs
- Edge case handling for new customers and missing/incomplete data

#### Predictive Alerts Engine
- Multi-tier alert priority system: High Priority (immediate action) and Medium Priority (monitor closely)
- Rule-based triggering with configurable thresholds, evaluated via a pure `alertEngine` function in `lib/alerts.ts`
- High Priority rules:
  - Payment Risk: payment overdue >30 days OR health score drops >20 points in 7 days
  - Engagement Cliff: login frequency drops >50% vs. 30-day average
  - Contract Expiration Risk: contract expires in <90 days AND health score <50
- Medium Priority rules:
  - Support Ticket Spike: >3 support tickets in 7 days OR any escalated ticket
  - Feature Adoption Stall: no new feature usage in 30 days for growing accounts
- Alert prioritization considers customer value (ARR) and workload balancing
- Deduplication logic to prevent duplicate alerts for the same customer/issue
- Cooldown periods to prevent alert spam and fatigue
- Alert history tracking and audit trail for response effectiveness

#### Integration Behavior
- Alert engine consumes health scores and score deltas produced by `calculateHealthScore` as direct inputs to alert rules
- Health score trend tracking (current vs. prior snapshot) required to evaluate score-drop-based rules
- Alerts re-evaluate automatically whenever the underlying health score inputs change

### User Interface Requirements
- `CustomerHealthDisplay` widget shows overall score (color-coded) with expandable per-factor breakdown
- Real-time alert display widget integrated into the main dashboard, adjacent to or within the health display
- Alert priority visualization with color coding (red = High, yellow = Medium)
- Alert detail panel showing recommended actions and context for each triggered alert
- Alert dismissal and action-tracking controls
- Historical alerts view for a selected customer
- Loading and error states consistent with other dashboard widgets
- Updates automatically when the selected customer changes (via `CustomerSelector`)

### Data Requirements
- Health score inputs:
  - Payment history: days since last payment, average payment delay, overdue amounts
  - Engagement metrics: login frequency, feature usage count, support tickets
  - Contract information: days until renewal, contract value, recent upgrades
  - Support data: average resolution time, satisfaction scores, escalation counts
- Alert engine inputs: current and historical health scores (for trend/delta detection), customer ARR, login history (30-day rolling), contract data, support ticket history
- TypeScript interfaces for health score results, per-factor breakdowns, alert types, and rule evaluation inputs/outputs
- Handles missing or incomplete input data without crashing either the calculator or the alert engine

### Integration Requirements
- `lib/alerts.ts` imports and depends on types/output from `lib/healthCalculator.ts`
- Both modules used within/alongside `CustomerSelector`; health and alert widgets update together on customer selection change
- Shared TypeScript interfaces between calculator, alert engine, and UI components
- Consistent error handling and loading state patterns across health display and alert widgets

## Constraints

### Technical Stack
- Next.js 15 (App Router)
- React 19
- TypeScript with strict mode
- Tailwind CSS for styling

### Performance Requirements
- Efficient calculation and rule evaluation suitable for real-time dashboard updates
- Rule evaluation scalable to hundreds of customers without noticeable lag
- Caching considerations for repeated health score calculations
- No layout shift during load or state transitions

### Design Constraints
- Responsive breakpoints: mobile (320px+), tablet (768px+), desktop (1024px+)
- Color coding consistency across health scores (red/yellow/green) and alerts (red/yellow)
- Consistent spacing using Tailwind spacing scale

### File Structure and Naming
- Health calculator module: `lib/healthCalculator.ts`
- Alert engine module: `lib/alerts.ts`
- Health widget component: `components/CustomerHealthDisplay.tsx`
- Alerts widget component: `components/CustomerAlerts.tsx`
- Props interfaces exported from their respective component files (e.g., `CustomerAlertsProps`)
- Follow project naming conventions (PascalCase for components)

### Security Considerations
- Input validation for all customer data and rule parameters in both modules
- No sensitive customer data exposed in alert messages, logs, or client-side output
- Rate limiting on alert generation to prevent system abuse
- Audit trail logging for all triggered alerts and user actions
- Descriptive but non-sensitive error messages on validation failure

## Acceptance Criteria

- [ ] Health score calculated correctly per weighted factors (Payment 40%, Engagement 30%, Contract 20%, Support 10%)
- [ ] Risk levels classified correctly: Healthy (71-100), Warning (31-70), Critical (0-30)
- [ ] All High Priority alert rules trigger correctly per their defined thresholds
- [ ] All Medium Priority alert rules trigger correctly per their defined thresholds
- [ ] Alert engine correctly consumes health score and trend data as rule inputs
- [ ] Duplicate alerts for the same customer/issue are suppressed
- [ ] Cooldown periods prevent repeated alert spam
- [ ] Health and alert widgets update together in real time when the selected customer changes
- [ ] Loading and error states shown consistently across both widgets without crashing
- [ ] No sensitive customer data exposed in alerts, logs, or UI
- [ ] Responsive design works on mobile (320px+), tablet (768px+), and desktop (1024px+)
- [ ] Proper TypeScript interfaces defined, exported, and shared between modules
- [ ] No console errors or warnings
- [ ] Passes TypeScript strict mode checks
- [ ] Follows project code style and conventions

## Integration Architecture

### Component Interaction Diagram

```
CustomerSelector (selection state)
        │
        ▼
  selectedCustomerId
        │
        ├─────────────────────────────┐
        ▼                             ▼
lib/healthCalculator.ts       (customer raw data:
  calculateHealthScore()       payment, engagement,
        │                      contract, support)
        ▼
  HealthScoreResult ───────────────────┐
        │                              │
        ▼                              ▼
CustomerHealthDisplay          lib/alerts.ts
  (score + breakdown UI)         alertEngine()
                                       │
                          ┌────────────┴────────────┐
                          ▼                          ▼
                   Alert[] (High/Medium)     Alert history/audit log
                          │
                          ▼
                  CustomerAlerts widget
              (priority list, detail panel,
               dismiss/action tracking)
```

### Data Flow Description
1. `CustomerSelector` sets the active customer; both the health widget and alerts widget subscribe to this selection.
2. Raw customer data (payment, engagement, contract, support) is passed to `calculateHealthScore`, producing a `HealthScoreResult` (overall score, risk level, per-factor breakdown).
3. `CustomerHealthDisplay` renders the `HealthScoreResult` directly.
4. `lib/alerts.ts` receives the same `HealthScoreResult` plus supplementary trend data (prior score snapshot, ARR, login history, ticket history) and evaluates all rule functions via `alertEngine`.
5. `alertEngine` output (a deduplicated, prioritized `Alert[]`) is rendered by `CustomerAlerts`, and each triggered alert is recorded to the alert history/audit trail.
6. Changing the selected customer re-runs steps 2-5 automatically, keeping both widgets in sync.

### Key Integration Points
- **Health → Alerts data contract**: `HealthScoreResult` (and its historical snapshots) is the primary interface between `lib/healthCalculator.ts` and `lib/alerts.ts`; both modules must agree on this shared TypeScript type.
- **Selection sync**: `CustomerSelector`'s selected-customer state is the single source of truth driving both widgets, preventing desynchronized displays.
- **Trend storage**: score-drop and login-drop rules require access to historical values, so a lightweight customer state/trend store (snapshot cache) sits between the calculator and the alert engine.
- **Alert history**: `CustomerAlerts` reads from and writes to the alert history/audit trail independently of the live rule evaluation path, supporting the historical alerts view.

### Dependencies on Previously Created Specs
- Depends on `specs/health-widget-spec.md` for the `CustomerHealthDisplay` component contract and `lib/healthCalculator.ts` interfaces.
- Depends on `specs/customer-selector-spec.md` for the customer selection state and data flow pattern this feature plugs into.
