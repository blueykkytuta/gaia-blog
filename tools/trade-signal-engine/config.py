# -*- coding: utf-8 -*-
"""标的基础与策略参数（可自由调整）

说明：
- 本引擎用宽基指数作为「标的基础」，其信号可对应到相应的股指期货（IF/IC/IH/IM）。
  若要直接跑期货品种，把 INDICES 换成期货的 secid 即可（新浪符号规则一致）。
- 数据源当前用新浪（免费、免 token、含 60 分钟 K 线）；
  若要换回东方财富，把 quotes/kline 的取数地址改为 push2 / push2his(klt=60) 即可。
"""

# 宽基指数：secid = "市场.代码"，1=上交所，0=深交所
INDICES = [
    {"name": "沪深300", "secid": "1.000300"},
    {"name": "中证1000", "secid": "1.000852"},
    {"name": "创业板指", "secid": "0.399006"},
    {"name": "上证指数", "secid": "1.000001"},
    {"name": "红利指数", "secid": "1.000015"},
    {"name": "科创50",  "secid": "1.000688"},
]


def to_symbol(secid):
    """secid '1.000300' -> 新浪符号 'sh000300'（1=沪 sh，0=深 sz）"""
    mkt, code = secid.split(".")
    return ("sh" if mkt == "1" else "sz") + code


# 策略参数
PARAMS = {
    # ===== K线周期 =====
    "kline_scale": 60,        # 60 分钟线（新浪 scale 参数）
    "kline_limit": 320,       # 拉取的 60 分钟 K 线根数（约 80 交易日，足够 MA60 + ATR）

    # ===== 均线组 =====
    "ma_group": [10, 20, 50, 100],
    "ma_cross_fast": 10,      # 金叉/死叉判定用的快线（新均线组最短一根）
    "ma_cross_slow": 20,      # 金叉/死叉判定用的慢线

    # ===== RSI =====
    "rsi_period": 14,
    "rsi_overbought": 70,
    "rsi_oversold": 30,

    # ===== MACD =====
    "macd_fast": 12,
    "macd_slow": 26,
    "macd_signal": 9,

    # ===== BOLL =====
    "boll_period": 20,
    "boll_k": 2,

    # ===== ATR（强弱趋势 + 止盈止损）=====
    "atr_period": 14,
    "atr_base": 20,           # ATR 的基线均线周期，用于判定强弱趋势
    "atr_strong": 1.12,       # ATR / 基线 >= 此值 -> 强趋势期
    "atr_weak": 0.88,         # ATR / 基线 <= 此值 -> 弱趋势期（震荡）

    # ===== 止盈止损倍数（以 ATR 为单位的幅度）=====
    "k_sl": 1.5,              # 常规止损 = 1.5 × ATR
    "k_tp": 3.0,              # 常规止盈 = 3.0 × ATR（风险回报约 2:1）
    "k_tp_strong": 4.0,       # 强趋势期放宽止盈（让利润奔跑）
    "k_sl_weak": 1.2,         # 弱趋势期收紧止损
    "k_tp_weak": 2.0,         # 弱趋势期收紧止盈

    # ===== 信号阈值 =====
    "signal_threshold": 2.0,  # 多/空评分达到此值才发出信号（否则观望）

    # ===== 信号权重（MACD / 均线组 给更高，RSI / BOLL 给更低）=====
    "w_ma_cross": 3.5,    # MA 金叉 / 死叉（最强趋势信号，权重最高）
    "w_ma_align": 2.2,    # 多头 / 空头排列（略高于 MACD 侧 2.0，符合"均线组也要高权重"）
    "w_macd_cross": 3.0,  # MACD 金叉 / 死叉
    "w_macd_side": 2.0,   # MACD 多 / 空头（DIF 与 DEA 关系）
    "w_rsi_edge": 1.0,    # RSI 超买 / 超卖
    "w_rsi_mid": 0.4,     # RSI 站上 / 跌破 50
    "w_boll_edge": 0.8,   # 突破 / 跌破布林上 / 下轨
    "w_boll_mid": 0.3,    # 价格位于布林中轨之上 / 之下

    # ===== 清晰度门槛（防拉锯）=====
    "clarity_ratio": 0.30,  # (大边 − 小边) >= 总分 × 此比例 才算单边信号，否则观望

    # ===== 方向 / 形态判定 =====
    "dir_lookback": 28,       # 用最近 N 根 K 线算斜率（约 7 交易日 @60m）判定整体方向
    "dir_flat": 0.03,         # 斜率绝对值 < 此值(%) 视为走平

    # ===== 轮询间隔（秒）=====
    "poll_interval": 300,          # 盘中每 5 分钟
    "poll_interval_close": 1800,   # 休市每 30 分钟
}
