# -*- coding: utf-8 -*-
"""主引擎：拉取实时行情 + 60分钟K线 -> 计算指标 -> 生成多空信号 -> 输出 signals.json + 控制台

用法：
    单次快照：  python engine.py
    持续轮询：  python engine.py loop
"""
import os
import sys
import json
import time
import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import INDICES, PARAMS
from quotes import fetch_all
from kline import fetch_kline
from strategy import evaluate

OUTPUT = "signals.json"


def is_trading_time(now=None):
    """指数现货交易时段（期货有夜盘，但标的基础为指数，夜盘无行情）"""
    now = now or datetime.datetime.now()
    if now.weekday() >= 5:
        return False
    t = now.hour * 60 + now.minute
    return (9 * 60 + 30 <= t <= 11 * 60 + 30) or (13 * 60 <= t <= 15 * 60)


def run_once():
    quotes = fetch_all(INDICES)
    results = []
    for q in quotes:
        klines = fetch_kline(q["secid"])
        if not klines:
            continue
        results.append(evaluate(q, klines))

    payload = {
        "updated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "source": "新浪财经 实时行情 + 60分钟K线（免费，延迟约 3-15 秒）",
        "period": f"{PARAMS['kline_scale']}分钟",
        "market_open": is_trading_time(),
        "signals": results,
    }
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    _print(payload)
    # 顺手把数据内嵌进 signals.html，生成双击即可看的自包含预览页
    try:
        import build_view
        build_view.main()
    except Exception as e:
        print("（内嵌预览页失败，可手动跑 python build_view.py：%s）" % e)
    return payload


def _print(payload):
    print(f"\n=== 交易信号 @ {payload['updated_at']}  [{payload['period']}]  "
          f"市场{'开盘中' if payload['market_open'] else '已收盘'} ===")
    for s in payload["signals"]:
        sl = f"{s['stop_loss']:.2f}" if s["stop_loss"] is not None else "—"
        tp = f"{s['take_profit']:.2f}" if s["take_profit"] is not None else "—"
        rr = f"{s['risk_reward']:.2f}" if s["risk_reward"] is not None else "—"
        print(f"{s['name']:>6} 现价{s['price']:>9.2f}  {s['trend']}  "
              f"[{s['recommendation']}/{s['strength']}] 评分={s['score']:.1f} "
              f"(多{s['long_score']:.1f}/空{s['short_score']:.1f})")
        print(f"      开仓≈{s['entry']:.2f}  止损={sl}  止盈={tp}  盈亏比={rr}  ATR={s['atr']}")
        for r in s["reasons"]:
            print(f"      - {r}")


def run_loop():
    while True:
        try:
            run_once()
        except Exception as e:
            print("运行异常:", e)
        interval = PARAMS["poll_interval"] if is_trading_time() else PARAMS["poll_interval_close"]
        time.sleep(interval)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "loop":
        run_loop()
    else:
        run_once()
