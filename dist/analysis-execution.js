import { movingAverage, exponentialSmoothing } from './time-series.js';
import { xbarChart, xbarSChart, capabilityBySubgroup } from './quality.js';
import { oneSampleT, oneSampleTFromValues, pearsonCorrelation } from './inference.js';
import { regression, control, capabilityWithOptionalLimits, pChart, histogram } from './stats.js';

export const PLOT_LIMIT = 800;

// DOM-free analysis dispatch. The dialog supplies options; tests can use the same entry point.
export function executeAnalysis({ type, rows, responseIndex, predictorIndex, options = {} }) {
  const values = rows.map(row => row[responseIndex]);

  switch (type) {
    case 'one-sample-t':
      return options.source === 'summary'
        ? oneSampleT({ n: options.n, mean: options.mean, sd: options.sd,
            confidence: options.confidence, alternative: options.alternative, nullMean: options.nullMean })
        : oneSampleTFromValues(values, {
            confidence: options.confidence, alternative: options.alternative, nullMean: options.nullMean
          });
    case 'correlation':
      if (responseIndex === predictorIndex) throw Error('Choose different columns for correlation.');
      return pearsonCorrelation(rows.map(row => row[predictorIndex]), values, PLOT_LIMIT);
    case 'regression':
      if (responseIndex === predictorIndex) throw Error('Choose different response and predictor columns.');
      return regression(rows.map(row => row[predictorIndex]), values, PLOT_LIMIT);
    case 'moving-average':
      return movingAverage(values, options.span);
    case 'exponential-smoothing':
      return exponentialSmoothing(values, options.weight, options.initialPeriods);
    case 'xbar-chart':
      return xbarChart(values, options.subgroupSize, options.targetMean, options.sigma);
    case 'xbar-s-chart':
      return xbarSChart(rows, responseIndex, options);
    case 'p-chart':
      return pChart(values, options.subgroupSize, options.targetProportion);
    case 'control':
      return control(values);
    case 'capability':
      return options.subgroupColumn === null || options.subgroupColumn === undefined
        ? capabilityWithOptionalLimits(values, options.lsl, options.usl)
        : capabilityBySubgroup(rows, responseIndex, options.subgroupColumn, options.lsl, options.usl);
    case 'summary':
    case 'histogram':
      return histogram(values);
    default:
      throw Error(`Unknown analysis: ${type}`);
  }
}
