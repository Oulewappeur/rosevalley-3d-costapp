/* db.js - simple localStorage DB for filaments + history */
const DB_KEY = "rv_filament_db_v1";
const HISTORY_KEY = "rv_history_v1";

function getDB(){
  const raw = localStorage.getItem(DB_KEY);
  if(!raw) {
    // seed with a default spool
    const seed = [
      { id: cryptoRandomId(), name: "Default PLA Black", material: "PLA", color: "Black", price: 25.00, weight: 1000, stock: 1000 }
    ];
    localStorage.setItem(DB_KEY, JSON.stringify(seed));
    return seed;
  }
  return JSON.parse(raw);
}

function saveDB(arr){
  localStorage.setItem(DB_KEY, JSON.stringify(arr));
}

function addSpool(obj){
  const db = getDB();
  obj.id = cryptoRandomId();
  db.push(obj);
  saveDB(db);
  return obj;
}

function updateSpool(id, patch){
  const db = getDB();
  const idx = db.findIndex(s=>s.id===id);
  if(idx>=0){ db[idx] = {...db[idx], ...patch}; saveDB(db); return db[idx]; }
  return null;
}

function removeSpool(id){
  const db = getDB().filter(s=>s.id!==id);
  saveDB(db);
}

function cryptoRandomId(){
  return 'id-' + Math.random().toString(36).slice(2,9);
}

/* history */
function addHistory(entry){
  const raw = localStorage.getItem(HISTORY_KEY);
  const arr = raw ? JSON.parse(raw) : [];
  arr.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(arr.slice(0,200)));
}
function getHistory(){ const raw = localStorage.getItem(HISTORY_KEY); return raw?JSON.parse(raw):[] }

/* import/export */
function exportDB(){
  const data = getDB();
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'rosevalley_filament_db.json'; a.click();
  URL.revokeObjectURL(url);
}
function importDB(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const json = JSON.parse(e.target.result);
        saveDB(json);
        resolve(json);
      } catch(err){ reject(err) }
    };
    reader.onerror = err => reject(err);
    reader.readAsText(file);
  });
}
