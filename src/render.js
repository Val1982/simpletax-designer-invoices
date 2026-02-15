import fs from "fs";
import QRCode from "qrcode";

function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function pick(obj, paths, fallback = "") {
  for (const p of paths) {
    const parts = p.split(".");
    let cur = obj;
    let ok = true;
    for (const part of parts) {
      if (cur == null || !(part in cur)) { ok = false; break; }
      cur = cur[part];
    }
    if (ok && cur !== undefined && cur !== null && String(cur).trim() !== "") return cur;
  }
  return fallback;
}

function money(x, currency = "BGN") {
  if (x === null || x === undefined || x === "") return "";
  const n = Number(x);
  if (Number.isNaN(n)) return escapeHtml(String(x));
  return `${n.toLocaleString("bg-BG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

async function buildQrSvg(text) {
  if (!text) return "";
  return QRCode.toString(text, { type: "svg", margin: 0, width: 160 });
}

function readData() {
  if (fs.existsSync("data/invoices.json")) return JSON.parse(fs.readFileSync("data/invoices.json", "utf8"));
  if (fs.existsSync("data/last_response.json")) return JSON.parse(fs.readFileSync("data/last_response.json", "utf8"));
  return {};
}

function pickInvoice(parsed) {
  if (Array.isArray(parsed)) return parsed[0] || {};
  if (parsed && parsed.invoice) return parsed.invoice;
  return parsed || {};
}

function getBranding(inv) {
  const b = inv.branding || {};
  return {
    logo: pick(b, ["logoBase64", "logoUrl"], ""),
    watermark: pick(b, ["watermarkBase64", "watermarkUrl"], ""),
    primary: pick(b, ["primaryColor"], "#27AE60"),
    accent: pick(b, ["accentColor"], "#2ECC71"),
    dark: pick(b, ["darkColor"], "#1F2A33")
  };
}

function buildLogoHtml(inv) {
  const { logo } = getBranding(inv);
  if (!logo) return "";
  return `<img class="logo" src="${escapeHtml(logo)}" alt="Logo" />`;
}

function buildWatermarkHtml(inv) {
  const { watermark } = getBranding(inv);
  if (!watermark) return "";
  return `<div class="watermark" style="background-image:url('${escapeHtml(watermark)}')"></div>`;
}

function buildItems(inv) {
  const items = Array.isArray(inv.items) ? inv.items : (Array.isArray(inv.Rows) ? inv.Rows : []);
  const currency = pick(inv, ["currency", "Currency"], "BGN");

  if (!items.length) {
    return `
      <div class="row">
        <div class="desc">
          <div class="title">No items</div>
          <div class="sub">—</div>
        </div>
        <div class="nums">
          <div>—</div>
          <div>—</div>
          <div class="price">—</div>
        </div>
      </div>
    `;
  }

  return items.map((it) => {
    const title = pick(it, ["name", "description", "itemName", "ItemName"], "Item");
    const sub = pick(it, ["note", "details", "comment"], "");
    const qty = pick(it, ["qty", "quantity", "Qty"], "");
    const unit = pick(it, ["unitPrice", "price", "unit_price", "UnitPrice"], "");
    const total = pick(it, ["total", "lineTotal", "amount", "LineTotal"], "");

    return `
      <div class="row">
        <div class="desc">
          <div class="title">${escapeHtml(title)}</div>
          <div class="sub">${escapeHtml(sub)}</div>
        </div>
        <div class="nums">
          <div>${escapeHtml(qty)}</div>
          <div>${money(unit, currency)}</div>
          <div class="price">${money(total, currency)}</div>
        </div>
      </div>
    `;
  }).join("");
}

function injectBrandColors(template, branding) {
  // Заменяме първия :root{...} блок с обновени цветове (ако структурата е същата)
  // Ако не го намери — не чупим нищо.
  const rootBlock = `:root{`;
  const idx = template.indexOf(rootBlock);
  if (idx < 0) return template;

  // Вкарваме само 3-те променливи (зелено/акцент/тъмно)
  // Останалите остават както са в template.
  const patch = `:root{
      --green:${branding.primary};
      --green2:${branding.accent};
      --dark:${branding.dark};`;

  return template.replace(rootBlock, patch);
}

async function main() {
  const parsed = readData();
  const inv = pickInvoice(parsed);

  let template = fs.readFileSync("preview/template.html", "utf8");

  const branding = getBranding(inv);
  template = injectBrandColors(template, branding);

  // Buyer/Seller mappings
  const buyer = inv.buyer || inv.customer || inv.Client || {};
  const seller = inv.seller || inv.company || inv.Supplier || {};

  // QR text (fallback)
  const qrText = pick(inv, ["qrText", "paymentLink", "publicLink", "Links.Public", "links.public"], "");
  const qrSvg = qrText ? await buildQrSvg(qrText) : await buildQrSvg("https://simpletax.bg");

  // Totals
  const currency = pick(inv, ["currency", "Currency"], "BGN");
  const subtotal = pick(inv, ["totals.subtotal", "subtotal", "Totals.Subtotal"], "");
  const vat = pick(inv, ["totals.vatTotal", "vatTotal", "Totals.Vat", "Totals.VAT"], "");
  const total = pick(inv, ["totals.grandTotal", "total", "Totals.Total", "grandTotal"], "");

  // Payment
  const payBank = pick(inv, ["payment.bank", "Payment.Bank"], "") || pick(seller, ["bank", "Bank"], "");
  const payIban = pick(inv, ["payment.iban", "Payment.IBAN", "Payment.Iban"], "") || pick(seller, ["iban", "IBAN", "Iban"], "");
  const payBic = pick(inv, ["payment.bic", "Payment.BIC", "Payment.Bic"], "") || pick(seller, ["bic", "BIC", "Bic"], "");
  const payHolder = pick(inv, ["payment.holder", "Payment.Holder"], "") || pick(seller, ["name", "Name"], "");

  const replacements = {
    "{{LOGO}}": buildLogoHtml(inv),
    "{{WATERMARK}}": buildWatermarkHtml(inv),
    "{{QR}}": qrSvg,

    "{{BUYER_NAME}}": escapeHtml(pick(buyer, ["name", "contactName", "Name"], "Client Name")),
    "{{BUYER_COMPANY}}": escapeHtml(pick(buyer, ["company", "companyName", "Company"], pick(buyer, ["name", "Name"], "Company"))),
    "{{BUYER_PHONE}}": escapeHtml(pick(buyer, ["phone", "Phone"], "")),
    "{{BUYER_EMAIL}}": escapeHtml(pick(buyer, ["email", "Email"], "")),
    "{{BUYER_ADDRESS}}": escapeHtml(pick(buyer, ["address", "Address"], "")),

    "{{SELLER_ADDRESS}}": escapeHtml(pick(seller, ["address", "Address"], "")),
    "{{SELLER_PHONE}}": escapeHtml(pick(seller, ["phone", "Phone"], "")),

    "{{INVOICE_NO}}": escapeHtml(pick(inv, ["number", "invoiceNo", "InvoiceNo", "No"], "")),
    "{{INVOICE_DATE}}": escapeHtml(pick(inv, ["issueDate", "date", "InvoiceDate"], "")),
    "{{DUE_DATE}}": escapeHtml(pick(inv, ["dueDate", "DueDate"], "")),

    "{{ITEM_ROWS}}": buildItems(inv),

    "{{PAY_BANK}}": escapeHtml(payBank),
    "{{PAY_IBAN}}": escapeHtml(payIban),
    "{{PAY_BIC}}": escapeHtml(payBic),
    "{{PAY_HOLDER}}": escapeHtml(payHolder),

    "{{SUBTOTAL}}": money(subtotal, currency),
    "{{VAT}}": money(vat, currency),
    "{{TOTAL}}": money(total, currency),
  };

  let html = template;
  for (const [k, v] of Object.entries(replacements)) {
    html = html.replaceAll(k, v);
  }

  fs.writeFileSync("preview/index.html", html, "utf8");
  console.log("Preview generated.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
