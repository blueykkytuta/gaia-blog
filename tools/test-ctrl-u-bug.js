/* 复现 Ctrl+U 失效 bug：检查 key 值 */
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
  await page.goto(url, { waitUntil: "networkidle0", timeout: 20000 });

  // 监听 keydown 看实际 key/code 值
  const info = await page.evaluate(() => {
    return new Promise(resolve => {
      document.addEventListener("keydown", function(e) {
        resolve({ key: e.key, code: e.code, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, defaultPrevented: e.defaultPrevented });
      }, { once: true });
    });
  });
  await page.keyboard.down("Control");
  await page.keyboard.press("KeyU");
  await page.keyboard.up("Control");
  await new Promise(t => setTimeout(t, 300));
  console.log("Ctrl+U 实际事件:", JSON.stringify(info));
  await browser.close();
})();
