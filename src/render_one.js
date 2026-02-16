import fs from "fs";
import path from "path";
import QRCode from "qrcode";

/**
 * render_one.js
 * Usage:
 *   node src/render_one.js --in data/tmp_invoice.json --out archive/html/60_77740.html
 *
 * Очаква JSON обект на една фактура със полета като:
 * number, date, paymentDueDate, buyerName, Items[], documentAmount, documentCurrency ...
 */

function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function money(v, cur) {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  const s = Number.isFinite(n) ? (Number.isInteger(n) ? String(n) : n.toFixed(2)) : String(v);
  return `${s} ${cur || ""}`.trim();
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--in") out.in = args[++i];
    else if (a === "--out") out.out = args[++i];
  }
  if (!out.in || !out.out) {
    console.error("Usage: node src/render_one.js --in <file.json> --out <file.html>");
    process.exit(1);
  }
  return out;
}

function buildInvoiceHtml(inv, qrDataUrl) {
  const number = escapeHtml(inv.number || "");
  const date = escapeHtml(inv.date || "");
  const due = escapeHtml(inv.paymentDueDate || "");
  const buyer = escapeHtml(inv.buyerName || "");
  const buyerStreet = escapeHtml(inv.buyerStreet || "");
  const buyerCity = escapeHtml(inv.buyerCity || "");
  const buyerPostal = escapeHtml(inv.buyerPostalCode || "");
  const cur = inv.documentCurrency || "BGN";

  const items = Array.isArray(inv.Items) ? inv.Items : [];
  const rows =
    items.length
      ? items
          .map((it) => {
            const name = escapeHtml(it.productName || it.description || "");
            const qty = escapeHtml(it.quantity ?? "");
            const unitPrice = escapeHtml(money(it.priceInDocumentCurrency ?? it.price ?? "", cur));
            const total = escapeHtml(money(it.amount ?? it.netPriceInDocumentCurrency ?? "", cur));
            return `
              <tr>
                <td class="desc">
                  <div class="title">${name || "-"}</div>
                </td>
                <td class="num">${qty}</td>
                <td class="num">${unitPrice}</td>
                <td class="num b">${total}</td>
              </tr>
            `;
          })
          .join("")
      : `<tr><td class="desc"><div class="title">No items</div></td><td class="num">—</td><td class="num">—</td><td class="num">—</td></tr>`;

  const subtotal = money(inv.totalNetAmount ?? inv.documentAmount ?? "", cur);
  const total = money(inv.documentAmount ?? inv.amountLeftToBePaid ?? "", cur);

  // Минимален HTML (стабилен за браузър). По-късно ще го направим 1:1 с PSD.
  return `<!doctype html>
<html lang="bg">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Invoice ${number}</title>
<style>
  :root{ --g:#2ecc71; --d:#1f2a33; --t:#0b1220; --mut:#667085; --line:#e6e8ec; }
  *{ box-sizing:border-box; }
  body{ margin:0; font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial; background:#fff; color:var(--t); }
  .page{ width:210mm; min-height:297mm; padding:14mm; }
  .top{ display:flex; justify-content:space-between; align-items:flex-start; gap:14px; }
  .qr{ width:28mm; height:28mm; border:2px solid var(--g); border-radius:10px; padding:4px; }
  .qr img{ width:100%; height:100%; }
  .h1{ font-size:44px; letter-spacing:10px; color:#b9b9b9; font-weight:900; text-align:right; margin:0; }
  .meta{ margin-top:6mm; width:100%; border-top:4px solid var(--g); padding-top:3mm; }
  .meta table{ width:100%; border-collapse:collapse; font-size:12px; }
  .meta th{ text-align:left; color:var(--mut); padding:2px 0; font-weight:800; }
  .meta td{ padding:2px 0; font-weight:800; }
  .bill{ margin-top:8mm; }
  .bill .label{ font-weight:900; font-size:12px; color:var(--mut); }
  .bill .name{ font-weight:900; font-size:20px; margin-top:2mm; }
  .bill .addr{ font-size:12px; color:var(--mut); margin-top:2mm; line-height:1.35; }
  .table{ margin-top:10mm; border:1px solid var(--line); border-radius:12px; overflow:hidden; }
  .thead{ background:linear-gradient(90deg,var(--g),var(--g)); color:#fff; font-weight:900; }
  table.items{ width:100%; border-collapse:collapse; font-size:13px; }
  .thead th{ padding:12px; text-align:left; }
  .thead th.num{ text-align:right; }
  .items td{ padding:12px; border-top:1px solid var(--line); vertical-align:top; }
  .items td.num{ text-align:right; white-space:nowrap; }
  .title{ font-weight:900; }
  .b{ font-weight:900; }
  .totals{ margin-top:10mm; display:flex; justify-content:flex-end; }
  .box{ width:90mm; border-radius:14px; overflow:hidden; border:1px solid var(--line); }
  .box .row{ display:flex; justify-content:space-between; padding:10px 12px; background:#f7f7f8; font-weight:800; }
  .box .row.dark{ background:var(--d); color:#fff; }
  .box .row.green{ background:var(--g); color:#fff; font-size:18px; font-weight:900; }
  .footer{ margin-top:16mm; background:var(--g); color:#fff; font-weight:900; padding:14px; border-radius:14px; font-size:22px; }
</style>
</head>
<body>
  <div class="page">
    <div class="top">
      <div>
        <div class="bill">
          <div class="label">INVOICE TO</div>
          <div class="name">${buyer || "Client Name"}</div>
          <div class="addr">
            ${buyerStreet ? buyerStreet + "<br/>" : ""}
            ${buyerPostal || buyerCity ? `${buyerPostal} ${buyerCity}` : ""}
          </div>
        </div>
      </div>
      <div style="flex:1">
        <p class="h1">INVOICE</p>
        <div class="meta">
          <table>
            <tr>
              <th>Invoice No</th><td>${number}</td>
              <th>Invoice Date</th><td>${date}</td>
              <th>Due Date</th><td>${due}</td>
            </tr>
          </table>
        </div>
      </div>
      <div class="qr">
        <img alt="QR" src="${qrDataUrl}" />
      </div>
    </div>

    <div class="table">
      <table class="items">
        <thead class="thead">
          <tr>
            <th>Item Description</th>
            <th class="num">Quantity</th>
            <th class="num">Unit Price</th>
            <th class="num">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>

    <div class="totals">
      <div class="box">
        <div class="row dark"><span>Subtotal</span><span>${escapeHtml(subtotal)}</span></div>
        <div class="row green"><span>TOTAL</span><span>${escapeHtml(total)}</span></div>
      </div>
    </div>

    <div class="footer">Thank you for your business!</div>
  </div>
</body>
</html>`;
}

async function main() {
  const { in: inFile, out: outFile } = parseArgs();
  const inv = JSON.parse(fs.readFileSync(inFile, "utf8"));

  // QR съдържание: най-сигурно е да сложим баркода/референцията/ID
  const qrText =
    inv.documentIdBarCode ||
    inv.reference ||
    inv.documentID ||
    inv.number ||
    "SIMPLETAX";

  const qrDataUrl = await QRCode.toDataURL(String(qrText), { margin: 1, width: 220 });

  const html = buildInvoiceHtml(inv, qrDataUrl);

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, html, "utf8");
  console.log(`Rendered: ${outFile}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
