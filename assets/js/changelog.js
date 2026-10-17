/* ============================================================
   更新记录页：改动时间线 + 反馈入口 + 反馈处理表
   ============================================================ */
(function (MS) {
  "use strict";
  var esc = MS.esc;

  MS.pages.changelog = function render(state, root) {
    var entries = (state.changelog.entries || []).slice().sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id));
    });
    var types = MS.engine.uniq(entries.map(function (e) { return e.type; }));

    root.innerHTML =
      '<div class="wrap">' +
        '<header class="page-head">' +
          '<p class="eyebrow">更新记录</p>' +
          "<h1>改了什么、为什么改</h1>" +
          '<p class="page-q">课程要求「重要更新记录：日期、更新对象、依据、修改内容及原因」。所以每条记录都有这五项，缺一项就算没写。反馈处理也在这一页：同学提出什么 → 我们怎样核实 → 修改了什么 → 为什么调整或保留原判断。</p>' +
          '<div class="stat-row" style="margin-top:22px">' +
            '<div class="stat"><b>' + entries.length + "</b><span>条更新记录</span></div>" +
            '<div class="stat"><b>' + (state.feedback.items || []).length + "</b><span>条非本组反馈</span></div>" +
            '<div class="stat"><b>' + (state.feedback.items || []).filter(function (f) { return f.result; }).length + "</b><span>已落地修改</span></div>" +
            '<div class="stat"><b>' + esc((state.config.site || {}).version || "—") + "</b><span>当前版本</span></div>" +
          "</div>" +
        "</header>" +

        '<section class="section-block" style="padding-top:0">' +
          '<div class="toolbar" style="margin-top:0">' +
            '<span class="small muted">按类型筛选：</span>' +
            '<div class="chip-row" id="type-filter">' +
              '<button class="chip" type="button" data-t="all" aria-pressed="true">全部</button>' +
              types.map(function (t) { return '<button class="chip" type="button" data-t="' + esc(t) + '" aria-pressed="false">' + esc(t) + "</button>"; }).join("") +
            "</div>" +
          "</div>" +
          '<div id="timeline-host"></div>' +
        "</section>" +

        feedbackSection(state) +
      "</div>";

    /* 时间线 */
    var host = root.querySelector("#timeline-host");
    function paint(filter) {
      var list = filter === "all" ? entries : entries.filter(function (e) { return e.type === filter; });
      if (!list.length) {
        host.innerHTML = MS.emptyState({ title: "没有这类记录", desc: "换一个筛选条件，或先在 data/changelog.json 里补一条。" });
        return;
      }
      host.innerHTML = '<ul class="timeline">' + list.map(function (e) {
        var tone = e.type === "反馈" ? "var(--amber)" : (e.type === "修正" ? "var(--rose)" : (e.type === "发布" ? "var(--blue)" : "var(--accent)"));
        return '<li class="tl-item" style="--tone:' + tone + '">' +
          '<div class="tl-head"><span class="tl-date">' + esc(e.date) + "</span>" +
            '<span class="badge plain">' + esc(e.type) + "</span>" +
            '<span>' + esc(e.week || "") + "</span>" +
            '<span class="mono tiny">' + esc(e.id || "") + "</span></div>" +
          "<h4>" + esc(e.target || "") + "</h4>" +
          '<p class="tl-what">' + esc(e.what) + "</p>" +
          '<p class="tl-why">为什么改：' + esc(e.why || "—") + "</p>" +
          '<p class="tl-basis">依据：' + esc(e.basis || "—") + " · 记录人：" + esc(e.who || "—") + "</p>" +
          ((e.links || []).length ? '<div class="chip-row" style="margin-top:6px">' + e.links.map(function (l) {
            return '<a class="chip" href="' + esc(l) + '">' + esc(l) + "</a>";
          }).join("") + "</div>" : "") +
          "</li>";
      }).join("") + "</ul>";
    }
    paint("all");
    root.querySelector("#type-filter").addEventListener("click", function (e) {
      var b = e.target.closest("[data-t]"); if (!b) return;
      root.querySelectorAll("#type-filter .chip").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      paint(b.getAttribute("data-t"));
    });

    wireFeedback(state, root);
  };

  /* ---------------- 反馈区块 ---------------- */
  function feedbackSection(state) {
    var g = state.feedback.guideline || {};
    var items = state.feedback.items || [];

    return '<section class="section-block" id="feedback">' +
      '<div class="section-head"><div><h2>非本组同学反馈及处理结果</h2>' +
      "<p>课程要求至少 3 名非本组同学的独立反馈，并且每条都要有回应：提出了什么 → 我们怎样核实 → 修改了什么 → 为什么调整或保留原判断。不采纳也要写理由。</p></div>" +
      '<span class="chip">已收到 ' + items.length + " / 至少 3 条</span></div>" +

      '<div class="grid g2">' +
        '<div class="panel"><h3 style="margin-top:0">给互评同学的三件事</h3>' +
          '<p class="small muted">先自己看 3 分钟，不要听我们解释。做完下面三件事，再把卡住的地方告诉我们。</p>' +
          '<ol class="steps">' + (g.threeTasks || []).map(function (t) { return "<li><span class=\"small\">" + esc(t) + "</span></li>"; }).join("") + "</ol>" +
          '<p class="tiny muted" style="margin-top:12px">' + esc(g.avoid && g.avoid[0] ? g.avoid[0] : "") + "</p>" +
        "</div>" +
        '<div class="panel"><h3 style="margin-top:0">写反馈（约 1 分钟）</h3>' +
          '<form id="fb-form" novalidate>' +
            '<div class="grid g2" style="gap:10px">' +
              '<label class="small">你的称呼<input type="text" name="reviewer" placeholder="可填昵称，或留空匿名"></label>' +
              '<label class="small">身份<select name="role"><option>非本组同学</option><option>本组同学</option><option>老师 / 助教</option></select></label>' +
            "</div>" +
            '<div class="grid g2" style="gap:10px;margin-top:10px">' +
              '<label class="small">设备与浏览器<input type="text" name="device" placeholder="例如 iPhone 14 / Safari"></label>' +
              '<label class="small">卡在哪个页面<select name="page"><option>首页</option><option>领域地图</option><option>生态地图</option><option>认知地图</option><option>AI 能力</option><option>更新记录</option><option>关于与贡献</option></select></label>' +
            "</div>" +
            '<label class="small" style="display:block;margin-top:10px">相关节点 / 关系编号（可选）<input type="text" name="target" placeholder="例如 d.sample-task 或 r-sample-01"></label>' +
            '<label class="small" style="display:block;margin-top:10px">你卡在哪里 / 哪里看不懂<textarea name="issue" required placeholder="越具体越好：哪个节点、哪条连线、哪句话没看懂，或者哪条来源打不开。"></textarea></label>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">' +
              '<button class="btn btn-primary" type="submit">生成反馈文本</button>' +
              '<button class="btn btn-ghost" type="button" id="fb-reset">清空</button>' +
            "</div>" +
          "</form>" +
          '<div id="fb-out" style="margin-top:12px"></div>' +
          '<p class="tiny muted" style="margin-top:10px">本站是纯静态页面，不会把内容发到任何服务器。生成后请复制发给组长（或按你们约定的方式提交）。</p>' +
        "</div>" +
      "</div>" +

      '<div style="margin-top:22px" id="fb-list">' + renderFeedbackItems(items) + "</div>" +
    "</section>";
  }

  function renderFeedbackItems(items) {
    if (!items.length) {
      return MS.emptyState({
        icon: "✎",
        title: "还没有收到非本组反馈",
        desc: "这是中期之后最容易被扣分的一项：不是「有没有反馈」，而是「反馈有没有带来修改」。收到第一条后，按四栏填进 data/feedback.json，这里会自动出现处理表。",
        actions: '<a class="btn btn-sm btn-primary" href="data/feedback.json">打开 feedback.json</a><a class="btn btn-sm" href="about.html#access">看访问测试记录</a>'
      });
    }
    return '<div class="grid" style="gap:14px">' + items.map(function (f) {
      return '<div class="card pad-sm">' +
        '<div class="node-meta" style="margin-bottom:8px">' +
          '<span class="badge plain">' + esc(f.id) + "</span>" +
          '<span class="badge tone-info">' + esc(f.role || "非本组同学") + "</span>" +
          MS.badge(f.status || "待处理", f.status === "已落地" ? "ok" : "warn") +
          '<span class="tiny muted">' + esc(f.date) + " · " + esc(f.device || "设备未填") + " · " + esc(f.page || "") + "</span>" +
        "</div>" +
        '<p class="small" style="color:var(--text)"><strong>' + esc(f.reviewer || "匿名同学") + "：</strong>" + esc(f.issue) + "</p>" +
        '<div class="flow">' +
          step("我们怎样核实", f.verify) +
          step("修改了什么", f.action) +
          step("为什么这样处理", f.reason || f.result) +
        "</div>" +
        ((f.links || []).length ? '<div class="chip-row" style="margin-top:8px">' + f.links.map(function (l) { return '<a class="chip" href="' + esc(l) + '">' + esc(l) + "</a>"; }).join("") + "</div>" : "") +
      "</div>";
    }).join("") + "</div>";
  }
  function step(label, text) {
    return '<div class="flow-step"><b>' + esc(label) + '</b><p>' + esc(text || "（待填）") + "</p></div>";
  }

  function wireFeedback(state, root) {
    var form = root.querySelector("#fb-form");
    if (!form) return;
    var out = root.querySelector("#fb-out");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = String(v).trim(); });
      var issue = data.issue || "";
      if (issue.length < 8) {
        out.innerHTML = '<div class="panel" style="border-color:rgba(251,113,133,.4)"><p class="small" style="margin:0;color:var(--rose)">问题描述太短。「挺好的」「有点难」这类反馈帮不上忙，请写到具体节点或具体句子。</p></div>';
        return;
      }
      var rec = {
        date: new Date().toISOString().slice(0, 10),
        reviewer: data.reviewer || "匿名同学",
        role: data.role,
        device: data.device,
        page: data.page,
        target: data.target,
        issue: issue
      };
      var text = [
        "【三张活地图 · 互评反馈】",
        "日期：" + rec.date,
        "称呼：" + rec.reviewer + "（" + rec.role + "）",
        "设备：" + (rec.device || "未填"),
        "页面：" + rec.page,
        "对象：" + (rec.target || "未指定"),
        "",
        "问题描述：",
        rec.issue
      ].join("\n");

      var json = JSON.stringify({
        id: "fb-" + rec.date.replace(/-/g, ""),
        date: rec.date,
        reviewer: rec.reviewer,
        role: rec.role,
        device: rec.device,
        page: rec.page,
        target: rec.target,
        issue: rec.issue,
        verify: "",
        action: "",
        reason: "",
        status: "待处理",
        links: []
      }, null, 2);

      out.innerHTML =
        '<div class="panel"><h4 style="margin-top:0">已生成，复制后发给组长</h4>' +
          '<textarea id="fb-text" readonly>' + esc(text) + "</textarea>" +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' +
            '<button class="btn btn-sm btn-primary" type="button" id="fb-copy">复制文本</button>' +
            '<button class="btn btn-sm" type="button" id="fb-copy-json">复制成可入库的 JSON</button>' +
            '<a class="btn btn-sm btn-ghost" href="mailto:?subject=' + encodeURIComponent("三张活地图反馈") + "&body=" + encodeURIComponent(text) + '">用邮件发送</a>' +
          "</div>" +
          '<p class="tiny muted" style="margin-top:10px">组长收到后把它作为一条 item 加进 <code>data/feedback.json</code>，补上「核实 / 修改 / 理由」三栏，本页就会自动生成处理表。</p>' +
        "</div>";

      root.querySelector("#fb-copy").addEventListener("click", function () {
        MS.copyText(text).then(function (ok) { MS.toast(ok ? "反馈文本已复制" : "复制失败，请手动选中复制"); });
      });
      root.querySelector("#fb-copy-json").addEventListener("click", function () {
        MS.copyText(json).then(function (ok) { MS.toast(ok ? "JSON 已复制，可直接粘进 feedback.json" : "复制失败"); });
      });
    });

    root.querySelector("#fb-reset").addEventListener("click", function () {
      form.reset();
      out.innerHTML = "";
    });
  }
})(window.MS = window.MS || {});
