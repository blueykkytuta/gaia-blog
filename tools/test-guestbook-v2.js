/* 验证留言板 v2：200 字限制 + 10 字昵称 + mock 留言渲染效果 */
const puppeteer = require("C:/Users/htzg/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core");
const path = require("path");
(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: "new",
    args: ["--disable-features=BackForwardCache", "--no-sandbox", "--disable-gpu"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  const url = "file:///" + path.resolve(__dirname, "..", "guestbook.html").replace(/\\/g, "/");
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
  await new Promise(r => setTimeout(r, 800));

  // 1. 限制验证
  const limits = await page.evaluate(() => ({
    nameMax: document.getElementById("gb-name").maxLength,
    textMax: document.getElementById("gb-text").maxLength,
    tip: document.querySelector(".gb-tip").textContent,
    count: document.getElementById("gb-count").textContent
  }));
  console.log("1. 限制:", JSON.stringify(limits));

  // 2. 输入超长测试（昵称 15 字、内容 300 字）
  await page.type("#gb-name", "这是一个非常长的昵称测试十五个字");
  await page.type("#gb-text", "测".repeat(300));
  const inputLen = await page.evaluate(() => ({
    nameVal: document.getElementById("gb-name").value.length,
    textVal: document.getElementById("gb-text").value.length,
    count: document.getElementById("gb-count").textContent
  }));
  console.log("2. 超长输入后:", JSON.stringify(inputLen), "(昵称应≤10, 内容应≤200)");

  // 3. mock 留言列表渲染
  await page.evaluate(() => {
    window.render([
      { name: "市场观察员", ts: 1786752000000, text: "今天板块轮动明显，资金继续流向中证1000，小盘风格占优。" },
      { name: "小李", ts: 1786748400000, text: "交互图做得真漂亮，数据也很准，辛苦博主！" },
      { name: "看图说话", ts: 1786744800000, text: "相对强度表更新到 8 月 14 日了，延续性一目了然。" },
      { name: "匿名用户", ts: 1786741200000, text: "留个脚印，期待后续更多行业的趋势路径。" }
    ]);
  });
  await new Promise(r => setTimeout(r, 300));
  const listInfo = await page.evaluate(() => {
    const items = document.querySelectorAll(".gb-item");
    return {
      count: items.length,
      first: {
        name: items[0]?.querySelector(".gb-name").textContent,
        ts: items[0]?.querySelector(".gb-ts").textContent,
        text: items[0]?.querySelector(".gb-text").textContent.slice(0, 20)
      }
    };
  });
  console.log("3. 留言列表:", JSON.stringify(listInfo));

  // 清空输入再截图（显示空表单 + mock 列表）
  await page.evaluate(() => {
    document.getElementById("gb-name").value = "";
    document.getElementById("gb-text").value = "";
    document.getElementById("gb-count").textContent = "0 / 200";
  });
  await page.screenshot({ path: "C:/Users/htzg/WorkBuddy/tmp-guestbook-v2.png" });
  console.log("JS 错误:", errors.length ? errors : "无");
  await browser.close();
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
