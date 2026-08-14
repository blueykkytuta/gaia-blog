/* 本地验证 access-gate-0814.js：
   1) 未解锁 → 全屏遮罩显示
   2) 错误密码 → 提示
   3) 正确密码 → 遮罩消失 + localStorage 写入
   4) 刷新 → 7 天记忆生效（不再遮罩）
   5) 模拟过期 → 遮罩重现
*/
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
  page.on("pageerror", e => console.log("PAGE ERROR:", e.message));
  page.on("console", m => { if (m.type() === "error") console.log("CONSOLE ERR:", m.text()); });
  const url = "file:///" + path.resolve(__dirname, "..", "index.html").replace(/\\/g, "/");

  // ---- 测试 1：未解锁 → 遮罩显示 ----
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
  await new Promise(r => setTimeout(r, 400));
  const t1 = await page.evaluate(() => ({
    gateExists: !!document.getElementById("cc-gate"),
    inputVisible: !!document.querySelector("#cc-gate input"),
    bodyContentCovered: getComputedStyle(document.getElementById("cc-gate")).position === "fixed"
  }));
  console.log("1. 未解锁遮罩:", JSON.stringify(t1));

  // ---- 测试 2：错误密码 → 提示 ----
  await page.type("#cc-pass", "wrongpass123");
  await page.click("#cc-btn");
  await new Promise(r => setTimeout(r, 300));
  const t2 = await page.evaluate(() => ({
    err: document.getElementById("cc-err").textContent,
    gateStill: !!document.getElementById("cc-gate")
  }));
  console.log("2. 错误密码:", JSON.stringify(t2));

  // ---- 测试 3：正确密码 → 遮罩消失 + localStorage ----
  await page.evaluate(() => { document.getElementById("cc-pass").value = ""; });
  await page.type("#cc-pass", "traderli");
  await page.click("#cc-btn");
  await new Promise(r => setTimeout(r, 700));
  const t3 = await page.evaluate(() => ({
    gateGone: !document.getElementById("cc-gate"),
    saved: JSON.parse(localStorage.getItem("cc_gate") || "null")
  }));
  console.log("3. 正确密码:", JSON.stringify(t3));

  // ---- 测试 4：刷新 → 7 天记忆生效 ----
  await page.reload({ waitUntil: "domcontentloaded" });
  await new Promise(r => setTimeout(r, 500));
  const t4 = await page.evaluate(() => ({
    gateExistsAfterReload: !!document.getElementById("cc-gate"),
    title: document.title
  }));
  console.log("4. 刷新后（7天记忆）:", JSON.stringify(t4));

  // ---- 测试 5：模拟过期 → 遮罩重现 ----
  await page.evaluate(() => {
    localStorage.setItem("cc_gate", JSON.stringify({ t: Date.now() - 8 * 24 * 60 * 60 * 1000 }));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await new Promise(r => setTimeout(r, 500));
  const t5 = await page.evaluate(() => ({
    gateBack: !!document.getElementById("cc-gate")
  }));
  console.log("5. 过期后重现遮罩:", JSON.stringify(t5));

  // ---- 截图：遮罩视觉 ----
  await page.evaluate(() => localStorage.removeItem("cc_gate"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: "C:/Users/htzg/WorkBuddy/tmp-gate.png" });

  await browser.close();
  console.log("DONE");
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
