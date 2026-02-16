(() => {
  const $ = (id) => document.getElementById(id);
  const norm = (s) => (s ?? "").toString().toLowerCase();

  async function loadIndex(){
    const res = await fetch("./invoices.index.json?_=" + Date.now());
    if(!res.ok) throw new Error("Cannot load invoices.index.json");
    return res.json();
  }

  function rowHtml(it){
    const file = "./html/" + encodeURIComponent(it.id) + ".html";
    return `
      <tr data-id="${it.id}">
        <td><input type="checkbox" class="chk sel" data-id="${it.id}"></td>
        <td class="num">${it.number || ""}</td>
        <td>${it.date || ""}</td>
        <td>${it.buyer || ""}</td>
        <td class="right">${it.total || ""}</td>
        <td class="right"><a href="${file}" target="_blank">Print</a></td>
      </tr>
    `;
  }

  function getSelectedIds(){
    return Array.from(document.querySelectorAll(".sel:checked")).map(x => x.dataset.id);
  }

  function updateSelCount(){
    $("selCount").textContent = "Избрани: " + getSelectedIds().length;
  }

  function openBatchPrint(ids){
    if(!ids.length){
      alert("Няма избрани фактури.");
      return;
    }

    const docs = ids.map(id => "./html/" + encodeURIComponent(id) + ".html");
    const w = window.open("", "_blank");
    if(!w){
      alert("Поп-ъпът е блокиран. Разреши pop-ups за този сайт и пробвай пак.");
      return;
    }

    w.document.open();
    w.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Batch print</title>
  <style>
    body{ margin:0; }
    .page{ page-break-after: always; }
    iframe{ width:100%; height: 297mm; border:0; }
    @media print{
      .page{ page-break-after: always; }
      iframe{ height: 297mm; }
    }
  </style>
</head>
<body>
  ${docs.map(src => `<div class="page"><iframe src="${src}"></iframe></div>`).join("")}
</body>
</html>`);
    w.document.close();

    const s = w.document.createElement("script");
    s.textContent = "(function(){const frames=Array.from(document.querySelectorAll('iframe'));let loaded=0;frames.forEach(f=>f.addEventListener('load',()=>{loaded++;if(loaded===frames.length){setTimeout(()=>window.print(),500);}}));})();";
    w.document.body.appendChild(s);
  }

  async function render(){
    const data = await loadIndex();
    const list = (data.items || []);

    const q = norm($("q").value);
    const filtered = !q ? list : list.filter(it => {
      const s = norm([it.number, it.date, it.buyer, it.total].join(" "));
      return s.includes(q);
    });

    $("rows").innerHTML = filtered.map(rowHtml).join("");

    $("meta").textContent = "Последно обновяване: " + (data.generatedAt || "");
    $("foot").textContent = "Общо: " + filtered.length + " фактури";

    $("checkAll").checked = false;
    updateSelCount();

    document.querySelectorAll(".sel").forEach(chk => chk.addEventListener("change", updateSelCount));
  }

  $("refresh").addEventListener("click", () => render().catch(e => alert(e.message)));
  $("q").addEventListener("input", () => render().catch(()=>{}));

  $("checkAll").addEventListener("change", (e) => {
    const on = e.target.checked;
    document.querySelectorAll(".sel").forEach(chk => chk.checked = on);
    updateSelCount();
  });

  $("printSelected").addEventListener("click", () => openBatchPrint(getSelectedIds()));

  render().catch(e => alert(e.message));
})();