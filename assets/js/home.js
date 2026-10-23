/* ============================================================
   首页：领域一句话定义 + 三张地图入口 + 成长路线 + 本周进展
   ============================================================ */
(function (MS) {
  "use strict";
  var esc = MS.esc;
  MS.pages.home = function render(state, root) {
    var cfg = state.config.site || {};
    var s = state.stats;
    var maps = state.index.mapList;
    var latest = (state.changelog.entries || []).slice().sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date));
    }).slice(0, 3);
    root.innerHTML =
      '<div class="wrap">' +
        hero(cfg, s, maps, !!state.config.demoContent) +
        scopeBlock(cfg) +
        mapEntries(state, maps) +
        aiBlock(state) +
        growthBlock(cfg) +
        weeklyBlock(state) +
        latestBlock(latest) +
      "</div>";
    var year = new Date().getFullYear();
    var copy = root.querySelector("[data-copy-link]");
    if (copy) {
      copy.addEventListener("click", function () {
        MS.copyText(location.href).then(function (ok) {
          MS.toast(ok ? "链接已复制，可以直接发给同学" : "复制失败，请手动复制地址栏");
        });
      });
    }
    root.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = year; });
  };
  function hero(cfg, s, maps, demo) {
    return '<header class="hero">' +
      '<p class="eyebrow">' + esc(cfg.groupName || "小组名称待填") + " · " + esc(cfg.term || "") + " · " + esc((cfg.site && cfg.site.version) || "V0.1") + "</p>" +
      "<h1>" + esc(cfg.domain || "选题领域待填") + "</h1>" +
      '<p class="hero-line">' + esc(cfg.domainLine || "一句话定义待填。") + "</p>" +
      '<div class="hero-meta">' +
        '<span class="chip">三张地图</span>' +
        '<span class="chip">' + s.nodes + " 个节点</span>" +
        '<span class="chip">' + s.relations + " 条关系</span>" +
        '<span class="chip">' + s.sources + " 条来源</span>" +
        (s.unverified ? '<span class="chip" style="color:var(--amber);border-color:rgba(251,191,36,.4)">' + s.unverified + " 个待核实</span>" : "") +
        (demo ? '<span class="chip" style="color:var(--amber);border-color:rgba(251,191,36,.4)">骨架演示数据</span>' : "") +
      "</div>" +
      '<div class="hero-actions">' +
        '<a class="btn btn-primary" href="domain.html">从领域地图开始</a>' +
        '<a class="btn" href="ai.html">试一下 AI 能力</a>' +
        '<button class="btn btn-ghost" type="button" data-copy-link>复制本站链接</button>' +
      "</div>" +
      '<div class="stat-row">' +
        tile(s.nodes, "节点总数") +
        tile(s.relations, "关系总数") +
        tile(s.withSources + "/" + s.nodes, "有可打开来源") +
        tile(s.courses || 0, "已挂课程") +
      "</div>" +
    "</header>";
  }
  function tile(v, label) { return '<div class="stat"><b>' + esc(v) + "</b><span>" + esc(label) + "</span></div>"; }
  function scopeBlock(cfg) {
    return '<section class="section-block" id="scope">' +
      '<div class="section-head"><div><h2>这个网站讲什么、不讲什么</h2>' +
      "<p>选题要有明确边界。写清不展开的部分，比把范围写得很大更有用。</p></div></div>" +
      '<div class="grid g2">' +
        '<div class="panel"><h4 style="margin-top:0">我们研究什么</h4>' +
          '<p class="small">' + esc(cfg.focus || "（待填）一个具体、可评测的典型任务") + "</p>" +
          '<p class="small muted" style="margin:0">' + esc(cfg.scopeIn || "（待填）要讲清楚的那条任务链。") + "</p></div>" +
        '<div class="panel"><h4 style="margin-top:0">哪些暂不展开</h4>' +
          '<p class="small muted" style="margin:0">' + esc(cfg.scopeOut || "（待填）明确不展开的部分。") + "</p>" +
          '<p class="small" style="margin-top:10px">' + esc(cfg.direction || "") + "</p></div>" +
      "</div>" +
      '<div class="panel" style="margin-top:16px">' +
        '<p class="small" style="margin:0"><strong>选题一句话</strong>（按课程要求，每组用一段话说清）：' +
        "我们研究 <em>" + esc(cfg.domain || "领域") + "</em>，希望帮助同学理解 <em>" + esc(cfg.focus || "这个任务的整体结构") +
        "</em>；<em>" + esc(cfg.scopeOut || "若干内容") + "</em> 暂不展开。</p>" +
      "</div>" +
    "</section>";
  }
  function mapEntries(state, maps) {
    return '<section class="section-block" id="maps">' +
      '<div class="section-head"><div><h2>三张地图，同一个网站</h2>' +
      "<p>三张图共用一套节点、关系、来源和更新记录，所以从一个节点可以跳到另一个视角，而不是三份互不相干的页面。</p></div>" +
      '<a class="btn btn-sm btn-ghost" href="ai.html">这些数据怎么被 AI 用 →</a></div>' +
      '<div class="grid g3">' + maps.map(function (pack) {
        var meta = pack.meta;
        var nodes = pack.nodes || [];
        var relCount = state.index.relations.filter(function (r) {
          return nodes.some(function (n) { return n.id === r.from || n.id === r.to; });
        }).length;
        return '<a class="map-card" href="' + esc(meta.id) + '.html" style="--accent-map:' + esc(meta.accent || "#5eead4") + '">' +
          '<span class="badge" style="--tone:' + esc(meta.accent || "#5eead4") + '">' + esc(meta.name) + "</span>" +
          "<h3>" + esc(meta.subtitle) + "</h3>" +
          '<p class="map-q" style="margin:0">' + esc(meta.purpose || "") + "</p>" +
          '<div class="map-foot">' +
            "<span>" + nodes.length + " 个节点</span><span>·</span>" +
            "<span>" + relCount + " 条关系</span><span>·</span>" +
            "<span>" + esc(meta.dataset === "seed" ? "示例数据" : "更新 " + (meta.updated || "—")) + "</span>" +
          "</div></a>";
      }).join("") + "</div>" +
    "</section>";
  }
  function aiBlock(state) {
    var caps = [
      { t: "概念查课程", d: "输入一个概念，返回相关课程、学习基础和相关工具，并标出每门课的依据与理解程度。", h: "ai.html#panel-1" },
      { t: "关系解释", d: "选两个节点，逐跳说明它们通过哪些中间节点发生关系，每一跳都给理由和来源。", h: "ai.html#panel-2" },
      { t: "路线比较", d: "比较两条技术路线的共有依赖、独有依赖、生态与风险，风险项按理解程度排序。", h: "ai.html#panel-3" }
    ];
    return '<section class="section-block" id="ai">' +
      '<div class="section-head"><div><h2>AI 能力：只回答地图里有的</h2>' +
      "<p>不用大模型生成内容，而是在地图的节点与关系上做检索与推理。所以每个回答都能点回节点、看到来源，现场也不会因为网络或额度挂掉。</p></div></div>" +
      '<div class="grid g3">' + caps.map(function (c, i) {
        return '<a class="map-card" href="' + c.h + '" style="--accent-map:#5eead4">' +
          '<span class="badge plain">能力 ' + (i + 1) + "</span>" +
          "<h3>" + esc(c.t) + "</h3>" +
          '<p class="map-q" style="margin:0">' + esc(c.d) + "</p>" +
          '<div class="map-foot"><span>引用节点 · 来源链接 · 理解程度</span></div></a>';
      }).join("") + "</div>" +
      '<p class="small muted" style="margin-top:14px">' + esc((state.config.site || {}).aiEngineNote || "") + "</p>" +
    "</section>";
  }
  function growthBlock(cfg) {
    var routes = [
      { name: "AI 科学家", q: "为什么会这样？现有解释有什么不足？", way: "提出问题 → 查阅研究 → 形成假设 → 构建方法 → 检验与解释", habit: "追问原理、区分证据与猜测、比较不同解释、保留反例" },
      { name: "AI 工程师", q: "如何在真实约束下实现，并稳定高效运行？", way: "明确需求 → 设计架构 → 实现集成 → 测试部署 → 优化维护", habit: "拆分任务、理解数据流、记录故障、检查性能与可靠性" },
      { name: "AI 设计师", q: "值得创造什么？如何形成有价值的体验？", way: "研究人与场景 → 定义问题 → 探索方案 → 制作原型 → 评估迭代", habit: "观察真实行为、保留多种方案、解释设计取舍、持续获取反馈" }
    ];
    return '<section class="section-block" id="routes">' +
      '<div class="section-head"><div><h2>三条成长路线</h2>' +
      "<p>这门课不要求现在就确定职业方向。三条路线有共同基础，也可以交叉：科学家需要工程能力，工程师可以开展研究，设计师也要理解模型。</p></div>" +
      '<span class="small muted">' + esc(cfg.direction || "") + "</span></div>" +
      '<div class="table-wrap"><table><thead><tr><th>取向</th><th>主要关注的问题</th><th>典型工作路线</th><th>新生可以开始培养的习惯</th></tr></thead><tbody>' +
        routes.map(function (r) {
          return "<tr><td><strong>" + esc(r.name) + "</strong></td><td>" + esc(r.q) + "</td><td>" + esc(r.way) + "</td><td>" + esc(r.habit) + "</td></tr>";
        }).join("") + "</tbody></table></div>" +
      '<p class="small muted" style="margin-top:12px">不按专业固定分组，也不要求同学提前达到专业水平。本组取向见上方，三张地图里凡是「待深入学习」的节点就是我们还没到位的部分。</p>' +
    "</section>";
  }
  function weeklyBlock(state) {
    var w = state.config.weekly || {};
    return '<section class="section-block" id="weekly">' +
      '<div class="section-head"><div><h2>本周进展</h2>' +
      "<p>按课程要求只保留四句：完成了什么、发现了什么问题、下周解决什么、谁负责。长周报没必要。</p></div>" +
      '<span class="chip">' + esc(w.week || "本周") + "</span></div>" +
      '<div class="grid g4">' +
        qa("本周完成了什么", w.done) + qa("发现了什么问题", w.found) +
        qa("下周准备解决什么", w.next) + qa("谁负责", w.owner) +
      "</div></section>";
  }
  function qa(q, a) {
    return '<div class="panel"><h4 style="margin-top:0;color:var(--accent);font-size:12.5px;letter-spacing:.05em">' + esc(q) + "</h4>" +
      '<p class="small" style="margin:0">' + esc(a || "（待填）") + "</p></div>";
  }
  function latestBlock(entries) {
    if (!entries.length) {
      return '<section class="section-block" id="latest"><div class="section-head"><div><h2>最新更新</h2></div></div>' +
        MS.emptyState({ title: "还没有更新记录", desc: "每次改动都要写清日期、改了什么、为什么改。这是「活地图」的证据。", actions: '<a class="btn btn-sm" href="changelog.html">去更新记录</a>' }) + "</section>";
    }
    return '<section class="section-block" id="latest">' +
      '<div class="section-head"><div><h2>最新更新</h2>' +
      "<p>判断一张地图是不是「活的」，看的是中间有没有因为新证据和同学反馈发生实质修改。</p></div>" +
      '<a class="btn btn-sm btn-ghost" href="changelog.html">全部记录 →</a></div>' +
      '<div class="grid g3">' + entries.map(function (e) {
        return '<div class="panel"><div class="tl-head"><span class="tl-date">' + esc(e.date) + "</span>" +
          '<span class="badge plain">' + esc(e.type) + "</span></div>" +
          "<h4 style=\"margin:8px 0 6px\">" + esc(e.target || e.what) + "</h4>" +
          '<p class="small" style="margin:0">' + esc(e.what) + "</p></div>";
      }).join("") + "</div>" +
    "</section>";
  }
})(window.MS = window.MS || {});
