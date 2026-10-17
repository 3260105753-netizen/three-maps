/* ============================================================
   地图页：三张地图共用同一套渲染逻辑
   关系图 + 节点卡 + 按类型分区 + 一条可点击的浏览路径
   ============================================================ */
(function (MS) {
  "use strict";
  var E = MS.engine;
  var esc = MS.esc;

  function truncate(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n) + "…" : s; }

  function makePage(mapId) {
    return function render(state, root) {
      var pack = state.maps[mapId];
      if (!pack) { root.innerHTML = '<div class="wrap"><div class="fatal"><h3>缺少 ' + esc(mapId) + ".json</h3></div></div>"; return; }
      var meta = pack.meta;
      var all = state.index.nodes.filter(function (n) { return n._map === mapId; });
      var filters = { q: "", types: {}, unders: {}, onlyGap: false };
      var selectedId = null;
      var layoutCache = null;

      var order = ((state.config.vocab && state.config.vocab.nodeTypes && state.config.vocab.nodeTypes[mapId]) || []).slice();
      all.forEach(function (n) { if (order.indexOf(n.type) < 0) order.push(n.type); });

      root.innerHTML =
        '<div class="wrap">' +
          pageHeader(state, meta, all) +
          (all.length ? "" : noNodes(meta, mapId)) +
          '<div id="map-body"' + (all.length ? "" : " hidden") + ">" +
            toolbarHtml(all) +
            '<div class="map-layout">' +
              '<div class="graph-panel">' +
                '<div id="graph-host"></div>' +
                '<div class="graph-tools">' +
                  '<button class="btn btn-sm" type="button" data-act="shuffle">重新排布</button>' +
                  '<label class="small muted" style="display:flex;gap:6px;align-items:center;cursor:pointer">' +
                    '<input type="checkbox" id="label-all" checked> 显示全部标签</label>' +
                  '<span class="small muted" id="graph-hint"></span>' +
                "</div>" +
                legendHtml(order) +
              "</div>" +
              '<div id="node-detail"></div>' +
            "</div>" +
            pathWidgetHtml() +
            sectionsHtml(all, order) +
          "</div>" +
        "</div>";

      if (!all.length) return;

      drawGraph();
      wireToolbar();
      wireGraph();
      wireSections();
      wirePathWidget();
      wireHash();

      var initial = readHash() || pickStart(state, all).id;
      selectNode(initial, { scroll: false });

      /* ---------------- 筛选 ---------------- */
      function visible() {
        var hits = filters.q ? E.search(state.index, filters.q).map(function (n) { return n.id; }) : null;
        var tOn = Object.keys(filters.types).some(function (k) { return filters.types[k]; });
        var uOn = Object.keys(filters.unders).some(function (k) { return filters.unders[k]; });
        return all.filter(function (n) {
          if (hits && hits.indexOf(n.id) < 0) return false;
          if (tOn && !filters.types[n.type]) return false;
          if (uOn && !filters.unders[n.understanding]) return false;
          if (filters.onlyGap && n.verify !== "待核实" && n.verify !== "来源待补") return false;
          return true;
        });
      }

      function wireToolbar() {
        var search = root.querySelector("#map-search");
        var timer = null;
        search.addEventListener("input", function () {
          clearTimeout(timer);
          timer = setTimeout(function () { filters.q = search.value.trim(); refresh(); }, 130);
        });
        root.querySelector("#type-chips").addEventListener("click", function (e) {
          var b = e.target.closest("[data-type]"); if (!b) return;
          var t = b.getAttribute("data-type");
          filters.types[t] = !filters.types[t];
          b.setAttribute("aria-pressed", filters.types[t] ? "true" : "false");
          refresh();
        });
        root.querySelector("#under-chips").addEventListener("click", function (e) {
          var b = e.target.closest("[data-under]"); if (!b) return;
          var u = b.getAttribute("data-under");
          filters.unders[u] = !filters.unders[u];
          b.setAttribute("aria-pressed", filters.unders[u] ? "true" : "false");
          refresh();
        });
        root.querySelector("#only-gap").addEventListener("change", function (e) {
          filters.onlyGap = e.target.checked; refresh();
        });
        root.querySelector("#reset-filters").addEventListener("click", function () {
          filters.q = ""; filters.types = {}; filters.unders = {}; filters.onlyGap = false;
          search.value = "";
          root.querySelectorAll("[data-type],[data-under]").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
          root.querySelector("#only-gap").checked = false;
          refresh();
        });
      }

      function refresh() {
        drawGraph();
        var vis = {};
        visible().forEach(function (n) { vis[n.id] = true; });
        root.querySelectorAll("[data-tile]").forEach(function (t) {
          t.style.opacity = vis[t.getAttribute("data-tile")] ? "" : "0.32";
        });
      }

      /* ---------------- 关系图 ---------------- */
      function drawGraph() {
        var nodes = visible();
        var host = root.querySelector("#graph-host");
        var hint = root.querySelector("#graph-hint");
        if (hint) hint.textContent = "显示 " + nodes.length + " / " + all.length + " 个节点";
        if (!nodes.length) {
          host.innerHTML = '<div class="empty" style="margin:16px"><p>当前筛选条件下没有节点。清空搜索或筛选项即可恢复。</p></div>';
          return;
        }

        var ids = {}; nodes.forEach(function (n) { ids[n.id] = true; });
        var edges = state.index.relations.filter(function (r) { return ids[r.from] && ids[r.to]; });
        var W = 780, H = 540;
        // 节点多的时候标签会互相压住，默认只显示重点节点的标签
        var crowded = nodes.length > 14;
        var layout = E.computeLayout(nodes, edges, {
          width: W, height: H, iterations: crowded ? 460 : 340,
          pad: crowded ? 54 : 84,
          linkLength: crowded ? 78 : Math.max(70, Math.min(130, 1100 / Math.max(3, nodes.length)))
        });
        var pos = layout.positions;
        layoutCache = pos;

        // 按实际占用范围收紧 viewBox：图上没有大片空白，宽度也用满了
        var bb = layout.bbox || { minX: 0, minY: 0, maxX: W, maxY: H };
        var vpad = 54;
        var vbX = Math.floor(bb.minX - vpad), vbY = Math.floor(bb.minY - vpad);
        var vbW = Math.max(120, Math.ceil(bb.maxX - bb.minX + vpad * 2));
        var vbH = Math.max(120, Math.ceil(bb.maxY - bb.minY + vpad * 2));
        // 节点很少时不要把 viewBox 收得太小，否则整张图被放大到失真
        if (vbW < 460) { vbX -= Math.round((460 - vbW) / 2); vbW = 460; }
        if (vbH < 330) { vbY -= Math.round((330 - vbH) / 2); vbH = 330; }

        var svg = ['<svg viewBox="' + vbX + " " + vbY + " " + vbW + " " + vbH + '" role="img" aria-label="' + esc(meta.name) + "关系图，共 " + nodes.length + ' 个节点">'];
        svg.push('<defs>' +
          '<marker id="arrow" viewBox="0 0 10 10" refX="16" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(148,163,184,0.55)"></path></marker>' +
          '<marker id="arrow-hl" viewBox="0 0 10 10" refX="16" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#5eead4"></path></marker>' +
          "</defs>");

        edges.forEach(function (r) {
          var a = pos[r.from], b = pos[r.to];
          if (!a || !b) return;
          svg.push('<line class="g-edge" data-rel="' + esc(r.id) + '" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '" marker-end="url(#arrow)"></line>');
          svg.push('<text class="g-edge-label" data-rel-lbl="' + esc(r.id) + '" x="' + ((a.x + b.x) / 2) + '" y="' + ((a.y + b.y) / 2 - 4) + '" text-anchor="middle">' + esc(r.type) + "</text>");
        });

        nodes.forEach(function (n) {
          var p = pos[n.id];
          if (!p) return;
          var tone = MS.typeTone(n.type);
          svg.push('<g class="g-node" data-id="' + esc(n.id) + '" tabindex="0" role="button" aria-label="' + esc(n.name) + '">' +
            "<title>" + esc(n.name) + " · " + esc(n.type) + "</title>" +
            '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + p.r + '" fill="' + tone + '" fill-opacity="0.18" stroke="' + tone + '" stroke-width="2"></circle>' +
            '<text x="' + p.x + '" y="' + (p.y + p.r + 13) + '" text-anchor="middle">' + esc(truncate(n.name, 18)) + "</text></g>");
        });
        svg.push("</svg>");
        host.innerHTML = svg.join("");

        var lab = root.querySelector("#label-all");
        if (lab) {
          // 节点一多，标签会糊成一片：自动关掉标签，只留选中与悬停的那几个
          if (crowded) lab.checked = false;
          if (!lab.checked) {
            host.querySelectorAll(".g-node text").forEach(function (t) { t.style.display = "none"; });
          }
        }
        highlight(selectedId);
      }

      function wireGraph() {
        root.querySelector('[data-act="shuffle"]').addEventListener("click", drawGraph);
        root.querySelector("#label-all").addEventListener("change", function (e) {
          root.querySelectorAll(".g-node text").forEach(function (t) { t.style.display = e.target.checked ? "" : "none"; });
          if (!e.target.checked && selectedId) highlight(selectedId);
        });
        var host = root.querySelector("#graph-host");
        MS.on(host, "click", ".g-node", function (ev, g) { selectNode(g.getAttribute("data-id"), { scroll: true }); });
        host.addEventListener("keydown", function (e) {
          var g = e.target.closest(".g-node");
          if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); selectNode(g.getAttribute("data-id"), { scroll: true }); }
        });
        host.addEventListener("mouseover", function (e) {
          var g = e.target.closest(".g-node");
          if (g) highlight(g.getAttribute("data-id"));
        });
        host.addEventListener("mouseleave", function () { highlight(selectedId); });
      }

      function highlight(id) {
        var node = id ? state.index.byId[id] : null;
        var near = {};
        if (node) {
          near[id] = true;
          (state.index.adj[id] || []).forEach(function (e) { near[e.otherId] = true; });
        }
        root.querySelectorAll(".g-node").forEach(function (g) {
          var isNear = !node || near[g.getAttribute("data-id")];
          g.classList.toggle("dim", !!node && !isNear);
          g.classList.toggle("sel", g.getAttribute("data-id") === selectedId);
        });
        root.querySelectorAll(".g-edge").forEach(function (line) {
          var rel = byRelId(line.getAttribute("data-rel"));
          var on = !node ? true : (rel && (rel.from === id || rel.to === id));
          line.classList.toggle("hl", !!on && !!node);
          line.classList.toggle("dim", !!node && !on);
          line.setAttribute("marker-end", on && node ? "url(#arrow-hl)" : "url(#arrow)");
        });
        root.querySelectorAll(".g-edge-label").forEach(function (t) {
          var rel = byRelId(t.getAttribute("data-rel-lbl"));
          t.classList.toggle("hl", !!node && rel && (rel.from === id || rel.to === id));
        });
        // 标签被关掉时，至少让选中节点和它的一跳邻居显示名字
        var lab = root.querySelector("#label-all");
        if (lab && !lab.checked) {
          root.querySelectorAll(".g-node").forEach(function (g) {
            var gid = g.getAttribute("data-id");
            var t = g.querySelector("text");
            if (!t) return;
            t.style.display = (gid === selectedId || (node && near[gid])) ? "" : "none";
          });
        }
      }

      var relIndex = null;
      function byRelId(id) {
        if (!relIndex) {
          relIndex = {};
          state.index.relations.forEach(function (r) { relIndex[r.id] = r; });
        }
        return relIndex[id];
      }

      /* ---------------- 节点详情 ---------------- */
      function selectNode(id, opts) {
        opts = opts || {};
        var node = state.index.byId[id];
        if (!node || node._map !== mapId) return;
        selectedId = id;
        highlight(id);
        var detail = root.querySelector("#node-detail");
        detail.innerHTML = MS.renderNodeCard(state, node);
        if (opts.scroll) {
          var top = detail.getBoundingClientRect().top + window.scrollY - 84;
          window.scrollTo({ top: top, behavior: "smooth" });
        }
        if (location.hash !== "#node=" + id) history.replaceState(null, "", "#node=" + id);
      }

      function readHash() {
        var m = /node=([^&]+)/.exec(location.hash || "");
        return m ? decodeURIComponent(m[1]) : null;
      }
      function wireHash() {
        window.addEventListener("hashchange", function () {
          var id = readHash();
          if (id) selectNode(id, { scroll: true });
        });
      }

      function wireSections() {
        var host = root.querySelector("#type-sections");
        if (!host) return;
        MS.on(host, "click", "[data-tile]", function (ev, el) { selectNode(el.getAttribute("data-tile"), { scroll: true }); });
      }

      /* ---------------- 浏览路径 ---------------- */
      function wirePathWidget() {
        var host = root.querySelector("#path-widget");
        if (!host) return;
        function run() {
          var p = pickPath(state, all);
          if (!p) {
            host.innerHTML = '<p class="small muted" style="margin:0">还没有足够的关系可以串出路径。至少需要两个节点、一条连线，最好再有一条可打开的来源。</p>';
            return;
          }
          host.innerHTML =
            '<div class="path" style="margin-bottom:12px">' +
              '<span class="path-node start">' + esc(p.a.name) + "</span>" +
              '<span class="path-arrow"><span>' + esc(p.rel.label || p.rel.type) + '</span><span class="lbl">→</span></span>' +
              '<span class="path-node">' + esc(p.b.name) + "</span>" +
              '<span class="path-arrow"><span>依据</span><span class="lbl">→</span></span>' +
              '<span class="path-node end">' + esc(p.source ? p.source.title : "这条关系暂无来源") + "</span>" +
            "</div>" +
            '<p class="small" style="margin-bottom:8px">为什么这条连线成立：' + esc(p.rel.why) + "</p>" +
            '<p class="tiny muted" style="margin-bottom:12px">证据类型：' + esc(p.rel.evidence || "未标") + " · 核实状态：" + esc(p.rel.verify || "未标") + (p.rel.inferred ? " · 团队推断，未经证实" : "") + "</p>" +
            '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
              '<button class="btn btn-sm" type="button" data-go="' + esc(p.a.id) + '">看起点</button>' +
              '<button class="btn btn-sm" type="button" data-go="' + esc(p.b.id) + '">看终点</button>' +
              (p.source && p.source.url ? '<a class="btn btn-sm btn-ghost" href="' + esc(p.source.url) + '" target="_blank" rel="noopener noreferrer">打开来源 ↗</a>' : "") +
              '<button class="btn btn-sm btn-ghost" type="button" data-act="again">换一条</button>' +
            "</div>";
          host.querySelectorAll("[data-go]").forEach(function (b) {
            b.addEventListener("click", function () { selectNode(b.getAttribute("data-go"), { scroll: true }); });
          });
          var again = host.querySelector('[data-act="again"]');
          if (again) again.addEventListener("click", run);
        }
        run();
      }
    };
  }

  /* ---------------- 静态片段 ---------------- */
  function pageHeader(state, meta, nodes) {
    var withSrc = nodes.filter(function (n) {
      return (n._sourceIds || []).some(function (id) {
        var s = state.sourcesById[id];
        return s && s.url && s.verify !== "来源待补";
      });
    }).length;
    var gaps = nodes.filter(function (n) { return n.verify === "待核实" || n.verify === "来源待补"; }).length;
    return '<header class="page-head">' +
      '<p class="eyebrow">' + esc(meta.name) + "</p>" +
      "<h1>" + esc(meta.name) + "</h1>" +
      '<p class="page-q">' + esc(meta.subtitle) + "</p>" +
      '<p class="small muted" style="max-width:820px;margin-top:10px">' + esc(meta.purpose || "") + "</p>" +
      '<div class="stat-row" style="margin-top:22px">' +
        statTile(nodes.length, "本图节点") +
        statTile(withSrc + "/" + nodes.length, "有可打开来源") +
        statTile(gaps, "待核实 / 来源待补") +
      "</div>" +
      '<p class="tiny muted" style="margin-top:12px">负责人：' + esc(meta.owner || "待指定") + " · 数据更新：" + esc(meta.updated || "—") + "</p>" +
      "</header>";
  }
  function statTile(v, label) { return '<div class="stat"><b>' + esc(v) + "</b><span>" + esc(label) + "</span></div>"; }

  function noNodes(meta, mapId) {
    return MS.emptyState({
      icon: "◌",
      title: meta.name + "还没有节点",
      desc: "结构已经就绪：这个数据表里一有节点，关系图、节点卡、筛选和 AI 能力就会自动出现。内容由地图负责人按固定字段提交，不需要改代码。",
      actions: '<a class="btn btn-sm btn-primary" href="docs/01-节点字段契约.md">看字段契约</a>' +
        '<a class="btn btn-sm" href="data/' + mapId + '.json">看数据文件</a>'
    });
  }

  function toolbarHtml(nodes) {
    var types = E.uniq(nodes.map(function (n) { return n.type; }));
    var unders = E.uniq(nodes.map(function (n) { return n.understanding; }));
    return '<div class="toolbar">' +
      '<div class="search"><input type="search" id="map-search" placeholder="搜索节点名、标签或说明…" aria-label="搜索节点"></div>' +
      '<div class="chip-row" id="type-chips">' + types.map(function (t) {
        return '<button class="chip" type="button" data-type="' + esc(t) + '" aria-pressed="false">' +
          '<i style="width:8px;height:8px;border-radius:50%;background:' + MS.typeTone(t) + ';display:inline-block"></i>' + esc(t) + "</button>";
      }).join("") + "</div>" +
      '<div class="chip-row" id="under-chips">' + unders.map(function (u) {
        return '<button class="chip" type="button" data-under="' + esc(u) + '" aria-pressed="false">' + esc(u) + "</button>";
      }).join("") + "</div>" +
      '<label class="chip" style="cursor:pointer;gap:6px"><input type="checkbox" id="only-gap"> 只看待核实</label>' +
      '<button class="btn btn-sm btn-ghost" type="button" id="reset-filters">重置</button>' +
      "</div>";
  }

  function legendHtml(types) {
    return '<div class="legend">' + types.map(function (t) {
      return '<span><i style="background:' + MS.typeTone(t) + '"></i>' + esc(t) + "</span>";
    }).join("") + "</div>";
  }

  function pathWidgetHtml() {
    return '<section class="section-block" id="path" style="padding-bottom:0">' +
      '<div class="section-head"><div><h2>先走一条路径：节点 → 关系 → 来源</h2>' +
      "<p>验收要求「至少一条节点→关系→来源的浏览路径可走通」。这里每次自动挑一条真实存在的连线，并给出它的依据与核实状态。</p></div></div>" +
      '<div class="panel" id="path-widget"></div></section>';
  }

  function sectionsHtml(nodes, order) {
    var groups = order.filter(function (t) { return nodes.some(function (n) { return n.type === t; }); });
    return '<section class="section-block" id="sections">' +
      '<div class="section-head"><div><h2>按类型浏览</h2>' +
      "<p>同一批节点换一种入口看。点任意一块会跳到节点卡，图形和卡片会同步高亮。</p></div>" +
      '<span class="small muted">共 ' + nodes.length + " 个节点 · " + groups.length + " 类</span></div>" +
      '<div id="type-sections">' + groups.map(function (t) {
        var list = nodes.filter(function (n) { return n.type === t; });
        return '<div class="type-group" id="section-' + encodeURIComponent(t) + '">' +
          '<div class="type-group-head">' + MS.typeBadge(t) + "<h3>" + esc(t) + '</h3><span class="count">' + list.length + " 个</span></div>" +
          '<div class="node-grid">' + list.map(function (n) {
            return '<button class="node-tile" type="button" data-tile="' + esc(n.id) + '">' +
              '<span class="t-name">' + esc(n.name) + "</span>" +
              '<span class="t-sum">' + esc(n.summary) + "</span>" +
              '<span class="t-foot">' + MS.underBadge(n) + MS.verifyBadge(n.verify) +
                ((n.flags || []).length ? '<span class="flag">⚑ ' + esc(n.flags[0]) + "</span>" : "") +
              "</span></button>";
          }).join("") + "</div></div>";
      }).join("") + "</div></section>";
  }

  /* ---------------- 辅助 ---------------- */
  function pickStart(state, nodes) {
    return nodes.slice().sort(function (a, b) {
      return (state.index.adj[b.id] || []).length - (state.index.adj[a.id] || []).length;
    })[0] || nodes[0];
  }

  function pickPath(state, nodes) {
    var ranked = nodes.slice().sort(function (a, b) {
      return (state.index.adj[b.id] || []).length - (state.index.adj[a.id] || []).length;
    });
    var fallback = null;
    ranked.forEach(function (n) {
      E.neighbors(state.index, n.id).forEach(function (e) {
        if (!e.node) return;
        var src = (e.rel.sourceIds || []).map(function (id) { return state.sourcesById[id]; })
          .filter(function (s) { return s && s.url; })[0];
        if (src && !fallback) fallback = { a: n, b: e.node, rel: e.rel, source: src };
      });
    });
    if (fallback) return fallback;
    for (var i = 0; i < ranked.length; i++) {
      var e = E.neighbors(state.index, ranked[i].id)[0];
      if (e && e.node) return { a: ranked[i], b: e.node, rel: e.rel, source: null };
    }
    return null;
  }

  MS.pages.domain = makePage("domain");
  MS.pages.ecosystem = makePage("ecosystem");
  MS.pages.cognitive = makePage("cognitive");
})(window.MS = window.MS || {});
