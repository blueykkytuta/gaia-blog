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
  // 右键
  await page.mouse.click(640, 400, { button: "right" });
  await new Promise(t => setTimeout(t, 500));
  await page.screenshot({ path: "C:/Users/htzg/WorkBuddy/tmp-guard.png" });
  const tip = await page.evaluate(() => {
    const divs = [...document.querySelectorAll("div")].filter(d => d.textContent === "内容受保护，请勿复制");
    return divs.length > 0 ? "提示已显示: " + divs[0].textContent : "提示未显示";
  });
  console.log(tip);
  await browser.close();
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
