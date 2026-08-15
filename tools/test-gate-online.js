/* 线上验证密码门：带 --resolve 强制 Cloudflare IP */
const puppeteer = require("C:/Users/htzg/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core");
(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: "new",
    args: ["--disable-features=BackForwardCache", "--no-sandbox", "--disable-gpu", "--host-resolver-rules=map carrycore.cc.cd 104.21.56.118"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  try {
    await page.goto("https://carrycore.cc.cd/index.html", { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));
    const r1 = await page.evaluate(() => ({
      gateExists: !!document.getElementById("cc-gate"),
      inputExists: !!document.querySelector("#cc-pass"),
      url: location.href,
      title: document.title
    }));
    console.log("首页 未解锁状态:", JSON.stringify(r1));
    if (r1.gateExists) {
      await page.type("#cc-pass", "traderli");
      await page.click("#cc-btn");
      await new Promise(r => setTimeout(r, 800));
      const r2 = await page.evaluate(() => ({
        gateGone: !document.getElementById("cc-gate"),
        saved: JSON.parse(localStorage.getItem("cc_gate") || "null")
      }));
      console.log("首页 输密码后:", JSON.stringify(r2));
    }
    await page.screenshot({ path: "C:/Users/htzg/WorkBuddy/tmp-gate-online.png" });
  } catch (e) {
    console.log("FAIL:", e.message);
  }
  await browser.close();
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
