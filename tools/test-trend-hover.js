/* 本地验证 sector-trend-path-v4.js：基准圆 hover 效果（交互图同款） */
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
  await new Promise(r => setTimeout(r, 2500)); // 等入场动画

  // 找一个基准圆（.dot circle）并 hover
  const r = await page.evaluate(() => {
    const baseCircle = document.querySelector(".dot circle");
    if (!baseCircle) return { err: "no base circle" };
    const rect = baseCircle.getBoundingClientRect();
    baseCircle.dispatchEvent(new MouseEvent("mouseenter", {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      bubbles: true
    }));
    return {
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2
    };
  });
  console.log("基准圆位置:", JSON.stringify(r));
  await new Promise(t => setTimeout(t, 200));

  const state = await page.evaluate(() => {
    const tt = document.getElementById("tooltip");
    const groups = document.querySelectorAll(".sector-group");
    const activeGroups = document.querySelectorAll(".sector-group.active");
    const fadedGroups = document.querySelectorAll(".sector-group.faded");
    return {
      tooltipDisplay: tt.style.display,
      tooltipText: tt.textContent.replace(/\s+/g, " ").trim(),
      tooltipBg: getComputedStyle(tt).backgroundColor,
      totalGroups: groups.length,
      activeCount: activeGroups.length,
      fadedCount: fadedGroups.length,
      activeLabel: activeGroups[0] ? activeGroups[0].getAttribute("data-name") : null
    };
  });
  console.log("hover 状态:", JSON.stringify(state, null, 2));

  await page.screenshot({ path: path.resolve(__dirname, "..", "..", "..", "tmp-trend-hover.png") });

  // 验证对照圆 hover 保持原行为（完整 tooltip）
  const refState = await page.evaluate(() => {
    const refCircle = document.querySelector(".ref-dot circle");
    if (!refCircle) return { err: "no ref circle" };
    const rect = refCircle.getBoundingClientRect();
    refCircle.dispatchEvent(new MouseEvent("mouseenter", {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      bubbles: true
    }));
    return {};
  });
  await new Promise(t => setTimeout(t, 200));
  const refAfter = await page.evaluate(() => {
    const tt = document.getElementById("tooltip");
    const activeGroups = document.querySelectorAll(".sector-group.active");
    const fadedGroups = document.querySelectorAll(".sector-group.faded");
    return {
      tooltipText: tt.textContent.replace(/\s+/g, " ").trim(),
      hasActive: activeGroups.length > 0,
      fadedCount: fadedGroups.length
    };
  });
  console.log("对照圆 hover:", JSON.stringify(refAfter));

  await browser.close();
  console.log("DONE");
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
