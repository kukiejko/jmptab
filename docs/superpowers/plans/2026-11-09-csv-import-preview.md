# CSV Import Preview Implementation Plan

> **For agentic workers:** Implement in order and verify each behavior before closing the task.

**Goal:** Provide an Excel-style review step before importing CSV or delimited text into jmptab.

**Architecture:** Extend the existing CSV parser with reusable record parsing. A focused import module handles encoding, delimiter detection, headers and preview. The existing Open data command opens one preview dialog for CSV/TXT, then loads into a new worksheet by default or replaces the current one when explicitly selected. XML/XLSX keep their current path.

**Tech Stack:** Browser JavaScript, Node test runner.

**Spec:** User request and [ExcelDemy CSV import guide](https://www.exceldemy.com/learn-excel/import-data/csv-file/), especially file opening, delimiter, headers, data format and destination.

## Global Constraints

- Reuse `Open data`; no duplicate CSV command.
- Keep 1,048,576-row and 16,384-column limits.
- Preserve quoted separators and line breaks and avoid changing the source file.
- Tester tests belong in `tests/tester/`.

---

### Task 1: Configurable parsing

- [x] Expose reusable delimited-record parsing with limits and quoted-field handling.
- [x] Add auto delimiter detection, encoding selection, optional headers and whitespace-sensitive text values.
- [x] Cover comma, semicolon, tab, quoted fields, headerless data and capacity errors.

### Task 2: Preview and worksheet destination

- [x] Add a CSV/TXT preview dialog reached from the existing Open data command.
- [x] Show parsed columns and rows as options change, plus clear validation errors.
- [x] Import to a new worksheet by default; support replacing the active worksheet with confirmation.
- [x] Keep XML/XLSX behavior intact.

### Task 3: Verification

- [x] Run `npm run test:tracked` and `git diff --check`.
- [x] Exercise the preview and import in the browser.

