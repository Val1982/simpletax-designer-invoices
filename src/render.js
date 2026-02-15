import fs from "fs";
import path from "path";

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function money(n) {
  if (n === null || n === undefined || n === "") return "";
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  return num.toFixed(2);
}

function pickInvoice(list) {
  // 1) ако има state.json и seen ids — не ни трябва. Вземаме последната по issuedTimestamp
  const sorted = [...list].sort((a, b) => String(a.issuedTimestamp).localeCompare(String(b.issuedTimestamp)));
  return sorted[sorted.length - 1];
}

function loadFromLastResponse() {
  const rawPath = "data/last_response.txt";
  if (!fs.existsSync(rawPath)) throw new Error("Missing data/last_response.txt");
  const raw = fs.readFileSync(rawPath, "utf8");
  const json = JSON.parse(raw);
  const arr = json?.response?.result;
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error("last_response has no response.result invoices");
  }
  return pickInvoice(arr);
}

function renderHTML(inv) {
  const items = Array.isArray(inv.Items) ? inv.Items : [];

  const title = `Фактура ${inv.number || ""}`.trim();

  // Минимален “modern” стил за preview (после ще го направим 1:1 по картинката)
  return `<!doctype html>
<html lang="bg">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<style>
  :root{
    --dark:#0b5a3a; /* тъмно зелено (временно) */
    --muted:#6b7280;
    --line:#e5e7eb;
    --card:#ffffff;
    --bg:#f6f7f9;
  }
  *{box-sizing:border-box}
  body{margin:0;font-family:Inter,system-ui,Segoe UI,Roboto,Arial,sans-serif;background:var(--bg);color:#111827}
  .page{max-width:900px;margin:24px auto;padding:24px}
  .sheet{background:#fff;border:1px solid var(--line);border-radius:18px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.06)}
  .top{display:flex;gap:18px;padding:18px 18px 0 18px}
  .left{flex:1}
  .right{width:240px;display:flex;align-items:center;justify-content:center;border:1px dashed var(--line);border-radius:14px;min-height:120px;color:var(--muted)}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0 18px}
  .card{border:1px solid var(--line);border-radius:14px;background:var(--card);overflow:hidden}
  .bar{background:var(--dark);color:#fff;font-weight:700;padding:10px 12px}
  .body{padding:10px 12px;color:#111827}
  .kv{display:flex;justify-content:space-between;gap:10px;padding:4px 0;border-bottom:1px dashed #eef0f3}
  .kv:last-child{border-bottom:none}
  .k{color:var(--muted)}
  .v{font-weight:600;text-align:right}
  .pay{display:flex;gap:12px;padding:0 18px 18px 18px}
  .pay .card{flex:1}
  .tableWrap{padding:0 18px 18px 18px}
  table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden}
  thead th{background:#f3f4f6;color:#111827;text-align:left;font-size:13px;padding:10px;border-bottom:1px solid var(--line)}
  tbody td{padding:10px;border-bottom:1px solid #f0f2f5;font-size:14px;vertical-align:top}
  tbody tr:last-child td{border-bottom:none}
  .num{text-align:right;white-space:nowrap}
  .foot{padding:0 18px 18px 18px;display:flex;justify-content:flex-end}
  .total{width:360px;border:1px solid var(--line);border-radius:14px;overflow:hidden}
  .total .bar{display:flex;justify-content:space-between;align-items:center}
  .total .bar span:last-child{font-size:18px}
  .wm{
    position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
    pointer-events:none;opacity:.06;font-size:120px;font-weight:800;letter-spacing:.08em;
    transform:rotate(-18deg);
  }
  .sheetPos{position:relative}
</style>
</head>
<body>
  <div class="page">
    <div class="sheet sheetPos">
      <div class="wm">SIMPLETAX</div>

      <div class="top">
        <div class="left">
          <div class="grid">
            <div class="card">
              <div class="bar">Доставчик</div>
              <div class="body">
                <div class="kv"><div class="k">Име</div><div class="v">${esc(inv.operatorName || "")}</div></div>
                <div class="kv"><div class="k">Град</div><div class="v">${esc(inv.city || "")}</div></div>
              </div>
            </div>
            <div class="card">
              <div class="bar">Получател</div>
              <div class="body">
                <div class="kv"><div class="k">Име</div><div class="v">${esc(inv.buyerName || "")}</div></div>
                <div class="kv"><div class="k">ЕИК/Булстат</div><div class="v">${esc(inv.buyerTaxNumber || "")}</div></div>
                <div class="kv"><div class="k">Адрес</div><div class="v">${esc((inv.buyerCity || "") + ", " + (inv.buyerStreet || ""))}</div></div>
              </div>
            </div>

            <div class="card">
              <div class="bar">Фактура</div>
              <div class="body">
                <div class="kv"><div class="k">Номер</div><div class="v">${esc(inv.number || "")}</div></div>
                <div class="kv"><div class="k">Дата</div><div class="v">${esc(inv.date || "")}</div></div>
                <div class="kv"><div class="k">Падеж</div><div class="v">${esc(inv.paymentDueDate || "")}</div></div>
              </div>
            </div>

            <div class="card">
              <div class="bar">Банкови детайли</div>
              <div class="body">
                <div class="kv"><div class="k">IBAN</div><div class="v">${esc(inv.bankAccountNumber || "")}</div></div>
                <div class="kv"><div class="k">Основание</div><div class="v">${esc(inv.reference || "")}</div></div>
                <div class="kv"><div class="k">Метод</div><div class="v">${esc(inv.methodOfPayment || "")}</div></div>
              </div>
            </div>
          </div>
        </div>

        <div class="right">
          Лого / QR (preview)
        </div>
      </div>

      <div class="tableWrap">
        <table>
          <thead>
            <tr>
              <th style="width:44px">#</th>
              <th>Описание</th>
              <th style="width:90px" class="num">Кол.</th>
              <th style="width:90px" class="num">Ед.</th>
              <th style="width:120px" class="num">Цена</th>
              <th style="width:120px" class="num">Сума</th>
            </tr>
          </thead>
          <tbody>
            ${
              items.length
                ? items
                    .map(
                      (it) => `<tr>
                <td>${esc(it.position)}</td>
                <td>
                  <div style="font-weight:700">${esc(it.productName || it.productCode || "")}</div>
                  <div style="color:var(--muted);font-size:13px">${esc(it.description || "")}</div>
                </td>
                <td class="num">${esc(money(it.quantity))}</td>
                <td class="num">${esc(it.unit || "")}</td>
                <td class="num">${esc(money(it.priceInDocumentCurrency ?? it.price))} ${esc(inv.documentCurrency || "")}</td>
                <td class="num" style="font-weight:800">${esc(money(it.amount))} ${esc(inv.documentCurrency || "")}</td>
              </tr>`
                    )
                    .join("")
                : `<tr><td colspan="6" style="color:var(--muted)">Няма Items в тази фактура.</td></tr>`
            }
          </tbody>
        </table>
      </div>

      <div class="foot">
        <div class="total">
          <div class="bar">
            <span>Сума за плащане</span>
            <span>${esc(money(inv.amountLeftToBePaid ?? inv.documentAmount))} ${esc(inv.documentCurrency || "")}</span>
          </div>
          <div class="body">
            <div class="kv"><div class="k">Общо</div><div class="v">${esc(money(inv.documentAmount))} ${esc(inv.documentCurrency || "")}</div></div>
            <div class="kv"><div class="k">Платено</div><div class="v">${esc(money(inv.amountAlreadyPaid))} ${esc(inv.documentCurrency || "")}</div></div>
            <div class="kv"><div class="k">Остава</div><div class="v">${esc(money(inv.amountLeftToBePaid))} ${esc(inv.documentCurrency || "")}</div></div>
          </div>
        </div>
      </div>

    </div>
  </div>
</body>
</html>`;
}

function main() {
  const inv = loadFromLastResponse();
  const html = renderHTML(inv);

  fs.mkdirSync("preview", { recursive: true });
  fs.writeFileSync(path.join("preview", "invoice.html"), html, "utf8");
  fs.writeFileSync(path.join("preview", "invoice.json"), JSON.stringify(inv, null, 2), "utf8");

  console.log("Rendered preview/invoice.html and preview/invoice.json");
}

main();
