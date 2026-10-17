# 三张活地图 · 站点骨架

一个**纯静态**的课程作业网站：首页 + 三张地图 + AI 能力 + 更新记录 + 关于与贡献。
不写地图内容——它负责让内容**能被结构化地放进去、公开访问、可探索**，并让 AI 能力真正围绕地图数据工作。

- 零依赖、零构建、零后端、零密钥
- 双击打不开是正常的（浏览器不允许 `file://` 读本地 JSON），用下面的命令启动
- 66 节点 / 62 关系的完整演示数据集在 `examples/`，一条命令就能换上

---

## 30 秒跑起来

```bash
node scripts/serve.mjs 4173
# 浏览器打开 http://localhost:4173
```

需要 Node.js 18+（`node -v` 确认）。没有任何 `npm install`。

---

## 你会看到的七个页面

| 页面 | 文件 | 解决什么 |
| --- | --- | --- |
| 首页 | `index.html` | 领域一句话定义、三张地图入口、成长路线、本周进展 |
| 领域地图 | `domain.html` | 知识、方法、工具、课程入口 |
| 生态地图 | `ecosystem.html` | 谁在推动、具体关系、观察维度 |
| 认知地图 | `cognitive.html` | 认识方法、分析案例、习惯、认识修正 |
| AI 能力 | `ai.html` | 查课程 / 关系解释 / 路线比较，回答必带来源 |
| 更新记录 | `changelog.html` | 改了什么、为什么改；反馈及处理结果 |
| 关于与贡献 | `about.html` | 三类对接、成员贡献、访问测试、13 项自检 |

---

## 内容怎么进去（三种方式）

**A. 填 CSV → 导入**（推荐给地图负责人）

```bash
# 1. 复制 templates/节点表.csv 等三个文件到 inbox/
# 2. 用 Excel 填
# 3. 导入
node scripts/import-csv.mjs
```

**B. 直接改 `data/*.json`**，然后 `node scripts/validate.mjs`

**C. 换上完整演示数据集**

```bash
node scripts/use-dataset.mjs --list
node scripts/use-dataset.mjs filled-example
```

详细字段说明见 [`docs/01-节点字段契约.md`](docs/01-节点字段契约.md)，操作手册见 [`docs/02-数据怎么进来.md`](docs/02-数据怎么进来.md)。

---

## 命令一览

| 命令 | 作用 |
| --- | --- |
| `node scripts/serve.mjs [端口]` | 本地预览（默认 4173） |
| `node scripts/validate.mjs` | 校验数据结构，报错指到具体节点；有错退出码 1 |
| `node scripts/selftest.mjs` | 自检：引擎、三项 AI 能力、布局、文件完整性 |
| `node scripts/import-csv.mjs` | CSV → JSON，任何一条不合格整批不写 |
| `node scripts/import-csv.mjs --dry` | 只校验不写盘 |
| `node scripts/use-dataset.mjs <名字>` | 切换数据集（自动备份） |

改完数据 → 刷新页面即可，不需要重启服务器。

---

## 目录结构

```
.
├── index.html  domain.html  ecosystem.html  cognitive.html
├── ai.html  changelog.html  about.html  404.html
├── assets/
│   ├── css/site.css          # 全部样式，无框架无 CDN
│   └── js/
│       ├── engine.js         # 纯函数：建图 / 检索 / 最短路 / 路线比较 / 布局
│       ├── core.js           # 数据加载 + 节点卡等共享渲染
│       ├── chrome.js         # 导航、演示提示条、页脚
│       ├── map.js            # 三张地图共用的页面逻辑
│       ├── ai-page.js        # AI 能力页
│       ├── home.js  changelog.js  about.js
├── data/                     # 页面唯一的资料来源
│   ├── config.json           # 组名、领域定义、自检项、周进度
│   ├── sources.json          # 来源库
│   ├── domain|ecosystem|cognitive.json
│   ├── relations.json        # 三张图共用的关系表（支持跨图）
│   ├── routes.json           # 技术路线（给路线比较用）
│   ├── changelog|feedback|members|tests.json
├── templates/                # CSV 模板（节点 / 关系 / 来源）
├── inbox/                    # 放填好的 CSV
├── scripts/                  # 六个零依赖 Node 脚本
├── docs/                     # 六份交付文档
├── examples/filled-example/  # 完整演示数据集
├── .github/workflows/pages.yml
├── netlify.toml  vercel.json  .nojekyll
```

---

## 部署

三条路都配好了，选一条：

### GitHub Pages（推荐）

推到 GitHub → Settings → Pages → Source 选 **GitHub Actions** → 等 Actions 变绿。
工作流会先跑 `validate.mjs`，数据不合格就不会发布。

### Vercel

```bash
npx vercel --prod
```

### Netlify

```bash
npx netlify deploy --prod --dir=.
```
或把文件夹拖到 <https://app.netlify.com/drop>。

发布后**必须**按 [`docs/04-部署与访问测试记录.md`](docs/04-部署与访问测试记录.md) 里的 12 项清单实测一遍，写进 `data/tests.json`。

---

## 这个站点的三条设计决定

**1. 数据与页面彻底分离。**
页面不写死任何内容。三张地图、关系、来源、理解程度全在 `data/`。换内容不改代码，改代码不影响内容。

**2. 关系比节点重要。**
每条关系必须有 `why`（为什么成立）和 `sourceIds`（凭什么）。只写「有关」的会被校验脚本拦下。未经证实的必须标 `inferred`，界面上显示「推断」。

**3. AI 不生成文本。**
三项能力都是在地图上做检索与图推理：检索命中、最短路径、集合交集。所以每个回答都能点回节点、看到来源、看到团队理解程度；地图里没有的就说没有。这是为了满足「不能编造课程、论文、人物关系」，也是为了现场演示不翻车。

---

## 常见问题

**双击 `index.html` 打开是空白 / 提示数据没加载？**
正常。浏览器不允许 `file://` 页面读取本地 JSON。用 `node scripts/serve.mjs`。

**改了数据页面没变？**
强刷（Ctrl/Cmd + Shift + R）。`data/` 已经设了 no-cache，但托管平台仍可能有延迟。

**关系图太挤？**
一张图超过 60 个节点就会挤。建议拆分（比如把「模型」和「软件」分成两个子图），或者用工具栏的类型筛选。

**能不能接大模型？**
可以，但建议保留现在这套确定性引擎作为默认路径。接法见 [`docs/03-AI能力计划.md`](docs/03-AI能力计划.md) 第六节。

**数据改坏了怎么办？**
`data/.backup/` 下有每次导入前的备份，直接复制回来。

**顶部那条黄色「骨架演示模式」怎么去掉？**
把 `data/config.json` 里的 `demoContent` 改成 `false`。

---

## 还没做的（如实列出）

- **云端发布**：需要你的 GitHub / Vercel / Netlify 账号，我无法代你点发布
- **非本组同学的 3 条真实反馈**：必须真实收集，不能代填
- **培养方案 / 课程大纲依据**：课程节点的 `courseBasis` 需要原文，目前全部标了「待核实」
- **真实地图内容**：`data/` 里目前是 11 个示例节点，等你和三位负责人替换

验收对照见 [`docs/06-验收对照表.md`](docs/06-验收对照表.md)。
