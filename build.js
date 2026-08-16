#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { URL } = require('node:url');

const ROOT = __dirname;
const CONTENT_DIR = path.join(ROOT, 'content');
const DEV_PAGE = path.join(ROOT, 'dev-page');
const SECTIONS = ['articles', 'reports', 'honors'];
const STATIC_FILES = [
  'index.html', 'style.css', 'script.js', 'reading.html', 'reading.css', 'reading.js',
  'articles.html', 'articles.js', 'admin.html', 'admin.css', 'admin.js', 'content-utils.js',
  'site.json',
];

function normalizeSection(section) {
  const normalized = String(section || '').toLowerCase();
  if (!SECTIONS.includes(normalized)) throw new Error(`Unsupported section: ${section}`);
  return normalized;
}

function compareArticles(a, b) {
  if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
  const orderA = Number.isFinite(Number(a.order)) ? Number(a.order) : Number.MAX_SAFE_INTEGER;
  const orderB = Number.isFinite(Number(b.order)) ? Number(b.order) : Number.MAX_SAFE_INTEGER;
  if (orderA !== orderB) return orderA - orderB;
  return String(b.publishedAt || '').localeCompare(String(a.publishedAt || ''));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function validateArticle(meta, articleDir) {
  const required = ['id', 'title', 'summary', 'publishedAt'];
  for (const field of required) {
    if (!meta[field]) throw new Error(`${path.relative(ROOT, articleDir)}/meta.json is missing ${field}`);
  }
  if (!/^[0-9a-f-]{36}$/i.test(meta.id) && meta.id !== 'one') {
    throw new Error(`${meta.id} is not a valid UUID`);
  }
}

function collectArticles(contentDir = CONTENT_DIR) {
  if (!fs.existsSync(contentDir)) return [];
  const articles = [];
  for (const sectionName of fs.readdirSync(contentDir, { withFileTypes: true })) {
    if (!sectionName.isDirectory()) continue;
    const section = normalizeSection(sectionName.name);
    const sectionDir = path.join(contentDir, section);
    for (const entry of fs.readdirSync(sectionDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const articleDir = path.join(sectionDir, entry.name);
      const metaFile = path.join(articleDir, 'meta.json');
      const markdownFile = path.join(articleDir, 'index.md');
      if (!fs.existsSync(metaFile) || !fs.existsSync(markdownFile)) {
        throw new Error(`${path.relative(ROOT, articleDir)} must contain meta.json and index.md`);
      }
      const meta = readJson(metaFile);
      validateArticle(meta, articleDir);
      articles.push({
        ...meta,
        section,
        markdown: fs.readFileSync(markdownFile, 'utf8'),
        assetBase: `content/${section}/${entry.name}/`,
      });
    }
  }
  return articles.sort(compareArticles);
}

function copyFile(relativePath, outputDir) {
  const source = path.join(ROOT, relativePath);
  if (!fs.existsSync(source)) throw new Error(`Missing static file: ${relativePath}`);
  const destination = path.join(outputDir, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function copyDirectory(source, destination) {
  if (!fs.existsSync(source)) return;
  fs.cpSync(source, destination, { recursive: true });
}

function build(outputDir = DEV_PAGE) {
  fs.mkdirSync(outputDir, { recursive: true });
  for (const file of STATIC_FILES) copyFile(file, outputDir);
  copyDirectory(path.join(ROOT, 'assets'), path.join(outputDir, 'assets'));
  copyDirectory(CONTENT_DIR, path.join(outputDir, 'content'));
  const articles = collectArticles();
  fs.writeFileSync(path.join(outputDir, 'articles.json'), `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), articles }, null, 2)}\n`);
  readJson(path.join(outputDir, 'site.json'));
  readJson(path.join(outputDir, 'articles.json'));
  return { outputDir, articleCount: articles.length };
}

function safeInside(base, relativePath) {
  const target = path.resolve(base, relativePath);
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) throw new Error('Unsafe path');
  return target;
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > 25 * 1024 * 1024) reject(new Error('Payload too large'));
      else chunks.push(chunk);
    });
    request.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (error) { reject(new Error('Invalid JSON body')); }
    });
    request.on('error', reject);
  });
}

function json(response, status, data) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  response.end(JSON.stringify(data));
}

function writePublishFiles(files) {
  if (!Array.isArray(files) || !files.length) throw new Error('No files supplied');
  for (const file of files) {
    const relativePath = String(file.path || '');
    const target = safeInside(ROOT, relativePath);
    const allowed = relativePath === 'site.json' || relativePath.startsWith('assets/site/') || relativePath.startsWith('content/');
    if (!allowed) throw new Error(`Path not allowed: ${relativePath}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const bytes = file.encoding === 'base64' ? Buffer.from(file.content, 'base64') : Buffer.from(String(file.content || ''), 'utf8');
    fs.writeFileSync(target, bytes);
  }
  return build();
}

function deleteArticle(relativeDir) {
  if (!/^content\/(articles|reports|honors)\/[0-9a-f-]{36}$/i.test(relativeDir)) throw new Error('Invalid article path');
  const target = safeInside(ROOT, relativeDir);
  fs.rmSync(target, { recursive: true, force: true });
  return build();
}

function startDevServer(port = 8790) {
  build();
  const server = http.createServer(async (request, response) => {
    if (request.method === 'OPTIONS') return json(response, 204, {});
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      if (request.method === 'GET' && url.pathname === '/health') return json(response, 200, { ok: true, mode: 'local-dev' });
      if (request.method === 'POST' && url.pathname === '/publish') {
        const body = await parseBody(request);
        return json(response, 200, { ok: true, ...writePublishFiles(body.files) });
      }
      if (request.method === 'POST' && url.pathname === '/delete-article') {
        const body = await parseBody(request);
        return json(response, 200, { ok: true, ...deleteArticle(body.path) });
      }
      return json(response, 404, { ok: false, error: 'Not found' });
    } catch (error) {
      return json(response, 400, { ok: false, error: error.message });
    }
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Local publishing API: http://127.0.0.1:${port}`);
    console.log(`Open dev-page/index.html with VS Code Live Server.`);
  });
  return server;
}

if (require.main === module) {
  if (process.argv.includes('--dev')) startDevServer(Number(process.env.PORT || 8790));
  else {
    const result = build();
    console.log(`Built ${result.articleCount} articles into ${path.relative(ROOT, result.outputDir)}/`);
  }
}

module.exports = { build, collectArticles, compareArticles, normalizeSection, startDevServer };
