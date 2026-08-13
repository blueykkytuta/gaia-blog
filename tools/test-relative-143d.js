/* 本地验证 relative-data-0813b.js（143 日期）加载正常
   用法：node test-relative-v3.js 的同目录脚本
*/
const puppeteer = require("C:/Users/htzg/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core");
const path = require("path");

const FILE = "file:///" + path.resolve(__dirname, "..", "relative-strength.html").replace(/\\/g, "/");

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: "new",
    args: ["--disable-features=BackForwardCache", "--no-sandbox", "--disable-gpu"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on("pageerror", e => console.log("PAGE ERROR:", e.message));
  page.on("console", m => { if (m.type() === "error") console.log("CONSOLE ERR:", m.text()); });

  await page.goto(FILE, { waitUntil: "networkidle0", timeout: 20000 });
  await new Promise(r => setTimeout(r, 1600));

  const info = await page.evaluate(() => {
    const db = window.RELATIVE_DB;
    if (!db) return { dbLoaded: false };
    const dates = Object.keys(db.dates).sort();
    const cur = document.getElementById("dp-cur-label")?.textContent;
    const his = document.getElementById("dp-his-label")?.textContent;
    const lines = document.querySelectorAll("polyline.line-chart-line").length;
    const datebar = document.getElementById("trend-datebar")?.textContent || "";
    return {
      dbLoaded: true,
      industryCount: db.industries.length,
      dateCount: dates.length,
      dateRange: [dates[0], dates[dates.length - 1]],
      curLabel: cur, hisLabel: his,
      lineCount: lines,
      datebar
    };
  });
  console.log(JSON.stringify(info, null, 2));

  await page.screenshot({ path: path.resolve(__dirname, "..", "..", "..", "tmp-relative-143d.png") });
  await browser.close();
  console.log("DONE");
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
