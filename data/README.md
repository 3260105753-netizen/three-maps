# data/ —— 页面唯一的资料来源

页面不写死任何内容。**这里放什么，网站就显示什么。** 改完保存、刷新页面即可，不需要改代码。

## 文件清单

| 文件 | 作用 | 谁来改 |
| --- | --- | --- |
| `config.json` | 小组名称、领域定义、版本、13 项自检、每周进展 | 组长 + 技术 |
| `sources.json` | 来源库：论文 / 文档 / 官网 / 目录 | 证据负责人 |
| `domain.json` | 领域地图的节点 | 领域地图负责人 |
| `ecosystem.json` | 生态地图的节点 | 生态地图负责人 |
| `cognitive.json` | 认知地图的节点 | 认知地图负责人 |
| `relations.json` | 三张地图共用的关系表（支持跨图连线） | 三位负责人 |
| `routes.json` | 技术路线（给「路线比较」用） | 领域负责人 |
| `changelog.json` | 更新记录 | 谁改谁写 |
| `feedback.json` | 非本组反馈及处理结果 | 互评负责人 |
| `members.json` | 成员贡献说明 | 每人写自己 |
| `tests.json` | 部署与访问测试记录 | 技术 |

## 三条路径

**A. 直接改 JSON（最灵活，适合少量修改）**
用任何编辑器打开对应文件，照着已有条目的形状加一条，保存，刷新。

**B. 填 CSV 再导入（推荐给负责大量内容的同学）**
1. 复制 `templates/节点表.csv`、`关系表.csv`、`来源表.csv` 到 `inbox/`；
2. 用 Excel / WPS / Numbers 填，说明见 `docs/02-数据怎么进来.md`；
3. 运行 `node scripts/import-csv.mjs`；
4. 报错会指到具体行号，改完再跑一次。

**C. 换成演示数据集（想先看完整效果）**
```bash
node scripts/use-dataset.mjs --list
node scripts/use-dataset.mjs filled-example
```
会先把当前 `data/` 备份到 `data/.backup/<时间戳>/`。

## 改完必须做的事

```bash
node scripts/validate.mjs     # 结构检查：缺字段、关系指向不存在的节点、来源没登记
```

然后在 `changelog.json` 里加一条记录：**日期、改了什么、依据、为什么**。这不是形式主义——互评时老师真的会看这一栏。

## 当前状态

`config.json` 里 `demoContent: true` 时，全站顶部会显示「骨架演示模式」提示条。
正式内容全部替换完成后，把它改成 `false`，提示条消失。
