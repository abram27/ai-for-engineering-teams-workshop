# Feature: CustomerCard Component

## Context
- Individual customer display component for the Customer Intelligence Dashboard
- Used within the CustomerSelector container component
- Provides at-a-glance customer information for quick identification
- Foundation for domain health monitoring integration
- Also serves as the selectable unit within CustomerSelector, allowing a user to pick a single customer for detailed views (e.g. `CustomerHealthDisplay`)

## Requirements

### Functional Requirements
- Display customer name, company name, and health score
- Show customer domains (websites) for health monitoring context
- Display domain count when customer has multiple domains
- Color-coded health indicator based on health score
- Clickable to select/deselect the customer
- Support only single selection at a time (selection state owned by parent/container)
- Pass selection events up to the parent component via a callback prop
- Basic responsive design for mobile and desktop
- Clean, card-based visual design with domain information

### User Interface Requirements
- Color-coded health indicator applied to the full card background/border (not just a badge):
  - Red: 0-30 (poor health score)
  - Yellow: 31-70 (moderate health score)
  - Green: 71-100 (good health score)
- Health score badge and text use the current health color for contrast against the tinted background
- Visual indication when the customer is selected (e.g. border highlight, background/ring change) that remains distinguishable alongside the health color
- Responsive design for mobile and desktop
- Clear typography hierarchy (name > company > health/domains)

### Data Requirements
- Accepts a customer object via props
- Customer interface (`src/data/mock-customers.ts`): `id`, `name`, `company`, `healthScore`, optional `email`, `subscriptionTier`, `domains` array, `createdAt`, `updatedAt`
- `domains` is optional and may contain one or multiple website URLs
- Uses mock data from `src/data/mock-customers.ts`
- Accepts an `isSelected` boolean prop reflecting current selection state (controlled by parent)

### Integration Requirements
- Used within CustomerSelector container component
- Props-based data flow from parent component
- Selection state is controlled by the parent (CustomerCard does not manage selection internally beyond emitting the click)
- Emits an `onSelect(customerId)` (or equivalent) callback so the parent can update which customer is selected
- Properly typed TypeScript interfaces

## Constraints

### Technical Stack
- Next.js 15 (App Router)
- React 19
- TypeScript with strict mode
- Tailwind CSS for styling

### Performance Requirements
- Fast rendering (< 16ms per card for 60fps)
- Efficient re-renders (React.memo if needed)
- No layout shift during load or selection state changes

### Design Constraints
- Responsive breakpoints: mobile (320px+), tablet (768px+), desktop (1024px+)
- Consistent spacing using the Tailwind spacing scale
- Selection styling must remain visually distinct from, and not conflict with, health-score color coding

### File Structure and Naming
- Component file: `components/CustomerCard.tsx`
- Props interface: `CustomerCardProps` exported from component file
- Follow project naming conventions (PascalCase for components)

### Security Considerations
- Sanitize customer name, company, and domain displays (XSS prevention)
- No sensitive customer data exposed in client-side logs
- Proper TypeScript types to prevent data injection

## Acceptance Criteria

- [ ] Displays customer name, company name, and health score correctly
- [ ] Shows customer domains with proper count when multiple domains exist
- [ ] Card background/border reflects health score color: red (0-30), yellow (31-70), green (71-100)
- [ ] Clicking the card triggers a selection callback with the customer's id
- [ ] Selected state is visually distinguishable (e.g. border/ring or background change) independent of health color
- [ ] Only one customer can be shown as selected at a time (enforced by parent state, reflected via `isSelected` prop)
- [ ] Existing health score display and styling continue to work unchanged after adding selection
- [ ] Responsive design works on mobile (320px+), tablet (768px+), and desktop (1024px+)
- [ ] Proper TypeScript interfaces defined and exported
- [ ] Component accepts typed props from parent
- [ ] Handles customers with no domains gracefully
- [ ] No console errors or warnings
- [ ] Passes TypeScript strict mode checks
- [ ] Follows project code style and conventions
