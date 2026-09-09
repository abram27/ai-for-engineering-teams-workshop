---
description: Generate a component spec from requirements and save it to specs/
argument-hint: [component-name]
---

/spec - Generate a well-structured specification for a single component

Parameters: component-name (required string, e.g. "CustomerCard")

Behavior:
- Look for a requirements file at `requirements/[component-name].md` (try common
  casings/kebab-case variants of the component name, e.g. `CustomerCard` ->
  `customer-card.md`). If no requirements file is found, say so explicitly and
  generate the spec from reasonable inferred requirements based on the component
  name, sibling specs in `specs/`, and the existing codebase (e.g. mock data
  shapes in `src/data/`) — do not block on the missing file.
- Read any related existing specs in `specs/` (e.g. for parent/sibling
  components) to stay consistent with this project's spec structure and tone.
- Produce a spec with exactly these sections, matching the style of
  `specs/customer-card-spec.md`:
  - `# Feature: [ComponentName] Component`
  - `## Context` — where the component fits, what it's used for/by
  - `## Requirements` — with `### Functional Requirements`,
    `### User Interface Requirements`, `### Data Requirements`, and
    `### Integration Requirements` subsections
  - `## Constraints` — with `### Technical Stack`,
    `### Performance Requirements`, `### Design Constraints`,
    `### File Structure and Naming`, and `### Security Considerations`
    subsections
  - `## Acceptance Criteria` — a checklist (`- [ ]`) of concrete, testable
    criteria derived from the Requirements and Constraints sections above
- Save the result to `specs/[component-name]-spec.md`, using kebab-case for
  the filename (e.g. `HealthIndicator` -> `specs/health-indicator-spec.md`).
- Report back the path written and whether a requirements file was found.

Argument: $ARGUMENTS
