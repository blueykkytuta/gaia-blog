/* 线上验证：交互页 + 趋势页加载 26 日期 */
const puppeteer = require("C:/Users/htzg/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core");
(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: "new",
    args: ["--disable-features=BackForwardCache", "--no-sandbox", "--disable-gpu"]
  });
  const results = {};
  for (const [name, url] of [["交互页", "https://carrycore.cc.cd/sector-strength-0811.html"], ["趋势页", "https://carrycore.cc.cd/sector-trend-path.html"]]) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    page.on("pageerror", e => console.log(`[${name}] PAGE ERROR:`, e.message));
    page.on("console", m => { if (m.type() === "error") console.log(`[${name}] CONSOLE ERR:`, m.text()); });
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));
    const info = await page.evaluate(() => {
      if (!window.SECTOR_DB) return { dbLoaded: false };
      const dates = Object.keys(window.SECTOR_DB.dates || {}).sort();
      const cur = document.querySelector(".date-btn-text, #cur-date-label, .dp-btn span") || null;
      return {
        dbLoaded: true,
        dateCount: dates.length,
        dateRange: [dates[0], dates[dates.length - 1]],
        dots: document.querySelectorAll(".dot").length,
        title: document.title
      };
    });
    results[name] = info;
    await page.close();
  }
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
  console.log("DONE");
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
