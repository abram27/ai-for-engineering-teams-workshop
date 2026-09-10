---
name: dashboard-components
description: Conventions for the Customer Intelligence Dashboard's React/Next.js UI. Use whenever creating or modifying dashboard components, health score displays, or customer data UI (e.g. CustomerCard, CustomerHealthDisplay, CustomerSelector, or any new components/*.tsx file).
---

# Dashboard Components

Conventions for building UI in the Customer Intelligence Dashboard.

## Stack

- React 19 + TypeScript. Components are typed function components with an exported `ComponentNameProps` interface.
- Tailwind CSS for all styling — no CSS modules, styled-components, or inline `style` props.
- Next.js App Router. Default to Server Components; add `'use client'` as the first line of the file only when the component needs state, effects, event handlers, or other browser-only APIs.

## File location

- Components live at `components/[ComponentName].tsx`, one component per file, named export as `default`.
- Component name in PascalCase, matching the file name exactly.

## Health score colors

Health scores are 0-100. Use these bands consistently everywhere a score renders as a badge, border, or background:

| Range  | Meaning | Tailwind classes                              |
|--------|---------|------------------------------------------------|
| 0-40   | Red     | `bg-red-100 text-red-800 border-red-300`       |
| 41-70  | Yellow  | `bg-yellow-100 text-yellow-800 border-yellow-300` |
| 71-100 | Green   | `bg-green-100 text-green-800 border-green-300` |

Implement this as a small helper, e.g.:

```ts
function getHealthColorClasses(score: number): string {
  if (score <= 40) return 'bg-red-100 text-red-800 border-red-300';
  if (score <= 70) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  return 'bg-green-100 text-green-800 border-green-300';
}
```

## Layout conventions

- Root element: `w-full rounded-lg border p-4 shadow-sm sm:p-5`, with the health color classes applied to the root when the component centers on a health score.
- Header row: `flex items-start justify-between gap-3` with a truncating title (`truncate text-base font-semibold text-gray-900 sm:text-lg`) and a pill-style badge on the right (`shrink-0 rounded-full border border-current px-2.5 py-1 text-xs font-medium`).
- Secondary content section separated with `mt-3 border-t border-current/20 pt-3`.
- Handle loading and error states explicitly with dedicated small components (e.g. `LoadingState`, `ErrorState`) rather than inline conditionals scattered through JSX.
