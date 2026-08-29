#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把当前 signals.json 内嵌进 signals.html，生成「双击即可看、无需服务器」的自包含预览页。

用法：
    python engine.py        # 生成 signals.json
    python build_view.py    # 把最新数据内嵌进 signals.html
或直接二合一：
    python engine.py && python build_view.py
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
HTML = os.path.join(HERE, "signals.html")
JSON = os.path.join(HERE, "signals.json")
START = "/*DATA_START*/"
END = "/*DATA_END*/"


def main():
    if not os.path.exists(JSON):
        print("找不到 signals.json，请先运行 python engine.py")
        return
    with open(JSON, encoding="utf-8") as f:
        data = json.load(f)
    with open(HTML, encoding="utf-8") as f:
        html = f.read()
    if START not in html or END not in html:
        print("signals.html 未找到内嵌标记，可能模板被损坏。请恢复原模板。")
        return
    # 只替换标记之间的内容，标记本身保留，可反复注入
    blob = json.dumps(data, ensure_ascii=False)
    html = html.split(START, 1)[0] + START + blob + END + html.split(END, 1)[1]
    with open(HTML, "w", encoding="utf-8") as f:
        f.write(html)
    print("已内嵌最新数据 -> signals.html（%d 条信号，%d 字节内嵌）"
          % (len(data.get("signals", [])), len(blob)))


if __name__ == "__main__":
    main()
