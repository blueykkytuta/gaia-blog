/* ============================================================
   行业趋势路径 — 交互逻辑（基于行业强弱分布改造）
   - 多选行业 + 基准/对照两个时间
   - 每个行业两个圆点：基准（有颜色）、对照（灰色）+ 对照→基准虚线箭头
   - 数据来源：window.SECTOR_DB（build-data.py 生成）
   ============================================================ */

const VIEW = { w: 1000, h: 700, pad: { top: 50, right: 60, bottom: 60, left: 60 } };
const COLOR = { blue: "#7B92B5", red: "#DC5F5F" };
const GRAY = "#A6A6A6";       // 对照点统一灰色
const ARROW_GRAY = "#B8B8B8";

const REF_Y = 0.50;
const REF_X = 0.21;

// ---------- 动态范围 ----------
function computeRanges(db) {
  let xMin = Infinity, xMax = -Infinity;
  let yMin = Infinity, yMax = -Infinity;
  let vMin = Infinity, vMax = -Infinity;
  let cMin = Infinity, cMax = -Infinity;
  Object.values(db.dates).forEach(arr => {
    arr.forEach(s => {
      if (!s) return;
      xMin = Math.min(xMin, s.x);
      xMax = Math.max(xMax, s.x);
      yMin = Math.min(yMin, s.y);
      yMax = Math.max(yMax, s.y);
      vMin = Math.min(vMin, s.value);
      vMax = Math.max(vMax, s.value);
      cMin = Math.min(cMin, s.cont);
      cMax = Math.max(cMax, s.cont);
    });
  });
  const xSpan = xMax - xMin;
  const ySpan = yMax - yMin;
  const xPad = xSpan * 0.06;
  const yPad = ySpan * 0.06;
  const cSpan = cMax - cMin || 0.1;
  const cPad = cSpan * 0.08;
  return {
    X: [xMin - xPad, xMax + xPad],
    Y: [yMin - yPad, yMax + yPad],
    V: [Math.floor((vMin - 0.5) * 2) / 2, Math.ceil((vMax + 0.5) * 2) / 2],
    C: [Math.round((cMin - cPad) * 100) / 100, Math.round((cMax + cPad) * 100) / 100],
    C_RAW: [cMin, cMax]
  };
}

