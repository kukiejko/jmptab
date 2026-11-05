import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('changelog starts with the package version in X.Y.Z format', () => {
  const { version } = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const changelog = fs.readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  const versions = [...changelog.matchAll(/^## (\d+\.\d+\.\d+)\b/gm)].map(match => match[1]);

  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.equal(versions[0], version);
  assert.match(changelog, /Deployment time:/);
});
