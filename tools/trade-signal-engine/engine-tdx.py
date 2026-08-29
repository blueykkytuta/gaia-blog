# -*- coding: utf-8 -*-
"""通达信行业指数信号引擎（本地测试版，10 个行业）

用法：
    python engine-tdx.py

依赖：pytdx（已装到沙箱 Python）
数据源：通达信免费行情服务器（TCP 协议，无需登录）
- category=3 即 60 分钟 K 线（一天 4 根：10:30/11:30/14:00/15:00）
- 行业指数：880xxx 通达信一级行业（56 个），非申万
输出：signals-tdx.json
"""
import os
import sys
import json
import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from indicators import sma_series, rsi, macd, bollinger, bollinger_series, atr_series

# 通达信一级行业（56 个，官方行业分类，非申万）
SECTORS = [
    ("银行",      "880471"),
    ("煤炭",      "880301"),
    ("石油",      "880310"),
    ("钢铁",      "880318"),
    ("有色金属",  "880324"),
    ("化工",      "880335"),
    ("食品饮料",  "880372"),
    ("农林牧渔",  "880360"),
    ("医药",      "880400"),
    ("房地产",    "880482"),
    ("家用电器",  "880387"),
    ("酿酒",      "880380"),
    ("保险",      "880473"),
    ("造纸",      "880350"),
    ("软件服务",  "880493"),
    ("矿物制品",  "880351"),
    ("电器仪表",  "880448"),
    ("化纤",      "880330"),
    ("旅游",      "880424"),
    ("文教休闲",  "880422"),
    ("广告包装",  "880421"),
    ("船舶",      "880431"),
    ("建材",      "880344"),
    ("汽车类",    "880390"),
    ("电力",      "880305"),
    ("交通设施",  "880465"),
    ("医疗保健",  "880398"),
    ("日用化工",  "880355"),
    ("电气设备",  "880446"),
    ("传媒娱乐",  "880418"),
    ("工程机械",  "880447"),
    ("商贸代理",  "880414"),
    ("证券",      "880472"),
    ("家居用品",  "880399"),
    ("综合类",    "880497"),
    ("商业连锁",  "880406"),
    ("运输服务",  "880459"),
    ("水务",      "880454"),
    ("纺织服饰",  "880367"),
    ("通用机械",  "880437"),
    ("公共交通",  "880453"),
    ("多元金融",  "880474"),
    ("互联网",    "880494"),
    ("酒店餐饮",  "880423"),
    ("工业机械",  "880440"),
    ("建筑",      "880476"),
    ("运输设备",  "880432"),
    ("仓储物流",  "880464"),
    ("元器件",    "880492"),
    ("环境保护",  "880456"),
    ("通讯设备",  "880490"),
    ("航空",      "880430"),
    ("IT设备",    "880489"),
    ("电信运营",  "880452"),
    ("半导体",    "880491"),
    ("供气供热",  "880455"),
]

# 策略参数（与 trade-signal-engine 一致）
P = {
    "kline_limit": 320,
    "ma_group": [10, 20, 50, 100],
    "ma_cross_fast": 10,
    "ma_cross_slow": 20,
    "rsi_period": 14,
    "rsi_overbought": 70,
    "rsi_oversold": 30,
    "macd_fast": 12,
    "macd_slow": 26,
    "macd_signal": 9,
    "boll_period": 20,
    "boll_k": 2,
    "atr_period": 14,
    "atr_base": 20,
    "atr_strong": 1.12,
    "atr_weak": 0.88,
    "k_sl": 1.5,
    "k_tp": 3.0,
    "k_tp_strong": 4.0,
    "k_sl_weak": 1.2,
    "k_tp_weak": 2.0,
    "signal_threshold": 2.0,
    "w_ma_cross": 3.5,
    "w_ma_align": 2.2,
    "w_macd_cross": 3.0,
    "w_macd_side": 2.0,
    "w_rsi_edge": 1.0,
    "w_rsi_mid": 0.4,
    "w_boll_edge": 0.8,
    "w_boll_mid": 0.3,
    "clarity_ratio": 0.30,
    "dir_lookback": 28,
    "dir_flat": 0.03,
}

