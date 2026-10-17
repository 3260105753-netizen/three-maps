#!/usr/bin/env node
/* ============================================================
   零依赖本地预览服务器
     node scripts/serve.mjs            → http://localhost:4173
     node scripts/serve.mjs 8080       → 自定义端口
   为什么需要它：直接双击 HTML 时浏览器不允许读取本地 JSON。
   ============================================================ */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.argv[2] || process.env.PORT || 4173);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2"
};

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400).end("Bad Request");
    return;
  }
  if (urlPath.endsWith("/")) urlPath += "index.html";

  const filePath = path.join(ROOT, path.normalize(urlPath).replace(/^([/\\])+/, ""));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      const notFound = path.join(ROOT, "404.html");
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      if (fs.existsSync(notFound)) res.end(fs.readFileSync(notFound));
      else res.end("<h1>404</h1><p>没有这个文件：" + path.basename(urlPath) + "</p>");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "content-type": MIME[ext] || "application/octet-stream",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log("");
  console.log("  三张活地图 · 本地预览");
  console.log("  →  http://localhost:" + PORT);
  console.log("");
  console.log("  按 Ctrl+C 停止");
  console.log("");
});

// 端口被占用时给出人话提示
server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error("端口 " + PORT + " 已被占用。换一个：node scripts/serve.mjs " + (PORT + 1));
    process.exit(1);
  }
  throw e;
});
