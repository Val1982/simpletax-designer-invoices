import fs from "fs";

const endpoint = process.env.EF_ENDPOINT;
const username = process.env.EF_USERNAME;
const token = process.env.EF_TOKEN;

// ВАЖНО: ако EF_SECRETKEY липсва -> става "" (а не undefined), за да НЕ се маха от JSON
const secretKey = (process.env.EF_SECRETKEY ?? "");

if (!endpoint || !username || !token) {
  throw new Error("Missing EF_ENDPOINT / EF_USERNAME / EF_TOKEN. Check GitHub Secrets.");
}

// Диагностика (без да показва ключа):
// ако е 0, значи EF_SECRETKEY НЕ е подаден към action-а
const secretKeyLen = String(secretKey).length;

async function efCall(method, parameters = {}) {
  const payload = {
    username,
    secretKey, // винаги присъства (дори да е празен)
    token,
    method,
    parameters
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const text = await res.text();

  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync("data/last_response.txt", text);

  // Запиши и диагностичен файл (без чувствителни данни)
  fs.writeFileSync(
    "data/diag.json",
    JSON.stringify(
      {
        endpoint,
        usernamePresent: Boolean(username),
        tokenPresent: Boolean(token),
        secretKeyLen,
        method,
        httpStatus: res.status
      },
      null,
      2
    )
  );

  return text;
}

async function main() {
  // проба: list по issuedTimestampFrom
  const text = await efCall("SalesInvoiceList", {
    issuedTimestampFrom: "2026-01-01 00:00:00",
    status: "IssuedInvoice"
  });

  // ако е JSON – запази го красиво
  try {
    const json = JSON.parse(text);
    fs.writeFileSync("data/sample.json", JSON.stringify(json, null, 2));
  } catch {
    fs.writeFileSync("data/error.html", text);
  }

  console.log("Done. Check data/diag.json and data/sample.json (or data/error.html).");
}

await main();
