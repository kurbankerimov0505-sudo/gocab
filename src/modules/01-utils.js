/* ===== 01. UTILS & FORMATTING ===== */
(function(global){
'use strict';

// --- Seeded PRNG (mulberry32) ---
function rng(seed){
  let a = seed >>> 0;
  return function(){
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function pick(rnd, arr){ return arr[Math.floor(rnd()*arr.length)]; }
function pickN(rnd, arr, n){
  const pool = arr.slice(); const out = [];
  n = Math.min(n, pool.length);
  for(let i=0;i<n;i++){ const idx = Math.floor(rnd()*pool.length); out.push(pool.splice(idx,1)[0]); }
  return out;
}
function randInt(rnd, min, max){ return Math.floor(rnd()*(max-min+1))+min; }
function clamp(x, lo, hi){ return Math.max(lo, Math.min(hi, x)); }
function uid(prefix){ uid._n = (uid._n||0)+1; return prefix + '-' + uid._n; }

// --- Fixed reference date ---
const TODAY = new Date(2026, 8, 8); // 2026-09-08, months are 0-indexed
// Fixed "current instant" (date + time) the whole demo pretends it is right
// now — used for anything time-of-day sensitive (intake window, SLA
// countdowns, timers) so the app's behaviour is reproducible regardless of
// the real wall clock.
const NOW = new Date(2026, 8, 8, 14, 0, 0);

function shift(days){
  const d = new Date(TODAY.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

const DOW = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const MON = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MON_SHORT = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];

function pad2(n){ return String(n).padStart(2,'0'); }

function iso(d){
  if(!(d instanceof Date)) d = new Date(d);
  return d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate());
}

function fmtD(d){
  if(!(d instanceof Date)) d = new Date(d);
  return pad2(d.getDate()) + '.' + pad2(d.getMonth()+1) + '.' + d.getFullYear();
}

function fmtDT(d){
  if(!(d instanceof Date)) d = new Date(d);
  return fmtD(d) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

function fmtLong(d){
  if(!(d instanceof Date)) d = new Date(d);
  return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear();
}

function daysBetween(a,b){
  const ms = 24*3600*1000;
  const da = new Date(a.getFullYear? a.getFullYear():a);
  return Math.round((new Date(b) - new Date(a)) / ms);
}

// --- Money formatting: thin-space thousands, 2 decimals ---
function money(v){
  v = Number(v)||0;
  const sign = v < 0 ? '−' : '';
  const abs = Math.abs(v);
  const fixed = abs.toFixed(2);
  let [intPart, dec] = fixed.split('.');
  intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return sign + intPart + '.' + dec;
}
function cur(v){ return money(v) + ' MAD'; }
function pctS(x){ return (x*100).toFixed(1).replace('.', ',') + '%'; }
function num(v){
  v = Number(v)||0;
  const sign = v<0?'−':'';
  const abs = Math.abs(Math.round(v));
  return sign + String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function esc(s){
  s = (s===undefined||s===null) ? '' : String(s);
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// --- Plate formatting: 12345-A-6 ---
function fmtPlate(p){ return p; }

const Utils = {
  rng, pick, pickN, randInt, clamp, uid,
  TODAY, NOW, shift, iso, fmtD, fmtDT, fmtLong, daysBetween,
  money, cur, pctS, num, esc, fmtPlate,
  DOW, MON, MON_SHORT, pad2
};

global.GC = global.GC || {};
global.GC.Utils = Utils;

})(typeof window !== 'undefined' ? window : globalThis);
