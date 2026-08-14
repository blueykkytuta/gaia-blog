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

  // 手动派发一个真实 Ctrl+U 事件，观察 guard 是否拦截
  const result = await page.evaluate(() => {
    const ev = new KeyboardEvent("keydown", {
      key: "u", code: "KeyU", ctrlKey: true, shiftKey: false,
      bubbles: true, cancelable: true
    });
    const notPrevented = document.dispatchEvent(ev);
    return { dispatchReturned: notPrevented };
  });
  console.log("Ctrl+U 派发结果:", JSON.stringify(result));

  // 手动派发 F12 对照
  const r2 = await page.evaluate(() => {
    const ev = new KeyboardEvent("keydown", {
      key: "F12", code: "F12", ctrlKey: false, shiftKey: false,
      bubbles: true, cancelable: true
    });
    const notPrevented = document.dispatchEvent(ev);
    return { dispatchReturned: notPrevented };
  });
  console.log("F12 派发结果:", JSON.stringify(r2));
  await browser.close();
})();
