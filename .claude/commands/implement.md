---
description: Generate a component from a spec file and iteratively refine it against acceptance criteria
argument-hint: [spec-file-path]
---

/implement - Generate a component implementation from a specification and verify it against its acceptance criteria

Parameters: spec-file-path (required string, e.g. "@specs/customer-card-spec.md" or "specs/customer-card-spec.md")

Behavior:
1. Read the specification file at the given path. If it doesn't exist, try
   resolving it under `specs/` (with and without a `-spec.md` suffix) before
   giving up and reporting the problem.
2. Determine the component name from the spec's `# Feature: [ComponentName] Component`
   heading (or the `### File Structure and Naming` section if present).
3. Read related existing components in `src/components/` and shared types in
   `src/data/` to stay consistent with this project's conventions (TypeScript,
   Tailwind, Next.js/React patterns, prop typing style, etc.), even where the
   spec's own "File Structure and Naming" section says `components/` — this
   project's components live in `src/components/`.
4. Generate (or overwrite) the component at `src/components/[ComponentName].tsx`,
   satisfying every subsection under the spec's `## Requirements` and
   `## Constraints` sections:
   - Functional, UI, Data, and Integration requirements
   - Technical stack, performance, design, file/naming, and security constraints
   - Export a typed props interface named `[ComponentName]Props`
5. Verify the implementation against the spec's `## Acceptance Criteria`
   checklist. For each item, check the actual code (not just intent) — props,
   rendered markup, styling/color logic, event handlers, edge cases (e.g.
   missing/empty data), and TypeScript correctness. Run `npx tsc --noEmit` (or
   the project's existing typecheck script) to confirm it compiles under
   strict mode.
6. If any acceptance criterion is not met, refine the component and re-verify.
   Repeat until all criteria pass or you hit a genuine blocker (e.g. the spec
   is ambiguous or contradicts the existing codebase) — in that case, stop and
   explain the blocker rather than guessing indefinitely.
7. Report back:
   - The path written
   - The acceptance criteria checklist with each item marked met/unmet
   - Any deviations from the spec and why

Argument: $ARGUMENTS
