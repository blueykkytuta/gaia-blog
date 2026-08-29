# -*- coding: utf-8 -*-
"""实时行情拉取（新浪 hq.sinajs.cn，免费、免 token，GBK 编码）"""
import re
from config import to_symbol
from httpget import get_text


def fetch_quote(secid):
    """返回单只标的的实时快照字典（新浪行情为 JS 文本，GBK 编码，需解析）

    新浪 hq 字段顺序：名称,今开,昨收,现价,最高,最低,...
    """
    sym = to_symbol(secid)
    url = f"https://hq.sinajs.cn/list={sym}"
    text = get_text(url, referer="https://finance.sina.com.cn")
    m = re.search(r'hq_str_\w+="(.*?)";', text)
    parts = (m.group(1) if m else "").split(",")

    def f(i):
        try:
            return float(parts[i])
        except (IndexError, ValueError):
            return 0.0

    return {
        "secid": secid,
        "code": sym,
        "name": parts[0] if parts else sym,
        "price": f(3),
        "open": f(1),
        "prev_close": f(2),
        "high": f(4),
        "low": f(5),
    }


def fetch_all(indices):
    return [fetch_quote(i["secid"]) for i in indices]
