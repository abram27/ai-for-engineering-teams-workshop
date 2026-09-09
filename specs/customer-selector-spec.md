# Feature: CustomerSelector Component

## Context
- Main customer selection interface for the Customer Intelligence Dashboard
- Users need to quickly find and select customers
- Must handle 100+ customers efficiently
- Container component that renders CustomerCard for each customer

## Requirements

### Functional Requirements
- Display customer cards showing name, company, and health score
- Search/filter customers by name or company
- Visual selection state that highlights the selected customer
- Persist selection across page interactions
- Efficiently render and filter lists of 100+ customers

### User Interface Requirements
- Search input for filtering by name or company, updating results as the user types
- Clear visual indication of the currently selected customer card
- Responsive grid/list layout for customer cards
- Empty state when no customers match the search filter

### Data Requirements
- Uses mock data from `src/data/mock-customers.ts`
- Customer interface: `id`, `name`, `company`, `healthScore`, optional `email`, `subscriptionTier`, `domains`, `createdAt`, `updatedAt`
- Filtering performed on `name` and `company` fields (case-insensitive)

### Integration Requirements
- Renders CustomerCard for each visible customer
- Passes selected customer state to sibling/child components (e.g., CustomerHealthDisplay) as needed
- Properly typed TypeScript interfaces shared with CustomerCard

## Constraints

### Technical Stack
- Next.js 15 (App Router)
- React 19
- TypeScript with strict mode
- Tailwind CSS for styling

### Performance Requirements
- Efficient filtering and rendering for 100+ customers without noticeable lag
- Avoid unnecessary re-renders of unaffected CustomerCard instances
- No layout shift during search/filter updates

### Design Constraints
- Responsive breakpoints: mobile (320px+), tablet (768px+), desktop (1024px+)
- Consistent spacing using Tailwind spacing scale

### File Structure and Naming
- Component file: `components/CustomerSelector.tsx`
- Props interface: `CustomerSelectorProps` exported from component file
- Follow project naming conventions (PascalCase for components)

### Security Considerations
- Sanitize search input before using in filter logic
- No sensitive customer data exposed in client-side logs
- Proper TypeScript types to prevent data injection

## Acceptance Criteria

- [ ] Displays customer cards with name, company, and health score
- [ ] Search filters customers by name or company in real time
- [ ] Selected customer is visually highlighted
- [ ] Selection persists across subsequent page interactions
- [ ] Handles 100+ customers without noticeable performance issues
- [ ] Shows an empty state when no customers match the search
- [ ] Responsive design works on mobile (320px+), tablet (768px+), and desktop (1024px+)
- [ ] Proper TypeScript interfaces defined and exported
- [ ] No console errors or warnings
- [ ] Passes TypeScript strict mode checks
- [ ] Follows project code style and conventions
