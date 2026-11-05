# Minitab-Inspired Workflows Implementation Plan

**Goal:** Expand jmptab into a browser-local statistical workbench, one verifiable workflow at a time.

**Architecture:** Keep statistical calculations in pure JavaScript modules. Connect each analysis to the existing worksheet, dialog, Navigator, and report export. Preserve worksheet identity and revision in results as multi-worksheet support is introduced.

**Tech stack:** Dependency-free HTML, CSS, JavaScript, SVG, IndexedDB, and the Node.js test runner.

**Scope:** [Product brief](../../../../PRODUCT.md) and [Minitab Help and How-To](https://support.minitab.com/en-us/minitab/help-and-how-to/). This is a release roadmap. The review covers all ten section overviews and selected workflow pages.

## Global constraints

- Keep worksheet data and computation local to the browser.
- Preserve loading of existing saved worksheets when changing the session schema.
- Compute from every eligible row. Label any sampling used for rendering.
- Give each analysis original help text covering inputs, assumptions, an example, output interpretation, and a methods reference.

## Workflow inventory

| Help area | jmptab today | Candidate increment |
| --- | --- | --- |
| [Environment](https://support.minitab.com/en-us/minitab/help-and-how-to/minitab-environment/) | One worksheet, Navigator, saved session | Named worksheets and worksheet-linked results |
| [Data input and output](https://support.minitab.com/en-us/minitab/help-and-how-to/data-input-and-output/) | CSV, paste, report download | Import preview and portable project save/open |
| [Data manipulation](https://support.minitab.com/en-us/minitab/help-and-how-to/manipulate-data-in-worksheets-columns-and-rows/) | Cell editing | Whole-row sort, filter/subset, stack and unstack |
| [Calculations](https://support.minitab.com/en-us/minitab/help-and-how-to/calculations-data-generation-and-matrices/) | Analysis-specific calculations | Derived columns and sequences, then matrix operations |
| [Probability and resampling](https://support.minitab.com/en-us/minitab/help-and-how-to/probability-distributions-random-data-and-resampling-analyses/) | No dedicated workflow | Student t distribution functions, seeded sampling, then bootstrap |
| [Statistics](https://support.minitab.com/en-us/minitab/help-and-how-to/statistics/) | Descriptive statistics | One-sample, paired and independent t tests, correlation, then tables and proportions |
| [Graphs](https://support.minitab.com/en-us/minitab/help-and-how-to/graphs/) | Graph Builder with histogram and scatterplot among its options | Audit chart coverage, then add grouped plots and time-ordered views where missing |
| [Quality and process improvement](https://support.minitab.com/en-us/minitab/help-and-how-to/quality-and-process-improvement/) | Individuals chart and Cp/Cpk/Pp/Ppk | Moving-range panel, capability histogram, then subgroup charts and measurement studies |
| [Statistical modeling](https://support.minitab.com/en-us/minitab/help-and-how-to/statistical-modeling/) | Simple least-squares fit | Residual diagnostics, one-way ANOVA, then multiple regression |
| [Modules](https://support.minitab.com/en-us/minitab/help-and-how-to/modules/) | No industry modules | Assess KPI workflows once their underlying analyses exist |

## Release sequence

### 1. One-sample t

- [ ] Add a pure calculation in `dist/inference.js` with summary inputs `n`, `mean`, and `sd`, plus confidence level, alternative, and optional null mean. Return standard error, degrees of freedom, confidence bounds, and test statistic and p-value when requested. Validate finite inputs, integer sample size of at least two, positive standard deviation, and confidence level strictly between 0 and 100%.
- [ ] Add the analysis to `dist/index.html` and `dist/app.js`. Offer worksheet-column and summarized-data modes. Report analyzed and excluded counts for worksheet input. Use the same result for the Navigator and report download. Default to 95% and a two-sided alternative.
- [ ] Verify numerical output in `tests/inference.test.mjs`. For observations 1, 2, 3, 4, 5 and null mean 3, expect mean 3, df 4, t 0, p 1 and a 95% interval of approximately [1.03676, 4.96324]. Check summary/worksheet agreement, one-sided tails, interval-only mode and invalid inputs. Run `npm.cmd test` and submit both input modes in the browser.
- [ ] Add contextual help that explains when observations should be independent and what the confidence interval and p-value describe. Compare inputs and formulas with the reference pages.

[Input modes](https://support.minitab.com/en-us/minitab/help-and-how-to/statistics/basic-statistics/how-to/1-sample-t/perform-the-analysis/enter-your-data/) · [Methods and formulas](https://support.minitab.com/en-us/minitab/help-and-how-to/statistics/basic-statistics/how-to/1-sample-t/methods-and-formulas/methods-and-formulas/)

### 2. Process monitoring and capability

- [ ] Extend the existing control calculation in `dist/stats.js` with a moving-range series aligned to the later observation of each pair. Render the I and MR panels together in `dist/app.js`. Verify the original I results and the new MR limits against independent reference fixtures.
- [ ] Add the capability histogram with specification limits and within/overall normal curves. Keep observed out-of-spec counts distinct from modeled probabilities. Verify chart scale and values for a fixture with distinct within and overall variation.

[I-MR](https://support.minitab.com/en-us/minitab/help-and-how-to/quality-and-process-improvement/control-charts/how-to/variables-charts-for-individuals/i-mr-chart/before-you-start/overview/) · [Normal capability graphs](https://support.minitab.com/en-us/minitab/help-and-how-to/quality-and-process-improvement/capability-analysis/how-to/capability-analysis/normal-capability-analysis/interpret-the-results/all-statistics-and-graphs/graphs/)

### 3. Worksheets and grouped workflows

- [ ] Update `dist/session.js` and `dist/app.js` to load a legacy worksheet as the first worksheet of a project. Bind analyses and CSV exports to the active worksheet. Verify two worksheets with the same column names remain distinguishable in the Navigator after edits and a save/reload.
- [ ] Add row sort, subset and stack/unstack operations. Verify sort preserves row associations, subsets preserve source rows, and stack/unstack preserves group labels and handles unequal group sizes.

[Worksheets](https://support.minitab.com/en-us/minitab/help-and-how-to/minitab-environment/interface/interface-components/worksheets/) · [Stacked and unstacked data](https://support.minitab.com/en-us/minitab/help-and-how-to/manipulate-data-in-worksheets-columns-and-rows/supporting-topics/data-types-and-arrangements/stacked-and-unstacked-data/)

### 4. Modeling and broader coverage

- [ ] Add residual-versus-fit and residual-versus-order plots to the existing fit. Verify residuals preserve their source row numbers when rows with missing predictor/response pairs are excluded.
- [ ] Add one-way ANOVA for a numeric response and a categorical factor. Validate group counts and error degrees of freedom, and compare the ANOVA table against an independent fixture. Specify Welch ANOVA and post-hoc comparisons as separate increments.
- [ ] Use the inventory to scope subsequent releases for probability and resampling, subgroup and attribute charts, Gage R&R, DOE, time series, reliability, multivariate methods and industry modules.

[Regression and ANOVA diagnostics](https://support.minitab.com/en-us/minitab/help-and-how-to/statistical-modeling/regression/supporting-topics/model-assumptions/validate-model-assumptions/) · [ANOVA overview](https://support.minitab.com/en-us/minitab/help-and-how-to/statistical-modeling/anova/supporting-topics/basics/what-is-anova/)

## 2009 manual coverage

The supplied 302-page *MINITAB Manual* by Michael Evans has a data-management part and 18 data-analysis chapters. It describes an older version of Minitab. Use its analysis definitions and examples to guide independent jmptab workflows. The user's requested order is quality and time series, data exploration, regression and ANOVA, then inference.

| Order | Manual topics | Current coverage | Next independently testable increment |
| --- | --- | --- | --- |
| 1 | Chapter 17, quality and control | Individuals chart, capability indices, P chart, Xbar chart | S chart and configurable signal tests |
| 1 | Chapter 18, time series | Moving average and single exponential smoothing with next-period forecasts | Trend and seasonality, then AR(1) |
| 2 | Part I, worksheet data entry, editing, mathematical operations, sorting and ranks | Single editable worksheet, CSV and paste | Whole-row sorting and rank columns, then computed columns and multi-worksheet projects |
| 2 | Chapters 1–2, summaries, plots, normal distribution, relationships | Descriptive statistics, histogram, scatterplot, Pearson correlation and simple regression | Boxplots, bar charts, distribution functions, and normal probability plots |
| 3 | Chapters 10–13 and 16, regression inference, multiple and logistic regression, one- and two-way ANOVA | Simple regression and correlation | Residual plots and one-way ANOVA, then multiple regression |
| 4 | Chapters 3–9 and 14–15, sampling, probability, inference, tables, bootstrap and nonparametric tests | One-sample t | Two-sample and paired t, proportion tests, chi-square, bootstrap and rank tests |

For each increment, use the manual's worked examples as reference fixtures, specify data layout and missing-value behavior, connect results to the Navigator and report export, and test large-data rendering separately from full-data calculation. Track unsupported commands explicitly in the interface instead of suggesting parity with the manual.
