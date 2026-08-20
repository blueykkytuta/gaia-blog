/* ============================================================
   相对强度表格 — 折线图逻辑
   - 数据来源：window.RELATIVE_DB（独立数据库，tools/build-relative.py 生成）
   - 当前/历史双日期选择 + 31 行业多选
   - 折线图显示 [历史日期, 当前日期] 区间内的相对强度走势
   ============================================================ */

const VIEW = { w: 1000, h: 700, pad: { top: 50, right: 70, bottom: 60, left: 60 } };
const Y_MAX = 1.0, Y_MIN = 0.0;

// 31 色调色板（区分度高）
const PALETTE = [
  "#E15759", "#59A14F", "#4E79A7", "#F28E2B", "#76B7B2",
  "#B07AA1", "#FF9DA7", "#9C755F", "#BAB0AC", "#8CD17D",
  "#FFBE7D", "#86BCB6", "#D4A6C8", "#A0CBE8", "#F1CE63",
  "#FF9896", "#98DF8A", "#AEC7E8", "#FFBB78", "#C49C94",
  "#C5B0D5", "#F7B6D2", "#DBDB8D", "#9EDAE5", "#8C6D31",
  "#BCBD22", "#17BECF", "#A6D854", "#FFD92F", "#E5C494",
  "#B3B3B3"
];

function $(id) { return document.getElementById(id); }
// ---------- 双端范围滑块（复用自交互页） ----------
function createDualRange(trackEl, valEl, min, max, lo, hi, onChange, step) {
  if (!trackEl) return null;
  const rail = document.createElement("div"); rail.className = "df-rail";
  const rng = document.createElement("div"); rng.className = "df-range";
  const t1 = document.createElement("div"); t1.className = "df-thumb";
  const t2 = document.createElement("div"); t2.className = "df-thumb";
  trackEl.appendChild(rail); trackEl.appendChild(rng);
  trackEl.appendChild(t1); trackEl.appendChild(t2);

  const span = max - min;
  const roundV = step ? (v) => Math.round(v / step) * step : (v) => Math.round(v * 100) / 100;
  const fmt = step ? (v) => v.toFixed(step >= 1 ? 0 : 2) : (v) => v.toFixed(2);
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
    if (valEl) valEl.textContent = fmt(roundV(lo)) + " – " + fmt(roundV(hi));
  }

  function moveTo(px) {
    let v = roundV(valFromX(px));
    if (active === 1) {
      lo = Math.min(v, roundV(hi - (step || 0.01)));
    } else if (active === 2) {
      hi = Math.max(v, roundV(lo + (step || 0.01)));
    }
    paint();
    onChange(roundV(lo), roundV(hi));
  }

  function pick(px) {
    const v = valFromX(px);
    const d1 = Math.abs(v - lo), d2 = Math.abs(v - hi);
    active = d1 <= d2 ? 1 : 2;
  }

  function onDown(e) {
    e.preventDefault();
    pick(e.clientX);
    moveTo(e.clientX);
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
  return {
    set: (l, h) => { lo = l; hi = h; paint(); onChange(l, h); },
    get: () => ({ lo: roundV(lo), hi: roundV(hi) })
  };
}

function createFilterControl(trackId, valId, min, max, lo, hi, onChange, step) {
  const trackEl = $(trackId) || $(trackId.replace("df-", "filter-"));
  const valEl = $(valId) || $(valId.replace("df-", "filter-"));
  if (!trackEl) return null;
  if (trackEl.tagName === "DIV") {
    return createDualRange(trackEl, valEl, min, max, lo, hi, onChange, step);
  }
  if (trackEl.tagName === "INPUT") {
    trackEl.value = lo;
    const emit = () => {
      const v = parseFloat(trackEl.value);
      if (valEl) valEl.textContent = "≥ " + v.toFixed(2);
      onChange(v, max);
    };
    trackEl.addEventListener("input", emit);
    if (valEl) valEl.textContent = "≥ " + lo.toFixed(2);
    return { set: (l, h) => { trackEl.value = l; emit(); }, get: () => ({ lo: parseFloat(trackEl.value), hi: max }) };
  }
  return null;
}


const svg = $("chart");
const tooltip = $("tooltip");
const countEl = $("dot-count");
const datebarEl = $("trend-datebar");
const legendEl = $("legend");

