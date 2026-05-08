// perf-optimizer.js — Block trackers, optimize load

const BLOCKED_DOMAINS = [
  'google-analytics.com', 'googletagmanager.com', 'analytics.google.com',
  'facebook.net', 'connect.facebook.com', 'fbcdn.net',
  'doubleclick.net', 'googlesyndication.com',
  'hotjar.com', 'mixpanel.com', 'segment.io', 'segment.com',
  'newrelic.com', 'nr-data.net', 'datadog-browser-agent.com',
];

const BLOCKED_TYPES = ['media']; // block video/audio by default

class PerformanceOptimizer {
  constructor(page) {
    this.page = page;
    this._intercepting = false;
    this.blocked = [];
  }

  async analyze() {
    return this.page.evaluate(() => {
      const t = performance.timing;
      const resources = performance.getEntriesByType('resource');
      return {
        pageLoadTime: t.loadEventEnd - t.navigationStart,
        domNodes: document.querySelectorAll('*').length,
        totalResources: resources.length,
        largeResources: resources
          .filter(r => r.transferSize > 200_000)
          .map(r => ({ name: r.name.split('/').pop().slice(0, 50), sizeKB: Math.round(r.transferSize / 1024) })),
        thirdParty: [...new Set(
          resources
            .map(r => { try { return new URL(r.name).hostname; } catch { return null; } })
            .filter(h => h && h !== location.hostname)
        )].slice(0, 15),
      };
    });
  }

  async optimize(options = {}) {
    const opts = {
      blockTrackers: true,
      blockAds: true,
      lazyImages: true,
      reduceMotion: false,
      ...options,
    };

    const applied = [];

    if ((opts.blockTrackers || opts.blockAds) && !this._intercepting) {
      this._intercepting = true;
      await this.page.setRequestInterception(true);
      this.page.on('request', req => {
        const url = req.url();
        const blocked =
          BLOCKED_DOMAINS.some(d => url.includes(d)) ||
          BLOCKED_TYPES.includes(req.resourceType());
        if (blocked) {
          this.blocked.push(url.slice(0, 80));
          req.abort();
        } else {
          req.continue();
        }
      });
      applied.push(`blocked_trackers`);
    }

    if (opts.lazyImages) {
      const count = await this.page.evaluate(() => {
        let n = 0;
        document.querySelectorAll('img:not([loading])').forEach(img => {
          img.loading = 'lazy';
          img.decoding = 'async';
          n++;
        });
        return n;
      });
      applied.push(`lazy_images:${count}`);
    }

    if (opts.reduceMotion) {
      await this.page.addStyleTag({
        content: '*, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }'
      });
      applied.push('reduce_motion');
    }

    return applied;
  }
}

// data-extractor.js — Structured data extraction from any page
class DataExtractor {
  constructor(page) {
    this.page = page;
  }

  async extractAll() {
    return this.page.evaluate(() => ({
      metadata: {
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.content,
        canonical: document.querySelector('link[rel="canonical"]')?.href,
        ogTitle: document.querySelector('meta[property="og:title"]')?.content,
        ogImage: document.querySelector('meta[property="og:image"]')?.content,
      },
      headings: Array.from(document.querySelectorAll('h1,h2,h3'))
        .map(h => ({ level: h.tagName, text: h.textContent.trim() })),
      links: Array.from(document.querySelectorAll('a[href]'))
        .map(a => ({ text: a.textContent.trim().slice(0, 80), href: a.href }))
        .filter(l => l.text)
        .slice(0, 100),
      images: Array.from(document.querySelectorAll('img[src]'))
        .map(i => ({ alt: i.alt, src: i.src, w: i.naturalWidth, h: i.naturalHeight }))
        .slice(0, 50),
      tables: Array.from(document.querySelectorAll('table')).map(table =>
        Array.from(table.querySelectorAll('tr')).map(row =>
          Array.from(row.querySelectorAll('td,th')).map(c => c.textContent.trim())
        )
      ),
    }));
  }

  async extractText(selector = 'main, article, [role="main"], body') {
    return this.page.$eval(selector, el => el.innerText.slice(0, 10_000))
      .catch(() => this.page.evaluate(() => document.body.innerText.slice(0, 10_000)));
  }
}

module.exports = { PerformanceOptimizer, DataExtractor };
