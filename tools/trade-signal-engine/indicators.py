# -*- coding: utf-8 -*-
"""经典技术指标（纯 Python 实现，零依赖，便于阅读与学习）"""


def sma_series(values, period):
    """简单移动平均序列；数据不足返回空列表"""
    if len(values) < period:
        return []
    out = []
    for i in range(period, len(values) + 1):
        out.append(sum(values[i - period:i]) / period)
    return out


def ema_series(values, period):
    """指数移动平均序列"""
    if len(values) < period:
        return []
    k = 2 / (period + 1)
    seed = sum(values[:period]) / period
    out = [seed]
    for v in values[period:]:
        seed = v * k + seed * (1 - k)
        out.append(seed)
    return out


def rsi(values, period=14):
    """Wilder RSI，返回最新值"""
    if len(values) < period + 1:
        return None
    gains, losses = [], []
    for i in range(1, len(values)):
        d = values[i] - values[i - 1]
        gains.append(max(d, 0.0))
        losses.append(max(-d, 0.0))
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100 - 100 / (1 + rs)


def macd(values, fast=12, slow=26, signal=9):
    """返回 (dif_list, dea_list, hist_list)"""
    ema_fast = ema_series(values, fast)
    ema_slow = ema_series(values, slow)
    if not ema_fast or not ema_slow:
        return [], [], []
    n = min(len(ema_fast), len(ema_slow))
    dif = [ema_fast[-n + i] - ema_slow[-n + i] for i in range(n)]
    dea = ema_series(dif, signal)
    if not dea:
        return dif, [], []
    m = min(len(dif), len(dea))
    dif_a = dif[-m:]
    dea_a = dea[-m:]
    hist = [(d - e) * 2 for d, e in zip(dif_a, dea_a)]
    return dif_a, dea_a, hist


def bollinger(closes, period=20, k=2):
    """返回 (上轨, 中轨, 下轨) 最新值"""
    up, mid, lo = bollinger_series(closes, period, k)
    if not up:
        return None, None, None
    return up[-1], mid[-1], lo[-1]


def bollinger_series(closes, period=20, k=2):
    """返回 (上轨序列, 中轨序列, 下轨序列)，用于计算布林带方向"""
    if len(closes) < period:
        return [], [], []
    up, mid, lo = [], [], []
    for i in range(period, len(closes) + 1):
        window = closes[i - period:i]
        m = sum(window) / period
        var = sum((x - m) ** 2 for x in window) / period
        std = var ** 0.5
        up.append(m + k * std)
        mid.append(m)
        lo.append(m - k * std)
    return up, mid, lo


def atr_series(highs, lows, closes, period=14):
    """真实波幅 ATR 序列（Wilder 平滑）；长度 = len(closes) - 1"""
    if len(closes) < period + 1:
        return []
    trs = []
    for i in range(1, len(closes)):
        h, l, pc = highs[i], lows[i], closes[i - 1]
        trs.append(max(h - l, abs(h - pc), abs(l - pc)))
    out = []
    cur = sum(trs[:period]) / period
    out.append(cur)
    for tr in trs[period:]:
        cur = (cur * (period - 1) + tr) / period
        out.append(cur)
    return out


def atr(highs, lows, closes, period=14):
    """ATR 最新值"""
    s = atr_series(highs, lows, closes, period)
    return s[-1] if s else None