function niceTicks(min, max, count) {
  const span = max - min;
  const step0 = span / Math.max(count, 1);
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  let step;
  if (norm < 1.5) step = 1;
  else if (norm < 3) step = 2;
  else if (norm < 7) step = 5;
  else step = 10;
  step *= mag;
  const start = Math.ceil(min / step) * step;
  const ticks = [];
  for (let v = start; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

// ---------- 主逻辑 ----------
function $(id) { return document.getElementById(id); }
const svg = $("chart");
const tooltip = $("tooltip");
const countEl = $("dot-count");
const subtitleEl = $("trend-subtitle");

if (!svg || !tooltip || !window.SECTOR_DB) {
  // 静默退出
} else {

const DB = window.SECTOR_DB;
const ranges = computeRanges(DB);
const X_RANGE = ranges.X;
const Y_RANGE = ranges.Y;
const V_RANGE = ranges.V;
const C_RANGE = ranges.C;
const C_RAW = ranges.C_RAW;

const R_MIN = 5, R_MAX = 19, R_POW = 1.6;
function rScale(cont) {
  const [cLo, cHi] = C_RAW;
  const span = (cHi - cLo) || 0.1;
  const t = Math.min(1, Math.max(0, (cont - cLo) / span));
  return R_MIN + Math.pow(t, R_POW) * (R_MAX - R_MIN);
}
const xScale = (x) => VIEW.pad.left + (x - X_RANGE[0]) / (X_RANGE[1] - X_RANGE[0]) * (VIEW.w - VIEW.pad.left - VIEW.pad.right);
const yScale = (y) => VIEW.pad.top + (Y_RANGE[1] - y) / (Y_RANGE[1] - Y_RANGE[0]) * (VIEW.h - VIEW.pad.top - VIEW.pad.bottom);

// ---------- 状态 ----------
const AVAILABLE_DATES = Object.keys(DB.dates).sort().reverse();
const INDUSTRIES = DB.industries;
let baseDate = AVAILABLE_DATES[0];                    // 基准时间（默认最新）
let refDate = AVAILABLE_DATES[AVAILABLE_DATES.length - 1]; // 对照时间（默认最旧）
const selected = new Set(INDUSTRIES);                 // 行业多选，默认全选

const state = {
  yLo: Y_RANGE[0], yHi: Y_RANGE[1],
  xLo: X_RANGE[0], xHi: X_RANGE[1],
  cLo: C_RANGE[0], cHi: C_RANGE[1],
  vLo: V_RANGE[0], vHi: V_RANGE[1],
  color: "all",
  current: null
};

const groups = [];   // { name, base, ref, el, circleB, circleR, line, label, cxB, cyB, cxR, cyR }

function svgEl(name, attrs, parent) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const k in attrs) {
    if (k === "text") el.textContent = attrs[k];
    else el.setAttribute(k, attrs[k]);
  }
  if (parent) parent.appendChild(el);
  return el;
}

// ---------- 坐标轴 ----------
function renderAxes() {
  const innerW = VIEW.w - VIEW.pad.left - VIEW.pad.right;
  const innerH = VIEW.h - VIEW.pad.top - VIEW.pad.bottom;
  if (REF_Y >= Y_RANGE[0] && REF_Y <= Y_RANGE[1]) {
    svgEl("line", { x1: VIEW.pad.left, y1: yScale(REF_Y), x2: VIEW.pad.left + innerW, y2: yScale(REF_Y), class: "axis-line" }, svg);
  }
  if (REF_X >= X_RANGE[0] && REF_X <= X_RANGE[1]) {
    svgEl("line", { x1: xScale(REF_X), y1: VIEW.pad.top, x2: xScale(REF_X), y2: VIEW.pad.top + innerH, class: "axis-line" }, svg);
  }
  const xTicks = niceTicks(X_RANGE[0], X_RANGE[1], 5);
  xTicks.forEach(v => {
    if (v < X_RANGE[0] || v > X_RANGE[1]) return;
    const x = xScale(v);
    svgEl("line", { x1: x, y1: VIEW.pad.top + innerH, x2: x, y2: VIEW.pad.top + innerH + 5, class: "tick" }, svg);
    svgEl("text", { x, y: VIEW.pad.top + innerH + 18, class: "axis-label", text: v.toFixed(2) }, svg);
  });
  const yTicks = niceTicks(Y_RANGE[0], Y_RANGE[1], 6);
  yTicks.forEach(v => {
    if (v < Y_RANGE[0] || v > Y_RANGE[1]) return;
    const y = yScale(v);
    svgEl("line", { x1: VIEW.pad.left - 5, y1: y, x2: VIEW.pad.left, y2: y, class: "tick" }, svg);
    svgEl("text", { x: VIEW.pad.left - 10, y: y + 4, class: "axis-label", "text-anchor": "end", text: v.toFixed(2) }, svg);
  });
  svgEl("text", { x: VIEW.pad.left + innerW / 2, y: VIEW.h - 12, class: "axis-title", "text-anchor": "middle", text: "波动性 →" }, svg);
  svgEl("text", { x: 16, y: VIEW.pad.top + innerH / 2, class: "axis-title", "text-anchor": "middle", transform: "rotate(-90 16 " + (VIEW.pad.top + innerH / 2) + ")", text: "强弱水平 →" }, svg);
}

// ---------- 箭头 marker ----------
function addArrowDef() {
  const defs = svgEl("defs", {}, svg);
  const mk = svgEl("marker", {
    id: "arrow", markerWidth: 10, markerHeight: 10,
    refX: 8, refY: 5, orient: "auto", markerUnits: "userSpaceOnUse"
  }, defs);
  svgEl("path", { d: "M0,0 L10,5 L0,10 z", fill: ARROW_GRAY }, mk);
}

// ---------- 渲染 ----------
function renderGroups() {
  clearSvg();
  addArrowDef();
  renderAxes();
  groups.length = 0;

  const baseData = DB.dates[baseDate] || [];
  const refData = DB.dates[refDate] || [];
  const baseMap = {}, refMap = {};
  baseData.forEach(s => baseMap[s.name] = s);
  refData.forEach(s => refMap[s.name] = s);

  const needLabels = selected.size <= 16;

  INDUSTRIES.forEach(name => {
    if (!selected.has(name)) return;
    const b = baseMap[name], r = refMap[name];
    if (!b || !r) return;

    const cxB = xScale(b.x), cyB = yScale(b.y);
    const cxR = xScale(r.x), cyR = yScale(r.y);
    const rB = rScale(b.cont), rR = rScale(r.cont);

    const g = svgEl("g", { class: "sector-group", "data-name": name }, svg);

    // 虚线箭头：对照 → 基准
    let line = null;
    if (Math.abs(cxB - cxR) > 1.5 || Math.abs(cyB - cyR) > 1.5) {
      line = svgEl("line", {
        x1: cxR, y1: cyR, x2: cxB, y2: cyB,
        class: "arrow-line", "marker-end": "url(#arrow)"
      }, g);
    }

    // 对照点（灰色，不区分红蓝）
    const gR = svgEl("g", { class: "ref-dot" }, g);
    const circleR = svgEl("circle", { cx: cxR, cy: cyR, r: rR, fill: GRAY, "fill-opacity": "0.75" }, gR);
    gR.addEventListener("mouseenter", (e) => onHover(name, "ref", g, e));
    gR.addEventListener("mousemove", moveTooltip);
    gR.addEventListener("mouseleave", onLeave);
    gR.addEventListener("click", () => onClick(name, g));

    // 基准点（有颜色）
    const gB = svgEl("g", { class: "dot" }, g);
    const circleB = svgEl("circle", {
      cx: cxB, cy: cyB, r: rB,
      fill: b.color === "blue" ? COLOR.blue : COLOR.red,
      "fill-opacity": "0.78",
      stroke: "rgba(255,255,255,0.7)", "stroke-width": "1.2"
    }, gB);
    const label = svgEl("text", {
      x: cxB + rB + 5, y: cyB + 4,
      class: "dot-label", text: needLabels ? name + " " + b.value.toFixed(2) : ""
    }, gB);
    gB.addEventListener("mouseenter", (e) => onHover(name, "base", g, e));
    gB.addEventListener("mousemove", moveTooltip);
    gB.addEventListener("mouseleave", onLeave);
    gB.addEventListener("click", () => onClick(name, g));

    groups.push({ name, b, r, g, gB, gR, circleB, circleR, line, label, cxB, cyB, cxR, cyR, rB, rR });
  });
}

function clearSvg() {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
}

// ---------- 筛选 ----------
function applyFilter() {
  let visible = 0;
  groups.forEach(it => {
    const b = it.b, r = it.r;
    const show =
      b.y >= state.yLo && b.y <= state.yHi &&
      b.x >= state.xLo && b.x <= state.xHi &&
      b.cont >= state.cLo && b.cont <= state.cHi &&
      b.value >= state.vLo && b.value <= state.vHi &&
      (state.color === "all" || b.color === state.color);
    it.g.classList.toggle("faded", !show);
    if (show) visible++;
  });
  if (countEl) countEl.textContent = "显示 " + visible + " / " + selected.size + " 个行业";
}

// ---------- tooltip ----------
function onHover(name, which, g, e) {
  const it = groups.find(x => x.name === name);
  if (!it) return;

  // 清除所有组状态
  groups.forEach(o => {
    o.g.classList.remove("active", "faded", "hl");
  });

  if (which === "base") {
    // 基准圆：交互图同款 —— 其他圆淡出 + 当前圆突出 + 黑色要素标签
    groups.forEach(o => { if (o.g !== g) o.g.classList.add("faded"); });
    g.classList.add("active");

    const fmt = (v, d) => v.toFixed(d === undefined ? 3 : d);
    tooltip.innerHTML =
      '<div class="tt-name">' + name + '</div>' +
      '<div class="tt-row"><span>波动性</span><b>' + fmt(it.b.x) + '</b></div>' +
      '<div class="tt-row"><span>强弱势级</span><b>' + fmt(it.b.y) + '</b></div>' +
      '<div class="tt-row"><span>连续性</span><b>' + fmt(it.b.cont, 1) + '</b></div>' +
      '<div class="tt-row"><span>甜品度</span><b>' + fmt(it.b.value, 2) + '</b></div>';
  } else {
    // 对照圆：保持现状（完整两组数据 + 高亮）
    const fmt = (v, d) => v.toFixed(d === undefined ? 3 : d);
    tooltip.innerHTML =
      '<div class="tt-name">' + name + '</div>' +
      '<div class="tt-row tt-sub">基准 ' + baseDate.replace(/-/g, ".") + '</div>' +
      '<div class="tt-row"><span>波动性</span><b>' + fmt(it.b.x) + '</b></div>' +
      '<div class="tt-row"><span>强弱水平</span><b>' + fmt(it.b.y) + '</b></div>' +
      '<div class="tt-row"><span>连续性</span><b>' + fmt(it.b.cont, 2) + '</b></div>' +
      '<div class="tt-row"><span>甜品度</span><b>' + fmt(it.b.value, 2) + '</b></div>' +
      '<div class="tt-row"><span>颜色</span><b>' + (it.b.color === "blue" ? "蓝" : "红") + '</b></div>' +
      '<div class="tt-row tt-sub">对照 ' + refDate.replace(/-/g, ".") + '（灰点）</div>' +
      '<div class="tt-row"><span>波动性</span><b>' + fmt(it.r.x) + '</b></div>' +
      '<div class="tt-row"><span>强弱水平</span><b>' + fmt(it.r.y) + '</b></div>' +
      '<div class="tt-row"><span>连续性</span><b>' + fmt(it.r.cont, 2) + '</b></div>' +
      '<div class="tt-row"><span>甜品度</span><b>' + fmt(it.r.value, 2) + '</b></div>';
    g.classList.add("hl");
  }

  tooltip.classList.add("show");
  tooltip.style.left = "0px";
  tooltip.style.top = "0px";
  moveTooltip(e);
}
function moveTooltip(e) {
  const area = document.querySelector(".chart-area");
  if (!area) return;
  const rect = area.getBoundingClientRect();
  const scale = rect.width / 1000;
  let x = (e.clientX - rect.left) / scale + 14;
  let y = (e.clientY - rect.top) / scale + 14;
  if (x > 700) x = (e.clientX - rect.left) / scale - 210;
  if (y > 560) y = (e.clientY - rect.top) / scale - 150;
  tooltip.style.left = x + "px";
  tooltip.style.top = y + "px";
}
function onLeave() {
  tooltip.classList.remove("show");
  groups.forEach(o => {
    o.g.classList.remove("active", "faded", "hl");
  });
  applyFilter();  // 恢复滑块筛选状态
  state.current = null;
}
function onClick(name, g) {
  const it = groups.find(x => x.name === name);
  if (!it) return;
  if (state.current === name) { state.current = null; g.classList.remove("pin"); return; }
  state.current = name;
  g.classList.add("pin");
}

// ---------- 入场动画 ----------
function playEnter() {
  const cx0 = VIEW.w / 2, cy0 = VIEW.h / 2;
  groups.forEach((it, i) => {
    const cB = it.circleB, cR = it.circleR;
    [cB, cR].forEach(c => {
      c.style.transition = "none";
      c.setAttribute("cx", cx0);
      c.setAttribute("cy", cy0);
      c.style.opacity = "0";
    });
    if (it.line) { it.line.style.opacity = "0"; }
    void cB.getBoundingClientRect();
    setTimeout(() => {
      [cB, cR].forEach(c => {
        c.style.transition = "cx .6s cubic-bezier(.22,.9,.3,1.2), cy .6s cubic-bezier(.22,.9,.3,1.2), opacity .3s ease";
      });
      cB.setAttribute("cx", it.cxB); cB.setAttribute("cy", it.cyB);
      cR.setAttribute("cx", it.cxR); cR.setAttribute("cy", it.cyR);
      [cB, cR].forEach(c => { c.style.opacity = "1"; });
      if (it.line) {
        it.line.style.transition = "opacity .4s ease .25s";
        it.line.style.opacity = "1";
      }
    }, 60 + i * 45);
  });
}

// ---------- 行业多选 UI ----------
function buildSectorPicker() {
  const list = $("sp-list");
  if (!list) return;
  list.innerHTML = "";
  INDUSTRIES.forEach(name => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sp-item" + (selected.has(name) ? " on" : "");
    btn.dataset.name = name;
    btn.textContent = name;
    btn.addEventListener("click", () => {
      if (selected.has(name)) selected.delete(name);
      else selected.add(name);
      btn.classList.toggle("on", selected.has(name));
      updateCount();
      renderGroups();
      applyFilter();
      playEnter();
    });
    list.appendChild(btn);
  });
  const allBtn = $("sp-all"), noneBtn = $("sp-none");
  if (allBtn) allBtn.addEventListener("click", () => {
    INDUSTRIES.forEach(n => selected.add(n));
    buildSectorPicker();
    updateCount(); renderGroups(); applyFilter(); playEnter();
  });
  if (noneBtn) noneBtn.addEventListener("click", () => {
    selected.clear();
    buildSectorPicker();
    updateCount(); renderGroups(); applyFilter(); playEnter();
  });
  updateCount();
}
function updateCount() {
  const el = $("sp-count");
  if (el) el.textContent = "已选 " + selected.size + " / " + INDUSTRIES.length;
}

