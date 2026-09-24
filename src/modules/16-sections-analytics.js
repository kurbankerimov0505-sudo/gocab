/* ===== 16. ANALYTICS: stats (summary/divisions/debt-matrix/collection/
   KPI/traffic-light), dispatch, tasks, notifications ===== */
(function(global){
'use strict';
const G = global.GC, U = G.Utils, C = G.CONST, E = G.ENUM;
const { esc, cur, pctS, num, fmtD, fmtDT, NOW, daysBetween } = U;
const S = G.S;
const H = G.helpers;

/* ============== STATS ============== */
function viewStats(tab){
  if(tab===1) return viewStatsDivisions();
  if(tab===2) return viewDebtMatrix();
  if(tab===3) return viewCollection();
  if(tab===4) return viewKPI();
  if(tab===5) return viewTrafficLight();
  return viewStatsSummary();
}
function viewStatsSummary(){
  const DB = S.DB;
  const totals = G.ledgerTotals(DB);
  const kpiAvg = DB._kpi.reduce((s,m)=>s+m.avgAchievement,0)/(DB._kpi.length||1);
  const work = DB.cars.filter(c=>c.status==='В работе').length;
  let html = '<div class="grid grid-4">'
    + H.statTile('Собираемость аренды', pctS(totals.rate),'')
    + H.statTile('Утилизация парка', pctS(work/DB.cars.length),'')
    + H.statTile('KPI менеджеров', pctS(kpiAvg),'')
    + H.statTile('Открытых обращений', DB.tickets.filter(t=>t.status!=='Решено').length,'')
    + '</div>';
  html += '<div class="card"><div class="card-head"><h3>Динамика собираемости, 9 мес.</h3></div>';
  const spark = DB._collection.months.map((m,i)=>{
    let acc=0,col=0; Object.values(DB._collection.perDriver).forEach(p=>{acc+=p.monthly[i].accrued;col+=p.monthly[i].collected;});
    return acc?col/acc*100:0;
  });
  html += G.lineChartMulti([{name:'Собираемость',color:'#ffc629',values:spark}],700,200);
  html += '</div>';
  return html;
}
function viewStatsDivisions(){
  const DB = S.DB;
  const rows = DB.divs.map(dv => {
    const cars = DB.cars.filter(c=>c.div===dv.id);
    const drivers = DB.drivers.filter(d=>d.div===dv.id && d.car);
    const work = cars.filter(c=>c.status==='В работе').length;
    const accrued = drivers.reduce((s,d)=> s + G.sumSrc(DB,d.id,'Баланс')*0,0); // placeholder not used
    const totals = drivers.reduce((acc,d)=>{
      const rentOps = DB.cash.filter(c=>c.driverId===d.id && c.src==='Баланс' && !c.carry);
      acc.accrued += rentOps.filter(c=>c.type==='Списание').reduce((s,c)=>s+c.amt,0);
      acc.collected += rentOps.filter(c=>c.type==='Пополнение').reduce((s,c)=>s+c.amt,0);
      return acc;
    }, {accrued:0, collected:0});
    return { name: dv.name, manager: dv.manager, cars: cars.length, work, drivers: drivers.length,
      rate: totals.accrued ? totals.collected/totals.accrued : 0 };
  });
  const cols = [
    { label:'Филиал', key:'name' }, { label:'Менеджер', key:'manager' },
    { label:'Автомобили', render:r=>r.work+'/'+r.cars }, { label:'Водители', key:'drivers' },
    { label:'Собираемость', render:r=>pctS(r.rate) }
  ];
  return G.tableHTML(cols, rows, { title:'Подразделения' });
}
function viewDebtMatrix(){
  const DB = S.DB;
  const matrix = G.debtMatrix(DB, 14); // last 14 days fits the page width comfortably
  const days = matrix[0] ? matrix[0].cells.map(c=>c.day.slice(5)) : [];
  let html = '<div class="card-head"><h3>Задолженность по дням</h3><div class="muted">Столбец «сегодня» равен балансу в разделе «Водители»</div></div>';
  html += '<div class="table-scroll"><table class="tbl"><thead><tr><th>Водитель</th><th>Бакет</th>'
    + days.map(d=>'<th>'+d+'</th>').join('') + '<th>Меры</th></tr></thead><tbody>';
  matrix.forEach(row => {
    const debtDays = G.daysInDebt(row.cells);
    const bucket = G.agingBucket(debtDays) || '—';
    html += '<tr><td><b>'+esc(row.driver)+'</b></td><td>'+bucket+'</td>';
    row.cells.forEach(c => {
      const neg = c.balance < 0;
      const depth = Math.min(1, Math.abs(c.balance)/2000);
      const bg = neg ? 'rgba(214,69,69,'+ (0.12+depth*0.55).toFixed(2) +')' : 'transparent';
      html += '<td class="heat-cell" style="background:'+bg+'">'+ (neg ? U.num(c.balance) : '<span class="dot"></span>') + '</td>';
    });
    html += '<td><button class="btn btn-sm btn-ghost" data-act="debt-measure" data-id="'+row.driverId+'">Меры</button></td></tr>';
  });
  html += '</tbody></table></div>';
  return html;
}
function viewCollection(){
  const DB = S.DB;
  if(!Object.keys(DB._collection.perDriver).length){
    return '<div class="card"><div class="empty-state">Нет данных для расчёта собираемости — 9-месячная модель требует истории начислений, '
      + 'которой нет в загруженных файлах импорта. Доступно после демо-генерации или при наличии реальной истории кассы.</div></div>';
  }
  const months = DB._collection.months;
  const agg = months.map((m,i) => {
    let acc=0,col=0; Object.values(DB._collection.perDriver).forEach(p=>{acc+=p.monthly[i].accrued;col+=p.monthly[i].collected;});
    return { month:m, accrued:acc, collected:col };
  });
  const cashTotals = G.ledgerTotals(DB);
  let html = '<div class="card"><div class="card-head"><h3>Собираемость по месяцам</h3></div>';
  html += G.lineChartMulti([{name:'Собираемость',color:'#ffc629', values: agg.map(a=>a.accrued?a.collected/a.accrued*100:0)}], 700, 200);
  html += '</div>';
  const cols = [
    { label:'Месяц', key:'month' }, { label:'Начислено', render:r=>cur(r.accrued) },
    { label:'Собрано', render:r=>cur(r.collected) }, { label:'%', render:r=>pctS(r.accrued?r.collected/r.accrued:0) }
  ];
  html += G.tableHTML(cols, agg, { title:'По месяцам (сентябрь = данные кассы: '+pctS(cashTotals.rate)+')' });
  return html;
}
function viewKPI(){
  const DB = S.DB;
  const kpis = DB._kpi;
  if(!kpis.length){
    return '<div class="card"><div class="empty-state">Нет данных для KPI менеджеров — расчёт требует 9-месячной истории начислений/собираемости, '
      + 'которой нет в загруженных файлах импорта.</div></div>';
  }
  const avg = kpis.reduce((s,m)=>s+m.avgAchievement,0)/(kpis.length||1);
  let html = '<div class="card"><div class="card-head"><h3>Итог по компании</h3></div>'
    + '<div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap">'
    + G.ring(avg, 120) + '<div class="grid grid-3" style="flex:1">'
    + G.KPI_METRICS.map(m => {
        const factAvg = kpis.reduce((s,k)=>s+k.facts[m.key],0)/(kpis.length||1);
        return H.statTile(m.name, (m.inverted?pctS(factAvg):pctS(factAvg)), 'план '+pctS(m.plan));
      }).join('')
    + '</div></div></div>';

  html += '<div class="grid grid-2">';
  kpis.forEach(m => {
    const initials = m.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    html += '<div class="card"><div class="card-head"><h3>'+esc(m.name)+'</h3>'+G.ring(m.avgAchievement, 64, pctS(m.avgAchievement))+'</div>';
    html += '<div class="grid grid-3">';
    G.KPI_METRICS.forEach(metric => {
      const fact = m.facts[metric.key];
      html += '<div class="stat-tile"><div class="l">'+esc(metric.name)+'</div>'+G.gauge(metric.inverted?1-fact:fact, metric.inverted?1-metric.plan:metric.plan, metric.inverted?1-metric.floor:metric.floor, 110, fact)+'<div class="muted">факт '+pctS(fact)+'</div></div>';
    });
    html += '</div>';
    html += '<div class="grid grid-3" style="margin-top:8px">'
      + H.statTile('Оклад + бонус', cur(m.payout),'')
      + H.statTile('Бонус', cur(m.bonus),'')
      + H.statTile('Списано', m.woN+' / '+cur(m.wo),'')
      + '</div>';
    if(m.chips.length) html += '<div style="margin-top:8px">'+m.chips.map(c=>'<span class="pill pill-bad" style="display:inline-block;margin:2px">'+esc(c)+'</span>').join('')+'</div>';
    html += '</div>';
  });
  html += '</div>';

  html += '<div class="card"><div class="card-head"><h3>Матрица бонусов</h3></div>';
  const cols = [
    { label:'Менеджер', key:'name' },
    ...G.KPI_METRICS.map(m => ({ label:m.name, render:(r)=>pctS(r.facts[m.key]) })),
    { label:'Бонус', render:r=>cur(r.bonus) }, { label:'Выплата', render:r=>cur(r.payout) }
  ];
  html += G.tableHTML(cols, kpis, {});
  html += '</div>';

  html += '<div class="card"><div class="card-head"><h3>Автопарк по менеджерам</h3></div><div class="grid grid-2">';
  kpis.forEach(m => html += H.statTile(m.name, pctS(m.facts.utilization), m.driverCount+' водителей, '+m.carCount+' авто'));
  html += '</div></div>';

  const leavers = DB.drivers.filter(d=>d.status==='Уволен');
  html += '<div class="card"><div class="card-head"><h3>Уволенные с долгом</h3></div>';
  const lcols = [{label:'ФИО',key:'fio'},{label:'Дата увольнения',render:d=>fmtD(d.fired)},{label:'Баланс',render:d=>cur(d.bal)}];
  html += G.tableHTML(lcols, leavers, {});
  html += '</div>';
  return html;
}
function viewTrafficLight(){
  const DB = S.DB;
  const rows = DB.drivers.filter(d=>d.car).map(d => {
    const hasDisc = d._disc !== null && d._disc !== undefined;
    const kind = !hasDisc ? 'warn' : (d._disc>=0.95 ? 'ok' : (d._disc>=0.85 ? 'warn' : 'bad'));
    return { fio:d.fio, disc:d._disc, bal:d.bal, kind, hasDisc };
  });
  const cols = [
    { label:'Водитель', key:'fio' },
    { label:'Дисциплина', render:r=>r.hasDisc ? pctS(r.disc) : 'нет данных' },
    { label:'Баланс', render:r=>cur(r.bal) },
    { label:'Светофор', render:r=>'<span class="pill pill-'+r.kind+'">'+(r.kind==='ok'?'Зелёный':r.kind==='warn'?'Жёлтый':'Красный')+'</span>' }
  ];
  return G.tableHTML(cols, rows.sort((a,b)=>a.disc-b.disc), { title:'Светофор дисциплины' });
}

/* ============== DISPATCH ============== */
function viewDispatch(){
  const DB = S.DB;
  const pts = DB._dispatch;
  const box = { latMin:33.4, latMax:34.1, lngMin:-7.7, lngMax:-6.7 };
  const w=700,h=340;
  const toXY = (p) => {
    const x = (p.lng-box.lngMin)/(box.lngMax-box.lngMin)*w;
    const y = h - (p.lat-box.latMin)/(box.latMax-box.latMin)*h;
    return [x,y];
  };
  let svg = '<svg viewBox="0 0 '+w+' '+h+'" class="linechart" style="height:340px;background:#f7f4ec;border-radius:8px">';
  pts.forEach(p => {
    const [x,y] = toXY(p);
    const color = p.status==='На линии' ? '#2e9e5b' : '#c9891c';
    svg += '<circle cx="'+x+'" cy="'+y+'" r="6" fill="'+color+'" stroke="#fff" stroke-width="1.5"/>';
  });
  svg += '</svg>';
  let html = '<div class="card"><div class="card-head"><h3>Диспетчерская карта</h3>'
    + '<div class="muted">Синтетические координаты — точка интеграции с реальным GPS-провайдером: DISP.feed()</div></div>' + svg + '</div>';
  const cols = [
    { label:'Водитель', key:'driver' }, { label:'Авто', key:'car' }, { label:'Город', key:'city' },
    { label:'Статус', render:p=>G.statusPill(p.status) }, { label:'Скорость', render:p=>p.speed+' км/ч' }
  ];
  html += G.tableHTML(cols, pts, { title:'Список' });
  return html;
}

/* ============== TASKS ============== */
function viewTasks(){
  const DB = S.DB;
  const role = S.role;
  const tasks = [];
  if(['Приёмщик на ремонт','Кантри-менеджер','Менеджер парка'].includes(role)){
    DB.orders2.filter(o=>o.phase===0).forEach(o => tasks.push({ sec:'repairs', title:'Приёмка '+o.no, sub: o.car+' · окно '+G.intakeWindowLabel(o), prio: o.demoOpen?'Критично':'Обычный' }));
  }
  if(['Механик','Кантри-менеджер','Менеджер парка'].includes(role)){
    DB.orders2.filter(o=>o.phase===2||o.phase===4).forEach(o => tasks.push({ sec:'repairs', title:'Работы по '+o.no, sub: o.reason, prio:o.prio }));
  }
  if(['Кладовщик','Кантри-менеджер','Менеджер парка'].includes(role)){
    DB.orders2.filter(o=>o.phase===3).forEach(o => tasks.push({ sec:'repairs', title:'Выдать запчасти '+o.no, sub: o.parts.map(p=>p.name).join(', '), prio:'Обычный' }));
  }
  DB.tickets.filter(t=>t.status!=='Решено').slice(0,5).forEach(t => tasks.push({ sec:'tickets', title:'Обращение: '+t.theme, sub:t.driver, prio:'Обычный' }));
  const cols = [
    { label:'Задача', key:'title' }, { label:'Детали', key:'sub' },
    { label:'Приоритет', render:r=>G.statusPill(r.prio, r.prio==='Критично'?'bad':(r.prio==='Высокий'?'warn':'ok')) },
    { label:'', render:r=>'<button class="btn btn-sm btn-ghost" data-act="goto" data-sec="'+r.sec+'" data-tab="0">Перейти</button>' }
  ];
  return G.tableHTML(cols, tasks, { title:'Мои задачи ('+tasks.length+')' });
}

/* ============== NOTIFICATIONS ============== */
function buildNotifRows(){
  const DB = S.DB;
  const rows = [];
  const in30 = (d) => daysBetween(NOW, new Date(d)) <= 30;
  DB.drivers.forEach(d => { if(d.licUntil && in30(d.licUntil)) rows.push({ kind:'Документы', obj:d.fio, msg:'Срок прав истекает', date:d.licUntil }); });
  DB.cars.forEach(c => {
    if(in30(c.insUntil)) rows.push({ kind:'Документы', obj:c.plate, msg:'Страховка истекает', date:c.insUntil });
    if(in30(c.techUntil)) rows.push({ kind:'Документы', obj:c.plate, msg:'Техосмотр истекает', date:c.techUntil });
  });
  DB.leases.forEach(l => { if(in30(l.next)) rows.push({ kind:'Финансы', obj:l.car, msg:'Платёж по лизингу', date:l.next }); });
  DB.fines.forEach(f => { if(f.status==='Не оплачен' && f.sum>1000) rows.push({ kind:'Финансы', obj:f.driver, msg:'Неоплаченный штраф '+cur(f.sum), date:f.violAt }); });
  return rows;
}
function viewNotif(tab){
  const rows = buildNotifRows();
  const filtered = tab===1 ? rows.filter(r=>r.kind==='Документы') : (tab===2 ? rows.filter(r=>r.kind==='Финансы') : rows);
  const cols = [
    { label:'Категория', key:'kind' }, { label:'Объект', key:'obj' }, { label:'Сообщение', key:'msg' }, { label:'Дата', render:r=>fmtD(r.date) }
  ];
  return G.tableHTML(cols, filtered.sort((a,b)=>new Date(a.date)-new Date(b.date)), { title:'Уведомления ('+filtered.length+')' });
}

G.VIEWS.stats = viewStats;
G.VIEWS.dispatch = viewDispatch;
G.VIEWS.tasks = viewTasks;
G.VIEWS.notif = viewNotif;

Object.assign(G.ACTIONS, {
  'debt-measure': (t) => {
    const d = S.DB.drivers.find(x=>x.id===t.dataset.id);
    if(!d) return;
    d.tags = d.tags || [];
    const riskTag = S.DB.tags.find(tg=>tg.name==='Риск');
    if(riskTag && !d.tags.includes(riskTag.id)) d.tags.push(riskTag.id);
    G.toast('Водитель '+d.fio+' направлен в центр взыскания и помечен тегом «Риск»');
  }
});

})(typeof window !== 'undefined' ? window : globalThis);
