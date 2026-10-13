const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const [f, w, h] of [['banner', 2560, 1440], ['avatar', 800, 800]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.goto('file://' + path.resolve(__dirname, f + '.html'));
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(300);
    await p.screenshot({ path: path.resolve(__dirname, f + '.png') });
  }
  await b.close();
})();