// ---------- 双日期选择（复用日历组件） ----------
const dpBaseBtn = $("dp-base-btn");
const dpRefBtn = $("dp-ref-btn");
const dpPop = $("datepicker-pop");
const dpBaseLabel = $("dp-base-label");
const dpRefLabel = $("dp-ref-label");
const dataDates = new Set(Object.keys(DB.dates));
let calView = { y: 2026, m: 8 };
let viewMode = "days";
let pickTarget = "base"; // 当前日历为谁选择

const pad2 = (n) => (n < 10 ? "0" : "") + n;

function buildCalendar(y, m, mode) {
  calView = { y, m };
  viewMode = mode || viewMode;
  if (viewMode === "days") buildDaysView(y, m);
  else if (viewMode === "months") buildMonthsView(y);
  else buildYearsView(y);
}

function buildDaysView(y, m) {
  const first = new Date(y, m - 1, 1);
  const startDow = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m, 0).getDate();
  let html =
    '<div class="dp-head">' +
    '<button type="button" class="dp-nav" data-nav="prev-m" aria-label="上个月">‹</button>' +
    '<button type="button" class="dp-title-btn" data-nav="pick-m" aria-label="选择月份">' + y + ' 年 ' + m + ' 月 ▾</button>' +
    '<button type="button" class="dp-nav" data-nav="next-m" aria-label="下个月">›</button>' +
    '</div>' +
    '<div class="dp-dow-row"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>' +
    '<div class="dp-grid">';
  for (let i = 0; i < startDow; i++) html += '<span class="dp-blank"></span>';
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = y + "-" + pad2(m) + "-" + pad2(d);
    const hasData = dataDates.has(dateStr);
    const isSel = dateStr === (pickTarget === "base" ? baseDate : refDate);
    html += '<button type="button" class="dp-day' + (hasData ? " has-data" : "") + (isSel ? " selected" : "") + '" data-date="' + dateStr + '"' + (hasData ? "" : " disabled") + '>' + d + '</button>';
  }
  html += "</div>";
  dpPop.innerHTML = html;
}

