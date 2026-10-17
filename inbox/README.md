# inbox/ —— 放填好的 CSV

把这三个文件放进来，然后运行：

```bash
node scripts/import-csv.mjs
```

- `节点表.csv`
- `关系表.csv`
- `来源表.csv`

模板在 `../templates/`，字段说明在 `../docs/01-节点字段契约.md`，
操作步骤在 `../docs/02-数据怎么进来.md`。

只想检查不想写入：

```bash
node scripts/import-csv.mjs --dry
```

文件名必须完全一致（中文文件名也可以，只要保持一致）。
只想导入其中一张表时，删掉或移走另外两个文件即可，脚本会自动跳过不存在的文件。
