/* 本地验证 sector-data-0813f.js（26 日期）在交互页 + 趋势页正常 */
const puppeteer = require("C:/Users/htzg/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core");
const path = require("path");

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: "new",
    args: ["--disable-features=BackForwardCache", "--no-sandbox", "--disable-gpu"]
  });
  const results = {};
  for (const [name, file] of [["交互页", "sector-strength-0811.html"], ["趋势页", "sector-trend-path.html"]]) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    page.on("pageerror", e => console.log(`[${name}] PAGE ERROR:`, e.message));
    page.on("console", m => { if (m.type() === "error") console.log(`[${name}] CONSOLE ERR:`, m.text()); });
    const url = "file:///" + path.resolve(__dirname, "..", file).replace(/\\/g, "/");
    await page.goto(url, { waitUntil: "networkidle0", timeout: 20000 });
    await new Promise(r => setTimeout(r, 1200));
    const info = await page.evaluate(() => {
      if (!window.SECTOR_DB) return { dbLoaded: false };
      const dates = Object.keys(window.SECTOR_DB.dates || {}).sort();
      return {
        dbLoaded: true,
        industryCount: (window.SECTOR_DB.industries || []).length,
        dateCount: dates.length,
        dateRange: [dates[0], dates[dates.length - 1]],
        dots: document.querySelectorAll(".dot").length
      };
    });
    results[name] = info;
    await page.close();
  }
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
  console.log("DONE");
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
