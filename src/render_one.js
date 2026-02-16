import fs from "fs";
import path from "path";
import QRCode from "qrcode";

function arg(name, def = null) {
  const i = process.argv.indexOf(name);
  if (i === -1) return def;
  return process.argv[i + 1] ?? def;
}

function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function fmtDate(s) {
  if (!s) return "";
  // очакваме YYYY-MM-DD; оставяме както е
  return String(s);
}

function fmtMoney(n, curr) {
  if (n === null || n === undefined || n === "") return "";
  const num = Number(n);
  const val = Number.isFinite(num) ? (Number.isInteger(num) ? String(num) : num.toFixed(2)) : String(n);
  return `${val} ${curr || ""}`.trim();
}

function pick(obj, keys, def = "") {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return def;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function main() {
  const inPath = arg("--in");
  const outPath = arg("--out");
  if (!inPath || !outPath) {
    console.error("Usage: node src/render_one.js --in data/tmp/X.json --out preview/archive/html/X.html");
    process.exit(1);
  }

  const inv = JSON.parse(fs.readFileSync(inPath, "utf8"));

  // ===== Data mapping (EuroFaktura JSON -> template fields) =====
  const number = pick(inv, ["number", "DocumentNumber"], "");
  const docId = pick(inv, ["documentID", "documentId", "id"], "");
  const docBarcode = pick(inv, ["documentIdBarCode", "documentIdBarcode", "documentIdBarCodeText"], "");
  const currency = pick(inv, ["documentCurrency", "DocumentCurrency"], "BGN");
  const date = fmtDate(pick(inv, ["date", "DocumentDate"], ""));
  const due = fmtDate(pick(inv, ["paymentDueDate", "PaymentDueDate"], ""));

  const buyerName = pick(inv, ["buyerName", "BuyerName"], "");
  const buyerStreet = pick(inv, ["buyerStreet", "BuyerStreet"], "");
  const buyerPostal = pick(inv, ["buyerPostalCode", "BuyerPostalCode"], "");
  const buyerCity = pick(inv, ["buyerCity", "BuyerCity"], "");
  const buyerCountry = pick(inv, ["buyerCountry", "BuyerCountry"], "");
  const buyerVat = pick(inv, ["buyerTaxNumber", "buyerVatNumber", "BuyerTaxNumber"], "");

  const operatorName = pick(inv, ["operatorName", "DocumentIssuerName"], "");
  const iban = pick(inv, ["bankAccountNumber", "IBAN"], "");
  const method = pick(inv, ["methodOfPayment", "MethodOfPayment"], "");
  const reference = pick(inv, ["reference", "Reference"], "");

  // Динамично лого/воден знак (ако ги имаш в JSON)
  // Може после да ги подаваме от ЕвроФактура настройки или от твоя бекенд.
  const logoUrl = pick(inv, ["logoUrl", "LogoUrl", "organizationLogoUrl", "OrganizationLogoUrl"], "");
  const watermarkUrl = pick(inv, ["watermarkUrl", "WatermarkUrl"], "");

  const items = Array.isArray(inv.Items) ? inv.Items : (Array.isArray(inv.items) ? inv.items : []);
  const total = pick(inv, ["documentAmount", "totalNetAmount", "TotalForPayment", "amountLeftToBePaid"], 0);
  const subtotal = pick(inv, ["totalNetAmount", "documentAmount"], total);

  // QR payload
  const qrPayload =
    docBarcode ||
    (docId ? `ID:${docId}` : "") ||
    (number ? `INV:${number}` : "SimpleTax");

  const qrDataUrl = await QRCode.toDataURL(String(qrPayload), {
    errorCorrectionLevel: "M",
    margin: 0,
    scale: 6,
    color: { dark: "#0b1220", light: "#ffffff" },
  });

  // ===== HTML/CSS (A4, 1:1 style close to reference) =====
  const html = `<!doctype html>
<html lang="bg">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Invoice ${escapeHtml(number || docId)}</title>
  <style>
    /* --- Print / Page --- */
    @page { size: A4; margin: 0; }
    html, body { height: 100%; }
    body { margin: 0; background:#e9eef5; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; }

    /* A4 canvas (approx) */
    .sheet{
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: #fff;
      position: relative;
      overflow: hidden;
    }

    /* Decorative shapes (similar to reference) */
    .shape-left{
      position:absolute; left:-35mm; top:-35mm;
      width: 90mm; height: 90mm; border-radius: 50%;
      background: #1f2a33;
      opacity: .95;
    }
    .shape-right{
      position:absolute; right:-40mm; top:-35mm;
      width: 110mm; height: 110mm; border-radius: 50%;
      background: #2ecc71;
      opacity: .95;
    }
    .top-bar{
      position:absolute; left:70mm; top:10mm;
      width: 85mm; height: 16mm;
      border-radius: 10mm;
      background: #1f2a33;
      opacity: .95;
    }

    /* Watermark */
    .watermark{
      position:absolute;
      right: 18mm;
      top: 34mm;
      font-weight: 800;
      letter-spacing: .35em;
      font-size: 26pt;
      color: rgba(0,0,0,.18);
      user-select: none;
      z-index: 1;
    }
    .watermark-img{
      position:absolute;
      right: 16mm;
      top: 30mm;
      width: 80mm;
      opacity: .06;
      z-index: 1;
      pointer-events:none;
    }

    /* Layout grid */
    .content{ position: relative; z-index: 2; padding: 16mm 16mm 14mm 16mm; }
    .row{ display:flex; gap: 10mm; }
    .col{ flex:1; }

    /* Logo */
    .logo-wrap{ height: 22mm; display:flex; align-items:flex-start; }
    .logo{
      height: 18mm;
      max-width: 70mm;
      object-fit: contain;
    }
    .logo-fallback{
      font-weight:900; font-size: 20pt; color:#1f2a33; line-height:1;
    }
    .tagline{ margin-top: 2mm; font-size: 9pt; color:#667; font-weight:600; }

    /* QR */
    .qrbox{
      position:absolute;
      top: 10mm; right: 16mm;
      width: 24mm; height: 24mm;
      background:#fff;
      border: 2px solid #2ecc71;
      border-radius: 3mm;
      display:flex; align-items:center; justify-content:center;
      padding: 2mm;
    }
    .qrbox img{ width: 100%; height: 100%; object-fit: contain; }

    /* Invoice title */
    .title{
      text-align:right;
      margin-top: 6mm;
      font-size: 30pt;
      font-weight: 900;
      letter-spacing: .22em;
      color: rgba(0,0,0,.18);
    }
    .line-green{
      width: 75mm; height: 1.2mm; background:#2ecc71;
      margin-left:auto; margin-top: 3mm; border-radius: 1mm;
    }

    /* Buyer block */
    .label{ font-size: 8pt; color:#6b7280; font-weight:800; letter-spacing:.06em; }
    .buyer-name{ font-size: 14pt; font-weight: 900; color:#101828; margin-top: 2mm; }
    .buyer-sub{ font-size: 9pt; color:#344054; margin-top: 1mm; line-height: 1.35; }

    /* Meta mini table (Invoice No / Date / Due) */
    .meta{
      margin-top: 8mm;
      margin-left:auto;
      width: 92mm;
      border-top: 2px solid #2ecc71;
      padding-top: 3mm;
    }
    .meta-grid{
      display:grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 0;
      border: 1px solid rgba(0,0,0,.08);
      border-left: 0;
      border-right: 0;
      padding: 3mm 0;
    }
    .meta-cell{ padding: 0 3mm; border-right: 1px solid rgba(0,0,0,.08); }
    .meta-cell:last-child{ border-right: 0; }
    .meta-k{ font-size: 7.5pt; color:#667085; font-weight:800; }
    .meta-v{ font-size: 9.5pt; color:#101828; font-weight:900; margin-top: 1mm; }

    /* Items table */
    .items{
      margin-top: 14mm;
      border-radius: 4mm;
      overflow:hidden;
      border: 1px solid rgba(0,0,0,.08);
    }
    .items-head{
      display:grid;
      grid-template-columns: 1.8fr .6fr .8fr .8fr;
      background: linear-gradient(90deg, #2ecc71 0%, #2ecc71 52%, #1f2a33 52%, #1f2a33 100%);
      color:#fff;
      font-weight:900;
      font-size: 10pt;
    }
    .items-head div{ padding: 4mm 5mm; }
    .items-body .r{
      display:grid;
      grid-template-columns: 1.8fr .6fr .8fr .8fr;
      border-top: 1px solid rgba(0,0,0,.06);
      font-size: 10pt;
      align-items:center;
    }
    .items-body .r div{ padding: 4mm 5mm; }
    .items-body .desc{ font-weight:800; color:#101828; }
    .items-body .mut{ font-size: 8pt; color:#667085; margin-top: 1mm; font-weight:600; }
    .right{ text-align:right; }
    .center{ text-align:center; }

    /* Totals block */
    .totals-row{ display:flex; justify-content:flex-end; margin-top: 14mm; }
    .totals{
      width: 86mm;
      border-radius: 4mm;
      overflow:hidden;
      background:#1f2a33;
      color:#fff;
    }
    .totals .line{
      display:flex; justify-content:space-between;
      padding: 4mm 5mm;
      font-weight:900;
      font-size: 10pt;
      border-bottom: 1px solid rgba(255,255,255,.10);
    }
    .totals .total{
      background:#2ecc71;
      color:#062012;
      display:flex; justify-content:space-between;
      padding: 5mm 5mm;
      font-weight: 1000;
      font-size: 12pt;
    }

    /* Bottom thanks */
    .thanks{
      position:absolute;
      left: 16mm; right: 16mm;
      bottom: 16mm;
      height: 18mm;
      background:#2ecc71;
      border-radius: 4mm;
      display:flex; align-items:center;
      padding: 0 8mm;
      color:#fff;
      font-weight: 1000;
      font-size: 16pt;
    }

    /* Print helpers */
    @media print{
      body{ background:#fff; }
      .sheet{ box-shadow:none; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="shape-left"></div>
    <div class="shape-right"></div>
    <div class="top-bar"></div>

    ${watermarkUrl ? `<img class="watermark-img" src="${escapeHtml(watermarkUrl)}" alt="watermark">` : `<div class="watermark">INVOICE</div>`}

    <div class="qrbox"><img src="${qrDataUrl}" alt="QR"></div>

    <div class="content">
      <div class="row">
        <div class="col">
          <div class="logo-wrap">
            ${
              logoUrl
                ? `<img class="logo" src="${escapeHtml(logoUrl)}" alt="logo">`
                : `<div>
                     <div class="logo-fallback">SimpleTax</div>
                     <div class="tagline">Accounting • ERP • AI</div>
                   </div>`
            }
          </div>

          <div style="margin-top: 10mm;">
            <div class="label">INVOICE TO</div>
            <div class="buyer-name">${escapeHtml(buyerName || "Client Name")}</div>
            <div class="buyer-sub">
              ${escapeHtml(buyerStreet)}<br/>
              ${escapeHtml([buyerPostal, buyerCity].filter(Boolean).join(" "))}${buyerCountry ? `<br/>${escapeHtml(buyerCountry)}` : ""}
              ${buyerVat ? `<br/><span class="label">VAT:</span> ${escapeHtml(buyerVat)}` : ""}
            </div>
          </div>
        </div>

        <div class="col">
          <div class="title">INVOICE</div>
          <div class="line-green"></div>

          <div class="meta">
            <div class="meta-grid">
              <div class="meta-cell">
                <div class="meta-k">Invoice No</div>
                <div class="meta-v">${escapeHtml(number || docId || "")}</div>
              </div>
              <div class="meta-cell">
                <div class="meta-k">Invoice Date</div>
                <div class="meta-v">${escapeHtml(date)}</div>
              </div>
              <div class="meta-cell">
                <div class="meta-k">Due Date</div>
                <div class="meta-v">${escapeHtml(due)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="items">
        <div class="items-head">
          <div>Item Description</div>
          <div class="center">Quantity</div>
          <div class="right">Unit Price</div>
          <div class="right">Total</div>
        </div>

        <div class="items-body">
          ${
            items.length
              ? items
                  .map((it) => {
                    const name = pick(it, ["productName", "name", "ItemDescription"], "Item");
                    const desc = pick(it, ["description", "longDescription"], "");
                    const qty = pick(it, ["quantity", "qty"], 1);
                    const unitPrice = pick(it, ["priceInDocumentCurrency", "price", "netPriceInDocumentCurrency", "netPrice"], "");
                    const amount = pick(it, ["amount", "amountWithoutDiscount"], "");
                    return `
                      <div class="r">
                        <div>
                          <div class="desc">${escapeHtml(name)}</div>
                          ${desc ? `<div class="mut">${escapeHtml(desc)}</div>` : ``}
                        </div>
                        <div class="center">${escapeHtml(qty)}</div>
                        <div class="right">${escapeHtml(fmtMoney(unitPrice, currency))}</div>
                        <div class="right"><b>${escapeHtml(fmtMoney(amount, currency))}</b></div>
                      </div>
                    `;
                  })
                  .join("")
              : `
                <div class="r">
                  <div class="desc">No items</div>
                  <div class="center">—</div>
                  <div class="right">—</div>
                  <div class="right">—</div>
                </div>
              `
          }
        </div>
      </div>

      <div class="totals-row">
        <div class="totals">
          <div class="line"><span>Subtotal</span><span>${escapeHtml(fmtMoney(subtotal, currency))}</span></div>
          <div class="line"><span>Reference</span><span>${escapeHtml(reference || number || "")}</span></div>
          <div class="total"><span>TOTAL</span><span>${escapeHtml(fmtMoney(total, currency))}</span></div>
        </div>
      </div>

      <div style="margin-top: 10mm; color:#667085; font-size:9pt; font-weight:700;">
        ${operatorName ? `Issued by: ${escapeHtml(operatorName)}<br/>` : ``}
        ${method ? `Payment method: ${escapeHtml(method)}<br/>` : ``}
        ${iban ? `IBAN: ${escapeHtml(iban)}<br/>` : ``}
      </div>

    </div>

    <div class="thanks">Thank you for your business!</div>
  </div>
</body>
</html>`;

  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, html, "utf8");
  console.log("Wrote:", outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
