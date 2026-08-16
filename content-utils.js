(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CharityContent = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
  }

  function safeUrl(value) {
    const url = String(value || '').trim();
    if (/^(https?:|mailto:|\/|\.\/|\.\.\/|images\/)/i.test(url)) return escapeHtml(url);
    return '';
  }

  function inlineMarkdown(value) {
    let text = escapeHtml(value);
    text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
      const safe = safeUrl(url);
      return safe ? `<img src="${safe}" alt="${alt}" loading="lazy">` : '';
    });
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
      const safe = safeUrl(url);
      return safe ? `<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>` : label;
    });
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    text = text.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
    return text;
  }

  function renderMarkdown(markdown) {
    const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
    const output = [];
    let paragraph = [];
    let listType = '';
    let inCode = false;
    let code = [];

    const flushParagraph = () => {
      if (paragraph.length) output.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
      paragraph = [];
    };
    const closeList = () => {
      if (listType) output.push(`</${listType}>`);
      listType = '';
    };

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (/^```/.test(line)) {
        flushParagraph(); closeList();
        if (inCode) {
          output.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
          code = []; inCode = false;
        } else inCode = true;
        continue;
      }
      if (inCode) { code.push(line); continue; }
      if (!line.trim()) { flushParagraph(); closeList(); continue; }

      const tableSeparator = lines[index + 1] && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1]);
      if (line.includes('|') && tableSeparator) {
        flushParagraph(); closeList();
        const headers = line.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
        index += 1;
        const rows = [];
        while (lines[index + 1] && lines[index + 1].includes('|') && lines[index + 1].trim()) {
          index += 1;
          rows.push(lines[index].replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()));
        }
        output.push(`<table><thead><tr>${headers.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
        continue;
      }

      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        flushParagraph(); closeList();
        const level = heading[1].length;
        output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
        continue;
      }
      const quote = line.match(/^>\s?(.*)$/);
      if (quote) { flushParagraph(); closeList(); output.push(`<blockquote>${inlineMarkdown(quote[1])}</blockquote>`); continue; }
      if (/^---+$/.test(line.trim())) { flushParagraph(); closeList(); output.push('<hr>'); continue; }

      const task = line.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.+)$/);
      const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
      const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
      if (task || bullet || ordered) {
        flushParagraph();
        const nextType = ordered ? 'ol' : 'ul';
        if (listType !== nextType) { closeList(); listType = nextType; output.push(`<${listType}>`); }
        if (task) {
          const checked = task[1].toLowerCase() === 'x' ? ' checked' : '';
          output.push(`<li class="task-item"><input type="checkbox"${checked} disabled> ${inlineMarkdown(task[2])}</li>`);
        } else output.push(`<li>${inlineMarkdown((ordered || bullet)[1])}</li>`);
        continue;
      }
      paragraph.push(line.trim());
    }
    flushParagraph(); closeList();
    if (inCode) output.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
    return output.join('\n');
  }

  function videoEmbedUrl(input) {
    const value = String(input || '').trim();
    const bvid = value.match(/\b(BV[0-9A-Za-z]{10})\b/i);
    if (bvid) return `https://player.bilibili.com/player.html?bvid=${bvid[1]}&p=1&high_quality=1&autoplay=true&danmaku=0`;
    const youtube = value.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/i);
    if (youtube) return `https://www.youtube.com/embed/${youtube[1]}?autoplay=1`;
    return '';
  }

  function resolveArticleImages(html, assetBase) {
    return String(html).replace(/(<img\s+[^>]*src=")((?!https?:|\/)[^"]+)(")/gi, `$1${assetBase}$2$3`);
  }

  function completeRegistration(form, successModal) {
    form.reset();
    successModal.classList.add('active');
  }

  return { escapeHtml, renderMarkdown, videoEmbedUrl, resolveArticleImages, completeRegistration };
});
