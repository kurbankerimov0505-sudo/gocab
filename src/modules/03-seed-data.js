/* ===== 03. REFERENCE DATA & FLEET SEED ===== */
(function(global){
'use strict';
const U = global.GC.Utils, C = global.GC.CONST, E = global.GC.ENUM;
const { rng, pick, pickN, randInt, clamp, uid, shift, iso } = U;

const SEED = 20260908; // fixed so demo data is reproducible
const R = rng(SEED);

function buildRefData(){
  const DB = {};

  // --- Organisations ---
  DB.orgs = [
    { id:'org-1', name:'GoCab Fleet SARL', carsPlanned:7 },
    { id:'org-2', name:'Atlas Prokat SARL', carsPlanned:3 }
  ];

  // --- Branches (divisions) ---
  DB.divs = [
    { id:'div-1', name:'Касабланка №1', org:'org-1', city:'Касабланка', manager:'Мouad Koudia' },
    { id:'div-2', name:'Касабланка №2', org:'org-1', city:'Касабланка', manager:'Мouad Koudia' },
    { id:'div-3', name:'Рабат №1', org:'org-2', city:'Рабат', manager:'Nehemie Koffi' }
  ];

  // --- Dispatch units ---
  DB.disp = [
    { id:'disp-1', name:'Диспетчерская Касабланка', div:'div-1' },
    { id:'disp-2', name:'Диспетчерская Рабат', div:'div-3' }
  ];

  // --- Terminals ---
  DB.terminals = [
    { id:'term-1', name:'Терминал №1 — Касабланка', div:'div-1', status:'Активен' },
    { id:'term-2', name:'Терминал №1 — Рабат', div:'div-3', status:'Активен' }
  ];

  // --- Banks ---
  DB.banks = [
    { id:'bank-1', name:'Attijariwafa Bank', bic:'BCMAMAMC' },
    { id:'bank-2', name:'Banque Populaire', bic:'BCPOMAMC' }
  ];

  // --- Compensation reasons ---
  DB.reasons = [
    { id:'rs-1', name:'Простой по вине компании', limit:2000 },
    { id:'rs-2', name:'Компенсация топлива', limit:500 },
    { id:'rs-3', name:'Ошибка списания', limit:1000 },
    { id:'rs-4', name:'Поломка не по вине водителя', limit:1500 },
    { id:'rs-5', name:'Компенсация ДТП', limit:5000 },
    { id:'rs-6', name:'Задержка выдачи авто', limit:800 },
    { id:'rs-7', name:'Некорректный штраф', limit:1200 },
    { id:'rs-8', name:'Прочее', limit:300 }
  ];

  // --- Insurers ---
  DB.insurers = [
    { id:'ins-1', name:'Wafa Assurance' },
    { id:'ins-2', name:'RMA Assurance' },
    { id:'ins-3', name:'Saham Assurance' }
  ];

  // --- Tags ---
  DB.tags = [
    { id:'tag-1', name:'VIP', color:'#57611e' },
    { id:'tag-2', name:'Новый', color:'#4caf7d' },
    { id:'tag-3', name:'Риск', color:'#e0554f' },
    { id:'tag-4', name:'Отпуск', color:'#7c93c9' },
    { id:'tag-5', name:'ГБО', color:'#9a7bd1' },
    { id:'tag-6', name:'Долгосрочный', color:'#4a90d9' }
  ];

  // --- Damage price list (tariffs) ---
  const ZONES = ['Передний бампер','Задний бампер','Капот','Крыша','Левая дверь','Правая дверь','Лобовое стекло','Заднее стекло','Диск колеса','Зеркало'];
  const DTYPES = ['Царапина','Вмятина','Скол','Трещина','Разбито'];
  DB.tariffs = ZONES.map((z,i)=>({
    id:'tf-'+(i+1), zone:z, type: DTYPES[i%DTYPES.length],
    price: [400,900,1600,2200,4500][i%5]
  }));

  return DB;
}

function buildUsers(DB){
  DB.users = [
    { id:'u-1', name:'Курбан Керимов', role:'Руководитель страны', appRole:'Кантри-менеджер', div:null,
      rights:['Все разделы'] },
    { id:'u-2', name:'Мouad Koudia', role:'Менеджер парка', appRole:'Менеджер парка', div:'div-1',
      rights:['Водители','Автопарк','Касса','Штрафы','Рассрочка','Ремонты','Приём-выдача','Путевые листы','Компенсации: одобрение'] },
    { id:'u-3', name:'Nehemie Koffi', role:'Менеджер парка', appRole:'Менеджер парка', div:'div-3',
      rights:['Водители','Автопарк','Касса','Штрафы','Рассрочка','Ремонты','Приём-выдача','Путевые листы','Компенсации: одобрение'] },
    { id:'u-4', name:'Youssef Amrani', role:'Приёмщик на ремонт', appRole:'Приёмщик на ремонт', div:'div-1',
      rights:['Приём-выдача','Ремонты'] },
    { id:'u-5', name:'Karim Idrissi', role:'Механик', appRole:'Механик', div:'div-1',
      rights:['Ремонты'] },
    { id:'u-6', name:'Samira Ouazzani', role:'Старший диспетчер', appRole:'Диспетчер', div:'div-1',
      rights:['Водители','Автопарк','Путевые листы'] }
  ];
  return DB.users;
}

function buildFleet(DB, R){
  R = R || global.GC._seedRng;
  const plans = [
    ['Bestune B70','div-1','org-1'], ['Bestune B70','div-1','org-1'],
    ['Bestune T55','div-1','org-1'], ['Bestune T77','div-2','org-1'],
    ['MG5','div-2','org-1'], ['Dacia Logan','div-2','org-1'],
    ['Dacia Logan','div-1','org-1'], ['Dacia Sandero','div-3','org-2'],
    ['Renault Logan','div-3','org-2'], ['Hyundai Accent','div-3','org-2']
  ];
  const statuses = ['В работе','В работе','В работе','В работе','В работе','В работе','В работе','В работе','На сервисе','Свободен'];
  DB.cars = plans.map((p,i)=>{
    const [model, div, org] = p;
    const plateNum = randInt(R, 10000, 99999);
    const plateLetter = String.fromCharCode(1040 + Math.floor(R()*30)); // cyrillic-ish placeholder, use latin instead below
    const letters = 'ABCDEFGHJKLMNPRSTUVXYZ';
    const plate = `${plateNum}-${letters[Math.floor(R()*letters.length)]}-${randInt(R,1,9)}`;
    const insUntil = i===0 ? shift(-15) : shift(randInt(R,20,300)); // car 0: expired insurance
    const techUntil = i===1 ? shift(12) : shift(randInt(R,20,300)); // car 1: inspection expiring in 12 days
    return {
      id:'car-'+(i+1), plate, model, year: randInt(R,2019,2024), org, div,
      akpp: pick(R, E.AKPP), gbo: R() < 0.3,
      status: statuses[i],
      insurer: pick(R, DB.insurers).id,
      insUntil: iso(insUntil), techUntil: iso(techUntil),
      leaseUntil: iso(shift(randInt(R,60,700))),
      mileage: randInt(R, 15000, 140000),
      tags: R()<0.25 ? [pick(R, DB.tags).id] : []
    };
  });
  return DB.cars;
}

function buildDrivers(DB, R){
  R = R || global.GC._seedRng;
  const FIRST = ['Rachid','Hassan','Mehdi','Youssef','Omar','Said','Karim','Anas','Yassine','Amine','Hamza','Tariq'];
  const LAST = ['El Amrani','Bouzid','Chakir','Idrissi','Alaoui','Benali','Tazi','Fassi','Karimi','Bennis','Skalli','Berrada'];
  const drivers = [];
  for(let i=0;i<12;i++){
    const fio = `${LAST[i]} ${FIRST[i]}`;
    const hasCar = i < 10;
    const onLeave = i === 10;
    const fired = i === 11;
    const div = DB.divs[i % DB.divs.length];
    const disc = clamp(0.78 + R()*0.24, 0.78, 1.02);
    const d = {
      id:'drv-'+(i+1), fio,
      phone: `+212 6${randInt(R,10,79)} ${randInt(R,100,999)} ${randInt(R,100,999)}`,
      yid: 'Y'+randInt(R,100000,999999),
      status: fired ? 'Уволен' : (onLeave ? 'В отпуске' : 'Работает'),
      ystatus: fired ? 'Нет аккаунта' : 'Работает',
      form: pick(R, E.FORMS),
      hired: iso(shift(-randInt(R,90,900))),
      fired: fired ? iso(shift(-randInt(R,1,30))) : null,
      rate: randInt(R,300,350) - (randInt(R,300,350)%10 ? 0:0),
      balY: randInt(R,-200,800),
      bal: 0,
      finesBal: 0, dmgBal: 0,
      org: div.org, div: div.id, disp: DB.disp.find(x=>x.div===div.id || true).id,
      car: hasCar ? DB.cars[i].id : null,
      reportDay: randInt(R,1,28),
      licUntil: iso(shift(randInt(R,-10,400))),
      instalment: null, limit: randInt(R,1000,3000),
      platformOrders: randInt(R,200,900), partnerOrders: randInt(R,0,150),
      blockBelowLimit: R()<0.4,
      tags: R()<0.3 ? [pick(R, DB.tags).id] : [],
      notes: [],
      active: !fired,
      _disc: Math.round(disc*100)/100
    };
    // rate rounded to nearest 10
    d.rate = Math.round(d.rate/10)*10;
    drivers.push(d);
  }
  DB.drivers = drivers;
  return drivers;
}

global.GC = global.GC || {};
global.GC.buildRefData = buildRefData;
global.GC.buildUsers = buildUsers;
global.GC.buildFleet = buildFleet;
global.GC.buildDrivers = buildDrivers;
global.GC._seedRng = R;

})(typeof window !== 'undefined' ? window : globalThis);
