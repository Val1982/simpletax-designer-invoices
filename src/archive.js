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

function main() {
  const raw = readJson();
  const invoices = asArray(raw);

  ensureDir("archive");
  ensureDir("archive/html");
  ensureDir("data/tmp");

  const items = [];

  invoices.forEach((inv, idx) => {
    const idRaw = inv.documentID || inv.documentId || inv.id || inv.number || `inv_${idx + 1}`;
    const id = safeId(idRaw);

    const number = inv.number || idRaw;
    const date = inv.date || "";
    const buyer = inv.buyerName || "";
    const currency = inv.documentCurrency || "BGN";
    const total = fmtMoney(
      inv.documentAmount ?? inv.amountLeftToBePaid ?? inv.totalNetAmount ?? "",
      currency
    );

    // 1) записваме временен JSON за тази фактура
    const tmpJson = path.join("data/tmp", `${id}.json`);
    fs.writeFileSync(tmpJson, JSON.stringify(inv, null, 2), "utf8");

    // 2) рендърваме отделен HTML за нея
    const outHtml = path.join("archive/html", `${id}.html`);
    execFileSync("node", ["src/render_one.js", "--in", tmpJson, "--out", outHtml], {
      stdio: "inherit",
    });

    items.push({
      id: escapeHtml(String(id)),
      number: escapeHtml(String(number)),
      date: escapeHtml(String(date)),
      buyer: escapeHtml(String(buyer)),
      total: escapeHtml(String(total)),
    });
  });

  fs.writeFileSync(
    "archive/invoices.index.json",
    JSON.stringify({ generatedAt: new Date().toISOString(), items }, null, 2),
    "utf8"
  );

  console.log(`Archive generated: ${items.length} invoices`);
}

main();
