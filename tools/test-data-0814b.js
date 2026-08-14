/* 本地验证：一号库 30 日期（交互页+趋势页）、二号库 144 日期（相对页）
   密码门配合：自动输入 traderli 解锁 */
const puppeteer = require("C:/Users/htzg/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core");
const path = require("path");

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: "new",
    args: ["--disable-features=BackForwardCache", "--no-sandbox", "--disable-gpu"]
  });
  const results = {};

  async function unlock(page) {
    const hasGate = await page.evaluate(() => !!document.getElementById("cc-gate"));
    if (hasGate) {
      await page.type("#cc-pass", "traderli");
      await page.click("#cc-btn");
      await new Promise(r => setTimeout(r, 600));
    }
  }

  for (const [name, file] of [
    ["交互页", "sector-strength-0811.html"],
    ["趋势页", "sector-trend-path.html"],
    ["相对页", "relative-strength.html"]
  ]) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    page.on("pageerror", e => console.log(`[${name}] PAGE ERROR:`, e.message));
    const url = "file:///" + path.resolve(__dirname, "..", file).replace(/\\/g, "/");
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await new Promise(r => setTimeout(r, 1200));
    await unlock(page);
    await new Promise(r => setTimeout(r, 800));
    const info = await page.evaluate(() => {
      const db = window.SECTOR_DB || window.RELATIVE_DB || null;
      if (!db) return { dbLoaded: false };
      const dates = Object.keys(db.dates || {}).sort();
      return {
        dbLoaded: true,
        industryCount: (db.industries || []).length,
        dateCount: dates.length,
        dateRange: [dates[0], dates[dates.length - 1]],
        gateStill: !!document.getElementById("cc-gate")
      };
    });
    results[name] = info;
    await page.close();
  }
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
  console.log("DONE");
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
