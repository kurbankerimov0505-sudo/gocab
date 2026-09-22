/* ===== 07. REPAIR WORKFLOW (7 phases), BOOKING CAPACITY, HANDOVER,
   SHIFTS, INSPECTIONS ===== */
(function(global){
'use strict';
const U = global.GC.Utils, C = global.GC.CONST, E = global.GC.ENUM;
const { pick, pickN, randInt, clamp, uid, shift, iso, fmtD, NOW, TODAY } = U;

const SHOPS = {
  'Плановое ТО':        { perDay:6, perSlot:2, bay:'Пост 1 · ТО' },
  'Слесарные работы':   { perDay:4, perSlot:1, bay:'Пост 2 · слесарный' },
  'Не заводится':       { perDay:4, perSlot:1, bay:'Пост 2 · слесарный' },
  'Прочее':             { perDay:4, perSlot:1, bay:'Пост 2 · слесарный' },
  'Шиномонтаж':         { perDay:4, perSlot:1, bay:'Пост 3 · универсальный' },
  'Электрика':          { perDay:3, perSlot:1, bay:'Пост 3 · универсальный' },
  'Кондиционер':        { perDay:3, perSlot:1, bay:'Пост 3 · универсальный' },
  'Кузов':              { perDay:2, perSlot:1, bay:'Пост 3 · универсальный' }
};
const MECHANICS = [
  { name:'Rachid El Amrani', spec:['Слесарные работы','Не заводится','Прочее','Кузов'], salary:6800 },
  { name:'Hassan Bouzid',    spec:['Плановое ТО','Шиномонтаж'], salary:6200 },
  { name:'Mehdi Chakir',     spec:['Электрика','Кондиционер'], salary:7000 }
];
function mechanicFor(reason){ return (MECHANICS.find(m=>m.spec.includes(reason)) || MECHANICS[0]).name; }

// Booking slots: 10:00-18:00 every 30 min, lunch 12:00-13:00 closed
function daySlots(){
  const out = [];
  for(let h=10; h<18; h++){
    for(const mm of [0,30]){
      if(h===12) continue; // lunch closed
      out.push(U.pad2(h)+':'+U.pad2(mm));
    }
  }
  return out;
}
const SLOT_CYCLE_MIN = 40; // scheduled-service cycle: 35 work + 5 handover

// Intake window: phase 0 -> 1 only from 30 min before the booked slot to
// 60 min after it. `slotAt` is a Date built from slotDay+slot.
function intakeWindow(slotAt){
  return { from: new Date(slotAt.getTime() - 30*60000), to: new Date(slotAt.getTime() + 60*60000) };
}
function slotToDate(slotDay, slot){
  const [h,m] = slot.split(':').map(Number);
  const d = new Date(slotDay.getTime ? slotDay.getTime() : new Date(slotDay).getTime());
  d.setHours(h,m,0,0);
  return d;
}
function canStartIntake(order, now){
  now = now || NOW;
  const slotAt = slotToDate(new Date(order.slotDay), order.slot);
  const w = intakeWindow(slotAt);
  return now >= w.from && now <= w.to;
}
function intakeWindowLabel(order){
  const slotAt = slotToDate(new Date(order.slotDay), order.slot);
  const w = intakeWindow(slotAt);
  return U.fmtDT(w.from) + '–' + U.fmtDT(w.to);
}

const REASON_JOBS = {
  'Плановое ТО': [['Замена масла',0.5],['Замена фильтров',0.5],['Диагностика',1]],
  'Слесарные работы': [['Замена колодок',1],['Регулировка развал-схождения',1]],
  'Не заводится': [['Диагностика электрики',1],['Замена аккумулятора',0.5]],
  'Прочее': [['Общий осмотр',1]],
  'Шиномонтаж': [['Замена шин',0.5],['Балансировка',0.5]],
  'Электрика': [['Диагностика проводки',1.5],['Замена лампы',0.3]],
  'Кондиционер': [['Заправка фреона',1],['Диагностика компрессора',1]],
  'Кузов': [['Рихтовка',3],['Покраска',2]]
};

function buildRepairOrders(DB, R){
  const wd = global.GC.workingDrivers(DB);
  const reasons = Object.keys(SHOPS);
  const phases = [0,1,2,3,4,5,6, 0,1,2,3,4,5,6, 1]; // 15 orders, all phases covered
  DB.orders2 = phases.map((phase,i) => {
    const d = pick(R, wd);
    const car = DB.cars.find(c=>c.id===d.car);
    const reason = reasons[i % reasons.length];
    const jobs = REASON_JOBS[reason];
    const isDemo = i===0; // the walkable demo order, booked right now
    const isBlocked = i===7; // demonstrates the intake window blocking an out-of-window order
    let slotDay, slot;
    if(isDemo){ slotDay = TODAY; slot = U.pad2(NOW.getHours())+':'+(NOW.getMinutes()<30?'00':'30'); }
    else if(isBlocked){ slotDay = TODAY; slot = '09:00'; } // far outside the ±window from 14:00 "now"
    else { slotDay = shift(randInt(R,-20,10)); slot = pick(R, daySlots()); }

    const prio = pick(R, E.PRIO);
    const mech = mechanicFor(reason);
    const works = jobs.map(([name,h]) => ({ name, h, done: phase>=4 }));
    const parts = phase>=2 ? [{ art: pick(R,DB.parts).art, name: pick(R,DB.parts).name, qty: randInt(R,1,3),
        price: randInt(R,50,600), issued: phase>=3, issuedBy: phase>=3?'Кладовщик':null,
        issuedAt: phase>=3 ? iso(shift(-randInt(R,0,5))) : null }] : [];

    return {
      no: 'НЗ-' + (1040+i), car: car.plate, model: car.model, carId: car.id,
      driver: d.fio, driverId: d.id, div: d.div, org: d.org,
      reason, prio, slotDay: iso(slotDay), slot,
      mileage: car.mileage, odoPhoto: phase>=1 ? 'odo-'+car.id+'.jpg' : null,
      desc: 'Обращение: '+reason,
      phase,
      mech: phase>=2 ? mech : null,
      post: phase>=2 ? SHOPS[reason].bay : null,
      receiver: phase>=1 ? 'Приёмщик' : null,
      fuel: phase>=1 ? randInt(R,10,100) : null,
      fuelPhoto: phase>=1 ? 'fuel-'+car.id+'.jpg' : null,
      arrivedAt: phase>=1 ? iso(shift(-randInt(R,0,5))) : null,
      works, parts,
      photoAfter: phase>=4 ? 'after-'+car.id+'.jpg' : null,
      checkedBy: phase>=5 ? 'Приёмщик на ремонт' : null,
      timer: { run:false, min: phase>=2 && phase<4 ? randInt(R,10,180) : 0, startedAt: null },
      createdAt: iso(shift(-randInt(R,0,10))),
      closedAt: phase===6 ? iso(shift(-randInt(R,0,3))) : null,
      returns: R()<0.15 ? 1 : 0,
      notified: phase===6,
      demoOpen: isDemo,
      demoBlocked: isBlocked
    };
  });
}

// Advance a repair order one phase forward, enforcing the gates from §7.
function canAdvance(order){
  switch(order.phase){
    case 0: return canStartIntake(order) ? {ok:true} : {ok:false, reason:'Приёмка доступна только в окно '+intakeWindowLabel(order)};
    case 1: return (order.fuel!=null && order.fuelPhoto) ? {ok:true} : {ok:false, reason:'Укажите уровень топлива и фото бака'};
    case 2: return (order.works.length>0 && order.mech && order.post) ? {ok:true} : {ok:false, reason:'Нужна минимум одна работа, механик и пост'};
    case 3: return order.parts.every(p=>p.issued) ? {ok:true} : {ok:false, reason:'Не все запчасти выданы под подпись'};
    case 4: return (order.works.every(w=>w.done) && order.photoAfter) ? {ok:true} : {ok:false, reason:'Отметьте все работы и приложите фото после ремонта'};
    case 5: return order.checkedBy ? {ok:true} : {ok:false, reason:'Нужна проверка качества перед выдачей'};
    default: return {ok:false, reason:'Наряд уже закрыт'};
  }
}
function advancePhase(order){
  const chk = canAdvance(order);
  if(!chk.ok) return chk;
  order.phase += 1;
  if(order.phase===6) order.closedAt = iso(NOW);
  return {ok:true};
}
function returnPhase(order){
  if(order.phase<=0) return {ok:false, reason:'Уже на первой фазе'};
  order.phase -= 1;
  order.returns = (order.returns||0)+1;
  return {ok:true};
}

// --- Handover acts (приём/выдача) ---
function buildActs(DB, R){
  const wd = global.GC.workingDrivers(DB);
  DB.acts = [];
  for(let i=0;i<9;i++){
    const d = pick(R, wd);
    const car = DB.cars.find(c=>c.id===d.car);
    const kind = i%2===0 ? 'Выдача' : 'Возврат';
    const dmgZones = R()<0.3 ? [{ zone: pick(R,DB.tariffs).zone, type: pick(R,['Царапина','Скол']) }] : [];
    DB.acts.push({
      id:'act-'+(i+1), kind, car: car.plate, model: car.model, driver: d.fio, driverId: d.id, div: d.div,
      at: iso(shift(-randInt(R,0,60))), by: pick(R,['Мouad Koudia','Nehemie Koffi']),
      photos: randInt(R,2,6), dmg: dmgZones, equip: ['Аптечка','Огнетушитель','Знак аварийной остановки'],
      fuel: randInt(R,20,100), mileage: car.mileage, signed: R()<0.85
    });
  }
}

// --- Shifts ---
function buildShifts(DB, R){
  const wd = global.GC.workingDrivers(DB);
  DB.shifts = [];
  let n = 0;
  for(let day=-11; day<=0 && n<118; day++){
    wd.forEach(d => {
      if(n>=118) return;
      const car = DB.cars.find(c=>c.id===d.car);
      const startH = randInt(R,6,10), dur = randInt(R,6,12);
      const status = day===0 ? pick(R,['Открыта','Закрыта']) : (R()<0.08?'Просрочена':'Закрыта');
      DB.shifts.push({
        id:'sh-'+(++n), driverId:d.id, driver:d.fio, car: car.plate, div: d.div,
        date: iso(shift(day)), start: U.pad2(startH)+':00', end: U.pad2((startH+dur)%24)+':00',
        hours: dur, orders: randInt(R,4,25), revenue: randInt(R,300,1800),
        waybill: R()<0.9, wbIssued: R()<0.9, inspect: R()<0.85, status
      });
    });
  }
}

// --- Inspections ---
function buildInspections(DB, R){
  const wd = global.GC.workingDrivers(DB);
  DB.inspections = [];
  for(let i=0;i<26;i++){
    const d = pick(R, wd);
    const car = DB.cars.find(c=>c.id===d.car);
    const nDmg = R()<0.4 ? randInt(R,1,2) : 0;
    const dmg = [];
    for(let k=0;k<nDmg;k++){ const t = pick(R, DB.tariffs); dmg.push({ zone:t.zone, type:t.type, price:t.price }); }
    const total = dmg.reduce((s,x)=>s+x.price,0);
    DB.inspections.push({
      id:'insp-'+(i+1), at: iso(shift(-randInt(R,0,90))), car: car.plate, carId: car.id,
      driver: d.fio, driverId: d.id, div: d.div,
      kind: pick(R,['Плановый осмотр','Осмотр при возврате','Внеплановый']),
      mech: pick(R, MECHANICS).name, photos: randInt(R,2,8),
      dmg, total, charged: total>0 && R()<0.7
    });
  }
}

global.GC.SHOPS = SHOPS; global.GC.MECHANICS = MECHANICS;
global.GC.daySlots = daySlots; global.GC.mechanicFor = mechanicFor;
global.GC.canStartIntake = canStartIntake; global.GC.intakeWindowLabel = intakeWindowLabel;
global.GC.slotToDate = slotToDate;
global.GC.buildRepairOrders = buildRepairOrders;
global.GC.canAdvance = canAdvance; global.GC.advancePhase = advancePhase; global.GC.returnPhase = returnPhase;
global.GC.buildActs = buildActs;
global.GC.buildShifts = buildShifts;
global.GC.buildInspections = buildInspections;

})(typeof window !== 'undefined' ? window : globalThis);
