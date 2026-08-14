/* ============================================================
   内容保护 — 禁用右键菜单与常用开发者快捷键（v2）
   - 右键点击 → 阻止默认菜单 + 轻提示
   - F12 / Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C / Ctrl+U / Ctrl+S → 阻止
   - 用 e.code 判断（修复 v1 bug：e.key 无 Shift 时为小写导致 Ctrl+U 漏拦）
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
    var code = e.code;
    var ctrl = e.ctrlKey || e.metaKey;   // Windows/Linux Ctrl，macOS Cmd
    // F12 开发者工具
    if (code === "F12") { e.preventDefault(); showTip(); return; }
    // Ctrl+Shift+I / J / C（开发者工具 / 控制台 / 元素审查）
    if (ctrl && e.shiftKey && (code === "KeyI" || code === "KeyJ" || code === "KeyC")) { e.preventDefault(); return; }
    // Ctrl+U（查看源代码）/ Ctrl+S（保存页面）
    if (ctrl && (code === "KeyU" || code === "KeyS")) { e.preventDefault(); showTip(); return; }
  }, false);
})();
