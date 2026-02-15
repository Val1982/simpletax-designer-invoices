import fs from "fs";

const endpoint = process.env.EF_ENDPOINT;
const username = process.env.EF_USERNAME;
const secretKey = process.env.EF_SECRETKEY;
const token = process.env.EF_TOKEN;

if (!endpoint || !username || !secretKey || !token) {
  throw new Error("Missing EF_* env vars. Check GitHub Secrets.");
}

async function efCall(method, parameters = {}) {
  const paramsXml = Object.entries(parameters)
    .map(([k, v]) => `<parameter name="${k}" value="${String(v).replaceAll('"', "&quot;")}" />`)
    .join("\n");

  const xml =
`<?xml version="1.0" encoding="utf-8"?>
<request>
  <login username="${username}" secretKey="${secretKey}" token="${token}" />
  <method name="${method}">
    ${paramsXml}
  </method>
</request>`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: xml
  });

  const text = await res.text();

  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync("data/last_response.txt", text);

  return { status: res.status, body: text };
}

async function main() {
  console.log("Calling EuroFaktura API...");

  const resp = await efCall("SalesInvoiceList", {
    status: "IssuedInvoice"
  });

  console.log("HTTP status:", resp.status);
  console.log("Response saved to data/last_response.txt");
}

await main();
