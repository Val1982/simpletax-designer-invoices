import fs from "fs";

const endpoint = process.env.EF_ENDPOINT;
const username = process.env.EF_USERNAME;
const secretKey = process.env.EF_SECRETKEY || "";
const token = process.env.EF_TOKEN;

if (!endpoint || !username || !token) {
  throw new Error("Missing EF_ENDPOINT / EF_USERNAME / EF_TOKEN.");
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
  fs.writeFileSync(`data/${method}_raw.txt`, text);

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function main() {
  fs.mkdirSync("data", { recursive: true });

  // БЕЗ НИКАКВИ ПАРАМЕТРИ
  const result = await efCall("SalesInvoiceList", {});

  fs.writeFileSync(
    "data/full_dump.json",
    JSON.stringify(result, null, 2)
  );

  console.log("Saved full_dump.json");
}

await main();
