/* ============================================================
   引擎层（纯函数，无 DOM 依赖）
   浏览器里挂在 window.MS.engine；Node 里可 require 用于测试。
   所有 AI 能力的答案都在这一层算出来，UI 只负责展示。
   ============================================================ */
(function (root, factory) {
  var api = factory();
  root.MS = root.MS || {};
  root.MS.engine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* ---------- 小工具 ---------- */
  function norm(s) {
    return String(s == null ? "" : s)
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[（(].*?[）)]/g, "")
      .trim();
  }

  function uniq(arr) {
    var seen = Object.create(null), out = [];
    arr.forEach(function (x) {
      if (x == null) return;
      var k = typeof x === "object" ? JSON.stringify(x) : String(x);
      if (!seen[k]) { seen[k] = 1; out.push(x); }
    });
    return out;
  }

  var UNDER_WEIGHT = { "已初步理解": 2, "已经尝试": 3, "待深入学习": 1 };

  /* ---------- 建索引 ---------- */
  function buildIndex(payload) {
    var cfg = payload.config || {};
    var srcList = (payload.sources && payload.sources.sources) || [];
    var sourcesById = Object.create(null);
    srcList.forEach(function (s) { sourcesById[s.id] = s; });

    var maps = {};
    var nodes = [];
    var byId = Object.create(null);

    (payload.maps || []).forEach(function (file) {
      if (!file || !file.map) return;
      var meta = file.map;
      maps[meta.id] = { meta: meta, nodes: file.nodes || [] };
      (file.nodes || []).forEach(function (n) {
        var node = Object.assign({}, n);
        node._map = meta.id;
        node._mapName = meta.name;
        node._sourceIds = (n.sourceIds || []).slice();
        nodes.push(node);
        byId[node.id] = node;
      });
    });

    var relations = [];
    var adj = Object.create(null);
    function touch(id) { if (!adj[id]) adj[id] = []; }

    ((payload.relations && payload.relations.relations) || []).forEach(function (r) {
      var a = byId[r.from], b = byId[r.to];
      if (!a || !b) return; // 悬空关系由校验脚本报错，这里安静跳过
      var rel = Object.assign({}, r);
      rel._from = a; rel._to = b;
      relations.push(rel);
      touch(r.from); touch(r.to);
      adj[r.from].push({ rel: rel, otherId: r.to, dir: "out" });
      adj[r.to].push({ rel: rel, otherId: r.from, dir: "in" });
    });

    var routes = ((payload.routes && payload.routes.routes) || []).slice();

    return {
      config: cfg,
      maps: maps,
      mapList: Object.keys(maps).map(function (k) { return maps[k]; }),
      nodes: nodes,
      byId: byId,
      relations: relations,
      adj: adj,
      sources: srcList,
      sourcesById: sourcesById,
      routes: routes,
      seedMode: nodes.length > 0 && nodes.every(function (n) { return n.seed; })
    };
  }

  /* ---------- 检索 ---------- */
  function search(index, query, opts) {
    opts = opts || {};
    var q = norm(query);
    if (!q) return [];
    var scored = [];
    index.nodes.forEach(function (n) {
      var name = norm(n.name), score = 0;
      if (name === q) score = 120;
      else if (name.indexOf(q) === 0) score = 90;
      else if (name.indexOf(q) > 0) score = 70;
      if (norm(n.id) === q) score = Math.max(score, 110);
      if (score === 0 && norm(n.id).indexOf(q) >= 0) score = 40;
      if (score === 0 && (n.tags || []).some(function (t) { return norm(t).indexOf(q) >= 0; })) score = 34;
      if (score === 0 && norm(n.type).indexOf(q) >= 0) score = 24;
      if (score === 0 && norm(n.summary).indexOf(q) >= 0) score = 18;
      if (score === 0 && norm(n.detail).indexOf(q) >= 0) score = 12;
      if (score > 0) {
        if (n.seed) score -= 6;
        scored.push({ node: n, score: score });
      }
    });
    scored.sort(function (a, b) { return b.score - a.score || a.node.name.localeCompare(b.node.name, "zh"); });
    var out = scored.map(function (s) { return s.node; });
    return opts.limit ? out.slice(0, opts.limit) : out;
  }

  function getNode(index, id) { return index.byId[id] || null; }

  function neighbors(index, id) {
    return (index.adj[id] || []).map(function (e) {
      return { rel: e.rel, node: index.byId[e.otherId], dir: e.dir };
    }).filter(function (e) { return e.node; });
  }

  /* ---------- 最短关系链 ---------- */
  // 用 Dijkstra，代价以「跳数」为主，把「推断/待核实」作为极小的次级代价，
  // 因此仍然优先最短，只在长度相同时偏向证据更硬的路径。
  function shortestPath(index, fromId, toId, maxHops) {
    maxHops = maxHops || 6;
    if (!index.byId[fromId] || !index.byId[toId]) return null;
    if (fromId === toId) return { nodes: [index.byId[fromId]], edges: [] };

    var dist = Object.create(null), prev = Object.create(null), visited = Object.create(null);
    dist[fromId] = 0;
    var queue = [fromId];

    function edgeCost(rel) {
      return 1 + (rel.inferred ? 0.06 : 0) + (rel.verify === "待核实" ? 0.03 : 0) + (rel.verify === "来源待补" ? 0.05 : 0);
    }

    while (queue.length) {
      queue.sort(function (a, b) { return dist[a] - dist[b]; });
      var cur = queue.shift();
      if (visited[cur]) continue;
      visited[cur] = true;
      if (cur === toId) break;

      var edges = index.adj[cur] || [];
      for (var i = 0; i < edges.length; i++) {
        var e = edges[i];
        if (visited[e.otherId]) continue;
        var nd = dist[cur] + edgeCost(e.rel);
        if (dist[e.otherId] == null || nd < dist[e.otherId]) {
          var hops = (prev[cur] ? prev[cur].hops : 0) + 1;
          if (hops > maxHops) continue;
          dist[e.otherId] = nd;
          prev[e.otherId] = { from: cur, rel: e.rel, dir: e.dir, hops: hops };
          queue.push(e.otherId);
        }
      }
    }

    if (dist[toId] == null) return null;

    var chainIds = [toId], chainEdges = [];
    var cursor = toId, guard = 0;
    while (cursor !== fromId && guard++ < 32) {
      var p = prev[cursor];
      if (!p) break;
      chainEdges.unshift({ rel: p.rel, from: p.from, to: cursor, dir: p.dir });
      chainIds.unshift(p.from);
      cursor = p.from;
    }

    return {
      nodes: chainIds.map(function (id) { return index.byId[id]; }),
      edges: chainEdges,
      hops: chainEdges.length
    };
  }

  /* ---------- 引用收集（每个答案都必须带） ---------- */
  function citations(index, ids) {
    var idList = uniq(ids).filter(function (id) { return !!index.byId[id]; });
    var nodes = idList.map(function (id) {
      var n = index.byId[id];
      return {
        id: n.id, name: n.name, map: n._map, mapName: n._mapName,
        type: n.type, understanding: n.understanding, verify: n.verify
      };
    });

    var srcIds = [];
    idList.forEach(function (id) { srcIds = srcIds.concat(index.byId[id]._sourceIds || []); });

    var sources = [], missing = [];
    uniq(srcIds).forEach(function (sid) {
      var s = index.sourcesById[sid];
      if (!s) { missing.push(sid); return; }
      if (!s.url || s.verify === "来源待补") { missing.push(sid); return; }
      sources.push(s);
    });

    var counts = { "已初步理解": 0, "已经尝试": 0, "待深入学习": 0 };
    nodes.forEach(function (n) { if (counts[n.understanding] != null) counts[n.understanding]++; });

    var weakest = nodes.slice().sort(function (a, b) {
      return (UNDER_WEIGHT[a.understanding] || 0) - (UNDER_WEIGHT[b.understanding] || 0);
    }).slice(0, 3);

    return {
      nodes: nodes,
      sources: sources,
      gapSources: uniq(missing).map(function (sid) { return index.sourcesById[sid] || { id: sid, title: "未登记的来源编号：" + sid, url: "" }; }),
      understanding: counts,
      weakest: weakest
    };
  }

  /* ---------- AI 能力 1：概念 → 课程与学习基础 ---------- */
  function queryCourses(index, query) {
    var hits = search(index, query, { limit: 5 });
    if (!hits.length) {
      var tags = uniq(index.nodes.reduce(function (acc, n) { return acc.concat(n.tags || []); }, [])).slice(0, 12);
      return { found: false, query: query, suggestions: tags, nodeCount: index.nodes.length };
    }

    var node = hits[0];
    var rels = neighbors(index, node.id);
    var courses = [], prereqs = [], tools = [], related = [];

    rels.forEach(function (e) {
      var t = e.node.type;
      if (t === "课程" && e.dir === "in" && e.rel.type === "前置") {
        courses.push({ node: e.node, rel: e.rel });
      } else if (e.rel.type === "前置" && e.dir === "in") {
        prereqs.push({ node: e.node, rel: e.rel });
      } else if (t === "软件" || t === "模型") {
        tools.push({ node: e.node, rel: e.rel });
      } else if (e.rel.type === "依赖" || e.rel.type === "包含" || e.rel.type === "采用") {
        prereqs.push({ node: e.node, rel: e.rel });
      } else {
        related.push({ node: e.node, rel: e.rel });
      }
    });

    // 课程还可能挂在「工具」上（例如某门课是某个框架的前置）
    tools.slice().forEach(function (t) {
      neighbors(index, t.node.id).forEach(function (e) {
        if (e.node.type === "课程" && e.dir === "in" && e.rel.type === "前置") {
          if (!courses.some(function (c) { return c.node.id === e.node.id; })) {
            courses.push({ node: e.node, rel: e.rel, viaTool: t.node });
          }
        }
      });
    });

    var ids = [node.id].concat(courses.map(function (c) { return c.node.id; }))
      .concat(prereqs.map(function (p) { return p.node.id; }))
      .concat(tools.map(function (t) { return t.node.id; }))
      .concat(related.map(function (r) { return r.node.id; }));

    return {
      found: true,
      query: query,
      node: node,
      alternatives: hits.slice(1),
      courses: courses.slice(0, 8),
      prereqs: prereqs.slice(0, 8),
      tools: tools.slice(0, 8),
      related: related.slice(0, 6),
      citations: citations(index, ids)
    };
  }

  /* ---------- AI 能力 2：两点之间的关系链 ---------- */
  function explainRelation(index, fromId, toId) {
    var a = getNode(index, fromId), b = getNode(index, toId);
    if (!a || !b) return { found: false, reason: "missing", a: a, b: b };

    var direct = neighbors(index, fromId).filter(function (e) { return e.node.id === toId; });
    var path = shortestPath(index, fromId, toId, 6);

    if (!direct.length && !path) {
      return { found: false, reason: "disconnected", a: a, b: b };
    }

    var ids = [a.id, b.id].concat((path ? path.nodes : []).map(function (n) { return n.id; }));
    return {
      found: true,
      a: a, b: b,
      direct: direct,
      path: path,
      citations: citations(index, uniq(ids))
    };
  }

  /* ---------- AI 能力 3：两条技术路线比较 ---------- */
  function compareRoutes(index, idA, idB) {
    var A = index.routes.filter(function (r) { return r.id === idA; })[0];
    var B = index.routes.filter(function (r) { return r.id === idB; })[0];
    if (!A || !B) return { found: false, reason: "missing" };
    if (A.id === B.id) return { found: false, reason: "same" };

    function nodesOf(route) {
      return (route.nodes || []).map(function (id) { return index.byId[id]; }).filter(Boolean);
    }
    function ecoOf(route) {
      return (route.ecosystem || []).map(function (id) { return index.byId[id]; }).filter(Boolean);
    }
    function idsOf(list) { return list.map(function (n) { return n.id; }); }

    var na = nodesOf(A), nb = nodesOf(B);
    var ia = idsOf(na), ib = idsOf(nb);
    var shared = na.filter(function (n) { return ib.indexOf(n.id) >= 0; });
    var onlyA = na.filter(function (n) { return ib.indexOf(n.id) < 0; });
    var onlyB = nb.filter(function (n) { return ia.indexOf(n.id) < 0; });

    var ea = ecoOf(A), eb = ecoOf(B);
    var ecoIdsA = idsOf(ea), ecoIdsB = idsOf(eb);

    function groupByType(list) {
      var g = {};
      list.forEach(function (n) { (g[n.type] = g[n.type] || []).push(n); });
      return g;
    }

    var all = na.concat(nb);
    var weak = all.filter(function (n) { return n.understanding === "待深入学习"; });
    var noSource = all.filter(function (n) {
      return !(n._sourceIds || []).some(function (sid) {
        var s = index.sourcesById[sid];
        return s && s.url && s.verify !== "来源待补";
      });
    });

    var ids = uniq(ia.concat(ib).concat(ecoIdsA).concat(ecoIdsB));
    return {
      found: true,
      a: A, b: B,
      nodesA: na, nodesB: nb,
      shared: shared,
      onlyA: onlyA,
      onlyB: onlyB,
      ecoShared: ea.filter(function (n) { return ecoIdsB.indexOf(n.id) >= 0; }),
      ecoOnlyA: ea.filter(function (n) { return ecoIdsB.indexOf(n.id) < 0; }),
      ecoOnlyB: eb.filter(function (n) { return ecoIdsA.indexOf(n.id) < 0; }),
      groupA: groupByType(na), groupB: groupByType(nb),
      sharedTypes: Object.keys(groupByType(shared)),
      weak: weak,
      noSource: noSource,
      citations: citations(index, ids)
    };
  }

  /* ---------- 关系图布局（确定性力导向） ---------- */
  function computeLayout(nodes, edges, opts) {
    opts = opts || {};
    var W = opts.width || 900, H = opts.height || 560;
    var pad = opts.padding || 78;
    var iterations = opts.iterations || 320;
    var n = nodes.length;
    var positions = Object.create(null);
    if (!n) return { positions: positions, width: W, height: H };

    var types = uniq(nodes.map(function (x) { return x.type; }));
    var cx = W / 2, cy = H / 2;
    var baseR = Math.min(W, H) * 0.3;

    // 初始：按类型分扇区，同类型沿半径散开
    nodes.forEach(function (node, i) {
      var typeIdx = Math.max(0, types.indexOf(node.type));
      var sector = (typeIdx / Math.max(1, types.length)) * Math.PI * 2;
      var jitter = (i % 5) * 0.16;
      var r = baseR * (0.62 + ((i * 7) % 9) / 22);
      var a = sector + jitter;
      positions[node.id] = {
        x: cx + Math.cos(a) * r,
        y: cy + Math.sin(a) * r,
        vx: 0, vy: 0,
        type: node.type,
        degree: 0
      };
    });

    var links = edges.filter(function (e) {
      return positions[e.from] && positions[e.to] && e.from !== e.to;
    });
    links.forEach(function (e) {
      positions[e.from].degree++;
      positions[e.to].degree++;
    });

    var ids = nodes.map(function (x) { return x.id; });
    var kl = opts.linkLength || Math.max(66, Math.min(120, 900 / Math.max(4, n)));
    var clusterCenters = Object.create(null);
    types.forEach(function (t, i) {
      var a = (i / Math.max(1, types.length)) * Math.PI * 2;
      clusterCenters[t] = { x: cx + Math.cos(a) * baseR * 0.72, y: cy + Math.sin(a) * baseR * 0.72 };
    });

    // 节点很少时用力导向会显得松散，直接用圆环更清楚
    if (n <= 6) {
      var ringR = Math.min(W, H) * 0.31;
      ids.forEach(function (id, i) {
        var ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        positions[id].x = cx + Math.cos(ang) * ringR;
        positions[id].y = cy + Math.sin(ang) * ringR;
      });
    }

    for (var iter = 0; n > 6 && iter < iterations; iter++) {
      var alpha = 1 - iter / iterations;
      // 斥力
      for (var i = 0; i < n; i++) {
        var a1 = positions[ids[i]];
        for (var j = i + 1; j < n; j++) {
          var b1 = positions[ids[j]];
          var dx = b1.x - a1.x, dy = b1.y - a1.y;
          var d2 = dx * dx + dy * dy || 0.01;
          var d = Math.sqrt(d2);
          if (d > 460) continue;
          // 斥力随节点数增强，否则节点一多就会缩成一团
          var f = (2600 * (1 + n / 8) * alpha) / d2;
          var ux = dx / d, uy = dy / d;
          a1.vx -= ux * f; a1.vy -= uy * f;
          b1.vx += ux * f; b1.vy += uy * f;
        }
      }
      // 弹簧
      links.forEach(function (e) {
        var a1 = positions[e.from], b1 = positions[e.to];
        var dx = b1.x - a1.x, dy = b1.y - a1.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        var f = (d - kl) * 0.012 * alpha;
        var ux = dx / d, uy = dy / d;
        a1.vx += ux * f; a1.vy += uy * f;
        b1.vx -= ux * f; b1.vy -= uy * f;
      });
      // 向中心与同类型聚类靠拢
      ids.forEach(function (id) {
        var p = positions[id];
        var c = clusterCenters[p.type] || { x: cx, y: cy };
        p.vx += (c.x - p.x) * 0.0045 * alpha + (cx - p.x) * 0.0022 * alpha;
        p.vy += (c.y - p.y) * 0.0045 * alpha + (cy - p.y) * 0.0022 * alpha;
      });
      // 位移
      ids.forEach(function (id) {
        var p = positions[id];
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.82; p.vy *= 0.82;
      });
    }

    // 密度归一：不管图里有多少节点，都让"最近邻距离"接近 46px。
    // 直接按包围盒缩放会让 32 个节点挤成一团、4 个节点撑满一屏，
    // 按密度归一才是稳定的做法。
    var meanX = 0, meanY = 0;
    ids.forEach(function (id) { meanX += positions[id].x; meanY += positions[id].y; });
    meanX /= n; meanY /= n;

    if (n > 1) {
      var nn = [];
      ids.forEach(function (id) {
        var p = positions[id], best = Infinity;
        ids.forEach(function (oid) {
          if (oid === id) return;
          var q = positions[oid];
          var dd = Math.sqrt((p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y));
          if (dd < best) best = dd;
        });
        if (isFinite(best)) nn.push(best);
      });
      nn.sort(function (a, b) { return a - b; });
      var med = nn[Math.floor(nn.length / 2)] || 1;
      // 目标间距跟着画布面积与节点数走：节点少就拉开，节点多就收紧
      var targetGap = Math.max(34, Math.min(110, 0.6 * Math.sqrt(((W - pad * 2) * (H - pad * 2)) / n)));
      var dens = Math.max(0.35, Math.min(6, targetGap / med));
      ids.forEach(function (id) {
        var p = positions[id];
        p.x = meanX + (p.x - meanX) * dens;
        p.y = meanY + (p.y - meanY) * dens;
      });
    }

    // 适配画布：只缩不放，避免把小图放大成一团
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    ids.forEach(function (id) {
      var p = positions[id];
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });
    var spanX = Math.max(1, maxX - minX), spanY = Math.max(1, maxY - minY);
    var fit = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanY, 1);
    var offX = (W - spanX * fit) / 2 - minX * fit;
    var offY = (H - spanY * fit) / 2 - minY * fit;

    ids.forEach(function (id) {
      var p = positions[id];
      p.x = Math.round((p.x * fit + offX) * 10) / 10;
      p.y = Math.round((p.y * fit + offY) * 10) / 10;
      // 极端情况下把跑出画布的节点拉回来
      p.x = Math.max(18, Math.min(W - 18, p.x));
      p.y = Math.max(18, Math.min(H - 18, p.y));
      p.r = 7 + Math.min(9, Math.sqrt(p.degree || 0) * 3.4);
      delete p.vx; delete p.vy;
    });

    // 把实际占用的范围也返回，页面据此收紧 viewBox，避免大片空白
    var bx1 = Infinity, bx2 = -Infinity, by1 = Infinity, by2 = -Infinity;
    ids.forEach(function (id) {
      var p = positions[id];
      bx1 = Math.min(bx1, p.x); bx2 = Math.max(bx2, p.x);
      by1 = Math.min(by1, p.y); by2 = Math.max(by2, p.y);
    });

    return {
      positions: positions,
      width: W,
      height: H,
      bbox: { minX: bx1, minY: by1, maxX: bx2, maxY: by2 }
    };
  }

  /* ---------- 统计 ---------- */
  function stats(index) {
    var withSources = 0, gap = 0, inferred = 0, weak = 0;
    index.nodes.forEach(function (n) {
      var good = (n._sourceIds || []).filter(function (id) {
        var s = index.sourcesById[id];
        return s && s.url && s.verify !== "来源待补";
      });
      if (good.length) withSources++; else gap++;
      if (n.verify === "待核实" || n.verify === "来源待补") weak++;
    });
    index.relations.forEach(function (r) { if (r.inferred) inferred++; });
    return {
      nodes: index.nodes.length,
      relations: index.relations.length,
      sources: index.sources.length,
      withSources: withSources,
      noSource: gap,
      unverified: weak,
      inferred: inferred,
      courses: index.nodes.filter(function (n) { return n.type === "课程"; }).length,
      understanding: index.nodes.reduce(function (acc, n) {
        acc[n.understanding] = (acc[n.understanding] || 0) + 1; return acc;
      }, {}),
      routes: index.routes.length
    };
  }

  return {
    buildIndex: buildIndex,
    search: search,
    getNode: getNode,
    neighbors: neighbors,
    shortestPath: shortestPath,
    citations: citations,
    queryCourses: queryCourses,
    explainRelation: explainRelation,
    compareRoutes: compareRoutes,
    computeLayout: computeLayout,
    stats: stats,
    norm: norm,
    uniq: uniq,
    UNDER_WEIGHT: UNDER_WEIGHT
  };
});
