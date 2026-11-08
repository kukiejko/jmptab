import { numeric, summary } from './stats.js';
import { regularizedBeta, logGamma } from './inference.js';

export function groupedSummary(rows, responseIndex, groupIndex) {
  if (responseIndex === groupIndex) throw Error('Choose different response and grouping columns.');
  const groups = new Map();
  let excluded = 0;
  for (const row of rows) {
    const value = numeric(row[responseIndex]);
    const group = String(row[groupIndex] ?? '').trim();
    if (value === null || !group) { excluded++; continue; }
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(value);
  }
  if (!groups.size) throw Error('No complete observations were found for the selected columns.');
  return { groups: [...groups].map(([name, values]) => ({ name, ...(values.length === 1
    ? { n:1, mean:values[0], sd:null, median:values[0], min:values[0], max:values[0], variance:null, se:null }
    : summary(values)) })), excluded };
}

const normalCdf = value => {
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + .3275911 * x);
  const erf = 1 - (((((1.061405429*t - 1.453152027)*t) + 1.421413741)*t - .284496736)*t + .254829592)*t*Math.exp(-x*x);
  return .5 * (1 + Math.sign(value) * erf);
};
const normalPdf = value => Math.exp(-value * value / 2) / Math.sqrt(2 * Math.PI);
const simpson = (fn, start, end, steps) => {
  const h = (end - start) / steps;
  let total = fn(start) + fn(end);
  for (let i = 1; i < steps; i++) total += (i % 2 ? 4 : 2) * fn(start + h*i);
  return total * h / 3;
};

// Studentized range distribution: integrate the range of k normals over the
// independent chi-squared estimate of their common standard deviation.
export function tukeyPValue(q, groups, degreesOfFreedom) {
  if (q <= 0) return 1;
  const shape = degreesOfFreedom / 2;
  const upper = Math.max(5, 1 + 10 / Math.sqrt(degreesOfFreedom));
  const conditional = scale => simpson(z => {
    const interval = Math.max(0, normalCdf(z + q*scale) - normalCdf(z));
    return groups * normalPdf(z) * interval ** (groups - 1);
  }, -8, 8, 96);
  const probability = simpson(scale => {
    if (scale <= 0) return 0;
    const v = degreesOfFreedom * scale * scale;
    const logDensity = (shape - 1)*Math.log(v) - v/2 - shape*Math.log(2) - logGamma(shape);
    return conditional(scale) * Math.exp(logDensity) * 2*degreesOfFreedom*scale;
  }, 0, upper, 160);
  return Math.max(0, Math.min(1, 1 - probability));
}

export function oneWayAnova(rows, responseIndex, groupIndex) {
  const { groups, excluded } = groupedSummary(rows, responseIndex, groupIndex);
  if (groups.length < 2 || groups.some(group => group.n < 2)) throw Error('ANOVA requires at least two groups with two observations each.');
  const n = groups.reduce((sum, group) => sum + group.n, 0);
  const grandMean = groups.reduce((sum, group) => sum + group.n * group.mean, 0) / n;
  const betweenSS = groups.reduce((sum, group) => sum + group.n * (group.mean - grandMean) ** 2, 0);
  const withinSS = groups.reduce((sum, group) => sum + (group.n - 1) * group.variance, 0);
  const dfBetween = groups.length - 1, dfWithin = n - groups.length;
  const msWithin = withinSS / dfWithin;
  const f = msWithin ? betweenSS / dfBetween / msWithin : betweenSS ? Infinity : 0;
  const pValue = Number.isFinite(f) ? regularizedBeta(dfWithin / (dfWithin + dfBetween*f), dfWithin/2, dfBetween/2) : 0;
  const comparisons = [];
  for (let i = 0; i < groups.length; i++) for (let j = i+1; j < groups.length; j++) {
    const first = groups[i], second = groups[j];
    const difference = first.mean - second.mean;
    const standardError = Math.sqrt(msWithin/2 * (1/first.n + 1/second.n));
    const q = standardError ? Math.abs(difference) / standardError : difference ? Infinity : 0;
    comparisons.push({ first: first.name, second: second.name, difference, q,
      pValue: Number.isFinite(q) ? tukeyPValue(q, groups.length, dfWithin) : 0 });
  }
  return { groups, excluded, n, grandMean, betweenSS, withinSS, dfBetween, dfWithin,
    msBetween: betweenSS/dfBetween, msWithin, f, pValue, comparisons };
}
