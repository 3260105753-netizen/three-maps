/* ============================================================
   页面外壳：顶部导航、演示提示条、页脚
   七个页面共用，改一次全站生效。
   ============================================================ */
(function (MS) {
  "use strict";

  var NAV = [
    { id: "home", label: "首页", href: "index.html" },
    { id: "domain", label: "领域地图", href: "domain.html" },
    { id: "ecosystem", label: "生态地图", href: "ecosystem.html" },
    { id: "cognitive", label: "认知地图", href: "cognitive.html" },
    { id: "ai", label: "AI 能力", href: "ai.html" },
    { id: "changelog", label: "更新记录", href: "changelog.html" },
    { id: "about", label: "关于与贡献", href: "about.html" }
  ];

  function mount(active, state) {
    var cfg = (state && state.config && state.config.site) || {};
    var demo = !!(state && state.config && state.config.demoContent);
    renderHeader(active, cfg);
    renderBanner(demo, active);
    renderFooter(cfg, active);
  }

  function renderHeader(active, cfg) {
    var host = document.getElementById("app-header");
    if (!host) return;
    var links = NAV.map(function (n) {
      var cur = n.id === active ? ' aria-current="page"' : "";
      return '<a href="' + n.href + '"' + cur + ">" + n.label + "</a>";
    }).join("");

    host.className = "site-header";
    host.innerHTML =
      '<div class="wrap header-inner">' +
        '<a class="brand" href="index.html">' +
          '<span class="brand-mark" aria-hidden="true"></span>' +
          '<span class="brand-text">' + MS.esc(cfg.groupName || "三张活地图") +
            "<small>" + MS.esc((cfg.domain || "选题领域") + " · " + (cfg.version || "V0")) + "</small>" +
          "</span>" +
        "</a>" +
        '<button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="展开导航">☰</button>' +
        '<nav class="nav" id="site-nav" aria-label="主导航">' + links +
          '<a class="nav-cta" href="about.html#feedback">给本组反馈</a>' +
        "</nav>" +
      "</div>";

    var btn = host.querySelector(".nav-toggle");
    var nav = host.querySelector(".nav");
    btn.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.textContent = open ? "✕" : "☰";
    });
  }

  function renderBanner(demo, active) {
    var old = document.getElementById("demo-banner");
    if (old) old.remove();
    if (!demo) return;
    var el = document.createElement("div");
    el.id = "demo-banner";
    el.className = "banner";
    el.innerHTML =
      '<div class="wrap" style="display:flex;gap:10px;flex-wrap:wrap;align-items:baseline">' +
        "<strong>骨架演示模式</strong>" +
        "<span>页面里的示例文案与示例节点只用于验证结构，不是正式内容。替换 <code class=\"mono\">data/</code> 下的文件后自动生效，详见 " +
        '<a href="data/README.md">data/README.md</a>。</span>' +
      "</div>";
    document.body.insertBefore(el, document.getElementById("app-header").nextSibling);
  }

  function renderFooter(cfg, active) {
    var host = document.getElementById("app-footer");
    if (!host) return;
    var pages = NAV.filter(function (n) { return n.id !== active; }).map(function (n) {
      return '<a href="' + n.href + '">' + n.label + "</a>";
    }).join("");

    host.className = "site-footer";
    host.innerHTML =
      '<div class="wrap footer-grid">' +
        "<div>" +
          "<h5>" + MS.esc(cfg.groupName || "小组名称待填") + "</h5>" +
          '<p class="small" style="margin:0 0 8px">' + MS.esc(cfg.domain || "选题领域待填") + "</p>" +
          '<p class="small" style="margin:0">版本 ' + MS.esc(cfg.version || "—") + " · 更新 " + MS.esc(cfg.updated || "—") +
          " · " + MS.esc(cfg.term || "") + "</p>" +
        "</div>" +
        "<div><h5>页面</h5>" + pages + "</div>" +
      "</div>" +
      '<div class="wrap footer-bottom">' +
        "<span>纯静态站点：不收集任何访问数据，不需要登录，不索取模型密钥。</span>" +
        "<span>三张地图 · 让内容能被结构化地放进去</span>" +
      "</div>";
  }

  MS.chrome = { mount: mount, NAV: NAV };
})(window.MS = window.MS || {});
