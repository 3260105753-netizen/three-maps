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
          '<p class="page-q">这一页是给互评和期末展示用的：谁负责哪块、谁测过、哪些验收项已经过、内容是怎么进系统的。课程要求「每位成员能够解释自己的贡献」，所以每人写的不是职位，是能被追问的部分。</p>' +
        "</header>" +

        groupBlock(site) +
        rolesBlock() +
        membersBlock(state) +
        accessBlock(state) +
        selfCheckBlock(cfg) +
        pipelineBlock() +
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
        '<div class="panel"><h3 style="margin-top:0">这个网站的角色</h3>' +
          '<p class="small">它不替谁写内容，它负责让内容<strong>能被结构化地放进去、公开访问、可探索</strong>，并让至少一项 AI 能力真正围绕地图数据工作。</p>' +
          '<ul class="small" style="padding-left:18px;line-height:1.9">' +
            "<li>七个页面：首页 / 三张地图 / AI 能力 / 更新记录 / 关于与贡献</li>" +
            "<li>四类字段：节点、关系、来源、理解程度</li>" +
            "<li>三项 AI 能力：查课程、解释关系、比较路线</li>" +
            "<li>两条管道：CSV 模板 → 校验脚本 → JSON → 页面自动渲染</li>" +
          "</ul>" +
        "</div>" +
      "</div>" +
    "</section>";
  }

  function rolesBlock() {
    return '<section class="section-block" id="roles">' +
      '<div class="section-head"><div><h2>三类对接：各自给对方什么</h2>' +
      "<p>分工不清是这类作业最常见的失败原因。所以对接方式写死在这里：谁交什么、交成什么格式、缺了会怎样。</p></div></div>" +
      '<div class="grid g3">' +
        roleCard("对三位地图负责人", "#5eead4", [
          "给他们固定字段，不接受只交一段文字",
          "每个节点必须有：名称、类型、一句话说明、关系、来源、理解程度",
          "关系要写清「谁指向谁、为什么」",
          "用 templates/节点表.csv 填，我负责导入与校验"
        ]) +
        roleCard("对证据负责人", "#fbbf24", [
          "来源链接必须能追溯：可打开、能定位到具体段落",
          "来源失效或可信度低，在 verify 字段标「待核实」",
          "没有链接就留空并标「来源待补」，不要用课名猜",
          "每条重要关系也要有依据，不只是节点有"
        ]) +
        roleCard("对组长 / 互评负责人", "#a78bfa", [
          "公开链接与反馈入口由我提供并保证可用",
          "每周更新日志的技术部分由我维护，内容部分由各组负责人补",
          "反馈进来后逐条转成任务：改哪个节点、哪条关系、哪个页面",
          "期末展示的技术部分（结构 + AI 演示）由我准备"
        ]) +
      "</div>" +
    "</section>";
  }
  function roleCard(title, tone, items) {
    return '<div class="card" style="--tone:' + tone + '">' +
      '<span class="badge" style="--tone:' + tone + '">' + esc(title) + "</span>" +
      '<ul class="small" style="padding-left:18px;line-height:1.95;margin:12px 0 0">' +
      items.map(function (i) { return "<li>" + esc(i) + "</li>"; }).join("") + "</ul></div>";
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
      '<p class="small muted" style="margin-top:12px">数据在 <a href="data/members.json">data/members.json</a>，每人只改自己那一行。</p>' +
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

  function pipelineBlock() {
    return '<section class="section-block" id="pipeline">' +
      '<div class="section-head"><div><h2>内容怎么进系统</h2>' +
      "<p>三位负责人不需要碰代码，也不需要碰 HTML。填表 → 跑一个校验命令 → 页面自动更新。校验不过会指到具体行号，避免「三张地图各说各话」。</p></div></div>" +
      '<div class="grid g2">' +
        '<div class="panel"><ol class="steps">' +
          "<li><b>填表</b><span class=\"small muted\">用 templates/ 下的三个 CSV：节点表、关系表、来源表。Excel / WPS / Numbers 都能开。</span></li>" +
          "<li><b>校验</b><span class=\"small muted\"><code class=\"mono\">node scripts/import-csv.mjs</code>：缺字段、枚举值不对、关系指向不存在的节点、来源编号没登记，都会报错并给行号。</span></li>" +
          "<li><b>生成</b><span class=\"small muted\">校验通过后写入 data/*.json，页面刷新即生效。</span></li>" +
          "<li><b>记录</b><span class=\"small muted\">在 data/changelog.json 加一条：日期、改了什么、依据、为什么。忘了写，这一项在互评时会先被看到。</span></li>" +
        "</ol></div>" +
        '<div class="panel"><h4 style="margin-top:0">三条硬规则</h4>' +
          '<ul class="small" style="padding-left:18px;line-height:2">' +
            "<li><strong>关系必须有 why</strong>：写「有关」等于没写，必须说清谁指向谁、为什么成立。</li>" +
            "<li><strong>证据必须分类型</strong>：事实 / 他人观点 / 团队推断，推断还要在关系上标 inferred。</li>" +
            "<li><strong>不确定就标出来</strong>：待核实、来源待补会以黄色告警出现在页面上，这不是扣分项，是诚实项。</li>" +
          "</ul>" +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">' +
            '<a class="btn btn-sm btn-primary" href="docs/01-节点字段契约.md">字段契约</a>' +
            '<a class="btn btn-sm" href="docs/02-数据怎么进来.md">负责人操作手册</a>' +
          "</div>" +
        "</div>" +
      "</div>" +
    "</section>";
  }

  function techBlock(state) {
    var s = state.stats;
    return '<section class="section-block" id="tech">' +
      '<div class="section-head"><div><h2>技术说明</h2>' +
      "<p>这一节是给「现场演示会不会翻车」准备的：说明它为什么稳，以及它的边界在哪。</p></div></div>" +
      '<div class="grid g3">' +
        '<div class="panel"><h4 style="margin-top:0">为什么稳</h4><ul class="small" style="padding-left:18px;line-height:1.95">' +
          "<li>纯静态：HTML + CSS + 原生 JS，无构建步骤</li>" +
          "<li>无外部依赖：不加载 CDN、字体、分析脚本</li>" +
          "<li>无后端、无数据库、无账号体系</li>" +
          "<li>AI 能力本地推理，不调用 API、不需要密钥</li>" +
        "</ul></div>" +
        '<div class="panel"><h4 style="margin-top:0">当前数据量</h4><dl class="kv">' +
          "<dt>节点</dt><dd>" + s.nodes + " 个</dd>" +
          "<dt>关系</dt><dd>" + s.relations + " 条（推断 " + s.inferred + " 条）</dd>" +
          "<dt>来源</dt><dd>" + s.sources + " 条，其中 " + s.withSources + " 个节点有可打开来源</dd>" +
          "<dt>路线</dt><dd>" + s.routes + " 条</dd>" +
          "<dt>待核实</dt><dd>" + s.unverified + " 个节点</dd>" +
        "</dl></div>" +
        '<div class="panel"><h4 style="margin-top:0">边界</h4><ul class="small" style="padding-left:18px;line-height:1.95">' +
          "<li>不做用户登录与权限，所有内容公开</li>" +
          "<li>不收集访问数据，反馈靠复制粘贴</li>" +
          "<li>关系图在 60 个节点以内最清楚，再多需要拆分</li>" +
          "<li>内容质量仍取决于负责人，脚本只保证结构一致</li>" +
        "</ul></div>" +
      "</div>" +
      (state.config.demoContent ? '<div class="panel" style="margin-top:16px;border-color:rgba(251,191,36,.4)"><p class="small" style="margin:0;color:#f6d99a">当前处于<strong>骨架演示模式</strong>：示例文案与示例节点只用于验证结构。替换 data/ 后把 data/config.json 里的 <code>demoContent</code> 改成 false，顶部提示条会消失。</p></div>' : "") +
    "</section>";
  }
})(window.MS = window.MS || {});
