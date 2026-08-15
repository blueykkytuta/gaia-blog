/* 线上验证：趋势路径页 hover 基准圆效果 */
const puppeteer = require("C:/Users/htzg/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core");
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
  await page.goto("https://carrycore.cc.cd/sector-trend-path.html", { waitUntil: "networkidle0", timeout: 30000 });
  await new Promise(r => setTimeout(r, 2500));
  const r = await page.evaluate(() => {
    const c = document.querySelector(".dot circle");
    if (!c) return { err: "no base circle" };
    const rect = c.getBoundingClientRect();
    c.dispatchEvent(new MouseEvent("mouseenter", { clientX: rect.left + rect.width/2, clientY: rect.top + rect.height/2, bubbles: true }));
    return {};
  });
  await new Promise(t => setTimeout(t, 200));
  const state = await page.evaluate(() => {
    const tt = document.getElementById("tooltip");
    return {
      tooltipDisplay: tt.style.display,
      tooltipText: tt.textContent.replace(/\s+/g, " ").trim(),
      tooltipBg: getComputedStyle(tt).backgroundColor,
      activeCount: document.querySelectorAll(".sector-group.active").length,
      fadedCount: document.querySelectorAll(".sector-group.faded").length
    };
  });
  console.log(JSON.stringify(state, null, 2));
  await page.screenshot({ path: "C:/Users/htzg/WorkBuddy/tmp-trend-hover-online.png" });
  await browser.close();
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
