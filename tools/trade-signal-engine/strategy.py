# -*- coding: utf-8 -*-
"""15 分钟期货多空信号引擎

指标：均线组(MA10/20/50/100) + MACD(12,26,9) + RSI(14) + BOLL(20,2)
辅助：ATR(14) 判定强/弱趋势期，并直接量出止盈/止损价位（以 ATR 为幅度单位）

输出：对每个标的给出 做多 / 做空 / 观望 + 强度 + 开仓参考价 + 止损价 + 止盈价 + 盈亏比
"""
from config import PARAMS
from indicators import sma_series, rsi, macd, bollinger, bollinger_series, atr_series


def _cross_up(a, b):
    """a 最新一根上穿 b（前一根还在下方）"""
    return len(a) >= 2 and a[-1] > b[-1] and a[-2] <= b[-2]


def _cross_down(a, b):
    return len(a) >= 2 and a[-1] < b[-1] and a[-2] >= b[-2]


def evaluate(quote, klines):
    """对单只标的生成多空信号字典"""
    p = PARAMS

    closes = [k["close"] for k in klines]
    highs = [k["high"] for k in klines]
    lows = [k["low"] for k in klines]

    # 即时：用实时价作为「当前(未完成)15分钟K线」的收盘，使信号随现价刷新。
    # 当前K线 = (昨收=上一根收盘, 最高=max(上根高,现价), 最低=min(上根低,现价), 收盘=现价)
    live = (quote.get("price") or closes[-1]) if closes else (quote.get("price") or 0.0)
    last = klines[-1] if klines else None
    if last:
        cur_open = last["close"]
        cur_high = max(last["high"], live)
        cur_low = min(last["low"], live)
    else:
        cur_open, cur_high, cur_low = live, live, live
    c = closes + [live]
    h = highs + [cur_high]
    l = lows + [cur_low]

    # 均线组
    mas = {n: sma_series(c, n) for n in p["ma_group"]}
    mav = {n: (m[-1] if m else None) for n, m in mas.items()}

    # 其余指标
    rsi_val = rsi(c, p["rsi_period"])
    dif, dea, hist = macd(c, p["macd_fast"], p["macd_slow"], p["macd_signal"])
    b_u, b_m, b_l = bollinger(c, p["boll_period"], p["boll_k"])
    b_u_s, b_m_s, b_l_s = bollinger_series(c, p["boll_period"], p["boll_k"])
    atr_s = atr_series(h, l, c, p["atr_period"])
    atr_val = atr_s[-1] if atr_s else None

    # ATR 强弱趋势判定：ATR 相对其基线放大 -> 强趋势（波动扩张）；收缩 -> 弱趋势（震荡）
    trend_state, atr_ratio = "中性", None
    if atr_val and len(atr_s) >= p["atr_base"]:
        base = sum(atr_s[-p["atr_base"]:]) / p["atr_base"]
        atr_ratio = atr_val / base if base else None
        if atr_ratio and atr_ratio >= p["atr_strong"]:
            trend_state = "强趋势"
        elif atr_ratio <= p["atr_weak"]:
            trend_state = "弱趋势"

    # 工具：方向判定 + 0~1 裁剪（动态给分用）
    def _d(slp):
        if slp > p["dir_flat"]:
            return "向上"
        if slp < -p["dir_flat"]:
            return "向下"
        return "走平"
    def _clamp01(x):
        return max(0.0, min(1.0, x))

    # 多/空两条评分线（收集每条触发条件的具体分值，供 "max + 其余均值" 聚合）
    rl_pts, rs_pts = [], []
    rl, rs = [], []
    m10, m20, m50 = mav.get(10), mav.get(20), mav.get(50)

    # ===== 均线组 =====
    mf, ms = mas.get(p["ma_cross_fast"]), mas.get(p["ma_cross_slow"])
    if mf and ms:
        if _cross_up(mf, ms):
            rl_pts.append(p["w_ma_cross"]); rl.append(f"MA{p['ma_cross_fast']} 上穿 MA{p['ma_cross_slow']} 金叉（看多）")
        elif _cross_down(mf, ms):
            rs_pts.append(p["w_ma_cross"]); rs.append(f"MA{p['ma_cross_fast']} 下穿 MA{p['ma_cross_slow']} 死叉（看空）")
    if m10 and m20 and m50:
        if m10 > m20 > m50:
            rl_pts.append(p["w_ma_align"]); rl.append("均线多头排列 MA10>MA20>MA50")
        elif m10 < m20 < m50:
            rs_pts.append(p["w_ma_align"]); rs.append("均线空头排列 MA10<MA20<MA50")

    # ===== MACD =====
    if dif and dea:
        if _cross_up(dif, dea):
            rl_pts.append(p["w_macd_cross"]); rl.append("MACD 金叉（DIF 上穿 DEA，看多）")
        elif _cross_down(dif, dea):
            rs_pts.append(p["w_macd_cross"]); rs.append("MACD 死叉（DIF 下穿 DEA，看空）")
        elif dif[-1] > dea[-1]:
            h = (dif[-1] - dea[-1]) / live * 100.0          # 柱体占现价百分比
            rl_pts.append(p["w_macd_side"] * _clamp01(h / 0.05))  # 0.05% 柱体=满分
            rl.append(f"MACD 多头（DIF>DEA，柱体 {h:.3f}%）")
        else:
            h = (dea[-1] - dif[-1]) / live * 100.0
            rs_pts.append(p["w_macd_side"] * _clamp01(h / 0.05))
            rs.append(f"MACD 空头（DIF<DEA，柱体 {h:.3f}%）")

    # ===== RSI（按偏离 50 的程度动态给分：50~60 映射 0~1，超出饱和）=====
    if rsi_val is not None:
        if rsi_val < p["rsi_oversold"]:
            n = (p["rsi_oversold"] - rsi_val) / p["rsi_oversold"]
            rl_pts.append(p["w_rsi_edge"] * _clamp01(n)); rl.append(f"RSI={rsi_val:.1f} 超卖（偏多，强度 {_clamp01(n):.2f}）")
        elif rsi_val > p["rsi_overbought"]:
            n = (rsi_val - p["rsi_overbought"]) / (100 - p["rsi_overbought"])
            rs_pts.append(p["w_rsi_edge"] * _clamp01(n)); rs.append(f"RSI={rsi_val:.1f} 超买（偏空，强度 {_clamp01(n):.2f}）")
        elif rsi_val > 50:
            n = (rsi_val - 50) / 10.0
            rl_pts.append(p["w_rsi_mid"] * _clamp01(n)); rl.append(f"RSI={rsi_val:.1f} 站上 50（动量偏多，强度 {_clamp01(n):.2f}）")
        else:
            n = (50 - rsi_val) / 10.0
            rs_pts.append(p["w_rsi_mid"] * _clamp01(n)); rs.append(f"RSI={rsi_val:.1f} 跌破 50（动量偏空，强度 {_clamp01(n):.2f}）")

    # ===== BOLL =====
    if b_u is not None:
        if live > b_u:
            rs_pts.append(p["w_boll_edge"]); rs.append(f"价格 {live:.2f} 突破布林上轨 {b_u:.2f}（超买回落）")
        elif live < b_l:
            rl_pts.append(p["w_boll_edge"]); rl.append(f"价格 {live:.2f} 跌破布林下轨 {b_l:.2f}（超卖反弹）")
        elif live > b_m:
            d = (live - b_m) / b_m * 100.0                       # 高于中轨的百分比
            rl_pts.append(p["w_boll_mid"] * _clamp01(d / 1.5))   # 偏离 1.5% = 满分
            rl.append(f"价格位于布林中轨之上（偏离 {d:.2f}%，偏多）")
        else:
            d = (b_m - live) / b_m * 100.0
            rs_pts.append(p["w_boll_mid"] * _clamp01(d / 1.5))
            rs.append(f"价格位于布林中轨之下（偏离 {d:.2f}%，偏空）")

    # ATR 趋势环境注记
    note = f"ATR趋势环境：{trend_state}" + (f"（ATR比率 {atr_ratio:.2f}）" if atr_ratio else "")
    rl.append(note)
    rs.append(note)

    # 单边聚合：最大值 + 其余触发项均值（其余不足 1 项时记 0）
    def _agg(pts):
        if not pts:
            return 0.0
        if len(pts) == 1:
            return pts[0]
        m = max(pts)
        rest = list(pts); rest.remove(m)
        return m + sum(rest) / len(rest)

    long_score = _agg(rl_pts)
    short_score = _agg(rs_pts)

    # ===== 方向 / 形态（均线组、布林带的整体方向）=====
    lb = p["dir_lookback"]
    def _slp(series):
        if not series or len(series) <= lb:
            return 0.0
        a, b = series[-lb - 1], series[-1]
        return (b - a) / a * 100.0 if a else 0.0
    ma10_s, ma20_s, ma50_s, ma100_s = _slp(mas.get(10)), _slp(mas.get(20)), _slp(mas.get(50)), _slp(mas.get(100))
    ma_dir = _d(ma20_s)                       # 以 MA20 代表均线整体形态方向
    boll_mid_s = _slp(b_m_s)
    boll_dir = _d(boll_mid_s)                 # 布林中轨斜率 = 带整体方向
    # 带宽：扩张 / 收窄 / 平稳
    width_now = (b_u_s[-1] - b_l_s[-1]) if (b_u_s and b_l_s) else 0.0
    width_prev = (b_u_s[-lb - 1] - b_l_s[-lb - 1]) if (b_u_s and b_l_s and len(b_u_s) > lb) else width_now
    width_chg = (width_now - width_prev) / width_prev * 100.0 if width_prev else 0.0
    boll_width = "扩张" if width_chg > p["dir_flat"] * 100 else ("收窄" if width_chg < -p["dir_flat"] * 100 else "平稳")

    # ===== 选边（max+其余均值 聚合 + 阈值 + 清晰度门槛防拉锯）=====
    score = max(long_score, short_score)
    if score >= p["signal_threshold"]:
        if long_score >= short_score and (long_score - short_score) >= score * p["clarity_ratio"]:
            rec, win = "做多", rl
        elif short_score > long_score and (short_score - long_score) >= score * p["clarity_ratio"]:
            rec, win = "做空", rs
        else:
            rec, win = "观望", (rl if long_score >= short_score else rs)
    else:
        rec, win = "观望", (rl if long_score >= short_score else rs)

    # 弱趋势期：只做均值回归（须触及布林上/下轨），否则观望，避免震荡中被来回扫损
    if rec != "观望" and trend_state == "弱趋势":
        if not any(("下轨" in r) or ("上轨" in r) for r in win):
            rec = "观望"

    # 强度（阈值随新权重缩放：>=3.0 强 / >=2.3 中 / 否则弱）
    if rec == "观望":
        strength = "—"
    elif score >= 3.0:
        strength = "强"
    elif score >= 2.3:
        strength = "中"
    else:
        strength = "弱"

    # ===== 止盈 / 止损（ATR 度量）=====
    entry = live
    sl = tp = rr = None
    if rec in ("做多", "做空") and atr_val:
        if trend_state == "强趋势":
            k_tp, k_sl = p["k_tp_strong"], p["k_sl"]
        elif trend_state == "弱趋势":
            k_tp, k_sl = p["k_tp_weak"], p["k_sl_weak"]
        else:
            k_tp, k_sl = p["k_tp"], p["k_sl"]
        if rec == "做多":
            sl = entry - k_sl * atr_val
            tp = entry + k_tp * atr_val
        else:
            sl = entry + k_sl * atr_val
            tp = entry - k_tp * atr_val
        rr = (tp - entry) / (entry - sl) if entry != sl else None

    return {
        "name": quote["name"],
        "code": quote["code"],
        "period": f"{p['kline_scale']}分钟",
        "entry": round(entry, 2),
        "price": round(entry, 2),
        "prev_close": round(quote.get("prev_close", 0) or 0, 2),
        "trend": trend_state,
        "atr": round(atr_val, 3) if atr_val else None,
        "atr_pct": round(atr_val / entry * 100, 2) if atr_val and entry else None,
        "atr_ratio": round(atr_ratio, 3) if atr_ratio else None,
        "recommendation": rec,
        "strength": strength,
        "score": round(score, 2),
        "long_score": round(long_score, 2),
        "short_score": round(short_score, 2),
        "stop_loss": round(sl, 2) if sl is not None else None,
        "take_profit": round(tp, 2) if tp is not None else None,
        "risk_reward": round(rr, 2) if rr is not None else None,
        "indicators": {
            "ma10": round(mav[10], 2) if mav.get(10) is not None else None,
            "ma20": round(mav[20], 2) if mav.get(20) is not None else None,
            "ma50": round(mav[50], 2) if mav.get(50) is not None else None,
            "ma100": round(mav[100], 2) if mav.get(100) is not None else None,
            "rsi": round(rsi_val, 2) if rsi_val is not None else None,
            "macd_dif": round(dif[-1], 3) if dif else None,
            "macd_dea": round(dea[-1], 3) if dea else None,
            "macd_hist": round(hist[-1], 3) if hist else None,
            "boll_upper": round(b_u, 2) if b_u is not None else None,
            "boll_mid": round(b_m, 2) if b_m is not None else None,
            "boll_lower": round(b_l, 2) if b_l is not None else None,
            # 方向 / 形态
            "ma_dir": ma_dir,
            "ma_slope": round(ma20_s, 3),
            "ma_dirs": {"10": _d(ma10_s), "20": _d(ma20_s), "50": _d(ma50_s), "100": _d(ma100_s)},
            "boll_dir": boll_dir,
            "boll_slope": round(boll_mid_s, 3),
            "boll_width": boll_width,
        },
        "reasons": win,
    }
