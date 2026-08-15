const puppeteer = require("C:/Users/htzg/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core");
const path = require("path");
const FILE = "file:///" + path.resolve(__dirname, "..", "sector-trend-path.html").replace(/\\/g, "/");
(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: "new",
    args: ["--disable-features=BackForwardCache", "--no-sandbox", "--disable-gpu"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on("console", m => console.log("CONSOLE:", m.type(), m.text()));
  await page.goto(FILE, { waitUntil: "networkidle0", timeout: 20000 });
  await new Promise(r => setTimeout(r, 2500));

  // 手动派发 mouseenter 到 gB
  const r1 = await page.evaluate(() => {
    const gB = document.querySelector(".dot");
    gB.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    return { active: document.querySelectorAll(".sector-group.active").length };
  });
  console.log("enter 后 active:", r1.active);
  await new Promise(t => setTimeout(t, 200));

  // 手动派发 mouseleave 到 gB
  const r2 = await page.evaluate(() => {
    const gB = document.querySelector(".dot");
    gB.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    return {
      active: document.querySelectorAll(".sector-group.active").length,
      faded: document.querySelectorAll(".sector-group.faded").length,
      tooltipShow: document.getElementById("tooltip").classList.contains("show")
    };
  });
  console.log("leave 后 active/faded/show:", JSON.stringify(r2));

  await browser.close();
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
