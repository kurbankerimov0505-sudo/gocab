/* ===== 15. MONEY & COMMS SECTIONS: deposits, contracts, leasing, pnl,
   tickets, import, comments ===== */
(function(global){
'use strict';
const G = global.GC, U = G.Utils, C = G.CONST, E = G.ENUM;
const { esc, cur, pctS, num, fmtD, fmtDT, NOW } = U;
const S = G.S;
const H = G.helpers;

/* ============== DEPOSITS ============== */
function viewDeposits(tab){
  if(tab===1) return viewPayouts();
  const DB = S.DB;
  const cols = [
    { label:'Водитель', key:'driver' }, { label:'Авто', key:'car' },
    { label:'Норма', render:d=>cur(d.target) }, { label:'Внесено', render:d=>cur(d.amount) },
    { label:'Заполнение', render:d=>G.barBlock(d.target? d.amount/d.target*100:0, d.amount<d.target?'warn':'ok') },
    { label:'В день', render:d=>cur(d.perDay) }, { label:'Последнее пополнение', render:d=>fmtD(d.last) }
  ];
  return G.tableHTML(cols, DB.deposits, { title:'Депозиты водителей' });
}
function viewPayouts(){
  const DB = S.DB;
  const defs = [{ key:'status', label:'Статус', type:'sel', options:E.PAYOUT_STATUS }];
  const filtered = G.applyFilters('payouts', DB.payouts.slice().sort((a,b)=>new Date(b.at)-new Date(a.at)), defs);
  const cols = [
    { label:'Дата', render:p=>fmtD(p.at) }, { label:'Водитель', key:'driver' }, { label:'Сумма', render:p=>cur(p.amount) },
    { label:'Метод', key:'method' }, { label:'Поездок', key:'trips' }, { label:'Стоимость', render:p=>cur(p.cost) },
    { label:'Длит., мин', key:'dur' }, { label:'В час', key:'perHour' },
    { label:'Флаги', render:p=> p.flags.length ? p.flags.map(f=>'<span class="pill pill-warn">'+esc(f)+'</span>').join(' ') : '—' },
    { label:'Статус', render:p=>G.statusPill(p.status) },
    { label:'', render:p=> p.status==='На проверке'
      ? '<button class="btn btn-sm btn-primary" data-act="approve-payout" data-id="'+p.id+'">Одобрить</button> <button class="btn btn-sm btn-ghost" data-act="reject-payout" data-id="'+p.id+'">Отклонить</button>'
      : '' }
  ];
  let html = '<div class="card-head"><div></div><div class="card-actions">'+G.filtersHTML('payouts', defs)+'</div></div>';
  html += G.tableHTML(cols, filtered, { title:'Моментальные выплаты ('+filtered.length+')', page:H.page('payouts'), pageKey:'payouts' });
  return html;
}

/* ============== CONTRACTS ============== */
function viewContracts(){
  const DB = S.DB;
  const cols = [
    { label:'Водитель', key:'driver' }, { label:'Тип', key:'type' }, { label:'Авто', key:'car' },
    { label:'От', render:c=>fmtD(c.at) }, { label:'До', render:c=>fmtD(c.until) },
    { label:'Подпись', key:'sign' }, { label:'Статус', render:c=>G.statusPill(c.status) }
  ];
  return G.tableHTML(cols, DB.contracts, { title:'Электронные документы ('+DB.contracts.length+')' });
}

/* ============== LEASING ============== */
function viewLeasing(tab){
  if(tab===1) return viewLeaseSchedule();
  const DB = S.DB;
  const cols = [
    { label:'Авто', key:'car' }, { label:'Модель', key:'model' }, { label:'Лизингодатель', key:'lessor' },
    { label:'Платёж/мес', render:l=>cur(l.monthly) }, { label:'Срок', render:l=>l.paid+'/'+l.months },
    { label:'Осталось', render:l=>cur(l.rest) }, { label:'Выкуп', render:l=>cur(l.buyout) },
    { label:'Статус', render:l=>G.statusPill(l.status) }
  ];
  return G.tableHTML(cols, DB.leases, { title:'Договоры лизинга' });
}
function viewLeaseSchedule(){
  const DB = S.DB;
  const rows = DB.leases.slice().sort((a,b)=> new Date(a.next)-new Date(b.next));
  const cols = [
    { label:'Авто', key:'car' }, { label:'Следующий платёж', render:l=>fmtD(l.next) },
    { label:'Сумма', render:l=>cur(l.monthly) }, { label:'Прогресс', render:l=>G.barBlock(l.months? l.paid/l.months*100:0) }
  ];
  return G.tableHTML(cols, rows, { title:'График платежей' });
}

/* ============== P&L ============== */
function viewPnl(tab){
  if(tab===1) return viewPnlPlanFact();
  const DB = S.DB;
  const defs = [
    { key:'type', label:'Тип', type:'sel', options:['Доход','Расход'] },
    { key:'cat', label:'Категория', type:'text' }
  ];
  const filtered = G.applyFilters('pnl', DB.pnl.slice().sort((a,b)=>new Date(b.at)-new Date(a.at)), defs);
  const cols = [
    { label:'Дата', render:p=>fmtD(p.at) }, { label:'Тип', render:p=>G.statusPill(p.type, p.type==='Доход'?'ok':'bad') },
    { label:'Категория', key:'cat' }, { label:'Сумма', render:p=>cur(p.amount) }, { label:'Авто', key:'car' }
  ];
  let html = '<div class="card-head"><div></div><div class="card-actions">'+G.filtersHTML('pnl', defs)
    + '<button class="btn btn-sm btn-primary" data-act="add-pnl">+ Операция</button></div></div>';
  html += G.tableHTML(cols, filtered, { title:'Операции ('+filtered.length+')', page:H.page('pnl'), pageKey:'pnl' });
  return html;
}
function viewPnlPlanFact(){
  const DB = S.DB;
  const cats = [...new Set(DB.pnl.map(p=>p.cat))];
  const rows = cats.map(cat => {
    const fact = DB.pnl.filter(p=>p.cat===cat).reduce((s,p)=> s + (p.type==='Доход'?p.amount:-p.amount), 0);
    const plan = Math.round(fact*1.08);
    return { cat, fact, plan };
  });
  const cols = [
    { label:'Категория', key:'cat' }, { label:'План', render:r=>cur(r.plan) }, { label:'Факт', render:r=>cur(r.fact) },
    { label:'Исполнение', render:r=> r.plan? pctS(Math.abs(r.fact)/Math.abs(r.plan||1)) : '—' }
  ];
  return G.tableHTML(cols, rows, { title:'План и факт' });
}

/* ============== TICKETS ============== */
function viewTickets(tab){
  if(tab===1) return viewMailings();
  const DB = S.DB;
  const defs = [{ key:'status', label:'Статус', type:'sel', options:['Новое','В работе','Решено'] }];
  const filtered = G.applyFilters('tickets', DB.tickets.slice().sort((a,b)=>new Date(b.at)-new Date(a.at)), defs);
  const cols = [
    { label:'Дата', render:t=>fmtD(t.at) }, { label:'Водитель', key:'driver' }, { label:'Тема', key:'theme' },
    { label:'Ответственный', key:'mgr' }, { label:'SLA', key:'sla' }, { label:'Статус', render:t=>G.statusPill(t.status) },
    { label:'', render:t=> t.status!=='Решено' ? '<button class="btn btn-sm btn-primary" data-act="resolve-ticket" data-id="'+t.id+'">Решено</button>' : '' }
  ];
  let html = '<div class="card-head"><div></div><div class="card-actions">'+G.filtersHTML('tickets', defs)+'</div></div>';
  html += G.tableHTML(cols, filtered, { title:'Обращения ('+filtered.length+')', page:H.page('tickets'), pageKey:'tickets' });
  return html;
}
function viewMailings(){
  const DB = S.DB;
  const cols = [
    { label:'Название', key:'name' }, { label:'Канал', key:'channel' }, { label:'Отправлено', key:'sent' },
    { label:'Открыто', render:m=> m.opened+' ('+pctS(m.sent?m.opened/m.sent:0)+')' }, { label:'Дата', render:m=>fmtD(m.at) }
  ];
  let html = '<div class="card-head"><div></div><div class="card-actions"><button class="btn btn-sm btn-primary" data-act="add-mailing">+ Рассылка</button></div></div>';
  html += G.tableHTML(cols, DB.mailings, { title:'Рассылки' });
  return html;
}

/* ============== IMPORT ============== */
function viewImport(tab){
  if(tab===1) return viewImportHistory();
  let html = '<div class="card"><div class="card-head"><h3>Загрузка файла</h3></div>'
    + '<div class="muted">Загрузите выгрузки водителей и/или автомобилей (.xlsx или .csv) — можно выбрать оба файла сразу. '
    + 'Данные распознаются автоматически по заголовкам колонок и используются для расчёта финансового положения и статусов автопарка ниже.</div>'
    + '<input type="file" id="realImportFiles" accept=".xlsx,.csv" multiple style="margin:12px 0">'
    + '<div><button class="btn btn-primary" data-act="do-real-import"'+(S._importBusy?' disabled':'')+'>'
    + (S._importBusy ? 'Импорт…' : 'Импортировать и рассчитать')+'</button></div></div>';
  html += G.realImportResultsHTML();
  return html;
}
function viewImportHistory(){
  const DB = S.DB;
  const cols = [
    { label:'Дата', render:i=>fmtDT(i.at) }, { label:'Файл', key:'file' }, { label:'Строк', key:'rows' },
    { label:'Успешно', key:'ok' }, { label:'Ошибок', key:'errors' }, { label:'Кто', key:'by' }
  ];
  return G.tableHTML(cols, DB.imports, { title:'История загрузок' });
}

/* ============== COMMENTS ============== */
function viewComments(){
  const DB = S.DB;
  const cols = [
    { label:'Дата', render:c=>fmtDT(c.at) }, { label:'Автор', key:'by' }, { label:'Раздел', key:'section' },
    { label:'Объект', key:'obj' }, { label:'Комментарий', key:'text' }
  ];
  let html = '<div class="card"><div class="card-head"><h3>Новый комментарий</h3></div>'
    + '<textarea id="newCommentText" placeholder="Текст комментария" style="width:100%;min-height:60px;padding:8px;border:1px solid var(--line);border-radius:8px"></textarea>'
    + '<div style="margin-top:8px"><button class="btn btn-primary" data-act="add-comment">Добавить</button></div></div>';
  html += G.tableHTML(cols, DB.comments.slice().sort((a,b)=>new Date(b.at)-new Date(a.at)), { title:'Все комментарии' });
  return html;
}

G.VIEWS.deposits = viewDeposits;
G.VIEWS.contracts = viewContracts;
G.VIEWS.leasing = viewLeasing;
G.VIEWS.pnl = viewPnl;
G.VIEWS.tickets = viewTickets;
G.VIEWS.import = viewImport;
G.VIEWS.comments = viewComments;

Object.assign(G.ACTIONS, {
  'approve-payout': (t) => { const p=S.DB.payouts.find(x=>x.id===t.dataset.id); if(p){ p.status='Выплачена'; G.toast('Выплата одобрена'); } },
  'reject-payout': (t) => { const p=S.DB.payouts.find(x=>x.id===t.dataset.id); if(p){ p.status='Отклонена'; G.toast('Выплата отклонена'); } },
  'resolve-ticket': (t) => { const x=S.DB.tickets.find(k=>k.id===t.dataset.id); if(x){ x.status='Решено'; G.toast('Обращение закрыто'); } },
  'add-comment': () => {
    const ta = document.getElementById('newCommentText');
    const text = ta ? ta.value.trim() : '';
    if(!text){ G.toast('Введите текст комментария'); return; }
    S.DB.comments.push({ id:'cm-'+(S.DB.comments.length+1), at:U.NOW, by:G.currentUser().name, section:U.esc(S.sec), obj:'—', text });
    G.toast('Комментарий добавлен');
  }
});

})(typeof window !== 'undefined' ? window : globalThis);
