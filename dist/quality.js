import { numeric } from './stats.js';
import { logGamma } from './inference.js';

export function xbarChart(values, subgroupSize, targetMean = null, knownSigma = null) {
  if (!Number.isSafeInteger(subgroupSize) || subgroupSize < 2) throw Error('Subgroup size must be a whole number of at least 2.');
  if (targetMean !== null && !Number.isFinite(targetMean)) throw Error('Enter a numeric target mean.');
  if (knownSigma !== null && (!Number.isFinite(knownSigma) || knownSigma <= 0)) throw Error('Known process standard deviation must be positive.');
  const observations = values.map(numeric);
  if (observations.length < 2 * subgroupSize || observations.length % subgroupSize !== 0 || observations.some(value => value === null)) {
    throw Error('Enter complete numeric subgroups with at least two subgroups.');
  }
  const means = [];
  let standardDeviationTotal = 0;
  for (let start = 0; start < observations.length; start += subgroupSize) {
    const group = observations.slice(start, start + subgroupSize);
    const mean = group.reduce((total, value) => total + value, 0) / subgroupSize;
    const variance = group.reduce((total, value) => total + (value - mean) ** 2, 0) / (subgroupSize - 1);
    means.push(mean);
    standardDeviationTotal += Math.sqrt(variance);
  }
  const c4 = Math.sqrt(2 / (subgroupSize - 1)) * Math.exp(logGamma(subgroupSize / 2) - logGamma((subgroupSize - 1) / 2));
  const sigma = knownSigma ?? standardDeviationTotal / means.length / c4;
  const center = targetMean ?? means.reduce((total, value) => total + value, 0) / means.length;
  const spread = 3 * sigma / Math.sqrt(subgroupSize);
  const lcl = center - spread;
  const ucl = center + spread;
  const signals = means.flatMap((value, index) => value < lcl || value > ucl ? [index] : []);
  return { n: observations.length, subgroupSize, groups: means.length, targetMean, knownSigma, center, sigma, c4, lcl, ucl, signals, means };
}