if (!svg || !tooltip || !window.RELATIVE_DB) {
  // 静默退出
} else {

const DB = window.RELATIVE_DB;
const INDUSTRIES = DB.industries;
const ALL_DATES = Object.keys(DB.dates).sort(); // 升序（历史→当前）
const colorOf = {}; INDUSTRIES.forEach((n, i) => colorOf[n] = PALETTE[i % PALETTE.length]);

// ===== 新增：两个筛选维度（基于“最近日期”）=====
// 最近日期 = 绝对最新日期；近3日 = 该日期往前数第 3 个“有效日期”
const F_LATEST_DATE = ALL_DATES[ALL_DATES.length - 1];
const F_PREV_DATE   = ALL_DATES.length >= 4 ? ALL_DATES[ALL_DATES.length - 1 - 3] : null; // 3 个有效日期之前
const fLatestVals = {};   // 最近日期强度值
const fChangeVals = {};   // 近3日变化 = 最近 - 3日前
INDUSTRIES.forEach(name => {
  const lv = DB.dates[F_LATEST_DATE][name];
  const pv = F_PREV_DATE ? DB.dates[F_PREV_DATE][name] : undefined;
  fLatestVals[name] = (lv === undefined || lv === null) ? null : lv;
  fChangeVals[name] = (lv !== undefined && lv !== null && pv !== undefined && pv !== null) ? (lv - pv) : null;
});
const _lvs = Object.values(fLatestVals).filter(v => v !== null);
const _chs = Object.values(fChangeVals).filter(v => v !== null);
const F_LATEST_MIN = Math.floor(Math.min(..._lvs) * 100) / 100;
const F_LATEST_MAX = Math.ceil (Math.max(..._lvs) * 100) / 100;
const F_CHANGE_MIN = Math.floor(Math.min(..._chs) * 100) / 100;
const F_CHANGE_MAX = Math.ceil (Math.max(..._chs) * 100) / 100;
let fLatestLo = F_LATEST_MIN, fLatestHi = F_LATEST_MAX;
let fChangeLo = F_CHANGE_MIN, fChangeHi = F_CHANGE_MAX;

// 行业是否通过两个筛选
function passesFilters(name) {
  const lv = fLatestVals[name];
  if (lv === null) return false;
  if (lv < fLatestLo - 1e-9 || lv > fLatestHi + 1e-9) return false;
  const ch = fChangeVals[name];
  if (ch === null) return false;
  if (ch < fChangeLo - 1e-9 || ch > fChangeHi + 1e-9) return false;
  return true;
}
// 最终可见 = 手动已选 ∩ 未临时隐藏 ∩ 通过筛选
function visible(name) {
  return selected.has(name) && !hidden.has(name) && passesFilters(name);
}


let curDate = ALL_DATES[ALL_DATES.length - 1];  // 当前日期（默认最新）
let hisDate = ALL_DATES[0];                     // 历史日期（默认最早）
const selected = new Set(INDUSTRIES);
const hidden = new Set();  // 图例点击临时隐藏

function svgEl(name, attrs, parent) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const k in attrs) {
    if (k === "text") el.textContent = attrs[k];
    else el.setAttribute(k, attrs[k]);
  }
  if (parent) parent.appendChild(el);
  return el;
}

// 区间内日期（升序）
function rangeDates() {
  const a = hisDate, b = curDate;
  const start = a < b ? a : b, end = a < b ? b : a;
  return ALL_DATES.filter(d => d >= start && d <= end);
}

const xScale = (i, n) => VIEW.pad.left + (n === 1 ? 0.5 : i / (n - 1)) * (VIEW.w - VIEW.pad.left - VIEW.pad.right);
const yScale = (v) => VIEW.pad.top + (Y_MAX - v) / (Y_MAX - Y_MIN) * (VIEW.h - VIEW.pad.top - VIEW.pad.bottom);

// ---------- 坐标轴 ----------
function renderAxes(dates) {
  const innerW = VIEW.w - VIEW.pad.left - VIEW.pad.right;
  const innerH = VIEW.h - VIEW.pad.top - VIEW.pad.bottom;
  // 网格 + y 刻度（0~1）
  for (let v = 0; v <= 1.0001; v += 0.25) {
    const y = yScale(v);
    svgEl("line", { x1: VIEW.pad.left, y1: y, x2: VIEW.pad.left + innerW, y2: y, class: "grid-line" }, svg);
    svgEl("text", { x: VIEW.pad.left - 10, y: y + 4, class: "axis-label", "text-anchor": "end", text: v.toFixed(2) }, svg);
  }
  // x 刻度（最多 7 个日期）
  const n = dates.length;
  const step = Math.max(1, Math.ceil(n / 7));
  for (let i = 0; i < n; i += step) {
    const x = xScale(i, n);
    const d = dates[i].substring(5); // MM-DD
    svgEl("text", { x, y: VIEW.pad.top + innerH + 20, class: "axis-label", "text-anchor": "middle", text: d }, svg);
  }
  svgEl("text", { x: VIEW.pad.left + innerW / 2, y: VIEW.h - 10, class: "axis-title", "text-anchor": "middle", text: "日期 →" }, svg);
  // hover 时 x 轴下方显示当前日期（id 供 onMove 更新）
  svgEl("text", {
    id: "xdate-label", class: "axis-label", "text-anchor": "middle",
    "font-weight": "600", "fill": "#1D1D1F",
    x: VIEW.pad.left + innerW / 2, y: VIEW.pad.top + innerH + 38,
    style: "display:none", text: ""
  }, svg);
  svgEl("text", { x: 16, y: VIEW.pad.top + innerH / 2, class: "axis-title", "text-anchor": "middle", transform: "rotate(-90 16 " + (VIEW.pad.top + innerH / 2) + ")", text: "相对强度 →" }, svg);
}

