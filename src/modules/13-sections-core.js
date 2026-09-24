/* ===== 13. CORE SECTIONS: dash, drivers, cars, fines, mgmt, refs, users ===== */
(function(global){
'use strict';
const G = global.GC, U = G.Utils, C = G.CONST, E = G.ENUM;
const { esc, money, cur, pctS, num, fmtD, fmtDT, iso, shift, NOW } = U;
const S = G.S;

function page(pageKey, defaultPage){ S._tablePage = S._tablePage||{}; return S._tablePage[pageKey] || 0; }

function driverById(id){ return S.DB.drivers.find(d=>d.id===id); }
function carById(id){ return S.DB.cars.find(c=>c.id===id); }
function carByRef(refId){ return S.DB.cars.find(c=>c.id===refId); }
function divName(id){ const d=S.DB.divs.find(x=>x.id===id); return d?d.name:''; }
function orgName(id){ const o=S.DB.orgs.find(x=>x.id===id); return o?o.name:''; }

function doExport(kind, rows, cols){
  const header = cols.map(c=>c.label).join(';');
  const lines = rows.map(r => cols.map(c => (c.raw?c.raw(r):r[c.key])).join(';'));
  const csv = '﻿' + [header].concat(lines).join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = kind + '-' + U.iso(U.NOW) + '.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
  G.toast('Файл выгружен: '+a.download);
}

/* ============== DASHBOARD ============== */
function viewDash(){
  const DB = S.DB;
  const totals = G.ledgerTotals(DB);
  const workingCars = DB.cars.filter(c=>c.status==='В работе').length;
  const kpiAvg = DB._kpi.length ? DB._kpi.reduce((s,m)=>s+m.avgAchievement,0)/DB._kpi.length : 0;
  const debtDrivers = DB.drivers.filter(d=>d.car && d.bal<0).length;
  const openRepairs = DB.orders2.filter(o=>o.phase<6).length;
  const notifN = G.notificationCount();

  let html = '<div class="grid grid-4">';
  html += statTile('Автопарк', DB.cars.length+' машин', workingCars+' в работе', workingCars>=DB.cars.length*0.8?'up':'down');
  html += statTile('Водители', DB.drivers.filter(d=>d.active).length+' активных', DB.drivers.length+' всего', 'up');
  html += statTile('Собираемость аренды', pctS(totals.rate), 'план 96%', totals.rate>=0.9?'up':'down');
  html += statTile('KPI менеджеров', pctS(kpiAvg), 'среднее достижение', kpiAvg>=0.8?'up':'down');
  html += '</div>';

  html += '<div class="grid grid-3">';
  html += statTile('Долг по аренде', debtDrivers+' водителей', 'с отрицательным балансом', debtDrivers>2?'down':'up');
  html += statTile('Ремонты в работе', openRepairs+' наряд-заказов', (DB.orders2.length-openRepairs)+' завершено', 'up');
  html += statTile('Уведомления', notifN, 'требуют внимания', notifN>5?'down':'up');
  html += '</div>';

  if(DB.realImport && (DB.realImport.drivers || DB.realImport.vehicles)){
    const fs = DB.realImport.drivers ? G.computeFinancialSituation(DB.realImport.drivers) : null;
    const vs = DB.realImport.vehicles ? G.computeVehicleStatusBreakdown(DB.realImport.vehicles) : null;
    html += '<div class="card"><div class="card-head"><h3>Реальные данные (импорт)</h3>'
      + '<button class="btn btn-sm btn-ghost" data-act="goto" data-sec="import" data-tab="0">К деталям →</button></div>'
      + '<div class="grid grid-4">'
      + (fs ? statTile('Реальный баланс водителей', cur(fs.totalBalance), fs.count+' водителей', fs.totalBalance>=0?'up':'down') : '')
      + (fs ? statTile('Водителей с долгом', fs.inDebtCount, 'из '+fs.count, 'down') : '')
      + (vs ? statTile('Автопарк в работе', pctS(vs.utilization), vs.total+' машин', vs.utilization>=0.8?'up':'down') : '')
      + (vs ? statTile('Без водителя', vs.withoutDriver, 'машин простаивает', vs.withoutDriver>0?'down':'up') : '')
      + '</div></div>';
  }

  html += '<div class="card"><div class="card-head"><h3>Собираемость аренды по месяцам</h3></div>';
  const spark9 = DB._collection.months.map((m,i)=>{
    let acc=0, col=0;
    Object.values(DB._collection.perDriver).forEach(p=>{ acc+=p.monthly[i].accrued; col+=p.monthly[i].collected; });
    return acc? col/acc : 0;
  });
  html += G.lineChartMulti([{name:'Собираемость', color:'#ffc629', values: spark9.map(x=>x*100)}], 700, 200);
  html += '<div class="muted">'+DB._collection.months.join(' · ')+'</div></div>';

  html += '<div class="card"><div class="card-head"><h3>Автопарк по филиалам</h3></div><div class="grid grid-3">';
  DB.divs.forEach(dv => {
    const cars = DB.cars.filter(c=>c.div===dv.id);
    const work = cars.filter(c=>c.status==='В работе').length;
    html += '<div class="stat-tile"><div class="l">'+esc(dv.name)+'</div><div class="v">'+work+'/'+cars.length+'</div>'
      + G.barBlock(cars.length? work/cars.length*100:0) + '</div>';
  });
  html += '</div></div>';
  return html;
}
function statTile(label, value, sub, dir){
  return '<div class="stat-tile"><div class="l">'+esc(label)+'</div><div class="v">'+esc(value)+'</div>'
    + '<div class="d '+(dir==='up'?'d-up':'d-down')+'">'+(dir==='up'?'▲':'▼')+' '+esc(sub)+'</div></div>';
}

/* ============== DRIVERS ============== */
const DRIVER_FILTERS = [
  { key:'status', label:'Статус', type:'sel', options:E.STATUS },
  { key:'div', label:'Филиал', type:'sel', get:(d)=>divName(d.div), options: null },
  { key:'fio', label:'ФИО', type:'text' },
];
function viewDrivers(tab){
  if(tab===1) return viewDriverDupes();
  const DB = S.DB;
  const defs = DRIVER_FILTERS.map(f => f.key==='div' ? Object.assign({},f,{options:DB.divs.map(d=>d.name)}) : f);
  const filtered = G.applyFilters('drivers', DB.drivers, defs);
  const cols = [
    { label:'ФИО', render:d=>'<b>'+esc(d.fio)+'</b>'+' '+G.tagChips(d.tags, DB.tags) },
    { label:'Телефон', key:'phone' },
    { label:'Статус', render:d=>G.statusPill(d.status) },
    { label:'Авто', render:d=> d.car ? esc(carById(d.car).plate) : '—' },
    { label:'Филиал', render:d=>esc(divName(d.div)) },
    { label:'Баланс', render:d=>'<span style="color:'+(d.bal<0?'var(--bad)':'var(--ok)')+'">'+cur(d.bal)+'</span>' },
    { label:'Штрафы', render:d=> d.finesBal ? cur(d.finesBal) : '—' },
    { label:'Дисциплина', render:d=>pctS(d._disc) },
    { label:'', render:d=>'<button class="btn btn-sm btn-ghost" data-act="open-driver" data-id="'+d.id+'">Карточка</button>' }
  ];
  const actions = '<button class="btn btn-sm btn-primary" data-act="add-driver">+ Водитель</button>';
  let html = '<div class="card-head"><div></div><div class="card-actions">'+G.filtersHTML('drivers', defs)+actions+'</div></div>';
  html += G.tableHTML(cols, filtered, { title:'Список водителей ('+filtered.length+')', page: page('drivers'), pageKey:'drivers' });
  return html;
}
function viewDriverDupes(){
  const DB = S.DB;
  const cols = [
    { label:'ФИО (A)', render:r=>esc(r.fioA) }, { label:'ФИО (B)', render:r=>esc(r.fioB) },
    { label:'Причина', key:'reason' },
    { label:'', render:r=>'<button class="btn btn-sm btn-ghost" data-act="resolve-dupe" data-id="'+r.id+'">Не дубль</button>'
      + ' <button class="btn btn-sm btn-primary" data-act="merge-dupe" data-id="'+r.id+'">Объединить</button>' }
  ];
  return G.tableHTML(cols, DB.dupes, { title:'Возможные дубли водителей' });
}
function driverBalanceCard(d){
  const DB = S.DB;
  const ops = DB.cash.filter(c=>c.driverId===d.id).sort((a,b)=>new Date(b.at)-new Date(a.at)).slice(0,15);
  let html = '<div class="grid grid-4">'
    + statTile('Баланс', cur(d.bal), '', d.bal>=0?'up':'down')
    + statTile('Яндекс', cur(d.balY), '', d.balY>=0?'up':'down')
    + statTile('Штрафы', cur(-d.finesBal), '', 'down')
    + statTile('Повреждения', cur(-d.dmgBal), '', 'down')
    + '</div>';
  html += '<div class="table-scroll"><table class="tbl"><thead><tr><th>Дата</th><th>Интерфейс</th><th>Источник</th><th>Тип</th><th>Сумма</th><th>Было</th><th>Стало</th></tr></thead><tbody>';
  ops.forEach(c => {
    html += '<tr><td>'+fmtDT(c.at)+'</td><td>'+esc(c.iface)+'</td><td>'+esc(c.src)+'</td>'
      + '<td>'+G.statusPill(c.type,c.type==='Пополнение'?'ok':'bad')+'</td><td>'+cur(c.amt)+'</td><td>'+cur(c.before)+'</td><td>'+cur(c.after)+'</td></tr>';
  });
  html += '</tbody></table></div>';
  if(d.notes && d.notes.length){
    html += '<div class="card" style="margin-top:10px"><b>Заметки</b>'
      + d.notes.map(n=>'<div class="muted">'+fmtDT(n.at)+' · '+esc(n.by)+': '+esc(n.text)+'</div>').join('') + '</div>';
  }
  return html;
}

/* ============== CARS ============== */
function viewCars(tab){
  const DB = S.DB;
  if(tab===1) return viewCarDocs();
  if(tab===2) return viewCarsRowByRow();
  const defs = [
    { key:'status', label:'Статус', type:'sel', options:E.CAR_STATUS },
    { key:'model', label:'Модель', type:'sel', options:E.MODELS },
    { key:'div', label:'Филиал', type:'sel', get:(c)=>divName(c.div), options:DB.divs.map(d=>d.name) }
  ];
  const filtered = G.applyFilters('cars', DB.cars, defs);
  const cols = [
    { label:'Госномер', render:c=>'<b>'+esc(c.plate)+'</b>' },
    { label:'Модель', key:'model' }, { label:'Год', key:'year' },
    { label:'КПП', key:'akpp' }, { label:'ГБО', render:c=>c.gbo?'Да':'—' },
    { label:'Статус', render:c=>G.statusPill(c.status) },
    { label:'Пробег', render:c=>num(c.mileage)+' км' },
    { label:'Филиал', render:c=>esc(divName(c.div)) },
    { label:'', render:c=>'<button class="btn btn-sm btn-ghost" data-act="open-car" data-id="'+c.id+'">Карточка</button>' }
  ];
  let html = '<div class="card-head"><div></div><div class="card-actions">'+G.filtersHTML('cars', defs)
    + '<button class="btn btn-sm btn-primary" data-act="add-car">+ Автомобиль</button></div></div>';
  html += G.tableHTML(cols, filtered, { title:'Список автомобилей ('+filtered.length+')', page:page('cars'), pageKey:'cars' });
  return html;
}
function expiryPill(dateStr){
  const days = U.daysBetween(NOW, new Date(dateStr));
  const kind = days<0 ? 'bad' : (days<=30?'warn':'ok');
  return '<span class="pill pill-'+kind+'">'+fmtD(dateStr)+' ('+(days<0?'просрочено':days+' дн.')+')</span>';
}
function viewCarDocs(){
  const DB = S.DB;
  const cols = [
    { label:'Госномер', key:'plate' }, { label:'Модель', key:'model' },
    { label:'Страховка до', render:c=>expiryPill(c.insUntil) },
    { label:'Техосмотр до', render:c=>expiryPill(c.techUntil) },
    { label:'Лизинг до', render:c=>expiryPill(c.leaseUntil) },
    { label:'Страховая', render:c=>esc((DB.insurers.find(i=>i.id===c.insurer)||{}).name||'') }
  ];
  return G.tableHTML(cols, DB.cars, { title:'Документы автопарка' });
}
function viewCarsRowByRow(){
  const DB = S.DB;
  return DB.cars.map(c => {
    const d = DB.drivers.find(x=>x.car===c.id);
    return '<div class="card"><div class="card-head"><h3>'+esc(c.plate)+' · '+esc(c.model)+'</h3>'+G.statusPill(c.status)+'</div>'
      + '<div class="grid grid-4">'
      + statTile('Год', c.year,'') + statTile('Пробег', num(c.mileage)+' км','')
      + statTile('Филиал', divName(c.div),'') + statTile('Водитель', d?d.fio:'Не закреплён','')
      + '</div></div>';
  }).join('');
}

/* ============== FINES ============== */
function viewFines(tab){
  const DB = S.DB;
  if(tab===1) return viewFinesExport();
  const defs = [
    { key:'status', label:'Статус', type:'sel', options:E.FINE_STATUS },
    { key:'driver', label:'Водитель', type:'text' },
    { key:'car', label:'Автомобиль', type:'text' }
  ];
  const filtered = G.applyFilters('fines', DB.fines, defs);
  const cols = [
    { label:'№', key:'doc' }, { label:'Нарушение', key:'viol' },
    { label:'Дата', render:f=>fmtD(f.violAt) }, { label:'Сумма', render:f=>cur(f.sum) },
    { label:'Авто', key:'car' }, { label:'Водитель', key:'driver' },
    { label:'Статус', render:f=>G.statusPill(f.status) },
    { label:'', render:f=> f.status==='Не оплачен' ? '<button class="btn btn-sm btn-primary" data-act="pay-fine" data-id="'+f.id+'">Оплатить</button>' : '' }
  ];
  let html = '<div class="card-head"><div></div><div class="card-actions">'+G.filtersHTML('fines', defs)+'</div></div>';
  html += G.tableHTML(cols, filtered, { title:'Реестр штрафов ('+filtered.length+')', page:page('fines'), pageKey:'fines' });
  return html;
}
function viewFinesExport(){
  const DB = S.DB;
  let html = '<div class="card"><div class="card-head"><h3>Выгрузки в банк</h3>'
    + '<button class="btn btn-primary" data-act="export-fines">Сформировать выгрузку CSV</button></div>'
    + '<div class="muted">Формирует клиент-банк файл по неоплаченным штрафам (see doExport в разделе 14 спецификации).</div></div>';
  const cols = [{label:'Банк',key:'bank'},{label:'№',key:'doc'},{label:'Сумма',render:f=>cur(f.sum)},{label:'Статус',render:f=>G.statusPill(f.status)}];
  html += G.tableHTML(cols, DB.fines.filter(f=>f.status==='Не оплачен'), { title:'К выгрузке' });
  return html;
}

/* ============== MGMT (Касса и пр.) ============== */
function viewMgmt(tab){
  const DB = S.DB;
  if(tab===1) return viewInstalments();
  if(tab===2) return viewMgmtOrders();
  if(tab===3) return viewHistory();
  if(tab===4) return viewComps();
  if(tab===5) return viewFinOverview();
  return viewCash();
}
function viewCash(){
  const DB = S.DB;
  const defs = [
    { key:'src', label:'Источник', type:'sel', options:E.SOURCES },
    { key:'type', label:'Тип', type:'sel', options:E.OPTYPES },
    { key:'iface', label:'Интерфейс', type:'sel', options:E.IFACES },
    { key:'driver', label:'Водитель', type:'text' }
  ];
  const sorted = DB.cash.slice().sort((a,b)=>new Date(b.at)-new Date(a.at));
  const filtered = G.applyFilters('cash', sorted, defs);
  const totals = G.ledgerTotals(DB);
  let html = '<div class="grid grid-3">'
    + statTile('Начислено (30 дн.)', cur(totals.accrued),'')
    + statTile('Собрано (30 дн.)', cur(totals.collected),'')
    + statTile('Собираемость', pctS(totals.rate),'')
    + '</div>';
  html += '<div class="card-head"><div></div><div class="card-actions">'+G.filtersHTML('cash', defs)
    + '<button class="btn btn-sm btn-primary" data-act="add-cash-op">+ Операция</button></div></div>';
  const cols = [
    { label:'Дата', render:c=>fmtDT(c.at) }, { label:'Водитель', key:'driver' },
    { label:'Интерфейс', key:'iface' }, { label:'Источник', key:'src' },
    { label:'Тип', render:c=>G.statusPill(c.type, c.type==='Пополнение'?'ok':'bad') },
    { label:'Сумма', render:c=>cur(c.amt) }, { label:'Было', render:c=>cur(c.before) }, { label:'Стало', render:c=>cur(c.after) }
  ];
  html += G.tableHTML(cols, filtered, { title:'Касса ('+filtered.length+')', page:page('cash'), pageKey:'cash' });
  return html;
}
function viewInstalments(){
  const DB = S.DB;
  const cols = [
    { label:'Водитель', key:'driver' }, { label:'Авто', key:'car' }, { label:'Вид', key:'kind' },
    { label:'Всего', render:r=>cur(r.total) }, { label:'Остаток', render:r=>cur(r.left) },
    { label:'В день', render:r=>cur(r.perDay) }, { label:'Статус', render:r=>G.statusPill(r.status) }
  ];
  return G.tableHTML(cols, DB.instal, { title:'Рассрочки' });
}
function viewMgmtOrders(){
  const DB = S.DB;
  const cols = [
    { label:'№', key:'no' }, { label:'Тип', key:'type' }, { label:'Водитель', key:'driver' },
    { label:'Авто', key:'car' }, { label:'Статус', render:r=>G.statusPill(r.status) }, { label:'Дата', render:r=>fmtD(r.createdAt) }
  ];
  return G.tableHTML(cols, DB.orders, { title:'Заказы (путевые листы / заявки на авто)' });
}
function viewHistory(){
  const DB = S.DB;
  const cols = [
    { label:'Дата', render:r=>fmtD(r.at) }, { label:'Кто', key:'who' }, { label:'Раздел', key:'section' },
    { label:'Объект', key:'obj' }, { label:'Поле', key:'field' },
    { label:'Было', key:'from' }, { label:'Стало', key:'to' }
  ];
  return G.tableHTML(cols, DB.history.slice().sort((a,b)=>new Date(b.at)-new Date(a.at)), { title:'История изменений' });
}
function viewComps(){
  const DB = S.DB;
  const canApprove = G.hasRight('Компенсации: одобрение');
  const cols = [
    { label:'Дата', render:r=>fmtD(r.at) }, { label:'Водитель', key:'driver' }, { label:'Причина', key:'reason' },
    { label:'Сумма', render:r=>cur(r.sum) }, { label:'Статус', render:r=>G.statusPill(r.status) },
    { label:'Комментарий', key:'note' },
    { label:'', render:r=> (r.status==='На одобрении' && canApprove)
      ? '<button class="btn btn-sm btn-primary" data-act="approve-comp" data-id="'+r.id+'">Одобрить</button> <button class="btn btn-sm btn-ghost" data-act="reject-comp" data-id="'+r.id+'">Отказать</button>'
      : (r.decidedBy ? '<span class="muted">'+esc(r.decidedBy)+'</span>' : '') }
  ];
  let html = '<div class="card-head"><div></div><div class="card-actions"><button class="btn btn-sm btn-primary" data-act="add-comp">+ Запрос</button></div></div>';
  html += G.tableHTML(cols, DB.comps, { title:'Компенсации' });
  return html;
}
function viewFinOverview(){
  const DB = S.DB;
  const totals = G.ledgerTotals(DB);
  const income = DB.pnl.filter(p=>p.type==='Доход').reduce((s,p)=>s+p.amount,0);
  const expense = DB.pnl.filter(p=>p.type==='Расход').reduce((s,p)=>s+p.amount,0);
  let html = '<div class="grid grid-4">'
    + statTile('Начислено', cur(totals.accrued),'')
    + statTile('Собрано', cur(totals.collected),'')
    + statTile('Доходы (P&L)', cur(income),'')
    + statTile('Расходы (P&L)', cur(expense),'')
    + '</div>';
  html += '<div class="card"><div class="card-head"><h3>Собираемость по менеджерам</h3></div><div class="grid grid-2">';
  DB._kpi.forEach(m => {
    html += '<div class="stat-tile"><div class="l">'+esc(m.name)+'</div><div class="v">'+pctS(m.facts.collection)+'</div>'+G.barBlock(m.facts.collection*100)+'</div>';
  });
  html += '</div></div>';
  return html;
}

/* ============== REFS (Справочники) ============== */
function viewRefs(tab){
  const DB = S.DB;
  const specs = [
    { key:'orgs', title:'Организации', cols:[{label:'Название',key:'name'}] },
    { key:'divs', title:'Подразделения', cols:[{label:'Название',key:'name'},{label:'Город',key:'city'},{label:'Менеджер',key:'manager'}] },
    { key:'disp', title:'Диспетчерские', cols:[{label:'Название',key:'name'}] },
    { key:'terminals', title:'Терминалы', cols:[{label:'Название',key:'name'},{label:'Статус',render:r=>G.statusPill(r.status)}] },
    { key:'banks', title:'Банки', cols:[{label:'Название',key:'name'},{label:'BIC',key:'bic'}] },
    { key:'reasons', title:'Компенсации причины', cols:[{label:'Причина',key:'name'},{label:'Лимит',render:r=>cur(r.limit)}] },
    { key:'insurers', title:'Страховые компании', cols:[{label:'Название',key:'name'}] },
    { key:'tags', title:'Теги', cols:[{label:'Название',render:r=>'<span class="chip" style="--chip-c:'+r.color+'">'+esc(r.name)+'</span>'}] }
  ];
  const spec = specs[tab] || specs[0];
  let html = '<div class="card-head"><div></div><div class="card-actions"><button class="btn btn-sm btn-primary" data-act="add-ref" data-ref="'+spec.key+'">+ Добавить</button></div></div>';
  html += G.tableHTML(spec.cols, DB[spec.key], { title: spec.title });
  return html;
}

/* ============== USERS ============== */
function viewUsers(){
  const DB = S.DB;
  const canManage = G.hasRight('Пользователи');
  const cols = [
    { label:'Имя', key:'name' }, { label:'Должность', key:'role' }, { label:'Роль доступа', key:'appRole' },
    { label:'Филиал', render:u=> u.div ? esc(divName(u.div)) : 'Все' },
    { label:'Права', render:u=> u.rights.map(r=>'<span class="pill pill-ok" style="margin:1px">'+esc(r)+'</span>').join(' ') },
    { label:'', render:u=> canManage ? '<button class="btn btn-sm btn-ghost" data-act="edit-rights" data-id="'+u.id+'">Изменить права</button>' : '' }
  ];
  let html = '<div class="card-head"><div></div><div class="card-actions">'+(canManage?'<button class="btn btn-sm btn-primary" data-act="add-user">+ Пользователь</button>':'')+'</div></div>';
  html += G.tableHTML(cols, DB.users, { title:'Пользователи' });
  return html;
}

G.VIEWS.dash = viewDash;
G.VIEWS.drivers = viewDrivers;
G.VIEWS.cars = viewCars;
G.VIEWS.fines = viewFines;
G.VIEWS.mgmt = viewMgmt;
G.VIEWS.refs = viewRefs;
G.VIEWS.users = viewUsers;

G.helpers = G.helpers || {};
Object.assign(G.helpers, { statTile, driverById, carById, divName, orgName, doExport, driverBalanceCard, page });

/* ---- actions ---- */
Object.assign(G.ACTIONS, {
  'open-driver': (t) => {
    const d = driverById(t.dataset.id);
    G.openModal({ title: d.fio, body: driverBalanceCard(d), footer:'<button class="btn btn-ghost" data-act="close-modal">Закрыть</button>' });
  },
  'open-car': (t) => {
    const c = carById(t.dataset.id);
    const d = S.DB.drivers.find(x=>x.car===c.id);
    const body = '<div class="grid grid-2">'
      + statTile('Модель', c.model,'') + statTile('Год', c.year,'')
      + statTile('Пробег', num(c.mileage)+' км','') + statTile('Статус', c.status,'')
      + statTile('Страховка', fmtD(c.insUntil),'') + statTile('Техосмотр', fmtD(c.techUntil),'')
      + statTile('Водитель', d?d.fio:'—','')
      + '</div>';
    G.openModal({ title: c.plate, body, footer:'<button class="btn btn-ghost" data-act="close-modal">Закрыть</button>' });
  },
  'pay-fine': (t) => {
    const f = S.DB.fines.find(x=>x.id===t.dataset.id);
    if(f){ f.status='Оплачен'; G.toast('Штраф '+f.doc+' отмечен оплаченным'); }
  },
  'export-fines': () => {
    const rows = S.DB.fines.filter(f=>f.status==='Не оплачен');
    doExport('fines', rows, [
      {label:'Документ', key:'doc'}, {label:'Сумма', key:'sum'}, {label:'Банк', key:'bank'}, {label:'Водитель', key:'driver'}
    ]);
  },
  'approve-comp': (t) => {
    const c = S.DB.comps.find(x=>x.id===t.dataset.id);
    if(c){ c.status='Одобрено'; c.decidedBy=G.currentUser().name; c.decidedAt=U.iso(NOW); c.comment='Подтверждено, начислено на баланс';
      const d = driverById(c.driverId);
      if(d){ S.DB.cash.push(G.mkCash(d, NOW, 'Пополнение', c.sum, 'Менеджер', 'Баланс', G.currentUser().name)); G.recalcBalances(S.DB); }
      G.toast('Компенсация одобрена'); }
  },
  'reject-comp': (t) => {
    const c = S.DB.comps.find(x=>x.id===t.dataset.id);
    if(c){ c.status='Отказано'; c.decidedBy=G.currentUser().name; c.decidedAt=U.iso(NOW); c.comment='Недостаточно подтверждающих документов'; G.toast('Компенсация отклонена'); }
  },
  'resolve-dupe': (t) => { S.DB.dupes = S.DB.dupes.filter(x=>x.id!==t.dataset.id); G.toast('Отмечено как не дубль'); },
  'merge-dupe': (t) => { S.DB.dupes = S.DB.dupes.filter(x=>x.id!==t.dataset.id); G.toast('Карточки объединены'); }
});

})(typeof window !== 'undefined' ? window : globalThis);
