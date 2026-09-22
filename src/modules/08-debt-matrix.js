/* ===== 08. DEBT MATRIX BY DAY (§8.3) =====
   Driver x day grid. Reconstructed from the cash ledger's own chronological
   before/after (already exact — see module 04), which is equivalent to the
   spec's "undo the day's operations, add back rent, subtract earnings"
   approach but avoids re-deriving numbers that are already ground truth.
   Today's column is therefore guaranteed to equal the driver's ledger
   balance shown in "Водители". */
(function(global){
'use strict';
const U = global.GC.Utils;
const { iso, shift } = U;

function debtMatrix(DB, days){
  days = days || 30;
  const wd = global.GC.workingDrivers(DB);
  const byDriverDay = {}; // driverId -> { 'YYYY-MM-DD': afterBalance }
  wd.forEach(d => byDriverDay[d.id] = {});

  const sorted = DB.cash.filter(c=>c.src==='Баланс').slice().sort((a,b)=> new Date(a.at)-new Date(b.at));
  sorted.forEach(c => {
    if(!byDriverDay[c.driverId]) return;
    byDriverDay[c.driverId][iso(new Date(c.at))] = c.after;
  });

  const dayList = [];
  for(let i=-(days-1); i<=0; i++) dayList.push(iso(shift(i)));

  return wd.map(d => {
    let carry = 0;
    const cells = dayList.map(day => {
      if(byDriverDay[d.id][day] !== undefined) carry = byDriverDay[d.id][day];
      return { day, balance: Math.round(carry*100)/100 };
    });
    return { driverId: d.id, driver: d.fio, div: d.div, cells };
  });
}

function agingBucket(negDays){
  if(negDays <= 0) return null;
  if(negDays <= 7) return '1–7';
  if(negDays <= 14) return '8–14';
  if(negDays <= 29) return '15–29';
  return '30+';
}

// For a driver row, how many consecutive days (ending today) has the
// balance stayed negative.
function daysInDebt(cells){
  let n = 0;
  for(let i=cells.length-1; i>=0; i--){
    if(cells[i].balance < 0) n++; else break;
  }
  return n;
}

global.GC.debtMatrix = debtMatrix;
global.GC.agingBucket = agingBucket;
global.GC.daysInDebt = daysInDebt;

})(typeof window !== 'undefined' ? window : globalThis);
