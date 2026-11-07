# Boxplot Builder Implementation Plan

> **For agentic workers:** Implement in this checkout, task by task, with a test and review after each task.

**Goal:** Add the four boxplot layouts, five settings dialogs, accurate statistics, and interactive output described in the supplied specification.

**Architecture:** Keep worksheet grouping, filtering, statistics, and SVG rendering in browser-independent modules. Add a dedicated boxplot configuration dialog that launches from Graph Builder; preserve the existing gallery and other graph types. Render generated SVG into the existing result history.

**Tech Stack:** Native ES modules, HTML dialogs, SVG, CSS, Node test runner.

**Spec:** `C:/Users/andrz/Downloads/specyfikacja_interfejsu_box_plot_minitab_style.md`

## Global Constraints

- Four layouts: One Y Simple, One Y With Groups, Multiple Ys Simple, Multiple Ys With Groups.
- One to four grouping columns; five settings dialogs: Scale, Labels, Data View, Multiple Graphs, Data Options.
- Box and outlier hover details, visible bottom actions, and no changes to source worksheet data.

---

### Task 1: Calculation and SVG

**Files:** Create `dist/builder-boxplot.js`; test in `tests/builder-boxplot.test.mjs`.

**Interfaces:** `buildBoxplot(data, options)` returns panel and box statistics; `drawBoxplot(result, options, escape)` returns SVG markup.

- [x] Test quartiles, Tukey whiskers, outliers, grouping, multiple Y, panels, filtering, and log scale.
- [x] Implement grouping and statistics on copies of worksheet values; reject incompatible selections.
- [x] Implement SVG boxes, whiskers, optional layers, labels, reference lines, axes, and tooltip targets.
- [x] Run the focused test file.

### Task 2: Configuration dialog

**Files:** Create `dist/boxplot-builder.js`, `dist/boxplot-builder.css`; modify `dist/index.html`, `dist/app.js`, and `dist/graph-builder.js`.

**Interfaces:** `setupBoxplotBuilder({getData,onCreate,escape})` returns `openBoxplotBuilder()`; Graph Builder's Boxplot choice opens this dialog.

- [x] Add four visual layout tiles before variable selection.
- [x] Add numeric/text column list, Y and grouping selectors, and five setting dialogs.
- [x] Validate selections and enable Generate only when complete.
- [x] Add Cancel and layout-specific Help actions.

### Task 3: Integration and review

**Files:** Modify `README.md`, `CHANGELOG.md`, `package.json`.

- [x] Test each layout and settings through the UI, including hover details and result history.
- [x] Run `npm test`, syntax checks, and `git diff --check`.
- [x] Update semantic version and changelog, then commit and push the finished feature.
