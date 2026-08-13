/* 完整验证：mouseenter 显示 tooltip（opacity>0）+ mouseleave 完全恢复 */
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
  page.on("pageerror", e => console.log("PAGE ERROR:", e.message));
  page.on("console", m => { if (m.type() === "error") console.log("CONSOLE ERR:", m.text()); });

  await page.goto(FILE, { waitUntil: "networkidle0", timeout: 20000 });
  await new Promise(r => setTimeout(r, 2500));

  // 模拟真实鼠标移动进入基准圆（用 page.mouse 触发真实事件流）
  const pos = await page.evaluate(() => {
    const c = document.querySelector(".dot circle");
    const rect = c.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  await page.mouse.move(10, 10);           // 先移到角落
  await page.mouse.move(pos.x, pos.y, { steps: 5 });  // 移入圆圈

  await new Promise(t => setTimeout(t, 300));
  const onState = await page.evaluate(() => {
    const tt = document.getElementById("tooltip");
    return {
      tooltipOpacity: getComputedStyle(tt).opacity,
      tooltipText: tt.textContent.replace(/\s+/g, " ").trim(),
      activeCount: document.querySelectorAll(".sector-group.active").length,
      fadedCount: document.querySelectorAll(".sector-group.faded").length
    };
  });
  console.log("移入后:", JSON.stringify(onState));

  // 移到图表外空白处（真实 mouseleave）
  await page.mouse.move(5, 5, { steps: 8 });
  await new Promise(t => setTimeout(t, 300));
  const offState = await page.evaluate(() => {
    const tt = document.getElementById("tooltip");
    return {
      tooltipOpacity: getComputedStyle(tt).opacity,
      tooltipText: tt.textContent.replace(/\s+/g, " ").trim(),
      activeCount: document.querySelectorAll(".sector-group.active").length,
      fadedCount: document.querySelectorAll(".sector-group.faded").length,
      tooltipDisplay: tt.style.display
    };
  });
  console.log("移出后:", JSON.stringify(offState));

  await browser.close();
  console.log("DONE");
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
