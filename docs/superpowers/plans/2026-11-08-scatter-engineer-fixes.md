# Scatterplot Engineer Findings Implementation Plan

> **For agentic workers:** Implement the tasks below in order and verify each behavior before release.

**Goal:** Make large-data scatterplot zoom trustworthy, preserve honest measurement units, and export presentation-ready SVGs.

**Architecture:** Keep worksheet rows as the source of truth. Store only column references with each scatter result, then scan eligible rows inside the selected X/Y domain and choose at most 800 representative displayed points. Use one axis-label helper and one SVG export helper so graph entry points stay consistent.

**Tech Stack:** Browser JavaScript, SVG, Node test runner.

**Spec:** Process-control engineer review recorded in `docs/DEVELOPMENT_SETUP.md` and the user's 2026-11-08 request.

## Global Constraints

- Tester-owned regression tests belong under `tests/tester/`.
- Existing graph, analysis, and Sample data entry points must share the same zoom behavior.
- Do not duplicate full million-row worksheets in result HTML or session history.

---

### Task 1: Zoom sampling from the source worksheet

**Files:** `dist/graph-builder.js`, `dist/app.js`, `dist/chart-interactions.js`, `dist/plot-settings.js`, `tests/tester/`.

- [x] Keep scatter source column references in graph and analysis results.
- [x] Scan all valid rows in the selected X/Y domain and choose at most 800 evenly spread points.
- [x] Use this resampling for rectangle zoom, manual fixed bounds, and reset.
- [x] Verify a point absent from the initial sample appears after zooming into its region.

### Task 2: Honest units

**Files:** `dist/axis-label.js`, `tests/tester/`.

- [x] Show a worksheet's unit when entered.
- [x] Omit the unit suffix when real data has no unit; retain `a.u.` on generated samples because it is stored in their worksheet metadata.
- [x] Verify date and UTC timestamp axis labels remain clear.

### Task 3: Presentation SVG context

**Files:** `dist/result-legends.js`, `dist/app.js`, `tests/tester/`.

- [x] Include a visible title, worksheet name, observation count, and legend in exported SVG.
- [x] Preserve chart contents and current fixed X/Y ranges.
- [ ] Verify the XML parses and the metadata remains readable in a live browser export.

### Verification

- [x] Run `npm run test:tracked` and `git diff --check`.
- [ ] Review a representative scatterplot and SVG export in the browser if the live session is available.
