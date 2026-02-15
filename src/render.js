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
  if (fs.existsSync("data/invoices.json")) {
    return JSON.parse(fs.readFileSync("data/invoices.json", "utf8"));
  }
  if (fs.existsSync("data/last_response.json")) {
    return JSON.parse(fs.readFileSync("data/last_response.json", "utf8"));
  }
  return {};
}

function pickInvoice(parsed) {
  if (Array.isArray(parsed)) return parsed[0] || {};
  if (parsed.invoice) return parsed.invoice;
  return parsed;
}

function buildLogoHtml(inv) {
  const b = inv.branding || {};
  const logo = b.logoBase64 || b.logoUrl || "";
  if (!logo) return "";
  return `<img class="logo" src="${escapeHtml(logo)}" alt="Logo" />`;
}

function buildWatermarkHtml(inv) {
  const b = inv.branding || {};
  const wm = b.watermarkBase64 || b.watermarkUrl || "";
  if (!wm) return "";
  return `<div class="watermark" style="background-image:url('${escapeHtml(wm)}')"></div>`;
}

function buildItems(inv) {
  const items = inv.items || [];
  const currency = inv.currency || "BGN";

  if (!items.length) {
    return `<div class="row"><div class="desc"><div class="title">No items</div></div></div>`;
  }

  return items.map(it => {
    return `
      <div class="row">
        <div class="desc">
          <div class="title">${escapeHtml(it.name || it.description || "")}</div>
          <div class="sub">${escapeHtml(it.note || "")}</div>
        </div>
        <div class="nums">
          <div>${escapeHtml(it.qty || "")}</div>
          <div>${money(it.unitPrice || it.price || "", currency)}</div>
          <div class="price">${money(it.total || "", currency)}</div>
        </div>
      </div>
    `;
  }).join("");
}

async function main() {
  const parsed = readData();
  const inv = pickInvoice(parsed);

  const template = fs.readFileSync("preview/template.html", "utf8");

  const qrText = inv.qrText || inv.paymentLink || "";
  const qrSvg = await buildQrSvg(qrText);

  const replacements = {
    "{{LOGO}}": buildLogoHtml(inv),
    "{{WATERMARK}}": buildWatermarkHtml(inv),
    "{{QR}}": qrSvg,
    "{{BUYER_NAME}}": escapeHtml(inv.buyer?.name || ""),
    "{{BUYER_COMPANY}}": escapeHtml(inv.buyer?.company || ""),
    "{{BUYER_PHONE}}": escapeHtml(inv.buyer?.phone || ""),
    "{{BUYER_EMAIL}}": escapeHtml(inv.buyer?.email || ""),
    "{{BUYER_ADDRESS}}": escapeHtml(inv.buyer?.address || ""),
    "{{SELLER_ADDRESS}}": escapeHtml(inv.seller?.address || ""),
    "{{SELLER_PHONE}}": escapeHtml(inv.seller?.phone || ""),
    "{{INVOICE_NO}}": escapeHtml(inv.number || ""),
    "{{INVOICE_DATE}}": escapeHtml(inv.issueDate || ""),
    "{{DUE_DATE}}": escapeHtml(inv.dueDate || ""),
    "{{ITEM_ROWS}}": buildItems(inv),
    "{{PAY_BANK}}": escapeHtml(inv.payment?.bank || ""),
    "{{PAY_IBAN}}": escapeHtml(inv.payment?.iban || ""),
    "{{PAY_BIC}}": escapeHtml(inv.payment?.bic || ""),
    "{{PAY_HOLDER}}": escapeHtml(inv.payment?.holder || ""),
    "{{SUBTOTAL}}": money(inv.subtotal || "", inv.currency),
    "{{VAT}}": money(inv.vatTotal || "", inv.currency),
    "{{TOTAL}}": money(inv.total || "", inv.currency)
  };

  let html = template;
  for (const key in replacements) {
    html = html.replaceAll(key, replacements[key]);
  }

  fs.writeFileSync("preview/index.html", html);
  console.log("Preview generated.");
}

main();
