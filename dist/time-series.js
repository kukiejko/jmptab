import { numeric } from './stats.js';

export function movingAverage(values, span) {
  if (!Number.isSafeInteger(span) || span < 2) throw Error('Moving-average span must be a whole number of at least 2.');
  const observations = values.map(numeric);
  if (observations.some(value => value === null)) throw Error('Time series requires numeric values in every row to preserve order.');
  if (span >= observations.length) throw Error('Moving-average span must be smaller than the number of observations.');
  const fitted = [];
  let windowTotal = 0;
  for (let index = 0; index < observations.length; index++) {
    if (index >= span) {
      fitted.push([index + 1, windowTotal / span]);
      windowTotal -= observations[index - span];
    }
    windowTotal += observations[index];
  }
  const forecast = windowTotal / span;
  const absoluteError = fitted.reduce((total, [period, estimate]) => total + Math.abs(observations[period - 1] - estimate), 0);
  return { n: observations.length, span, forecast, mae: absoluteError / fitted.length, observations, fitted };
}

export function exponentialSmoothing(values, weight, initialPeriods = 1) {
  if (!Number.isFinite(weight) || weight <= 0 || weight > 1) throw Error('Smoothing weight must be greater than 0 and no more than 1.');
  if (!Number.isSafeInteger(initialPeriods) || initialPeriods < 1) throw Error('Initial periods must be a whole number of at least 1.');
  const observations = values.map(numeric);
  if (observations.some(value => value === null)) throw Error('Time series requires numeric values in every row to preserve order.');
  if (initialPeriods >= observations.length) throw Error('Initial periods must be fewer than the observations.');
  let smoothed = observations.slice(0, initialPeriods).reduce((total, value) => total + value, 0) / initialPeriods;
  const fitted = [];
  let absoluteError = 0;
  for (let index = initialPeriods; index < observations.length; index++) {
    fitted.push([index + 1, smoothed]);
    absoluteError += Math.abs(observations[index] - smoothed);
    smoothed = weight * observations[index] + (1 - weight) * smoothed;
  }
  return { n: observations.length, weight, initialPeriods, forecast: smoothed, mae: absoluteError / fitted.length, observations, fitted };
}
