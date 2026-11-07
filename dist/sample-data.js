export const SAMPLE_DEFAULTS = Object.freeze({
  boxplot: { count: 120, min: 5, max: 25, groups: 3 },
  scatterplot: { count: 100, min: 0, max: 100, yMin: 0, yMax: 100 },
  histogram: { count: 200, min: 0, max: 100 }
});

const randomSource = seed => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};

export function generateSampleData(input, random = randomSource(4711)) {
  const type = input.type;
  if (!Object.hasOwn(SAMPLE_DEFAULTS, type)) throw new Error('Choose a sample data type.');
  const settings = { ...SAMPLE_DEFAULTS[type], ...input };
  const count = Number(settings.count);
  const min = Number(settings.min);
  const max = Number(settings.max);
  if (!Number.isInteger(count) || count < 2 || count > 100000) throw new Error('Point count must be a whole number from 2 to 100,000.');
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) throw new Error('Minimum must be less than maximum.');
  const unit = () => Math.min(1, Math.max(0, Number(random())));
  const value = (low, high, proportion) => String(low + (high - low) * proportion);

  if (type === 'scatterplot') {
    const yMin = Number(settings.yMin);
    const yMax = Number(settings.yMax);
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax) || yMin >= yMax) throw new Error('Y minimum must be less than Y maximum.');
    return { headers: ['X', 'Y'], rows: Array.from({ length: count }, () => {
      const x = unit();
      const y = Math.min(1, Math.max(0, 0.12 + 0.76 * x + (unit() - 0.5) * 0.38));
      return [value(min, max, x), value(yMin, yMax, y)];
    }) };
  }

  if (type === 'boxplot') {
    const groups = Number(settings.groups);
    if (!Number.isInteger(groups) || groups < 2 || groups > 8 || groups > count) throw new Error('Groups must be a whole number from 2 to 8 and no more than the point count.');
    return { headers: ['Value', 'Group'], rows: Array.from({ length: count }, (_, index) => {
      const group = index % groups;
      const center = 0.28 + group * (0.44 / Math.max(1, groups - 1));
      const spread = (unit() + unit() + unit() + unit() - 2) * 0.14;
      const outlier = index % 23 === 0 ? (group % 2 ? -0.24 : 0.24) : 0;
      return [value(min, max, Math.min(1, Math.max(0, center + spread + outlier))), `Group ${group + 1}`];
    }) };
  }

  return { headers: ['Value'], rows: Array.from({ length: count }, () => {
    const proportion = (unit() + unit() + unit() + unit()) / 4;
    return [value(min, max, proportion)];
  }) };
}
