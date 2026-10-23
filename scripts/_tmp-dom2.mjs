import fs from "node:fs";
import path from "node:path";
import { parseCSV, toCSV } from "./lib/csv.mjs";

const wx = process.argv[2];
const outDir = path.join("inbox", "converted");
fs.mkdirSync(outDir, { recursive: true });

function decode(file) {
  const buf = fs.readFileSync(path.join(wx, file));
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(buf), enc: "UTF-8" };
  } catch {
    return { text: new TextDecoder("gb18030").decode(buf), enc: "GBK" };
  }
}

const files = [
  ["初稿-节点表(1).csv", "dom2-nodes.csv"],
  ["初稿-关系表(1).csv", "dom2-relations.csv"],
  ["初稿-来源表(1).csv", "dom2-sources.csv"]
];
const parsedAll = {};
for (const [src, dst] of files) {
  const { text, enc } = decode(src);
  const p = parseCSV(text);
  parsedAll[src] = p;
  fs.writeFileSync(path.join(outDir, dst), toCSV(p.header, p.records), "utf8");
  console.log(src.padEnd(22) + enc.padEnd(7) + p.records.length + " 行 / " + p.header.length + " 列");
}
console.log("");

const nodes = parsedAll["初稿-节点表(1).csv"].records;
const rels = parsedAll["初稿-关系表(1).csv"].records;
const srcs = parsedAll["初稿-来源表(1).csv"].records;

const curDom = JSON.parse(fs.readFileSync("data/domain.json", "utf8")).nodes;
const curById = new Map(curDom.map((n) => [n.id, n]));
const newIds = new Set(nodes.map((n) => n.id));

console.log("节点：新 " + nodes.length + " / 现有 " + curDom.length);
console.log("  ids 相同的: " + nodes.filter((n) => curById.has(n.id)).map((n) => n.id).join(", "));
console.log("  新增的: " + (nodes.filter((n) => !curById.has(n.id)).map((n) => n.id).join(", ") || "无"));
console.log("  这份表里没有的（会被删）: " + (curDom.filter((n) => !newIds.has(n.id)).map((n) => n.id).join(", ") || "无"));
console.log("");

console.log("=== 节点字段变化 ===");
nodes.forEach((n) => {
  const o = curById.get(n.id);
  if (!o) return;
  const d = [];
  ["name", "type", "understanding", "verify", "evidence"].forEach((k) => {
    if ((n[k] || "") !== (o[k] || "")) d.push(k + ": " + (o[k] || "空") + " → " + (n[k] || "空"));
  });
  const ns = (n.sourceIds || "").split(/[;；|]/).map((x) => x.trim()).filter(Boolean).sort().join(",");
  const os = (o.sourceIds || []).slice().sort().join(",");
  if (ns !== os) d.push("来源: [" + os + "] → [" + ns + "]");
  if ((n.summary || "") !== (o.summary || "")) d.push("summary 改了");
  if (d.length) console.log("  " + n.id.padEnd(20) + d.join("；"));
});
console.log("");

console.log("=== 关系 ===");
const curRel = JSON.parse(fs.readFileSync("data/relations.json", "utf8")).relations;
const curRelById = new Map(curRel.map((r) => [r.id, r]));
console.log("  新表 " + rels.length + " 条");
const addR = rels.filter((r) => !curRelById.has(r.id));
const delR = curRel.filter((r) => !["domain"].includes("x") && rels.every((x) => x.id !== r.id));
console.log("  新增: " + (addR.map((r) => r.id + "(" + r.from + "→" + r.to + ")").join(", ") || "无"));
addR.forEach((r) => console.log("      " + r.id + "  " + r.type + "  " + r.label + "  | " + r.why.slice(0, 40)));
console.log("  现有但这份表没有的: " + (delR.map((r) => r.id).join(", ") || "无"));
console.log("");

console.log("=== 来源 ===");
const curSrc = JSON.parse(fs.readFileSync("data/sources.json", "utf8")).sources;
const curSrcById = new Map(curSrc.map((s) => [s.id, s]));
console.log("  新表 " + srcs.length + " 条");
srcs.forEach((s) => {
  const o = curSrcById.get(s.id);
  const flag = !o ? "新增" : (o.url !== s.url || o.verify !== s.verify ? "变更" : "");
  if (flag) console.log("  " + flag + "  " + s.id + "  [" + s.verify + "]  " + (s.url || "(无链接)"));
});
