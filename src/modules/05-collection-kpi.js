/* ===== 05. NINE-MONTH COLLECTION MODEL & MANAGER KPI ===== */
(function(global){
'use strict';
const U = global.GC.Utils, C = global.GC.CONST;
const { clamp, randInt, pick } = U;

const MONTHS_9 = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь'];

// Runs the forward 8-month (Jan-Aug) bucket simulation per driver, then
// splices in September verbatim from the real cash ledger (module 04) so
// the last month always matches the cash-desk figures exactly.
function runCollectionModel(DB, rnd){
  const drivers = DB.drivers.filter(d => d.car);
  const perDriver = {};

  drivers.forEach(d => {
    let b = [0,0,0,0,0]; // Текущая, до30, 31-60, 61-90, от91
    let wo = 0, woN = 0;
    const monthly = [];

    for(let m=0; m<8; m++){
      b[4]+=b[3]; b[3]=b[2]; b[2]=b[1]; b[1]=b[0]; b[0]=0;
      const accrual = d.rate*30;
      b[0]+=accrual;

      let budget = Math.round(d.rate*30*clamp(d._disc + (rnd()-0.5)*0.06, 0.55, 1.05));
      let paid = 0;
      for(let i=4;i>=0 && budget>0;i--){
        const pay = Math.min(b[i], budget);
        b[i]-=pay; budget-=pay; paid+=pay;
      }
      if(rnd() < 0.16){
        let extra = d.rate * randInt(rnd,2,10);
        for(let i=4;i>=2 && extra>0;i--){
          const pay = Math.min(b[i], extra);
          b[i]-=pay; extra-=pay; paid+=pay;
        }
      }
      let wroteOff = false;
      if(b[4] > d.rate*3){
        if(rnd() < 0.62){
          wo += b[0]+b[1]+b[2]+b[3]+b[4];
          woN++;
          b = [0,0,0,0,0];
          wroteOff = true;
        }
      }
      monthly.push({ month: MONTHS_9[m], accrued: accrual, collected: paid,
        debtEnd: b.reduce((s,x)=>s+x,0), wroteOff });
    }

    // September: taken verbatim from the real ledger (already built)
    const accrual9 = DB.cash.filter(c=>c.driverId===d.id && c.src==='Баланс' &&
      c.iface==='Система по расписанию' && c.type==='Списание' && !c.carry).reduce((s,c)=>s+c.amt,0);
    const collected9 = DB.cash.filter(c=>c.driverId===d.id && c.src==='Баланс' &&
      c.type==='Пополнение' && !c.carry).reduce((s,c)=>s+c.amt,0);
    monthly.push({ month: MONTHS_9[8], accrued: accrual9, collected: collected9,
      debtEnd: b.reduce((s,x)=>s+x,0), wroteOff:false });

    perDriver[d.id] = {
      monthly, buckets: b.slice(), wo, woN,
      priorDebt: b.reduce((s,x)=>s+x,0) // debt as of end-August, carried into Sept ledger
    };
  });

  DB._collection = { perDriver, months: MONTHS_9 };
  return DB._collection;
}

// Uses the model's per-driver prior debt to finalize the cash ledger's
// carry-forward entry (see module 04 appendBalanceCarryForward).
function applyCollectionToLedger(DB){
  const model = DB._collection;
  const targets = {};
  DB.drivers.filter(d=>d.car).forEach(d=>{
    const current = global.GC.sumSrc(DB, d.id, 'Баланс');
    const priorDebt = model.perDriver[d.id] ? model.perDriver[d.id].priorDebt : 0;
    targets[d.id] = current - priorDebt;
  });
  global.GC.appendBalanceCarryForward(DB, targets);
}

// --- Manager KPI (§8.2) ---
const KPI_METRICS = [
  { key:'collection', name:'Собираемость аренды', weight:0.30, plan:0.96, floor:0.90, inverted:false },
  { key:'utilization', name:'Утилизация автопарка', weight:0.25, plan:0.92, floor:0.85, inverted:false },
  { key:'idle',        name:'Простой автопарка',    weight:0.15, plan:0.08, floor:0.12, inverted:true  },
  { key:'fines',       name:'Собираемость штрафов', weight:0.15, plan:0.90, floor:0.80, inverted:false },
  { key:'baddebt',     name:'Долги уволенных водителей', weight:0.15, plan:0.015, floor:0.03, inverted:true }
];

function achievement(metric, fact){
  const { plan, floor, inverted } = metric;
  if(inverted) return fact > floor ? 0 : clamp(plan/Math.max(fact,1e-6), 0, 1);
  return fact < floor ? 0 : clamp(fact/plan, 0, 1);
}

function computeManagerKPI(DB){
  const managers = {}; // name -> {divs[], drivers[], cars[]}
  DB.divs.forEach(dv => {
    managers[dv.manager] = managers[dv.manager] || { name: dv.manager, divs:[], drivers:[], cars:[] };
    managers[dv.manager].divs.push(dv.id);
  });
  DB.drivers.forEach(d => { const m = Object.values(managers).find(m=>m.divs.includes(d.div)); if(m) m.drivers.push(d); });
  DB.cars.forEach(c => { const m = Object.values(managers).find(m=>m.divs.includes(c.div)); if(m) m.cars.push(c); });

  const model = DB._collection;
  const result = [];
  Object.values(managers).forEach(m => {
    const driverIds = m.drivers.map(d=>d.id);
    let accruedSum=0, collectedSum=0, wo=0, woN=0;
    const sparkline = MONTHS_9.map(()=>({accrued:0, collected:0}));
    driverIds.forEach(id => {
      const dm = model.perDriver[id]; if(!dm) return;
      wo += dm.wo; woN += dm.woN;
      dm.monthly.forEach((mm,i) => { sparkline[i].accrued += mm.accrued; sparkline[i].collected += mm.collected; });
    });
    sparkline.forEach(s => { accruedSum += s.accrued; collectedSum += s.collected; });
    const collectionFact = accruedSum ? collectedSum/accruedSum : 0;
    const collectionSpark = sparkline.map(s => s.accrued ? s.collected/s.accrued : 0);

    const carsN = m.cars.length || 1;
    const workingCars = m.cars.filter(c=>c.status==='В работе').length;
    const utilFact = workingCars / carsN;
    const idleFact = 1 - utilFact;

    const divFines = DB.fines ? DB.fines.filter(f => m.divs.includes(f.div)) : [];
    const finesTotal = divFines.reduce((s,f)=>s+f.sum,0);
    const finesPaid = divFines.filter(f=>f.status==='Оплачен').reduce((s,f)=>s+f.sum,0);
    const finesFact = finesTotal ? finesPaid/finesTotal : 1;

    const badDebt = Math.max(0, wo - C.DEP_TARGET*woN) * 0.35;
    const baddebtFact = collectedSum ? badDebt/collectedSum : 0;

    const facts = { collection:collectionFact, utilization:utilFact, idle:idleFact, fines:finesFact, baddebt:baddebtFact };
    let bonus = 0;
    const chips = [];
    // Stop factor uses CURRENT outstanding debt (today's driver balances),
    // not the cumulative 9-month accrued/collected gap — the two are on
    // different scales and comparing the latter to a per-day threshold
    // would trip on almost any dataset.
    const currentDebt = m.drivers.reduce((s,d)=> s + Math.max(0, -d.bal), 0);
    const debtPerVehicle = carsN ? currentDebt/carsN : 0;
    const debtStop = debtPerVehicle > C.RATE*C.DEBT_LIMIT_DAYS;
    if(debtStop) chips.push('Долг на автомобиль выше нормы — бонус за собираемость обнулён');

    KPI_METRICS.forEach(metric => {
      const fact = facts[metric.key];
      const ach = (metric.key==='collection' && debtStop) ? 0 : achievement(metric, fact);
      bonus += C.BONUS * metric.weight * ach;
    });
    const nonReturnPenalty = 0; // no non-returned-vehicle events in demo data
    const payout = C.FIX_PAY + bonus - nonReturnPenalty;
    const avgAchievement = KPI_METRICS.reduce((s,metric)=>s+achievement(metric, facts[metric.key]),0)/KPI_METRICS.length;

    result.push({
      name: m.name, divs: m.divs, facts, sparklines: { collection: collectionSpark },
      bonus, payout, avgAchievement, chips, wo, woN,
      driverCount: driverIds.length, carCount: carsN
    });
  });
  return result;
}

global.GC.runCollectionModel = runCollectionModel;
global.GC.applyCollectionToLedger = applyCollectionToLedger;
global.GC.KPI_METRICS = KPI_METRICS;
global.GC.kpiAchievement = achievement;
global.GC.computeManagerKPI = computeManagerKPI;

})(typeof window !== 'undefined' ? window : globalThis);
