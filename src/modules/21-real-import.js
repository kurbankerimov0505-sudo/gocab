/* ===== 21. REAL DATA IMPORT — drivers.xlsx / vehicles.xlsx (or .csv)
   uploaded by the user, parsed entirely client-side with no external
   library: a hand-rolled ZIP central-directory reader + the browser's own
   DecompressionStream('deflate-raw') to inflate each part, then DOMParser
   to read sharedStrings.xml and the first sheet's XML. Feeds two
   calculations: financial situation (balances/fines) and vehicle status
   breakdown — both driven purely by the uploaded rows, kept separate from
   the demo dataset so it doesn't orphan the rest of the demo's
   interconnected records (repairs, shifts, etc. reference the demo IDs). */
(function(global){
'use strict';
const G = global.GC, U = G.Utils;
const { esc, cur, pctS, num } = U;
const S = G.S;

/* ---------------- ZIP + XLSX parsing (no external library) ---------------- */

function findEOCD(dv){
  const max = dv.byteLength;
  const searchFrom = Math.max(0, max - 22 - 65557);
  for(let i = max - 22; i >= searchFrom; i--){
    if(dv.getUint32(i, true) === 0x06054b50) return i;
  }
  throw new Error('Не найден конец ZIP-архива (файл повреждён или не .xlsx)');
}

function readZipEntries(buf){
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  const eocd = findEOCD(dv);
  const cdOffset = dv.getUint32(eocd + 16, true);
  const cdCount = dv.getUint16(eocd + 10, true);
  const dec = new TextDecoder('utf-8');
  const entries = {};
  let p = cdOffset;
  for(let i = 0; i < cdCount; i++){
    if(dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOffset = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
    entries[name] = { method, compSize, localOffset };
    p += 46 + nameLen + extraLen + commentLen;
  }
  return { u8, dv, entries };
}

async function extractEntry(zip, name){
  const e = zip.entries[name];
  if(!e) return null;
  const { u8, dv } = zip;
  const lp = e.localOffset;
  if(dv.getUint32(lp, true) !== 0x04034b50) throw new Error('Повреждён локальный заголовок ZIP для '+name);
  const nameLen = dv.getUint16(lp + 26, true);
  const extraLen = dv.getUint16(lp + 28, true);
  const dataStart = lp + 30 + nameLen + extraLen;
  const compData = u8.subarray(dataStart, dataStart + e.compSize);
  if(e.method === 0) return compData;
  if(e.method === 8){
    if(typeof DecompressionStream === 'undefined'){
      throw new Error('Браузер не поддерживает разбор .xlsx (нет DecompressionStream) — сохраните файл как .csv');
    }
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(compData); writer.close();
    const out = await new Response(ds.readable).arrayBuffer();
    return new Uint8Array(out);
  }
  throw new Error('Неподдерживаемый метод сжатия в .xlsx: '+e.method);
}

function parseSharedStrings(xmlText){
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  const sis = doc.getElementsByTagName('si');
  const arr = [];
  for(let i = 0; i < sis.length; i++){
    const ts = sis[i].getElementsByTagName('t');
    let text = '';
    for(let j = 0; j < ts.length; j++) text += ts[j].textContent;
    arr.push(text);
  }
  return arr;
}

function colLetterToIndex(letters){
  let n = 0;
  for(let i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
  return n - 1;
}

function parseSheetRows(xmlText, sharedStrings){
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  const rowEls = doc.getElementsByTagName('row');
  const rows = [];
  for(let r = 0; r < rowEls.length; r++){
    const cellEls = rowEls[r].getElementsByTagName('c');
    const row = [];
    for(let c = 0; c < cellEls.length; c++){
      const cell = cellEls[c];
      const ref = cell.getAttribute('r') || '';
      const m = ref.match(/^[A-Z]+/);
      const colIdx = m ? colLetterToIndex(m[0]) : c;
      const type = cell.getAttribute('t');
      const vEl = cell.getElementsByTagName('v')[0];
      let val = null;
      if(type === 's'){ val = vEl ? sharedStrings[parseInt(vEl.textContent, 10)] : ''; }
      else if(type === 'inlineStr'){ const isEl = cell.getElementsByTagName('is')[0]; val = isEl ? isEl.textContent : ''; }
      else if(type === 'b'){ val = vEl ? (vEl.textContent === '1') : false; }
      else if(type === 'str'){ val = vEl ? vEl.textContent : ''; }
      else { val = vEl ? parseFloat(vEl.textContent) : null; }
      row[colIdx] = val;
    }
    rows.push(row);
  }
  return rows;
}

async function parseXlsxArrayBuffer(buf){
  const zip = readZipEntries(buf);
  const dec = new TextDecoder('utf-8');
  let sharedStrings = [];
  const ssBytes = await extractEntry(zip, 'xl/sharedStrings.xml');
  if(ssBytes) sharedStrings = parseSharedStrings(dec.decode(ssBytes));
  const sheetName = zip.entries['xl/worksheets/sheet1.xml'] ? 'xl/worksheets/sheet1.xml'
    : Object.keys(zip.entries).find(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  if(!sheetName) throw new Error('Не найден лист с данными внутри .xlsx');
  const sheetBytes = await extractEntry(zip, sheetName);
  const grid = parseSheetRows(dec.decode(sheetBytes), sharedStrings);
  return gridToObjects(grid);
}

function gridToObjects(grid){
  if(!grid.length) return { headers: [], rows: [] };
  const headerRow = grid[0];
  const headers = headerRow.map(h => (h === undefined || h === null) ? '' : String(h).trim());
  const rows = grid.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => { if(h) obj[h] = r[i] === undefined ? null : r[i]; });
    return obj;
  }).filter(o => Object.values(o).some(v => v !== null && v !== ''));
  return { headers, rows };
}

/* ---------------- CSV fallback (plain text, comma or semicolon) ---------------- */

function parseCsvText(text){
  const lines = text.replace(/^﻿/, '').split(/\r\n|\n/).filter(l => l.length);
  if(!lines.length) return { headers: [], rows: [] };
  const delim = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
  const splitLine = (line) => {
    const out = []; let cur = ''; let inQ = false;
    for(let i = 0; i < line.length; i++){
      const ch = line[i];
      if(ch === '"'){ inQ = !inQ; continue; }
      if(ch === delim && !inQ){ out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur);
    return out;
  };
  const headers = splitLine(lines[0]).map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const cells = splitLine(line);
    const obj = {};
    headers.forEach((h, i) => { if(h) obj[h] = cells[i] === undefined ? null : cells[i]; });
    return obj;
  });
  return { headers, rows };
}

/* ---------------- file dispatch ---------------- */

async function parseUploadedFile(file){
  const name = file.name.toLowerCase();
  if(name.endsWith('.csv')){
    return parseCsvText(await file.text());
  }
  const buf = await file.arrayBuffer();
  const head = new Uint8Array(buf.slice(0, 4));
  const isZip = head[0] === 0x50 && head[1] === 0x4b;
  if(isZip || name.endsWith('.xlsx')) return parseXlsxArrayBuffer(buf);
  return parseCsvText(new TextDecoder('utf-8').decode(buf));
}

function detectKind(headers){
  const has = (h) => headers.includes(h);
  if(has('Phone Number') && has('Balance')) return 'drivers';
  if(has('Plate Number') && has('Status')) return 'vehicles';
  return null;
}

/* ---------------- mapping into normalized records ---------------- */

function mapDriverRow(row){
  return {
    phone: row['Phone Number'] || '',
    name: row['Name'] || '',
    gender: row['Gender'] || '',
    balance: Number(row['Balance']) || 0,
    fines: Number(row['Fines']) || 0,
    activationStatus: row['Activation Status'] || '',
    fired: !!row['Fire Date'],
    managerGroup: row['Manager Groups'] || '',
    vehiclePlate: row['Vehicles'] || '',
    comment: row['Comment'] || ''
  };
}
function mapVehicleRow(row){
  return {
    plate: row['Plate Number'] || row['Old Number'] || '',
    brand: row['Brand'] || '', model: row['Model'] || '',
    year: row['Year'] || '',
    status: row['Status'] || '',
    durationStatus: row['Duration Status'] || '',
    managerGroup: row['Manager Group'] || '',
    manager: row['Manager'] || '',
    driverName: row['Driver'] || ''
  };
}

/* ---------------- the two requested calculations ---------------- */

const VEHICLE_STATUS_LABEL = {
  working: 'В работе', maintenance: 'На сервисе', available: 'Свободен',
  police_immobilization: 'Изъят (полиция)'
};
function vehicleStatusLabel(s){ return VEHICLE_STATUS_LABEL[s] || s || '—'; }

function computeFinancialSituation(drivers){
  const n = drivers.length || 1;
  const totalBalance = drivers.reduce((s,d)=>s+d.balance,0);
  const totalFines = drivers.reduce((s,d)=>s+d.fines,0);
  const inDebt = drivers.filter(d=>d.balance<0);
  const inCredit = drivers.filter(d=>d.balance>0);
  const totalDebt = inDebt.reduce((s,d)=>s+d.balance,0); // negative
  const totalCredit = inCredit.reduce((s,d)=>s+d.balance,0);
  const worstDebtors = drivers.slice().sort((a,b)=>a.balance-b.balance).slice(0,5);
  const topCredit = drivers.slice().sort((a,b)=>b.balance-a.balance).slice(0,5);
  const firedCount = drivers.filter(d=>d.fired).length;
  return {
    count: drivers.length, totalBalance, totalFines,
    inDebtCount: inDebt.length, inCreditCount: inCredit.length,
    totalDebt, totalCredit, avgBalance: totalBalance/n,
    worstDebtors, topCredit, firedCount
  };
}

function computeVehicleStatusBreakdown(vehicles){
  const byStatus = {};
  vehicles.forEach(v => { byStatus[v.status||'unknown'] = (byStatus[v.status||'unknown']||0)+1; });
  const total = vehicles.length || 1;
  const rows = Object.keys(byStatus).map(st => ({
    status: st, label: vehicleStatusLabel(st), count: byStatus[st], pct: byStatus[st]/total
  })).sort((a,b)=>b.count-a.count);
  const working = byStatus.working || 0;
  const withoutDriver = vehicles.filter(v=>!v.driverName).length;
  const notWorking = vehicles.filter(v=>v.status!=='working');
  return {
    total: vehicles.length, rows, utilization: working/total,
    withoutDriver, notWorkingList: notWorking
  };
}

/* ---------------- orchestration + UI wiring ---------------- */

async function runRealImport(files){
  const parsed = { drivers: null, vehicles: null };
  for(const file of files){
    const { headers, rows } = await parseUploadedFile(file);
    const kind = detectKind(headers);
    if(kind === 'drivers') parsed.drivers = { fileName: file.name, rows: rows.map(mapDriverRow) };
    else if(kind === 'vehicles') parsed.vehicles = { fileName: file.name, rows: rows.map(mapVehicleRow) };
    else throw new Error('Не удалось распознать файл "'+file.name+'" — ожидались колонки водителей или автомобилей');
  }
  if(!parsed.drivers && !parsed.vehicles) throw new Error('Не найдено ни одного подходящего файла');

  S.DB.realImport = S.DB.realImport || {};
  if(parsed.drivers){ S.DB.realImport.drivers = parsed.drivers.rows; S.DB.realImport.driversFile = parsed.drivers.fileName; }
  if(parsed.vehicles){ S.DB.realImport.vehicles = parsed.vehicles.rows; S.DB.realImport.vehiclesFile = parsed.vehicles.fileName; }
  S.DB.realImport.importedAt = U.NOW;

  const applied = applyRealDataAsPrimary(S.DB);

  const bits = [];
  if(parsed.drivers) bits.push(parsed.drivers.rows.length+' водителей');
  if(parsed.vehicles) bits.push(parsed.vehicles.rows.length+' автомобилей');
  return 'Импортировано и применено в CRM: '+bits.join(', ')
    + ' (записано водителей: '+applied.driversApplied+', авто: '+applied.vehiclesApplied+')';
}

// Finds a division matching this manager-group label, creating one on the
// fly if the imported data names a branch the demo reference data doesn't
// have (kept separate from inventing fake business records — a division
// is just an organisational label, not a claim about what happened).
function findOrCreateDiv(DB, groupName, managerName){
  const name = groupName || 'Импорт';
  let div = DB.divs.find(d => d.name === name);
  if(!div){
    div = { id: U.uid('div-import'), name, org: DB.orgs[0].id, city: name, manager: managerName || '' };
    DB.divs.push(div);
  }
  return div;
}

const REAL_CAR_STATUS = {
  working: 'В работе', maintenance: 'На сервисе', available: 'Свободен', police_immobilization: 'Изъят'
};

// Replaces the demo drivers/vehicles with the uploaded real ones, rebuilds
// the cash ledger from just the real opening balances (that's all the
// source files actually contain — no day-by-day history), and clears every
// collection that has no counterpart in the uploaded files. Those
// collections (repairs, shifts, tickets, incidents, deposits, payouts,
// contracts, leases, inspections, the 9-month KPI model...) would
// otherwise keep showing fabricated demo entries now sitting under real
// people's names and real plates — that's not a reasonable default, so
// they're emptied rather than left stale or invented.
function applyRealDataAsPrimary(DB){
  const ri = DB.realImport;
  if(!ri) return { driversApplied: 0, vehiclesApplied: 0 };

  const newCars = (ri.vehicles || []).filter(v => v.plate).map(v => {
    const div = findOrCreateDiv(DB, v.managerGroup, v.manager);
    return {
      id: 'rv-' + v.plate, plate: v.plate,
      model: (v.brand + ' ' + v.model).trim() || '—',
      year: v.year || null, org: div.org, div: div.id, akpp: 'АКПП', gbo: false,
      status: REAL_CAR_STATUS[v.status] || v.status || 'Свободен',
      insurer: null, insUntil: null, techUntil: null, leaseUntil: null,
      mileage: null, tags: [],
      _importedManager: v.manager || '', _importedDriverName: v.driverName || ''
    };
  });

  const newDrivers = (ri.drivers || []).filter(d => d.phone || d.name).map(d => {
    const div = findOrCreateDiv(DB, d.managerGroup, '');
    const car = newCars.find(c => c.plate === d.vehiclePlate);
    let status = 'Работает';
    if(d.fired) status = 'Уволен';
    else if(d.activationStatus && d.activationStatus !== 'activated') status = 'Заблокирован';
    return {
      id: 'rd-' + (d.phone || U.uid('drv')), fio: d.name || '—', phone: d.phone || '',
      yid: null, status, ystatus: d.activationStatus === 'activated' ? 'Работает' : 'Нет аккаунта',
      form: 'Штатный', hired: null, fired: d.fired ? U.iso(U.NOW) : null,
      rate: null, balY: 0, bal: 0, finesBal: 0, dmgBal: 0,
      org: div.org, div: div.id, disp: (DB.disp[0] || {}).id, car: car ? car.id : null,
      reportDay: 1, licUntil: null, instalment: null, limit: null,
      platformOrders: 0, partnerOrders: 0, blockBelowLimit: false,
      tags: [], notes: d.comment ? [{ by: 'Импорт', text: d.comment, at: U.NOW }] : [],
      active: status !== 'Уволен', _disc: null, gender: d.gender || '',
      _importedBalance: d.balance, _importedFines: d.fines
    };
  });

  if(ri.vehicles) DB.cars = newCars;
  if(ri.drivers) DB.drivers = newDrivers;

  // Rebuild the ledger from scratch: one opening entry per real driver for
  // whatever balance/fines the export actually reported — nothing else is
  // known, so nothing else is invented.
  if(ri.drivers){
    DB.cash = [];
    newDrivers.forEach(d => {
      if(d._importedBalance){
        DB.cash.push(G.mkCash(d, U.NOW, d._importedBalance>=0?'Пополнение':'Списание',
          Math.abs(d._importedBalance), 'Система по расписанию', 'Баланс', 'Импорт (начальный баланс)', true));
      }
      if(d._importedFines){
        DB.cash.push(G.mkCash(d, U.NOW, 'Списание', Math.abs(d._importedFines),
          'Система по расписанию', 'Баланс штрафов', 'Импорт (штрафы)', true));
      }
    });
    G.recalcBalances(DB);
  }

  DB.fines = []; DB.instal = []; DB.comps = []; DB.orders = []; DB.orders2 = [];
  DB.acts = []; DB.shifts = []; DB.deposits = []; DB.payouts = []; DB.contracts = [];
  DB.incidents = []; DB.leases = []; DB.tickets = []; DB.inspections = [];
  DB.pnl = []; DB.history = []; DB.dupes = []; DB._dispatch = [];
  DB._collection = { perDriver: {}, months: (DB._collection && DB._collection.months) || [] };
  DB._kpi = [];
  DB._realDataIsPrimary = true;

  return { driversApplied: newDrivers.length, vehiclesApplied: newCars.length };
}

function financialSituationHTML(fs){
  let html = '<div class="grid grid-4">'
    + G.helpers.statTile('Общий баланс', cur(fs.totalBalance), fs.count+' водителей', fs.totalBalance>=0?'up':'down')
    + G.helpers.statTile('Водителей с долгом', fs.inDebtCount, 'из '+fs.count, fs.inDebtCount>fs.count/2?'down':'up')
    + G.helpers.statTile('Общий долг', cur(Math.abs(fs.totalDebt)), 'сумма отрицательных балансов', 'down')
    + G.helpers.statTile('Средний баланс', cur(fs.avgBalance), 'на водителя', fs.avgBalance>=0?'up':'down')
    + '</div>';
  html += '<div class="grid grid-2">';
  html += '<div class="card"><div class="card-head"><h3>Топ-5 должников</h3></div>'
    + G.tableHTML([
        {label:'Водитель', key:'name'}, {label:'Телефон', key:'phone'},
        {label:'Баланс', render:d=>'<span style="color:var(--bad)">'+cur(d.balance)+'</span>'}
      ], fs.worstDebtors, {}) + '</div>';
  html += '<div class="card"><div class="card-head"><h3>Топ-5 по балансу</h3></div>'
    + G.tableHTML([
        {label:'Водитель', key:'name'}, {label:'Телефон', key:'phone'},
        {label:'Баланс', render:d=>'<span style="color:var(--ok)">'+cur(d.balance)+'</span>'}
      ], fs.topCredit, {}) + '</div>';
  html += '</div>';
  return html;
}
function vehicleStatusHTML(vs){
  const colors = { working:'#2e9e5b', maintenance:'#c9891c', available:'#4a90d9', police_immobilization:'#d64545' };
  let html = '<div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">'
    + G.donut(vs.rows.map(r=>({value:r.count, color: colors[r.status]||'#999'})), 120)
    + '<div class="grid grid-3" style="flex:1">'
    + G.helpers.statTile('Всего автомобилей', vs.total, '')
    + G.helpers.statTile('Утилизация (в работе)', pctS(vs.utilization), '')
    + G.helpers.statTile('Без водителя', vs.withoutDriver, '')
    + '</div></div>';
  html += G.tableHTML([
    {label:'Статус', render:r=>'<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:'+(colors[r.status]||'#999')+';margin-right:6px"></span>'+esc(r.label)},
    {label:'Количество', key:'count'}, {label:'Доля', render:r=>pctS(r.pct)}
  ], vs.rows, { title:'Статусы автопарка' });
  return html;
}

function realImportResultsHTML(){
  const ri = S.DB.realImport;
  if(!ri || (!ri.drivers && !ri.vehicles)) return '';
  let html = '<div class="card"><div class="card-head"><h3>Загруженные файлы</h3></div>'
    + '<div class="muted">'
    + (ri.driversFile ? 'Водители: '+esc(ri.driversFile)+' · ' : '')
    + (ri.vehiclesFile ? 'Автомобили: '+esc(ri.vehiclesFile)+' · ' : '')
    + 'Импортировано: '+U.fmtDT(ri.importedAt)
    + '</div></div>';
  if(ri.drivers) html += financialSituationHTML(computeFinancialSituation(ri.drivers));
  if(ri.vehicles) html += vehicleStatusHTML(computeVehicleStatusBreakdown(ri.vehicles));
  return html;
}

Object.assign(G.ACTIONS, {
  'do-real-import': (t) => {
    const input = document.getElementById('realImportFiles');
    const files = (input && input.files) ? Array.from(input.files) : [];
    if(!files.length){ G.toast('Выберите один или два файла (водители / автомобили)'); return; }
    S._importBusy = true;
    runRealImport(files).then(summary => {
      S._importBusy = false;
      G.toast(summary);
      G.render();
    }).catch(err => {
      S._importBusy = false;
      G.toast('Ошибка импорта: '+err.message);
      G.render();
    });
  }
});

global.GC.realImportResultsHTML = realImportResultsHTML;
global.GC.computeFinancialSituation = computeFinancialSituation;
global.GC.computeVehicleStatusBreakdown = computeVehicleStatusBreakdown;
global.GC.parseUploadedFile = parseUploadedFile; // exposed for headless testing

})(typeof window !== 'undefined' ? window : globalThis);
