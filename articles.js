'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const content = window.CharityContent;
  const allowed = ['articles', 'reports', 'honors'];
  const labels = { articles: 'Anti-Fraud Articles', reports: 'Activity Reports', honors: 'Honors & Recognition' };
  const requested = new URLSearchParams(location.search).get('section');
  const first = allowed.includes(requested) ? requested : 'articles';
  const order = [first, ...allowed.filter((section) => section !== first)];
  let articles = [];

  function render(query = '') {
    const needle = query.trim().toLowerCase();
    document.getElementById('archiveMain').innerHTML = order.map((section) => {
      const items = articles.filter((article) => article.section === section && (!needle || article.title.toLowerCase().includes(needle) || article.summary.toLowerCase().includes(needle)));
      const cards = items.map((article) => `<a class="archive-card" href="reading.html?type=${section}&id=${encodeURIComponent(article.id)}"><span class="archive-card-date">${content.escapeHtml(article.publishedAt)}${article.pinned ? '<br>PINNED' : ''}</span><span><h3>${content.escapeHtml(article.title)}</h3><p>${content.escapeHtml(article.summary)}</p></span><span class="archive-card-arrow">Read →</span></a>`).join('');
      return `<section class="archive-section" data-section="${section}" id="${section}"><header class="archive-section-header"><h2>${labels[section]}</h2><span>${items.length} ${items.length === 1 ? 'entry' : 'entries'}</span></header><div class="archive-list">${cards || '<p class="archive-empty">No matching content in this section.</p>'}</div></section>`;
    }).join('');
  }

  try {
    const response = await fetch('articles.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load articles.json');
    articles = (await response.json()).articles || [];
    render();
    document.getElementById('archiveSearch').addEventListener('input', (event) => render(event.target.value));
  } catch (error) {
    document.getElementById('archiveMain').innerHTML = `<p class="archive-empty">${content.escapeHtml(error.message)}</p>`;
  }
});
