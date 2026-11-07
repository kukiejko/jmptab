# jmptab

A working, independent statistical analysis application inspired by the workflow of Minitab. Not affiliated with Minitab and not a complete replacement for its statistical suite.

## Run locally

Requires Node.js 22 or newer. No dependencies or installation needed.

```powershell
npm start
```

Open http://127.0.0.1:4173. Use Stat or Graph to open an analysis dialog, then select a result in the Navigator to revisit it. Run `npm test` for calculation and import tests.

Choose **Graph → Boxplot** or select Boxplot in Graph Builder. Pick one of four layouts, choose numeric Y columns and up to four categorical grouping columns, then use **Scale**, **Labels**, **Data View**, **Multiple Graphs**, and **Data Options** for axes, annotations, visual layers, paneling, and a temporary row filter. Generate adds the chart to session results. Hover or focus a box for quartiles, IQR, whiskers, and sample size; hover an outlier star for its value.

Choose **Sample data** to generate data for a boxplot, scatterplot, or histogram in a new worksheet. Set the number of points and numeric range; scatterplots have separate X and Y ranges, and boxplots can use two to eight groups. Choose a normal (default), uniform, exponential, or bimodal distribution. Normal samples default to mean 0 and sigma 1, with an optional outlier percentage. Values are bounded by the chosen range, so a narrow range can clip the distribution and outliers. Existing worksheets remain available in their tabs.

Use **Open CSV/XML** to import a CSV file or a tabular XML file. Row-based XML uses repeated `<row>`, `<record>`, `<item>`, `<entry>`, or `<observation>` elements with named child elements, named `<field>` elements, or attributes. Repeated elements with another name also work when they have fields. See [row-based XML](examples/measurements.xml). Excel 2003 SpreadsheetML (`Workbook` XML) uses its first worksheet and first row as the column headers; see the [SpreadsheetML example](examples/spreadsheetml.xml). XML with nested field objects or a different schema needs conversion to one of these layouts before import.

Drag the bar beside Navigator or above Worksheet to resize the panes. Drag a column's right-edge grip in the C1/C2 header to change its width, or double-click it to fit the widest header or cell value across all rows. Double-click a pane divider to reset it; arrow keys also work when a grip has focus. Dialogs resize from their lower-right corner. Pane and column sizes are stored in this browser.

Use **+** beside the worksheet tabs to add a blank worksheet. The first, previous, next, and last buttons switch between worksheets. The bar below the tabs scrolls wide worksheets horizontally. Save session stores every worksheet and the active tab; Export CSV exports the active worksheet.
Double-click a worksheet tab or focus it and press F2 to rename it. Press Enter to save the name or Escape to cancel.

Choose the down or right arrow in the **#** header to control where Enter moves next. The choice is stored in this browser. Click a C1/C2 column header to select the whole column. Shift + click the header to sort all rows by that column; repeat to reverse the order.

Right-click a C1/C2 column header for **Copy column**, sorting, inserting, moving, deleting, and column roles. Copy puts the column name and every value, including blank rows, on the clipboard.
Click a row number to select its entire row. Hold Shift to select a range, or Ctrl/Cmd to add or remove individual rows. Numeric cells align left; text cells align right.
Use the **Role** submenu in the column right-click menu to label it X1, X2, Y1, Y2, Y3, Z1, Z2, Z3, or G (group), or clear the label. Roles are stored with each worksheet and do not alter its cell values.
Right-click a column header to insert a column on either side, move it left or right, or delete it. Right-click a selected row number to insert above or below it or delete the selected row(s). **+ Column** and **+ Row** still append at the end.

## Code layout and testing

- `dist/stats.js`, `dist/inference.js`, `dist/quality.js`, and `dist/time-series.js` contain browser-independent calculations.
- `dist/analysis-execution.js` selects a calculation from worksheet data and plain options. New analyses should be added here and tested through this entry point.
- `dist/builder-boxplot.js` groups and filters worksheet observations, calculates box statistics, and draws boxplots independently of the browser UI. `dist/boxplot-builder.js` owns the dedicated configuration dialog.
- `dist/sample-data.js` generates repeatable sample worksheets from validated settings; `dist/sample-data-dialog.js` owns the form.
- `dist/sample-worksheet.js` adds generated data as a new worksheet without changing existing sheets.
- `dist/analysis-rendering.js` turns calculation results into chart HTML and export text. Its entry point is also browser independent.
- `dist/chart.js` draws SVG charts, while `dist/result-format.js` provides shared HTML escaping and number formatting.
- `dist/layout-resize.js` owns pane and worksheet column resizing, keyboard controls, and browser-local layout settings.
- `dist/column-autofit.js` calculates the smallest width from the header and all worksheet rows, independently of the browser.
- `dist/xml-import.js` maps XML records to worksheet headers and rows. The XML document adapter and record normalization are separate for testing.
- `dist/workbook.js` creates and validates worksheets. `dist/session.js` stores each worksheet in chunks and reads sessions created before workbook support.
- `dist/app.js` reads dialog fields and manages worksheet UI and history. Keep calculations and result formatting in the independent modules so they can be tested without a browser.
- `server.mjs` exports `createRequestHandler` and `createServer`. `tests/server.test.mjs` checks the metadata and static responses without opening a network port.

Run `npm test` after changing calculations or analysis wiring. The Help dialog displays the package version and the local server start time from `/app-info.json`.
See [CHANGELOG.md](CHANGELOG.md) for version history and deployment time semantics.
For development tasks, approvals, pause control and tracked test progress, see [Development setup](docs/DEVELOPMENT_SETUP.md). Run `npm run devboard` to open the local dashboard on port 8765.

## Features

- Editable worksheet with named columns and spreadsheet tab/newline paste
- Multiple worksheets with tab navigation and horizontal scrolling
- Up to 1,048,576 rows and 16,384 columns per worksheet, subject to available browser memory and storage. Wide worksheets show 40 columns at a time; use the horizontal control to move across the sheet. CSV and XML import and CSV export use the same limits.
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
