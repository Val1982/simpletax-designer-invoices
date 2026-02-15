import fs from "fs";
import path from "path";

const DATA_DIR = "data";
const STATE_FILE = "state.json";
const LAST_RESPONSE_FILE = path.join(DATA_DIR, "last_response.txt");
const DIAG_FILE = path.join(DATA_DIR, "diag.json");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf8");
}

function writeText(filePath, text) {
  fs.writeFileSync(filePath, text ?? "", "utf8");
}

function isNoDocumentsFound(json) {
  const desc = json?.response?.description || "";
  return desc.includes("#noDocumentsFound") || desc.toLowerCase().includes("nodocumentsfound");
}

async function efCall({ endpoint, username, secretKey, token, method, parameters }) {
  const payload = {
    username,
    secretKey: secretKey ?? "",
    token,
    method,
    parameters: parameters ?? {},
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  writeText(LAST_RESPONSE_FILE, text);

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    // Ако връща HTML/не-JSON, това е реален проблем
    throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 300)}`);
  }

  // Ако API връща "noDocumentsFound" -> това НЕ е грешка, а празен резултат
  if (json?.response?.status === "error" && isNoDocumentsFound(json)) {
    return { ok: true, empty: true, json };
  }

  if (json?.response?.status !== "ok") {
    throw new Error(json?.response?.description || "API error");
  }

  return { ok: true, empty: false, json };
}

function toIsoLikeEf(ts) {
  // приемаме, че ts вече е във формат "YYYY-MM-DD HH:mm:ss"
  return ts;
}

function maxIssuedTimestamp(docs) {
  let max = null;
  for (const d of docs || []) {
    const t = d?.issuedTimestamp;
    if (!t) continue;
    if (!max || t > max) max = t;
  }
  return max;
}

function addOneSecond(ts) {
  // ts: "YYYY-MM-DD HH:mm:ss"
  // добавяме 1 секунда, за да не теглим последния документ пак
  const [datePart, timePart] = ts.split(" ");
  const [Y, M, D] = datePart.split("-").map(Number);
  const [hh, mm, ss] = timePart.split(":").map(Number);

  const dt = new Date(Date.UTC(Y, M - 1, D, hh, mm, ss));
  dt.setUTCSeconds(dt.getUTCSeconds() + 1);

  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())} ${pad(
    dt.getUTCHours()
  )}:${pad(dt.getUTCMinutes())}:${pad(dt.getUTCSeconds())}`;
}

async function main() {
  ensureDir(DATA_DIR);

  const endpoint = process.env.EF_ENDPOINT || "https://eurofaktura.bg/WebServicesBG/API";
  const username = process.env.EF_USERNAME;
  const token = process.env.EF_TOKEN;
  const secretKey = process.env.EF_SECRETKEY ?? ""; // трябва да е string, дори празен

  if (!username || !token) {
    throw new Error("Missing EF_USERNAME or EF_TOKEN in GitHub Secrets");
  }

  // state.json: { "lastIssuedTimestamp": "YYYY-MM-DD HH:mm:ss" }
  const state = readJsonSafe(STATE_FILE, { lastIssuedTimestamp: "2026-01-01 00:00:00" });
  const issuedFrom = toIsoLikeEf(state.lastIssuedTimestamp || "2026-01-01 00:00:00");

  // Диагностика
  writeJson(DIAG_FILE, {
    endpoint,
    usernamePresent: !!username,
    tokenPresent: !!token,
    secretKeyLen: (secretKey || "").length,
    method: "SalesInvoiceList",
    issuedTimestampFrom_used: issuedFrom,
  });

  const { empty, json } = await efCall({
    endpoint,
    username,
    secretKey,
    token,
    method: "SalesInvoiceList",
    parameters: {
      issuedTimestampFrom: issuedFrom,
    },
  });

  // Ако няма нови документи -> зелено, нищо не пипаме по cursor-a
  if (empty) {
    writeJson(path.join(DATA_DIR, "summary.json"), {
      pulled_total: 0,
      fresh_after_dedupe: 0,
      issuedTimestampFrom_used: issuedFrom,
      newestIssuedTimestamp_found: null,
      note: "No new documents (noDocumentsFound). This is OK.",
    });
    console.log("OK: No new documents since cursor:", issuedFrom);
    return;
  }

  const docs = json?.response?.result || [];
  const newest = maxIssuedTimestamp(docs);

  // Записваме резултат
  writeJson(path.join(DATA_DIR, "invoices.json"), docs);

  // Обновяваме cursor-а само ако има newest
  if (newest) {
    const nextCursor = addOneSecond(newest);
    writeJson(STATE_FILE, { lastIssuedTimestamp: nextCursor });

    writeJson(path.join(DATA_DIR, "summary.json"), {
      pulled_total: docs.length,
      issuedTimestampFrom_used: issuedFrom,
      newestIssuedTimestamp_found: newest,
      nextCursor_saved: nextCursor,
    });

    console.log("Pulled:", docs.length, "newest:", newest, "nextCursor:", nextCursor);
  } else {
    // Няма issuedTimestamp в резултата (рядко), не пипаме state
    writeJson(path.join(DATA_DIR, "summary.json"), {
      pulled_total: docs.length,
      issuedTimestampFrom_used: issuedFrom,
      newestIssuedTimestamp_found: null,
      note: "No issuedTimestamp in returned docs; state not changed.",
    });
    console.log("Pulled:", docs.length, "but no issuedTimestamp found. State unchanged.");
  }
}

await main();
