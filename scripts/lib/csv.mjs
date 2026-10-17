/* 极简 CSV 读写：支持 BOM、CRLF、双引号包裹、字段内换行与 "" 转义 */

export function parseCSV(text) {
  let src = String(text).replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((x) => x !== "")) rows.push(row);
  if (!rows.length) return { header: [], records: [] };

  const header = rows[0].map((h) => h.trim());
  const records = rows.slice(1).map((r, idx) => {
    const obj = { __row: idx + 2 };
    header.forEach((h, i) => { obj[h] = (r[i] ?? "").trim(); });
    return obj;
  });
  return { header, records };
}

export function toCSV(header, records) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [header.map(esc).join(",")];
  records.forEach((r) => lines.push(header.map((h) => esc(r[h])).join(",")));
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

/* "a；b" / "a;b" / "a|b" → ["a","b"] */
export function splitList(v) {
  if (!v) return [];
  return String(v)
    .split(/[;；|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
