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

  // 在 gB 上安装事件日志
  await page.evaluate(() => {
    window.__log = [];
    document.querySelectorAll(".dot").forEach(el => {
      el.addEventListener("mouseenter", () => window.__log.push("enter:" + el.closest(".sector-group").dataset.name));
      el.addEventListener("mouseleave", () => window.__log.push("leave:" + el.closest(".sector-group").dataset.name));
    });
    // 记录 tooltip 状态变化
    const tt = document.getElementById("tooltip");
    const obs = new MutationObserver(() => window.__log.push("tt-class:" + tt.className));
    obs.observe(tt, { attributes: true, attributeFilter: ["class"] });
  });

  const pos = await page.evaluate(() => {
    const c = document.querySelector(".dot circle");
    const rect = c.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  await page.mouse.move(10, 10);
  await page.mouse.move(pos.x, pos.y, { steps: 5 });
  await new Promise(t => setTimeout(t, 300));
  await page.mouse.move(5, 5, { steps: 10 });
  await new Promise(t => setTimeout(t, 300));

  const log = await page.evaluate(() => window.__log);
  console.log("事件日志:");
  log.forEach(l => console.log("  ", l));
  const finalState = await page.evaluate(() => ({
    active: document.querySelectorAll(".sector-group.active").length,
    faded: document.querySelectorAll(".sector-group.faded").length,
    show: document.getElementById("tooltip").classList.contains("show")
  }));
  console.log("最终状态:", JSON.stringify(finalState));
  await browser.close();
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
