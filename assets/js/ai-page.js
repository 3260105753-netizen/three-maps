/* ============================================================
   AI 能力页：三项与地图直接相关的能力
   1) 概念查课程  2) 两点关系解释  3) 两条路线比较
   每个回答都强制附带：引用了哪些节点 / 来源 / 团队理解程度
   ============================================================ */
(function (MS) {
  "use strict";
  var E = MS.engine;
  var esc = MS.esc;

  MS.pages.ai = function render(state, root) {
    var index = state.index;

    root.innerHTML =
      '<div class="wrap">' +
        '<header class="page-head">' +
          '<p class="eyebrow">AI 能力</p>' +
          "<h1>三项直接服务于地图的能力</h1>" +
          '<p class="page-q">不是通用聊天。用户问的每一句都落在三张地图的节点与关系上，回答里的每个结论都能点回节点、看到来源和团队的理解程度；地图里没有的，就明说没有。</p>' +
          '<div class="stat-row" style="margin-top:22px">' +
            '<div class="stat"><b>' + index.nodes.length + "</b><span>可检索节点</span></div>" +
            '<div class="stat"><b>' + index.relations.length + "</b><span>可推理关系</span></div>" +
            '<div class="stat"><b>' + index.sources.length + "</b><span>来源库</span></div>" +
            '<div class="stat"><b>' + index.routes.length + "</b><span>可比路线</span></div>" +
          "</div>" +
        "</header>" +

        '<div class="tabs" role="tablist" aria-label="AI 能力">' +
          '<button class="tab" role="tab" id="tab-1" aria-controls="panel-1" aria-selected="true">① 概念查课程</button>' +
          '<button class="tab" role="tab" id="tab-2" aria-controls="panel-2" aria-selected="false">② 关系解释</button>' +
          '<button class="tab" role="tab" id="tab-3" aria-controls="panel-3" aria-selected="false">③ 路线比较</button>' +
        "</div>" +

        panel1(state) + panel2(state) + panel3(state) +

        explainer(state) +
      "</div>";

    /* ---------------- 标签页 ---------------- */
    var tabs = MS.qsa(".tab", root);
    tabs.forEach(function (t) {
      t.addEventListener("click", function () { activate(t.getAttribute("aria-controls")); });
    });
    function activate(panelId) {
      tabs.forEach(function (t) { t.setAttribute("aria-selected", t.getAttribute("aria-controls") === panelId ? "true" : "false"); });
      MS.qsa(".tab-panel", root).forEach(function (p) { p.hidden = p.id !== panelId; });
    }
    var startPanel = (location.hash || "").replace("#", "");
    if (["panel-2", "panel-3"].indexOf(startPanel) >= 0) activate(startPanel);

    /* ---------------- 面板 1 ---------------- */
    var q1 = root.querySelector("#q1");
    var run1 = root.querySelector("#run1");
    var out1 = root.querySelector("#out1");

    function doQuery1(text) {
      var q = (text || q1.value || "").trim();
      if (!q) { out1.innerHTML = hint("先输入一个概念，例如节点名或标签。"); return; }
      q1.value = q;
      out1.innerHTML = renderCourses(state, E.queryCourses(index, q));
    }
    run1.addEventListener("click", function () { doQuery1(); });
    q1.addEventListener("keydown", function (e) { if (e.key === "Enter") doQuery1(); });
    MS.qsa("[data-ask]", root).forEach(function (b) {
      b.addEventListener("click", function () { activate("panel-1"); doQuery1(b.getAttribute("data-ask")); });
    });

    if (!index.nodes.length) {
      out1.innerHTML = hint("地图里还没有节点，所以查不出任何东西——这正是「不编造」的默认行为。先往 data/ 里导入节点即可。");
    }

    /* ---------------- 面板 2 ---------------- */
    var a2 = root.querySelector("#a2"), b2 = root.querySelector("#b2");
    var out2 = root.querySelector("#out2");
    function doExplain() {
      if (!a2.value || !b2.value) { out2.innerHTML = hint("请选择两个节点。"); return; }
      if (a2.value === b2.value) { out2.innerHTML = hint("两个节点相同，换一个再试。"); return; }
      out2.innerHTML = renderExplain(state, E.explainRelation(index, a2.value, b2.value));
    }
    root.querySelector("#run2").addEventListener("click", doExplain);
    root.querySelector("#swap2").addEventListener("click", function () {
      var t = a2.value; a2.value = b2.value; b2.value = t; doExplain();
    });

    /* ---------------- 面板 3 ---------------- */
    var a3 = root.querySelector("#a3"), b3 = root.querySelector("#b3");
    var out3 = root.querySelector("#out3");
    function doCompare() {
      if (!a3.value || !b3.value) { out3.innerHTML = hint("请选择两条路线。"); return; }
      out3.innerHTML = renderCompare(state, E.compareRoutes(index, a3.value, b3.value));
    }
    var run3 = root.querySelector("#run3");
    if (run3) run3.addEventListener("click", doCompare);

    /* 默认预跑一次，让页面一打开就有东西可看 */
    if (index.nodes.length) {
      var first = index.nodes[0];
      out1.innerHTML = renderCourses(state, E.queryCourses(index, first.name));
    }
    if (index.nodes.length > 1) {
      var picks = index.nodes.slice(0, 2);
      a2.value = picks[0].id;
      b2.value = picks[1].id;
      doExplain();
    }
    if (index.routes.length > 1) {
      a3.value = index.routes[0].id;
      b3.value = index.routes[1].id;
      doCompare();
    }
  };

  /* ---------------- 面板骨架 ---------------- */
  function panel1(state) {
    var suggestions = E.uniq(state.index.nodes.map(function (n) { return n.name; })).slice(0, 40);
    return '<section class="tab-panel" id="panel-1" role="tabpanel" aria-labelledby="tab-1">' +
      '<div class="panel">' +
        "<h3>输入一个概念，返回它相关的课程、学习基础与工具</h3>" +
        '<p class="small muted">取数逻辑：先按名称/标签/说明检索到节点，再沿「前置」关系找课程节点，沿「依赖 / 包含 / 采用」找学习基础，最后合并来源与理解程度。没有挂课程时不会编造课程名。</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">' +
          '<div class="search" style="flex:1 1 260px"><input type="search" id="q1" list="node-names" placeholder="例如：典型任务、核心概念…" aria-label="输入概念"></div>' +
          '<button class="btn btn-primary" type="button" id="run1">查询</button>' +
        "</div>" +
        '<datalist id="node-names">' + suggestions.map(function (n) { return '<option value="' + esc(n) + '"></option>'; }).join("") + "</datalist>" +
        (suggestions.length ? '<div class="chip-row" style="margin-top:10px"><span class="tiny muted">试试：</span>' +
          suggestions.slice(0, 4).map(function (n) { return '<button class="chip" type="button" data-ask="' + esc(n) + '">' + esc(n) + "</button>"; }).join("") + "</div>" : "") +
      "</div>" +
      '<div id="out1" style="margin-top:16px"></div>' +
    "</section>";
  }

  function panel2(state) {
    var groups = state.index.mapList.map(function (pack) {
      var opts = pack.nodes.map(function (n) {
        return '<option value="' + esc(n.id) + '">' + esc(n.name) + "（" + esc(n.type) + "）</option>";
      }).join("");
      return opts ? '<optgroup label="' + esc(pack.meta.name) + '">' + opts + "</optgroup>" : "";
    }).join("");

    var all = state.index.nodes;
    var d1 = all[0] ? all[0].id : "";
    var d2 = all.length > 1 ? all[1].id : d1;

    return '<section class="tab-panel" id="panel-2" role="tabpanel" aria-labelledby="tab-2" hidden>' +
      '<div class="panel">' +
        "<h3>选两个节点，解释它们通过哪些中间节点发生关系</h3>" +
        '<p class="small muted">取数逻辑：在关系图上找最短路径（最多 6 跳），逐步给出每一跳的关系词、为什么成立、证据类型和来源。两个节点确实没连通时，会直接说没有，而不是编一条。</p>' +
        '<div class="grid g2" style="margin-top:12px">' +
          '<label class="small">起点<select id="a2">' + groups + "</select></label>" +
          '<label class="small">终点<select id="b2">' + groups + "</select></label>" +
        "</div>" +
        '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">' +
          '<button class="btn btn-primary" type="button" id="run2">解释关系</button>' +
          '<button class="btn btn-ghost btn-sm" type="button" id="swap2">交换起点终点</button>' +
        "</div>" +
      "</div>" +
      '<div id="out2" style="margin-top:16px"></div>' +
    "</section>";
  }

  function panel3(state) {
    var routes = state.index.routes;
    if (!routes.length) {
      return '<section class="tab-panel" id="panel-3" role="tabpanel" aria-labelledby="tab-3" hidden>' +
        MS.emptyState({
          icon: "⇄",
          title: "还没有定义技术路线",
          desc: "路线比较需要 data/routes.json 里至少两条路线，每条路线列出它依赖的节点、适用条件与局限。有了数据这个面板就会自动可用。",
          actions: '<a class="btn btn-sm btn-primary" href="data/routes.json">看 routes.json</a>'
        }) + "</section>";
    }
    var opts = routes.map(function (r) { return '<option value="' + esc(r.id) + '">' + esc(r.name) + "</option>"; }).join("");
    return '<section class="tab-panel" id="panel-3" role="tabpanel" aria-labelledby="tab-3" hidden>' +
      '<div class="panel">' +
        "<h3>比较两条技术路线：共有依赖、独有依赖、生态与风险</h3>" +
        '<p class="small muted">取数逻辑：把两条路线各自挂的节点做交集与差集，再按类型分组，最后列出理解程度最低的节点和没有来源的节点作为风险提示。</p>' +
        '<div class="grid g2" style="margin-top:12px">' +
          '<label class="small">路线 A<select id="a3">' + opts + "</select></label>" +
          '<label class="small">路线 B<select id="b3">' + opts + "</select></label>" +
        "</div>" +
        '<div style="margin-top:12px"><button class="btn btn-primary" type="button" id="run3">比较</button></div>' +
      "</div>" +
      '<div id="out3" style="margin-top:16px"></div>' +
    "</section>";
  }

  /* ---------------- 渲染：引用块 ---------------- */
  function citeBlock(c) {
    if (!c) return "";
    var nodes = c.nodes.map(function (n) {
      return '<li><a href="' + esc(n.map) + '.html#node=' + esc(n.id) + '">' + esc(n.name) + "</a> " +
        '<span class="tiny muted">' + esc(n.type) + " · " + esc(n.understanding) + "</span></li>";
    }).join("");
    var srcs = c.sources.map(function (s) {
      return '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.title) + "</a></li>";
    }).join("");
    var gaps = c.gapSources.length ? '<li class="muted">来源待补：' + c.gapSources.map(function (s) { return esc(s.title); }).join("；") + "</li>" : "";
    var u = c.understanding;
    return '<div class="cite">' +
      '<div class="cite-title">这条回答的引用（没有引用就不给结论）</div>' +
      '<div class="cite-grid">' +
        '<div class="cite-box"><b>引用的地图节点（' + c.nodes.length + '）</b><ul>' + (nodes || "<li>无</li>") + "</ul></div>" +
        '<div class="cite-box"><b>来源链接（' + c.sources.length + '）</b><ul>' + ((srcs + gaps) || "<li>无</li>") + "</ul></div>" +
        '<div class="cite-box"><b>团队理解程度</b><ul>' +
          "<li>已初步理解：" + u["已初步理解"] + " 个</li>" +
          "<li>已经尝试：" + u["已经尝试"] + " 个</li>" +
          "<li>待深入学习：" + u["待深入学习"] + " 个</li>" +
          (c.weakest.length ? "<li class=\"muted\">最薄弱：" + c.weakest.map(function (n) { return esc(n.name); }).join("、") + "</li>" : "") +
        "</ul></div>" +
      "</div></div>";
  }

  function hint(text) { return '<div class="panel"><p class="small" style="margin:0">' + esc(text) + "</p></div>"; }

  /* ---------------- 渲染：能力 1 ---------------- */
  function renderCourses(state, r) {
    if (!r.found) {
      return '<div class="answer"><div class="answer-head">没有答案，也是一种答案</div><div class="answer-body">' +
        "<h3>地图里没有找到「" + esc(r.query) + "」</h3>" +
        "<p>按规矩，这种情况不能编一个解释出来。目前可检索的节点共 " + r.nodeCount + " 个。</p>" +
        (r.suggestions.length ? '<p class="small muted" style="margin-bottom:6px">这张地图现有标签：</p><div class="chip-row">' +
          r.suggestions.map(function (t) { return '<span class="chip">' + esc(t) + "</span>"; }).join("") + "</div>" : "") +
        '<p class="small muted" style="margin-top:12px">如果这确实是一个重要概念，应该先把它作为节点补进地图，并挂上关系与来源，然后再来问一次。</p>' +
        "</div></div>";
    }

    var n = r.node;
    var courses = r.courses.length
      ? '<div class="table-wrap"><table><thead><tr><th>课程</th><th>标签</th><th>对应能力</th><th>依据</th><th>理解程度</th></tr></thead><tbody>' +
        r.courses.map(function (c) {
          return "<tr><td><a href=\"" + esc(c.node._map) + '.html#node=' + esc(c.node.id) + '">' + esc(c.node.name) + "</a></td>" +
            "<td>" + esc(c.node.courseLabel || "—") + "</td>" +
            "<td>" + esc(c.node.courseAbility || "—") + "</td>" +
            "<td>" + esc(c.node.courseBasis || "—") + "</td>" +
            "<td>" + MS.underBadge(c.node) + "</td></tr>";
        }).join("") + "</tbody></table></div>"
      : '<p class="small muted" style="margin:0">这个概念还没有挂课程节点。按规范，课程关联必须有培养方案或大纲依据，所以宁可不写，也不凭课名猜。</p>';

    function list(items, emptyText) {
      if (!items.length) return '<p class="small muted" style="margin:0">' + esc(emptyText) + "</p>";
      return '<ul class="rel-list">' + items.map(function (x) {
        return '<li class="rel"><div class="rel-top">' + MS.typeBadge(x.node.type) +
          '<a href="' + esc(x.node._map) + '.html#node=' + esc(x.node.id) + '">' + esc(x.node.name) + "</a>" +
          '<span class="rel-dir">' + esc(x.rel.label || x.rel.type) + "</span>" +
          (x.rel.inferred ? '<span class="flag">推断</span>' : "") + "</div>" +
          '<p class="rel-why">' + esc(x.rel.why) + "</p>" +
          '<div class="rel-foot">' + MS.underBadge(x.node) + MS.verifyBadge(x.rel.verify) + "</div></li>";
      }).join("") + "</ul>";
    }

    return '<div class="answer">' +
      '<div class="answer-head">命中节点：' + esc(n.name) + " · " + esc(n._mapName) + " · " + esc(n.type) + "</div>" +
      '<div class="answer-body">' +
        "<h3>" + esc(n.name) + "</h3>" +
        '<p style="color:var(--text)">' + esc(n.summary) + "</p>" +
        '<div class="node-meta">' + MS.typeBadge(n.type) + MS.underBadge(n) + MS.verifyBadge(n.verify) + "</div>" +

        '<div class="block"><h4>放在哪里</h4><p class="small">它在 <a href="' + esc(n._map) + '.html#node=' + esc(n.id) + '">' + esc(n._mapName) + "</a>，" +
          "理解程度是「" + esc(n.understanding) + "」" + (n.understandingNote ? "：" + esc(n.understandingNote) : "") + "。</p></div>" +

        '<div class="block"><h4>相关课程</h4>' + courses + "</div>" +
        '<div class="block"><h4>学习基础（先弄懂这些）</h4>' + list(r.prereqs, "地图里还没有标注它的前置知识。这通常意味着这个节点还比较孤立。") + "</div>" +
        '<div class="block"><h4>相关工具与模型</h4>' + list(r.tools, "没有关联的软件或模型节点。") + "</div>" +
        (r.related.length ? '<div class="block"><h4>其他相关节点</h4>' + list(r.related, "") + "</div>" : "") +
        (r.alternatives.length ? '<div class="block"><h4>还可能是</h4><div class="chip-row">' + r.alternatives.map(function (a) {
          return '<button class="chip" type="button" data-ask="' + esc(a.name) + '">' + esc(a.name) + "</button>";
        }).join("") + "</div></div>" : "") +
        citeBlock(r.citations) +
      "</div></div>";
  }

  /* ---------------- 渲染：能力 2 ---------------- */
  function renderExplain(state, r) {
    if (!r.found) {
      if (r.reason === "missing") return hint("有节点不存在，可能刚被改名或删除。刷新页面试试。");
      return '<div class="answer"><div class="answer-head">没有找到通路</div><div class="answer-body">' +
        "<h3>「" + esc(r.a.name) + "」和「" + esc(r.b.name) + "」在地图上没有连通的路径</h3>" +
        "<p>在 6 跳以内都找不到关系链。可能的原因有三个：</p>" +
        '<ul class="small"><li>它们分属不同地图，而跨图的「对应 / 体现」关系还没建；</li>' +
        "<li>确实没有直接关系，硬连会变成牵强；</li>" +
        "<li>其中一个节点刚加入，还没有接线。</li></ul>" +
        '<p class="small muted">本能力不会为了给出答案而编造中间节点。要让它能回答，先在两处补关系。</p>' +
        '<div class="cite">' + citeBlock(r.citations || { nodes: [], sources: [], gapSources: [], understanding: { "已初步理解": 0, "已经尝试": 0, "待深入学习": 0 }, weakest: [] }) + "</div>" +
        "</div></div>";
    }

    var direct = r.direct.length
      ? '<div class="chip-row">' + r.direct.map(function (d) {
          return '<span class="chip">直接关系：' + esc(d.rel.type) + "（" + esc(d.rel.id) + "）" + (d.rel.inferred ? " · 推断" : "") + "</span>";
        }).join("") + "</div>"
      : "";

    var hops = "";
    if (r.path && r.path.edges.length) {
      hops = '<div class="block"><h4>逐跳说明（' + r.path.hops + " 跳）</h4>" +
        r.path.edges.map(function (e, i) {
          var from = state.index.byId[e.from], to = state.index.byId[e.to];
          return '<div class="hop"><h4>' + esc(from.name) + " → " + esc(to.name) + "</h4>" +
            '<p><span class="chip">' + esc(e.rel.type) + "</span> " + esc(e.rel.label || "") +
            (e.rel.inferred ? ' <span class="flag">推断，未证实</span>' : "") + "</p>" +
            '<p class="small" style="margin-top:4px">为什么成立：' + esc(e.rel.why) + "</p>" +
            '<p class="tiny muted" style="margin:4px 0 6px">证据：' + esc(e.rel.evidence || "—") + " · 核实：" + esc(e.rel.verify || "—") + " · 关系编号：" + esc(e.rel.id) + "</p>" +
            ((e.rel.sourceIds || []).length ? MS.renderSources(state, e.rel.sourceIds) : '<p class="tiny muted" style="margin:0">这条关系没有登记来源。</p>') +
            "</div>";
        }).join("") + "</div>";
    }

    var chain = r.path ? '<div class="path" style="margin-bottom:14px">' + r.path.nodes.map(function (n, i) {
      var cls = i === 0 ? "start" : (i === r.path.nodes.length - 1 ? "end" : "");
      var node = '<span class="path-node ' + cls + '">' + esc(n.name) + "</span>";
      if (i === 0) return node;
      var e = r.path.edges[i - 1];
      return '<span class="path-arrow"><span>' + esc(e.rel.type) + '</span><span class="lbl">→</span></span>' + node;
    }).join("") + "</div>" : "";

    return '<div class="answer">' +
      '<div class="answer-head">' + esc(r.a.name) + " ⇢ " + esc(r.b.name) + (r.path ? " · " + r.path.hops + " 跳" : " · 直接相连") + "</div>" +
      '<div class="answer-body">' +
        "<h3>它们这样连起来</h3>" + chain + direct + hops +
        '<div class="block"><h4>这个结论的可信度</h4>' +
          '<p class="small">路径上共有 ' + (r.path ? r.path.edges.length : 0) + " 条关系，其中 " +
          (r.path ? r.path.edges.filter(function (e) { return e.rel.inferred; }).length : 0) + " 条是团队推断、尚未证实。" +
          "引用节点均给出理解程度，理解程度低的节点说明这条解释还需要验证。</p></div>" +
        citeBlock(r.citations) +
      "</div></div>";
  }

  /* ---------------- 渲染：能力 3 ---------------- */
  function renderCompare(state, r) {
    if (!r.found) {
      if (r.reason === "same") return hint("选了同一条路线，换一条再比。");
      return hint("路线数据缺失，检查 data/routes.json 里的 id 是否一致。");
    }

    function nodeChips(list) {
      if (!list.length) return '<span class="small muted">无</span>';
      return '<div class="chip-row">' + list.map(function (n) {
        return '<a class="chip" href="' + esc(n._map) + '.html#node=' + esc(n.id) + '">' + esc(n.name) + "</a>";
      }).join("") + "</div>";
    }
    function grouped(g) {
      var keys = Object.keys(g);
      if (!keys.length) return '<span class="small muted">无</span>';
      return keys.map(function (k) {
        return '<div style="margin-bottom:6px"><span class="tiny muted">' + esc(k) + "：</span>" +
          g[k].map(function (n) { return esc(n.name); }).join("、") + "</div>";
      }).join("");
    }

    return '<div class="answer">' +
      '<div class="answer-head">' + esc(r.a.name) + " vs " + esc(r.b.name) + "</div>" +
      '<div class="answer-body">' +
        '<div class="grid g2">' +
          '<div class="panel"><h4 style="margin-top:0">' + esc(r.a.name) + "</h4><p class=\"small\">" + esc(r.a.summary || "") + "</p>" +
            '<p class="tiny muted">适用条件：' + esc(r.a.conditions || "未填") + "</p><p class=\"tiny muted\">主要局限：" + esc(r.a.limits || "未填") + "</p></div>" +
          '<div class="panel"><h4 style="margin-top:0">' + esc(r.b.name) + "</h4><p class=\"small\">" + esc(r.b.summary || "") + "</p>" +
            '<p class="tiny muted">适用条件：' + esc(r.b.conditions || "未填") + "</p><p class=\"tiny muted\">主要局限：" + esc(r.b.limits || "未填") + "</p></div>" +
        "</div>" +

        '<div class="block"><h4>共同依赖（' + r.shared.length + '）</h4>' + nodeChips(r.shared) + "</div>" +
        '<div class="block"><h4>只有 ' + esc(r.a.name) + " 需要（" + r.onlyA.length + "）</h4>" + nodeChips(r.onlyA) + "</div>" +
        '<div class="block"><h4>只有 ' + esc(r.b.name) + " 需要（" + r.onlyB.length + "）</h4>" + nodeChips(r.onlyB) + "</div>" +

        '<div class="block"><h4>按类型看差异</h4><div class="grid g2">' +
          "<div><b class=\"small\">" + esc(r.a.name) + "</b>" + grouped(r.groupA) + "</div>" +
          "<div><b class=\"small\">" + esc(r.b.name) + "</b>" + grouped(r.groupB) + "</div>" +
        "</div></div>" +

        '<div class="block"><h4>生态侧对照</h4><div class="grid g3">' +
          '<div class="cite-box"><b>共用生态</b>' + nodeChips(r.ecoShared) + "</div>" +
          '<div class="cite-box"><b>仅 A</b>' + nodeChips(r.ecoOnlyA) + "</div>" +
          '<div class="cite-box"><b>仅 B</b>' + nodeChips(r.ecoOnlyB) + "</div>" +
        "</div></div>" +

        '<div class="block"><h4>风险提示（这张表才是比较的价值）</h4>' +
          (r.weak.length ? '<p class="small">有 ' + r.weak.length + " 个依赖节点属于「待深入学习」，意味着这条路线我们其实没真正吃透：" +
            r.weak.map(function (n) { return esc(n.name); }).join("、") + "。</p>" : '<p class="small">两条路线涉及的节点都至少是「已初步理解」。</p>') +
          (r.noSource.length ? '<p class="small">有 ' + r.noSource.length + " 个节点没有登记来源：" +
            r.noSource.map(function (n) { return esc(n.name); }).join("、") + "。没来源的判断不能当成结论用。</p>" : '<p class="small">涉及节点均有来源。</p>') +
        "</div>" +
        citeBlock(r.citations) +
      "</div></div>";
  }

  /* ---------------- 说明区 ---------------- */
  function explainer(state) {
    var s = state.stats;
    return '<section class="section-block" id="why">' +
      '<div class="section-head"><div><h2>为什么这不是一个通用聊天机器人</h2>' +
      "<p>课程要求「涉及事实的回答应能够回到地图内容或可靠来源，没有依据时要说明不确定，不能编造课程、论文或人物关系」。这条要求直接决定了实现方式。</p></div></div>" +
      '<div class="grid g2">' +
        '<div class="panel"><h3 style="margin-top:0">它怎么工作</h3>' +
          '<ol class="small" style="padding-left:18px;line-height:2">' +
            "<li>把 <code>data/</code> 里的节点、关系、来源读进内存，建成一张图；</li>" +
            "<li>用户输入 → 先做检索，命中不到就直接说没有；</li>" +
            "<li>关系解释用图上的最短路径，每一跳都带关系词与理由；</li>" +
            "<li>路线比较用节点的交集/差集，并按类型分组；</li>" +
            "<li>最后统一附上：引用了哪些节点、来源链接、理解程度。</li>" +
          "</ol>" +
          '<p class="tiny muted" style="margin-top:10px">全站是静态文件，不调用任何大模型 API，不需要密钥，也不向使用者索取任何凭证。</p>' +
        "</div>" +
        '<div class="panel"><h3 style="margin-top:0">它明确做不到什么</h3>' +
          '<ul class="small" style="padding-left:18px;line-height:2">' +
            "<li>地图里没有的节点，它查不出来——这是特性，不是缺陷；</li>" +
            "<li>关系没连线时，它不会替你想一条中间路径；</li>" +
            "<li>它不判断内容对不对，只忠实呈现你们登记的判断与来源；</li>" +
            "<li>它不会跟踪论文更新，只反映上次导入的数据。</li>" +
          "</ul>" +
          '<p class="tiny muted" style="margin-top:10px">当前数据：' + s.nodes + " 个节点、" + s.relations + " 条关系、" +
          s.sources + " 条来源，其中 " + s.inferred + " 条关系标为团队推断。</p>" +
        "</div>" +
      "</div>" +
      '<div class="panel" style="margin-top:16px"><h3 style="margin-top:0">怎么把能力用在自己的内容上</h3>' +
        '<p class="small">三项能力完全不依赖具体学科，只依赖数据结构。只要按字段契约填好节点与关系：' +
        "挂上「前置」关系就会自动出现在查课程里；连成路径就能做关系解释；在 <code>routes.json</code> 里写两条路线就能做比较。</p>" +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<a class="btn btn-sm" href="docs/01-节点字段契约.md">字段契约</a>' +
          '<a class="btn btn-sm" href="docs/03-AI能力计划.md">AI 能力计划</a>' +
          '<a class="btn btn-sm" href="domain.html">去地图里补节点</a>' +
        "</div>" +
      "</div>" +
    "</section>";
  }
})(window.MS = window.MS || {});
