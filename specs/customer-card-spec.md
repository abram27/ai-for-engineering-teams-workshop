# Feature: CustomerCard Component

## Context
- Individual customer display component for the Customer Intelligence Dashboard
- Used within the CustomerSelector container component
- Provides at-a-glance customer information for quick identification
- Foundation for domain health monitoring integration

## Requirements

### Functional Requirements
- Display customer name, company name, and health score
- Show customer domains (websites) for health monitoring context
- Display domain count when customer has multiple domains
- Color-coded health indicator based on health score
- Basic responsive design for mobile and desktop
- Clean, card-based visual design with domain information

### User Interface Requirements
- Color-coded health indicators:
  - Red: 0-30 (poor health score)
  - Yellow: 31-70 (moderate health score)
  - Green: 71-100 (good health score)
- Responsive design for mobile and desktop
- Clear typography hierarchy (name > company > health/domains)

### Data Requirements
- Accepts a customer object via props
- Customer interface (`src/data/mock-customers.ts`): `id`, `name`, `company`, `healthScore`, optional `email`, `subscriptionTier`, `domains` array, `createdAt`, `updatedAt`
- `domains` is optional and may contain one or multiple website URLs
- Uses mock data from `src/data/mock-customers.ts`

### Integration Requirements
- Used within CustomerSelector container component
- Props-based data flow from parent component
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
- No layout shift during load

### Design Constraints
- Responsive breakpoints: mobile (320px+), tablet (768px+), desktop (1024px+)
- Consistent spacing using Tailwind spacing scale

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
- [ ] Health score colors match specification: red (0-30), yellow (31-70), green (71-100)
- [ ] Responsive design works on mobile (320px+), tablet (768px+), and desktop (1024px+)
- [ ] Proper TypeScript interfaces defined and exported
- [ ] Component accepts typed props from parent
- [ ] Handles customers with no domains gracefully
- [ ] No console errors or warnings
- [ ] Passes TypeScript strict mode checks
- [ ] Follows project code style and conventions
