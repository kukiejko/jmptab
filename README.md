# jmptab

A working, independent statistical analysis application inspired by the workflow of Minitab. Not affiliated with Minitab and not a complete replacement for its statistical suite.

## Run locally

There are two ways to run jmptab:

**With Node.js (development):** Install Node.js 22 or newer, then run:

```powershell
npm start
```

Open http://127.0.0.1:4173. Use Stat or Graph to open an analysis dialog, then select a result in the Navigator to revisit it. Run `npm test` for calculation and import tests.
If port 4173 is in use, run `npm start -- 4174` and open http://127.0.0.1:4174 instead.

**Without Node.js (single file):** Open [standalone/jmptab.html](standalone/jmptab.html) directly in a browser. You can copy just that file to another laptop. To rebuild it after source changes, run `npm install` once and then `npm run build:standalone` on the development machine. The standalone Help menu shows the version and build time embedded in that file; the Node version shows the local server start time. Saved sessions stay in the browser profile and may be separate between the two launch modes.

Choose **Graph → Boxplot** or select Boxplot in Graph Builder. Pick one of four layouts, choose numeric Y columns and up to four categorical grouping columns, then use **Scale**, **Labels**, **Data View**, **Multiple Graphs**, and **Data Options** for axes, annotations, visual layers, paneling, and a temporary row filter. Generate adds the chart to session results. Hover or focus a box for quartiles, IQR, whiskers, and sample size; hover an outlier star for its value.

Choose **Sample data** to generate data for a boxplot, scatterplot, or histogram in a new worksheet. Set the number of points and choose a normal (default), uniform, exponential, or bimodal distribution. Normal samples use mean 0 and sigma 1 by default, with optional outliers; they have no fixed minimum or maximum. Other distributions use numeric ranges, with separate X and Y ranges for scatterplots. Boxplots can use two to eight groups. Optional Value or X/Y units appear in the new worksheet. Generated numeric columns start in Float format, and group columns start in String format. Existing worksheets remain available in their tabs.

The Getting Started workflow adds **descriptive statistics by group** and **One-Way ANOVA** under Stat. ANOVA reports an F test and Tukey pairwise comparisons. Graph Builder can show a normal fit on histograms and color scatterplot points by group. **Graph → Graph Layout** combines existing graphs; **Edit graph** changes a result's title and footnote.

Choose **Xbar-S chart** in Run analysis for subgroup mean and standard deviation charts. A subgroup label column and a stage column are optional. Capability analysis accepts one or two specification limits and can estimate within variation from a subgroup column.

Under **Stat → Design of Experiment → Factorial**, create a randomized two-factor, two-level design in a new worksheet. Enter every run's response, analyze it, view main and interaction effects, and predict at chosen levels. The fitted model is stored with the worksheet and cleared when worksheet data change.

**Data** includes Stack Worksheets, Recode to Text, and Assign Column Formula. Stack aligns columns by name in a new worksheet. Formulas support a column or number on each side of `+`, `-`, `*`, or `/`; date subtraction returns days, and calculated cells refresh after source edits. Column headers show their assigned role and display type. Right-click a column header to choose Date, Time, Timestamp, numeric, currency, text, or a custom number format. Names and optional measurement units are editable in the header row. Display formats preserve the raw values used in analyses. **View → Command Line / History** repeats standard analyses or saves a list of commands as a `.jmt` text file. These commands are specific to jmptab and are not Minitab `.mtb` exec files.

Use **Open data** to import CSV, tab-delimited TXT, XLSX, or tabular XML. Row-based XML uses repeated `<row>`, `<record>`, `<item>`, `<entry>`, or `<observation>` elements with named child elements, named `<field>` elements, or attributes. Repeated elements with another name also work when they have fields. See [row-based XML](examples/measurements.xml). Excel 2003 SpreadsheetML (`Workbook` XML) uses its first worksheet and first row as the column headers; see the [SpreadsheetML example](examples/spreadsheetml.xml). XML with nested field objects or a different schema needs conversion to one of these layouts before import.

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

Run `npm test` after changing calculations or analysis wiring. The Help menu and dialog display the package version and local server start time from `/app-info.json`; the Changes submenu reads recent entries from `CHANGELOG.md`.
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
- Result history, repeatable analysis commands, text report download, and browser-local workbook/settings/history save

Data is processed in the browser. Analysis uses every eligible row. Large regression and process charts display up to 800 points, and large report exports summarize results. Use Export CSV for the full dataset. Saving uses local browser database storage. Saved sessions restore worksheets, formulas, DOE models, analysis settings, and result history.

## Methods and limits

Standard deviation uses n − 1. Quantiles use linear interpolation at (n − 1)p. Regression excludes missing/non-numeric pairs and uses ordinary least squares with an intercept. Pearson correlation uses the same complete pairs and a two-sided t test for its p-value. Individuals control limits use mean ± 3 × MR-bar / 1.128. Only the outside-limit rule is checked. Control/capability analyses reject missing and nonnumeric observations to preserve sequence order. P charts require whole-number defective counts and a fixed subgroup size; 3-sigma limits are clipped to 0 and 1. Xbar charts use consecutive complete subgroups and an estimated sigma from subgroup standard deviations corrected by c4, unless a known sigma is entered. Capability uses MR-based within sigma for Cp/Cpk and sample standard deviation for Pp/Ppk. It does not test normality or stability. Moving averages use preceding observations for each fitted value and the latest span for the next-period forecast. Single exponential smoothing uses an average of the first k observations as its initial value, with each subsequent smoothed value based on the selected weight. One-way ANOVA and balanced two-factor factorial DOE are included; broader DOE families and multivariable models remain outside this scope.

References: https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc322.htm and https://www.itl.nist.gov/div898/handbook/ppc/section4/ppc46.htm.
