import fs from "fs";

const endpoint = process.env.EF_ENDPOINT;
const username = process.env.EF_USERNAME;
const secretKey = (process.env.EF_SECRETKEY ?? "");
const token = process.env.EF_TOKEN;

if (!endpoint || !username || !token) throw new Error("Missing EF_ENDPOINT / EF_USERNAME / EF_TOKEN.");
if (!secretKey) throw new Error("EF_SECRETKEY missing/empty.");

const STATE_FILE = "state.json";

function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    return { issuedTimestampFrom: "2026-01-01 00:00:00", seenDocumentIDs: [] };
  }
  const s = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  if (!Array.isArray(s.seenDocumentIDs)) s.seenDocumentIDs = [];
  if (!s.issuedTimestampFrom) s.issuedTimestampFrom = "2026-01-01 00:00:00";
  return s;
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function efCall(method, parameters = {}) {
  const payload = { username, secretKey, token, method, parameters };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const text = await res.text();

  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync("data/last_response.txt", text);

  const json = JSON.parse(text);

  if (json?.response?.status !== "ok") {
    fs.writeFileSync("data/error.json", JSON.stringify(json, null, 2));
    throw new Error(json?.response?.description || "API error");
  }

  return json;
}

function maxTimestamp(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

// "YYYY-MM-DD HH:mm:ss" -> +1 second
function addOneSecond(ts) {
  const iso = ts.replace(" ", "T") + "Z";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return ts;

  d.setUTCSeconds(d.getUTCSeconds() + 1);

  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear() +
    "-" + pad(d.getUTCMonth() + 1) +
    "-" + pad(d.getUTCDate()) +
    " " + pad(d.getUTCHours()) +
    ":" + pad(d.getUTCMinutes()) +
    ":" + pad(d.getUTCSeconds())
  );
}

async function main() {
  const state = loadState();
  const issuedFrom = state.issuedTimestampFrom;

  const json = await efCall("SalesInvoiceList", {
    issuedTimestampFrom: issuedFrom,
    status: "IssuedInvoice"
  });

  const invoices = Array.isArray(json?.response?.result) ? json.response.result : [];

  // dedupe по documentID
  const seen = new Set(state.seenDocumentIDs);
  const fresh = [];
  for (const inv of invoices) {
    const id = inv.documentID || inv.documentId || inv.id;
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    fresh.push(inv);
  }

  const runStamp = new Date().toISOString().replace(/[:.]/g, "-");
  fs.writeFileSync(`data/invoices_${runStamp}.json`, JSON.stringify(fresh, null, 2));

  // най-нов timestamp от всички върнати
  let newest = issuedFrom;
  for (const inv of invoices) {
    newest = maxTimestamp(newest, inv.issuedTimestamp);
  }

  // ВАЖНО: inclusive -> винаги +1 секунда
  const nextCursor = addOneSecond(newest);

  // ограничаваме seen IDs
  const seenArr = Array.from(seen);
  const MAX_SEEN = 2000;
  state.seenDocumentIDs = seenArr.slice(Math.max(0, seenArr.length - MAX_SEEN));

  state.issuedTimestampFrom = nextCursor;
  saveState(state);

  fs.writeFileSync(
    "data/summary.json",
    JSON.stringify(
      {
        pulled_total: invoices.length,
        fresh_after_dedupe: fresh.length,
        issuedTimestampFrom_used: issuedFrom,
        newestIssuedTimestamp_found: newest,
        nextCursor_saved: nextCursor
      },
      null,
      2
    )
  );

  console.log(`Pulled ${invoices.length} invoices (${fresh.length} fresh). Next cursor: ${nextCursor}`);
}

await main();
