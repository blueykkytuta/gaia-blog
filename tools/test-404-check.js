const puppeteer = require("C:/Users/htzg/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core");
(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: "new",
    args: ["--disable-features=BackForwardCache", "--no-sandbox", "--disable-gpu"]
  });
  const page = await browser.newPage();
  page.on("response", r => { if (r.status() >= 400) console.log("HTTP", r.status(), "->", r.url()); });
  await page.goto("https://carrycore.cc.cd/sector-strength-0811.html", { waitUntil: "networkidle0", timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));
  await browser.close();
  console.log("DONE");
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
