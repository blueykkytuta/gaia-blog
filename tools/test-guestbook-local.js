/* 本地验证 guestbook.html：无 Worker 时应显示"暂时无法连接"，不崩溃 */
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
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  const url = "file:///" + path.resolve(__dirname, "..", "guestbook.html").replace(/\\/g, "/");
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
  await new Promise(r => setTimeout(r, 1200));
  const info = await page.evaluate(() => ({
    gateAbsent: !document.getElementById("cc-gate"),
    nameInput: !!document.getElementById("gb-name"),
    textArea: !!document.getElementById("gb-text"),
    submit: !!document.getElementById("gb-submit"),
    count: document.getElementById("gb-count").textContent,
    listState: document.querySelector(".gb-list").textContent.trim().slice(0, 40),
    title: document.title,
    navGuestbook: !!document.querySelector('a[href="guestbook.html"]')
  }));
  console.log(JSON.stringify(info, null, 2));
  console.log("JS 错误:", errors.length ? errors : "无");
  await page.screenshot({ path: "C:/Users/htzg/WorkBuddy/tmp-guestbook.png" });
  await browser.close();
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
