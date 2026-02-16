import fs from "fs";
import path from "path";

function escapeHtml(s=""){return String(s)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;").replace(/'/g,"&#039;");}

function pick(obj, paths, fallback=""){
  for (const p of paths){
    const parts=p.split(".");
    let cur=obj, ok=true;
    for (const part of parts){
      if (cur==null || !(part in cur)){ ok=false; break; }
      cur=cur[part];
    }
    if (ok && cur!=null && String(cur).trim()!=="") return cur;
  }
  return fallback;
}

function readJson(){
  if (fs.existsSync("data/invoices.json")) return JSON.parse(fs.readFileSync("data/invoices.json","utf8"));
  if (fs.existsSync("data/last_response.json")) return JSON.parse(fs.readFileSync("data/last_response.json","utf8"));
  return null;
}

function asArray(x){
  if (!x) return [];
  if (Array.isArray(x)) return x;
  if (x.invoices && Array.isArray(x.invoices)) return x.invoices;
  if (x.items && Array.isArray(x.items) && x.items[0] && x.items[0].DocumentNumber) return x.items;
  return [x];
}

function ensureDir(p){ fs.mkdirSync(p,{recursive:true}); }

function buildFilledHtml(inv){
  // използваме вече генерирания export/eurofaktura-filled.html като base,
  // но ако искаш, може и с preview/template.html. За сега: export filled.
  const basePath = "export/eurofaktura-filled.html";
  if (!fs.existsSync(basePath)) return "<html><body>Missing export/eurofaktura-filled.html</body></html>";
  return fs.readFileSync(basePath,"utf8");
}

function main(){
  const data = readJson();
  const arr = asArray(data);

  ensureDir("archive/html");

  const items = [];
  for (let i=0;i<arr.length;i++){
    const inv = arr[i] || {};
    const id = pick(inv, ["id","InvoiceId","DocumentNumber","number"], `inv_${i+1}`);
    const number = pick(inv, ["number","invoiceNo","DocumentNumber","No"], id);
    const date = pick(inv, ["issueDate","date","DocumentDate"], "");
    const buyer = pick(inv, ["buyer.name","customer.name","BuyerName"], "");
    const total = pick(inv, ["totals.grandTotal","total","TotalForPayment","Totals.Total"], "");

    const html = buildFilledHtml(inv);
    fs.writeFileSync(path.join("archive/html", `${id}.html`), html, "utf8");

    items.push({
      id,
      number: escapeHtml(String(number)),
      date: escapeHtml(String(date)),
      buyer: escapeHtml(String(buyer)),
      total: escapeHtml(String(total))
    });
  }

  const out = {
    generatedAt: new Date().toISOString(),
    items
  };
  ensureDir("archive");
  fs.writeFileSync("archive/invoices.index.json", JSON.stringify(out,null,2), "utf8");
  console.log(`Archive generated: ${items.length} invoices`);
}

main();
