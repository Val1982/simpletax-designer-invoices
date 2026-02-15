import fs from "fs";

const endpoint = process.env.EF_ENDPOINT;
const username = process.env.EF_USERNAME;
const secretKey = process.env.EF_SECRETKEY;
const token = process.env.EF_TOKEN;

if (!endpoint || !username || !secretKey || !token) {
  throw new Error("Missing EF_* env vars. Check GitHub Secrets.");
}

async function efCall(method, parameters = {}) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, secretKey, token, method, parameters })
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 500)}`);
  }

  if (!res.ok) {
    fs.mkdirSync("data", { recursive: true });
    fs.writeFileSync("data/error.html", text);
    throw new Error(`Non-JSON response (${res.status}). Saved full response to data/error.html`);

  }
  return data;
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync("state.json", "utf8"));
  } catch {
    return { lastIssuedTimestamp: "2026-01-01 00:00:00" };
  }
}

function writeState(state) {
  fs.writeFileSync("state.json", JSON.stringify(state, null, 2));
}

async function main() {
  const state = readState();

  // тестово: дърпаме фактури от cursor нататък
  const resp = await efCall("SalesInvoiceList", {
    issuedTimestampFrom: state.lastIssuedTimestamp,
    status: "IssuedInvoice"
  });

  // записваме каквото върне за да видим структурата
  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync("data/sample.json", JSON.stringify(resp, null, 2));

  // пробваме да намерим docs в най-честите структури
  const list = resp?.result ?? resp?.Result ?? resp?.documents ?? resp?.Documents ?? resp;
  const docs = Array.isArray(list) ? list : (list?.Documents ?? list?.documents ?? []);

  // обновяваме cursor = max issuedTimestamp
  let maxTs = state.lastIssuedTimestamp;
  for (const d of docs) {
    const ts = d.issuedTimestamp;
    if (ts && String(ts) > String(maxTs)) maxTs = ts;
  }

  if (String(maxTs) > String(state.lastIssuedTimestamp)) {
    state.lastIssuedTimestamp = maxTs;
    writeState(state);
  }

  console.log(`Fetched ${docs.length} invoices. Cursor=${state.lastIssuedTimestamp}`);
}

await main();
