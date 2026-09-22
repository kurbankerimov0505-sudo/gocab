/* ===== 18. "ADD" FORMS — every action button opens a working form, not a
   placeholder. Modal forms read S.modal.form (kept in sync by the generic
   [data-mf] change/input listeners in module 19); the one page-level form
   (Handover → "Новый акт") isn't inside a modal, so its action reads the
   DOM directly at click time instead. ===== */
(function(global){
'use strict';
const G = global.GC, U = G.Utils, E = G.ENUM;
const { esc, uid, iso, NOW } = U;
const S = G.S;

function driverOptions(){ return S.DB.drivers.filter(d=>d.car).map(d=>({value:d.id,label:d.fio})); }
function carOptions(){ return S.DB.cars.map(c=>({value:c.id,label:c.plate+' · '+c.model})); }
function divOptions(){ return S.DB.divs.map(d=>({value:d.id,label:d.name})); }

function simpleForm(title, fields, onSave){
  const form = {};
  fields.forEach(f => { if(f.def!==undefined) form[f.key]=f.def; });
  G.openModal({
    title, form,
    body: fields.map(f => G.mField(f.label, f.key, f.type, { options:f.options }, f.ph)).join(''),
    saveLabel:'Создать',
    onSave: (data) => { onSave(Object.assign(form, data)); G.closeModal(); }
  });
}

Object.assign(G.ACTIONS, {
  'add-driver': () => simpleForm('Новый водитель', [
    { key:'fio', label:'ФИО', type:'text' },
    { key:'phone', label:'Телефон', type:'text' },
    { key:'div', label:'Филиал', type:'select', options: divOptions() },
    { key:'rate', label:'Ставка аренды, MAD/день', type:'num', def:320 }
  ], (f) => {
    const div = S.DB.divs.find(d=>d.id===f.div) || S.DB.divs[0];
    const d = {
      id: uid('drv'), fio: f.fio||'Новый водитель', phone: f.phone||'', yid:'Y'+U.randInt(Math.random,100000,999999),
      status:'Работает', ystatus:'Работает', form:'Штатный', hired: iso(NOW), fired:null,
      rate: Number(f.rate)||320, balY:0, bal:0, finesBal:0, dmgBal:0,
      org: div.org, div: div.id, disp: S.DB.disp[0].id, car:null, reportDay:1,
      licUntil: iso(U.shift(365)), instalment:null, limit:1500, platformOrders:0, partnerOrders:0,
      blockBelowLimit:false, tags:[], notes:[], active:true, _disc:0.9
    };
    S.DB.drivers.push(d);
    G.toast('Водитель '+d.fio+' добавлен');
  }),

  'add-car': () => simpleForm('Новый автомобиль', [
    { key:'plate', label:'Госномер', type:'text', ph:'12345-A-6' },
    { key:'model', label:'Модель', type:'select', options: E.MODELS },
    { key:'year', label:'Год', type:'num', def:2024 },
    { key:'div', label:'Филиал', type:'select', options: divOptions() },
    { key:'status', label:'Статус', type:'select', options: E.CAR_STATUS }
  ], (f) => {
    const div = S.DB.divs.find(d=>d.id===f.div) || S.DB.divs[0];
    const c = { id: uid('car'), plate: f.plate||'00000-A-0', model: f.model||E.MODELS[0], year: Number(f.year)||2024,
      org: div.org, div: div.id, akpp:'АКПП', gbo:false, status: f.status||'Свободен',
      insurer: S.DB.insurers[0].id, insUntil: iso(U.shift(300)), techUntil: iso(U.shift(300)),
      leaseUntil: iso(U.shift(300)), mileage:0, tags:[] };
    S.DB.cars.push(c);
    G.toast('Автомобиль '+c.plate+' добавлен');
  }),

  'add-user': () => simpleForm('Новый пользователь', [
    { key:'name', label:'Имя', type:'text' },
    { key:'role', label:'Должность', type:'text' },
    { key:'appRole', label:'Роль доступа', type:'select', options: E.ROLES },
    { key:'div', label:'Филиал', type:'select', options: divOptions() }
  ], (f) => {
    const u = { id: uid('u'), name: f.name||'Новый пользователь', role: f.role||f.appRole, appRole: f.appRole||E.ROLES[1],
      div: f.div||null, rights:['Водители'] };
    S.DB.users.push(u);
    G.toast('Пользователь '+u.name+' создан');
  }),

  'add-repair': () => {
    const slotOpts = G.daySlots().map(s=>({value:s,label:s}));
    simpleForm('Записать на ремонт', [
      { key:'carId', label:'Автомобиль', type:'select', options: carOptions() },
      { key:'reason', label:'Причина', type:'select', options: Object.keys(G.SHOPS) },
      { key:'prio', label:'Приоритет', type:'select', options: E.PRIO },
      { key:'slotDay', label:'Дата', type:'date', def: iso(U.TODAY) },
      { key:'slot', label:'Слот', type:'select', options: slotOpts },
      { key:'desc', label:'Описание', type:'textarea' }
    ], (f) => {
      const car = S.DB.cars.find(c=>c.id===f.carId) || S.DB.cars[0];
      const drv = S.DB.drivers.find(d=>d.car===car.id);
      const cap = G.SHOPS[f.reason].perSlot;
      const booked = S.DB.orders2.filter(o=>o.slotDay===f.slotDay && o.slot===f.slot && o.reason===f.reason).length;
      if(booked >= cap){ G.toast('Нет мест на этот слот ('+f.reason+', '+f.slot+') — выберите другое время'); return; }
      const o = {
        no: 'НЗ-'+(1040+S.DB.orders2.length+1), car: car.plate, model: car.model, carId: car.id,
        driver: drv?drv.fio:'—', driverId: drv?drv.id:null, div: car.div, org: car.org,
        reason: f.reason, prio: f.prio||'Обычный', slotDay: f.slotDay, slot: f.slot,
        mileage: car.mileage, odoPhoto:null, desc: f.desc||('Обращение: '+f.reason),
        phase:0, mech:null, post:null, receiver:null, fuel:null, fuelPhoto:null, arrivedAt:null,
        works: (G_REASON_JOBS()[f.reason]||[['Диагностика',1]]).map(([name,h])=>({name,h,done:false})),
        parts:[], photoAfter:null, checkedBy:null, timer:{run:false,min:0,startedAt:null},
        createdAt: iso(NOW), closedAt:null, returns:0, notified:false, demoOpen:false, demoBlocked:false
      };
      S.DB.orders2.push(o);
      G.toast('Наряд-заказ '+o.no+' создан на '+f.slotDay+' '+f.slot);
    });
  },

  'add-incident': () => simpleForm('Новый случай', [
    { key:'carId', label:'Автомобиль', type:'select', options: carOptions() },
    { key:'type', label:'Тип', type:'select', options:['ДТП','Угон попытка','Повреждение на стоянке','Страховой случай'] },
    { key:'guilty', label:'Виновник', type:'select', options:['Водитель','Третье лицо','Не установлен'] },
    { key:'sum', label:'Сумма ущерба', type:'num' },
    { key:'insurer', label:'Страховая', type:'select', options: S.DB ? S.DB.insurers.map(i=>i.name) : [] }
  ], (f) => {
    const car = S.DB.cars.find(c=>c.id===f.carId) || S.DB.cars[0];
    const drv = S.DB.drivers.find(d=>d.car===car.id);
    S.DB.incidents.push({ id: uid('inc'), at: iso(NOW), car: car.plate, carId: car.id,
      driver: drv?drv.fio:'—', driverId: drv?drv.id:null, div: car.div,
      type: f.type, guilty: f.guilty, sum: Number(f.sum)||0, insurer: f.insurer,
      claim:'CLM-'+U.randInt(Math.random,10000,99999), cover:'На рассмотрении', status:'Открыт' });
    G.toast('Случай зарегистрирован');
  }),

  'add-mailing': () => simpleForm('Новая рассылка', [
    { key:'name', label:'Название', type:'text' },
    { key:'channel', label:'Канал', type:'select', options:['SMS','Push','Email'] },
    { key:'sent', label:'Получателей', type:'num', def:100 }
  ], (f) => {
    S.DB.mailings.push({ id: uid('ml'), name:f.name||'Новая рассылка', channel:f.channel||'SMS',
      sent:Number(f.sent)||0, opened:0, at: iso(NOW) });
    G.toast('Рассылка создана');
  }),

  'add-part': () => simpleForm('Приход на склад', [
    { key:'art', label:'Артикул', type:'select', options: S.DB ? S.DB.parts.map(p=>({value:p.art,label:p.art+' — '+p.name})) : [] },
    { key:'qty', label:'Количество', type:'num', def:10 }
  ], (f) => {
    const p = S.DB.parts.find(x=>x.art===f.art);
    if(p) p.stock += Number(f.qty)||0;
    G.toast('Приход оформлен: '+(p?p.name:f.art)+' +'+(Number(f.qty)||0));
  }),

  'add-pnl': () => simpleForm('Новая операция P&L', [
    { key:'type', label:'Тип', type:'select', options:['Доход','Расход'] },
    { key:'cat', label:'Категория', type:'text' },
    { key:'amount', label:'Сумма', type:'num' },
    { key:'div', label:'Филиал', type:'select', options: divOptions() }
  ], (f) => {
    const div = S.DB.divs.find(d=>d.id===f.div) || S.DB.divs[0];
    S.DB.pnl.push({ id: uid('pnl'), at: iso(NOW), type:f.type||'Расход', cat:f.cat||'Прочее',
      amount: Number(f.amount)||0, org: div.org, div: div.id, car:'—', note:f.cat });
    G.toast('Операция добавлена');
  }),

  'add-cash-op': () => simpleForm('Новая кассовая операция', [
    { key:'driverId', label:'Водитель', type:'select', options: driverOptions() },
    { key:'type', label:'Тип', type:'select', options: E.OPTYPES },
    { key:'src', label:'Источник', type:'select', options: E.SOURCES },
    { key:'iface', label:'Интерфейс', type:'select', options: E.IFACES },
    { key:'amt', label:'Сумма', type:'num' }
  ], (f) => {
    const d = S.DB.drivers.find(x=>x.id===f.driverId);
    if(!d || !f.amt){ G.toast('Укажите водителя и сумму'); return; }
    S.DB.cash.push(G.mkCash(d, NOW, f.type||'Пополнение', Number(f.amt), f.iface||'Менеджер', f.src||'Баланс', G.currentUser().name));
    G.recalcBalances(S.DB);
    G.toast('Операция проведена');
  }),

  'add-comp': () => simpleForm('Запрос на компенсацию', [
    { key:'driverId', label:'Водитель', type:'select', options: driverOptions() },
    { key:'reasonId', label:'Причина', type:'select', options: S.DB ? S.DB.reasons.map(r=>({value:r.id,label:r.name})) : [] },
    { key:'sum', label:'Сумма', type:'num' },
    { key:'note', label:'Комментарий', type:'textarea' }
  ], (f) => {
    const d = S.DB.drivers.find(x=>x.id===f.driverId);
    const reason = S.DB.reasons.find(r=>r.id===f.reasonId) || S.DB.reasons[0];
    if(!d){ G.toast('Укажите водителя'); return; }
    const car = S.DB.cars.find(c=>c.id===d.car);
    const sum = Math.min(Number(f.sum)||0, reason.limit);
    S.DB.comps.push({ id: uid('comp'), at: iso(NOW), driver:d.fio, driverId:d.id, car: car?car.plate:'—',
      div:d.div, kind:reason.name, reason:reason.name, sum, by:G.currentUser().name,
      status: sum>reason.limit ? 'На одобрении' : 'На одобрении',
      note: f.note || ('Запрос на компенсацию: '+reason.name), decidedBy:null, decidedAt:null, comment:'' });
    G.toast('Запрос отправлен на одобрение');
  }),

  'add-ref': (t) => {
    const ref = t.dataset.ref;
    const specs = {
      orgs: { title:'Организация', fields:[{key:'name',label:'Название',type:'text'}], make:(f)=>({id:uid('org'),name:f.name}) },
      divs: { title:'Подразделение', fields:[{key:'name',label:'Название',type:'text'},{key:'city',label:'Город',type:'text'},{key:'manager',label:'Менеджер',type:'text'}],
        make:(f)=>({id:uid('div'),name:f.name,city:f.city,manager:f.manager,org:S.DB.orgs[0].id}) },
      disp: { title:'Диспетчерская', fields:[{key:'name',label:'Название',type:'text'}], make:(f)=>({id:uid('disp'),name:f.name,div:S.DB.divs[0].id}) },
      terminals: { title:'Терминал', fields:[{key:'name',label:'Название',type:'text'}], make:(f)=>({id:uid('term'),name:f.name,div:S.DB.divs[0].id,status:'Активен'}) },
      banks: { title:'Банк', fields:[{key:'name',label:'Название',type:'text'},{key:'bic',label:'BIC',type:'text'}], make:(f)=>({id:uid('bank'),name:f.name,bic:f.bic}) },
      reasons: { title:'Причина компенсации', fields:[{key:'name',label:'Название',type:'text'},{key:'limit',label:'Лимит',type:'num',def:500}], make:(f)=>({id:uid('rs'),name:f.name,limit:Number(f.limit)||500}) },
      insurers: { title:'Страховая компания', fields:[{key:'name',label:'Название',type:'text'}], make:(f)=>({id:uid('ins'),name:f.name}) },
      tags: { title:'Тег', fields:[{key:'name',label:'Название',type:'text'},{key:'color',label:'Цвет (HEX)',type:'text',def:'#4a90d9'}], make:(f)=>({id:uid('tag'),name:f.name,color:f.color||'#4a90d9'}) }
    };
    const spec = specs[ref]; if(!spec) return;
    simpleForm(spec.title, spec.fields, (f) => { S.DB[ref].push(spec.make(f)); G.toast(spec.title+' добавлен(а)'); });
  },

  'create-act': () => {
    const read = (key) => { const el = document.querySelector('[data-mf="'+key+'"]'); if(!el) return null; return el.type==='checkbox' ? el.checked : el.value; };
    const kind = read('kind') || 'Выдача';
    const driverId = read('driverId');
    const d = S.DB.drivers.find(x=>x.id===driverId) || S.DB.drivers.find(x=>x.car);
    const car = S.DB.cars.find(c=>c.id===d.car);
    S.DB.acts.push({ id: uid('act'), kind, car: car.plate, model: car.model, driver: d.fio, driverId: d.id, div: d.div,
      at: iso(NOW), by: G.currentUser().name, photos: 3, dmg: [], equip:['Аптечка','Огнетушитель','Знак аварийной остановки'],
      fuel: Number(read('fuel'))||100, mileage: Number(read('mileage'))||car.mileage, signed: !!read('signed') });
    G.toast('Акт '+kind.toLowerCase()+' создан для '+d.fio);
    S.tab = 0;
  }
});

function G_REASON_JOBS(){
  return {
    'Плановое ТО': [['Замена масла',0.5],['Замена фильтров',0.5],['Диагностика',1]],
    'Слесарные работы': [['Замена колодок',1],['Регулировка развал-схождения',1]],
    'Не заводится': [['Диагностика электрики',1],['Замена аккумулятора',0.5]],
    'Прочее': [['Общий осмотр',1]],
    'Шиномонтаж': [['Замена шин',0.5],['Балансировка',0.5]],
    'Электрика': [['Диагностика проводки',1.5],['Замена лампы',0.3]],
    'Кондиционер': [['Заправка фреона',1],['Диагностика компрессора',1]],
    'Кузов': [['Рихтовка',3],['Покраска',2]]
  };
}

})(typeof window !== 'undefined' ? window : globalThis);