// ---------- 渲染折线 ----------
let hoverLine = null, lineEls = [];

function renderLines() {
  clearSvg();
  const dates = rangeDates();
  const n = dates.length;
  if (n < 2) { renderAxes(dates); return; }
  renderAxes(dates);

  lineEls = [];
  INDUSTRIES.forEach(name => {
    if (!visible(name)) return;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const v = DB.dates[dates[i]][name];
      if (v === undefined) continue;
      pts.push(xScale(i, n).toFixed(1) + "," + yScale(v).toFixed(1));
    }
    if (pts.length < 2) return;
    const poly = svgEl("polyline", {
      points: pts.join(" "),
      class: "line-chart-line",
      stroke: colorOf[name],
      "data-name": name
    }, svg);
    // 数据点
    pts.forEach(p => {
      const [px, py] = p.split(",");
      svgEl("circle", { cx: px, cy: py, r: 3, fill: colorOf[name], class: "pt-dot" }, svg);
    });
    lineEls.push({ name, poly });
  });

  // hover 参考线
  hoverLine = svgEl("line", { y1: VIEW.pad.top, y2: VIEW.pad.top + (VIEW.h - VIEW.pad.top - VIEW.pad.bottom), class: "hover-line", style: "display:none" }, svg);
  svg.addEventListener("mousemove", (e) => onMove(e, dates, n));
  svg.addEventListener("mouseleave", hideHover);

  renderLegend();
  if (countEl) countEl.textContent = "显示 " + lineEls.length + " 个行业（已选 " + selected.size + " / 共 " + INDUSTRIES.length + "）";
}

function clearSvg() {
  svg.removeEventListener("mousemove", onMove);
  svg.removeEventListener("mouseleave", hideHover);
  while (svg.firstChild) svg.removeChild(svg.firstChild);
}

// ---------- hover tooltip ----------
function onMove(e, dates, n) {
  const rect = svg.getBoundingClientRect();
  const scale = rect.width / VIEW.w;
  const mx = (e.clientX - rect.left) / scale;
  const innerW = VIEW.w - VIEW.pad.left - VIEW.pad.right;
  const t = (mx - VIEW.pad.left) / innerW;
  const i = Math.max(0, Math.min(n - 1, Math.round(t * (n - 1))));
  const x = xScale(i, n);
  if (hoverLine) {
    hoverLine.setAttribute("x1", x);
    hoverLine.setAttribute("x2", x);
    hoverLine.style.display = "";
  }
  const date = dates[i];
  let html = '<div class="tt-name">' + date.replace(/-/g, ".") + '</div>';
  INDUSTRIES.forEach(name => {
    if (!selected.has(name) || hidden.has(name)) return;
    const v = DB.dates[date][name];
    if (v === undefined) return;
    html += '<div class="tt-row"><span style="color:' + colorOf[name] + '">' + name + '</span><b>' + v.toFixed(4) + '</b></div>';
  });
  tooltip.innerHTML = html;
  tooltip.style.display = "block";
  tooltip.style.left = "0px";
  tooltip.style.top = "0px";
  const area = document.querySelector(".chart-area");
  const arect = area.getBoundingClientRect();
  const ascale = arect.width / VIEW.w;
  let tx = (e.clientX - arect.left) / ascale + 16;
  let ty = (e.clientY - arect.top) / ascale + 14;
  if (tx > 640) tx = (e.clientX - arect.left) / ascale - 240;
  if (ty > 520) ty = (e.clientY - arect.top) / ascale - 170;
  tooltip.style.left = tx + "px";
  tooltip.style.top = ty + "px";
  // x 轴下方显示当前 hover 日期（仅日期本身）
  const xdate = svg.querySelector("#xdate-label");
  if (xdate) {
    xdate.textContent = date.replace(/-/g, ".");
    xdate.setAttribute("x", x);
    xdate.style.display = "";
  }
}
function hideHover() {
  if (hoverLine) hoverLine.style.display = "none";
  tooltip.style.display = "none";
  const xdate = svg.querySelector("#xdate-label");
  if (xdate) xdate.style.display = "none";
}

