/* 验证 guard-0814b.js：Ctrl+U（小写 key）能被拦截 */
const puppeteer = require("C:/Users/htzg/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core");
const path = require("path");
(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: "new",
    args: ["--disable-features=BackForwardCache", "--no-sandbox", "--disable-gpu"]
  });
  const page = await browser.newPage();
  const url = "file:///" + path.resolve(__dirname, "..", "index.html").replace(/\\/g, "/");
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });

  const test = (key, code, ctrl, shift) => page.evaluate((k, c, ctrlK, sh) => {
    const ev = new KeyboardEvent("keydown", {
      key: k, code: c, ctrlKey: ctrlK, shiftKey: sh, bubbles: true, cancelable: true
    });
    document.dispatchEvent(ev);
    return { prevented: ev.defaultPrevented };
  }, key, code, ctrl, shift);

  console.log("Ctrl+U(小写key):", JSON.stringify(await test("u", "KeyU", true, false)));
  console.log("Ctrl+U(大写key):", JSON.stringify(await test("U", "KeyU", true, false)));
  console.log("F12:", JSON.stringify(await test("F12", "F12", false, false)));
  console.log("Ctrl+Shift+I:", JSON.stringify(await test("I", "KeyI", true, true)));
  console.log("Ctrl+S:", JSON.stringify(await test("s", "KeyS", true, false)));
  console.log("普通按键A(不应拦):", JSON.stringify(await test("a", "KeyA", false, false)));
  await browser.close();
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
