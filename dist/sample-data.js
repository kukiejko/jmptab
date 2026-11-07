import { MAX_ROWS } from './stats.js';

export const SAMPLE_DEFAULTS = Object.freeze({
  boxplot: { count: 120, min: -6, max: 6, groups: 3 },
  scatterplot: { count: 100, min: -6, max: 6, yMin: -6, yMax: 6 },
  histogram: { count: 200, min: -6, max: 6 }
});
export const SAMPLE_DISTRIBUTIONS = Object.freeze(['normal', 'uniform', 'exponential', 'bimodal']);
export const DISTRIBUTION_DEFAULTS = Object.freeze({ distribution: 'normal', mean: 0, sigma: 1, outliers: false, outlierPercent: 5 });

const randomSource = seed => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};

const clamp = (number, min, max) => Math.min(max, Math.max(min, number));

export function generateSampleData(input, random = randomSource(4711)) {
  const type = input.type;
  if (!Object.hasOwn(SAMPLE_DEFAULTS, type)) throw new Error('Choose a sample data type.');
  const settings = { ...SAMPLE_DEFAULTS[type], ...DISTRIBUTION_DEFAULTS, ...input };
  const count = Number(settings.count);
  const min = Number(settings.min);
  const max = Number(settings.max);
  if (!Number.isInteger(count) || count < 2 || count > MAX_ROWS) throw new Error('Point count must be a whole number from 2 to 1,048,576.');
  if (!SAMPLE_DISTRIBUTIONS.includes(settings.distribution)) throw new Error('Choose a distribution.');
  if (settings.distribution !== 'normal' && (!Number.isFinite(min) || !Number.isFinite(max) || min >= max)) throw new Error('Minimum must be less than maximum.');
  const mean = Number(settings.mean);
  const sigma = Number(settings.sigma);
  const outlierPercent = Number(settings.outlierPercent);
  if (settings.distribution === 'normal' && (!Number.isFinite(mean) || !Number.isFinite(sigma) || sigma <= 0)) throw new Error('Normal mean must be finite and sigma must be greater than zero.');
  if (settings.distribution === 'normal' && settings.outliers && (!Number.isFinite(outlierPercent) || outlierPercent < 0 || outlierPercent > 25)) throw new Error('Outlier percentage must be from 0 to 25.');
  const unit = () => clamp(Number(random()), 0, 1 - Number.EPSILON);
  const normal = () => Math.sqrt(-2 * Math.log(Math.max(Number.MIN_VALUE, unit()))) * Math.cos(2 * Math.PI * unit());
  const value = (low, high, number) => String(settings.distribution === 'normal' ? number : clamp(number, low, high));
  const draw = (low, high, offset = 0, index = 0) => {
    let number;
    switch (settings.distribution) {
      case 'normal':
        number = mean + sigma * (normal() + offset);
        if (settings.outliers && index < Math.round(count * outlierPercent / 100)) number = mean + sigma * (index % 2 ? -4.5 : 4.5);
        break;
      case 'uniform': number = low + (high - low) * unit() + offset * (high - low) / 8; break;
      case 'exponential': number = low + (high - low) * (-Math.log(Math.max(Number.MIN_VALUE, 1 - unit())) / 4 + offset / 8); break;
      default: number = low + (high - low) * (0.3 + (unit() < 0.5 ? 0 : 0.4) + normal() * 0.045 + offset / 8);
    }
    return value(low, high, number);
  };

  if (type === 'scatterplot') {
    const yMin = Number(settings.yMin);
    const yMax = Number(settings.yMax);
    if (settings.distribution !== 'normal' && (!Number.isFinite(yMin) || !Number.isFinite(yMax) || yMin >= yMax)) throw new Error('Y minimum must be less than Y maximum.');
    return { headers: ['X', 'Y'], rows: Array.from({ length: count }, (_, index) => {
      const x = Number(draw(min, max, 0, index));
      if (settings.distribution === 'normal') {
        const y = mean + 0.75 * (x - mean) + sigma * normal() * 0.5;
        return [String(x), String(y)];
      }
      const fraction = (x - min) / (max - min);
      const noise = (settings.distribution === 'normal' ? normal() * 0.12 : (unit() - 0.5) * 0.35);
      const y = yMin + (yMax - yMin) * clamp(0.12 + 0.76 * fraction + noise, 0, 1);
      return [String(x), value(yMin, yMax, y)];
    }) };
  }

  if (type === 'boxplot') {
    const groups = Number(settings.groups);
    if (!Number.isInteger(groups) || groups < 2 || groups > 8 || groups > count) throw new Error('Groups must be a whole number from 2 to 8 and no more than the point count.');
    return { headers: ['Value', 'Group'], rows: Array.from({ length: count }, (_, index) => {
      const group = index % groups;
      const offset = (group - (groups - 1) / 2) * 0.35;
      return [draw(min, max, offset, index), `Group ${group + 1}`];
    }) };
  }

  return { headers: ['Value'], rows: Array.from({ length: count }, (_, index) => [draw(min, max, 0, index)]) };
}
