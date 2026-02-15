import fs from "fs";

const endpoint = process.env.EF_ENDPOINT;
const username = process.env.EF_USERNAME;
const secretKey = process.env.EF_SECRETKEY || "";
const token = process.env.EF_TOKEN;

if (!endpoint || !username || !token) {
  throw new Error("Missing EF_ENDPOINT / EF_USERNAME / EF_TOKEN. Check GitHub Secrets.");
}
if (!secretKey) {
  throw new Error("EF_SECRETKEY is empty. Add it in GitHub Secrets.");
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

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    fs.writeFileSync(`data/${method}_error.html`, text);
    throw new Error(`Non-JSON response from ${method} (HTTP ${res.status}). See data/${method}_error.html`);
  }

  return { httpStatus: res.status, data };
}

async function main() {
  fs.mkdirSync("data", { recursive: true });

  // 1) ТЕСТ: вземи конкретна фактура (номер + дата)
  // Ако върне данни -> значи API работи и проблемът е само в критериите на List.
  const getResp = await efCall("SalesInvoiceGet", {
    number: "0000000117",
    date: "2026-01-30"
  });
  fs.writeFileSync("data/test_SalesInvoiceGet.json", JSON.stringify(getResp, null, 2));

  // 2) LIST: пробваме да извадим фактури по дата диапазон (януари 2026)
  const listResp = await efCall("SalesInvoiceList", {
    dateFrom: "2026-01-01",
    dateTo: "2026-01-31",
    status: "IssuedInvoice"
  });
  fs.writeFileSync("data/test_SalesInvoiceList.json", JSON.stringify(listResp, null, 2));

  console.log("Saved:");
  console.log("- data/test_SalesInvoiceGet.json");
  console.log("- data/test_SalesInvoiceList.json");
}

await main();
