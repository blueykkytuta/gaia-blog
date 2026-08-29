# -*- coding: utf-8 -*-
"""60 分钟 K 线拉取（新浪，前复权，免费、免 token）"""
from config import PARAMS, to_symbol
from httpget import get_json


def fetch_kline(secid, scale=None, limit=None):
    """返回 [{date, open, close, high, low, volume}, ...]
    新浪 60 分钟 K 线：scale=60，字段 day/open/high/low/close/volume
    """
    scale = scale or PARAMS["kline_scale"]
    limit = limit or PARAMS["kline_limit"]
    sym = to_symbol(secid)
    url = (
        "https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/"
        f"CN_MarketData.getKLineData?symbol={sym}&scale={scale}&ma=no&datalen={limit}"
    )
    data = get_json(url, referer="https://finance.sina.com.cn")
    out = []
    for r in data:
        out.append({
            "date": r["day"],
            "open": float(r["open"]),
            "close": float(r["close"]),
            "high": float(r["high"]),
            "low": float(r["low"]),
            "volume": float(r["volume"]),
        })
    return out
