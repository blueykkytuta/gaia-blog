# -*- coding: utf-8 -*-
"""统一的 JSON/文本拉取：优先 curl（本环境最稳），回退 urllib；支持自定义 Referer"""
import json
import subprocess
import urllib.request

_DEFAULT_REFERER = "https://finance.sina.com.cn"

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "*/*",
}


def _decode(raw):
    """新浪行情为 GBK，K线为 UTF-8，统一容错解码"""
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("gbk", errors="ignore")


def get_text(url, referer=None, retries=2):
    """返回原始文本（行情接口有的是 JS 文本而非 JSON，且编码可能为 GBK）"""
    ref = referer or _DEFAULT_REFERER
    last = None
    for _ in range(retries + 1):
        try:
            try:
                out = subprocess.run(
                    ["curl", "-s", "-m", "15", "-e", ref, url],
                    capture_output=True, timeout=20,
                ).stdout
                if out and out.strip():
                    return _decode(out)
            except FileNotFoundError:
                pass  # 环境无 curl，走 urllib 回退
            req = urllib.request.Request(url, headers={**_HEADERS, "Referer": ref})
            with urllib.request.urlopen(req, timeout=15) as r:
                return _decode(r.read())
        except Exception as e:
            last = e
    raise last


def get_json(url, referer=None, retries=2):
    return json.loads(get_text(url, referer, retries))
