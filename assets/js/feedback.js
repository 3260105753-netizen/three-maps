/* ============================================================
   反馈与建议页：提交说明 + 反馈列表 + 筛选 + 处理状态
   ------------------------------------------------------------
   本站是静态站点（GitHub Pages + 纯 JSON），没有后端数据库，
   因此页面里不提供「直接提交并写入服务器」的表单。
   课程要求：无法实现共享提交时要如实说明，不能用不能共享的表单冒充。
   ============================================================ */
(function (MS) {
  "use strict";
  var esc = MS.esc;

  var MAP_LABEL = { domain: "领域地图", ecosystem: "生态地图", cognitive: "认知地图", site: "全站" };
  var STATUS = ["待处理", "处理中", "已处理"];

  function statusTone(s) {
    if (s === "已处理") return "var(--accent)";
    if (s === "处理中") return "var(--blue)";
    return "var(--amber)";
  }

  MS.pages.feedback = function render(state, root) {
    var f = state.feedback || {};
    var items = (f.items || []).slice().sort(function (a, b) {
      return String(b.time || "").localeCompare(String(a.time || ""));
    });
    var g = f.guideline || {};
    var issueUrl = "https://github.com/3260105753-netizen/three-maps/issues/new";

    /* 从条目详情点「对此内容提反馈」过来时，带上地图与条目 */
    var qp = new URLSearchParams(location.search);
    var qmap = qp.get("map") || "";
    var qnode = qp.get("node") || "";
    var qobj = (state.index && state.index.byId && qnode) ? state.index.byId[qnode] : null;
    var targetBlock = "";
    if (qnode || qmap) {
      var tName = qobj ? qobj.name : qnode;
      var tMap = MAP_LABEL[qmap] || "全站";
      targetBlock =
        '<div class="panel" style="border-color:rgba(251,191,36,.45);margin-bottom:14px">' +
          '<h3 style="margin-top:0">你正在对「' + esc(tName) + '」提反馈</h3>' +
          '<p class="small muted">反馈对象：' + esc(tMap) + (qnode ? " · " + esc(qnode) : "") +
            "。可以把下面这段复制下来、补上你的意见，再按上面的任一方式发给我们。</p>" +
          '<pre class="tiny" style="white-space:pre-wrap;margin:10px 0 0">反馈对象：' + esc(tMap) +
            (qnode ? " · " + esc(tName) + "（" + esc(qnode) + "）" : "") +
            "\n我看到的问题：" + "\n为什么觉得有问题：" + "\n建议改成：</pre>" +
        "</div>";
    }

    root.innerHTML =
      '<div class="wrap">' +
        '<header class="page-head">' +
          '<p class="eyebrow">反馈与建议</p>' +
          "<h1>别人怎么看这个网站</h1>" +
          '<p class="page-q">这一页记录非本组同学提出的问题、我们的核实过程与处理结果。' +
            '没有采纳的也会保留，并写明理由——把问题删掉只会让网站看起来「没问题」。</p>' +
          '<div class="stat-row" style="margin-top:22px">' +
            '<div class="stat"><b>' + items.length + "</b><span>条反馈</span></div>" +
            '<div class="stat"><b>' + items.filter(function (x) { return x.status === "已处理"; }).length + "</b><span>已处理</span></div>" +
            '<div class="stat"><b>' + items.filter(function (x) { return x.status !== "已处理"; }).length + "</b><span>待处理 / 处理中</span></div>" +
            '<div class="stat"><b>' + esc((state.config.site || {}).version || "—") + "</b><span>当前版本</span></div>" +
          "</div>" +
        "</header>" +

        /* ---------- 提交说明 ---------- */
        '<section class="section-block" style="padding-top:0">' +
          '<div class="section-head"><div>' +
            "<h2>怎么提交反馈</h2>" +
            "<p>先说清楚一件事：本站是静态站点，没有后端数据库，" +
              "所以<strong>页面里没有能直接提交的输入框</strong>——放一个点了没反应的按钮，比不放更糟。</p>" +
          "</div></div>" +

          targetBlock +

          '<div class="panel" style="border-color:rgba(94,234,212,.35)">' +
            '<h3 style="margin-top:0">以下三种方式都能送到我们手上</h3>' +
            '<ol class="small" style="margin:10px 0 0;padding-left:20px;line-height:1.9">' +
              "<li><strong>在课程群里直接说</strong>：写明「哪一页、哪个条目、哪里有问题」，最好附上你期望的样子。</li>" +
              "<li><strong>提交一个 GitHub Issue</strong>：" +
                '<a href="' + issueUrl + '" target="_blank" rel="noopener">新建 Issue</a>' +
                "（需要 GitHub 账号，公开可见）。</li>" +
              "<li><strong>课堂上当面提</strong>：我们用纸笔记下，事后照样录进这一页。</li>" +
            "</ol>" +
            '<p class="tiny muted" style="margin-top:12px">我们收到后 3 日内：核实 → 决定改或不改 → 在这里回一条，并写清理由。' +
              "不采纳的也留档，不会因为不好看就删掉。</p>" +
          "</div>" +

          (g.threeTasks && g.threeTasks.length
            ? '<div class="panel" style="margin-top:14px">' +
                '<h3 style="margin-top:0">写什么最有用</h3>' +
                '<p class="small muted">「挺好的」「有点难」不算反馈，落到具体条目、关系、例子或来源才有用。' +
                  "第一次看的话，这三件事最值得挑：</p>" +
                '<ul class="small" style="margin:10px 0 0;padding-left:20px;line-height:1.9">' +
                  g.threeTasks.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") +
                "</ul>" +
                (g.avoid && g.avoid.length
                  ? '<p class="tiny muted" style="margin-top:10px">注意：' + esc(g.avoid[0]) + "</p>"
                  : "") +
              "</div>"
            : "") +
        "</section>" +

        /* ---------- 反馈列表 ---------- */
        '<section class="section-block">' +
          '<div class="section-head"><div>' +
            "<h2>收到的反馈与处理结果</h2>" +
            "<p>编号、提交时间由我们收到后统一登记；昵称由反馈人自填，不作为身份依据。</p>" +
          "</div></div>" +

          '<div class="toolbar">' +
            '<span class="small muted">按地图筛选：</span>' +
            '<div class="chip-row" id="map-filter">' +
              '<button class="chip" type="button" data-m="all" aria-pressed="true">全部</button>' +
              Object.keys(MAP_LABEL).map(function (k) {
                return '<button class="chip" type="button" data-m="' + k + '" aria-pressed="false">' + esc(MAP_LABEL[k]) + "</button>";
              }).join("") +
            "</div>" +
            '<span class="small muted" style="margin-left:8px">按状态：</span>' +
            '<div class="chip-row" id="status-filter">' +
              '<button class="chip" type="button" data-s="all" aria-pressed="true">全部</button>' +
              STATUS.map(function (s) {
                return '<button class="chip" type="button" data-s="' + esc(s) + '" aria-pressed="false">' + esc(s) + "</button>";
              }).join("") +
            "</div>" +
          "</div>" +

          '<div id="fb-host" style="margin-top:16px"></div>' +
        "</section>" +
      "</div>";

    /* ---------- 列表渲染（含三态） ---------- */
    var host = root.querySelector("#fb-host");
    var mapSel = "all", statusSel = "all";

    function paint() {
      if (!items.length) {
        host.innerHTML = MS.emptyState({
          icon: "✉",
          title: "还没有收到反馈",
          desc: "这不是「没有问题」，而是「还没人来测」。中期之后我们会请至少 3 位非本组同学独立试用，" +
                "收到的每一条都会出现在这里，包括不采纳的。"
        });
        return;
      }
      var list = items.filter(function (x) {
        return (mapSel === "all" || x.map === mapSel) && (statusSel === "all" || x.status === statusSel);
      });
      if (!list.length) {
        host.innerHTML = MS.emptyState({ icon: "◷", title: "这个筛选下没有记录", desc: "换一个筛选条件试试。" });
        return;
      }
      host.innerHTML = '<ul class="timeline">' + list.map(function (x) {
        return '<li class="tl-item" id="fb-' + esc(x.id) + '" style="--tone:' + statusTone(x.status) + '">' +
          '<div class="tl-head">' +
            '<span class="badge plain">' + esc(x.id) + "</span>" +
            '<span class="badge ver">' + esc(x.status) + "</span>" +
            '<span class="tl-date">' + esc(x.time || "") + "</span>" +
            '<span class="small muted">' + esc(MAP_LABEL[x.map] || x.map || "全站") +
              (x.node ? " · " + esc(x.node) : "") + "</span>" +
            '<span class="small muted">' + esc(x.type || "") + "</span>" +
          "</div>" +
          '<p class="tl-what">' + esc(x.content || "") + "</p>" +
          (x.from ? '<p class="tl-basis">来自：' + esc(x.from) + "</p>" : "") +
          (x.link ? '<p class="tl-basis">参考：<a href="' + esc(x.link) + '" target="_blank" rel="noopener">' + esc(x.link) + "</a></p>" : "") +
          (x.reply ? '<p class="tl-why">我们的回应：' + esc(x.reply) + "</p>" : '<p class="tl-why">我们的回应：待补充</p>') +
          (x.result ? '<p class="tl-basis">处理结果：' + esc(x.result) + "</p>" : "") +
          (x.version ? '<p class="tl-basis">对应版本：' + esc(x.version) + "</p>" : "") +
          "</li>";
      }).join("") + "</ul>";
    }

    function wire(sel, attr, onPick) {
      var box = root.querySelector(sel);
      if (!box) return;
      box.addEventListener("click", function (ev) {
        var b = ev.target.closest("button[" + attr + "]");
        if (!b) return;
        box.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
        onPick(b.getAttribute(attr));
        paint();
      });
    }
    wire("#map-filter", "data-m", function (v) { mapSel = v; });
    wire("#status-filter", "data-s", function (v) { statusSel = v; });

    paint();

    // 从更新记录里 #fb-xxx 跳过来时，滚动定位
    var hash = (location.hash || "").replace(/^#/, "");
    if (hash && hash.indexOf("fb-") === 0) {
      var el = document.getElementById(hash);
      if (el) el.scrollIntoView({ block: "center" });
    }
  };
})(window.MS);
