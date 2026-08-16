'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const content = window.CharityContent;
  const params = new URLSearchParams(location.search);
  const type = String(params.get('type') || '').toLowerCase();
  const id = params.get('id');
  const allowed = ['articles', 'reports', 'honors'];
  const main = document.getElementById('readingMain');

  try {
    if (!allowed.includes(type) || !id) throw new Error('The article URL is incomplete or invalid.');
    const response = await fetch('articles.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load the article library.');
    const bundle = await response.json();
    const article = (bundle.articles || []).find((item) => item.id === id && item.section === type);
    if (!article) throw new Error('This article does not exist or is no longer published.');

    main.classList.add(`type-${type}`);
    document.title = `${article.title} — CyberShield`;
    document.getElementById('articleType').textContent = type === 'articles' ? 'Anti-Fraud Article' : type === 'reports' ? 'Activity Report' : 'Honor & Recognition';
    document.getElementById('articleTitle').textContent = article.title;
    document.getElementById('articleSummary').textContent = article.summary;
    document.getElementById('articleAuthor').textContent = article.author || 'CyberShield';
    document.getElementById('articleDate').textContent = article.publishedAt;
    document.getElementById('pinnedBadge').hidden = !article.pinned;
    const rendered = content.renderMarkdown(article.markdown);
    document.getElementById('articleBody').innerHTML = content.resolveArticleImages(rendered, article.assetBase);
    document.getElementById('archiveLink').href = `articles.html?section=${type}`;
    document.getElementById('moreLink').href = `articles.html?section=${type}`;
  } catch (error) {
    main.innerHTML = `<section class="reading-error"><h1>Unable to open this story</h1><p>${content.escapeHtml(error.message)}</p><p><a href="index.html">Return home</a></p></section>`;
  }
});
