/* ============================================================
   Carrycore 留言板 Worker（Cloudflare Workers + KV）
   - KV 命名空间绑定变量名：GUESTBOOK（绑定步骤见操作说明）
   - GET  /  → 返回最新留言列表（最多 100 条，新在前）
   - POST /  → 新增留言（昵称非空≤30字，内容≤500字，自动记时间戳）
   - 只保留最新 100 条，超出的自动清除（不留档）
   用法：在 Cloudflare Workers 代码编辑器里整段粘贴 → 部署
   ============================================================ */
export default {
  async fetch(request, env) {
    const KV = env.GUESTBOOK;
    const url = new URL(request.url);

    // CORS 预检
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors() });
    }

    // GET：读留言列表
    if (request.method === "GET") {
      const raw = await KV.get("messages", "json");
      const list = Array.isArray(raw) ? raw : [];
      return new Response(JSON.stringify(list), {
        headers: { ...cors(), "Content-Type": "application/json; charset=utf-8" }
      });
    }

    // POST：写留言
    if (request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return err("请求格式错误", 400);
      }
      const name = String(body.name || "").trim().slice(0, 10);
      const text = String(body.text || "").trim().slice(0, 200);
      if (!name) return err("昵称不能为空", 400);
      if (!text) return err("留言内容不能为空", 400);

      const raw = await KV.get("messages", "json");
      let list = Array.isArray(raw) ? raw : [];
      list.unshift({
        name: name,
        ts: Date.now(),
        text: text
      });
      // 只保留最新 100 条，超出的直接清除
      if (list.length > 100) list = list.slice(0, 100);
      await KV.put("messages", JSON.stringify(list));
      return new Response(JSON.stringify({ ok: true, count: list.length }), {
        headers: { ...cors(), "Content-Type": "application/json; charset=utf-8" }
      });
    }

    return err("Not Found", 404);
  }
};

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function err(msg, code) {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status: code,
    headers: { ...cors(), "Content-Type": "application/json; charset=utf-8" }
  });
}
