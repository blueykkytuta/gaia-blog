/* CF 迁移后线上验证：首页密码门 + 交互页数据 + 页面渲染 */
const puppeteer = require("C:/Users/htzg/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core");
(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: "new",
    args: ["--disable-features=BackForwardCache", "--no-sandbox", "--disable-gpu", "--host-resolver-rules=map carrycore.cc.cd 104.21.56.118"]
  });
  const results = {};
  async function unlock(page) {
    const has = await page.evaluate(() => !!document.getElementById("cc-gate"));
    if (has) { await page.type("#cc-pass", "traderli"); await page.click("#cc-btn"); await new Promise(r => setTimeout(r, 500)); }
  }
  for (const [name, url] of [
    ["首页", "https://carrycore.cc.cd/index.html"],
    ["交互页", "https://carrycore.cc.cd/sector-strength-0811.html"],
    ["相对页", "https://carrycore.cc.cd/relative-strength.html"]
  ]) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    page.on("pageerror", e => console.log(`[${name}] PAGE ERROR:`, e.message));
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));
    await unlock(page);
    await new Promise(r => setTimeout(r, 800));
    const info = await page.evaluate(() => {
      const db = window.SECTOR_DB || window.RELATIVE_DB || null;
      return {
        title: document.title,
        gateVisible: !!document.getElementById("cc-gate"),
        dbLoaded: db ? Object.keys(db.dates).length : null,
        brand: !!document.querySelector(".brand")
      };
    });
    results[name] = info;
    await page.close();
  }
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
