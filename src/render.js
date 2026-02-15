import fs from "fs";
import path from "path";

const DATA_DIR = "data";
const PREVIEW_DIR = "preview";
const INVOICES_FILE = path.join(DATA_DIR, "invoices.json");
const OUT_FILE = path.join(PREVIEW_DIR, "index.html");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function money(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return "";
  return x.toFixed(2);
}

function renderInvoice(inv) {
  const items = inv?.Items || [];
  const rows = items
    .map(
      (it) => `
      <tr>
        <td>${esc(it.productCode)}</td>
        <td><b>${esc(it.productName)}</b><div class="muted">${esc(it.description)}</div></td>
        <td class="right">${esc(it.unit)}</td>
        <td class="right">${money(it.quantity)}</td>
        <td class="right">${money(it.netPriceInDocumentCurrency ?? it.netPrice)}</td>
        <td class="right"><b>${money(it.amount)}</b></td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Invoice Preview</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial; background:#f6f7f9; margin:0; padding:24px;}
    .page{max-width:980px; margin:0 auto; background:#fff; border:1px solid #e5e7eb; border-radius:16px; overflow:hidden; box-shadow:0 6px 18px rgba(0,0,0,.06);}
    .top{display:flex; gap:18px; padding:22px; border-bottom:1px solid #eee;}
    .left{flex:1;}
    .right{width:320px;}
    .badge{display:inline-block; padding:8px 12px; border-radius:999px; background:#0b3f2e; color:#fff; font-weight:700; letter-spacing:.3px;}
    .h1{font-size:34px; font-weight:900; margin:12px 0 0; color:#111827;}
    .grid{display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-top:14px;}
    .card{border:1px solid #e5e7eb; border-radius:14px; overflow:hidden;}
    .card .hdr{background:#0b3f2e; color:#fff; font-weight:800; padding:10px 12px;}
    .card .bd{padding:10px 12px; font-size:13px; color:#111827; line-height:1.45;}
    .muted{color:#6b7280; font-size:12px;}
    table{width:100%; border-collapse:collapse;}
    th,td{padding:10px 12px; border-bottom:1px solid #eef2f7; font-size:13px;}
    th{background:#0b3f2e; color:#fff; text-align:left;}
    .right{text-align:right;}
    .totals{display:flex; justify-content:flex-end; padding:18px 22px;}
    .totalBox{width:360px; border:1px solid #e5e7eb; border-radius:14px; overflow:hidden;}
    .totalBox .hdr{background:#0b3f2e; color:#fff; font-weight:900; padding:12px;}
    .totalBox .bd{padding:12px;}
    .row{display:flex; justify-content:space-between; padding:6px 0; font-size:13px;}
    .row b{font-size:14px;}
    .foot{padding:18px 22px; color:#6b7280; font-size:12px; border-top:1px solid #eee;}
  </style>
</head>
<body>
  <div class="page">
    <div class="top">
      <div class="left">
        <span class="badge">SIMPLETAX • PREVIEW</span>
        <div class="h1">ФАКТУРА № ${esc(inv.number)}</div>
        <div class="muted">Издадена: ${esc(inv.date)} • Падеж: ${esc(inv.paymentDueDate)} • Плащане: ${esc(inv.methodOfPayment)}</div>

        <div class="grid">
          <div class="card">
            <div class="hdr">Клиент</div>
            <div class="bd">
              <b>${esc(inv.buyerName)}</b><br/>
              ${esc(inv.buyerStreet)}<br/>
              ${esc(inv.buyerPostalCode)} ${esc(inv.buyerCity)}<br/>
              ${esc(inv.buyerCountry)} • ${esc(inv.buyerTaxNumber)}
            </div>
          </div>
          <div class="card">
            <div class="hdr">Банка</div>
            <div class="bd">
              IBAN: <b>${esc(inv.bankAccountNumber)}</b><br/>
              Основание: <b>${esc(inv.reference)}</b><br/>
              Оператор: ${esc(inv.operatorName)}<br/>
              Issued: ${esc(inv.issuedTimestamp)}
            </div>
          </div>
        </div>
      </div>

      <div class="right">
        <div class="card">
          <div class="hdr">Сума за плащане</div>
          <div class="bd">
            <div style="font-size:34px;font-weight:950;color:#0b3f2e;">${money(inv.amountLeftToBePaid)}</div>
            <div class="muted">${esc(inv.documentCurrency)}</div>
          </div>
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:110px">Код</th>
          <th>Описание</th>
          <th style="width:90px" class="right">Ед.</th>
          <th style="width:90px" class="right">К-во</th>
          <th style="width:140px" class="right">Цена</th>
          <th style="width:140px" class="right">Сума</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="6" class="muted">Няма редове.</td></tr>`}
      </tbody>
    </table>

    <div class="totals">
      <div class="totalBox">
        <div class="hdr">Общо</div>
        <div class="bd">
          <div class="row"><span>Нетно</span><b>${money(inv.totalNetAmount)}</b></div>
          <div class="row"><span>ДДС</span><b>${money(inv.totalVatAmountNormalRate ?? 0)}</b></div>
          <div class="row"><span>Документ</span><b>${money(inv.documentAmount)}</b></div>
        </div>
      </div>
    </div>

    <div class="foot">
      Това е preview файл, генериран от GitHub Actions. Не е официалният PDF от ЕвроФактура.
    </div>
  </div>
</body>
</html>`;
}

function main() {
  ensureDir(PREVIEW_DIR);
  const invoices = readJsonSafe(INVOICES_FILE, []);
  const last = Array.isArray(invoices) && invoices.length ? invoices[invoices.length - 1] : null;

  const html = last
    ? renderInvoice(last)
    : `<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:24px">
        <h2>Няма данни за preview</h2>
        <p>Няма <code>data/invoices.json</code> или е празен. Когато има нови фактури, preview ще се обнови.</p>
      </body>`;

  fs.writeFileSync(OUT_FILE, html, "utf8");
  console.log("Wrote", OUT_FILE);
}

main();
