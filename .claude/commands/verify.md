---
description: Verify a component's types, rendering with mock data, and responsive design
argument-hint: [component-file-path]
---

/verify - Check a component for type correctness, rendering with real mock data, and responsive behavior

Parameters: component-file-path (required string, e.g. "components/CustomerCard.tsx" or
"src/components/CustomerCard.tsx"). If the path doesn't exist as given, try resolving it
under `src/components/` (with and without a `.tsx` extension) before giving up and
reporting the problem.

Behavior:

1. **Resolve the target.** Read the component file. Note its exported component name(s)
   and props interface(s).

2. **TypeScript check.**
   - Run `npx tsc --noEmit` (or the project's `type-check` script from `package.json`)
     and isolate any errors that originate from the target file or its direct imports.
   - Confirm the component exports a typed props interface and that prop types are
     consistent with how the component is consumed elsewhere (`grep` for its usages
     in `src/app/` and other components).
   - Flag any use of `any`, missing prop types, or unsafe type assertions.

3. **Render check against mock data.**
   - Read `src/data/mock-customers.ts` (or the relevant mock data file the component
     actually consumes — check the component's imports) to find the real shape and
     representative records (including edge cases: missing/optional fields, empty
     arrays, extreme values).
   - Statically trace the component's logic against 2-3 representative mock records:
     confirm required props are satisfied, conditional rendering branches are covered
     (loading/empty/error states if present), and no field access would throw on
     `undefined`/`null` given the mock data's actual shape.
   - If a dev server is easy to stand up (`npm run dev`) and the component is reachable
     from a page/route, prefer actually rendering it and checking the browser/console
     for errors over static tracing alone. Only do this if it's low-effort; don't block
     verification on standing up a full page harness for a component with no existing
     route.

4. **Responsive design check.**
   - Inspect the component's Tailwind classes for responsive breakpoint variants
     (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`) and flag any layout-critical properties
     (width, grid/flex direction, visibility, font size) that lack breakpoint handling
     where the spec (if one exists in `specs/`) calls for responsive behavior.
   - If a dev server is running or easily started, load the component in a browser and
     check it at common breakpoints (375px mobile, 768px tablet, 1280px desktop) for
     overflow, unreadable text, or broken layout. If no page/route renders this
     component in isolation, note that and fall back to static class inspection.

5. **Report a pass/fail summary:**
   - Overall verdict: PASS or FAIL
   - TypeScript: pass/fail + specific errors
   - Mock data rendering: pass/fail + specific records/fields that broke or were
     unhandled
   - Responsive design: pass/fail + specific breakpoints/classes missing or broken
   - If FAIL on any dimension, list concrete file:line references and the minimal fix
     needed — but do not apply fixes unless asked.

Argument: $ARGUMENTS