function buildMonthsView(y) {
  const monthHasData = {};
  dataDates.forEach(d => {
    const parts = d.split("-");
    if (parseInt(parts[0], 10) === y) monthHasData[parseInt(parts[1], 10)] = true;
  });
  let html =
    '<div class="dp-head">' +
    '<button type="button" class="dp-nav" data-nav="prev-y" aria-label="上一年">‹</button>' +
    '<button type="button" class="dp-title-btn" data-nav="pick-y" aria-label="选择年份">' + y + ' 年 ▾</button>' +
    '<button type="button" class="dp-nav" data-nav="next-y" aria-label="下一年">›</button>' +
    '</div><div class="dp-months">';
  for (let m = 1; m <= 12; m++) {
    const has = monthHasData[m];
    html += '<button type="button" class="dp-month' + (has ? " has-data" : "") + '" data-nav="pick-d" data-month="' + m + '"' + (has ? "" : " disabled") + '>' + m + '月' + (has ? ' <span class="dp-dot"></span>' : '') + '</button>';
  }
  html += "</div>";
  dpPop.innerHTML = html;
}

function buildYearsView(y) {
  const startY = y - 5;
  const endY = y + 6;
  let html =
    '<div class="dp-head">' +
    '<button type="button" class="dp-nav" data-nav="prev-12y" aria-label="上 12 年">‹</button>' +
    '<button type="button" class="dp-title-btn" data-nav="back" aria-label="返回">' + startY + ' – ' + endY + '</button>' +
    '<button type="button" class="dp-nav" data-nav="next-12y" aria-label="下 12 年">›</button>' +
    '</div><div class="dp-years">';
  for (let yr = startY; yr <= endY; yr++) {
    const hasYear = Array.from(dataDates).some(d => d.startsWith(yr + "-"));
    html += '<button type="button" class="dp-year' + (hasYear ? " has-data" : "") + '" data-nav="pick-m" data-year="' + yr + '">' + yr + (hasYear ? ' <span class="dp-dot"></span>' : '') + '</button>';
  }
  html += "</div>";
  dpPop.innerHTML = html;
}

