/* ============================================================
   核心层：数据加载、渲染组件、页面启动
   ============================================================ */
(function (MS) {
  "use strict";

  var E = MS.engine;

  /* ---------- 基础工具 ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function h(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  function on(root, evt, sel, fn) {
    root.addEventListener(evt, function (e) {
      var t = e.target.closest(sel);
      if (t && root.contains(t)) fn(e, t);
    });
  }
  function toast(msg) {
    var el = qs(".toast");
    if (!el) { el = h('<div class="toast" role="status" aria-live="polite"></div>'); document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove("show"); }, 2600);
  }
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    }
  }

  /* ---------- 类型配色 ---------- */
  var TONES = {
    "典型任务": "#60a5fa", "问题": "#fb7185", "概念": "#5eead4", "方法": "#34d399",
    "技术路线": "#a78bfa", "模型": "#f472b6", "软件": "#38bdf8", "数据与资源": "#fbbf24",
    "课程": "#fcd34d", "会议": "#c084fc", "实验室": "#818cf8", "企业": "#fb923c",
    "开源社区": "#4ade80", "数据集": "#facc15", "基准": "#22d3ee", "信息渠道": "#94a3b8",
    "认识方法（观）": "#fbbf24", "分析方法": "#f59e0b", "习惯": "#a3e635",
    "案例": "#f472b6", "认识修正": "#fb7185"
  };
  function typeTone(type) {
    if (TONES[type]) return TONES[type];
    var hash = 0;
    for (var i = 0; i < String(type).length; i++) hash = (hash * 31 + String(type).charCodeAt(i)) % 360;
    return "hsl(" + hash + " 62% 62%)";
  }
  var UNDER_TONE = { "已初步理解": "ok", "已经尝试": "info", "待深入学习": "warn" };
  var VERIFY_TONE = { "已核实": "ok", "待核实": "warn", "来源待补": "bad" };

  function badge(text, tone, cls) {
    return '<span class="badge ' + (tone ? "tone-" + tone : "plain") + (cls ? " " + cls : "") + '">' + esc(text) + "</span>";
  }
  function typeBadge(type) {
    return '<span class="badge" style="--tone:' + typeTone(type) + '">' + esc(type) + "</span>";
  }
  function underBadge(node) {
    var tone = UNDER_TONE[node.understanding] || "plain";
    return badge(node.understanding || "未标注", tone);
  }
  function verifyBadge(v) { return badge(v || "未标注", VERIFY_TONE[v] || "plain"); }
  function flagBadges(node) {
    return (node.flags || []).map(function (f) {
      return '<span class="flag">⚑ ' + esc(f) + "</span>";
    }).join(" ");
  }
  function mapName(state, id) {
    var m = state.maps[id];
    return m ? m.meta.name : id;
  }

  /* ---------- 来源渲染 ---------- */
  function sourceItems(state, ids) {
    var out = [], gaps = [];
    E.uniq(ids || []).forEach(function (sid) {
      var s = state.sourcesById[sid];
      if (!s) { gaps.push({ id: sid, title: "数据里引用了未登记的来源编号：" + sid, url: "", verify: "来源待补" }); return; }
      if (!s.url || s.verify === "来源待补") { gaps.push(s); return; }
      out.push(s);
    });
    return { ok: out, gaps: gaps };
  }

  function renderSources(state, ids, opts) {
    opts = opts || {};
    var r = sourceItems(state, ids);
    var html = "";
    if (r.ok.length) {
      html += '<ul class="src-list">' + r.ok.map(function (s) {
        return '<li class="src"><div class="src-main">' +
          '<a class="src-title" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.title) + "</a>" +
          '<div class="src-meta">' + esc([s.publisher, s.date, s.kind].filter(Boolean).join(" · ")) + " " + verifyBadge(s.verify) + "</div>" +
          (s.note ? '<div class="src-meta">' + esc(s.note) + "</div>" : "") +
          "</div></li>";
      }).join("") + "</ul>";
    }
    if (r.gaps.length) {
      html += '<ul class="src-list" style="margin-top:8px">' + r.gaps.map(function (s) {
        return '<li class="src kind-gap"><div class="src-main">' +
          '<span class="src-title">' + esc(s.title) + "</span>" +
          '<div class="src-meta">' + verifyBadge("来源待补") + " " + esc(s.note || "需要补一个可打开的链接，或说明为什么暂时没有。") + "</div>" +
          "</div></li>";
      }).join("") + "</ul>";
    }
    if (!html) {
      html = '<div class="empty" style="padding:16px"><p>这个节点还没有登记来源。按规范，重要内容必须有可追溯的依据；没有就先标“来源待补”。</p></div>';
    }
    return html;
  }

  /* ---------- 关系渲染 ---------- */
  function relCard(state, entry, perspectiveId) {
    var rel = entry.rel, other = entry.node;
    var outgoing = rel.from === perspectiveId;
    var arrow = outgoing
      ? '<span class="rel-arrow">→</span> <span class="rel-dir">' + esc(rel.label || rel.type) + "</span>"
      : '<span class="rel-arrow">←</span> <span class="rel-dir">' + esc(rel.label || rel.type) + "</span>";
    return '<li class="rel">' +
      '<div class="rel-top">' +
        typeBadge(other.type) +
        '<a class="rel-target" href="' + esc(other._map) + '.html#node=' + esc(other.id) + '" data-node="' + esc(other.id) + '" data-map="' + esc(other._map) + '">' + esc(other.name) + "</a>" +
        arrow +
        '<span class="badge plain">' + esc(rel.type) + "</span>" +
        (rel.inferred ? '<span class="flag">推断</span>' : "") +
      "</div>" +
      '<p class="rel-why">' + esc(rel.why) + "</p>" +
      '<div class="rel-foot">' +
        underBadge(other) + verifyBadge(rel.verify) +
        '<span class="tiny muted">' + esc(rel.evidence || "") + " · " + esc(rel.id) + "</span>" +
        ((rel.sourceIds || []).length ? '<span class="tiny muted">来源 ' + rel.sourceIds.length + " 条</span>" : '<span class="tiny muted">无来源</span>') +
      "</div>" +
      (rel.sourceIds && rel.sourceIds.length ? '<div style="margin-top:8px">' + renderSources(state, rel.sourceIds) + "</div>" : "") +
    "</li>";
  }

  function renderRelations(state, node) {
    var adj = (state.index && MS.engine.neighbors(state.index, node.id)) || [];
    if (!adj.length) {
      return '<div class="empty" style="padding:16px"><p>这个节点还没有连线。孤立节点在“活地图”里没有意义，请补一条“它和谁有关、为什么”。</p></div>';
    }
    var out = adj.filter(function (e) { return e.dir === "out"; });
    var inc = adj.filter(function (e) { return e.dir === "in"; });
    var html = "";
    if (out.length) html += '<ul class="rel-list">' + out.map(function (e) { return relCard(state, e, node.id); }).join("") + "</ul>";
    if (inc.length) {
      html += '<h4 style="margin-top:16px">被指向</h4><ul class="rel-list">' +
        inc.map(function (e) { return relCard(state, e, node.id); }).join("") + "</ul>";
    }
    return html;
  }

  /* ---------- 节点卡（全站唯一模板） ---------- */
  function renderNodeCard(state, node) {
    var parts = [];
    parts.push('<div class="node-card card">');
    parts.push('<div class="node-card-head"><div>');
    parts.push("<h2>" + esc(node.name) + "</h2>");
    parts.push('<div class="node-meta">' + typeBadge(node.type) + underBadge(node) + verifyBadge(node.verify) +
      (badge(node.evidence, "violet") ) + flagBadges(node) + "</div>");
    parts.push('<div class="node-id">' + esc(node.id) + " · " + esc(node._mapName) + " · 更新 " + esc(node.updated || "—") + " · 负责人 " + esc(node.owner || "—") + "</div>");
    parts.push("</div></div>");

    parts.push('<p class="node-summary">' + esc(node.summary) + "</p>");
    if (node.detail) parts.push('<p class="node-detail">' + esc(node.detail) + "</p>");

    // 理解程度
    parts.push('<div class="block"><h4>理解程度</h4><div class="under-row">' + underBadge(node) +
      '<span class="small muted">' + esc(node.understandingNote || "没有写为什么是这个程度——这本身是个可追问的点。") + "</span></div></div>");

    // 类型专属字段
    if (node.type === "课程") {
      parts.push('<div class="block"><h4>课程关联</h4><dl class="kv">' +
        "<dt>标签</dt><dd>" + esc(node.courseLabel || "未标") + "</dd>" +
        "<dt>对应能力</dt><dd>" + esc(node.courseAbility || "未填") + "</dd>" +
        "<dt>依据</dt><dd>" + esc(node.courseBasis || "未填：课程关联必须有培养方案或大纲依据") + "</dd>" +
        "</dl></div>");
    }
    if (node.contribution || node.whyIncluded || node.results) {
      parts.push('<div class="block"><h4>生态角色</h4><dl class="kv">' +
        "<dt>主要贡献</dt><dd>" + esc(node.contribution || "未填") + "</dd>" +
        "<dt>入选理由</dt><dd>" + esc(node.whyIncluded || "未填：不能只凭知名度") + "</dd>" +
        "<dt>相关成果</dt><dd>" + esc(node.results || "未填") + "</dd>" +
        "</dl></div>");
    }
    if (node.caseStudy) {
      var cs = node.caseStudy;
      parts.push('<div class="block"><h4>分析案例 · 五段式</h4><div class="flow">' +
        step("具体问题", cs.problem) + step("使用方法", cs.method) +
        step("依据与比较", cs.evidence) + step("当前判断", cs.judgment) +
        step("尚存疑问", cs.open) + "</div></div>");
    }
    if (node.revision) {
      var rv = node.revision;
      parts.push('<div class="block"><h4>认识修正 · 四段式</h4><div class="flow">' +
        step("原来以为", rv.before) + step("什么改变了", rv.trigger) +
        step("现在如何理解", rv.now) + step("仍不知道", rv.unknown) + "</div></div>");
    }
    if ((node.tags || []).length) {
      parts.push('<div class="block"><h4>标签</h4><div class="chip-row">' +
        node.tags.map(function (t) { return '<span class="chip">' + esc(t) + "</span>"; }).join("") + "</div></div>");
    }

    parts.push('<div class="block"><h4>关系</h4>' + renderRelations(state, node) + "</div>");
    parts.push('<div class="block"><h4>来源</h4>' + renderSources(state, node._sourceIds) + "</div>");

    if (node.seed) {
      parts.push('<div class="block"><h4>这是一条示例数据</h4><p class="small muted">它只用来验证渲染与跳转。替换方式见 <a href="data/README.md">data/README.md</a> 与 <a href="docs/01-节点字段契约.md">字段契约</a>。</p></div>');
    }
    parts.push("</div>");
    return parts.join("");
  }
  function step(label, text) {
    return '<div class="flow-step"><b>' + esc(label) + "</b><p>" + esc(text || "未填") + "</p></div>";
  }

  /* ---------- 空状态 ---------- */
  function emptyState(opts) {
    opts = opts || {};
    return '<div class="empty"><span class="e-icon">' + (opts.icon || "◇") + "</span>" +
      "<h4>" + esc(opts.title || "还没有内容") + "</h4>" +
      "<p>" + esc(opts.desc || "") + "</p>" +
      (opts.actions ? '<div class="e-actions">' + opts.actions + "</div>" : "") + "</div>";
  }

  /* ---------- 数据加载 ---------- */
  var FILES = ["sources", "domain", "ecosystem", "cognitive", "relations", "routes", "changelog", "feedback", "members", "tests"];

  function getJSON(path) {
    return fetch(path, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(path + " → HTTP " + r.status);
      return r.json();
    });
  }

  function fatal(err) {
    var root = qs("#page-root") || document.body;
    root.innerHTML =
      '<div class="wrap" style="padding:40px 0"><div class="fatal">' +
      "<h3>数据没有加载出来</h3>" +
      "<p>页面结构和样式已经就绪，但 <code>data/*.json</code> 没读到。最常见的原因是<strong>直接双击打开了 HTML 文件</strong>：浏览器出于安全策略不允许 <code>file://</code> 页面读取本地 JSON。</p>" +
      "<p>请用本地服务器打开（二选一）：</p>" +
      '<pre>node scripts/serve.mjs 4173\n# 然后打开 http://localhost:4173</pre>' +
      "<p>线上部署后不会有这个问题，因为是正常的 http 访问。</p>" +
      '<p class="tiny muted">技术细节：' + esc(err && err.message) + "</p>" +
      (err && err.stack ? '<details style="margin-top:10px"><summary class="tiny muted" style="cursor:pointer">展开错误堆栈（给技术同学看）</summary><pre class="tiny">' + esc(err.stack) + "</pre></details>" : "") +
      "</div></div>";
  }

  var state = {
    ready: false, config: {}, index: null, maps: {}, sources: [], sourcesById: {},
    changelog: null, feedback: null, members: null, tests: null, page: null
  };
  MS.state = state;

  function boot(opts) {
    opts = opts || {};
    state.page = opts.page || document.body.getAttribute("data-page");
    var root = qs("#page-root");
    if (root) root.innerHTML = '<div class="wrap"><div class="loading"><div class="spinner"></div>正在读取地图数据…</div></div>';
    MS.chrome.mount(state.page);

    return getJSON("data/config.json").then(function (config) {
      var v = encodeURIComponent((config.site && config.site.version) || "0");
      var jobs = FILES.map(function (f) { return getJSON("data/" + f + ".json?v=" + v); });
      return Promise.all(jobs).then(function (res) {
        var byName = {};
        FILES.forEach(function (f, i) { byName[f] = res[i]; });

        state.config = config;
        state.maps = {};
        ["domain", "ecosystem", "cognitive"].forEach(function (k) {
          var file = byName[k];
          if (file && file.map) state.maps[file.map.id] = { meta: file.map, nodes: file.nodes || [] };
        });
        state.sources = (byName.sources && byName.sources.sources) || [];
        state.sourcesById = {};
        state.sources.forEach(function (s) { state.sourcesById[s.id] = s; });
        state.changelog = byName.changelog || { entries: [] };
        state.feedback = byName.feedback || { items: [] };
        state.members = byName.members || { members: [] };
        state.tests = byName.tests || { tests: [] };

        state.index = E.buildIndex({
          config: config,
          sources: byName.sources,
          maps: [byName.domain, byName.ecosystem, byName.cognitive],
          relations: byName.relations,
          routes: byName.routes
        });
        state.ready = true;
        state.stats = E.stats(state.index);

        MS.chrome.mount(state.page, state);

        var page = MS.pages[state.page];
        if (typeof page === "function") page(state, root);
        else if (root) root.innerHTML = '<div class="wrap"><div class="fatal"><h3>页面脚本缺失</h3><p>没有注册 ' + esc(state.page) + " 的渲染函数。</p></div></div>";
      });
    }).catch(function (err) {
      console.error(err);
      fatal(err);
    });
  }

  /* ---------- 导出 ---------- */
  MS.boot = boot;
  MS.pages = {};
  MS.esc = esc;
  MS.qs = qs;
  MS.qsa = qsa;
  MS.h = h;
  MS.on = on;
  MS.toast = toast;
  MS.copyText = copyText;
  MS.badge = badge;
  MS.typeBadge = typeBadge;
  MS.underBadge = underBadge;
  MS.verifyBadge = verifyBadge;
  MS.flagBadges = flagBadges;
  MS.typeTone = typeTone;
  MS.mapName = mapName;
  MS.renderNodeCard = renderNodeCard;
  MS.renderSources = renderSources;
  MS.renderRelations = renderRelations;
  MS.sourceItems = sourceItems;
  MS.emptyState = emptyState;
  MS.UNDER_TONE = UNDER_TONE;
  MS.VERIFY_TONE = VERIFY_TONE;
})(window.MS = window.MS || {});
