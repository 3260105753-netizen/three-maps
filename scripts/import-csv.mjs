#!/usr/bin/env node
/* ============================================================
   把 CSV 导入 data/*.json
   用法：
     node scripts/import-csv.mjs                       # 读 inbox/ 下的三个表
     node scripts/import-csv.mjs --nodes a.csv --relations b.csv --sources c.csv
     node scripts/import-csv.mjs --dry                 # 只校验，不写盘
   任何一条记录不合格，整批都不会写入。
   ============================================================ */
import fs from "node:fs";
import path from "node:path";
import { parseCSV, splitList } from "./lib/csv.mjs";
import { loadData, writeJSON, backup, ROOT } from "./lib/io.mjs";
import { validateAll } from "./lib/schema.mjs";

const C = {
  red: (s) => "\x1b[31m" + s + "\x1b[0m",
  yellow: (s) => "\x1b[33m" + s + "\x1b[0m",
  green: (s) => "\x1b[32m" + s + "\x1b[0m",
  dim: (s) => "\x1b[2m" + s + "\x1b[0m",
  bold: (s) => "\x1b[1m" + s + "\x1b[0m"
};

/* ---------- 参数 ---------- */
const args = process.argv.slice(2);
function arg(name) {
  const i = args.indexOf("--" + name);
  return i >= 0 ? args[i + 1] : null;
}
const dry = args.includes("--dry");
const nodeFile = arg("nodes") || path.join(ROOT, "inbox", "节点表.csv");
const relFile = arg("relations") || path.join(ROOT, "inbox", "关系表.csv");
const srcFile = arg("sources") || path.join(ROOT, "inbox", "来源表.csv");

/* ---------- 字段映射 ---------- */
const NODE_FIELDS = ["id", "map", "name", "type", "summary", "detail", "understanding", "understandingNote",
  "evidence", "verify", "owner", "updated", "courseLabel", "courseAbility", "courseBasis",
  "contribution", "whyIncluded", "results"];
const NODE_LIST = ["sourceIds", "tags", "flags"];
const NODE_JSON = ["caseStudy", "revision"];

const REL_FIELDS = ["id", "from", "to", "type", "label", "why", "evidence", "verify"];
const REL_LIST = ["sourceIds"];

const SRC_FIELDS = ["id", "title", "url", "publisher", "date", "kind", "verify", "note"];

function readTable(file, label) {
  if (!fs.existsSync(file)) {
    console.log(C.dim("跳过 " + label + "：没有找到 " + path.relative(ROOT, file)));
    return null;
  }
  const { header, records } = parseCSV(fs.readFileSync(file, "utf8"));
  console.log("读取 " + label + "：" + records.length + " 行（" + path.relative(ROOT, file) + "）");
  return { header, records };
}

const problems = [];

function toNode(row) {
  const node = {};
  NODE_FIELDS.forEach((k) => {
    if (k === "map") return;
    if (row[k] != null && String(row[k]).trim() !== "") node[k] = String(row[k]).trim();
  });
  NODE_LIST.forEach((k) => {
    const list = splitList(row[k]);
    if (list.length) node[k] = list;
  });
  NODE_JSON.forEach((k) => {
    const raw = (row[k] || "").trim();
    if (!raw) return;
    try {
      node[k] = JSON.parse(raw);
    } catch (e) {
      problems.push(`节点表第 ${row.__row} 行：${k} 不是合法 JSON（${e.message}）`);
    }
  });
  return node;
}

function toRelation(row) {
  const rel = {};
  REL_FIELDS.forEach((k) => {
    if (row[k] != null && String(row[k]).trim() !== "") rel[k] = String(row[k]).trim();
  });
  REL_LIST.forEach((k) => {
    const list = splitList(row[k]);
    if (list.length) rel[k] = list;
  });
  const flag = String(row.inferred || "").trim().toLowerCase();
  rel.inferred = ["是", "true", "1", "y", "yes", "推断"].includes(flag);
  return rel;
}

function toSource(row) {
  const src = {};
  SRC_FIELDS.forEach((k) => {
    if (row[k] != null && String(row[k]).trim() !== "") src[k] = String(row[k]).trim();
  });
  return src;
}

/* ---------- 合并 ---------- */
const data = loadData();
const report = { nodesAdded: 0, nodesUpdated: 0, relAdded: 0, relUpdated: 0, srcAdded: 0, srcUpdated: 0 };

