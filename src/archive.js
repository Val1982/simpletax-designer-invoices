import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function readJson() {
  if (fs.existsSync("data/invoices.json")) {
    return JSON.parse(fs.readFileSync("data/invoices.json", "utf8"));
  }
  if (fs.existsSync("data/last_response.json")) {
    return JSON.parse(fs.readFileSync("data/last_response.json", "utf8"));
  }
  return [];
}

function asArray(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.invoices)) return data.invoices;
  return [data];
}

function fmtMoney(amount, currency) {
  if (amount === null || amount === undefined || amount === "") return "";
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${amount} ${currency || ""}`.trim();
  const s = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return `${s} ${currency || ""}`.trim();
}

function safeId(s) {
  return String(s).replace(/[^a-zA-Z0-9_\-:.]/g, "_");
}

// ✅ ТОВА Е ЕДИНСТВЕНИЯТ ИЗТОЧНИК НА ИСТИНА ЗА UI НА АРХИВА
function archiveIndexHtmlTemplate() {
  return `<!doctype html>
<html lang="bg">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Архив фактури</title>
  <style>
    :root{
      --bg:#0b1220; --line:rgba(255,255,255,.08);
      --text:#e7edf6; --mut:#9aa6b2; --acc:#2ecc71;
      --btn:#132545;
    }
    *{box-sizing:border-box}
    body{
      margin:0; font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
      background:radial-gradient(1200px 600px at 30% 0%, #142447 0%, var(--bg) 60%);
      color:var(--text);
    }
    .wrap{ max-width:1200px; margin:24px auto; padding:0 16px; }
    h1{ margin:0 0 14px; font-size:22px; text-align:center; }
    .bar{ display:flex; gap:10px; align-items:center; margin-bottom:14px; }
    .search{
      flex:1; background:rgba(255,255,255,.06); border:1px solid var(--line);
      padding:10px 12px; border-radius:10px; color:var(--text); outline:none;
    }
    .btn{
      background:var(--btn); border:1px solid var(--line); color:var(--text);
      padding:10px 12px; border-radius:10px; cursor:pointer; font-weight:700;
      white-space:nowrap;
    }
    .btn:hover{ border-color:rgba(255,255,255,.16); }
    .btn.acc{ background:linear-gradient(90deg, var(--acc), #1fb863); border-color:transparent; color:#062012; }
    .card{
      background:linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03));
      border:1px solid var(--line);
      border-radius:14px; overflow:hidden;
    }
    table{ width:100%; border-collapse:collapse; }
    thead th{
      text-align:left; font-size:12px; color:var(--mut);
      padding:12px; background:rgba(0,0,0,.15);
      border-bottom:1px solid var(--line);
    }
    tbody td{
      padding:12px; border-bottom:1px solid var(--line); font-size:14px;
    }
    tbody tr:hover{ background:rgba(255,255,255,.04); }
    .num{ color:#8fe9ff; font-weight:800; }
    .right{ text-align:right; }
    a{ color:#8fe9ff; text-decoration:none; font-weight:800; }
    a:hover{ text-decoration:underline; }
    .mut{ color:var(--mut); font-size:12px; margin-top:10px; }
    .chk{ width:18px; height:18px; accent-color: var(--acc); }
    .topline{
      display:flex; gap:10px; align-items:center; justify-content:space-between;
      padding:12px;
      border-bottom:1px solid var(--line);
      background:rgba(0,0,0,.10);
    }
    .count{ color:var(--mut); font-size:12px; }
    .leftgroup{ display:flex; gap:10px; align-items:center; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Архив фактури</h1>

    <div class="bar">
      <input id="q" class="search" placeholder="Търси: номер, клиент, дата..." />
      <button class="btn" id="refresh">Обнови</button>
      <button class="btn acc" id="printSelected">Печат избраните</button>
    </div>

    <div class="card">
      <div class="topline">
        <div class="leftgroup">
          <label style="display:flex;gap:8px;align-items:center;cursor:pointer;">
            <input id="checkAll" type="checkbox" class="chk" />
            <span class="count">Избери всички</span>
          </label>
          <span class="count" id="selCount">Избрани: 0</span>
        </div>
        <span class="count" id="meta"></span>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:46px;"></th>
            <th>Номер</th>
            <th>Дата</th>
            <th>Клиент</th>
            <th class="right">Сума</th>
            <th class="right">Печат</th>
          </tr>
        </thead>
        <tbody id="rows"></tbody>
      </table>
    </div>

    <div class="mut" id="foot"></div>
  </div>

<script>
  const $ = (id) => document.getElementById(id);
  const norm = (s) => (s ?? "").toString().toLowerCase();

  async function loadIndex(){
    const res = await fetch("./invoices.index.json?_=" + Date.now());
    if(!res.ok) throw new Error("Cannot load invoices.index.json");
    return res.json();
  }

  function rowHtml(it){
    const file = "./html/" + encodeURIComponent(it.id) + ".html";
    return \`
      <tr data-id="\${it.id}">
        <td><input type="checkbox" class="chk sel" data-id="\${it.id}"></td>
        <td class="num">\${it.number || ""}</td>
        <td>\${it.date || ""}</td>
        <td>\${it.buyer || ""}</td>
        <td class="right">\${it.total || ""}</td>
        <td class="right"><a href="\${file}" target="_blank">Print</a></td>
      </tr>
    \`;
  }

  function getSelectedIds(){
    return Array.from(document.querySelectorAll(".sel:checked")).map(x => x.dataset.id);
  }

  function updateSelCount(){
    $("selCount").textContent = "Избрани: " + getSelectedIds().length;
  }

  function openBatchPrint(ids){
    if(!ids.length){
      alert("Няма избрани фактури.");
      return;
    }

    const docs = ids.map(id => "./html/" + encodeURIComponent(id) + ".html");
    const w = window.open("", "_blank");
    if(!w){
      alert("Поп-ъпът е блокиран. Разреши pop-ups за този сайт и пробвай пак.");
      return;
    }

    w.document.open();
    w.document.write(\`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Batch print</title>
  <style>
    body{ margin:0; }
    .page{ page-break-after: always; }
    iframe{ width:100%; height: 297mm; border:0; }
    @media print{
      .page{ page-break-after: always; }
      iframe{ height: 297mm; }
    }
  </style>
</head>
<body>
  \${docs.map(src => \`<div class="page"><iframe src="\${src}"></iframe></div>\`).join("")}
</body>
</html>\`);
    w.document.close();

    const s = w.document.createElement("script");
    s.textContent = "(function(){const frames=Array.from(document.querySelectorAll('iframe'));let loaded=0;frames.forEach(f=>f.addEventListener('load',()=>{loaded++;if(loaded===frames.length){setTimeout(()=>window.print(),500);}}));})();";
    w.document.body.appendChild(s);
  }

  async function render(){
    const data = await loadIndex();
    const list = (data.items || []);

    const q = norm($("q").value);
    const filtered = !q ? list : list.filter(it => {
      const s = norm([it.number, it.date, it.buyer, it.total].join(" "));
      return s.includes(q);
    });

    $("rows").innerHTML = filtered.map(rowHtml).join("");

    $("meta").textContent = "Последно обновяване: " + (data.generatedAt || "");
    $("foot").textContent = "Общо: " + filtered.length + " фактури";

    $("checkAll").checked = false;
    updateSelCount();

    document.querySelectorAll(".sel").forEach(chk => chk.addEventListener("change", updateSelCount));
  }

  $("refresh").addEventListener("click", () => render().catch(e => alert(e.message)));
  $("q").addEventListener("input", () => render().catch(()=>{}));

  $("checkAll").addEventListener("change", (e) => {
    const on = e.target.checked;
    document.querySelectorAll(".sel").forEach(chk => chk.checked = on);
    updateSelCount();
  });

  $("printSelected").addEventListener("click", () => openBatchPrint(getSelectedIds()));

  render().catch(e => alert(e.message));
</script>
</body>
</html>`;
}

function main() {
  const raw = readJson();
  const invoices = asArray(raw);

  // ✅ Генерираме директно в preview/ (за GitHub Pages artifact path: preview)
  ensureDir("preview/archive");
  ensureDir("preview/archive/html");
  ensureDir("data/tmp");

  const items = [];

  invoices.forEach((inv, idx) => {
    const idRaw = inv.documentID || inv.documentId || inv.id || inv.number || `inv_${idx + 1}`;
    const id = safeId(idRaw);

    const number = inv.number || idRaw;
    const date = inv.date || "";
    const buyer = inv.buyerName || inv.BuyerName || "";
    const currency = inv.documentCurrency || inv.DocumentCurrency || "BGN";
    const total = fmtMoney(
      inv.documentAmount ?? inv.DocumentAmount ?? inv.amountLeftToBePaid ?? inv.totalNetAmount ?? "",
      currency
    );

    const tmpJson = path.join("data/tmp", `${id}.json`);
    fs.writeFileSync(tmpJson, JSON.stringify(inv, null, 2), "utf8");

    const outHtml = path.join("preview/archive/html", `${id}.html`);
    execFileSync("node", ["src/render_one.js", "--in", tmpJson, "--out", outHtml], { stdio: "inherit" });

    items.push({
      id: escapeHtml(String(id)),
      number: escapeHtml(String(number)),
      date: escapeHtml(String(date)),
      buyer: escapeHtml(String(buyer)),
      total: escapeHtml(String(total)),
    });
  });

  fs.writeFileSync(
    "preview/archive/invoices.index.json",
    JSON.stringify({ generatedAt: new Date().toISOString(), items }, null, 2),
    "utf8"
  );

  // ✅ Пишем правилния archive/index.html в preview/
  fs.writeFileSync("preview/archive/index.html", archiveIndexHtmlTemplate(), "utf8");

  console.log(`Archive generated in preview/: ${items.length} invoices`);
}

main();
