import { numeric, capabilityWithOptionalLimits } from './stats.js';
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

export function xbarSChart(rows, responseIndex, { subgroupSize = null, subgroupColumn = null, stageColumn = null } = {}) {
  if (subgroupColumn === null && (!Number.isSafeInteger(subgroupSize) || subgroupSize < 2)) throw Error('Enter a subgroup size of at least two or choose a subgroup column.');
  const groups = [];
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index], value = numeric(row[responseIndex]);
    if (value === null) throw Error('Xbar-S requires complete numeric observations.');
    const label = subgroupColumn === null ? String(Math.floor(index/subgroupSize) + 1) : String(row[subgroupColumn] ?? '').trim();
    if (!label) throw Error('Subgroup labels cannot be blank.');
    const stage = stageColumn === null ? '' : String(row[stageColumn] ?? '').trim();
    if (groups.at(-1)?.label !== label || groups.at(-1)?.stage !== stage) groups.push({ label, stage, values: [] });
    groups.at(-1).values.push(value);
  }
  if (groups.length < 2) throw Error('Xbar-S requires at least two subgroups.');
  const size = groups[0].values.length;
  if (size < 2 || groups.some(group => group.values.length !== size)) throw Error('Xbar-S requires equal subgroup sizes of at least two.');
  const base = xbarChart(groups.flatMap(group => group.values), size);
  const standardDeviations = groups.map(group => {
    const mean = group.values.reduce((sum, value) => sum + value, 0)/size;
    return Math.sqrt(group.values.reduce((sum, value) => sum + (value - mean)**2, 0)/(size-1));
  });
  const sCenter = standardDeviations.reduce((sum, value) => sum + value, 0)/groups.length;
  const factor = 3 * Math.sqrt(1 - base.c4**2) / base.c4;
  const sLcl = Math.max(0, sCenter * (1 - factor));
  const sUcl = sCenter * (1 + factor);
  return { ...base, labels: groups.map(group => group.label), stages: groups.map(group => group.stage),
    standardDeviations, sCenter, sLcl, sUcl,
    sSignals: standardDeviations.flatMap((value, index) => value < sLcl || value > sUcl ? [index] : []) };
}

export function capabilityBySubgroup(rows, responseIndex, subgroupColumn, lsl, usl) {
  if (responseIndex === subgroupColumn) throw Error('Choose a separate subgroup column.');
  const chart = xbarSChart(rows, responseIndex, { subgroupColumn });
  const base = capabilityWithOptionalLimits(rows.map(row => row[responseIndex]), lsl, usl);
  const sigma = chart.sigma;
  const cpk = Math.min(lsl === null ? Infinity : (base.mean-lsl)/(3*sigma), usl === null ? Infinity : (usl-base.mean)/(3*sigma));
  return { ...base, sigma, cp: lsl === null || usl === null ? null : (usl-lsl)/(6*sigma), cpk,
    withinMethod: `Mean subgroup SD / c4 (${chart.subgroupSize} observations per subgroup)`, subgroupCount: chart.groups };
}
