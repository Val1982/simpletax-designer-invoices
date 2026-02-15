import fs from "fs";

const endpoint = process.env.EF_ENDPOINT;
const username = process.env.EF_USERNAME;
// secretKey е optional при WebServicesBG (може да е празен)
const secretKey = process.env.EF_SECRETKEY || "";
const token = process.env.EF_TOKEN;

if (!endpoint || !username || !token) {
  throw new Error("Missing EF_ENDPOINT / EF_USERNAME / EF_TOKEN. Check GitHub Secrets.");
}

async function efCall(method, parameters = {}) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, secretKey, token, method, parameters })
  });

  const text = await res.text();

  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync("data/last_response.txt", text);

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    fs.writeFileSync("data/error.html", text);
    throw new Error(`Non-JSON response (${res.status}). Saved to data/error.html`);
  }

  if (!res.ok || (data?.response?.status && data.response.status !== "ok")) {
    fs.writeFileSync("data/error.json", JSON.stringify(data, null, 2));
    throw new Error(`API error. Saved to data/error.json`);
  }

  return data;
}

async function main() {
  const data = await efCall("SalesInvoiceList", { status: "IssuedInvoice" });
  fs.writeFileSync("data/sample.json", JSON.stringify(data, null, 2));
  console.log("OK. Saved response to data/sample.json");
}

await main();
