/* ===== 04. CASH LEDGER & BALANCE RECONCILIATION =====
   Invariant: every driver balance is DERIVED from the cash ledger, never
   stored independently — recalcBalances() is the single source of truth. */
(function(global){
'use strict';
const U = global.GC.Utils, C = global.GC.CONST, E = global.GC.ENUM;
const { shift, iso, esc, uid } = U;

function mkCash(d, at, type, amt, iface, src, who, carry){
  return {
    id: uid('cash'),
    at: new Date(at.getTime ? at.getTime() : at),
    driver: d.fio, driverId: d.id, div: d.div,
    iface: iface, who: who || (iface==='Личный кабинет' ? d.fio : (iface==='Система по расписанию' ? 'Система' : 'Менеджер')),
    src: src, type: type, amt: Math.round(amt*100)/100,
    before: 0, after: 0,
    carry: !!carry // true only for the historical-debt carry-forward entry (module 05) —
                    // excluded from accrued/collected totals, it's not a day's rent or payment
  };
}

// Split `total` across `n` days within the last 30 days as natural-looking
// amounts that sum EXACTLY to total (random cut-point partition + rounding
// correction on the last slice so no cent is lost).
function distributeAcrossDays(rnd, total, n, dayFrom, dayTo){
  const days = [];
  const span = dayTo - dayFrom;
  const chosen = new Set();
  while(chosen.size < Math.min(n, span+1)){
    chosen.add(dayFrom + Math.floor(rnd()*(span+1)));
  }
  const dayList = Array.from(chosen).sort((a,b)=>a-b);
  const k = dayList.length;
  // random partition of [0,total] into k positive pieces
  const cuts = [0];
  for(let i=0;i<k-1;i++) cuts.push(rnd());
  cuts.push(1);
  cuts.sort((a,b)=>a-b);
  let amounts = [];
  for(let i=0;i<k;i++) amounts.push((cuts[i+1]-cuts[i])*total);
  // round to nearest 10, fix drift on the last entry
  amounts = amounts.map(a => Math.round(a/10)*10);
  const drift = total - amounts.reduce((s,a)=>s+a,0);
  amounts[amounts.length-1] += drift;
  return dayList.map((day,i)=>({ day, amt: amounts[i] }));
}

function paymentDaysFor(disc){
  if(disc >= 0.95) return 24;
  if(disc >= 0.88) return 18;
  if(disc >= 0.82) return 12;
  return 7;
}

const IFACE_POOL = ['Личный кабинет','Терминал','Менеджер'];

function buildCashLedgerBase(DB, rnd){
  DB.cash = DB.cash || [];
  const workingDrivers = DB.drivers.filter(d => d.car);

  workingDrivers.forEach(d => {
    // 1. daily rent accrual, last 30 days (today = day 0)
    for(let i=-29;i<=0;i++){
      DB.cash.push(mkCash(d, shift(i), 'Списание', d.rate, 'Система по расписанию', 'Баланс'));
    }
    // 2. payment target split across payment days
    const target = Math.round((d.rate*30*d._disc)/10)*10;
    const nDays = paymentDaysFor(d._disc);
    const splits = distributeAcrossDays(rnd, target, nDays, -29, 0);
    splits.forEach(s => {
      const iface = IFACE_POOL[Math.floor(rnd()*IFACE_POOL.length)];
      DB.cash.push(mkCash(d, shift(s.day), 'Пополнение', s.amt, iface, 'Баланс'));
    });
    // 3. Yandex balance carried as its own ledger source, single opening entry
    if(d.balY){
      DB.cash.push(mkCash(d, shift(-30), d.balY>=0?'Пополнение':'Списание', Math.abs(d.balY),
        'Система по расписанию', 'Баланс Яндекс', 'Система'));
    }
  });

  recalcBalances(DB);
}

// Push one "Перенос остатка" entry per driver carrying forward the closing
// balance produced by the 9-month collection model (module 09), then
// finalize every driver's bal to match it exactly.
function appendBalanceCarryForward(DB, closingBalanceByDriverId){
  DB.drivers.filter(d => d.car).forEach(d => {
    const modelClose = closingBalanceByDriverId[d.id];
    if(modelClose === undefined) return;
    const currentFromLedger = sumSrc(DB, d.id, 'Баланс');
    const delta = modelClose - currentFromLedger; // amount needed to reconcile to the model's number
    if(Math.round(delta*100) !== 0){
      DB.cash.push(mkCash(d, shift(-31), delta>=0?'Пополнение':'Списание', Math.abs(delta),
        'Система по расписанию', 'Баланс', 'Перенос остатка', true));
    }
  });
  recalcBalances(DB);
}

function sumSrc(DB, driverId, src){
  return DB.cash.filter(c => c.driverId===driverId && c.src===src)
    .reduce((s,c) => s + (c.type==='Пополнение' ? c.amt : -c.amt), 0);
}

// Recompute before/after on every operation in chronological order, and
// derive every driver's bal / balY / finesBal / dmgBal purely from the ledger.
function recalcBalances(DB){
  const sorted = DB.cash.slice().sort((a,b)=> new Date(a.at) - new Date(b.at));
  const running = {}; // key: driverId|src -> balance
  sorted.forEach(c => {
    const key = c.driverId+'|'+c.src;
    const before = running[key] || 0;
    const after = before + (c.type==='Пополнение' ? c.amt : -c.amt);
    c.before = Math.round(before*100)/100;
    c.after = Math.round(after*100)/100;
    running[key] = after;
  });
  DB.drivers.forEach(d => {
    d.bal = Math.round((running[d.id+'|Баланс']||0)*100)/100;
    d.balY = Math.round((running[d.id+'|Баланс Яндекс']||0)*100)/100;
    d.finesBal = Math.round((running[d.id+'|Баланс штрафов']||0)*100)/100;
    d.dmgBal = Math.round((running[d.id+'|Баланс повреждений']||0)*100)/100;
  });
}

function ledgerTotals(DB){
  const accrued = DB.cash.filter(c=>c.iface==='Система по расписанию' && c.type==='Списание' && c.src==='Баланс' && !c.carry)
    .reduce((s,c)=>s+c.amt,0);
  const collected = DB.cash.filter(c=>c.type==='Пополнение' && c.src==='Баланс' && !c.carry)
    .reduce((s,c)=>s+c.amt,0);
  return { accrued, collected, rate: accrued? collected/accrued : 0 };
}

global.GC.mkCash = mkCash;
global.GC.buildCashLedgerBase = buildCashLedgerBase;
global.GC.appendBalanceCarryForward = appendBalanceCarryForward;
global.GC.recalcBalances = recalcBalances;
global.GC.sumSrc = sumSrc;
global.GC.ledgerTotals = ledgerTotals;

})(typeof window !== 'undefined' ? window : globalThis);
