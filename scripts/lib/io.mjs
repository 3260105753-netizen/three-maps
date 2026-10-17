/* 读写 data/*.json，供 validate / import / use-dataset 共用 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DATA = path.join(ROOT, "data");

export const FILES = [
  "config", "sources", "domain", "ecosystem", "cognitive",
  "relations", "routes", "changelog", "feedback", "members", "tests"
];

export function readJSON(name) {
  const file = path.join(DATA, name + ".json");
  if (!fs.existsSync(file)) throw new Error("找不到 " + file);
  const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(name + ".json 不是合法 JSON：" + e.message);
  }
}

export function writeJSON(name, obj) {
  const file = path.join(DATA, name + ".json");
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n", "utf8");
  return file;
}

export function loadData() {
  const data = {};
  for (const name of FILES) data[name] = readJSON(name);
  return data;
}

export function backup(names) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = path.join(DATA, ".backup", stamp);
  fs.mkdirSync(dir, { recursive: true });
  for (const name of names) {
    const src = path.join(DATA, name + ".json");
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dir, name + ".json"));
  }
  return dir;
}