function openCalendar(target) {
  pickTarget = target;
  // 把弹窗挂到当前按钮所属的 wrap 下，保证绝对定位相对按钮正确（两个日期按钮共用弹窗）
  const wrap = $(target === "base" ? "dp-base-wrap" : "dp-ref-wrap");
  if (wrap && dpPop.parentNode !== wrap) wrap.appendChild(dpPop);
  const cur = target === "base" ? baseDate : refDate;
  const parts = cur.split("-");
  buildCalendar(parseInt(parts[0], 10), parseInt(parts[1], 10), "days");
  dpPop.hidden = false;
}

function closeCalendar() {
  dpPop.hidden = true;
}

function setDate(date) {
  if (pickTarget === "base") { baseDate = date; if (dpBaseLabel) dpBaseLabel.textContent = date; }
  else { refDate = date; if (dpRefLabel) dpRefLabel.textContent = date; }
  updateSubtitle();
  renderGroups();
  applyFilter();
  playEnter();
}

function updateSubtitle() {
  const fmt = (d) => d.replace(/-/g, ".");
  if (subtitleEl) subtitleEl.textContent = fmt(baseDate) + " ← " + fmt(refDate);
  // 图表上方日期条
  const bar = $("trend-datebar");
  if (bar) {
    bar.innerHTML =
      '<span class="db-tag db-base">基准</span>' + fmt(baseDate) +
      '<span class="db-arrow">←</span>' +
      '<span class="db-tag db-ref">对照</span>' + fmt(refDate);
  }
}

