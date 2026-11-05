import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executeAnalysis } from '../dist/analysis-execution.js';
import { renderAnalysisResult } from '../dist/analysis-rendering.js';

test('regression result renders chart labels and a parseable report', () => {
  const rows = [[1, 2], [2, 4], [3, 6], [4, 8]];
  const result = executeAnalysis({ type: 'regression', rows, responseIndex: 1, predictorIndex: 0 });
  const rendered = renderAnalysisResult({
    type: 'regression', s: result, column: 'Output <mm>', predictorColumn: 'Input', rowCount: rows.length
  });

  assert.match(rendered.html, /Output &lt;mm&gt; vs Input/);
  assert.match(rendered.html, /Fitted equation/);
  assert.equal(JSON.parse(rendered.report).slope, 2);
});

test('one-sample result preserves unbounded interval in exported report', () => {
  const result = executeAnalysis({
    type: 'one-sample-t', rows: [], responseIndex: 0, options: {
      source: 'summary', n: 5, mean: 3, sd: 1, confidence: 95,
      alternative: 'greater', nullMean: 0
    }
  });
  const rendered = renderAnalysisResult({ type: 'one-sample-t', s: result, column: 'Summary' });

  assert.match(rendered.html, /\+∞/);
  assert.equal(JSON.parse(rendered.report).upper, '+Infinity');
});

test('every analysis can be calculated and rendered without the application UI', () => {
  const rows = [[1, 2], [2, 4], [3, 6], [4, 8], [5, 10], [6, 12]];
  const cases = [
    ['summary', {}], ['histogram', {}], ['regression', {}], ['correlation', {}],
    ['one-sample-t', { source: 'column', confidence: 95, alternative: 'two-sided', nullMean: 0 }],
    ['moving-average', { span: 2 }],
    ['exponential-smoothing', { weight: 0.3, initialPeriods: 1 }],
    ['xbar-chart', { subgroupSize: 2, targetMean: null, sigma: null }],
    ['p-chart', { subgroupSize: 15, targetProportion: null }],
    ['control', {}], ['capability', { lsl: 0, usl: 15 }]
  ];

  for (const [type, options] of cases) {
    const result = executeAnalysis({ type, rows, responseIndex: 1, predictorIndex: 0, options });
    const rendered = renderAnalysisResult({
      type, s: result, column: 'Output', predictorColumn: 'Input', rowCount: rows.length
    });
    assert.match(rendered.html, /class="metrics"/, type);
    assert.doesNotThrow(() => JSON.parse(rendered.report), type);
  }
});
