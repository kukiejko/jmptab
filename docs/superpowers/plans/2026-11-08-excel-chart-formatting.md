# Excel-like Chart Formatting Implementation Plan

> **For agentic workers:** Implement these tasks in order. Keep each change testable and reuse jmptab's existing Plot settings dialog.

**Goal:** Let users adjust common chart elements on an existing graph using one coherent settings panel.

**Architecture:** Store per-chart display choices on the SVG and apply them through a shared formatter. Preserve them when scatterplots redraw for zoom or fixed scales. Keep the current graph title editor, legend generator and SVG export as the single sources for those features.

**Tech Stack:** Browser JavaScript, SVG, CSS, Node test runner.

**Spec:** `C:/Users/andrz/Downloads/65b77ed42104f6788b2202b1_Excel Advanced Chart Formatting (1).pdf` (pages 1–7), scoped to elements that jmptab's existing chart types support.

## Global Constraints

- Do not add another chart-formatting entry point alongside Plot settings.
- Keep chart styling in exported SVG and saved session results.
- Tester regression tests belong under `tests/tester/`.
- Preserve numerical results and source worksheet data.

---

### Task 1: Shared chart element formatter

**Files:** `dist/chart-formatting.js`, `dist/chart.js`, `dist/result-legends.js`.

- [x] Mark axes, gridlines and data marks in the common SVG renderer.
- [x] Apply axis and axis title visibility, gridline visibility, data labels and legend visibility through one formatter.
- [x] Preserve settings during redraw and respect them in exported SVG.

### Task 2: Extend existing Plot settings dialog

**Files:** `dist/index.html`, `dist/app.js`, `dist/style.css`, `dist/chart-interactions.js`, `dist/plot-settings.js`.

- [x] Add chart element controls to the current dialog and initialize them from the selected chart.
- [x] Apply choices to an existing graph and persist them in result history.
- [x] Retain choices after scatter zoom, fixed scale changes and reset.

### Task 3: Regression checks

**Files:** `tests/tester/chart-formatting.test.mjs`.

- [x] Verify chart element markers and option normalization.
- [x] Run `npm run test:tracked`, `git diff --check`, and inspect a graph in browser.
