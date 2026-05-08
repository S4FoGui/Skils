// search-module.js — Smart search detection & execution

class SmartSearchModule {
  constructor(page) {
    this.page = page;
    // Ordered by specificity: most reliable selectors first
    this.SELECTORS = [
      'input[type="search"]',
      'input[name="q"]',
      'input[name="query"]',
      'input[name="search"]',
      'input[placeholder*="Search" i]',
      'input[aria-label*="Search" i]',
      '[role="searchbox"]',
      '#search', '#searchInput', '#q',
      '.search-input', '.search-box',
    ];
  }

  async detectSearchBox() {
    for (const selector of this.SELECTORS) {
      const el = await this.page.$(selector).catch(() => null);
      if (!el) continue;
      const visible = await el.isIntersectingViewport().catch(() => false);
      if (visible) return el;
    }
    return this._aiDetect();
  }

  async _aiDetect() {
    // Score all inputs by how "search-like" their attributes are
    const scored = await this.page.evaluate(() => {
      const KEYWORDS = ['search', 'query', 'find', 'q', 'busca', 'pesquisa'];
      return Array.from(document.querySelectorAll('input, textarea'))
        .map(el => {
          const fields = [el.type, el.name, el.id, el.placeholder,
                          el.getAttribute('aria-label')].filter(Boolean).join(' ').toLowerCase();
          const score = KEYWORDS.reduce((acc, kw) => acc + (fields.includes(kw) ? 1 : 0), 0);
          const rect = el.getBoundingClientRect();
          return { score, id: el.id, name: el.name, visible: rect.width > 0 && rect.height > 0 };
        })
        .filter(e => e.visible && e.score > 0)
        .sort((a, b) => b.score - a.score);
    });

    if (!scored.length) return null;
    const best = scored[0];
    const sel = best.id ? `#${best.id}` : `input[name="${best.name}"]`;
    return this.page.$(sel).catch(() => null);
  }

  async performSearch(query) {
    const box = await this.detectSearchBox();
    if (!box) throw new Error('No search box found on this page');

    // Clear + type with human-like delay
    await box.click({ clickCount: 3 });
    await this.page.keyboard.press('Backspace');
    await box.type(query, { delay: 40 + Math.random() * 60 });

    // Submit: Enter first, then look for submit button
    await this.page.keyboard.press('Enter');

    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 })
      .catch(() => {}); // SPA searches won't navigate

    return this._extractResults();
  }

  async _extractResults() {
    return this.page.evaluate(() => {
      const candidates = [
        '.g', '.result', '[data-result]', 'article', 'li.search-result',
      ];
      for (const sel of candidates) {
        const items = document.querySelectorAll(sel);
        if (items.length > 2) {
          return Array.from(items).slice(0, 10).map(el => ({
            title: el.querySelector('h2, h3, h4, .title')?.textContent.trim(),
            link: el.querySelector('a')?.href,
            snippet: el.querySelector('p, .snippet, .description')?.textContent.trim(),
          })).filter(r => r.title || r.link);
        }
      }
      return [];
    });
  }
}

module.exports = { SmartSearchModule };
