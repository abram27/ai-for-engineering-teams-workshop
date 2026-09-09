# Feature: CustomerHealthDisplay Widget

## Context
- Health scoring widget for the Customer Intelligence Dashboard
- Displays predictive customer relationship health and churn risk
- Consumes scores produced by the health score calculator (`lib/healthCalculator.ts`)
- Integrates with CustomerSelector for real-time updates as customer selection changes

## Requirements

### Functional Requirements
- Display overall customer health score (0-100) with color-coded visualization
- Expandable breakdown showing individual factor scores: payment, engagement, contract, support
- Weighted factors: Payment (40%), Engagement (30%), Contract (20%), Support (10%)
- Risk level classification and label: Healthy (71-100), Warning (31-70), Critical (0-30)
- Loading state while health score data is being fetched/calculated
- Error state when health score data is unavailable or invalid
- Real-time score updates when the selected customer changes

### User Interface Requirements
- Color-coded health indicators consistent with other dashboard widgets:
  - Red: 0-30 (critical)
  - Yellow: 31-70 (warning)
  - Green: 71-100 (healthy)
- Collapsed view shows overall score; expanded view reveals per-factor breakdown
- Loading and error states visually consistent with other dashboard widgets
- Responsive design for mobile and desktop

### Data Requirements
- Consumes output of `calculateHealthScore` from `lib/healthCalculator.ts`
- Input data categories: payment history (days since last payment, average payment delay, overdue amounts), engagement metrics (login frequency, feature usage count, support tickets), contract information (days until renewal, contract value, recent upgrades), support data (average resolution time, satisfaction scores, escalation counts)
- TypeScript interfaces for health score result and per-factor breakdown
- Handles missing or incomplete input data without crashing

### Integration Requirements
- Used within / alongside CustomerSelector container component
- Props-based data flow from parent component
- Updates automatically when the selected customer changes
- Properly typed TypeScript interfaces shared with `lib/healthCalculator.ts`

## Constraints

### Technical Stack
- Next.js 15 (App Router)
- React 19
- TypeScript with strict mode
- Tailwind CSS for styling

### Performance Requirements
- Efficient calculation and rendering suitable for real-time dashboard updates
- Minimal computational overhead for dashboard responsiveness
- No layout shift during load or state transitions

### Design Constraints
- Responsive breakpoints: mobile (320px+), tablet (768px+), desktop (1024px+)
- Consistent spacing using Tailwind spacing scale
- Color coding consistency with CustomerCard and other dashboard health indicators

### File Structure and Naming
- Component file: `components/CustomerHealthDisplay.tsx`
- Calculator module: `lib/healthCalculator.ts`
- Props interface: `CustomerHealthDisplayProps` exported from component file
- Follow project naming conventions (PascalCase for components)

### Security Considerations
- No sensitive customer data exposed in client-side logs
- Proper TypeScript types to prevent data injection
- Descriptive but non-sensitive error messages on validation failure

## Acceptance Criteria

- [ ] Displays overall health score with correct color coding: red (0-30), yellow (31-70), green (71-100)
- [ ] Expandable breakdown shows payment, engagement, contract, and support factor scores
- [ ] Weighted overall score matches specification (Payment 40%, Engagement 30%, Contract 20%, Support 10%)
- [ ] Shows loading state while data is pending
- [ ] Shows error state when data is missing or invalid, without crashing
- [ ] Updates in real time when the selected customer changes
- [ ] Responsive design works on mobile (320px+), tablet (768px+), and desktop (1024px+)
- [ ] Proper TypeScript interfaces defined and exported
- [ ] No console errors or warnings
- [ ] Passes TypeScript strict mode checks
- [ ] Follows project code style and conventions
