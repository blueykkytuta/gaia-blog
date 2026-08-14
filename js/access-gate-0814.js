/* ============================================================
   访问密码门（前端版）
   - 功能：未解锁时全屏遮罩 + 密码输入；输对后记录 7 天免输
   - 用途：挡住普通访客（配合 guard 防右键/F12 提高门槛）
   - 诚实说明：密码在前端代码中，技术手段可绕过，非绝对安全
   - 修改密码：把 PASS_HASH 换成 btoa('新密码') 的值，
     且必须换新文件名部署（CF 缓存按路径缓存，不改名用户会拿到旧版）
   ============================================================ */
(function () {
  // 密码 traderli 的 base64（避免源码直接出现明文，仅提高普通查看门槛）
  var PASS_HASH = "dHJhZGVybGk="; // btoa("traderli")
  var KEY = "cc_gate";
  var TTL = 7 * 24 * 60 * 60 * 1000; // 7 天

  // 已解锁且在有效期内 → 直接放行
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved && typeof saved.t === "number" && Date.now() - saved.t < TTL) {
      return;
    }
  } catch (e) { /* 忽略，继续走解锁流程 */ }

  // ---- 未解锁：创建遮罩 ----
  var mask = document.createElement("div");
  mask.id = "cc-gate";
  mask.setAttribute("role", "dialog");
  mask.setAttribute("aria-label", "输入密码访问");
  mask.innerHTML =
    '<div class="cc-card">' +
      '<div class="cc-brand">Carrycore<em>· 金融视觉志</em></div>' +
      '<p class="cc-sub">此内容需要密码访问</p>' +
      '<input type="password" id="cc-pass" placeholder="请输入密码" autocomplete="off" />' +
      '<button type="button" id="cc-btn">进入</button>' +
      '<p class="cc-err" id="cc-err"></p>' +
      '<small class="cc-foot">© 2026 Carrycore</small>' +
    '</div>';

  // 样式（内联注入，与网站浅色风格一致）
  var style = document.createElement("style");
  style.textContent =
    '#cc-gate{position:fixed;inset:0;z-index:99999;background:#fff;display:flex;align-items:center;justify-content:center;opacity:1;transition:opacity .35s ease}' +
    '#cc-gate.ok{opacity:0;pointer-events:none}' +
    '#cc-gate .cc-card{width:340px;max-width:86vw;text-align:center;padding:8px 0}' +
    '#cc-gate .cc-brand{font-size:22px;font-weight:700;letter-spacing:.5px;color:#1D1D1F}' +
    '#cc-gate .cc-brand em{font-style:normal;font-size:13px;font-weight:400;color:#8A8A93}' +
    '#cc-gate .cc-sub{margin:14px 0 18px;font-size:14px;color:#6E6E78}' +
    '#cc-gate input{width:100%;box-sizing:border-box;padding:11px 14px;font-size:15px;border:1px solid #D8D8DE;border-radius:8px;outline:none;color:#1D1D1F;background:#FAFAFB}' +
    '#cc-gate input:focus{border-color:#1D1D1F}' +
    '#cc-gate button{width:100%;margin-top:12px;padding:11px 14px;font-size:15px;font-weight:600;color:#fff;background:#1D1D1F;border:none;border-radius:8px;cursor:pointer}' +
    '#cc-gate button:hover{background:#000}' +
    '#cc-gate .cc-err{min-height:18px;margin:10px 0 0;font-size:13px;color:#C0392B}' +
    '#cc-gate .cc-foot{display:block;margin-top:22px;font-size:12px;color:#B8B8C0}';

  document.head.appendChild(style);
  document.documentElement.appendChild(mask);

  // ---- 交互 ----
  var input = mask.querySelector("#cc-pass");
  var btn = mask.querySelector("#cc-btn");
  var err = mask.querySelector("#cc-err");

  function tryUnlock() {
    var v = input.value;
    try {
      if (btoa(v) === PASS_HASH) {
        localStorage.setItem(KEY, JSON.stringify({ t: Date.now() }));
        err.textContent = "";
        mask.classList.add("ok");
        setTimeout(function () { if (mask.parentNode) mask.parentNode.removeChild(mask); }, 380);
      } else {
        err.textContent = "密码不对，请重新输入";
        input.select();
        input.focus();
      }
    } catch (e2) {
      err.textContent = "输入有误，请重试";
    }
  }

  btn.addEventListener("click", tryUnlock);
  input.addEventListener("keydown", function (e) { if (e.key === "Enter") tryUnlock(); });
  setTimeout(function () { input.focus(); }, 60);
})();