# 通达信免费行情服务器
SERVERS = [
    ("180.153.18.170", 7709),
    ("115.238.90.165", 7709),
    ("119.147.212.81", 7709),
]


def fetch_kline(api, code, count=320):
    """拉 60 分钟 K 线（category=3），返回 [{date, open, close, high, low, volume}, ...]"""
    try:
        bars = api.get_index_bars(3, 1, code, 0, count)
        if not bars:
            return []
        out = []
        for b in bars:
            out.append({
                "date": b["datetime"],
                "open": float(b["open"]),
                "close": float(b["close"]),
                "high": float(b["high"]),
                "low": float(b["low"]),
                "volume": float(b.get("vol", 0) or 0),
            })
        return out
    except Exception:
        return []


def _cross_up(a, b):
    return len(a) >= 2 and a[-1] > b[-1] and a[-2] <= b[-2]


def _cross_down(a, b):
    return len(a) >= 2 and a[-1] < b[-1] and a[-2] >= b[-2]


def evaluate(name, code, klines):
    """对单个行业生成信号（复用 strategy 逻辑）"""
    closes = [k["close"] for k in klines]
    highs = [k["high"] for k in klines]
    lows = [k["low"] for k in klines]

    live = closes[-1] if closes else 0.0
    last = klines[-1] if klines else None
    if last:
        cur_high = max(last["high"], live)
        cur_low = min(last["low"], live)
    else:
        cur_high = cur_low = live
    c = closes + [live]
    h = highs + [cur_high]
    l = lows + [cur_low]

    mas = {n: sma_series(c, n) for n in P["ma_group"]}
    mav = {n: (m[-1] if m else None) for n, m in mas.items()}
    rsi_val = rsi(c, P["rsi_period"])
    dif, dea, hist = macd(c, P["macd_fast"], P["macd_slow"], P["macd_signal"])
    b_u, b_m, b_l = bollinger(c, P["boll_period"], P["boll_k"])
    b_u_s, b_m_s, b_l_s = bollinger_series(c, P["boll_period"], P["boll_k"])
    atr_s = atr_series(h, l, c, P["atr_period"])
    atr_val = atr_s[-1] if atr_s else None

    trend_state, atr_ratio = "中性", None
    if atr_val and len(atr_s) >= P["atr_base"]:
        base = sum(atr_s[-P["atr_base"]:]) / P["atr_base"]
        atr_ratio = atr_val / base if base else None
        if atr_ratio and atr_ratio >= P["atr_strong"]:
            trend_state = "强趋势"
        elif atr_ratio <= P["atr_weak"]:
            trend_state = "弱趋势"

    def _d(slp):
        if slp > P["dir_flat"]:
            return "向上"
        if slp < -P["dir_flat"]:
            return "向下"
        return "走平"

    def _clamp01(x):
        return max(0.0, min(1.0, x))

    rl_pts, rs_pts = [], []
    rl, rs = [], []
    m10, m20, m50 = mav.get(10), mav.get(20), mav.get(50)

    mf, ms = mas.get(P["ma_cross_fast"]), mas.get(P["ma_cross_slow"])
    if mf and ms:
        if _cross_up(mf, ms):
            rl_pts.append(P["w_ma_cross"]); rl.append("MA10 上穿 MA20 金叉（看多）")
        elif _cross_down(mf, ms):
            rs_pts.append(P["w_ma_cross"]); rs.append("MA10 下穿 MA20 死叉（看空）")
    if m10 and m20 and m50:
        if m10 > m20 > m50:
            rl_pts.append(P["w_ma_align"]); rl.append("均线多头排列 MA10>MA20>MA50")
        elif m10 < m20 < m50:
            rs_pts.append(P["w_ma_align"]); rs.append("均线空头排列 MA10<MA20<MA50")

    if dif and dea:
        if _cross_up(dif, dea):
            rl_pts.append(P["w_macd_cross"]); rl.append("MACD 金叉（DIF 上穿 DEA，看多）")
        elif _cross_down(dif, dea):
            rs_pts.append(P["w_macd_cross"]); rs.append("MACD 死叉（DIF 下穿 DEA，看空）")
        elif dif[-1] > dea[-1]:
            hh = (dif[-1] - dea[-1]) / live * 100.0
            rl_pts.append(P["w_macd_side"] * _clamp01(hh / 0.05))
            rl.append(f"MACD 多头（DIF>DEA，柱体 {hh:.3f}%）")
        else:
            hh = (dea[-1] - dif[-1]) / live * 100.0
            rs_pts.append(P["w_macd_side"] * _clamp01(hh / 0.05))
            rs.append(f"MACD 空头（DIF<DEA，柱体 {hh:.3f}%）")

    if rsi_val is not None:
        if rsi_val < P["rsi_oversold"]:
            n = (P["rsi_oversold"] - rsi_val) / P["rsi_oversold"]
            rl_pts.append(P["w_rsi_edge"] * _clamp01(n)); rl.append(f"RSI={rsi_val:.1f} 超卖（偏多，强度 {_clamp01(n):.2f}）")
        elif rsi_val > P["rsi_overbought"]:
            n = (rsi_val - P["rsi_overbought"]) / (100 - P["rsi_overbought"])
            rs_pts.append(P["w_rsi_edge"] * _clamp01(n)); rs.append(f"RSI={rsi_val:.1f} 超买（偏空，强度 {_clamp01(n):.2f}）")
        elif rsi_val > 50:
            n = (rsi_val - 50) / 10.0
            rl_pts.append(P["w_rsi_mid"] * _clamp01(n)); rl.append(f"RSI={rsi_val:.1f} 站上 50（动量偏多，强度 {_clamp01(n):.2f}）")
        else:
            n = (50 - rsi_val) / 10.0
            rs_pts.append(P["w_rsi_mid"] * _clamp01(n)); rs.append(f"RSI={rsi_val:.1f} 跌破 50（动量偏空，强度 {_clamp01(n):.2f}）")

    if b_u is not None:
        if live > b_u:
            rs_pts.append(P["w_boll_edge"]); rs.append(f"价格 {live:.2f} 突破布林上轨 {b_u:.2f}（超买回落）")
        elif live < b_l:
            rl_pts.append(P["w_boll_edge"]); rl.append(f"价格 {live:.2f} 跌破布林下轨 {b_l:.2f}（超卖反弹）")
        elif live > b_m:
            d = (live - b_m) / b_m * 100.0
            rl_pts.append(P["w_boll_mid"] * _clamp01(d / 1.5))
            rl.append(f"价格位于布林中轨之上（偏离 {d:.2f}%，偏多）")
        else:
            d = (b_m - live) / b_m * 100.0
            rs_pts.append(P["w_boll_mid"] * _clamp01(d / 1.5))
            rs.append(f"价格位于布林中轨之下（偏离 {d:.2f}%，偏空）")

    note = f"ATR趋势环境：{trend_state}" + (f"（ATR比率 {atr_ratio:.2f}）" if atr_ratio else "")
    rl.append(note)
    rs.append(note)

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

    lb = P["dir_lookback"]
    def _slp(series):
        if not series or len(series) <= lb:
            return 0.0
        a, b = series[-lb - 1], series[-1]
        return (b - a) / a * 100.0 if a else 0.0

    ma10_s, ma20_s, ma50_s, ma100_s = _slp(mas.get(10)), _slp(mas.get(20)), _slp(mas.get(50)), _slp(mas.get(100))
    ma_dir = _d(ma20_s)
    boll_mid_s = _slp(b_m_s)
    boll_dir = _d(boll_mid_s)
    width_now = (b_u_s[-1] - b_l_s[-1]) if (b_u_s and b_l_s) else 0.0
    width_prev = (b_u_s[-lb - 1] - b_l_s[-lb - 1]) if (b_u_s and b_l_s and len(b_u_s) > lb) else width_now
    width_chg = (width_now - width_prev) / width_prev * 100.0 if width_prev else 0.0
    boll_width = "扩张" if width_chg > P["dir_flat"] * 100 else ("收窄" if width_chg < -P["dir_flat"] * 100 else "平稳")

    score = max(long_score, short_score)
    if score >= P["signal_threshold"]:
        if long_score >= short_score and (long_score - short_score) >= score * P["clarity_ratio"]:
            rec, win = "做多", rl
        elif short_score > long_score and (short_score - long_score) >= score * P["clarity_ratio"]:
            rec, win = "做空", rs
        else:
            rec, win = "观望", (rl if long_score >= short_score else rs)
    else:
        rec, win = "观望", (rl if long_score >= short_score else rs)

    if rec != "观望" and trend_state == "弱趋势":
        if not any(("下轨" in r) or ("上轨" in r) for r in win):
            rec = "观望"

    if rec == "观望":
        strength = "—"
    elif score >= 3.0:
        strength = "强"
    elif score >= 2.3:
        strength = "中"
    else:
        strength = "弱"

    entry = live
    sl = tp = rr = None
    if rec in ("做多", "做空") and atr_val:
        if trend_state == "强趋势":
            k_tp, k_sl = P["k_tp_strong"], P["k_sl"]
        elif trend_state == "弱趋势":
            k_tp, k_sl = P["k_tp_weak"], P["k_sl_weak"]
        else:
            k_tp, k_sl = P["k_tp"], P["k_sl"]
        if rec == "做多":
            sl = entry - k_sl * atr_val
            tp = entry + k_tp * atr_val
        else:
            sl = entry + k_sl * atr_val
            tp = entry - k_tp * atr_val
        rr = (tp - entry) / (entry - sl) if entry != sl else None

    return {
        "name": name,
        "code": code,
        "period": "60分钟",
        "entry": round(entry, 2),
        "price": round(entry, 2),
        "prev_close": round(klines[-2]["close"], 2) if len(klines) > 1 else None,
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
            "ma_dir": ma_dir,
            "ma_slope": round(ma20_s, 3),
            "ma_dirs": {"10": _d(ma10_s), "20": _d(ma20_s), "50": _d(ma50_s), "100": _d(ma100_s)},
            "boll_dir": boll_dir,
            "boll_slope": round(boll_mid_s, 3),
            "boll_width": boll_width,
        },
        "reasons": win,
    }


def main():
    from pytdx.hq import TdxHq_API

    api = TdxHq_API()
    connected = None
    for ip, port in SERVERS:
        try:
            if api.connect(ip, port, time_out=5):
                connected = (ip, port)
                break
        except Exception:
            continue
    if not connected:
        print("无法连接通达信行情服务器")
        return 1
    print(f"已连接通达信行情服务器: {connected[0]}:{connected[1]}")

    results = []
    for name, code in SECTORS:
        klines = fetch_kline(api, code, P["kline_limit"])
        if len(klines) < 60:
            print(f"  !! {name} ({code}) K线不足（{len(klines)} 根），跳过")
            continue
        sig = evaluate(name, code, klines)
        results.append(sig)
        print(f"  {name:>6} 现价={sig['price']:>9.2f}  {sig['trend']}  [{sig['recommendation']}/{sig['strength']}] 评分={sig['score']:.1f}")
    api.disconnect()

    payload = {
        "updated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "source": "通达信行情服务器 60分钟K线（免费）",
        "period": "60分钟",
        "market_open": False,
        "signals": results,
    }
    with open("signals-tdx.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"\n已生成 signals-tdx.json（{len(results)} 个行业）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
