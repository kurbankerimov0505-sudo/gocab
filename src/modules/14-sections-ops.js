/* ===== 14. OPERATIONS SECTIONS: repairs (7-phase board), handover,
   shifts, inspections, incidents ===== */
(function(global){
'use strict';
const G = global.GC, U = G.Utils, C = G.CONST, E = G.ENUM;
const { esc, money, cur, pctS, num, fmtD, fmtDT, iso, shift, NOW, TODAY } = U;
const S = G.S;
const H = G.helpers;

function orderByNo(no){ return S.DB.orders2.find(o=>o.no===no); }
function driverName(id){ const d=S.DB.drivers.find(x=>x.id===id); return d?d.fio:'—'; }

/* ============== REPAIRS ============== */
function viewRepairs(tab){
  if(tab===1) return viewRepairCalendar();
  if(tab===2) return viewRepairPosts();
  if(tab===3) return viewRepairParts();
  if(tab===4) return viewRepairEfficiency();
  return viewRepairBoard();
}
function viewRepairBoard(){
  const DB = S.DB;
  let html = '<div class="card-head"><h3>Наряд-заказы</h3>'
    + '<div class="card-actions"><button class="btn btn-sm btn-primary" data-act="add-repair">+ Записать на ремонт</button></div></div>';
  html += '<div class="phase-board">';
  E.REPAIR_PHASES.forEach((label, i) => {
    const orders = DB.orders2.filter(o=>o.phase===i);
    html += '<div class="phase-col"><h4>'+(i)+'. '+esc(label)+' ('+orders.length+')</h4>';
    orders.forEach(o => {
      html += '<div class="phase-card" data-act="open-repair" data-no="'+esc(o.no)+'">'
        + '<b>'+esc(o.no)+'</b>' + esc(o.car)+' · '+esc(o.model)+'<br>'
        + '<span class="muted">'+esc(o.reason)+'</span><br>'
        + G.statusPill(o.prio, o.prio==='Критично'?'bad':(o.prio==='Высокий'?'warn':'ok'))
        + (o.demoOpen ? ' <span class="pill pill-ok">демо · сейчас</span>' : '')
        + (o.demoBlocked ? ' <span class="pill pill-bad">вне окна</span>' : '')
        + '</div>';
    });
    html += '</div>';
  });
  html += '</div>';
  return html;
}
function repairModalBody(o){
  const chk = G.canAdvance(o);
  let html = '<div class="grid grid-2">'
    + H.statTile('Авто', o.car+' · '+o.model,'') + H.statTile('Водитель', driverName(o.driverId),'')
    + H.statTile('Причина', o.reason,'') + H.statTile('Приоритет', o.prio,'')
    + H.statTile('Слот', fmtD(o.slotDay)+' '+o.slot,'') + H.statTile('Пост/механик', (o.post||'—')+' / '+(o.mech||'—'),'')
    + '</div>';
  if(o.phase===0){
    html += '<div class="muted">Окно приёмки: '+G.intakeWindowLabel(o)+' (сейчас: '+fmtDT(U.NOW)+')</div>';
  }
  html += '<div><b>Работы:</b><ul>'+o.works.map(w=>'<li>'+esc(w.name)+' ('+w.h+' ч) '+(w.done?'✓':'')+'</li>').join('')+'</ul></div>';
  if(o.parts.length){
    html += '<div><b>Запчасти:</b><ul>'+o.parts.map(p=>'<li>'+esc(p.name)+' × '+p.qty+' — '+(p.issued?'выдано':'не выдано')+'</li>').join('')+'</ul></div>';
  }
  html += '<div class="muted">Возвратов на доработку: '+(o.returns||0)+'</div>';
  if(!chk.ok) html += '<div class="pill pill-bad" style="display:block;margin-top:6px">'+esc(chk.reason)+'</div>';
  return html;
}
function openRepairModal(no){
  const o = orderByNo(no);
  if(!o) return;
  const chk = G.canAdvance(o);
  const footer = '<button class="btn btn-ghost" data-act="close-modal">Закрыть</button>'
    + (o.phase>0 ? '<button class="btn btn-ghost" data-act="repair-return" data-no="'+esc(o.no)+'">← Вернуть фазу</button>' : '')
    + (o.phase<6 ? '<button class="btn btn-primary" data-act="repair-advance" data-no="'+esc(o.no)+'" '+(chk.ok?'':'disabled')+'>Продвинуть →</button>' : '');
  G.openModal({ title: o.no+' · '+E.REPAIR_PHASES[o.phase], body: repairModalBody(o), footer });
}
function viewRepairCalendar(){
  const DB = S.DB;
  const day = S._calDay || U.iso(TODAY);
  const slots = G.daySlots();
  let html = '<div class="card-head"><h3>Календарь записи</h3>'
    + '<div class="card-actions"><input type="date" id="calDayPick" data-act-input="cal-day" value="'+day+'"></div></div>';
  html += '<div class="table-scroll"><table class="tbl"><thead><tr><th>Слот</th>'
    + Object.keys(G.SHOPS).map(s=>'<th>'+esc(s)+'</th>').join('') + '</tr></thead><tbody>';
  slots.forEach(slot => {
    html += '<tr><td>'+slot+'</td>';
    Object.keys(G.SHOPS).forEach(shop => {
      const cap = G.SHOPS[shop].perSlot;
      const booked = DB.orders2.filter(o=>o.slotDay===day && o.slot===slot && o.reason===shop).length;
      html += '<td>'+booked+'/'+cap+(booked>=cap?' <span class="pill pill-bad">занято</span>':'')+'</td>';
    });
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  return html;
}
function viewRepairPosts(){
  const DB = S.DB;
  const bays = [...new Set(Object.values(G.SHOPS).map(s=>s.bay))];
  let html = '<div class="grid grid-3">';
  bays.forEach(bay => {
    const active = DB.orders2.filter(o=>o.post===bay && o.phase>=2 && o.phase<6);
    html += '<div class="card"><div class="card-head"><h3>'+esc(bay)+'</h3></div>'
      + (active.length? active.map(o=>'<div class="phase-card"><b>'+esc(o.no)+'</b>'+esc(o.car)+' — '+esc(o.reason)+'<br><span class="muted">'+esc(o.mech)+'</span></div>').join('')
        : '<div class="empty-state">Свободен</div>')
      + '</div>';
  });
  html += '</div>';
  html += '<div class="card"><div class="card-head"><h3>Загрузка механиков</h3></div><div class="grid grid-3">';
  G.MECHANICS.forEach(m => {
    const hrs = DB.orders2.filter(o=>o.mech===m.name && o.phase>=2 && o.phase<6)
      .reduce((s,o)=>s+o.works.reduce((s2,w)=>s2+(w.done?0:w.h),0),0);
    html += '<div class="stat-tile"><div class="l">'+esc(m.name)+'</div><div class="v">'+hrs.toFixed(1)+' ч</div>'
      + '<div class="muted">'+esc(m.spec.join(', '))+'</div></div>';
  });
  html += '</div></div>';
  return html;
}
function viewRepairParts(){
  const DB = S.DB;
  const cols = [
    { label:'Артикул', key:'art' }, { label:'Название', key:'name' },
    { label:'Остаток', render:p=> p.stock+(p.stock<=p.min?' <span class="pill pill-bad">мин.</span>':'') },
    { label:'Мин. остаток', key:'min' }, { label:'Цена', render:p=>cur(p.price) }, { label:'Поставщик', key:'sup' }
  ];
  let html = '<div class="card-head"><div></div><div class="card-actions"><button class="btn btn-sm btn-primary" data-act="add-part">+ Приход</button></div></div>';
  html += G.tableHTML(cols, DB.parts, { title:'Склад запчастей' });
  return html;
}
function viewRepairEfficiency(){
  const DB = S.DB;
  const closed = DB.orders2.filter(o=>o.phase===6);
  const avgReturns = DB.orders2.length ? DB.orders2.reduce((s,o)=>s+(o.returns||0),0)/DB.orders2.length : 0;
  let html = '<div class="grid grid-3">'
    + H.statTile('Закрыто наряд-заказов', closed.length,'')
    + H.statTile('Среднее число возвратов', avgReturns.toFixed(2),'')
    + H.statTile('Открыто сейчас', DB.orders2.filter(o=>o.phase<6).length,'')
    + '</div>';
  html += '<div class="card"><div class="card-head"><h3>Загрузка по механикам (ФОТ)</h3></div>';
  const cols = [{label:'Механик',key:'name'},{label:'Специализация',render:m=>esc(m.spec.join(', '))},{label:'Оклад',render:m=>cur(m.salary)}];
  html += G.tableHTML(cols, G.MECHANICS, {});
  html += '</div>';
  return html;
}

/* ============== HANDOVER ============== */
function viewHandover(tab){
  if(tab===1) return viewNewAct();
  const DB = S.DB;
  const cols = [
    { label:'Дата', render:a=>fmtD(a.at) }, { label:'Вид', render:a=>G.statusPill(a.kind, a.kind==='Выдача'?'ok':'warn') },
    { label:'Авто', key:'car' }, { label:'Водитель', key:'driver' }, { label:'Кем', key:'by' },
    { label:'Повреждения', render:a=> a.dmg.length? a.dmg.map(d=>esc(d.zone)+' — '+esc(d.type)).join(', ') : '—' },
    { label:'Подписан', render:a=>a.signed?'✓':'—' }
  ];
  return G.tableHTML(cols, DB.acts.slice().sort((a,b)=>new Date(b.at)-new Date(a.at)), { title:'Акты приёма-выдачи' });
}
function viewNewAct(){
  const DB = S.DB;
  const driverOpts = DB.drivers.filter(d=>d.car).map(d=>({value:d.id, label:d.fio}));
  const body = G.mField('Вид акта','kind','select',{options:[{value:'Выдача',label:'Выдача'},{value:'Возврат',label:'Возврат'}]})
    + G.mField('Водитель','driverId','select',{options:driverOpts})
    + G.mField('Пробег','mileage','num')
    + G.mField('Топливо, %','fuel','num')
    + G.mField('Подписан','signed','checkbox');
  return '<div class="card"><div class="card-head"><h3>Новый акт</h3></div><div class="modal-body" style="padding:0">'+body+'</div>'
    + '<div style="margin-top:10px"><button class="btn btn-primary" data-act="create-act">Создать акт</button></div></div>';
}

/* ============== SHIFTS ============== */
function viewShifts(tab){
  if(tab===1) return viewReleaseToLine();
  const DB = S.DB;
  const defs = [
    { key:'status', label:'Статус', type:'sel', options:E.SHIFT_STATUS },
    { key:'driver', label:'Водитель', type:'text' }
  ];
  const filtered = G.applyFilters('shifts', DB.shifts.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)), defs);
  const cols = [
    { label:'Дата', render:s=>fmtD(s.date) }, { label:'Водитель', key:'driver' }, { label:'Авто', key:'car' },
    { label:'Начало', key:'start' }, { label:'Конец', key:'end' }, { label:'Часы', key:'hours' },
    { label:'Заказы', key:'orders' }, { label:'Выручка', render:s=>cur(s.revenue) },
    { label:'Путевой лист', render:s=>s.waybill?'✓':'—' }, { label:'Статус', render:s=>G.statusPill(s.status) }
  ];
  let html = '<div class="card-head"><div></div><div class="card-actions">'+G.filtersHTML('shifts', defs)+'</div></div>';
  html += G.tableHTML(cols, filtered, { title:'Журнал смен ('+filtered.length+')', page:H.page('shifts'), pageKey:'shifts' });
  return html;
}
function releaseChecks(d){
  const car = S.DB.cars.find(c=>c.id===d.car);
  const checks = [
    { label:'Срок прав действителен', ok: U.daysBetween(NOW, new Date(d.licUntil)) >= 0 },
    { label:'Документы авто действительны', ok: car ? (U.daysBetween(NOW,new Date(car.insUntil))>=0 && U.daysBetween(NOW,new Date(car.techUntil))>=0) : false },
    { label:'Не в чёрном списке', ok: d.status!=='Заблокирован' },
    { label:'Путевой лист выписан', ok: !!S.DB.shifts.find(s=>s.driverId===d.id && s.date===U.iso(TODAY) && s.waybill) },
    { label:'Осмотр пройден', ok: !!S.DB.inspections.find(i=>i.driverId===d.id) }
  ];
  return checks;
}
function viewReleaseToLine(){
  const DB = S.DB;
  let html = '<div class="card"><div class="card-head"><h3>Выпуск на линию</h3></div>';
  DB.drivers.filter(d=>d.car).forEach(d => {
    const checks = releaseChecks(d);
    const blocked = checks.some(c=>!c.ok);
    html += '<div class="phase-card" style="margin-bottom:8px"><b>'+esc(d.fio)+'</b> — '+esc((S.DB.cars.find(c=>c.id===d.car)||{}).plate||'')
      + ' ' + (blocked ? '<span class="pill pill-bad">Заблокирован</span>' : '<span class="pill pill-ok">Готов к выпуску</span>')
      + '<div class="muted">'+checks.map(c=>(c.ok?'✓ ':'✗ ')+c.label).join(' · ')+'</div>'
      + (!blocked ? '<button class="btn btn-sm btn-primary" data-act="release-driver" data-id="'+d.id+'" style="margin-top:6px">Выпустить</button>' : '')
      + '</div>';
  });
  html += '</div>';
  return html;
}

/* ============== INSPECTIONS ============== */
function viewInspections(tab){
  if(tab===1) return viewTariffs();
  const DB = S.DB;
  const cols = [
    { label:'Дата', render:i=>fmtD(i.at) }, { label:'Авто', key:'car' }, { label:'Водитель', key:'driver' },
    { label:'Вид', key:'kind' }, { label:'Механик', key:'mech' },
    { label:'Повреждения', render:i=> i.dmg.length ? i.dmg.map(d=>esc(d.zone)+' ('+cur(d.price)+')').join(', ') : '—' },
    { label:'Итого', render:i=>cur(i.total) },
    { label:'', render:i=> (i.total>0 && !i.charged) ? '<button class="btn btn-sm btn-primary" data-act="charge-inspection" data-id="'+i.id+'">Начислить</button>' : (i.charged?'<span class="pill pill-ok">Начислено</span>':'') }
  ];
  return G.tableHTML(cols, DB.inspections.slice().sort((a,b)=>new Date(b.at)-new Date(a.at)), { title:'Журнал осмотров' });
}
function viewTariffs(){
  const DB = S.DB;
  const cols = [{label:'Зона',key:'zone'},{label:'Тип повреждения',key:'type'},{label:'Цена',render:t=>cur(t.price)}];
  return G.tableHTML(cols, DB.tariffs, { title:'Тарифы повреждений' });
}

/* ============== INCIDENTS ============== */
function viewIncidents(){
  const DB = S.DB;
  const cols = [
    { label:'Дата', render:i=>fmtD(i.at) }, { label:'Авто', key:'car' }, { label:'Водитель', key:'driver' },
    { label:'Тип', key:'type' }, { label:'Виновник', key:'guilty' }, { label:'Сумма', render:i=>cur(i.sum) },
    { label:'Страховая', key:'insurer' }, { label:'Покрытие', render:i=>G.statusPill(i.cover) },
    { label:'Статус', render:i=>G.statusPill(i.status) }
  ];
  let html = '<div class="card-head"><div></div><div class="card-actions"><button class="btn btn-sm btn-primary" data-act="add-incident">+ Случай</button></div></div>';
  html += G.tableHTML(cols, DB.incidents, { title:'Реестр случаев' });
  return html;
}

G.VIEWS.repairs = viewRepairs;
G.VIEWS.handover = viewHandover;
G.VIEWS.shifts = viewShifts;
G.VIEWS.inspections = viewInspections;
G.VIEWS.incidents = viewIncidents;

Object.assign(G.ACTIONS, {
  'open-repair': (t) => openRepairModal(t.dataset.no),
  'repair-advance': (t) => {
    const o = orderByNo(t.dataset.no);
    const r = G.advancePhase(o);
    if(r.ok) { G.toast(o.no+' → '+E.REPAIR_PHASES[o.phase]); G.closeModal(); }
    else { G.toast(r.reason); }
  },
  'repair-return': (t) => {
    const o = orderByNo(t.dataset.no);
    const r = G.returnPhase(o);
    if(r.ok){ G.toast(o.no+' возвращён на «'+E.REPAIR_PHASES[o.phase]+'»'); G.closeModal(); }
  },
  'release-driver': (t) => { G.toast('Водитель выпущен на линию'); },
  'charge-inspection': (t) => {
    const insp = S.DB.inspections.find(x=>x.id===t.dataset.id);
    if(!insp) return;
    insp.charged = true;
    const d = S.DB.drivers.find(x=>x.id===insp.driverId);
    if(d){ S.DB.cash.push(G.mkCash(d, U.NOW, 'Списание', insp.total, 'Менеджер', 'Баланс повреждений', G.currentUser().name)); G.recalcBalances(S.DB); }
    G.toast('Начислено на баланс повреждений: '+cur(insp.total));
  }
});

})(typeof window !== 'undefined' ? window : globalThis);
