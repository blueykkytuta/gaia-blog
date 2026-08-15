/* 线上验证：密码门自动解锁 + 3 个页面数据加载 */
const puppeteer = require("C:/Users/htzg/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core");
(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: "new",
    args: ["--disable-features=BackForwardCache", "--no-sandbox", "--disable-gpu", "--host-resolver-rules=map carrycore.cc.cd 104.21.56.118"]
  });
  const results = {};
  async function unlock(page) {
    const has = await page.evaluate(() => !!document.getElementById("cc-gate"));
    if (has) { await page.type("#cc-pass", "traderli"); await page.click("#cc-btn"); await new Promise(r => setTimeout(r, 600)); }
  }
  for (const [name, url] of [
    ["交互页", "https://carrycore.cc.cd/sector-strength-0811.html"],
    ["趋势页", "https://carrycore.cc.cd/sector-trend-path.html"],
    ["相对页", "https://carrycore.cc.cd/relative-strength.html"]
  ]) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    page.on("pageerror", e => console.log(`[${name}] PAGE ERROR:`, e.message));
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));
    await unlock(page);
    await new Promise(r => setTimeout(r, 1000));
    const info = await page.evaluate(() => {
      const db = window.SECTOR_DB || window.RELATIVE_DB || null;
      if (!db) return { dbLoaded: false };
      const dates = Object.keys(db.dates || {}).sort();
      return { dbLoaded: true, dateCount: dates.length, range: [dates[0], dates[dates.length-1]], gate: !!document.getElementById("cc-gate") };
    });
    results[name] = info;
    await page.close();
  }
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
