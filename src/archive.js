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
  if (data.invoices && Array.isArray(data.invoices)) return data.invoices;
  if (data.items && Array.isArray(data.items)) return data.items;
  return [data];
}

function pick(obj, keys) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== "") {
      return obj[k];
    }
  }
  return "";
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function main() {
  const raw = readJson();
  const arr = asArray(raw);

  ensureDir("archive/html");

  const items = [];

  arr.forEach((inv, i) => {
    const id =
      pick(inv, ["id", "InvoiceId", "DocumentNumber", "number"]) ||
      `inv_${i + 1}`;

    const number =
      pick(inv, ["DocumentNumber", "number", "invoiceNo"]) || id;

    const date =
      pick(inv, ["DocumentDate", "date", "issueDate"]) || "";

    const buyer =
      pick(inv, ["BuyerName", "CustomerName", "PartnerName"]) || "";

    const total =
      pick(inv, ["TotalForPayment", "Total", "Amount"]) || "";

    const currency =
      pick(inv, ["DocumentCurrency", "Currency"]) || "";

    // HTML — използваме последния export като preview
    let html = "<html><body>Preview not found</body></html>";
    if (fs.existsSync("export/eurofaktura-filled.html")) {
      html = fs.readFileSync("export/eurofaktura-filled.html", "utf8");
    } else if (fs.existsSync("preview/index.html")) {
      html = fs.readFileSync("preview/index.html", "utf8");
    }

    fs.writeFileSync(path.join("archive/html", `${id}.html`), html, "utf8");

    items.push({
      id,
      number: escapeHtml(number),
      date: escapeHtml(date),
      buyer: escapeHtml(buyer),
      total: escapeHtml(`${total} ${currency}`.trim())
    });
  });

  ensureDir("archive");

  fs.writeFileSync(
    "archive/invoices.index.json",
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        items
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`Archive index generated: ${items.length} invoices`);
}

main();
