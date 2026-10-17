/* ============================================================
   数据校验规则（单一事实来源）
   validate.mjs 与 import-csv.mjs 共用同一套规则，避免
   「导入时放行、校验时又报错」这种自相矛盾。
   ============================================================ */

export const REQUIRED_NODE = ["id", "name", "type", "summary", "understanding", "evidence", "verify", "owner", "updated"];
export const REQUIRED_REL = ["id", "from", "to", "type", "why", "evidence", "verify"];
export const REQUIRED_SOURCE = ["id", "title", "kind", "verify"];

export const ECO_TYPES = ["会议", "实验室", "企业", "开源社区", "数据集", "基准", "信息渠道"];
export const CASE_KEYS = ["problem", "method", "evidence", "judgment", "open"];
export const REVISION_KEYS = ["before", "trigger", "now", "unknown"];
export const CASE_LABELS = {
  problem: "具体问题",
  method: "使用方法",
  evidence: "依据与比较",
  judgment: "当前判断",
  open: "尚存疑问"
};
export const REVISION_LABELS = {
  before: "原来以为",
  trigger: "什么改变了",
  now: "现在如何理解",
  unknown: "仍不知道"
};

function isBlank(v) {
  return v == null || String(v).trim() === "";
}

export function makeVocab(config) {
  const v = (config && config.vocab) || {};
  return {
    levels: (v.understandingLevels || []).map((x) => x.value),
    evidence: v.evidenceKinds || [],
    verify: v.verifyStates || [],
    relTypes: (v.relationTypes || []).map((x) => x.value),
    courseLabels: v.courseLabels || [],
    nodeTypes: v.nodeTypes || {}
  };
}

/* 校验单个节点，返回 {errors, warnings} */
export function validateNode(node, ctx) {
  const { vocab, sourcesById, mapId } = ctx;
  const errors = [];
  const warnings = [];
  const where = `节点 ${node.id || "(无 id)"}`;

  REQUIRED_NODE.forEach((k) => {
    if (isBlank(node[k])) errors.push(`${where}：缺字段 ${k}`);
  });

  if (node.type && mapId) {
    const allowed = vocab.nodeTypes[mapId] || [];
    if (allowed.length && !allowed.includes(node.type)) {
      errors.push(`${where}：类型「${node.type}」不在 ${mapId} 地图允许的类型里（${allowed.join(" / ")}）`);
    }
  }

  if (!isBlank(node.summary) && String(node.summary).trim().length < 8) {
    errors.push(`${where}：summary 太短，必须是一句能独立读懂的话`);
  }
  if (!isBlank(node.understanding) && vocab.levels.length && !vocab.levels.includes(node.understanding)) {
    errors.push(`${where}：understanding「${node.understanding}」不在 ${vocab.levels.join(" / ")} 里`);
  }
  if (!isBlank(node.evidence) && vocab.evidence.length && !vocab.evidence.includes(node.evidence)) {
    errors.push(`${where}：evidence「${node.evidence}」必须是 ${vocab.evidence.join(" / ")} 之一`);
  }
  if (!isBlank(node.verify) && vocab.verify.length && !vocab.verify.includes(node.verify)) {
    errors.push(`${where}：verify「${node.verify}」必须是 ${vocab.verify.join(" / ")} 之一`);
  }

  const ids = node.sourceIds || [];
  if (!Array.isArray(ids)) errors.push(`${where}：sourceIds 必须是数组`);
  else ids.forEach((sid) => {
    if (!sourcesById[sid]) errors.push(`${where}：sourceIds 引用了未登记的来源 ${sid}`);
  });

  if (!ids.length) warnings.push(`${where}：没有登记任何来源`);
  else {
    const usable = ids.filter((s) => sourcesById[s] && sourcesById[s].url && sourcesById[s].verify !== "来源待补");
    if (!usable.length) warnings.push(`${where}：有来源但都不可打开（来源待补），页面上会显示黄色告警`);
  }

  if (isBlank(node.understandingNote)) warnings.push(`${where}：没写 understandingNote，同学会追问「凭什么说已经理解」`);

  if (node.type === "课程") {
    if (!node.courseLabel) errors.push(`${where}：课程节点必须有 courseLabel（${vocab.courseLabels.join(" / ")}）`);
    else if (vocab.courseLabels.length && !vocab.courseLabels.includes(node.courseLabel)) {
      errors.push(`${where}：courseLabel「${node.courseLabel}」不在 ${vocab.courseLabels.join(" / ")} 里`);
    }
    if (isBlank(node.courseAbility)) errors.push(`${where}：课程节点必须有 courseAbility（学完能解释什么）`);
    if (isBlank(node.courseBasis)) errors.push(`${where}：课程节点必须有 courseBasis（依据哪份培养方案或大纲）`);
  }

  if (ECO_TYPES.includes(node.type)) {
    if (isBlank(node.contribution)) errors.push(`${where}：${node.type} 节点必须写 contribution（主要贡献）`);
    if (isBlank(node.whyIncluded)) errors.push(`${where}：${node.type} 节点必须写 whyIncluded（入选理由）`);
    if (isBlank(node.results)) warnings.push(`${where}：没写 results（相关成果）`);
  }

  if (node.type === "案例") {
    if (!node.caseStudy) errors.push(`${where}：案例节点必须有 caseStudy 五段`);
    else CASE_KEYS.forEach((k) => {
      if (isBlank(node.caseStudy[k])) errors.push(`${where}：案例缺「${CASE_LABELS[k]}」`);
    });
  }

  if (node.type === "认识修正") {
    if (!node.revision) errors.push(`${where}：认识修正节点必须有 revision 四段`);
    else REVISION_KEYS.forEach((k) => {
      if (isBlank(node.revision[k])) errors.push(`${where}：认识修正缺「${REVISION_LABELS[k]}」`);
    });
  }

  if (node.verify === "待核实" && !(node.flags || []).length) {
    warnings.push(`${where}：标了待核实但没写 flags 说明缺什么`);
  }

  return { errors, warnings };
}

