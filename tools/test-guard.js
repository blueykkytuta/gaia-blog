/* 验证 guard.js：右键禁用 + F12/Ctrl+U 拦截 + 提示出现 */
const puppeteer = require("C:/Users/htzg/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core");
const path = require("path");

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: "new",
    args: ["--disable-features=BackForwardCache", "--no-sandbox", "--disable-gpu"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const url = "file:///" + path.resolve(__dirname, "..", "index.html").replace(/\\/g, "/");
  await page.goto(url, { waitUntil: "networkidle0", timeout: 20000 });

  // 1. 模拟右键
  await page.evaluate(() => {
    const ev = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    document.body.dispatchEvent(ev);
  });
  await new Promise(t => setTimeout(t, 300));
  const tip1 = await page.evaluate(() => {
    const t = document.querySelector('div[style*="position:fixed"]');
    return t ? t.textContent : "（无提示）";
  });
  console.log("右键后提示:", tip1);

  // 2. 模拟 F12
  await page.keyboard.press("F12");
  await new Promise(t => setTimeout(t, 300));
  const tip2 = await page.evaluate(() => {
    const t = document.querySelector('div[style*="position:fixed"]');
    return t ? t.textContent : "（无提示）";
  });
  console.log("F12 后提示:", tip2);

  // 3. 验证右键默认菜单被阻止（contextmenu 默认行为无法直接测，但事件被 preventDefault 即可）
  const blocked = await page.evaluate(() => {
    let defaultPrevented = false;
    const ev = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    document.body.dispatchEvent(ev);
    defaultPrevented = ev.defaultPrevented;
    return defaultPrevented;
  });
  console.log("右键已阻止:", blocked);

  // 4. guard.js 已加载
  const loaded = await page.evaluate(() => typeof window !== "undefined" && document.querySelector('script[src$="guard.js"]') !== null);
  console.log("guard.js 已加载:", loaded);

  await browser.close();
  console.log("DONE");
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
