'use strict';

const LOCAL_PUBLISH_API = 'http://127.0.0.1:8790';
const REMOTE_API = window.CHARITY_API_BASE || (location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? 'http://localhost:8787' : 'https://cybershield-api.hatayoru.workers.dev');
const content = window.CharityContent;
const $ = (id) => document.getElementById(id);
let site;
let articles = [];
let editingId = '';
let selectedPath = '';
let selectedElement = null;
let siteAssets = [];
let articleAssets = new Map();
let publishMode = 'local';

function toast(message, error = false) {
  const element = $('adminToast');
  element.textContent = message;
  element.classList.toggle('error', error);
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 3200);
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load ${url}`);
  return response.json();
}

function deepGet(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object);
}

function deepSet(object, path, value) {
  const keys = path.split('.');
  let target = object;
  keys.slice(0, -1).forEach((key) => { target = target[key]; });
  const key = keys.at(-1);
  const old = target[key];
  target[key] = typeof old === 'number' ? Number(value) : value;
}

function countFields(value) {
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + countFields(item), 0);
  if (value && typeof value === 'object') return Object.values(value).reduce((sum, item) => sum + countFields(item), 0);
  return 1;
}

async function detectMode() {
  const local = location.hostname === '127.0.0.1' || location.hostname === 'localhost' || location.hostname === '';
  if (!local) {
    publishMode = 'remote';
    $('modeBadge').textContent = 'DEPLOYMENT PREVIEW';
    $('metricTarget').textContent = 'GitHub';
    return;
  }
  try {
    const response = await fetch(`${LOCAL_PUBLISH_API}/health`);
    if (!response.ok) throw new Error('offline');
    publishMode = 'local';
    $('modeBadge').textContent = 'LOCAL PUBLISHING READY';
    $('metricTarget').textContent = 'dev-page';
  } catch {
    publishMode = 'remote';
    $('modeBadge').textContent = 'PREVIEW ONLY — START build.js --dev';
    $('metricTarget').textContent = 'Preview';
  }
}

function requireAdmin() {
  const host = location.hostname;
  const local = host === '127.0.0.1' || host === 'localhost' || host === '';
  let user = null;
  try { user = JSON.parse(localStorage.getItem('cybershield_user') || 'null'); } catch { user = null; }
  if (!local && user?.role !== 'admin') { location.replace('index.html'); return false; }
  $('adminIdentity').textContent = local ? 'Local administrator preview' : `${user.name} · Administrator`;
  return true;
}

async function publishFiles(files, message) {
  if (publishMode === 'local') {
    const response = await fetch(`${LOCAL_PUBLISH_API}/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files }) });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || 'Local publish failed');
    return result;
  }
  const token = localStorage.getItem('cybershield_token');
  if (!token) throw new Error('Log in as an administrator before remote publishing.');
  const response = await fetch(`${REMOTE_API}/api/admin/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ files, message }) });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error || 'Remote publish failed');
  return result;
}

function switchPanel(name, label) {
  document.querySelectorAll('.admin-nav').forEach((button) => button.classList.toggle('active', button.dataset.panel === name));
  document.querySelectorAll('.admin-panel').forEach((panel) => panel.classList.toggle('active', panel.id === `panel-${name}`));
  $('panelTitle').textContent = label;
}

function initializeNavigation() {
  document.querySelectorAll('.admin-nav').forEach((button) => button.addEventListener('click', () => switchPanel(button.dataset.panel, button.textContent)));
  $('logoutButton').addEventListener('click', () => { localStorage.removeItem('cybershield_token'); localStorage.removeItem('cybershield_user'); location.href = 'index.html'; });
}

function styleEditableDocument(doc) {
  if (doc.getElementById('editor-overlay-style')) return;
  const style = doc.createElement('style');
  style.id = 'editor-overlay-style';
  style.textContent = '[data-site-path]{outline:2px dashed rgba(168,85,247,.65)!important;outline-offset:3px;cursor:text!important}[data-site-path]:hover{outline-style:solid!important;background-color:rgba(168,85,247,.08)!important}img[data-site-path]{cursor:zoom-in!important}';
  doc.head.appendChild(style);
}

function openProperty(element) {
  selectedElement = element;
  selectedPath = element.dataset.sitePath;
  const isImage = element.tagName === 'IMG' || selectedPath.endsWith('.cover') || selectedPath.endsWith('.image');
  $('propertyTitle').textContent = selectedPath;
  $('propertyValue').value = String(deepGet(site, selectedPath) ?? '');
  $('propertyFileLabel').hidden = !isImage;
  $('propertyPanel').hidden = false;
}

function initializeHomepageEditor() {
  const frame = $('homepageFrame');
  frame.addEventListener('load', () => {
    const doc = frame.contentDocument;
    styleEditableDocument(doc);
    doc.addEventListener('click', (event) => {
      const element = event.target.closest('[data-site-path]');
      if (!element) return;
      event.preventDefault(); event.stopPropagation(); openProperty(element);
    }, true);
    doc.addEventListener('dblclick', (event) => {
      const element = event.target.closest('img[data-site-path]');
      if (!element) return;
      event.preventDefault(); openProperty(element); $('propertyFile').click();
    }, true);
  });
  $('propertyClose').addEventListener('click', () => { $('propertyPanel').hidden = true; });
  $('applyProperty').addEventListener('click', () => {
    if (!selectedPath || !selectedElement) return;
    const value = $('propertyValue').value;
    deepSet(site, selectedPath, value);
    if (selectedElement.tagName === 'IMG') selectedElement.src = value;
    else if (selectedPath.endsWith('.url')) selectedElement.dataset.videoUrl = value;
    else selectedElement.innerHTML = content.escapeHtml(value).replace(/\n/g, '<br>');
    toast('Preview updated. Publish when ready.');
  });
  $('propertyFile').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const extension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '.png';
    const name = `${crypto.randomUUID()}${extension}`;
    const path = `assets/site/${name}`;
    const base64 = await fileToBase64(file);
    siteAssets.push({ path, content: base64, encoding: 'base64' });
    $('propertyValue').value = path;
    deepSet(site, selectedPath, path);
    if (selectedElement?.tagName === 'IMG') selectedElement.src = URL.createObjectURL(file);
    toast('Image staged for homepage publish.');
  });
  $('publishSite').addEventListener('click', async () => {
    try {
      const files = [{ path: 'site.json', content: `${JSON.stringify(site, null, 2)}\n`, encoding: 'utf8' }, ...siteAssets];
      await publishFiles(files, 'content: update homepage');
      siteAssets = [];
      toast('Homepage published and dev-page rebuilt.');
    } catch (error) { toast(error.message, true); }
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function newArticle() {
  editingId = '';
  $('editorHeading').textContent = 'New Article';
  $('articleSection').value = 'articles';
  $('articleDate').value = new Date().toISOString().slice(0, 10);
  $('articleTitleInput').value = '';
  $('articleSummaryInput').value = '';
  $('articleAuthorInput').value = 'CyberShield';
  $('articleOrder').value = '0';
  $('articlePinned').checked = false;
  $('articleMarkdown').value = localStorage.getItem('cybershield_article_draft') || '';
  $('deleteArticle').hidden = true;
  articleAssets = new Map();
  renderPreview(); renderManagerList();
}

function loadArticle(article) {
  editingId = article.id;
  $('editorHeading').textContent = article.title;
  $('articleSection').value = article.section;
  $('articleDate').value = article.publishedAt;
  $('articleTitleInput').value = article.title;
  $('articleSummaryInput').value = article.summary;
  $('articleAuthorInput').value = article.author || 'CyberShield';
  $('articleOrder').value = Number(article.order || 0);
  $('articlePinned').checked = Boolean(article.pinned);
  $('articleMarkdown').value = article.markdown;
  $('deleteArticle').hidden = false;
  articleAssets = new Map();
  renderPreview(); renderManagerList();
}

function renderManagerList(query = '') {
  const needle = query.toLowerCase();
  $('managerList').innerHTML = articles.filter((article) => article.title.toLowerCase().includes(needle)).map((article) => `<button class="manager-item ${article.id === editingId ? 'active' : ''}" type="button" data-id="${article.id}"><strong>${content.escapeHtml(article.title)}</strong><span>${article.section} · ${article.publishedAt}${article.pinned ? ' · pinned' : ''}</span></button>`).join('');
  $('managerList').querySelectorAll('button').forEach((button) => button.addEventListener('click', () => loadArticle(articles.find((article) => article.id === button.dataset.id))));
}

function renderPreview() {
  const id = editingId || 'draft';
  const section = $('articleSection').value;
  const html = content.renderMarkdown($('articleMarkdown').value);
  $('markdownPreview').innerHTML = content.resolveArticleImages(html, `content/${section}/${id}/`);
}

function insertMarkdown(value) {
  const editor = $('articleMarkdown');
  const start = editor.selectionStart;
  editor.setRangeText(value, start, editor.selectionEnd, 'end');
  editor.focus(); renderPreview();
}

function htmlToMarkdown(root) {
  function convert(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const body = [...node.childNodes].map(convert).join('');
    const tag = node.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) return `${'#'.repeat(Number(tag[1]))} ${body.trim()}\n\n`;
    if (tag === 'p') return `${body.trim()}\n\n`;
    if (tag === 'strong' || tag === 'b') return `**${body}**`;
    if (tag === 'em' || tag === 'i') return `*${body}*`;
    if (tag === 'blockquote') return `> ${body.trim()}\n\n`;
    if (tag === 'li') return `- ${body.trim()}\n`;
    if (tag === 'a') return `[${body}](${node.getAttribute('href') || ''})`;
    if (tag === 'br') return '\n';
    return body;
  }
  return convert(root).replace(/\n{3,}/g, '\n\n').trim();
}

async function importDocument(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  if (extension === 'md' || extension === 'txt') return file.text();
  if (extension === 'docx') {
    if (!window.mammoth) throw new Error('DOCX converter did not load. Check the network connection.');
    const result = await window.mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    const wrapper = document.createElement('div'); wrapper.innerHTML = result.value;
    return htmlToMarkdown(wrapper);
  }
  throw new Error('Only .md, .txt, and .docx are supported.');
}

function initializeArticleEditor() {
  $('newArticle').addEventListener('click', newArticle);
  $('managerSearch').addEventListener('input', (event) => renderManagerList(event.target.value));
  $('articleMarkdown').addEventListener('input', () => { renderPreview(); localStorage.setItem('cybershield_article_draft', $('articleMarkdown').value); });
  document.querySelectorAll('[data-insert]').forEach((button) => button.addEventListener('click', () => insertMarkdown(button.dataset.insert)));
  $('documentImport').addEventListener('change', async (event) => {
    try { const file = event.target.files[0]; if (file) { $('articleMarkdown').value = await importDocument(file); renderPreview(); toast('Document imported. Review before publishing.'); } }
    catch (error) { toast(error.message, true); }
  });
  $('articleImages').addEventListener('change', async (event) => {
    const id = editingId || crypto.randomUUID();
    if (!editingId) editingId = id;
    for (const file of event.target.files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-');
      articleAssets.set(safeName, await fileToBase64(file));
      insertMarkdown(`\n![${file.name}](images/${safeName})\n`);
    }
    toast(`${event.target.files.length} image(s) inserted.`);
  });
  $('publishArticle').addEventListener('click', publishArticle);
  $('deleteArticle').addEventListener('click', deleteArticle);
}

async function publishArticle() {
  try {
    const id = editingId || crypto.randomUUID();
    const section = $('articleSection').value;
    const title = $('articleTitleInput').value.trim();
    const summary = $('articleSummaryInput').value.trim();
    const markdown = $('articleMarkdown').value.trim();
    if (!title || !summary || !markdown || !$('articleDate').value) throw new Error('Title, summary, date, and Markdown are required.');
    const meta = { id, title, summary, publishedAt: $('articleDate').value, pinned: $('articlePinned').checked, order: Number($('articleOrder').value || 0), author: $('articleAuthorInput').value.trim() || 'CyberShield', cover: '' };
    const base = `content/${section}/${id}`;
    const files = [{ path: `${base}/meta.json`, content: `${JSON.stringify(meta, null, 2)}\n`, encoding: 'utf8' }, { path: `${base}/index.md`, content: `${markdown}\n`, encoding: 'utf8' }];
    articleAssets.forEach((base64, name) => files.push({ path: `${base}/images/${name}`, content: base64, encoding: 'base64' }));
    await publishFiles(files, `content: publish ${title}`);
    const existingIndex = articles.findIndex((article) => article.id === id);
    const next = { ...meta, section, markdown, assetBase: `${base}/` };
    if (existingIndex >= 0) articles[existingIndex] = next; else articles.push(next);
    editingId = id; articleAssets = new Map(); localStorage.removeItem('cybershield_article_draft');
    loadArticle(next); $('metricArticles').textContent = articles.length;
    toast('Article published and articles.json rebuilt.');
  } catch (error) { toast(error.message, true); }
}

async function deleteArticle() {
  const article = articles.find((item) => item.id === editingId);
  if (!article || !confirm(`Delete “${article.title}” permanently?`)) return;
  try {
    if (publishMode === 'local') {
      const response = await fetch(`${LOCAL_PUBLISH_API}/delete-article`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: `content/${article.section}/${article.id}` }) });
      const result = await response.json(); if (!response.ok || !result.ok) throw new Error(result.error || 'Delete failed');
    } else {
      const token = localStorage.getItem('cybershield_token');
      const response = await fetch(`${REMOTE_API}/api/admin/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ path: `content/${article.section}/${article.id}`, message: `content: delete ${article.title}` }) });
      const result = await response.json(); if (!response.ok || !result.ok) throw new Error(result.error || 'Delete failed');
    }
    articles = articles.filter((item) => item.id !== editingId); newArticle(); $('metricArticles').textContent = articles.length; toast('Article deleted.');
  } catch (error) { toast(error.message, true); }
}

async function initialize() {
  if (!requireAdmin()) return;
  initializeNavigation();
  try {
    [site, { articles }] = await Promise.all([fetchJson('site.json'), fetchJson('articles.json')]);
    window.articles = articles;
  } catch (error) { toast(error.message, true); return; }
  $('metricArticles').textContent = articles.length;
  $('metricFields').textContent = countFields(site);
  await detectMode();
  initializeHomepageEditor(); initializeArticleEditor(); newArticle();
}

document.addEventListener('DOMContentLoaded', initialize);
