import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseReleaseNotes } from '../release-notes.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const output = join(root, 'standalone', 'jmptab.html');
const styles = ['style.css', 'graph-builder.css', 'boxplot-builder.css', 'sample-data-dialog.css', 'csv-import.css'];
const [template, manifest, changelog, ...css] = await Promise.all([
  readFile(join(dist, 'index.html'), 'utf8'),
  readFile(join(root, 'package.json'), 'utf8'),
  readFile(join(root, 'CHANGELOG.md'), 'utf8'),
  ...styles.map(name => readFile(join(dist, name), 'utf8'))
]);
const { version } = JSON.parse(manifest);
const deployedAt = new Date().toISOString();
const bundled = await build({
  entryPoints: [join(dist, 'app.js')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  write: false,
  minify: false,
  legalComments: 'none'
});
const release = { info: { version, deployedAt }, notes: parseReleaseNotes(changelog) };
const script = `globalThis.__JMPTAB_RELEASE__ = ${JSON.stringify(release)};\n${bundled.outputFiles[0].text}`.replace(/<\/script/gi, '<\\/script');
let html = template;
for (const name of styles) {
  const link = `<link rel="stylesheet" href="${name}">`;
  if (!html.includes(link)) throw new Error(`Missing stylesheet ${name}`);
  html = html.replace(`  ${link}\r\n`, '').replace(`  ${link}\n`, '');
}
html = html.replace('</head>', `<style>\n${css.join('\n')}\n</style>\n</head>`);
const entry = '<script type="module" src="app.js"></script>';
if (!html.includes(entry)) throw new Error('Missing app entry point');
html = html.replace(entry, `<script>\n${script}\n</script>`);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, html);
console.log(`Built ${output} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KiB)`);
