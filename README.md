# mtab

A working, independent statistical analysis application inspired by the workflow of Minitab. Not affiliated with Minitab and not a complete replacement for its statistical suite.

## Run locally

Requires Node.js 22 or newer. No dependencies or installation needed.

```powershell
npm start
```

Open http://127.0.0.1:4173. Use Stat or Graph to open an analysis dialog, then select a result in the Navigator to revisit it. Run `npm test` for calculation and CSV tests.

## Features

- Editable worksheet with named columns and spreadsheet tab/newline paste
- CSV import and export for up to 1,000,000 data rows and 30 columns, subject to available browser memory
- Worksheet navigation in 200-row pages. Enter a page number and select Go to jump directly.
- Descriptive statistics and histogram
- Simple linear regression with fit chart and R-squared
- Individuals control chart using consecutive moving ranges
- Capability Cp/Cpk and overall performance Pp/Ppk
- Result history, text report download, and browser-local worksheet/settings save

Data is processed in the browser. Analysis uses every eligible row. Large regression and process charts display up to 800 points, and large report exports summarize results. Use Export CSV for the full dataset. Saving uses local browser database storage. Result history lasts until reload, while saved sessions restore the worksheet and settings.

## Methods and limits

Standard deviation uses n − 1. Quantiles use linear interpolation at (n − 1)p. Regression excludes missing/non-numeric pairs and uses ordinary least squares with an intercept. Individuals control limits use mean ± 3 × MR-bar / 1.128. Only the outside-limit rule is checked. Control/capability analyses reject missing and nonnumeric observations to preserve sequence order. Capability uses MR-based within sigma for Cp/Cpk and sample standard deviation for Pp/Ppk. It does not test normality or stability. No inferential tests, ANOVA, DOE, subgroup charts, or multivariable models are included in this initial scope.

References: https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc322.htm and https://www.itl.nist.gov/div898/handbook/ppc/section4/ppc46.htm.
