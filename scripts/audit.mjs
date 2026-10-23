import fs from "node:fs";
import path from "node:path";

const D = "data";
const rd = (p) => JSON.parse(fs.readFileSync(path.join(D, p + ".json"), "utf8"));

const cfg = rd("config");
const dom = rd("domain"), eco = rd("ecosystem"), cog = rd("cognitive");
const rel = rd("relations"), src = rd("sources"), routes = rd("routes");
const fb = rd("feedback"), tests = rd("tests"), ch = rd("changelog"), mem = rd("members");

const all = [...dom.nodes, ...eco.nodes, ...cog.nodes];
const id2 = Object.fromEntries(all.map((n) => [n.id, n]));
const srcOk = (sid) => {
  const s = src.sources.find((x) => x.id === sid);
  return s && s.url && s.verify !== "来源待补";
};

const lines = [];
const p = (s) => lines.push(s);

p("节点：" + all.length + "（领域 " + dom.nodes.length + " / 生态 " + eco.nodes.length + " / 认知 " + cog.nodes.length + "）");
p("关系：" + rel.relations.length + "，来源：" + src.sources.length + "，路线：" + routes.routes.length);
p("");

p("【来源覆盖】");
for (const [name, m] of [["领域", dom], ["生态", eco], ["认知", cog]]) {
  const ok = m.nodes.filter((n) => (n.sourceIds || []).some(srcOk)).length;
  p("  " + name + "：" + ok + "/" + m.nodes.length + " 个节点有可打开来源");
}
const noSrc = all.filter((n) => !(n.sourceIds || []).some(srcOk));
p("  完全没有可打开来源的节点：" + noSrc.length + " 个");
noSrc.slice(0, 10).forEach((n) => p("    · " + n.id + " [" + n.type + "] " + n.name + "  verify=" + n.verify));
p("");

p("【仍为示例/占位的内容】");
const seeds = all.filter((n) => n.seed);
p("  seed 节点：" + (seeds.length ? seeds.map((n) => n.id).join(", ") : "无"));
const placeholder = all.filter((n) => /改名|占位|待填/.test(n.name + (n.detail || "")));
placeholder.forEach((n) => p("  占位命名：" + n.id + " → " + n.name));
p("");

p("【课程节点】");
const courses = all.filter((n) => n.type === "课程");
courses.forEach((n) => {
  const basisOk = n.courseBasis && !/待补|待核实/.test(n.courseBasis) && n.courseBasis.length > 12;
  p("  " + n.id + "  " + n.name + "  依据" + (basisOk ? "已填" : "仍是待补") + "  verify=" + n.verify);
});
p("");

p("【孤立节点（没有任何关系）】");
const touched = new Set();
rel.relations.forEach((r) => { touched.add(r.from); touched.add(r.to); });
const iso = all.filter((n) => !touched.has(n.id));
p("  " + (iso.length ? iso.map((n) => n.id).join(", ") : "无"));
p("");

p("【跨图连线】");
const cross = rel.relations.filter((r) => r.from.split(".")[0] !== r.to.split(".")[0]);
p("  共 " + cross.length + " 条：" + cross.map((r) => r.id + "(" + r.from + "→" + r.to + ")").join(", "));
p("");

p("【理解程度分布】");
const dist = {};
all.forEach((n) => { dist[n.understanding] = (dist[n.understanding] || 0) + 1; });
p("  " + JSON.stringify(dist));
p("");

p("【核实状态】");
const vd = {};
all.forEach((n) => { vd[n.verify] = (vd[n.verify] || 0) + 1; });
p("  节点 " + JSON.stringify(vd));
const rd2 = {};
rel.relations.forEach((r) => { rd2[r.verify] = (rd2[r.verify] || 0) + 1; });
p("  关系 " + JSON.stringify(rd2));
p("");

p("【其他记录】");
p("  更新记录：" + ch.entries.length + " 条，最新 " + ch.entries.map((e) => e.date).sort().pop());
const types = {};
ch.entries.forEach((e) => { types[e.type] = (types[e.type] || 0) + 1; });
p("    类型分布：" + JSON.stringify(types));
p("  非本组反馈：" + fb.items.length + " 条" + (fb.items.length ? "" : "（课程要求至少 3 条）"));
p("  访问测试：" + tests.tests.length + " 条");
p("  成员：" + mem.members.length + " 人 — " + mem.members.map((m) => m.name).join("、"));
p("");

p("【技术路线是否可比】");
routes.routes.forEach((r) => p("  " + r.id + "  " + r.name + "  节点 " + (r.nodes || []).length + " 个，生态 " + (r.ecosystem || []).length + " 个"));

console.log(lines.join("\n"));
