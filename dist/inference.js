import { summary, regression } from './stats.js';

const coefficients = [0.9999999999998099, 676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406, 12.507343278686905, -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7];

export function logGamma(value) {
  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  const z = value - 1;
  let sum = coefficients[0];
  for (let i = 1; i < coefficients.length; i++) sum += coefficients[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(sum);
}

function betaFraction(a, b, x) {
  const tiny = 1e-300;
  let c = 1;
  let d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let result = d;
  for (let m = 1; m <= 300; m++) {
    const even = m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 + even * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + even / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    result *= d * c;
    const odd = -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + odd * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + odd / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    result *= delta;
    if (Math.abs(delta - 1) < 3e-14) return result;
  }
  throw Error('The t-distribution calculation did not converge.');
}

function regularizedBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const factor = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log1p(-x));
  if (x < (a + 1) / (a + b + 2)) return factor * betaFraction(a, b, x) / a;
  return 1 - factor * betaFraction(b, a, 1 - x) / b;
}

export function tCdf(t, degreesOfFreedom) {
  const tail = regularizedBeta(degreesOfFreedom / (degreesOfFreedom + t * t), degreesOfFreedom / 2, 0.5) / 2;
  return t >= 0 ? 1 - tail : tail;
}

function tQuantile(probability, degreesOfFreedom) {
  if (probability === 0.5) return 0;
  if (probability < 0.5) return -tQuantile(1 - probability, degreesOfFreedom);
  let low = 0;
  let high = 1;
  while (tCdf(high, degreesOfFreedom) < probability) high *= 2;
  for (let i = 0; i < 90; i++) {
    const middle = (low + high) / 2;
    if (tCdf(middle, degreesOfFreedom) < probability) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

export function oneSampleT({ n, mean, sd, confidence = 95, alternative = 'two-sided', nullMean = null }) {
  if (!Number.isSafeInteger(n) || n < 2 || !Number.isFinite(mean) || !Number.isFinite(sd) || sd <= 0) throw Error('Enter a sample size of at least 2, a numeric mean, and a positive standard deviation.');
  if (!Number.isFinite(confidence) || confidence <= 0 || confidence >= 100) throw Error('Confidence level must be between 0 and 100.');
  if (!['two-sided', 'greater', 'less'].includes(alternative)) throw Error('Choose a valid alternative hypothesis.');
  if (nullMean !== null && !Number.isFinite(nullMean)) throw Error('Enter a numeric hypothesized mean.');
  const df = n - 1;
  const se = sd / Math.sqrt(n);
  const alpha = 1 - confidence / 100;
  const critical = tQuantile(1 - alpha / (alternative === 'two-sided' ? 2 : 1), df);
  const lower = alternative === 'less' ? -Infinity : mean - critical * se;
  const upper = alternative === 'greater' ? Infinity : mean + critical * se;
  const statistic = nullMean === null ? null : (mean - nullMean) / se;
  let pValue = null;
  if (statistic !== null) {
    const lowerTail = tCdf(statistic, df);
    pValue = alternative === 'greater' ? 1 - lowerTail : alternative === 'less' ? lowerTail : Math.min(1, 2 * Math.min(lowerTail, 1 - lowerTail));
  }
  return { n, mean, sd, confidence, alternative, nullMean, df, se, lower, upper, statistic, pValue };
}

export function oneSampleTFromValues(values, options = {}) {
  const result = summary(values);
  return { ...oneSampleT({ n: result.n, mean: result.mean, sd: result.sd, ...options }), excluded: result.missing };
}

export function pearsonCorrelation(xs, ys, pointLimit = 800) {
  const fit = regression(xs, ys, pointLimit);
  if (fit.r2 === null) throw Error('Correlation requires variation in both columns.');
  const r = Math.sign(fit.slope) * Math.sqrt(fit.r2);
  const df = fit.n - 2;
  const statistic = Math.abs(r) >= 1 ? Infinity : r * Math.sqrt(df / (1 - r * r));
  const pValue = Number.isFinite(statistic) ? 2 * tCdf(-Math.abs(statistic), df) : 0;
  return { r, n: fit.n, excluded: xs.length - fit.n, df, statistic, pValue, pairs: fit.pairs };
}
