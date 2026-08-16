const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { collectArticles, compareArticles, normalizeSection } = require('../build.js');
const { renderMarkdown, videoEmbedUrl } = require('../content-utils.js');

test('normalizeSection accepts the three text sections only', () => {
  assert.equal(normalizeSection('Articles'), 'articles');
  assert.equal(normalizeSection('reports'), 'reports');
  assert.equal(normalizeSection('HONORS'), 'honors');
  assert.throws(() => normalizeSection('videos'), /Unsupported section/);
});

test('compareArticles puts pinned and lower manual order first', () => {
  const items = [
    { pinned: false, order: 0, publishedAt: '2026-02-01' },
    { pinned: true, order: 2, publishedAt: '2026-03-01' },
    { pinned: true, order: 1, publishedAt: '2026-01-01' },
  ];
  items.sort(compareArticles);
  assert.deepEqual(items.map((item) => [item.pinned, item.order]), [
    [true, 1],
    [true, 2],
    [false, 0],
  ]);
});

test('collectArticles reads section/article/index.md and meta.json', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'charity-content-'));
  const articleDir = path.join(root, 'articles', 'one');
  fs.mkdirSync(path.join(articleDir, 'images'), { recursive: true });
  fs.writeFileSync(path.join(articleDir, 'index.md'), '# Body\n\nHello.');
  fs.writeFileSync(path.join(articleDir, 'meta.json'), JSON.stringify({
    id: 'one', title: 'One', summary: 'Summary', publishedAt: '2026-01-01', pinned: false, order: 0,
  }));

  const articles = collectArticles(root);
  assert.equal(articles.length, 1);
  assert.equal(articles[0].section, 'articles');
  assert.equal(articles[0].markdown, '# Body\n\nHello.');
  assert.equal(articles[0].assetBase, 'content/articles/one/');
});

test('renderMarkdown supports safe rich markdown and blocks raw HTML', () => {
  const html = renderMarkdown('# Heading\n\n- [x] Done\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n![Alt](images/a.png)\n\n<script>alert(1)</script>');
  assert.match(html, /<h1>Heading<\/h1>/);
  assert.match(html, /type="checkbox" checked disabled/);
  assert.match(html, /<table>/);
  assert.match(html, /src="images\/a.png"/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test('videoEmbedUrl parses Bilibili and YouTube links', () => {
  assert.match(videoEmbedUrl('https://www.bilibili.com/video/BV1LN411o7YY'), /player\.bilibili\.com.*BV1LN411o7YY/);
  assert.equal(videoEmbedUrl('https://youtu.be/dQw4w9WgXcQ'), 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1');
  assert.equal(videoEmbedUrl('https://example.com/video'), '');
});
