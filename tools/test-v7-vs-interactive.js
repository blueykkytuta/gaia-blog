/* 对比：交互图 vs 趋势页 v7 的 tooltip 定位行为（同窗口宽度下是否一致、是否挡圆） */
const puppeteer = require("C:/Users/htzg/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core");
const path = require("path");

async function testPage(browser, file, winW) {
  const page = await browser.newPage();
  await page.setViewport({ width: winW, height: 900 });
  const url = file.startsWith("http") ? file : "file:///" + path.resolve(__dirname, "..", file).replace(/\\/g, "/");
  await page.goto(url, { waitUntil: "networkidle0", timeout: 20000 });
  await new Promise(r => setTimeout(r, 2500));

  // 找一个基准圆（趋势页 .dot circle / 交互图 .dot）
  const pos = await page.evaluate(() => {
    const c = document.querySelector(".dot circle") || document.querySelector(".dot");
    const rect = c.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  await page.mouse.move(10, 10);
  await page.mouse.move(pos.x, pos.y, { steps: 5 });
  await new Promise(t => setTimeout(t, 300));

  const final = await page.evaluate((p) => {
    const tt = document.getElementById("tooltip");
    const tr = tt.getBoundingClientRect();
    const c = document.querySelector(".dot circle");
    const cr = c.getBoundingClientRect();
    return {
      tooltip: { left: Math.round(tr.left), top: Math.round(tr.top), w: Math.round(tr.width), h: Math.round(tr.height) },
      circle: { left: Math.round(cr.left), top: Math.round(cr.top), r: Math.round(cr.width / 2) },
      mouse: p,
      overlapCircle: !(tr.right < cr.left || tr.left > cr.right || tr.bottom < cr.top || tr.top > cr.bottom)
    };
  }, pos);
  await page.close();
  return final;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: "new",
    args: ["--disable-features=BackForwardCache", "--no-sandbox", "--disable-gpu"]
  });
  for (const w of [1280, 1000, 800]) {
    console.log(`\n=== 窗口宽 ${w}px ===`);
    const inter = await testPage(browser, "sector-strength-0811.html", w);
    const trend = await testPage(browser, "sector-trend-path.html", w);
    console.log("交互图:", JSON.stringify({ tt: inter.tooltip, circle: inter.circle, mouse: inter.mouse, overlap: inter.overlapCircle }));
    console.log("趋势页:", JSON.stringify({ tt: trend.tooltip, circle: trend.circle, mouse: trend.mouse, overlap: trend.overlapCircle }));
  }
  await browser.close();
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
