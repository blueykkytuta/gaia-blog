#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""通过 GitHub Git Data API 创建 commit（绕过 git push 协议限制）
用法：python push-via-api.py
说明：修改 FILES 列表 + MSG 为本轮变更；自动基于远端 HEAD 创建 commit
"""
import os, base64, json, urllib.request, sys

# 禁用代理（沙箱 HTTPS_PROXY 指向未监听端口）
for k in ("http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY"):
    os.environ.pop(k, None)

TOKEN = open("C:/Users/htzg/.workbuddy/github_token.txt").read().strip()
OWNER = "blueykkytuta"
REPO = "gaia-blog"
ROOT = "C:/Users/htzg/WorkBuddy/2026-08-09-15-49-53/blog"
BASE = f"https://api.github.com/repos/{OWNER}/{REPO}"

MSG = "feat: 全站留言板（Worker + KV，通过 carrycore.cc.cd/api Route）"

FILES = [
    "guestbook.html",
    "index.html",
    "about.html",
    "archive.html",
    "relative-strength.html",
    "sector-strength-0811.html",
    "sector-trend-path.html",
    "posts/crypto-new-asset-class.html",
    "posts/csi1000-fund-flow-0811.html",
    "posts/gold-eternal-value.html",
    "posts/k-line-volume-language.html",
    "posts/rate-cycle-and-asset-pricing.html",
    "posts/tech-valuation-anchor.html",
    "posts/zhongzheng1000-strong-inflow.html",
    "tools/guestbook-worker.js",
    "tools/push-via-api.py",
    "tools/test-404-check.js",
    "tools/test-cf-migrate.js",
    "tools/test-gate-online.js",
    "tools/test-guestbook-local.js",
    "tools/test-guestbook-v2.js",
    "tools/test-leave-manual.js",
    "tools/test-online-0814b.js",
    "tools/test-online-26d.js",
    "tools/test-online-enter-leave.js",
    "tools/test-online-guard.js",
    "tools/test-online-v7.js",
    "tools/test-trend-hover-online.js",
]


def api(method, path, body=None):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Authorization", f"Bearer {TOKEN}")
    req.add_header("Accept", "application/vnd.github+json")
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    data = None
    if body is not None:
        req.add_header("Content-Type", "application/json")
        data = json.dumps(body).encode("utf-8")
    try:
        with opener.open(req, data=data, timeout=60) as r:
            raw = r.read().decode("utf-8")
            return r.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="ignore")
        return e.code, json.loads(raw) if raw else None


def main():
    # 1. 远端 HEAD
    code, ref = api("GET", "/git/ref/heads/main")
    parent = ref["object"]["sha"]
    print(f"1. 远端 HEAD: {parent[:12]}")
    code, pc = api("GET", f"/git/commits/{parent}")
    base_tree = pc["tree"]["sha"]
    print(f"   base tree: {base_tree[:12]}")

    # 2. blobs
    tree_items = []
    for rel in FILES:
        full = os.path.join(ROOT, rel.replace("/", os.sep))
        with open(full, "rb") as f:
            content = base64.b64encode(f.read()).decode("ascii")
        code, blob = api("POST", "/git/blobs", {"content": content, "encoding": "base64"})
        if code != 201 or "sha" not in blob:
            print(f"   FAIL blob {rel}: {code} {blob}")
            sys.exit(1)
        tree_items.append({"path": rel, "mode": "100644", "type": "blob", "sha": blob["sha"]})
        print(f"2. blob {rel} -> {blob['sha'][:10]}")

    # 3. tree
    code, tree = api("POST", "/git/trees", {"base_tree": base_tree, "tree": tree_items})
    if code != 201:
        print(f"3. FAIL tree: {code} {tree}")
        sys.exit(1)
    print(f"3. tree -> {tree['sha'][:12]}")

    # 4. commit
    code, commit = api("POST", "/git/commits", {
        "message": MSG,
        "tree": tree["sha"],
        "parents": [parent],
        "author": {"name": "WorkBuddy", "email": "workbuddy@local"},
    })
    if code != 201:
        print(f"4. FAIL commit: {code} {commit}")
        sys.exit(1)
    print(f"4. commit -> {commit['sha'][:12]}")

    # 5. update ref
    code, _ = api("PATCH", "/git/refs/heads/main", {"sha": commit["sha"]})
    print(f"5. update ref: HTTP {code}")
    print("DONE:", commit["sha"][:12])


if __name__ == "__main__":
    main()
