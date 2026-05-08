# Browser Automation Patterns & Edge Cases

## Anti-Bot Detection

### Signs a site is blocking you
- Blank page or CAPTCHA after navigation
- `page.evaluate()` returns null for obvious elements
- Request intercepted before page loads

### Countermeasures (in order of effort)
1. Use `puppeteer-extra-plugin-stealth` — covers most cases
2. Randomize viewport: `{ width: 1366 + Math.floor(Math.random()*200), height: 768 }`
3. Add mouse movement before clicks: `page.mouse.move(x, y)` → wait 50-200ms → click
4. Type with delay: `{ delay: 40 + Math.random() * 80 }`
5. Rotate user agents between sessions
6. If still blocked, use a headful browser (visible window) + slow down

---

## SPA / React / Vue Sites

### Problem: element not in DOM yet
```js
// Wrong: element may not exist yet
const el = await page.$('.results');

// Right: wait for it
await page.waitForSelector('.results', { timeout: 10000 });
const el = await page.$('.results');
```

### Problem: click triggers async load, but no navigation event
```js
await Promise.all([
  page.waitForSelector('.new-content', { visible: true }),
  existingButton.click(),
]);
```

### Problem: form submit doesn't navigate
```js
// SPA forms often intercept submit — look for DOM change instead
await Promise.all([
  page.waitForFunction(() => document.querySelector('.success-message') !== null),
  submitBtn.click(),
]);
```

---

## iframes

```js
// Find iframe and get its frame context
const iframeEl = await page.waitForSelector('iframe#my-frame');
const frame = await iframeEl.contentFrame();
const input = await frame.$('input[name="email"]');
await input.type('user@example.com');
```

---

## File Downloads

```js
// Set download directory BEFORE triggering download
const client = await page.createCDPSession();
await client.send('Page.setDownloadBehavior', {
  behavior: 'allow',
  downloadPath: '/tmp/downloads',
});

await page.click('#download-btn');

// Poll for file to appear
const { waitForFile } = require('fs/promises');
// or just wait a fixed time for simplicity
await page.waitForTimeout(3000);
```

---

## Pagination / Infinite Scroll

### Click-based pagination
```js
while (true) {
  // Collect current page data
  const items = await page.$$eval('.item', els => els.map(e => e.textContent));
  allItems.push(...items);

  const nextBtn = await page.$('[aria-label="Next page"], .pagination-next:not([disabled])');
  if (!nextBtn) break;

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
    nextBtn.click(),
  ]);
}
```

### Infinite scroll
```js
let prevCount = 0;
while (true) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);
  
  const count = await page.$$eval('.item', els => els.length);
  if (count === prevCount) break; // No new items loaded
  prevCount = count;
}
```

---

## Screenshots & PDF

```js
// Full page screenshot
await page.screenshot({ path: 'full.png', fullPage: true });

// Element screenshot
const el = await page.$('.chart');
await el.screenshot({ path: 'chart.png' });

// PDF (headless only)
await page.pdf({
  path: 'output.pdf',
  format: 'A4',
  printBackground: true,
  margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' },
});
```

---

## Authentication

### Session reuse (avoid logging in every run)
```js
// Save cookies after first login
const cookies = await page.cookies();
require('fs').writeFileSync('session.json', JSON.stringify(cookies));

// Restore on subsequent runs
const saved = JSON.parse(require('fs').readFileSync('session.json'));
await page.setCookie(...saved);
await page.goto(protectedUrl); // Already logged in
```

### Basic HTTP auth
```js
await page.authenticate({ username: 'user', password: 'pass' });
await page.goto('https://protected.example.com');
```

---

## Network Interception Patterns

### Mock API responses
```js
await page.setRequestInterception(true);
page.on('request', req => {
  if (req.url().includes('/api/data')) {
    req.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ mocked: true, items: [] }),
    });
  } else {
    req.continue();
  }
});
```

### Capture API calls
```js
const apiCalls = [];
page.on('response', async res => {
  if (res.url().includes('/api/')) {
    try {
      const json = await res.json();
      apiCalls.push({ url: res.url(), data: json });
    } catch {}
  }
});
```

---

## Common Errors & Fixes

| Error | Cause | Fix |
|---|---|---|
| `Target closed` | Page crashed or was closed | Wrap in try/catch; re-initialize browser |
| `Execution context was destroyed` | Navigation happened mid-evaluate | Add `waitForNavigation` before evaluating |
| `Node is detached from document` | DOM changed between `$()` and `click()` | Re-query element right before use |
| `Timeout exceeded` | Selector never appeared | Increase timeout; check if site requires login |
| `net::ERR_BLOCKED_BY_CLIENT` | Ad blocker plugin too aggressive | Add exceptions or disable for trusted sites |
| CAPTCHA page shown | Bot detected | Use stealth plugin + slow down all actions |
