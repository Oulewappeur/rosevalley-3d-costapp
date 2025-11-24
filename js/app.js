// app.js - UI glue and calc logic
document.addEventListener('DOMContentLoaded', initApp);

function initApp(){
  renderDBTable();
  renderHistory();
  populateFilamentSelect();

  document.getElementById('calcBtn').addEventListener('click', onCalculate);
  document.getElementById('exportPdfBtn').addEventListener('click', onExportPdf);

  document.getElementById('addSpoolBtn').addEventListener('click', onAddSpool);
  document.getElementById('editSpoolBtn').addEventListener('click', onEditSpool);

  document.getElementById('exportJson').addEventListener('click', () => exportDB());
  document.getElementById('importJson').addEventListener('click', () => {
    const inp = document.createElement('input'); inp.type='file'; inp.accept='application/json';
    inp.onchange = async e => {
      const file = e.target.files[0];
      try {
        await importDB(file);
        populateFilamentSelect(); renderDBTable();
        alert('DB geïmporteerd!');
      } catch(err){ alert('Import fout: '+err.message) }
    };
    inp.click();
  });

  // filament select change -> populate price fields
  document.getElementById('filamentSelect').addEventListener('change', function(){
    const id = this.value;
    const db = getDB();
    const item = db.find(x=>x.id===id);
    if(item){
      document.getElementById('spoolPrice').value = item.price;
      document.getElementById('spoolWeight').value = item.weight;
      document.getElementById('gramsUsed').value = Math.min(50, item.stock);
    }
  });
}

function populateFilamentSelect(){
  const sel = document.getElementById('filamentSelect');
  sel.innerHTML = '';
  const db = getDB();
  db.forEach(item=>{
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = `${item.name} — ${item.material} (${item.color}) — €${item.price}`;
    sel.appendChild(opt);
  });
  if(db.length) sel.value = db[0].id;
}

