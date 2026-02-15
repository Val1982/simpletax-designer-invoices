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
  // за preview държим BG форматиране
  return `${n.toLocaleString("bg-BG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

async function buildQrSvg(text) {
  if (!text) return "";
  // SVG е най-остро за печат/preview
  return QRCode.toString(text, { type: "svg", margin: 0, width: 160 });
}

function pickInvoice(parsed) {
  // поддържаме: масив / {invoice:...} / директно обект
  if (Array.isArray(parsed)) return parsed[0] || {};
  if (parsed && typeof parsed === "object" && parsed.invoice) return parsed.invoice;
  return parsed || {};
}

function readDataFile() {
  const p1 = "data/invoices.json";
  const p2 = "data/last_response.json";

  const dataPath = fs.existsSync(p1) ? p1 : (fs.existsSync(p2) ? p2 : null);
  if (!dataPath) return { dataPath: null, raw: null, parsed: null };

  const raw = fs.readFileSync(dataPath, "utf-8");
  const parsed = JSON.parse(raw);
  return { dataPath, raw, parsed };
}

function safeGet(obj, path, fallback = "") {
  try {
    const parts = path.split(".");
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return fallback;
      cur = cur[p];
    }
    return (cur === undefined || cur === null || cur === "") ? fallback : cur;
  } catch {
    return fallback;
  }
}

function buildLogoHtml(inv) {
  const b = inv.branding || {};
  const logo =
    (typeof b.logoBase64 === "string" && b.logoBase64.startsWith("data:") ? b.logoBase64 : "") ||
    (typeof b.logoUrl === "string" ? b.logoUrl : "");

  if (!logo) return "";
  return `<img class="logo" src="${escapeHtml(logo)}" alt="Logo" />`;
}

function buildWatermarkHtml(inv) {
  const b = inv.branding || {};
  const wm =
    (typeof b.watermarkBase64 === "string" && b.watermarkBase64.startsWith("data:") ? b.watermarkBase64 : "") ||
    (typeof b.wate
