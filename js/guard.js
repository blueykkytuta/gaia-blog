/* ============================================================
   内容保护 — 禁用右键菜单与常用开发者快捷键
   - 右键点击 → 阻止默认菜单 + 轻提示
   - F12 / Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C / Ctrl+U / Ctrl+S → 阻止
   - 提示最多出现 3 次，避免骚扰访客
   ============================================================ */
(function () {
  var tipCount = 0;
  function showTip() {
    if (tipCount >= 3) return;
    tipCount++;
    var t = document.createElement("div");
    t.textContent = "内容受保护，请勿复制";
    t.style.cssText =
      "position:fixed;left:50%;bottom:32px;transform:translateX(-50%);" +
      "background:rgba(29,29,31,.92);color:#fff;font:13px/1 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;" +
      "padding:10px 18px;border-radius:8px;z-index:99999;pointer-events:none;transition:opacity .25s ease;";
    document.body.appendChild(t);
    setTimeout(function () { t.style.opacity = "0"; }, 1400);
    setTimeout(function () { t.remove(); }, 1700);
  }

  document.addEventListener("contextmenu", function (e) {
    e.preventDefault();
    showTip();
  }, false);

  document.addEventListener("keydown", function (e) {
    var k = e.key;
    if (k === "F12") { e.preventDefault(); showTip(); return; }
    if (e.ctrlKey && e.shiftKey && (k === "I" || k === "J" || k === "C")) { e.preventDefault(); return; }
    if (e.ctrlKey && (k === "U" || k === "S")) { e.preventDefault(); showTip(); return; }
  }, false);
})();