if (dpBaseBtn && dpRefBtn && dpPop) {
  dpBaseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (dpPop.hidden || pickTarget !== "base") openCalendar("base");
    else closeCalendar();
  });
  dpRefBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (dpPop.hidden || pickTarget !== "ref") openCalendar("ref");
    else closeCalendar();
  });

  dpPop.addEventListener("click", (e) => {
    e.stopPropagation(); // 防旧节点冒泡误判外部点击（日历翻月消失 bug）
    const month = e.target.closest("[data-nav='pick-d']");
    if (month) { buildCalendar(calView.y, parseInt(month.dataset.month, 10), "days"); return; }
    const year = e.target.closest(".dp-year");
    if (year) { buildCalendar(parseInt(year.dataset.year, 10), 1, "months"); return; }
    const titleBtn = e.target.closest(".dp-title-btn");
    if (titleBtn) {
      const nav = titleBtn.dataset.nav;
      if (nav === "pick-m") buildCalendar(calView.y, 1, "months");
      else if (nav === "pick-y") buildCalendar(calView.y, 1, "years");
      else if (nav === "back") buildCalendar(calView.y, 1, "months");
      return;
    }
    const navBtn = e.target.closest(".dp-nav");
    if (navBtn) {
      const nav = navBtn.dataset.nav;
      let { y, m } = calView;
      if (nav === "prev-m") { m--; if (m < 1) { m = 12; y--; } buildCalendar(y, m, "days"); }
      else if (nav === "next-m") { m++; if (m > 12) { m = 1; y++; } buildCalendar(y, m, "days"); }
      else if (nav === "prev-y") { y--; buildCalendar(y, m, "months"); }
      else if (nav === "next-y") { y++; buildCalendar(y, m, "months"); }
      else if (nav === "prev-12y") { y -= 12; buildCalendar(y, m, "years"); }
      else if (nav === "next-12y") { y += 12; buildCalendar(y, m, "years"); }
      return;
    }
    const day = e.target.closest(".dp-day");
    if (day && day.dataset.date && !day.disabled) {
      setDate(day.dataset.date);
      closeCalendar();
    }
  });

  document.addEventListener("click", (e) => {
    if (!dpPop.hidden && !dpBaseBtn.contains(e.target) && !dpRefBtn.contains(e.target) && !dpPop.contains(e.target)) {
      closeCalendar();
    }
  });
}

