/* 本地验证 relative-chart-v3：
   1) 重播动画真正生效：检查 polyline 是否被设置 stroke-dasharray，且动画期间 dashoffset 变化 + 截图对比
   2) hover 时 xdate-label 只显示日期（无"日期："前缀）
   用法：node test-relative-v3.js
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

  // 等首帧动画结束后（1.5s 后线条应完整）
  await new Promise(r => setTimeout(r, 1600));

  const lines = await page.$$eval("polyline.line-chart-line", els => els.length);
  console.log("折线数量:", lines);

  // 检查第一条折线的 dasharray（内联或 computed）
  const dashInfo = await page.evaluate(() => {
    const p = document.querySelector("polyline.line-chart-line");
    if (!p) return null;
    return {
      attrDash: p.getAttribute("stroke-dasharray"),
      computedDash: getComputedStyle(p).strokeDasharray,
      computedOffset: getComputedStyle(p).strokeDashoffset,
      anims: p.getAnimations().length
    };
  });
  console.log("首条折线状态:", JSON.stringify(dashInfo));

  // --- 测试 1：点击重播，验证动画中途 dashoffset 确实在变化 ---
  await page.evaluate(() => {
    const p = document.querySelector("polyline.line-chart-line");
    window.__len = p.getTotalLength ? p.getTotalLength() : 0;
  });
  const len0 = await page.evaluate(() => window.__len);
  console.log("折线总长:", len0);

  await page.click("#btn-replay");
  // 动画进行中（每折线 delay idx*60ms，总 900ms；取中间时刻）
  await new Promise(r => setTimeout(r, 300));
  const midState = await page.evaluate(() => {
    const p = document.querySelector("polyline.line-chart-line");
    const cs = getComputedStyle(p);
    return {
      dasharray: cs.strokeDasharray,
      dashoffset: cs.strokeDashoffset,
      anims: p.getAnimations().length
    };
  });
  console.log("重播 300ms 时:", JSON.stringify(midState));

  // 动画结束后 dashoffset 应为 0
  await new Promise(r => setTimeout(r, 1500));
  const endState = await page.evaluate(() => {
    const p = document.querySelector("polyline.line-chart-line");
    return { dashoffset: getComputedStyle(p).strokeDashoffset, anims: p.getAnimations().length };
  });
  console.log("重播结束后:", JSON.stringify(endState));

  // 截图对比：动画中途（offset 大 = 线条短）vs 结束（完整）
  await page.click("#btn-replay");
  await new Promise(r => setTimeout(r, 250));
  await page.screenshot({ path: path.resolve(__dirname, "..", "..", "..", "tmp-relative-mid.png") });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.resolve(__dirname, "..", "..", "..", "tmp-relative-end.png") });

  // --- 测试 2：hover 显示日期（无前缀） ---
  await page.evaluate(() => {
    const svg = document.querySelector("#chart");
    const r = svg.getBoundingClientRect();
    const ev = new MouseEvent("mousemove", { clientX: r.left + r.width * 0.6, clientY: r.top + r.height * 0.4, bubbles: true });
    svg.dispatchEvent(ev);
  });
  await new Promise(r => setTimeout(r, 200));
  const xdate = await page.evaluate(() => {
    const el = document.querySelector("#xdate-label");
    return { display: el.style.display, text: el.textContent };
  });
  console.log("hover 日期标签:", JSON.stringify(xdate));

  await browser.close();
  console.log("DONE");
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
