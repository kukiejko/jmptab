import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseReleaseNotes } from './release-notes.mjs';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.join(projectRoot, 'dist');
const { version } = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));

function serveFile(requestPath, response) {
  const relativePath = requestPath === '/' ? '/index.html' : requestPath;
  const file = path.resolve(distRoot, '.' + relativePath);

  if (!file.startsWith(distRoot + path.sep)) {
    response.writeHead(403);
    response.end();
    return;
  }

  fs.readFile(file, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    const contentTypes = { html: 'text/html', css: 'text/css', js: 'text/javascript' };
    response.setHeader('Content-Type', contentTypes[path.extname(file).slice(1)] || 'application/octet-stream');
    response.end(content);
  });
}

export function createRequestHandler({ deployedAt = new Date().toISOString() } = {}) {
  return (request, response) => {
    let requestPath;
    try {
      requestPath = decodeURIComponent(request.url.split('?')[0]);
    } catch {
      response.writeHead(400);
      response.end('Invalid URL');
      return;
    }

    if (requestPath === '/app-info.json') {
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ version, deployedAt }));
      return;
    }

    if (requestPath === '/release-notes.json') {
      const markdown = fs.readFileSync(path.join(projectRoot, 'CHANGELOG.md'), 'utf8');
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(parseReleaseNotes(markdown)));
      return;
    }

    serveFile(requestPath, response);
  };
}

export function createServer(options) {
  return http.createServer(createRequestHandler(options));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] || 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port must be 1–65535');
  createServer().listen(port, '127.0.0.1', () => {
    console.log(`Local: http://127.0.0.1:${port}`);
  });
}
