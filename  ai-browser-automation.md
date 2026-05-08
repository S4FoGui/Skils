---
name: ai-browser-automation
description: >
  Build AI-powered browser automation scripts using Puppeteer. Use this skill whenever
  the user wants to automate browser tasks, scrape websites, interact with web UIs
  programmatically, or build agents that control a browser. Trigger on: "automate
  browser", "scrape website", "puppeteer", "browser agent", "click buttons
  automatically", "fill forms automatically", "extract data from pages", "navigate
  website programmatically", or any request involving automated browser control —
  even if phrased casually like "make a bot that does X on site Y".
---

# AI Browser Automation Skill

Builds production-quality Puppeteer browser automation with a modular agent architecture.
Always check the user's goal first: scraping, UI automation, testing, or a full AI agent?

## Architecture Overview

```
AIBrowserAgent (orchestrator)
├── SmartSearchModule   – detects & executes searches on any site
├── UILearnerModule     – catalogs interactive elements, learns patterns
├── PerformanceOptimizer – blocks trackers, lazy-loads, defers scripts
└── DataExtractor       – structured extraction of headings/links/tables/meta
```

## Quick Setup

```bash
npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth
```

```js
// entry.js
const { AIBrowserAgent } = require('./agent');

(async () => {
  const agent = new AIBrowserAgent();
  await agent.initialize({ headless: false });

  const result = await agent.processCommand('search "Node.js tutorial" on google.com');
  console.log(result);

  await agent.cleanup();
})();
```

---

## Module Reference

Read the relevant reference file before implementing each module:

| Module | File | When to read |
|---|---|---|
| Full agent code | `references/agent.js` | When building the main orchestrator |
| Search detection | `references/search-module.js` | When implementing search across sites |
| UI learning | `references/ui-learner.js` | When cataloging/interacting with elements |
| Performance | `references/perf-optimizer.js` | When blocking ads or optimizing load |
| Patterns & edge cases | `references/patterns.md` | When debugging or handling tricky sites |

---

## Implementation Decisions

### Choosing headless mode
- `headless: false` — use during development; shows the browser window
- `headless: 'new'` — use in production (Puppeteer ≥ 20); new headless mode avoids detection better than `headless: true`

### Search submission strategy
Always try `Enter` first, then fall back to submit button. Some SPAs intercept Enter and require a button click.

### Request interception
Enable **before** `page.goto()`. Enabling after navigation may miss early requests.

```js
await page.setRequestInterception(true); // MUST come before goto()
page.on('request', req => { ... });
await page.goto(url);
```

### Selector priority (most → least robust)
1. `#id` — fastest, breaks on dynamic IDs
2. `[aria-label="..."]` — semantic, preferred for buttons/inputs
3. `data-testid` — stable in tested apps
4. Role + text: `[role="button"]:has-text("Submit")`
5. CSS class — fragile, last resort

---

## Common Patterns

### Wait for dynamic content
```js
// Wait for specific element
await page.waitForSelector('.results-container', { timeout: 10000 });

// Wait for network to settle
await page.waitForNavigation({ waitUntil: 'networkidle2' });

// Wait for arbitrary condition
await page.waitForFunction(() => document.querySelectorAll('.item').length > 0);
```

### Handle popups / cookie banners
```js
const dismissSelectors = [
  '[aria-label*="Accept"]', '[aria-label*="Agree"]',
  'button:has-text("Accept all")', '#onetrust-accept-btn-handler',
  '.cookie-accept', '[data-cookiebanner="accept_button"]'
];

for (const sel of dismissSelectors) {
  const btn = await page.$(sel).catch(() => null);
  if (btn) { await btn.click(); break; }
}
```

### Scroll to load lazy content
```js
await page.evaluate(async () => {
  await new Promise(resolve => {
    let total = 0;
    const timer = setInterval(() => {
      window.scrollBy(0, 300);
      total += 300;
      if (total >= document.body.scrollHeight) {
        clearInterval(timer);
        resolve();
      }
    }, 100);
  });
});
```

### Avoid bot detection
```js
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

// Also: randomize typing delay, move mouse before clicking
await element.type(text, { delay: 40 + Math.random() * 60 });
await page.mouse.move(x + Math.random() * 5, y + Math.random() * 5);
await element.click();
```

---

## Error Handling Template

```js
async function safeAction(page, action, description) {
  try {
    return await action();
  } catch (err) {
    // Capture screenshot for debugging
    await page.screenshot({ path: `error_${Date.now()}.png` });
    throw new Error(`Failed: ${description} — ${err.message}`);
  }
}
```

---

## Output Formats

When the goal is **data extraction**, return structured JSON:
```json
{
  "url": "https://...",
  "timestamp": "...",
  "data": {
    "headings": [...],
    "links": [{ "text": "...", "href": "..." }],
    "tables": [[["col1", "col2"], ["v1", "v2"]]],
    "metadata": { "title": "...", "description": "..." }
  }
}
```

When the goal is **automation**, return a result summary:
```json
{
  "success": true,
  "action": "search | navigate | fill_form | click | extract",
  "url": "https://...",
  "details": { ... }
}
```

---

## Checklist Before Delivering Code

- [ ] `setRequestInterception` called before `goto` (if used)
- [ ] All `page.$()` calls handle `null` (element not found)
- [ ] Navigation awaited with appropriate `waitUntil`
- [ ] `browser.close()` in `finally` block
- [ ] Stealth plugin used if target site detects bots
- [ ] Selectors use aria-label or data-testid where possible
- [ ] Typing uses randomized delay (human-like)
- [ ] Error handler captures screenshot for debugging
