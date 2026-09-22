/* ===== 06. SECONDARY COLLECTIONS (fines, instalments, comps, parts,
   deposits, payouts, contracts, incidents, leases, tickets, mailings,
   pnl, history, dupes) ===== */
(function(global){
'use strict';
const U = global.GC.Utils, C = global.GC.CONST, E = global.GC.ENUM;
const { rng, pick, pickN, randInt, clamp, uid, shift, iso, fmtD } = U;

function workingDrivers(DB){ return DB.drivers.filter(d=>d.car); }

function buildFines(DB, R){
  const wd = workingDrivers(DB);
  const chosen = pickN(R, wd, 9);
  DB.fines = chosen.map((d,i) => {
    const car = DB.cars.find(c=>c.id===d.car);
    const violAt = shift(-randInt(R,1,120));
    const status = i<5 ? 'Оплачен' : (i<8 ? 'Не оплачен' : 'Оспаривается');
    return {
      id: 'fine-'+(i+1), doc: 'ШТ-'+randInt(R,100000,999999),
      viol: pick(R, E.VIOL), violAt: iso(violAt), docAt: iso(shift(-randInt(R,1,110))),
      sum: randInt(R,3,20)*100, discountTill: iso(shift(-randInt(R,-10,90))),
      car: car.plate, org: d.org, div: d.div,
      driver: d.fio, driverId: d.id, status,
      bank: pick(R, DB.banks).name
    };
  });
}

function buildInstalments(DB, R){
  const wd = pickN(R, workingDrivers(DB), 3);
  DB.instal = wd.map((d,i) => {
    const total = randInt(R,5,20)*300;
    const left = Math.round(total*R()*0.7);
    const car = DB.cars.find(c=>c.id===d.car);
    return {
      id:'ins-plan-'+(i+1), driver: d.fio, driverId: d.id, car: car.plate, div: d.div,
      kind: pick(R,['Повреждение','Недостача топлива','Штраф']),
      total, left, perDay: Math.round(total/randInt(R,10,30)),
      opened: iso(shift(-randInt(R,10,90))), status: left>0 ? 'Активна':'Закрыта',
      note: 'Рассрочка по возмещению'
    };
  });
}

function buildCompensations(DB, R){
  const wd = pickN(R, workingDrivers(DB), 5);
  DB.comps = wd.map((d,i) => {
    const car = DB.cars.find(c=>c.id===d.car);
    const reason = pick(R, DB.reasons);
    const status = i<3 ? 'Одобрено' : (i<4?'На одобрении':'Отказано');
    return {
      id:'comp-'+(i+1), at: iso(shift(-randInt(R,1,60))), driver: d.fio, driverId: d.id,
      car: car.plate, div: d.div, kind: reason.name, reason: reason.name,
      sum: Math.min(reason.limit, randInt(R,100,reason.limit)),
      by: 'Мouad Koudia', status,
      note: 'Запрос на компенсацию: '+reason.name,
      decidedBy: status!=='На одобрении' ? 'Курбан Керимов' : null,
      decidedAt: status!=='На одобрении' ? iso(shift(-randInt(R,0,50))) : null,
      comment: status==='Отказано' ? 'Недостаточно подтверждающих документов' :
               (status==='Одобрено' ? 'Подтверждено, начислено на баланс' : '')
    };
  });
}

function buildOrders(DB, R){ // waybill / vehicle requests
  const wd = pickN(R, workingDrivers(DB), 8);
  DB.orders = wd.map((d,i) => {
    const car = DB.cars.find(c=>c.id===d.car);
    return {
      id:'req-'+(i+1), no: 'ЗВ-'+(2000+i), driver: d.fio, driverId: d.id,
      car: car.plate, div: d.div, org: d.org,
      type: pick(R,['Путевой лист','Заявка на авто']),
      status: pick(R,['Оформлен','В обработке','Отклонён']),
      createdAt: iso(shift(-randInt(R,0,20)))
    };
  });
}

function buildParts(DB, R){
  const NAMES = [
    ['ART-1001','Тормозные колодки передние',120,20,'Bestune Parts'],
    ['ART-1002','Масляный фильтр',60,15,'Bestune Parts'],
    ['ART-1003','Воздушный фильтр',55,10,'Bestune Parts'],
    ['ART-1004','Свеча зажигания',18,40,'Auto Maroc'],
    ['ART-1005','Аккумулятор 60Ah',12,3,'Auto Maroc'],
    ['ART-1006','Амортизатор передний',22,6,'Dacia Original'],
    ['ART-1007','Тормозной диск',30,8,'Dacia Original'],
    ['ART-1008','Ремень ГРМ',10,4,'Dacia Original'],
    ['ART-1009','Лампа фары H4',80,25,'Auto Maroc'],
    ['ART-1010','Щётки стеклоочистителя',65,18,'Auto Maroc'],
    ['ART-1011','Масло моторное 5W30 (л)',200,60,'Total Maroc'],
    ['ART-1012','Шина 185/65 R15',16,4,'Tire Center']
  ];
  DB.parts = NAMES.map(([art,name,stock,min,sup],i)=>({
    art, name, stock, min, price: randInt(R,50,900), sup
  }));
}

function buildService(DB, R){
  const wd = pickN(R, workingDrivers(DB), 5);
  DB.service = wd.map((d,i) => {
    const car = DB.cars.find(c=>c.id===d.car);
    return { id:'svc-'+(i+1), at: iso(shift(-randInt(R,1,200))), car: car.plate,
      driver: d.fio, div: d.div, kind: pick(R,['ТО','Шиномонтаж','Диагностика']),
      note: 'Legacy запись до перехода на наряд-заказы' };
  });
}

function buildDeposits(DB, R){
  DB.deposits = workingDrivers(DB).map(d => {
    const car = DB.cars.find(c=>c.id===d.car);
    const target = C.DEP_TARGET;
    const amount = clamp(target + randInt(R,-400,400), 0, target+600);
    return { driverId:d.id, driver:d.fio, div:d.div, car: car.plate,
      target, amount, perDay: randInt(R,20,60), last: iso(shift(-randInt(R,0,20))) };
  });
}

function buildPayouts(DB, R){
  const wd = workingDrivers(DB);
  DB.payouts = [];
  for(let i=0;i<34;i++){
    const d = pick(R, wd);
    const trips = randInt(R,3,40);
    const cost = randInt(R,30,1200);
    const dur = randInt(R,2,200);
    const perHour = randInt(R,1,8);
    const flags = [];
    if(cost > C.AF.maxCost) flags.push('Стоимость поездки выше нормы');
    if(dur > C.AF.maxDur) flags.push('Поездка длиннее нормы');
    if(dur < C.AF.minDur) flags.push('Поездка короче нормы');
    if(perHour > C.AF.maxPerHour) flags.push('Слишком много поездок в час');
    const status = flags.length ? (R()<0.5?'На проверке':'Отклонена') : 'Выплачена';
    DB.payouts.push({
      id:'pay-'+(i+1), at: iso(shift(-randInt(R,0,30))), driverId:d.id, driver:d.fio, div:d.div,
      amount: randInt(R,100,2500), method: pick(R,['Карта','Наличные']),
      trips, cost, dur, perHour, flags, status
    });
  }
}

function buildContracts(DB, R){
  const drivers = pickN(R, DB.drivers, Math.min(30, DB.drivers.length));
  const pool = []; while(pool.length<30) pool.push(pick(R, DB.drivers));
  DB.contracts = pool.map((d,i) => ({
    id:'ctr-'+(i+1), driverId:d.id, driver:d.fio, div:d.div,
    type: pick(R,['Договор аренды','Доп. соглашение','Согласие на обработку данных']),
    car: d.car ? DB.cars.find(c=>c.id===d.car).plate : '—',
    at: iso(shift(-randInt(R,1,300))), until: iso(shift(randInt(R,30,400))),
    status: pick(R, E.CONTRACT_STATUS), sign: R()<0.7?'ЭЦП':'Бумажный'
  }));
}

function buildIncidents(DB, R){
  const wd = pickN(R, workingDrivers(DB), 11); const pool=[]; while(pool.length<11) pool.push(pick(R,workingDrivers(DB)));
  DB.incidents = pool.map((d,i) => {
    const car = DB.cars.find(c=>c.id===d.car);
    return {
      id:'inc-'+(i+1), at: iso(shift(-randInt(R,1,250))), car: car.plate, carId: car.id,
      driver: d.fio, driverId: d.id, div: d.div,
      type: pick(R,['ДТП','Угон попытка','Повреждение на стоянке','Страховой случай']),
      guilty: pick(R,['Водитель','Третье лицо','Не установлен']),
      sum: randInt(R,1000,25000), insurer: pick(R, DB.insurers).name,
      claim: 'CLM-'+randInt(R,10000,99999), cover: R()<0.6?'Покрыто':'Не покрыто',
      status: pick(R,['Открыт','На рассмотрении','Закрыт'])
    };
  });
}

function buildLeases(DB, R){
  DB.leases = DB.cars.slice(0,10).map((car,i) => {
    const months = randInt(R,24,60);
    const paid = randInt(R,1,months-1);
    const monthly = randInt(R,2500,4500);
    return {
      carId: car.id, car: car.plate, model: car.model, org: car.org, div: car.div,
      lessor: pick(R,['Wafabail','BMCI Leasing','Maghrebail']),
      monthly, months, paid, left: months-paid,
      total: monthly*months, rest: monthly*(months-paid),
      next: iso(shift(randInt(R,1,28))), buyout: Math.round(monthly*3.2),
      status: paid>=months ? 'Выкуплен' : 'Активен'
    };
  });
}

function buildTickets(DB, R){
  const wd = workingDrivers(DB); const pool=[]; while(pool.length<22) pool.push(pick(R,wd));
  const THEMES = ['Вопрос по балансу','Проблема с автомобилем','Штраф','Компенсация','Депозит','График смен','Прочее'];
  DB.tickets = pool.map((d,i) => ({
    id:'tk-'+(i+1), at: iso(shift(-randInt(R,0,40))), driverId:d.id, driver:d.fio, div:d.div,
    theme: pick(R, THEMES), text: 'Обращение по теме: '+pick(R,THEMES),
    mgr: 'Мouad Koudia', status: pick(R,['Новое','В работе','Решено']),
    sla: randInt(R,1,48)+' ч'
  }));
}

function buildMailings(DB, R){
  DB.mailings = [
    { id:'ml-1', name:'Напоминание об оплате аренды', channel:'SMS', sent: 340, opened: 210, at: iso(shift(-5)) },
    { id:'ml-2', name:'Акция по депозитам', channel:'Push', sent: 120, opened: 60, at: iso(shift(-12)) },
    { id:'ml-3', name:'Обновление правил компенсаций', channel:'Email', sent: 12, opened: 9, at: iso(shift(-20)) },
    { id:'ml-4', name:'Плановое ТО — запись', channel:'SMS', sent: 80, opened: 55, at: iso(shift(-2)) }
  ];
}

function buildPnl(DB, R){
  const CATS_IN = ['Аренда','Компенсация от страховой','Продажа авто'];
  const CATS_OUT = ['Ремонт','Запчасти','ФОТ менеджеров','Лизинг','Страхование','Штрафы (компания)'];
  DB.pnl = [];
  for(let i=0;i<42;i++){
    const type = R()<0.55 ? 'Доход':'Расход';
    const cat = type==='Доход' ? pick(R,CATS_IN) : pick(R,CATS_OUT);
    const car = pick(R, DB.cars);
    DB.pnl.push({
      id:'pnl-'+(i+1), at: iso(shift(-randInt(R,0,180))), type, cat,
      amount: randInt(R,500,15000), org: car.org, div: car.div, car: car.plate,
      note: cat
    });
  }
}

function buildHistory(DB, R){
  DB.history = [];
  const who = ['Курбан Керимов','Мouad Koudia','Nehemie Koffi'];
  for(let i=0;i<10;i++){
    DB.history.push({
      id:'hist-'+(i+1), at: iso(shift(-randInt(R,0,60))), who: pick(R,who),
      section: pick(R,['Водители','Автопарк','Касса','Штрафы']),
      field: 'status', obj: pick(R,DB.drivers).fio,
      from: 'Работает', to: pick(R,['В отпуске','Заблокирован'])
    });
  }
}

function buildImportsAndComments(DB){
  DB.imports = [];
  DB.comments = [];
}

function buildDupes(DB, R){
  const a = DB.drivers[0], b = { ...DB.drivers[1], fio: DB.drivers[0].fio };
  DB.dupes = [{ id:'dupe-1', a: a.id, b: DB.drivers[1].id, reason:'Совпадение ФИО', fioA:a.fio, fioB:DB.drivers[1].fio }];
}

global.GC.buildFines = buildFines;
global.GC.buildInstalments = buildInstalments;
global.GC.buildCompensations = buildCompensations;
global.GC.buildOrders = buildOrders;
global.GC.buildParts = buildParts;
global.GC.buildService = buildService;
global.GC.buildDeposits = buildDeposits;
global.GC.buildPayouts = buildPayouts;
global.GC.buildContracts = buildContracts;
global.GC.buildIncidents = buildIncidents;
global.GC.buildLeases = buildLeases;
global.GC.buildTickets = buildTickets;
global.GC.buildMailings = buildMailings;
global.GC.buildPnl = buildPnl;
global.GC.buildHistory = buildHistory;
global.GC.buildImportsAndComments = buildImportsAndComments;
global.GC.buildDupes = buildDupes;
global.GC.workingDrivers = workingDrivers;

})(typeof window !== 'undefined' ? window : globalThis);
