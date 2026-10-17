#!/usr/bin/env node
/* ============================================================
   数据校验：node scripts/validate.mjs
   退出码 1 = 有错误（会让页面/导入出问题），0 = 只有警告或全通过
   ============================================================ */
import { loadData } from "./lib/io.mjs";
import { validateAll } from "./lib/schema.mjs";

const C = {
  red: (s) => "\x1b[31m" + s + "\x1b[0m",
  yellow: (s) => "\x1b[33m" + s + "\x1b[0m",
  green: (s) => "\x1b[32m" + s + "\x1b[0m",
  dim: (s) => "\x1b[2m" + s + "\x1b[0m",
  bold: (s) => "\x1b[1m" + s + "\x1b[0m"
};

let data;
try {
  data = loadData();
} catch (e) {
  console.error(C.red("✗ 读取失败：" + e.message));
  process.exit(1);
}

const { errors, warnings, counts } = validateAll(data);

console.log(C.bold("\n三张活地图 · 数据校验\n"));
console.log(
  "  " + [
    counts.nodes + " 个节点",
    counts.relations + " 条关系",
    counts.sources + " 条来源",
    counts.routes + " 条路线",
    counts.changelog + " 条更新",
    counts.feedback + " 条反馈"
  ].join(" · ")
);
console.log("");

if (warnings.length) {
  console.log(C.yellow("⚠ 警告 " + warnings.length + " 条") + C.dim("（不阻塞，但互评时可能被追问）"));
  warnings.slice(0, 40).forEach((w) => console.log("  " + C.yellow("·") + " " + w));
  if (warnings.length > 40) console.log(C.dim("  …还有 " + (warnings.length - 40) + " 条"));
  console.log("");
}

if (errors.length) {
  console.log(C.red("✗ 错误 " + errors.length + " 条") + C.dim("（必须修复）"));
  errors.forEach((e) => console.log("  " + C.red("✗") + " " + e));
  console.log("");
  console.log(C.red("校验未通过。修完再跑一次。"));
  process.exit(1);
}

console.log(C.green("✓ 结构与字段校验通过") + C.dim("（没有发现会让页面出错的问题）"));
console.log("");
