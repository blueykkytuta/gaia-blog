/* ============================================================
   Carrycore 文章图片灯箱（v1 · 2026-09-21）
   ------------------------------------------------------------
   仅作用于文章正文里的图片：article.post .post-body img
   （首页画廊卡片是链接，不接管，保持点卡片进文章）

   交互：
     · 点击图片（或键盘 Enter / 空格）→ 当前页面内全屏查看，不跳转、不开新页面
     · ← / → 或左右按钮 → 切换同一篇文章的所有图片（循环）
     · Esc / 右上角 × / 点击图片外空白 → 关闭
     · 双击图片 → 在「适应屏幕」与「原始尺寸 1:1」间切换（1:1 可滚动看细节）
     · 移动端左右滑动切图
     · 底部显示图注与「第几张 / 共几张」

   ⚠️ 本文件用独立的 css/lightbox-0921.css 提供样式；
      改样式要连同 CSS 文件名一起换新（CF 忽略 ?v=N）。
   ============================================================ */
(function () {
  'use strict';

  var SEL = 'article.post .post-body img';
  var imgs = [].slice.call(document.querySelectorAll(SEL)).filter(function (im) {
    return !!im.getAttribute('src');
  });
  if (!imgs.length) { return; }

  var doc = document, root = doc.documentElement;
  root.classList.add('cc-lb-on');           // 有 JS 时才显示 zoom-in 光标

  var SVG_CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var SVG_PREV  = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4l-8 8 8 8"/></svg>';
  var SVG_NEXT  = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4l8 8-8 8"/></svg>';

  var ov = null, stage = null, el = null, capEl = null, cntEl = null;
  var btnPrev = null, btnNext = null, btnClose = null;
  var cur = 0, isOpen = false, zoomed = false, built = false;
  var lastFocus = null, lockY = 0, padRight = 0;

  /* ---------- 工具 ---------- */
  function srcOf(im) {
    return im.getAttribute('data-lb-src') || im.currentSrc || im.getAttribute('src') || '';
  }

  function captionOf(im) {
    var fig = im.closest ? im.closest('figure') : null;
    var c = fig ? fig.querySelector('figcaption') : null;
    var t = c ? c.textContent : (im.getAttribute('alt') || '');
    return (t || '').replace(/\s+/g, ' ').trim();
  }

  function preload(i) {
    if (imgs.length < 2) { return; }
    var n = (i + imgs.length) % imgs.length;
    var s = srcOf(imgs[n]);
    if (!s) { return; }
    var pre = new Image();
    pre.decoding = 'async';
    pre.src = s;
  }

  /* ---------- 滚动锁（position:fixed 方案，保留原滚动位置） ---------- */
  function lockScroll() {
    lockY = window.pageYOffset || root.scrollTop || 0;
    padRight = window.innerWidth - root.clientWidth;   // 滚动条宽度补偿，避免内容右移
    var b = doc.body;
    b.style.position = 'fixed';
    b.style.top = (-lockY) + 'px';
    b.style.left = '0';
    b.style.right = '0';
    b.style.width = '100%';
    if (padRight > 0) { b.style.paddingRight = padRight + 'px'; }
  }

  function unlockScroll() {
    var b = doc.body;
    b.style.position = '';
    b.style.top = '';
    b.style.left = '';
    b.style.right = '';
    b.style.width = '';
    b.style.paddingRight = '';
    window.scrollTo(0, lockY);
  }

  /* ---------- 构建 DOM（首次打开时才建，页面初始零开销） ---------- */
  function build() {
    built = true;

    ov = doc.createElement('div');
    ov.className = 'cc-lb';
    ov.hidden = true;
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', '图片查看');
    ov.innerHTML =
      '<div class="cc-lb-stage">' +
        '<img class="cc-lb-img" alt="" draggable="false">' +
      '</div>' +
      '<button class="cc-lb-close" type="button" aria-label="关闭">' + SVG_CLOSE + '</button>' +
      '<button class="cc-lb-nav cc-lb-prev" type="button" aria-label="上一张">' + SVG_PREV + '</button>' +
      '<button class="cc-lb-nav cc-lb-next" type="button" aria-label="下一张">' + SVG_NEXT + '</button>' +
      '<div class="cc-lb-bar">' +
        '<span class="cc-lb-cap"></span>' +
        '<span class="cc-lb-cnt"></span>' +
      '</div>';

    doc.body.appendChild(ov);

    stage    = ov.querySelector('.cc-lb-stage');
    el       = ov.querySelector('.cc-lb-img');
    capEl    = ov.querySelector('.cc-lb-cap');
    cntEl    = ov.querySelector('.cc-lb-cnt');
    btnPrev  = ov.querySelector('.cc-lb-prev');
    btnNext  = ov.querySelector('.cc-lb-next');
    btnClose = ov.querySelector('.cc-lb-close');

    btnClose.addEventListener('click', function (e) { e.stopPropagation(); close(); });
    btnPrev.addEventListener('click',  function (e) { e.stopPropagation(); go(-1); });
    btnNext.addEventListener('click',  function (e) { e.stopPropagation(); go(1); });

    /* 点图片本身不关闭（防误触），点图片外的舞台空白关闭 */
    ov.addEventListener('click', function (e) {
      if (e.target === ov || e.target === stage) { close(); }
    });
    el.addEventListener('click', function (e) { e.stopPropagation(); });
    el.addEventListener('dblclick', function (e) { e.preventDefault(); toggleZoom(); });

    doc.addEventListener('keydown', onKey, true);

    /* 移动端左右滑动切图 */
    var tsX = 0, tsY = 0, tsT = 0;
    stage.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { return; }
      tsX = e.touches[0].clientX;
      tsY = e.touches[0].clientY;
      tsT = Date.now();
    }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      if (zoomed || imgs.length < 2 || !e.changedTouches.length) { return; }
      var t = e.changedTouches[0];
      var dx = t.clientX - tsX, dy = t.clientY - tsY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4 && (Date.now() - tsT) < 700) {
        go(dx < 0 ? 1 : -1);
      }
    }, { passive: true });
  }

  /* ---------- 渲染 ---------- */
  function render() {
    var im = imgs[cur];
    el.classList.remove('cc-lb-zoom');
    zoomed = false;
    el.setAttribute('src', srcOf(im));
    el.alt = im.getAttribute('alt') || '';
    capEl.textContent = captionOf(im);
    cntEl.textContent = (cur + 1) + ' / ' + imgs.length;
    var many = imgs.length > 1;
    btnPrev.hidden = !many;
    btnNext.hidden = !many;
    preload(cur + 1);
    preload(cur - 1);
  }

  function open(i) {
    /* 已打开时只切换当前图，不重复锁滚动
       —— 否则第二次 lockScroll() 读到的 pageYOffset 已是 0（body 被 fixed），
          关闭后会把读者扔回页面顶部 */
    if (isOpen) { cur = i; render(); return; }
    if (!built) { build(); }
    lastFocus = doc.activeElement;
    cur = i;
    render();
    lockScroll();
    ov.hidden = false;
    void ov.offsetWidth;              // 触发 reflow，让淡入过渡生效
    ov.classList.add('cc-lb-in');
    isOpen = true;
    try { btnClose.focus({ preventScroll: true }); } catch (e) { btnClose.focus(); }
  }

  function close() {
    if (!isOpen) { return; }
    isOpen = false;
    ov.classList.remove('cc-lb-in');
    window.setTimeout(function () {
      ov.hidden = true;
      el.removeAttribute('src');
      unlockScroll();
      if (lastFocus && lastFocus.focus) {
        try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      }
    }, 210);
  }

  function go(delta) {
    if (imgs.length < 2) { return; }
    cur = (cur + delta + imgs.length) % imgs.length;
    render();
  }

  function toggleZoom() {
    zoomed = !zoomed;
    el.classList.toggle('cc-lb-zoom', zoomed);
    if (!zoomed) { stage.scrollTop = 0; stage.scrollLeft = 0; }
  }

  function onKey(e) {
    if (!isOpen) { return; }
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
  }

  /* ---------- 绑定文章内图片 ---------- */
  imgs.forEach(function (im, i) {
    im.addEventListener('click', function (e) { e.preventDefault(); open(i); });
    /* 键盘可达：Tab 到图片后按 Enter / 空格打开 */
    im.setAttribute('tabindex', '0');
    im.setAttribute('role', 'button');
    im.setAttribute('aria-label', '放大查看：' + (captionOf(im) || ('第 ' + (i + 1) + ' 张图')));
    im.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        open(i);
      }
    });
  });
})();