const nodeTable = readTable(nodeFile, "节点表");
if (nodeTable) {
  nodeTable.records.forEach((row) => {
    const mapKey = (row.map || "").trim();
    if (!["domain", "ecosystem", "cognitive"].includes(mapKey)) {
      problems.push(`节点表第 ${row.__row} 行：map 必须是 domain / ecosystem / cognitive，当前是「${mapKey}」`);
      return;
    }
    if (!data[mapKey]) { problems.push(`节点表第 ${row.__row} 行：data/${mapKey}.json 不存在`); return; }
    const node = toNode(row);
    if (!node.id) { problems.push(`节点表第 ${row.__row} 行：缺 id`); return; }
    const list = data[mapKey].nodes || (data[mapKey].nodes = []);
    const idx = list.findIndex((n) => n.id === node.id);
    // 同一 id 不能出现在另一张地图里
    ["domain", "ecosystem", "cognitive"].filter((k) => k !== mapKey).forEach((k) => {
      if ((data[k].nodes || []).some((n) => n.id === node.id)) {
        problems.push(`节点表第 ${row.__row} 行：id「${node.id}」已经存在于 ${k} 地图，不能跨图复用`);
      }
    });
    if (idx >= 0) { list[idx] = { ...list[idx], ...node }; report.nodesUpdated++; }
    else { list.push(node); report.nodesAdded++; }
  });
}

const relTable = readTable(relFile, "关系表");
if (relTable) {
  relTable.records.forEach((row) => {
    const rel = toRelation(row);
    if (!rel.id) { problems.push(`关系表第 ${row.__row} 行：缺 id`); return; }
    const list = data.relations.relations || (data.relations.relations = []);
    const idx = list.findIndex((r) => r.id === rel.id);
    if (idx >= 0) { list[idx] = { ...list[idx], ...rel }; report.relUpdated++; }
    else { list.push(rel); report.relAdded++; }
  });
}

const srcTable = readTable(srcFile, "来源表");
if (srcTable) {
  srcTable.records.forEach((row) => {
    const src = toSource(row);
    if (!src.id) { problems.push(`来源表第 ${row.__row} 行：缺 id`); return; }
    const list = data.sources.sources || (data.sources.sources = []);
    const idx = list.findIndex((s) => s.id === src.id);
    if (idx >= 0) { list[idx] = { ...list[idx], ...src }; report.srcUpdated++; }
    else { list.push(src); report.srcAdded++; }
  });
}

/* ---------- 校验 ---------- */
const { errors, warnings } = validateAll(data);
const allErrors = problems.concat(errors);

console.log("");
console.log(C.bold("导入结果"));
console.log("  节点：新增 " + report.nodesAdded + " / 更新 " + report.nodesUpdated);
console.log("  关系：新增 " + report.relAdded + " / 更新 " + report.relUpdated);
console.log("  来源：新增 " + report.srcAdded + " / 更新 " + report.srcUpdated);
console.log("");

if (warnings.length) {
  console.log(C.yellow("⚠ 警告 " + warnings.length + " 条（不阻塞导入）"));
  warnings.slice(0, 12).forEach((w) => console.log("  · " + w));
  if (warnings.length > 12) console.log(C.dim("  …还有 " + (warnings.length - 12) + " 条，运行 node scripts/validate.mjs 看全部"));
  console.log("");
}

if (allErrors.length) {
  console.log(C.red("✗ 有 " + allErrors.length + " 个问题，本次没有写入任何文件"));
  allErrors.forEach((e) => console.log("  ✗ " + e));
  console.log("");
  console.log(C.dim("修好 CSV 再跑一次。数据文件保持原样。"));
  process.exit(1);
}

if (dry) {
  console.log(C.green("✓ 校验通过（--dry，未写入）"));
  process.exit(0);
}

const changed = ["domain", "ecosystem", "cognitive", "relations", "sources"];
const dir = backup(changed);
changed.forEach((k) => writeJSON(k, data[k]));

console.log(C.green("✓ 已写入 data/（导入前备份在 " + path.relative(ROOT, dir) + "）"));
console.log(C.dim("下一步：刷新页面确认，然后在 data/changelog.json 补一条「日期 / 改了什么 / 依据 / 为什么」。"));

if (nodeTable && nodeTable.records.length && !data.config.demoContent) {
  console.log("");
  console.log(C.yellow("提示：data/config.json 里 demoContent 已是 false，说明正式内容已上线。"));
}
