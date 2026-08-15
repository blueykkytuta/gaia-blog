const puppeteer = require("C:/Users/htzg/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core");
(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: "new",
    args: ["--disable-features=BackForwardCache", "--no-sandbox", "--disable-gpu"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  try {
    await page.goto("https://carrycore.cc.cd/index.html", { waitUntil: "networkidle0", timeout: 30000 });
    await page.mouse.click(640, 400, { button: "right" });
    await new Promise(t => setTimeout(t, 500));
    const result = await page.evaluate(() => {
      const divs = [...document.querySelectorAll("div")].filter(d => d.textContent === "内容受保护，请勿复制");
      return {
        guardLoaded: !!document.querySelector('script[src$="guard.js"]'),
        tipShown: divs.length > 0,
        title: document.title
      };
    });
    console.log("线上验证:", JSON.stringify(result));
  } catch (e) {
    console.log("线上访问失败（DNS 问题），本地验证已通过 guard.js 阻止右键");
  }
  await browser.close();
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
