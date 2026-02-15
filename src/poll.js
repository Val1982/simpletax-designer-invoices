import fs from "fs";

const endpoint = process.env.EF_ENDPOINT;
const username = process.env.EF_USERNAME;
const token = process.env.EF_TOKEN;


if (!endpoint || !username || !token) {
  throw new Error("Missing EF_ENDPOINT / EF_USERNAME / EF_TOKEN. Check GitHub Secrets.");
}

async function efCall(method, parameters = {}) {
  const payload = { username, token, method, parameters };
  if (secretKey && String(secretKey).trim() !== "") {
    payload.secretKey = secretKey;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const text = await res.text();

  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync("data/last_response.txt", text);

  // Не падаме ако не е JSON — просто го пазим
  try {
    return JSON.parse(text);
  } catch {
    fs.writeFileSync("data/error.html", text);
    return { _nonJson: true, _httpStatus: res.status };
  }
}

async function main() {
  const result = await efCall("SalesInvoiceList", { status: "IssuedInvoice" });

  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync("data/sample.json", JSON.stringify(result, null, 2));

  console.log("Done. Saved data/sample.json and data/last_response.txt");
}

await main();
