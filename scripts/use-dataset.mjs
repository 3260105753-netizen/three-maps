#!/usr/bin/env node
/* ============================================================
   切换数据集
     node scripts/use-dataset.mjs --list
     node scripts/use-dataset.mjs filled-example   # 换成完整演示数据集
   会先把当前 data/ 备份到 data/.backup/<时间戳>/
   ============================================================ */
import fs from "node:fs";
import path from "node:path";
import { ROOT, DATA, backup } from "./lib/io.mjs";

const C = {
  green: (s) => "\x1b[32m" + s + "\x1b[0m",
  yellow: (s) => "\x1b[33m" + s + "\x1b[0m",
  dim: (s) => "\x1b[2m" + s + "\x1b[0m",
  bold: (s) => "\x1b[1m" + s + "\x1b[0m"
};

const EX = path.join(ROOT, "examples");
const sets = fs.existsSync(EX) ? fs.readdirSync(EX).filter((d) => fs.statSync(path.join(EX, d)).isDirectory()) : [];

if (process.argv.includes("--list") || !process.argv[2]) {
  console.log(C.bold("\n可用的数据集\n"));
  sets.forEach((d) => {
    const files = fs.readdirSync(path.join(EX, d)).filter((f) => f.endsWith(".json"));
    console.log("  " + C.green(d) + C.dim("  " + files.length + " 个文件：" + files.join(", ")));
  });
  if (!sets.length) console.log(C.yellow("  examples/ 下没有数据集"));
  console.log("");
  console.log(C.dim("用法：node scripts/use-dataset.mjs <数据集名>"));
  console.log("");
  process.exit(0);
}

const name = process.argv[2];
const dir = path.join(EX, name);
if (!fs.existsSync(dir)) {
  console.error("没有找到数据集：" + name);
  console.error("先运行 node scripts/use-dataset.mjs --list 看有哪些。");
  process.exit(1);
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
const backupDir = backup(files.map((f) => f.replace(/\.json$/, "")));

files.forEach((f) => {
  const src = path.join(dir, f);
  try {
    JSON.parse(fs.readFileSync(src, "utf8").replace(/^\uFEFF/, ""));
  } catch (e) {
    console.error("✗ " + f + " 不是合法 JSON，已中止：" + e.message);
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(DATA, f));
});

console.log(C.green("✓ 已切换到数据集：" + name + "（" + files.length + " 个文件）"));
console.log(C.dim("  切换前备份：" + path.relative(ROOT, backupDir)));
console.log("");
console.log("下一步：node scripts/validate.mjs 然后刷新页面。");
