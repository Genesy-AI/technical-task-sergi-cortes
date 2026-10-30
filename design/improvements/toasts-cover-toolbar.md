# Stacked toasts cover the leads toolbar

- **Related change:** [enrich-lead-phone](../../openspec/changes/enrich-lead-phone/design.md)
- **Found:** 2026-10-30, during the phone enrichment end-to-end run

## Problem

The `Toaster` in `frontend/src/Providers.tsx` sits at the top right, 20 pixels from the edge.
One toast fits above the toolbar, but a second one stacks over the Enrich and Delete buttons for up to five seconds.
Email verification can raise a success and an error toast together, and so can any future action that reports several outcomes.

## Proposed improvement

Move the toaster to the bottom of the screen, or offset it below the page header, and check that it does not collide with the React Query Devtools button in development.
Until then, actions should report their outcomes in one toast, as phone enrichment now does.

## Why it is needed

Covering the primary controls right after an action blocks the next action and looks broken.
