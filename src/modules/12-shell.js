/* ===== 12. SHELL — topbar, drawer menu, navtabs, render pipeline,
   reveal animation ===== */
(function(global){
'use strict';
const G = global.GC, U = G.Utils;
const { esc } = U;
const S = G.S;

const MENU = [
  { group:'Обзор', items:[
    { key:'dash', label:'Главное', icon:'▤' },
    { key:'dispatch', label:'Диспетчерская', icon:'◎' },
    { key:'tasks', label:'Мои задачи', icon:'☑' },
    { key:'notif', label:'Уведомления', icon:'🔔' }
  ]},
  { group:'Парк', items:[
    { key:'cars', label:'Автопарк', icon:'🚗' },
    { key:'repairs', label:'Автосервис', icon:'🔧' },
    { key:'repairs', label:'Склад', icon:'📦', tab:3 },
    { key:'handover', label:'Приём-выдача', icon:'🔑' },
    { key:'inspections', label:'Осмотры', icon:'🔍' },
    { key:'incidents', label:'ДТП и страховые', icon:'⚠' }
  ]},
  { group:'Люди', items:[
    { key:'drivers', label:'Водители', icon:'👤' },
    { key:'shifts', label:'Смены', icon:'⏱' },
    { key:'contracts', label:'Договоры', icon:'📄' },
    { key:'tickets', label:'Обращения', icon:'✉' },
    { key:'import', label:'Импорт водителей', icon:'⇩' },
    { key:'comments', label:'Комментарии', icon:'💬' }
  ]},
  { group:'Деньги', items:[
    { key:'mgmt', label:'Банк и касса', icon:'💰' },
    { key:'fines', label:'Штрафы', icon:'🚫' },
    { key:'deposits', label:'Депозиты и выплаты', icon:'🏦' },
    { key:'leasing', label:'Лизинг', icon:'📊' },
    { key:'pnl', label:'Доходы и расходы', icon:'📈' }
  ]},
  { group:'Аналитика', items:[
    { key:'stats', label:'Отчеты', icon:'📉' }
  ]},
  { group:'Настройки', items:[
    { key:'refs', label:'Справочники', icon:'📚' },
    { key:'users', label:'Настройки', icon:'⚙' }
  ]}
];

const SECTION_TABS = {
  dash:['Главное'],
  dispatch:['Карта'],
  tasks:['Мои задачи'],
  notif:['Все','Документы','Финансы'],
  drivers:['Список водителей','Дубли'],
  cars:['Список автомобилей','Документы','Парк построчно'],
  repairs:['Наряд-заказы','Календарь записи','Посты и загрузка','Склад запчастей','Эффективность'],
  handover:['Акты приёма-выдачи','Новый акт'],
  shifts:['Журнал смен','Выпуск на линию'],
  inspections:['Журнал осмотров','Тарифы повреждений'],
  incidents:['Реестр случаев'],
  mgmt:['Касса','Рассрочка','Заказы','История','Компенсации','Финансовый обзор'],
  fines:['Реестр штрафов','Выгрузки в банк'],
  deposits:['Депозиты','Моментальные выплаты'],
  contracts:['Электронные документы'],
  leasing:['Договоры лизинга','График платежей'],
  pnl:['Операции','План и факт'],
  tickets:['Обращения','Рассылки'],
  import:['Загрузка файла','История загрузок'],
  stats:['Сводка','Подразделения','Задолженность по дням','Собираемость','KPI менеджеров','Светофор'],
  refs:['Организации','Подразделения','Диспетчерские','Терминалы','Банки','Компенсации причины','Страховые компании','Теги'],
  users:['Пользователи'],
  comments:['Все комментарии']
};
const SECTION_LABEL = {};
MENU.forEach(g => g.items.forEach(it => { if(!SECTION_LABEL[it.key]) SECTION_LABEL[it.key] = it.label; }));

G.VIEWS = G.VIEWS || {}; // sec -> function(tab) -> html, populated by section modules
G.ACTIONS = G.ACTIONS || {}; // data-act name -> function(el, ev), populated by every module that needs one

function notificationCount(){
  const DB = S.DB;
  let n = 0;
  const in30 = (d) => { const days = U.daysBetween(U.NOW, new Date(d)); return days>=0 && days<=30; };
  DB.drivers.forEach(d => { if(d.licUntil && in30(d.licUntil)) n++; });
  DB.cars.forEach(c => { if(in30(c.insUntil)) n++; if(in30(c.techUntil)) n++; });
  DB.leases.forEach(l => { if(in30(l.next)) n++; });
  DB.fines.forEach(f => { if(f.status==='Не оплачен' && f.sum>1000) n++; });
  return n;
}

function topbarHTML(){
  const u = G.currentUser();
  const initials = u.name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
  const roles = G.ENUM.ROLES;
  const langs = [['ru','RU'],['en','EN'],['fr','FR']];
  return '<div class="topbar">'
    + '<button class="icon-btn menu-btn" data-act="toggle-drawer">☰</button>'
    + '<div class="avatar">'+esc(initials)+'</div>'
    + '<div class="brand">GoCab</div>'
    + '<span class="role-pill" id="roleBox">'+esc(S.role)+'</span>'
    + '<div class="lang-switch">' + langs.map(([code,label])=>
        '<button class="lang-btn'+(S.lang===code?' active':'')+'" data-act="set-lang" data-lang="'+code+'">'+label+'</button>').join('') + '</div>'
    + '<div class="spacer"></div>'
    + '<div class="acct-wrap">'
    + '<button class="btn btn-ghost acct-toggle" data-act="toggle-acct">'+esc(u.name)+' ▾</button>'
    + '<div class="acct-menu" id="acctMenu">'
    + '<div class="acct-menu-label">Личный кабинет</div>'
    + roles.map(r => '<button class="acct-item'+(S.role===r?' active':'')+'" data-act="set-role" data-role="'+esc(r)+'">'+esc(r)+'</button>').join('')
    + '</div></div>'
    + '</div>';
}

function drawerHTML(){
  let html = '<div class="drawer-backdrop'+(S.side?' show':'')+'" data-act="close-drawer"></div>';
  html += '<nav class="drawer'+(S.side?' open':'')+'" id="nav">';
  html += '<div class="drawer-head"><b>GoCab Control</b><button class="icon-btn" data-act="close-drawer">✕</button></div>';
  MENU.forEach(g => {
    const items = g.items.filter(it => G.canSeeSection(it.key));
    if(!items.length) return;
    const open = S.menuOpen[g.group] !== false;
    html += '<div class="drawer-group">';
    html += '<button class="drawer-group-head" data-act="toggle-group" data-group="'+esc(g.group)+'">'
      + '<span>'+esc(g.group)+'</span><span class="chev">'+(open?'▾':'▸')+'</span></button>';
    html += '<div class="drawer-group-body" style="display:'+(open?'block':'none')+'">';
    items.forEach(it => {
      const activeItem = S.sec===it.key && (it.tab===undefined || S.tab===it.tab);
      html += '<button class="drawer-item'+(activeItem?' active':'')+'" data-act="goto" data-sec="'+esc(it.key)+'" data-tab="'+(it.tab||0)+'">'
        + '<span class="di-icon">'+it.icon+'</span><span>'+esc(it.label)+'</span>'
        + (it.key==='notif' ? notifBadge() : '')
        + '</button>';
    });
    html += '</div></div>';
  });
  html += '</nav>';
  return html;
}
function notifBadge(){
  const n = notificationCount();
  return n>0 ? '<span class="di-badge">'+n+'</span>' : '';
}

function navtabsHTML(){
  const tabs = SECTION_TABS[S.sec] || ['Главное'];
  return '<div class="navtabs" id="navtabs">' + tabs.map((t,i) =>
    '<button class="navtab'+(S.tab===i?' active':'')+'" data-act="set-tab" data-tab="'+i+'">'+esc(t)+'</button>'
  ).join('') + '</div>';
}

function pageHTML(){
  const fn = G.VIEWS[S.sec];
  let inner;
  try{
    inner = fn ? fn(S.tab) : '<div class="card"><div class="empty-state">Раздел в разработке</div></div>';
  } catch(e){
    inner = '<div class="card"><div class="empty-state">Ошибка отображения: '+esc(e.message)+'</div></div>';
  }
  return '<div class="page" id="page">'+inner+'</div>';
}

let lastRevealKey = '';
function render(){
  if(!G.canSeeSection(S.sec)){
    const sections = G.ROLE_SECTIONS[S.role]||['dash'];
    S.sec = sections[0]; S.tab = 0;
  }
  const root = document.getElementById('app');
  if(!root) return;
  root.innerHTML = '<div class="shell">'
    + topbarHTML()
    + drawerHTML()
    + '<main class="main">'
    + navtabsHTML()
    + pageHTML()
    + '</main>'
    + '</div>'
    + (S.modal ? G.modalHTML() : '')
    + (S.toastMsg ? '<div class="toast show" id="toast">'+esc(S.toastMsg)+'</div>' : '');

  const key = [S.side,S.sec,S.tab,S.role,S.lang].join('|');
  const page = document.getElementById('page');
  if(page && !global.matchMedia('(prefers-reduced-motion: reduce)').matches){
    if(key !== lastRevealKey){
      Array.from(page.children).forEach((child,i) => {
        child.classList.add('reveal');
        child.style.animationDelay = (i*55)+'ms';
      });
    }
  }
  lastRevealKey = key;

  if(S.lang !== 'ru' && G.applyI18n) G.applyI18n();
}

global.GC.MENU = MENU;
global.GC.SECTION_TABS = SECTION_TABS;
global.GC.SECTION_LABEL = SECTION_LABEL;
global.GC.notificationCount = notificationCount;
global.GC.render = render;

})(typeof window !== 'undefined' ? window : globalThis);
