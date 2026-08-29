#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""update-signals.py - 刷新交易信号并部署到博客

用法（在博客工作区根目录执行）:
    python blog/tools/update-signals.py

流程：
  1. 把 signals.html.template 复制为引擎目录的 signals.html
  2. 跑 engine.py：拉新浪行情 → 算指标 → 写 signals.json + 内嵌到 signals.html
  3. 改写 fetch 路径：./signals.json → ./signals-{MMDD}.json
  4. 复制到 blog/signals-{MMDD}.html 和 blog/signals-{MMDD}.json
  5. 打印待推送文件清单
"""
import datetime
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))           # blog/tools/
ENGINE = os.path.join(HERE, "trade-signal-engine")          # blog/tools/trade-signal-engine/
BLOG = os.path.abspath(os.path.join(HERE, ".."))            # blog/ (包装脚本在 blog/tools/，跳一级即 blog/)

TEMPLATE = os.path.join(ENGINE, "signals.html.template")
ENGINE_HTML = os.path.join(ENGINE, "signals.html")
ENGINE_JSON = os.path.join(ENGINE, "signals.json")


def main():
    # 1. 把模板复制成引擎目录的 signals.html
    if not os.path.exists(TEMPLATE):
        print(f"[update-signals] 找不到模板：{TEMPLATE}")
        sys.exit(1)
    shutil.copy2(TEMPLATE, ENGINE_HTML)
    print(f"[update-signals] 模板已就位 -> {ENGINE_HTML}")

    # 2. 跑引擎
    print("[update-signals] 正在跑 engine.py（拉新浪行情 + 算信号）...")
    r = subprocess.run([sys.executable, "engine.py"], cwd=ENGINE)
    if r.returncode != 0:
        print("[update-signals] engine.py 失败，中止")
        sys.exit(1)

    if not os.path.exists(ENGINE_JSON):
        print(f"[update-signals] 引擎未生成 {ENGINE_JSON}")
        sys.exit(1)

    # 3. 改写 fetch 路径：./signals.json → ./signals-{MMDD}.json
    today = datetime.datetime.now()
    date = today.strftime("%m%d")  # 例如 0829
    with open(ENGINE_HTML, encoding="utf-8") as f:
        html = f.read()
    new_path = f"./signals-{date}.json"
    if "./signals.json" not in html:
        print("[update-signals] 警告：在 signals.html 中找不到 './signals.json'，跳过 fetch 路径改写")
    else:
        html = html.replace("./signals.json", new_path)
        with open(ENGINE_HTML, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"[update-signals] fetch 路径 -> {new_path}")

    # 4. 复制到 blog/
    out_html = os.path.join(BLOG, f"signals-{date}.html")
    out_json = os.path.join(BLOG, f"signals-{date}.json")
    shutil.copy2(ENGINE_HTML, out_html)
    shutil.copy2(ENGINE_JSON, out_json)
    print(f"[update-signals] 输出 -> {out_html}")
    print(f"[update-signals] 输出 -> {out_json}")

    # 5. 待推送清单
    print("\n=== 推送清单（GitHub API）===")
    print(f"  blog/signals-{date}.html  ->  signals-{date}.html")
    print(f"  blog/signals-{date}.json  ->  signals-{date}.json")
    print(f"  blog/index.html  (将\"交易信号\"入口指向 signals-{date}.html)")
    print("\n下一步：让我（WorkBuddy）把这些文件用 GitHub API 推到 main 分支即可。")


if __name__ == "__main__":
    main()
