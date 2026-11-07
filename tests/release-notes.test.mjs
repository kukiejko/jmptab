import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReleaseNotes } from '../release-notes.mjs';

test('release notes use version headings and bullet changes only', () => {
  const notes = parseReleaseNotes('# Changelog\n\n## 1.2.3 — today\n\n- Added menu\n- Fixed chart\n\n## 1.2.2 — before\n\n- Older change\n', 1);
  assert.deepEqual(notes, [{ version: '1.2.3', changes: ['Added menu', 'Fixed chart'] }]);
});
