// Retake the three screenshots from a built out/ directory.
// Usage: node tools/shoot.mjs <out-dir>   (writes PNGs into <out-dir>/screenshots
// and into screenshots/; re-run main.ts afterwards so dossier.json matches.)
// Needs the Playwright bundled with this VM's web-artifact runtime and the
// hatch WebGL policy file; plain `chrome --screenshot` does not start here.
import { chromium } from '/opt/muse/assets/spaces/ts-runtime/dist/node_modules/playwright/index.mjs';
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2] ?? 'out';
const shots = [
  ['1-board.png', `${base}/dashboard/index.html`],
  ['2-detail.png', `${base}/dashboard/index.html#p=steakhouse-financial`],
  ['3-filtered.png', `${base}/dashboard/index.html#category=Risk%20Curators`],
];
const browser = await chromium.launch({
  executablePath: '/opt/meta-chromium/chrome',
  args: [
    '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--hatch-webgl-allowed-domains-file=/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt',
    '--hatch-webgl-allowed-domains-sha256=8097045f0459c96c4cdc76e3a1af4e0f43f640b4b59c43d6db35e3641c0264c6',
  ],
});
for (const [name, url] of shots) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`file://${process.cwd()}/${url}`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `/tmp/${name}` });
  copyFileSync(`/tmp/${name}`, join('screenshots', name));
  console.log(name, 'ok');
  await page.close();
}
await browser.close();