export function validateRelation(rel, ctx) {
  const { vocab, byId, sourcesById } = ctx;
  const errors = [];
  const warnings = [];
  const where = `关系 ${rel.id || "(无 id)"}（${rel.from} → ${rel.to}）`;

  REQUIRED_REL.forEach((k) => {
    if (isBlank(rel[k])) errors.push(`${where}：缺字段 ${k}`);
  });

  if (!byId[rel.from]) errors.push(`${where}：from 指向不存在的节点 ${rel.from}`);
  if (!byId[rel.to]) errors.push(`${where}：to 指向不存在的节点 ${rel.to}`);
  if (rel.from === rel.to) errors.push(`${where}：不能自己指向自己`);

  if (!isBlank(rel.type) && vocab.relTypes.length && !vocab.relTypes.includes(rel.type)) {
    errors.push(`${where}：关系类型「${rel.type}」不在 ${vocab.relTypes.join(" / ")} 里`);
  }
  if (!isBlank(rel.why) && String(rel.why).trim().length < 8) {
    errors.push(`${where}：why 太短。写「有关」等于没写，必须说清为什么成立`);
  }
  if (!isBlank(rel.evidence) && vocab.evidence.length && !vocab.evidence.includes(rel.evidence)) {
    errors.push(`${where}：evidence「${rel.evidence}」必须是 ${vocab.evidence.join(" / ")} 之一`);
  }
  if (!isBlank(rel.verify) && vocab.verify.length && !vocab.verify.includes(rel.verify)) {
    errors.push(`${where}：verify「${rel.verify}」必须是 ${vocab.verify.join(" / ")} 之一`);
  }
  if (rel.inferred && rel.evidence !== "团队推断") {
    errors.push(`${where}：标了 inferred（推断）就必须把 evidence 写成「团队推断」`);
  }
  if (rel.evidence === "团队推断" && !rel.inferred && rel.verify === "已核实") {
    warnings.push(`${where}：团队推断却标成已核实，评分时会被追问依据`);
  }
  (rel.sourceIds || []).forEach((sid) => {
    if (!sourcesById[sid]) errors.push(`${where}：sourceIds 引用了未登记的来源 ${sid}`);
  });
  if (!(rel.sourceIds || []).length) warnings.push(`${where}：没有登记来源`);

  return { errors, warnings };
}

export function validateSource(src) {
  const errors = [];
  const warnings = [];
  const where = `来源 ${src.id || "(无 id)"}`;
  REQUIRED_SOURCE.forEach((k) => {
    if (k === "verify") return;
    if (isBlank(src[k])) errors.push(`${where}：缺字段 ${k}`);
  });
  if (isBlank(src.verify)) errors.push(`${where}：缺字段 verify`);
  if (!isBlank(src.url) && !/^https?:\/\//i.test(src.url)) {
    errors.push(`${where}：url 必须以 http:// 或 https:// 开头`);
  }
  if (isBlank(src.url) && src.verify !== "来源待补") {
    warnings.push(`${where}：没有 url 却标成「${src.verify}」，应该标「来源待补」`);
  }
  if (!isBlank(src.url) && src.verify === "来源待补") {
    warnings.push(`${where}：有 url 却标成来源待补，看是否忘了改成已核实`);
  }
  return { errors, warnings };
}