// ---------- 滑块绑定 ----------
function createFilterControl(trackId, valId, min, max, lo, hi, onChange, step) {
  const trackEl = $(trackId);
  const valEl = $(valId);
  if (!trackEl) return null;
  const rail = document.createElement("div"); rail.className = "df-rail";
  const rng = document.createElement("div"); rng.className = "df-range";
  const t1 = document.createElement("div"); t1.className = "df-thumb";
  const t2 = document.createElement("div"); t2.className = "df-thumb";
  trackEl.appendChild(rail); trackEl.appendChild(rng); trackEl.appendChild(t1); trackEl.appendChild(t2);

  const span = max - min || 0.01;
  const round2 = (v) => Math.round(v * 100) / 100;
  let active = 0;
  const pct = (v) => (v - min) / span * 100;
  const valFromX = (px) => {
    const rect = trackEl.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (px - rect.left) / rect.width));
    return min + ratio * span;
  };
  function paint() {
    t1.style.left = pct(lo) + "%";
    t2.style.left = pct(hi) + "%";
    rng.style.left = pct(lo) + "%";
    rng.style.width = Math.max(0, pct(hi) - pct(lo)) + "%";
    if (valEl) valEl.textContent = round2(lo).toFixed(2) + " – " + round2(hi).toFixed(2);
  }
  function moveTo(px) {
    let v = round2(valFromX(px));
    if (active === 1) lo = Math.min(v, round2(hi - 0.01));
    else if (active === 2) hi = Math.max(v, round2(lo + 0.01));
    paint();
    onChange(round2(lo), round2(hi));
  }
  function pick(px) {
    const v = valFromX(px);
    active = Math.abs(v - lo) <= Math.abs(v - hi) ? 1 : 2;
  }
  function onDown(e) {
    e.preventDefault();
    pick(e.clientX); moveTo(e.clientX);
    try { trackEl.setPointerCapture(e.pointerId); } catch (err) {}
    trackEl.addEventListener("pointermove", onMove);
    trackEl.addEventListener("pointerup", onUp);
    trackEl.addEventListener("pointercancel", onUp);
  }
  function onMove(e) { moveTo(e.clientX); }
  function onUp() {
    active = 0;
    trackEl.removeEventListener("pointermove", onMove);
    trackEl.removeEventListener("pointerup", onUp);
    trackEl.removeEventListener("pointercancel", onUp);
  }
  trackEl.addEventListener("pointerdown", onDown);
  paint();
  return { set: (l, h) => { lo = l; hi = h; paint(); onChange(l, h); } };
}

const bindings = [
  { id: "y", min: Y_RANGE[0], max: Y_RANGE[1], lo: state.yLo, hi: state.yHi, step: 0.005 },
  { id: "x", min: X_RANGE[0], max: X_RANGE[1], lo: state.xLo, hi: state.xHi, step: 0.005 },
  { id: "c", min: C_RANGE[0], max: C_RANGE[1], lo: state.cLo, hi: state.cHi, step: 0.01 },
  { id: "v", min: V_RANGE[0], max: V_RANGE[1], lo: state.vLo, hi: state.vHi, step: 0.01 }
];
bindings.forEach(b => {
  createFilterControl("df-" + b.id, "df-" + b.id + "-values", b.min, b.max, b.lo, b.hi, (lo, hi) => {
    if (b.id === "y") { state.yLo = lo; state.yHi = hi; }
    if (b.id === "x") { state.xLo = lo; state.xHi = hi; }
    if (b.id === "c") { state.cLo = lo; state.cHi = hi; }
    if (b.id === "v") { state.vLo = lo; state.vHi = hi; }
    applyFilter();
  }, b.step);
});

// 颜色按钮
document.querySelectorAll(".seg-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".seg-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.color = btn.dataset.color;
    applyFilter();
  });
});

// 重播
const btnReplay = $("btn-replay");
if (btnReplay) btnReplay.addEventListener("click", playEnter);

// ---------- 启动 ----------
if (dpBaseLabel) dpBaseLabel.textContent = baseDate;
if (dpRefLabel) dpRefLabel.textContent = refDate;
updateSubtitle();
buildSectorPicker();
renderGroups();
applyFilter();
setTimeout(playEnter, 100);

} // end safe-guard
