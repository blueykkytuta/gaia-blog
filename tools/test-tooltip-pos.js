const puppeteer = require("C:/Users/htzg/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core");
const path = require("path");
const FILE = "file:///" + path.resolve(__dirname, "..", "sector-trend-path.html").replace(/\\/g, "/");
(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: "new",
    args: ["--disable-features=BackForwardCache", "--no-sandbox", "--disable-gpu"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(FILE, { waitUntil: "networkidle0", timeout: 20000 });
  await new Promise(r => setTimeout(r, 2500));

  // 鼠标移到第一个基准圆上
  const pos = await page.evaluate(() => {
    const c = document.querySelector(".dot circle");
    const rect = c.getBoundingClientRect();
    return { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
  });
  await page.mouse.move(10, 10);
  await page.mouse.move(pos.x, pos.y, { steps: 5 });
  await new Promise(t => setTimeout(t, 300));

  const info = await page.evaluate(() => {
    const tt = document.getElementById("tooltip");
    const tr = tt.getBoundingClientRect();
    const c = document.querySelector(".dot circle");
    const cr = c.getBoundingClientRect();
    return {
      tooltipRect: { left: Math.round(tr.left), top: Math.round(tr.top), w: Math.round(tr.width), h: Math.round(tr.height) },
      circleRect: { left: Math.round(cr.left), top: Math.round(cr.top), r: Math.round(cr.width/2) },
      overlap: !(tr.right < cr.left || tr.left > cr.right || tr.bottom < cr.top || tr.top > cr.bottom),
      tooltipOpacity: getComputedStyle(tt).opacity
    };
  });
  console.log(JSON.stringify(info, null, 2));
  console.log("tooltip 与圆圈重叠:", info.overlap ? "是（有问题）" : "否（✓ 不挡）");

  await page.screenshot({ path: "C:/Users/htzg/WorkBuddy/tmp-tooltip-far.png" });
  await browser.close();
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
