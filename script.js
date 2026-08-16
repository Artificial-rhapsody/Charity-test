'use strict';

const API_BASE = window.CHARITY_API_BASE || 'http://localhost:8787';
const CONTENT = window.CharityContent;
let siteData;
let articleData = [];

const byId = (id) => document.getElementById(id);
const lineBreaks = (value) => CONTENT.escapeHtml(value || '').replace(/\n/g, '<br>');

async function loadJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to load ${url}`);
  return response.json();
}

function readingUrl(article) {
  return `reading.html?type=${encodeURIComponent(article.section)}&id=${encodeURIComponent(article.id)}`;
}

function renderSite() {
  document.title = siteData.brand.pageTitle;
  byId('siteLogoIcon').textContent = siteData.brand.icon;
  byId('siteLogoText').textContent = siteData.brand.name;
  byId('siteLogoText').dataset.sitePath = 'brand.name';
  byId('siteLogoIcon').dataset.sitePath = 'brand.icon';
  byId('heroTitle').innerHTML = lineBreaks(siteData.hero.title);
  byId('heroDescription').textContent = siteData.hero.description;
  byId('heroPrimary').textContent = siteData.hero.primaryButton;
  byId('heroSecondary').textContent = siteData.hero.secondaryButton;
  byId('heroImage').src = siteData.hero.image;
  byId('heroImage').alt = siteData.hero.imageAlt;
  byId('heroTitle').dataset.sitePath = 'hero.title'; byId('heroDescription').dataset.sitePath = 'hero.description'; byId('heroPrimary').dataset.sitePath = 'hero.primaryButton'; byId('heroSecondary').dataset.sitePath = 'hero.secondaryButton'; byId('heroImage').dataset.sitePath = 'hero.image';
  byId('heroStats').innerHTML = siteData.hero.stats.map((stat, index) => `<div class="stat-item"><div><span class="stat-number" data-count="${Number(stat.value)}" data-site-path="hero.stats.${index}.value">0</span><span class="stat-suffix" data-site-path="hero.stats.${index}.suffix">${CONTENT.escapeHtml(stat.suffix || '')}</span></div><span class="stat-label" data-site-path="hero.stats.${index}.label">${CONTENT.escapeHtml(stat.label)}</span></div>`).join('');

  byId('videosTitle').textContent = siteData.videos.title;
  byId('videosSubtitle').textContent = siteData.videos.subtitle;
  byId('videosTitle').dataset.sitePath = 'videos.title'; byId('videosSubtitle').dataset.sitePath = 'videos.subtitle';
  byId('videoGrid').innerHTML = siteData.videos.items.map((video, index) => `<button class="card video-card" type="button" data-video-url="${CONTENT.escapeHtml(video.url)}" data-site-path="videos.items.${index}.url"><span class="card-media"><img class="card-media-bg" src="${CONTENT.escapeHtml(video.cover)}" alt="" referrerpolicy="no-referrer" data-site-path="videos.items.${index}.cover"><span class="video-play-btn" aria-hidden="true">▶</span><span class="card-tag" data-site-path="videos.items.${index}.tag">${CONTENT.escapeHtml(video.tag)}</span></span><span class="card-content"><span class="card-heading" data-site-path="videos.items.${index}.title">${CONTENT.escapeHtml(video.title)}</span><span class="card-description" data-site-path="videos.items.${index}.description">${CONTENT.escapeHtml(video.description)}</span><span class="card-btn">Watch Video →</span></span></button>`).join('');

  for (const section of ['articles', 'reports', 'honors']) {
    const config = siteData.sections[section];
    byId(`${section}Label`).textContent = config.label;
    byId(`${section}Title`).innerHTML = lineBreaks(config.title);
    byId(`${section}Description`).textContent = config.description;
    byId(`${section}Label`).dataset.sitePath = `sections.${section}.label`; byId(`${section}Title`).dataset.sitePath = `sections.${section}.title`; byId(`${section}Description`).dataset.sitePath = `sections.${section}.description`;
  }
  byId('reportStats').innerHTML = siteData.sections.reports.stats.map((stat, index) => `<div class="report-stat"><span class="report-stat-number" data-site-path="sections.reports.stats.${index}.value">${CONTENT.escapeHtml(stat.value)}</span><span class="report-stat-label" data-site-path="sections.reports.stats.${index}.label">${CONTENT.escapeHtml(stat.label)}</span></div>`).join('');

  byId('contactTitle').textContent = siteData.contact.title;
  byId('contactSubtitle').textContent = siteData.contact.subtitle;
  byId('contactLine').textContent = `${siteData.contact.email}  |  ${siteData.contact.phone}`;
  byId('copyrightLine').textContent = siteData.contact.copyright;
  byId('contactTitle').dataset.sitePath = 'contact.title'; byId('contactSubtitle').dataset.sitePath = 'contact.subtitle'; byId('contactLine').dataset.sitePath = 'contact.email'; byId('copyrightLine').dataset.sitePath = 'contact.copyright';
}

function articleCard(article, section, index) {
  const href = readingUrl(article);
  if (section === 'articles') {
    return `<article class="article-row ${index === 0 ? 'featured' : ''}"><div class="article-row-number">${String(index + 1).padStart(2, '0')}</div><div><span class="article-small-meta">${CONTENT.escapeHtml(article.publishedAt)}${article.pinned ? ' · Pinned' : ''}</span><h4>${CONTENT.escapeHtml(article.title)}</h4><p>${CONTENT.escapeHtml(article.summary)}</p></div><a href="${href}" aria-label="Read ${CONTENT.escapeHtml(article.title)}">Read →</a></article>`;
  }
  if (section === 'reports') {
    return `<article class="report-highlight"><div class="report-highlight-bar"></div><div class="report-highlight-body"><span class="report-highlight-tag">${article.pinned ? 'Pinned Report' : 'Report'}</span><h4>${CONTENT.escapeHtml(article.title)}</h4><p>${CONTENT.escapeHtml(article.summary)}</p><a href="${href}" class="report-highlight-link">Read Full Report →</a></div></article>`;
  }
  return `<article class="honor-card"><div class="honor-card-top"><div class="honor-medal">✦</div><div class="honor-card-year">${CONTENT.escapeHtml(article.publishedAt.slice(0, 4))}</div></div><div class="honor-card-badge">${article.pinned ? 'Pinned' : 'Recognition'}</div><h4>${CONTENT.escapeHtml(article.title)}</h4><p>${CONTENT.escapeHtml(article.summary)}</p><a href="${href}" class="honor-read-link">Read Story →</a></article>`;
}

function renderArticles() {
  for (const section of ['articles', 'reports', 'honors']) {
    const items = articleData.filter((article) => article.section === section);
    const capacity = Number(siteData.sections[section].capacity);
    const visible = items.slice(0, capacity);
    byId(`${section}List`).innerHTML = visible.map((article, index) => articleCard(article, section, index)).join('') || '<p class="empty-content">No published content yet.</p>';
    byId(`${section}More`).hidden = items.length <= capacity;
  }
}

function animateCounters() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const element = entry.target;
      const target = Number(element.dataset.count);
      const start = performance.now();
      const step = (now) => {
        const progress = Math.min((now - start) / 1600, 1);
        const current = Math.floor((1 - Math.pow(1 - progress, 3)) * target);
        element.textContent = target >= 10000 ? `${Math.floor(current / 1000)}K` : current.toLocaleString();
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      observer.unobserve(element);
    });
  }, { threshold: 0.4 });
  document.querySelectorAll('[data-count]').forEach((element) => observer.observe(element));
}

function toast(message, type = 'success') {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const element = document.createElement('div');
  element.className = `toast toast-${type}`;
  element.textContent = message;
  document.body.appendChild(element);
  requestAnimationFrame(() => element.classList.add('show'));
  setTimeout(() => { element.classList.remove('show'); setTimeout(() => element.remove(), 250); }, 3000);
}

function getUser() {
  try { return JSON.parse(localStorage.getItem('cybershield_user') || 'null'); } catch { return null; }
}

function updateNavbar() {
  const user = getUser();
  byId('navJoinUs').hidden = Boolean(user);
  byId('navLogin').hidden = Boolean(user);
  byId('navUsername').hidden = !user;
  if (user) byId('userDisplay').textContent = user.role === 'admin' ? `${user.name} · Admin` : user.name;
}

function setupInteraction() {
  const navbar = byId('navbar');
  window.addEventListener('scroll', () => navbar.classList.toggle('scrolled', window.scrollY > 50), { passive: true });
  byId('navToggle').addEventListener('click', () => {
    const open = byId('navLinks').classList.toggle('active');
    byId('navToggle').setAttribute('aria-expanded', String(open));
  });

  const closeLogin = () => byId('loginModal').classList.remove('active');
  byId('loginBtn').addEventListener('click', (event) => { event.preventDefault(); byId('loginModal').classList.add('active'); byId('loginEmail').focus(); });
  byId('loginModalClose').addEventListener('click', closeLogin);
  byId('goToRegister').addEventListener('click', closeLogin);
  byId('loginModal').addEventListener('click', (event) => { if (event.target === byId('loginModal')) closeLogin(); });

  byId('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const response = await fetch(`${API_BASE}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: byId('loginEmail').value.trim(), password: byId('loginPassword').value }) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem('cybershield_token', data.token);
      localStorage.setItem('cybershield_user', JSON.stringify(data.user));
      if (data.user.role === 'admin') window.location.href = 'admin.html';
      else { closeLogin(); updateNavbar(); toast(`Welcome, ${data.user.name}.`); }
    } catch (error) { toast(error.message, 'error'); }
    finally { button.disabled = false; }
  });

  byId('userDisplay').addEventListener('click', (event) => {
    event.preventDefault();
    const user = getUser();
    if (user?.role === 'admin') { window.location.href = 'admin.html'; return; }
    localStorage.removeItem('cybershield_token'); localStorage.removeItem('cybershield_user'); updateNavbar();
  });

  const closeSuccess = () => byId('successModal').classList.remove('active');
  byId('successModalClose').addEventListener('click', closeSuccess);
  byId('successModalOk').addEventListener('click', closeSuccess);
  byId('contactForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (data.password !== data.passwordConfirm) return toast('Passwords do not match.', 'error');
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const response = await fetch(`${API_BASE}/api/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Registration failed');
      event.currentTarget.reset(); byId('successModal').classList.add('active');
    } catch (error) { toast(error.message, 'error'); }
    finally { button.disabled = false; }
  });

  const closeVideo = () => { byId('videoModal').classList.remove('active'); document.body.style.overflow = ''; setTimeout(() => { byId('videoModalIframe').src = 'about:blank'; }, 300); };
  byId('videoGrid').addEventListener('click', (event) => {
    const card = event.target.closest('.video-card');
    if (!card) return;
    const embed = CONTENT.videoEmbedUrl(card.dataset.videoUrl);
    if (!embed) return toast('Unsupported video URL.', 'error');
    byId('videoModalIframe').src = embed; byId('videoModal').classList.add('active'); document.body.style.overflow = 'hidden';
  });
  byId('videoModalClose').addEventListener('click', closeVideo);
  byId('videoModalBackdrop').addEventListener('click', closeVideo);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeVideo(); closeLogin(); closeSuccess(); } });
}

async function initialize() {
  try {
    const [site, articleBundle] = await Promise.all([loadJson('site.json'), loadJson('articles.json')]);
    siteData = site; articleData = articleBundle.articles || [];
    renderSite(); renderArticles(); animateCounters(); setupInteraction(); updateNavbar();
  } catch (error) {
    document.body.insertAdjacentHTML('afterbegin', `<div class="load-error">${CONTENT.escapeHtml(error.message)} — run <code>node build.js</code> first.</div>`);
  }
}

document.addEventListener('DOMContentLoaded', initialize);
