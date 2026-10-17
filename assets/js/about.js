/* ============================================================
   关于与贡献：组信息、三类对接、成员贡献、访问测试、13 项自检
   ============================================================ */
(function (MS) {
  "use strict";
  var esc = MS.esc;
  var CHECK_KEY = "ms-acceptance-checks-v1";

  MS.pages.about = function render(state, root) {
    var cfg = state.config;
    var site = cfg.site || {};

    root.innerHTML =
      '<div class="wrap">' +
        '<header class="page-head">' +
          '<p class="eyebrow">关于与贡献</p>' +
          "<h1>谁做了什么，能解释到什么程度</h1>" +
          '<p class="page-q">谁负责哪块、谁测过、哪些验收项已经过。课程要求「每位成员能够解释自己的贡献」，所以每人写的不是职位，是能被追问的部分。</p>' +
        "</header>" +

        groupBlock(site) +
        membersBlock(state) +
        accessBlock(state) +
        selfCheckBlock(cfg) +
        techBlock(state) +
      "</div>";

    wireChecks(state, root);

    var copy = root.querySelector("[data-copy-all]");
    if (copy) copy.addEventListener("click", function () {
      var text = (state.members.members || []).map(function (m) {
        return [m.name, "负责：" + (m.pages || []).join("、"), "能解释：" + (m.canExplain || []).join("；"), "记录：" + (m.records || []).join("、")].join("\n");
      }).join("\n\n");
      MS.copyText(text).then(function (ok) { MS.toast(ok ? "贡献说明已复制，可粘到提交材料里" : "复制失败"); });
    });
  };

  function groupBlock(site) {
    return '<section class="section-block" style="padding-top:0">' +
      '<div class="grid g2">' +
        '<div class="panel"><h3 style="margin-top:0">小组</h3>' +
          '<dl class="kv">' +
            "<dt>名称</dt><dd>" + esc(site.groupName || "待填") + "</dd>" +
            "<dt>领域</dt><dd>" + esc(site.domain || "待填") + "</dd>" +
            "<dt>学期</dt><dd>" + esc(site.term || "—") + "</dd>" +
            "<dt>版本</dt><dd>" + esc(site.version || "—") + "（更新 " + esc(site.updated || "—") + "）</dd>" +
            "<dt>联系</dt><dd>" + esc(site.contact || "待填") + "</dd>" +
          "</dl></div>" +
        '<div class="panel"><h3 style="margin-top:0">这个网站是什么</h3>' +
          '<p class="small">三张地图共用一套节点、关系、来源与更新记录，所以从一个节点可以跳到另一个视角，而不是三份互不相干的页面。</p>' +
          '<ul class="small" style="padding-left:18px;line-height:1.9">' +
            "<li>七个页面：首页 / 三张地图 / AI 能力 / 更新记录 / 关于与贡献</li>" +
            "<li>每个节点都写清：类型、一句话说明、关系与理由、来源、理解程度</li>" +
            "<li>三项 AI 能力：查课程、解释关系、比较路线，回答都带来源</li>" +
          "</ul>" +
        "</div>" +
      "</div>" +
    "</section>";
  }

  function membersBlock(state) {
    var list = state.members.members || [];
    return '<section class="section-block" id="members">' +
      '<div class="section-head"><div><h2>成员贡献说明</h2>' +
      "<p>课程明确：技术实现、资料核查、提出反例、帮同学理解、推动协作都算有效贡献。所以这里不只列页面，还要写「能被追问的部分」和「记录在哪」。</p></div>" +
      '<button class="btn btn-sm btn-ghost" type="button" data-copy-all>复制全部贡献说明</button></div>' +
      '<div class="table-wrap"><table><thead><tr><th>成员</th><th>职责</th><th>负责的页面 / 内容</th><th>能被追问的部分</th><th>记录</th><th>状态</th></tr></thead><tbody>' +
      list.map(function (m) {
        return "<tr><td><strong>" + esc(m.name) + "</strong></td>" +
          '<td class="small">' + esc(m.duty || "—") + "</td>" +
          '<td class="small muted">' + esc((m.pages || []).join("、") || "—") + "</td>" +
          '<td class="small muted">' + esc((m.canExplain || []).join("；") || "—") + "</td>" +
          '<td class="small muted">' + esc((m.records || []).join("、") || "—") + "</td>" +
          "<td>" + MS.badge(m.status || "待填", m.status === "待填" ? "warn" : "ok") + "</td></tr>";
      }).join("") + "</tbody></table></div>" +
    "</section>";
  }

  function accessBlock(state) {
    var tests = state.tests.tests || [];
    var bad = tests.filter(function (t) { return t.result && t.result.indexOf("通过") < 0; });
    return '<section class="section-block" id="access">' +
      '<div class="section-head"><div><h2>部署与访问测试记录</h2>' +
      "<p>课程警告过：「发布成功不等于其他人能够访问」。所以每次发布都要留记录：谁测的、什么设备、什么网络、发现什么问题、怎么修。第 3 周要有第一次，第 4 周中期 V0 必须公开可访问。</p></div>" +
      '<span class="chip">' + tests.length + " 次记录" + (bad.length ? " · " + bad.length + " 次未通过" : "") + "</span></div>" +

      (tests.length
        ? '<div class="table-wrap"><table><thead><tr><th>日期</th><th>谁测的</th><th>设备 / 浏览器</th><th>网络</th><th>测了什么</th><th>结果</th><th>问题与修复</th></tr></thead><tbody>' +
          tests.map(function (t) {
            return '<tr><td class="nowrap mono tiny">' + esc(t.date) + "</td>" +
              "<td>" + esc(t.who) + "</td>" +
              '<td class="small">' + esc(t.device) + "</td>" +
              '<td class="small">' + esc(t.network) + "</td>" +
              '<td class="small muted">' + esc(t.scope || "—") + "</td>" +
              "<td>" + MS.badge(t.result, String(t.result).indexOf("通过") >= 0 ? "ok" : "bad") + "</td>" +
              '<td class="small muted">' + esc([t.problems, t.fix].filter(Boolean).join(" → ") || "—") + "</td></tr>";
          }).join("") + "</tbody></table></div>"
        : MS.emptyState({ title: "还没有访问测试记录", desc: "发布后请立刻用另一台设备、另一张网络打开一次，把结果记进 data/tests.json。", actions: '<a class="btn btn-sm" href="docs/04-部署与访问测试记录.md">测试记录模板</a>' })) +

      '<div class="panel" style="margin-top:16px"><h3 style="margin-top:0">提交前必须满足的访问条件</h3>' +
        '<div class="grid g2"><ul class="small" style="line-height:2;padding-left:18px">' +
          "<li>云端运行，不依赖成员电脑开机</li>" +
          "<li>国内普通网络可访问，不需要科学上网</li>" +
          "<li>同学无需安装软件或配置环境</li>" +
          "<li>三张地图直接可看，不需逐人申请权限</li>" +
        "</ul><ul class=\"small\" style=\"line-height:2;padding-left:18px\">" +
          "<li>互评期间核心交互可用</li>" +
          "<li>不索取个人模型密钥</li>" +
          "<li>不暴露账号、密钥或敏感资料</li>" +
          "<li>提交前请非本组同学用自己的设备实际打开</li>" +
        "</ul></div></div>" +
    "</section>";
  }

  function selfCheckBlock(cfg) {
    var checks = cfg.acceptanceChecks || [];
    return '<section class="section-block" id="checks">' +
      '<div class="section-head"><div><h2>提交前自检（13 项）</h2>' +
      "<p>这是课程原文给出的 13 条自检项。勾选只存在你自己的浏览器里，不上传、不代表已提交作业。</p></div>" +
      '<button class="btn btn-sm btn-ghost" type="button" id="check-reset">重置</button></div>' +
      '<div class="progress-line"><span id="check-count">已检查 0 / ' + checks.length + ' 项</span>' +
        '<span class="under-bar" style="--tone:var(--accent)"><i id="check-bar" style="width:0%"></i></span></div>' +
      '<ul class="check-list">' + checks.map(function (c) {
        return '<li><label class="check-item" data-check="' + c.id + '">' +
          '<input type="checkbox" value="' + c.id + '">' +
          '<span><span class="c-text">' + esc(c.text) + "</span>" +
          '<span class="c-where">看哪里：' + esc(c.where || "—") + " · 谁负责：" + esc(c.owner || "—") + "</span></span>" +
          "</label></li>";
      }).join("") + "</ul>" +
    "</section>";
  }

  function wireChecks(state, root) {
    var checks = (state.config.acceptanceChecks || []);
    var boxes = MS.qsa('#checks input[type="checkbox"]', root);
    if (!boxes.length) return;

    var saved = {};
    try { saved = JSON.parse(localStorage.getItem(CHECK_KEY) || "{}"); } catch (e) { saved = {}; }

    boxes.forEach(function (b) {
      if (saved[b.value]) { b.checked = true; paint(b); }
    });
    update();

    boxes.forEach(function (b) {
      b.addEventListener("change", function () {
        saved[b.value] = b.checked;
        try { localStorage.setItem(CHECK_KEY, JSON.stringify(saved)); } catch (e) {}
        paint(b);
        update();
      });
    });

    root.querySelector("#check-reset").addEventListener("click", function () {
      try { localStorage.removeItem(CHECK_KEY); } catch (e) {}
      boxes.forEach(function (b) { b.checked = false; paint(b); });
      saved = {};
      update();
      MS.toast("已重置自检状态");
    });

    function paint(b) {
      var label = b.closest(".check-item");
      if (label) label.classList.toggle("done", b.checked);
    }
    function update() {
      var done = boxes.filter(function (b) { return b.checked; }).length;
      root.querySelector("#check-count").textContent = "已检查 " + done + " / " + checks.length + " 项";
      root.querySelector("#check-bar").style.width = Math.round((done / checks.length) * 100) + "%";
    }
  }


  function techBlock(state) {
    var s = state.stats;
    return '<section class="section-block" id="tech">' +
      '<div class="section-head"><div><h2>技术说明</h2>' +
      "<p>为什么现场演示不容易翻车，以及它的边界在哪。</p></div></div>" +
      '<div class="grid g2">' +
        '<div class="panel"><h4 style="margin-top:0">为什么稳</h4><ul class="small" style="padding-left:18px;line-height:1.95">' +
          "<li>纯静态：HTML + CSS + 原生 JS，无构建、无 CDN、无外部字体</li>" +
          "<li>无后端、无数据库、不需要登录</li>" +
          "<li>AI 能力在浏览器里本地推理，不调用 API、不索取密钥</li>" +
          "<li>读屏、键盘操作、手机窄屏都能用</li>" +
        "</ul></div>" +
        '<div class="panel"><h4 style="margin-top:0">边界</h4><ul class="small" style="padding-left:18px;line-height:1.95">' +
          "<li>不收集任何访问数据，反馈靠复制粘贴</li>" +
          "<li>内容对错取决于负责人，脚本只保证结构一致</li>" +
          "<li>AI 只回答地图里有的东西，查不到就明说查不到</li>" +
          "<li>当前：" + s.nodes + " 个节点 · " + s.relations + " 条关系 · " + s.withSources + " 个节点有可打开来源</li>" +
        "</ul></div>" +
      "</div>" +
    "</section>";
  }
})(window.MS = window.MS || {});
