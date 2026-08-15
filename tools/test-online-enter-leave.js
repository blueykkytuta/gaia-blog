/* 线上验证：真实鼠标 enter/leave 全流程 */
const puppeteer = require("C:/Users/htzg/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core");
(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: "new",
    args: ["--disable-features=BackForwardCache", "--no-sandbox", "--disable-gpu"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto("https://carrycore.cc.cd/sector-trend-path.html", { waitUntil: "networkidle0", timeout: 30000 });
  await new Promise(r => setTimeout(r, 2500));
  const pos = await page.evaluate(() => {
    const c = document.querySelector(".dot circle");
    const rect = c.getBoundingClientRect();
    return { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
  });
  await page.mouse.move(10, 10);
  await page.mouse.move(pos.x, pos.y, { steps: 5 });
  await new Promise(t => setTimeout(t, 300));
  const onState = await page.evaluate(() => ({
    opacity: getComputedStyle(document.getElementById("tooltip")).opacity,
    active: document.querySelectorAll(".sector-group.active").length,
    faded: document.querySelectorAll(".sector-group.faded").length
  }));
  await page.mouse.move(5, 5, { steps: 8 });
  await new Promise(t => setTimeout(t, 300));
  const offState = await page.evaluate(() => ({
    opacity: getComputedStyle(document.getElementById("tooltip")).opacity,
    active: document.querySelectorAll(".sector-group.active").length,
    faded: document.querySelectorAll(".sector-group.faded").length
  }));
  console.log("线上 移入后:", JSON.stringify(onState));
  console.log("线上 移出后:", JSON.stringify(offState));
  await browser.close();
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