/* 整体校验：data 为已解析的 JSON 集合 */
export function validateAll(data) {
  const vocab = makeVocab(data.config);
  const errors = [];
  const warnings = [];

  const sourcesById = {};
  (data.sources.sources || []).forEach((s, i) => {
    if (sourcesById[s.id]) errors.push(`sources.json[${i}]：来源编号重复 ${s.id}`);
    sourcesById[s.id] = s;
    const r = validateSource(s);
    errors.push(...r.errors);
    warnings.push(...r.warnings);
  });

  const byId = {};
  const maps = {};
  ["domain", "ecosystem", "cognitive"].forEach((key) => {
    const file = data[key];
    if (!file || !file.map) { errors.push(`${key}.json：缺少 map 元信息`); return; }
    maps[key] = file;
    if (!(file.nodes || []).length) warnings.push(`${key}.json：这张地图还没有任何节点`);
    (file.nodes || []).forEach((n, i) => {
      if (n.id && byId[n.id]) errors.push(`${key}.json[${i}]：节点 id 重复 ${n.id}`);
      byId[n.id] = n;
      const r = validateNode(n, { vocab, sourcesById, mapId: key });
      errors.push(...r.errors);
      warnings.push(...r.warnings);
      if (n.seed) warnings.push(`${key}.json：节点 ${n.id} 还是示例数据（seed）`);
    });
  });

  const seenRel = {};
  const touched = {};
  (data.relations.relations || []).forEach((rel, i) => {
    const r = validateRelation(rel, { vocab, byId, sourcesById });
    errors.push(...r.errors);
    warnings.push(...r.warnings);
    const pair = [rel.from, rel.to].sort().join("|") + "|" + rel.type;
    if (seenRel[pair]) warnings.push(`relations.json[${i}]：${rel.from} 与 ${rel.to} 之间存在重复的「${rel.type}」关系`);
    seenRel[pair] = true;
    touched[rel.from] = true; touched[rel.to] = true;
  });

  Object.keys(byId).forEach((id) => {
    if (!touched[id]) warnings.push(`节点 ${id} 没有任何关系（孤立节点）`);
  });

  (data.routes.routes || []).forEach((route, i) => {
    (route.nodes || []).forEach((id) => {
      if (!byId[id]) errors.push(`routes.json[${i}]：路线 ${route.id} 引用了不存在的节点 ${id}`);
    });
    (route.ecosystem || []).forEach((id) => {
      if (!byId[id]) errors.push(`routes.json[${i}]：路线 ${route.id} 引用了不存在的生态节点 ${id}`);
    });
    if ((route.nodes || []).length < 2) warnings.push(`routes.json[${i}]：路线 ${route.id} 节点太少，比较不出差异`);
  });

  (data.changelog.entries || []).forEach((e, i) => {
    ["date", "target", "what", "why", "basis"].forEach((k) => {
      if (isBlank(e[k])) errors.push(`changelog.json[${i}]：缺字段 ${k}（课程要求：日期、更新对象、依据、修改内容及原因）`);
    });
    if (e.date && !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) errors.push(`changelog.json[${i}]：date 必须是 YYYY-MM-DD`);
  });

  (data.feedback.items || []).forEach((f, i) => {
    if (isBlank(f.issue)) errors.push(`feedback.json[${i}]：缺 issue（同学提出了什么）`);
    if (isBlank(f.action)) warnings.push(`feedback.json[${i}]：还没有写 action（修改了什么），这条反馈等于没处理`);
    if (isBlank(f.verify)) warnings.push(`feedback.json[${i}]：还没有写 verify（我们怎样核实）`);
    if (isBlank(f.reason)) warnings.push(`feedback.json[${i}]：还没有写 reason（为什么这样处理，不采纳也要写理由）`);
  });

  return {
    errors,
    warnings,
    counts: {
      nodes: Object.keys(byId).length,
      relations: (data.relations.relations || []).length,
      sources: Object.keys(sourcesById).length,
      routes: (data.routes.routes || []).length,
      changelog: (data.changelog.entries || []).length,
      feedback: (data.feedback.items || []).length
    }
  };
}
