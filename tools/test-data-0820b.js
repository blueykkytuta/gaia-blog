const puppeteer = require("C:/Users/htzg/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core");
const path = require("path");
(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: "new",
    args: ["--disable-features=BackForwardCache", "--no-sandbox", "--disable-gpu"]
  });
  const results = {};
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
    const info = await page.evaluate(() => {
      const db = window.SECTOR_DB || window.RELATIVE_DB || null;
      if (!db) return { dbLoaded: false };
      const dates = Object.keys(db.dates || {}).sort();
      return { dbLoaded: true, dateCount: dates.length, range: [dates[0], dates[dates.length-1]] };
    });
    results[name] = info;
    await page.close();
  }
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
