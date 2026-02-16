import fs from "fs";
import path from "path";

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
  if (Number.isNaN(n)) return `${amount} ${currency || ""}`.trim();
  // simple: 2 decimals only if needed
  const s = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return `${s} ${currency || ""}`.trim();
}

function main() {
  const raw = readJson();
  const invoices = asArray(raw);

  ensureDir("archive/html");

  const items = invoices.map((inv, idx) => {
    const id = inv.documentID || inv.documentId || inv.id || inv.number || `inv_${idx + 1}`;
    const number = inv.number || inv.DocumentNumber || inv.documentNumber || id;
    const date = inv.date || inv.DocumentDate || inv.documentDate || "";
    const buyer = inv.buyerName || inv.BuyerName || inv.customerName || "";
    const currency = inv.documentCurrency || inv.DocumentCurrency || inv.currency || "";
    const total = fmtMoney(
      inv.documentAmount ?? inv.amountLeftToBePaid ?? inv.totalNetAmount ?? inv.totalAmountInVatReportingCurr ?? "",
      currency
    );

    // HTML за печат: засега ползваме последния export или preview
    let html = "<html><body>Preview not found</body></html>";
    if (fs.existsSync("export/eurofaktura-filled.html")) {
      html = fs.readFileSync("export/eurofaktura-filled.html", "utf8");
    } else if (fs.existsSync("preview/index.html")) {
      html = fs.readFileSync("preview/index.html", "utf8");
    }
    fs.writeFileSync(path.join("archive/html", `${id}.html`), html, "utf8");

    return {
      id: escapeHtml(String(id)),
      number: escapeHtml(String(number)),
      date: escapeHtml(String(date)),
      buyer: escapeHtml(String(buyer)),
      total: escapeHtml(String(total))
    };
  });

  ensureDir("archive");
  fs.writeFileSync(
    "archive/invoices.index.json",
    JSON.stringify({ generatedAt: new Date().toISOString(), items }, null, 2),
    "utf8"
  );

  console.log(`Archive index generated: ${items.length} invoices`);
}

main();
