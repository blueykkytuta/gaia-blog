const puppeteer = require("C:/Users/htzg/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core");
(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: "new",
    args: ["--disable-features=BackForwardCache", "--no-sandbox", "--disable-gpu"]
  });
  const results = {};
  for (const [name, url] of [
    ["交互图", "https://carrycore.cc.cd/sector-strength-0811.html"],
    ["趋势页", "https://carrycore.cc.cd/sector-trend-path.html"]
  ]) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
    await new Promise(r => setTimeout(r, 2500));
    const pos = await page.evaluate(() => {
      const c = document.querySelector(".dot circle") || document.querySelector(".dot");
      const rect = c.getBoundingClientRect();
      return { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
    });
    await page.mouse.move(10, 10);
    await page.mouse.move(pos.x, pos.y, { steps: 5 });
    await new Promise(t => setTimeout(t, 300));
    const info = await page.evaluate((p) => {
      const tt = document.getElementById("tooltip");
      const tr = tt.getBoundingClientRect();
      const c = document.querySelector(".dot circle");
      const cr = c.getBoundingClientRect();
      return {
        tooltip: { left: Math.round(tr.left), top: Math.round(tr.top), w: Math.round(tr.width), h: Math.round(tr.height) },
        circle: { left: Math.round(cr.left), top: Math.round(cr.top), r: Math.round(cr.width/2) },
        mouse: { x: Math.round(p.x), y: Math.round(p.y) },
        overlap: !(tr.right < cr.left || tr.left > cr.right || tr.bottom < cr.top || tr.top > cr.bottom),
        opacity: getComputedStyle(tt).opacity
      };
    }, pos);
    results[name] = info;
    await page.close();
  }
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
