#!/usr/bin/env node
/* ============================================================
   自检：不开浏览器也能验证核心逻辑
     node scripts/selftest.mjs
   检查：数据能校验、引擎能建图、三项 AI 能力都能出结果、布局数值有效。
   ============================================================ */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { ROOT, DATA, readJSON, loadData } from "./lib/io.mjs";
import { validateAll } from "./lib/schema.mjs";

const require = createRequire(import.meta.url);
const engine = require(path.join(ROOT, "assets", "js", "engine.js"));

let failed = 0;
function check(name, fn) {
  try {
    const detail = fn();
    console.log("  \x1b[32m✓\x1b[0m " + name + (detail ? "  \x1b[2m" + detail + "\x1b[0m" : ""));
  } catch (e) {
    failed++;
    console.log("  \x1b[31m✗\x1b[0m " + name + "\n    " + e.message);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

console.log("\n三张活地图 · 自检\n");

/* ---------- 1. 数据校验 ---------- */
console.log("数据层");
const data = loadData();
const report = validateAll(data);
check("当前 data/ 结构校验无错误", () => {
  assert(report.errors.length === 0, "有 " + report.errors.length + " 个错误：" + report.errors[0]);
  return report.counts.nodes + " 节点 / " + report.counts.relations + " 关系";
});

const exDir = path.join(ROOT, "examples", "filled-example");
if (fs.existsSync(exDir)) {
  check("示例数据集（examples/filled-example）也能通过校验", () => {
    const d = {
      config: readJSON("config"),
      sources: JSON.parse(fs.readFileSync(path.join(exDir, "sources.json"), "utf8")),
      domain: JSON.parse(fs.readFileSync(path.join(exDir, "domain.json"), "utf8")),
      ecosystem: JSON.parse(fs.readFileSync(path.join(exDir, "ecosystem.json"), "utf8")),
      cognitive: JSON.parse(fs.readFileSync(path.join(exDir, "cognitive.json"), "utf8")),
      relations: JSON.parse(fs.readFileSync(path.join(exDir, "relations.json"), "utf8")),
      routes: { routes: [] },
      changelog: { entries: [] },
      feedback: { items: [] },
      members: { members: [] },
      tests: { tests: [] }
    };
    const r = validateAll(d);
    assert(r.errors.length === 0, "示例数据有 " + r.errors.length + " 个错误：" + r.errors.slice(0, 3).join(" | "));
    return r.counts.nodes + " 节点 / " + r.counts.relations + " 关系";
  });
}

/* ---------- 2. 引擎 ---------- */
console.log("\n引擎层");
const index = engine.buildIndex({
  config: data.config,
  sources: data.sources,
  maps: [data.domain, data.ecosystem, data.cognitive],
  relations: data.relations,
  routes: data.routes
});

check("建图", () => {
  assert(index.nodes.length > 0, "没有节点");
  assert(index.relations.length > 0, "没有关系");
  return index.nodes.length + " 节点，" + index.relations.length + " 条边";
});

check("检索：按名称命中", () => {
  const hits = engine.search(index, index.nodes[0].name);
  assert(hits.length > 0, "没搜到 " + index.nodes[0].name);
  return hits[0].name;
});

check("检索：查不到时不返回假结果", () => {
  const hits = engine.search(index, "这个词在地图里肯定不存在_x9");
  assert(hits.length === 0, "居然返回了 " + hits.length + " 条结果");
  return "0 条";
});

check("AI-1 概念查课程", () => {
  const target = index.nodes.find((n) => (index.adj[n.id] || []).length >= 2) || index.nodes[0];
  const r = engine.queryCourses(index, target.name);
  assert(r.found, "没有命中");
  assert(r.citations.nodes.length > 0, "回答没有引用节点");
  return "命中 " + r.node.name + "，引用 " + r.citations.nodes.length + " 个节点、" + r.citations.sources.length + " 条来源";
});

check("AI-2 关系解释（能找到一条真实路径）", () => {
  let r = null, pair = null;
  for (const n of index.nodes) {
    const ns = engine.neighbors(index, n.id);
    if (ns.length) { pair = { a: n.id, b: ns[0].node.id }; break; }
  }
  assert(pair, "没有任何连通的节点对");
  r = engine.explainRelation(index, pair.a, pair.b);
  assert(r.found, "两个相连的节点却报告不连通");
  assert(r.path && r.path.edges.length >= 1, "路径为空");
  return r.path.hops + " 跳，" + r.path.edges.length + " 条关系";
});

check("AI-2 关系解释（没连通时诚实说没有）", () => {
  const lonely = engine.buildIndex({
    config: data.config,
    sources: data.sources,
    maps: [{
      map: { id: "domain", name: "测试" },
      nodes: [
        { id: "x1", name: "甲", type: "概念", summary: "一句话说明甲是什么。", understanding: "已初步理解", verify: "已核实", sourceIds: [] },
        { id: "x2", name: "乙", type: "概念", summary: "一句话说明乙是什么。", understanding: "已初步理解", verify: "已核实", sourceIds: [] }
      ]
    }],
    relations: { relations: [] },
    routes: { routes: [] }
  });
  const r = engine.explainRelation(lonely, "x1", "x2");
  assert(!r.found && r.reason === "disconnected", "两个孤立节点之间应该报告不连通");
  return "正确返回 disconnected，没有编造中间节点";
});

check("AI-3 路线比较", () => {
  if (index.routes.length < 2) return "跳过：路线少于 2 条";
  const r = engine.compareRoutes(index, index.routes[0].id, index.routes[1].id);
  assert(r.found, "比较失败");
  assert(r.citations.nodes.length > 0, "没有引用节点");
  return "共有 " + r.shared.length + " 个，仅 A " + r.onlyA.length + " 个，仅 B " + r.onlyB.length + " 个";
});

check("引用块：节点 / 来源 / 理解程度三样齐全", () => {
  const c = engine.citations(index, index.nodes.map((n) => n.id));
  assert(c.nodes.length === index.nodes.length, "节点数对不上");
  assert(c.understanding != null, "缺理解程度统计");
  return c.nodes.length + " 节点，" + c.sources.length + " 可打开来源，" + c.gapSources.length + " 条待补";
});

check("关系图布局：坐标有效且落在画布内", () => {
  const edges = index.relations.map((r) => ({ from: r.from, to: r.to }));
  const layout = engine.computeLayout(index.nodes, edges, { width: 780, height: 540 });
  for (const n of index.nodes) {
    const p = layout.positions[n.id];
    assert(p && Number.isFinite(p.x) && Number.isFinite(p.y), "坐标无效：" + n.id);
    assert(p.x >= -1 && p.x <= 781 && p.y >= -1 && p.y <= 541, "坐标越界：" + n.id + " " + p.x + "," + p.y);
  }
  return "全部 " + index.nodes.length + " 个节点在画布内";
});

/* ---------- 3. 文件完整性 ---------- */
console.log("\n静态资源");
const must = [
  "index.html", "domain.html", "ecosystem.html", "cognitive.html",
  "ai.html", "changelog.html", "about.html", "404.html",
  "assets/css/site.css",
  "assets/js/engine.js", "assets/js/core.js", "assets/js/chrome.js", "assets/js/map.js",
  "assets/js/ai-page.js", "assets/js/home.js", "assets/js/changelog.js", "assets/js/about.js",
  ".nojekyll", "netlify.toml", "vercel.json", ".github/workflows/pages.yml"
];
check("页面与资源文件齐全", () => {
  const missing = must.filter((f) => !fs.existsSync(path.join(ROOT, f)));
  assert(missing.length === 0, "缺：" + missing.join(", "));
  return must.length + " 个文件";
});

check("七个页面都正确引用了脚本与样式", () => {
  const pages = ["index.html", "domain.html", "ecosystem.html", "cognitive.html", "ai.html", "changelog.html", "about.html"];
  pages.forEach((p) => {
    const html = fs.readFileSync(path.join(ROOT, p), "utf8");
    assert(html.includes("assets/css/site.css"), p + " 没引用样式");
    assert(html.includes("assets/js/engine.js"), p + " 没引用引擎");
    assert(html.includes("assets/js/core.js"), p + " 没引用核心层");
    assert(html.includes("assets/js/chrome.js"), p + " 没引用外壳");
    assert(/MS\.boot\(\{ page: "([a-z]+)" \}\)/.test(html), p + " 没有启动脚本");
    const pageId = /MS\.boot\(\{ page: "([a-z]+)" \}\)/.exec(html)[1];
    assert(html.includes('data-page="' + pageId + '"'), p + " 的 data-page 与 boot 不一致");
  });
  return pages.length + " 个页面";
});

console.log("");
if (failed) {
  console.log("\x1b[31m" + failed + " 项未通过\x1b[0m\n");
  process.exit(1);
}
console.log("\x1b[32m全部自检通过\x1b[0m\n");
