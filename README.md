# jmptab

A working, independent statistical analysis application inspired by the workflow of Minitab. Not affiliated with Minitab and not a complete replacement for its statistical suite.

## Run locally

Requires Node.js 22 or newer. No dependencies or installation needed.

```powershell
npm start
```

Open http://127.0.0.1:4173. Use Stat or Graph to open an analysis dialog, then select a result in the Navigator to revisit it. Run `npm test` for calculation and import tests.

Use **Open CSV/XML** to import a CSV file or a tabular XML file. Row-based XML uses repeated `<row>`, `<record>`, `<item>`, `<entry>`, or `<observation>` elements with named child elements, named `<field>` elements, or attributes. Repeated elements with another name also work when they have fields. See [row-based XML](examples/measurements.xml). Excel 2003 SpreadsheetML (`Workbook` XML) uses its first worksheet and first row as the column headers; see the [SpreadsheetML example](examples/spreadsheetml.xml). XML with nested field objects or a different schema needs conversion to one of these layouts before import.

Drag the bar beside Navigator or above Worksheet to resize the panes. Drag a column's right-edge grip in the C1/C2 header to change its width, or double-click it to fit the widest header or cell value across all rows. Double-click a pane divider to reset it; arrow keys also work when a grip has focus. Dialogs resize from their lower-right corner. Pane and column sizes are stored in this browser.

## Code layout and testing

- `dist/stats.js`, `dist/inference.js`, `dist/quality.js`, and `dist/time-series.js` contain browser-independent calculations.
- `dist/analysis-execution.js` selects a calculation from worksheet data and plain options. New analyses should be added here and tested through this entry point.
- `dist/analysis-rendering.js` turns calculation results into chart HTML and export text. Its entry point is also browser independent.
- `dist/chart.js` draws SVG charts, while `dist/result-format.js` provides shared HTML escaping and number formatting.
- `dist/layout-resize.js` owns pane and worksheet column resizing, keyboard controls, and browser-local layout settings.
- `dist/column-autofit.js` calculates the smallest width from the header and all worksheet rows, independently of the browser.
- `dist/xml-import.js` maps XML records to worksheet headers and rows. The XML document adapter and record normalization are separate for testing.
- `dist/app.js` reads dialog fields and manages worksheet UI and history. Keep calculations and result formatting in the independent modules so they can be tested without a browser.
- `server.mjs` exports `createRequestHandler` and `createServer`. `tests/server.test.mjs` checks the metadata and static responses without opening a network port.

Run `npm test` after changing calculations or analysis wiring. The Help dialog displays the package version and the local server start time from `/app-info.json`.
See [CHANGELOG.md](CHANGELOG.md) for version history and deployment time semantics.

## Features

- Editable worksheet with named columns and spreadsheet tab/newline paste
- CSV and XML import for up to 1,000,000 data rows and 30 columns, subject to available browser memory; CSV export
- Worksheet navigation in 200-row pages. Enter a page number and select Go to jump directly.
- Descriptive statistics and histogram
- One-sample t confidence intervals and hypothesis tests from a worksheet column or summary statistics
- Pearson correlation with complete-pair exclusion and a scatterplot
- Simple linear regression with fit chart and R-squared
- Individuals control chart using consecutive moving ranges
- P chart for defective counts with fixed subgroup size and an optional target proportion
- Xbar chart for consecutive equal-sized subgroups, with estimated or known process standard deviation
- Capability Cp/Cpk and overall performance Pp/Ppk
- Moving-average time-series forecast with fitted values and mean absolute error
- Single exponential smoothing with configurable weight and starting average
- Result history, text report download, and browser-local worksheet/settings save

Data is processed in the browser. Analysis uses every eligible row. Large regression and process charts display up to 800 points, and large report exports summarize results. Use Export CSV for the full dataset. Saving uses local browser database storage. Result history lasts until reload, while saved sessions restore the worksheet and settings.

## Methods and limits

Standard deviation uses n − 1. Quantiles use linear interpolation at (n − 1)p. Regression excludes missing/non-numeric pairs and uses ordinary least squares with an intercept. Pearson correlation uses the same complete pairs and a two-sided t test for its p-value. Individuals control limits use mean ± 3 × MR-bar / 1.128. Only the outside-limit rule is checked. Control/capability analyses reject missing and nonnumeric observations to preserve sequence order. P charts require whole-number defective counts and a fixed subgroup size; 3-sigma limits are clipped to 0 and 1. Xbar charts use consecutive complete subgroups and an estimated sigma from subgroup standard deviations corrected by c4, unless a known sigma is entered. Capability uses MR-based within sigma for Cp/Cpk and sample standard deviation for Pp/Ppk. It does not test normality or stability. Moving averages use preceding observations for each fitted value and the latest span for the next-period forecast. Single exponential smoothing uses an average of the first k observations as its initial value, with each subsequent smoothed value based on the selected weight. ANOVA, DOE, variable-subgroup charts, and multivariable models remain outside this scope.

References: https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc322.htm and https://www.itl.nist.gov/div898/handbook/ppc/section4/ppc46.htm.