function renderDBTable(){
  const container = document.getElementById('dbTable');
  const db = getDB();
  if(!db.length){ container.innerHTML = '<p>Geen filament in DB</p>'; return; }
  let html = '<table style="width:100%;border-collapse:collapse"><thead><tr><th>Naam</th><th>materiaal</th><th>kleur</th><th>prijs</th><th>gewicht</th><th>stock</th><th>acties</th></tr></thead><tbody>';
  db.forEach(s=>{
    html += `<tr>
      <td>${s.name}</td>
      <td>${s.material}</td>
      <td>${s.color}</td>
      <td>€${s.price.toFixed(2)}</td>
      <td>${s.weight} g</td>
      <td>${s.stock ?? 0} g</td>
      <td>
        <button onclick="editSpoolUI('${s.id}')">✏️</button>
        <button onclick="deleteSpool('${s.id}')">🗑️</button>
      </td>
    </tr>`;
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderHistory(){
  const h = getHistory();
  const el = document.getElementById('history');
  if(!h.length){ el.innerHTML = '<p>Geen historie</p>'; return; }
  el.innerHTML = h.slice(0,20).map(it => {
    return `<div style="padding:8px;border-bottom:1px solid #eee">
      <b>${it.sellingPrice} €</b> — ${it.date} — ${it.name || 'project'}
      <div class="tiny">kosten: €${it.totalCost} (stroom €${it.electricityCost}, filament €${it.filamentCost})</div>
    </div>`;
  }).join('');
}

// -------- UI Actions ----------
function onAddSpool(){
  const name = prompt('Naam spool (bv. eSun PLA Black)');
  if(!name) return;
  const price = parseFloat(prompt('Prijs (€)', '25')) || 25;
  const weight = parseInt(prompt('Gewicht (g)', '1000')) || 1000;
  const mat = prompt('Materiaal (PLA/ABS/etc)', 'PLA') || 'PLA';
  const color = prompt('Kleur', 'Black') || 'Black';
  addSpool({name, price, weight, material: mat, color, stock: weight});
  populateFilamentSelect();
  renderDBTable();
}

function onEditSpool(){
  const sel = document.getElementById('filamentSelect');
  if(!sel.value){ alert('Geen selectie'); return; }
  editSpoolUI(sel.value);
}

window.editSpoolUI = function(id){
  const db = getDB(); const s = db.find(x=>x.id===id);
  if(!s) return alert('Niet gevonden');
  const name = prompt('Naam', s.name) || s.name;
  const price = parseFloat(prompt('Prijs (€)', s.price)) || s.price;
  const weight = parseInt(prompt('Gewicht (g)', s.weight)) || s.weight;
  const stock = parseInt(prompt('Voorraad (g)', s.stock || weight)) || (s.stock||weight);
  updateSpool(id, {name, price, weight, stock});
  populateFilamentSelect();
  renderDBTable();
}

window.deleteSpool = function(id){
  if(!confirm('Verwijder spool?')) return;
  removeSpool(id);
  populateFilamentSelect();
  renderDBTable();
}

// -------- Calculation ----------
function onCalculate(){
  const hours = parseFloat(document.getElementById('hours').value) || 0;
  const pw = parseFloat(document.getElementById('printerWatts').value) || 0;
  const dw = parseFloat(document.getElementById('dryerWatts').value) || 0;
  const aw = parseFloat(document.getElementById('amsWatts').value) || 0;
  const kwhPrice = parseFloat(document.getElementById('kwhPrice').value) || 0;

  // total kWh = hours * (wattsTotal / 1000)
  const wattsTotal = pw + dw + aw;
  const kwhUsed = (wattsTotal/1000) * hours;
  const electricityCost = kwhUsed * kwhPrice;

  const gramsUsed = parseFloat(document.getElementById('gramsUsed').value) || 0;
  const spoolWeight = parseFloat(document.getElementById('spoolWeight').value) || 1000;
  const spoolPrice = parseFloat(document.getElementById('spoolPrice').value) || 0;

  const pricePerGram = spoolPrice / spoolWeight;
  const filamentCost = gramsUsed * pricePerGram;

  const totalCost = electricityCost + filamentCost;
  const marginPct = parseFloat(document.getElementById('margin').value) || 0;
  const sellingPrice = totalCost * (1 + marginPct/100);

  // show result
  const out = document.getElementById('result');
  out.innerHTML = `<h3>Resultaat</h3>
    <p><b>Stroomkosten:</b> €${electricityCost.toFixed(2)} (gebruik ${kwhUsed.toFixed(3)} kWh)</p>
    <p><b>Filamentkosten:</b> €${filamentCost.toFixed(2)} (€${pricePerGram.toFixed(4)} / g)</p>
    <p><b>Kostprijs:</b> €${totalCost.toFixed(2)}</p>
    <p><b>Verkoopprijs (marge ${marginPct}%):</b> €${sellingPrice.toFixed(2)}</p>`;
  out.classList.remove('hidden');

  // reduce stock optional & add history
  const sel = document.getElementById('filamentSelect');
  const currentSpoolId = sel.value;
  const spool = getDB().find(x=>x.id===currentSpoolId);
  if(spool){
    spool.stock = (spool.stock || spool.weight) - gramsUsed;
    updateSpool(spool.id, { stock: spool.stock });
    renderDBTable();
    populateFilamentSelect();
  }

  addHistory({
    date: new Date().toLocaleString(),
    totalCost: totalCost.toFixed(2),
    sellingPrice: sellingPrice.toFixed(2),
    electricityCost: electricityCost.toFixed(2),
    filamentCost: filamentCost.toFixed(2),
    name: (spool && spool.name) || 'n.v.t.',
  });
  renderHistory();
}

function onExportPdf(){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const header = document.querySelector('.header h1').textContent;
  const out = document.getElementById('result').innerText || '';
  doc.setFontSize(16);
  doc.text(header, 14, 20);
  doc.setFontSize(12);
  const lines = out.split('\n');
  let y = 30;
  lines.forEach(l=>{
    doc.text(l, 14, y);
    y += 8;
  });
  doc.save('rosevalley_offerte.pdf');
}
