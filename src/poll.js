import fs from "fs";

const endpoint = process.env.EF_ENDPOINT;
const username = process.env.EF_USERNAME;
const secretKey = (process.env.EF_SECRETKEY ?? "");
const token = process.env.EF_TOKEN;

if (!endpoint || !username || !token) throw new Error("Missing EF_ENDPOINT / EF_USERNAME / EF_TOKEN.");
if (!secretKey) throw new Error("EF_SECRETKEY missing/empty.");

// ---- state ----
const STATE_FILE = "state.json";
function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    return { issuedTimestampFrom: "2026-01-01 00:00:00" }; // стартова стойност
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
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

// "2026-01-30 09:47:29" -> sortable string already, but we still keep max by compare
function maxTimestamp(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

async function main() {
  const state = loadState();

  const issuedFrom = state.issuedTimestampFrom || "2026-01-01 00:00:00";

  const json = await efCall("SalesInvoiceList", {
    issuedTimestampFrom: issuedFrom,
    status: "IssuedInvoice"
  });

  const invoices = Array.isArray(json?.response?.result) ? json.response.result : [];

  // запиши snapshot на този run
  const runStamp = new Date().toISOString().replace(/[:.]/g, "-");
  fs.writeFileSync(`data/invoices_${runStamp}.json`, JSON.stringify(invoices, null, 2));

  // намери най-новия issuedTimestamp
  let newest = issuedFrom;
  for (const inv of invoices) {
    newest = maxTimestamp(newest, inv.issuedTimestamp);
  }

  // ако има нови, премести курсора 1 секунда напред, за да не дърпа пак същата
  // (ще добавим +1 сек в следваща стъпка, ако се налага; засега пазим точно newest)
  state.issuedTimestampFrom = newest;
  saveState(state);

  // кратък лог
  fs.writeFileSync(
    "data/summary.json",
    JSON.stringify(
      {
        pulled: invoices.length,
        issuedTimestampFrom_used: issuedFrom,
        newestIssuedTimestamp_found: newest
      },
      null,
      2
    )
  );

  console.log(`Pulled ${invoices.length} invoices. Cursor now: ${newest}`);
}

await main();
