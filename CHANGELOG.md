# Changelog

Versions use `X.Y.Z` format. The local deployment time is recorded when the server starts and appears in Help. It is also available as `deployedAt` from `/app-info.json` in UTC. A source commit alone does not establish that a server has restarted.

## 0.1.16 — 2026-11-06

- Removed the inline row action menu. Right-click a selected row number to insert a row above or below or delete the selected row(s).

## 0.1.15 — 2026-11-06

- Moved column role selection from the worksheet header row to the right-click menu on C1/C2 headers. The menu shows the current role and supports clearing it.

## 0.1.14 — 2026-11-06

- Right-clicking a column header opens Copy column, Sort ascending, and Sort descending. Copy includes the column name and all rows.

## 0.1.13 — 2026-11-06

- Clicking a C1/C2 column header selects the whole column; Shift + click sorts all rows by that column. Column structure actions remain in the ⋯ menu.

## 0.1.12 — 2026-11-06

- Added a worksheet action menu on Shift + left click of a column header or row number. Column actions insert and move columns; row actions insert above or below.

## 0.1.11 — 2026-11-06

- Release prepared: 2026-11-06 01:03:00 CET.
- Deployment time: recorded at local server startup and displayed in Help.
- Added per-column role labels X1, X2, Y1–Y3, and Z1–Z3, saved with each worksheet.
- Added column insertion and left/right movement, plus row insertion above or below a chosen row.

## 0.1.10 — 2026-11-06

- Release prepared: 2026-11-06 00:57:27 CET.
- Deployment time: recorded at local server startup and displayed in Help.
- Added row selection from row numbers with Shift range and Ctrl/Cmd multi-selection.
- Aligned numeric worksheet values left and text values right.

## 0.1.9 — 2026-11-06

- Release prepared: 2026-11-06 00:35:44 CET.
- Deployment time: recorded at local server startup and displayed in Help.
- Moved the Enter direction selector into the row-number header.
- Added ascending and descending whole-row sorting from column headers.

## 0.1.8 — 2026-11-06

- Release prepared: 2026-11-06 00:32:24 CET.
- Deployment time: recorded at local server startup and displayed in Help.
- Added inline worksheet tab renaming by double-click or F2, with unique-name validation.

## 0.1.7 — 2026-11-06

- Release prepared: 2026-11-06 00:27:15 CET.
- Deployment time: recorded at local server startup and displayed in Help.
- Added a worksheet setting for Enter to move down or right, including movement across page boundaries.

## 0.1.6 — 2026-11-06

- Release prepared: 2026-11-06 00:15:29 CET.
- Deployment time: recorded at local server startup and displayed in Help.
- Added worksheet tabs with first, previous, next, last, and new worksheet controls.
- Added a persistent horizontal scroll control for wide worksheets.
- Saved all worksheets and the active tab in local sessions; older saved sessions remain readable.

## 0.1.5 — 2026-11-05

- Release prepared: 2026-11-05 22:43:04 UTC.
- Deployment time: recorded at local server startup and displayed in Help.
- Updated the release version for the XML import build.

## 0.1.4 — 2026-11-05

- Release prepared: 2026-11-05 22:39:23 UTC.
- Deployment time: recorded at local server startup and displayed in Help.
- Added XML worksheet import for row-based records and Excel 2003 SpreadsheetML.
- Added XML mapping tests and sample files for both supported layouts.

## 0.1.3 — 2026-11-05

- Release prepared: 2026-11-05 13:47:33 UTC.
- Deployment time: recorded at local server startup and displayed in Help.
- Double-click a worksheet column resize grip to fit the widest header or cell, including rows on later pages.

## 0.1.2 — 2026-11-05

- Release prepared: 2026-11-05 13:24:42 UTC.
- Deployment time: recorded at local server startup and displayed in Help.
- Added resize controls for the Navigator, Output and Worksheet split, worksheet columns, and dialogs.
- Saved pane and column sizes on this device and improved narrow-screen layout.

## 0.1.1 — 2026-11-05

- Release prepared: 2026-11-05 12:56:48 UTC.
- Deployment time: recorded at local server startup and displayed in Help.
- Added this changelog and a check that its latest version matches `package.json`.

## 0.1.0 — 2026-11-05

- Added worksheet editing, CSV import and export, result history, and saved sessions.
- Added descriptive statistics, inference, regression, quality charts, capability, and time series analyses.
- Added browser-independent analysis and rendering modules with automated tests.
- Added version and local deployment time to Help.