// ---------- 图例 ----------
function renderLegend() {
  if (!legendEl) return;
  legendEl.innerHTML = "";
  INDUSTRIES.forEach(name => {
    if (!visible(name)) return;
    const item = document.createElement("span");
    item.className = "lg-item" + (hidden.has(name) ? " off" : "");
    item.innerHTML = '<span class="lg-swatch" style="background:' + colorOf[name] + '"></span>' + name;
    item.addEventListener("click", () => {
      if (hidden.has(name)) hidden.delete(name);
      else hidden.add(name);
      renderLines();
    });
    legendEl.appendChild(item);
  });
}

// ---------- 行业多选 ----------
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
      renderLines();
      playEnter();
    });
    list.appendChild(btn);
  });
  $("sp-all") && $("sp-all").addEventListener("click", () => { INDUSTRIES.forEach(n => selected.add(n)); buildSectorPicker(); updateCount(); renderLines(); playEnter(); });
  $("sp-none") && $("sp-none").addEventListener("click", () => { selected.clear(); buildSectorPicker(); updateCount(); renderLines(); playEnter(); });
  updateCount();
}
function updateCount() {
  const el = $("sp-count");
  if (el) el.textContent = "已选 " + selected.size + " / " + INDUSTRIES.length;
}

// ---------- 入场动画：折线生长 ----------
function playEnter() {
  lineEls.forEach((it, idx) => {
    const poly = it.poly;
    const len = (poly.getTotalLength && poly.getTotalLength()) || 400;
    try {
      // 关键：dasharray 必须与 dashoffset 同时存在，否则实线 dashoffset 动画无效
      // 先取消上一次未完成的动画，避免重复点击叠加
      poly.getAnimations().forEach(a => a.cancel());
      poly.animate([
        { strokeDasharray: len + "px", strokeDashoffset: len + "px" },
        { strokeDasharray: len + "px", strokeDashoffset: "0px" }
      ], { duration: 900, easing: "cubic-bezier(.25,.8,.3,1)", delay: idx * 60, fill: "both" });
    } catch (err) {
      /* 忽略 */
    }
  });
}

