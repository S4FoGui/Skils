// agent.js — Main orchestrator
// Requires: puppeteer-extra, puppeteer-extra-plugin-stealth

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const { SmartSearchModule } = require('./search-module');
const { UILearnerModule } = require('./ui-learner');
const { PerformanceOptimizer } = require('./perf-optimizer');
const { DataExtractor } = require('./data-extractor');

class AIBrowserAgent {
  constructor() {
    this.browser = null;
    this.page = null;
    this.modules = {};
  }

  async initialize(options = {}) {
    this.browser = await puppeteer.launch({
      headless: options.headless ?? 'new',
      defaultViewport: { width: 1440, height: 900 },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    this.page = await this.browser.newPage();

    // Randomize user agent
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );

    this.modules = {
      search: new SmartSearchModule(this.page),
      ui: new UILearnerModule(this.page),
      perf: new PerformanceOptimizer(this.page),
      extract: new DataExtractor(this.page),
    };

    return this;
  }

  async processCommand(command) {
    const intent = this._parseIntent(command);

    switch (intent.action) {
      case 'search':   return this._handleSearch(intent.query, intent.site);
      case 'navigate': return this._handleNavigate(intent.url);
      case 'learn':    return this._handleLearn();
      case 'optimize': return this._handleOptimize(intent.options);
      case 'extract':  return this._handleExtract();
      default:         return this._handleLearn(); // safe fallback
    }
  }

  _parseIntent(command) {
    const c = command.toLowerCase();
    if (/search|find|look up|buscar/.test(c)) {
      const m = command.match(/["«»「」'](.*?)["«»「」']/) ??
                command.match(/(?:search|find|buscar)\s+(.+?)(?:\s+(?:on|at|in|em)\s+(.+))?$/i);
      return { action: 'search', query: m?.[1] ?? command, site: m?.[2] ?? null };
    }
    if (/open|go to|navigate|abrir/.test(c)) {
      const url = command.match(/https?:\/\/[^\s]+/)?.[0] ??
                  command.replace(/open|go to|navigate|abrir/gi, '').trim();
      return { action: 'navigate', url };
    }
    if (/extract|scrape|get data|coletar|extrair/.test(c)) return { action: 'extract' };
    if (/optim|speed up|block ads|acelerar/.test(c)) return { action: 'optimize', options: {} };
    return { action: 'learn' };
  }

  async _handleNavigate(url) {
    if (!url.startsWith('http')) url = 'https://' + url;
    await this._goto(url);
    const structure = await this.modules.ui.learnPageStructure();
    return {
      success: true, action: 'navigate',
      url: this.page.url(),
      title: await this.page.title(),
      interactiveElements: Object.values(structure).flat().length,
    };
  }

  async _handleSearch(query, site) {
    if (site) await this._handleNavigate(site);
    const results = await this.modules.search.performSearch(query);
    return { success: true, action: 'search', query, url: this.page.url(), results };
  }

  async _handleLearn() {
    const [structure, metrics] = await Promise.all([
      this.modules.ui.learnPageStructure(),
      this.modules.perf.analyze(),
    ]);
    return { success: true, action: 'learn', url: this.page.url(), structure, metrics };
  }

  async _handleOptimize(options) {
    const before = await this.modules.perf.analyze();
    const applied = await this.modules.perf.optimize(options);
    const after = await this.modules.perf.analyze();
    return {
      success: true, action: 'optimize',
      before: { loadMs: before.pageLoadTime, nodes: before.domNodes },
      after:  { loadMs: after.pageLoadTime,  nodes: after.domNodes  },
      applied,
    };
  }

  async _handleExtract() {
    const data = await this.modules.extract.extractAll();
    return { success: true, action: 'extract', url: this.page.url(), data };
  }

  async _goto(url) {
    await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  }

  async cleanup() {
    await this.browser?.close();
  }
}

module.exports = { AIBrowserAgent };