// ---------- 双日期选择（复用日历组件） ----------
const dpCurBtn = $("dp-cur-btn");
const dpHisBtn = $("dp-his-btn");
const dpPop = $("datepicker-pop");
const dpCurLabel = $("dp-cur-label");
const dpHisLabel = $("dp-his-label");
const dataDates = new Set(ALL_DATES);
let calView = { y: 2026, m: 8 };
let viewMode = "days";
let pickTarget = "cur";

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
    '<button type="button" class="dp-nav" data-nav="prev-m">‹</button>' +
    '<button type="button" class="dp-title-btn" data-nav="pick-m">' + y + ' 年 ' + m + ' 月 ▾</button>' +
    '<button type="button" class="dp-nav" data-nav="next-m">›</button></div>' +
    '<div class="dp-dow-row"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div><div class="dp-grid">';
  for (let i = 0; i < startDow; i++) html += '<span class="dp-blank"></span>';
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = y + "-" + pad2(m) + "-" + pad2(d);
    const hasData = dataDates.has(dateStr);
    const isSel = dateStr === (pickTarget === "cur" ? curDate : hisDate);
    html += '<button type="button" class="dp-day' + (hasData ? " has-data" : "") + (isSel ? " selected" : "") + '" data-date="' + dateStr + '"' + (hasData ? "" : " disabled") + '>' + d + '</button>';
  }
  html += "</div>";
  dpPop.innerHTML = html;
}
function buildMonthsView(y) {
  const monthHasData = {};
  dataDates.forEach(d => { const p = d.split("-"); if (parseInt(p[0], 10) === y) monthHasData[parseInt(p[1], 10)] = true; });
  let html =
    '<div class="dp-head">' +
    '<button type="button" class="dp-nav" data-nav="prev-y">‹</button>' +
    '<button type="button" class="dp-title-btn" data-nav="pick-y">' + y + ' 年 ▾</button>' +
    '<button type="button" class="dp-nav" data-nav="next-y">›</button></div><div class="dp-months">';
  for (let m = 1; m <= 12; m++) {
    const has = monthHasData[m];
    html += '<button type="button" class="dp-month' + (has ? " has-data" : "") + '" data-nav="pick-d" data-month="' + m + '"' + (has ? "" : " disabled") + '>' + m + '月' + (has ? ' <span class="dp-dot"></span>' : '') + '</button>';
  }
  html += "</div>";
  dpPop.innerHTML = html;
}
function buildYearsView(y) {
  const startY = y - 5, endY = y + 6;
  let html =
    '<div class="dp-head">' +
    '<button type="button" class="dp-nav" data-nav="prev-12y">‹</button>' +
    '<button type="button" class="dp-title-btn" data-nav="back">' + startY + ' – ' + endY + '</button>' +
    '<button type="button" class="dp-nav" data-nav="next-12y">›</button></div><div class="dp-years">';
  for (let yr = startY; yr <= endY; yr++) {
    const hasYear = Array.from(dataDates).some(d => d.startsWith(yr + "-"));
    html += '<button type="button" class="dp-year' + (hasYear ? " has-data" : "") + '" data-nav="pick-m" data-year="' + yr + '">' + yr + (hasYear ? ' <span class="dp-dot"></span>' : '') + '</button>';
  }
  html += "</div>";
  dpPop.innerHTML = html;
}
function openCalendar(target) {
  pickTarget = target;
  const wrap = $(target === "cur" ? "dp-cur-wrap" : "dp-his-wrap");
  if (wrap && dpPop.parentNode !== wrap) wrap.appendChild(dpPop);
  const cur = target === "cur" ? curDate : hisDate;
  const parts = cur.split("-");
  buildCalendar(parseInt(parts[0], 10), parseInt(parts[1], 10), "days");
  dpPop.hidden = false;
}
function closeCalendar() { dpPop.hidden = true; }
function setDate(date) {
  if (pickTarget === "cur") { curDate = date; if (dpCurLabel) dpCurLabel.textContent = date; }
  else { hisDate = date; if (dpHisLabel) dpHisLabel.textContent = date; }
  updateDatebar();
  renderLines();
  playEnter();
}
function updateDatebar() {
  if (!datebarEl) return;
  const fmt = (d) => d.replace(/-/g, ".");
  const a = hisDate, b = curDate;
  const start = a < b ? a : b, end = a < b ? b : a;
  datebarEl.innerHTML =
    '<span class="db-tag db-base">当前</span>' + fmt(end) +
    '<span class="db-arrow">←</span>' +
    '<span class="db-tag db-ref">历史</span>' + fmt(start) +
    ' <span style="color:#B8B8C0">（共 ' + rangeDates().length + ' 个交易日）</span>';
}

if (dpCurBtn && dpHisBtn && dpPop) {
  dpCurBtn.addEventListener("click", (e) => { e.stopPropagation(); if (dpPop.hidden || pickTarget !== "cur") openCalendar("cur"); else closeCalendar(); });
  dpHisBtn.addEventListener("click", (e) => { e.stopPropagation(); if (dpPop.hidden || pickTarget !== "his") openCalendar("his"); else closeCalendar(); });
  dpPop.addEventListener("click", (e) => {
    e.stopPropagation();
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
    if (day && day.dataset.date && !day.disabled) { setDate(day.dataset.date); closeCalendar(); }
  });
  document.addEventListener("click", (e) => {
    if (!dpPop.hidden && !dpCurBtn.contains(e.target) && !dpHisBtn.contains(e.target) && !dpPop.contains(e.target)) closeCalendar();
  });
}

// ---------- 启动 ----------
if (dpCurLabel) dpCurLabel.textContent = curDate;
if (dpHisLabel) dpHisLabel.textContent = hisDate;
updateDatebar();
buildSectorPicker();
// 绑定两个双端范围滑块（最新强度 + 近3日变化）
createFilterControl("df-strength", "df-strength-values", F_LATEST_MIN, F_LATEST_MAX, fLatestLo, fLatestHi, (lo, hi) => {
  fLatestLo = lo; fLatestHi = hi; renderLines();
}, 0.01);
createFilterControl("df-change", "df-change-values", F_CHANGE_MIN, F_CHANGE_MAX, fChangeLo, fChangeHi, (lo, hi) => {
  fChangeLo = lo; fChangeHi = hi; renderLines();
}, 0.01);
renderLines();
const btnReplay = $("btn-replay");
if (btnReplay) btnReplay.addEventListener("click", playEnter);
setTimeout(playEnter, 100);

} // end safe-guard
