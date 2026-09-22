/* ===== 11. STATE & REUSABLE UI COMPONENTS ===== */
(function(global){
'use strict';
const U = global.GC.Utils, C = global.GC.CONST, E = global.GC.ENUM;
const { esc, money, cur, pctS, num, fmtD, fmtDT } = U;

// ---------------- Global state ----------------
const S = {
  DB: null,
  side: false,      // drawer open?
  sec: 'dash', tab: 0,
  role: 'Кантри-менеджер',
  userId: 'u-1',
  lang: 'ru',
  filters: {},       // sec -> { field: value }
  modal: null,       // { title, body(html)|fields, onSave, form:{} }
  toastMsg: null,
  menuOpen: {},      // group -> bool
  _lastRenderKey: ''
};

function currentUser(){ return S.DB.users.find(u=>u.id===S.userId) || S.DB.users[0]; }

function hasRight(right){
  const u = currentUser();
  if(!u) return false;
  return u.rights.includes('Все разделы') || u.rights.includes(right);
}
function canSeeSection(sec){
  const sections = global.GC.ROLE_SECTIONS[S.role] || [];
  return sections.includes(sec);
}

// ---------------- Toast ----------------
function toast(msg){
  S.toastMsg = msg;
  global.GC.render();
  setTimeout(()=>{ S.toastMsg = null; const el = document.getElementById('toast'); if(el) el.classList.remove('show'); }, 2600);
}

// ---------------- Table component ----------------
function tableHTML(cols, rows, opts){
  opts = opts || {};
  const title = opts.title || '';
  const pageSize = opts.pageSize || 20;
  const page = opts.page || 0;
  const total = rows.length;
  const shown = rows.slice(page*pageSize, page*pageSize+pageSize);
  let html = '<div class="card table-card">';
  if(title || opts.actions){
    html += '<div class="card-head"><h3>'+esc(title)+'</h3><div class="card-actions">'+(opts.actions||'')+'</div></div>';
  }
  html += '<div class="table-scroll"><table class="tbl"><thead><tr>';
  cols.forEach(c => html += '<th'+(c.width?' style="width:'+c.width+'"':'')+'>'+esc(c.label)+'</th>');
  html += '</tr></thead><tbody>';
  if(shown.length===0){
    html += '<tr><td colspan="'+cols.length+'" class="empty-state">Нет данных</td></tr>';
  } else {
    shown.forEach(row => {
      html += '<tr'+(opts.rowAttrs?opts.rowAttrs(row):'')+'>';
      cols.forEach(c => html += '<td>'+(c.render ? c.render(row) : esc(row[c.key])) +'</td>');
      html += '</tr>';
    });
  }
  html += '</tbody></table></div>';
  html += '<div class="table-foot"><span class="muted">Показано '+shown.length+' из '+total+'</span>';
  if(total > pageSize){
    const pages = Math.ceil(total/pageSize);
    html += '<div class="pager">';
    for(let i=0;i<pages;i++){
      html += '<button class="pg-btn'+(i===page?' active':'')+'" data-act="table-page" data-sec="'+esc(opts.pageKey||'')+'" data-page="'+i+'">'+(i+1)+'</button>';
    }
    html += '</div>';
  }
  html += '</div></div>';
  return html;
}

// ---------------- Filters drawer ----------------
function filtersHTML(sec, defs){
  const active = S.filters[sec] || {};
  const activeCount = Object.keys(active).filter(k=>active[k]!==undefined && active[k]!=='' && !(Array.isArray(active[k])&&active[k].length===0)).length;
  let html = '<button class="btn btn-ghost filter-toggle" data-act="toggle-filters" data-sec="'+esc(sec)+'">'
    + '⚗ Фильтр' + (activeCount? ' <span class="badge">'+activeCount+'</span>' : '') + '</button>';
  html += '<div class="filters-drawer'+(S._filtersOpen===sec?' open':'')+'" data-filters-sec="'+esc(sec)+'">';
  html += '<div class="filters-head"><b>Фильтры</b><button class="icon-btn" data-act="close-filters">✕</button></div>';
  html += '<div class="filters-body">';
  defs.forEach(f => {
    const val = active[f.key];
    html += '<label class="f-field"><span>'+esc(f.label)+'</span>';
    if(f.type==='text'){
      html += '<input type="text" data-filter-key="'+esc(f.key)+'" data-sec="'+esc(sec)+'" value="'+esc(val||'')+'" placeholder="'+esc(f.ph||'')+'">';
    } else if(f.type==='num'){
      html += '<input type="text" inputmode="decimal" class="no-spin" data-filter-key="'+esc(f.key)+'" data-sec="'+esc(sec)+'" value="'+esc(val||'')+'" placeholder="'+esc(f.ph||'')+'">';
    } else if(f.type==='date'){
      html += '<input type="date" data-filter-key="'+esc(f.key)+'" data-sec="'+esc(sec)+'" value="'+esc(val||'')+'">';
    } else if(f.type==='sel'){
      html += '<select data-filter-key="'+esc(f.key)+'" data-sec="'+esc(sec)+'"><option value="">Все</option>';
      (f.options||[]).forEach(o => html += '<option value="'+esc(o)+'"'+(val===o?' selected':'')+'>'+esc(o)+'</option>');
      html += '</select>';
    } else if(f.type==='ms'){
      html += '<div class="ms-box" data-filter-key="'+esc(f.key)+'" data-sec="'+esc(sec)+'">';
      (f.options||[]).forEach(o => {
        const checked = Array.isArray(val) && val.includes(o);
        html += '<label class="ms-opt"><input type="checkbox" data-ms-val="'+esc(o)+'" '+(checked?'checked':'')+'> '+esc(o)+'</label>';
      });
      html += '</div>';
    }
    html += '</label>';
  });
  html += '</div><div class="filters-foot">'
    + '<button class="btn btn-ghost" data-act="clear-filters" data-sec="'+esc(sec)+'">Сбросить</button>'
    + '<button class="btn btn-primary" data-act="close-filters">Применить</button></div>';
  html += '</div><div class="filters-backdrop'+(S._filtersOpen===sec?' show':'')+'" data-act="close-filters"></div>';
  return html;
}

function applyFilters(sec, rows, defs){
  const active = S.filters[sec] || {};
  return rows.filter(row => {
    return defs.every(f => {
      const val = active[f.key];
      if(val===undefined || val==='' || (Array.isArray(val)&&val.length===0)) return true;
      const rv = f.get ? f.get(row) : row[f.key];
      if(f.type==='text') return String(rv||'').toLowerCase().includes(String(val).toLowerCase());
      if(f.type==='num') return Number(rv)===Number(val);
      if(f.type==='date') return U.iso(new Date(rv))===val;
      if(f.type==='sel') return rv===val;
      if(f.type==='ms') return val.includes(rv);
      return true;
    });
  });
}

// ---------------- Modal shell ----------------
function openModal(cfg){ S.modal = cfg; global.GC.render(); }
function closeModal(){ S.modal = null; global.GC.render(); }

function mField(label, key, type, opts, ph){
  opts = opts || {};
  const form = S.modal ? S.modal.form : {};
  const val = form[key];
  let input = '';
  if(type==='select'){
    input = '<select data-mf="'+esc(key)+'">' + (opts.options||[]).map(o=>{
      const ov = typeof o === 'object' ? o.value : o;
      const ol = typeof o === 'object' ? o.label : o;
      return '<option value="'+esc(ov)+'"'+(val===ov?' selected':'')+'>'+esc(ol)+'</option>';
    }).join('') + '</select>';
  } else if(type==='textarea'){
    input = '<textarea data-mf="'+esc(key)+'" placeholder="'+esc(ph||'')+'">'+esc(val||'')+'</textarea>';
  } else if(type==='num'){
    input = '<input type="text" inputmode="decimal" class="no-spin" data-mf="'+esc(key)+'" value="'+esc(val===undefined?'':val)+'" placeholder="'+esc(ph||'')+'">';
  } else if(type==='date'){
    input = '<input type="date" data-mf="'+esc(key)+'" value="'+esc(val||'')+'">';
  } else if(type==='checkbox'){
    input = '<input type="checkbox" data-mf="'+esc(key)+'" '+(val?'checked':'')+'>';
    return '<label class="m-field m-check">'+input+' <span>'+esc(label)+'</span></label>';
  } else {
    input = '<input type="text" data-mf="'+esc(key)+'" value="'+esc(val||'')+'" placeholder="'+esc(ph||'')+'">';
  }
  return '<label class="m-field"><span>'+esc(label)+'</span>'+input+'</label>';
}

function modalHTML(){
  if(!S.modal) return '';
  const m = S.modal;
  return '<div class="modal-backdrop" data-act="close-modal">'
    + '<div class="modal-card" data-stop="1">'
    + '<div class="modal-head"><h3>'+esc(m.title)+'</h3><button class="icon-btn" data-act="close-modal">✕</button></div>'
    + '<div class="modal-body">'+(m.body||'')+'</div>'
    + '<div class="modal-foot">'
    + (m.footer!==undefined ? m.footer : (
        '<button class="btn btn-ghost" data-act="close-modal">Отмена</button>'
        + (m.onSave ? '<button class="btn btn-primary" data-act="modal-save">'+esc(m.saveLabel||'Сохранить')+'</button>' : '')
      ))
    + '</div></div></div>';
}

// ---------------- Presentation helpers (inline SVG) ----------------
function statusPill(text, kind){
  kind = kind || (['Работает','Активна','В работе','Выплачена','Оплачен','Одобрено','Закрыта','Подписан','Свободен'].includes(text) ? 'ok'
    : (['Заблокирован','Уволен','Отклонена','Не оплачен','Отказано','Просрочена','Истёк','На сервисе','Списан'].includes(text) ? 'bad' : 'warn'));
  return '<span class="pill pill-'+kind+'">'+esc(text)+'</span>';
}
function tagChips(ids, tagsDB){
  return (ids||[]).map(id => {
    const t = (tagsDB||[]).find(x=>x.id===id);
    if(!t) return '';
    return '<span class="chip" style="--chip-c:'+t.color+'">'+esc(t.name)+'</span>';
  }).join('');
}
function barBlock(pct, kind){
  pct = Math.max(0, Math.min(100, pct));
  return '<div class="barblock"><div class="barblock-fill barblock-'+(kind||'ok')+'" style="width:'+pct+'%"></div></div>';
}
function spark(values, w, h){
  w = w||120; h = h||32;
  if(!values.length) return '<svg viewBox="0 0 '+w+' '+h+'" class="spark"></svg>';
  const max = Math.max(...values, 0.0001), min = Math.min(...values, 0);
  const range = (max-min)||1;
  const step = w/Math.max(values.length-1,1);
  const pts = values.map((v,i)=> (i*step) + ',' + (h - ((v-min)/range)*h)).join(' ');
  return '<svg viewBox="0 0 '+w+' '+h+'" class="spark" preserveAspectRatio="none"><polyline points="'+pts+'" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
}
function ring(pct, size, label){
  size = size || 96;
  const r = size/2 - 8, c = 2*Math.PI*r;
  const off = c*(1-Math.max(0,Math.min(1,pct)));
  return '<svg viewBox="0 0 '+size+' '+size+'" class="ring" style="width:'+size+'px;height:'+size+'px">'
    + '<circle cx="'+size/2+'" cy="'+size/2+'" r="'+r+'" class="ring-bg"/>'
    + '<circle cx="'+size/2+'" cy="'+size/2+'" r="'+r+'" class="ring-fg" stroke-dasharray="'+c+'" stroke-dashoffset="'+off+'" transform="rotate(-90 '+size/2+' '+size/2+')"/>'
    + '<text x="50%" y="52%" text-anchor="middle" class="ring-txt">'+esc(label||pctS(pct))+'</text>'
    + '</svg>';
}
// `fact`/`plan`/`floor` are the ARC fractions (0..1, already flipped by the
// caller for inverted metrics so "more filled" always reads as "better").
// `displayValue` is the true fact shown as text — for an inverted metric
// this is NOT the same number as `fact`, so it's passed separately rather
// than re-derived from the (possibly flipped) arc fraction.
function gauge(fact, plan, floor, size, displayValue){
  size = size||140;
  const cx=size/2, cy=size*0.62, r=size*0.4;
  const a0=Math.PI, a1=0; // semicircle
  const toXY = (frac) => {
    const a = a0 + (a1-a0)*frac;
    return [cx+r*Math.cos(a), cy+r*Math.sin(a)];
  };
  const [fx,fy] = toXY(Math.max(0,Math.min(1,fact)));
  const [px,py] = toXY(Math.max(0,Math.min(1,plan)));
  const [flx,fly] = toXY(Math.max(0,Math.min(1,floor)));
  const large = fact>0.5?1:0;
  const label = displayValue!==undefined ? pctS(displayValue) : pctS(fact);
  return '<svg viewBox="0 0 '+size+' '+(size*0.7)+'" class="gauge" style="width:'+size+'px;height:'+(size*0.7)+'px">'
    + '<path d="M '+(cx-r)+' '+cy+' A '+r+' '+r+' 0 1 1 '+(cx+r)+' '+cy+'" class="gauge-bg" fill="none"/>'
    + '<path d="M '+(cx-r)+' '+cy+' A '+r+' '+r+' 0 '+large+' 1 '+fx+' '+fy+'" class="gauge-fg" fill="none"/>'
    + '<line x1="'+cx+'" y1="'+cy+'" x2="'+px+'" y2="'+py+'" class="gauge-tick"/>'
    + '<line x1="'+cx+'" y1="'+cy+'" x2="'+flx+'" y2="'+fly+'" class="gauge-floor"/>'
    + '<text x="'+cx+'" y="'+cy+'" text-anchor="middle" class="gauge-txt">'+label+'</text>'
    + '</svg>';
}
function donut(segments, size){ // [{value,color,label}]
  size = size||100;
  const total = segments.reduce((s,x)=>s+x.value,0) || 1;
  const r = size/2-6, c = 2*Math.PI*r;
  let acc = 0;
  const cx=size/2, cy=size/2;
  const arcs = segments.map(seg => {
    const frac = seg.value/total;
    const dash = frac*c;
    const el = '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+seg.color+'" stroke-width="12" '
      + 'stroke-dasharray="'+dash+' '+(c-dash)+'" stroke-dashoffset="'+(-acc)+'" transform="rotate(-90 '+cx+' '+cy+')"/>';
    acc += dash;
    return el;
  }).join('');
  return '<svg viewBox="0 0 '+size+' '+size+'" class="donut" style="width:'+size+'px;height:'+size+'px">'+arcs+'</svg>';
}
function lineChartMulti(series, w, h){ // [{name,color,values}]
  w=w||600; h=h||220;
  const all = series.flatMap(s=>s.values);
  const max = Math.max(...all,1), min = Math.min(...all,0);
  const range = (max-min)||1;
  const n = Math.max(...series.map(s=>s.values.length),1);
  const step = w/Math.max(n-1,1);
  const pad = 24;
  const lines = series.map(s => {
    const pts = s.values.map((v,i)=> (i*step) + ',' + (pad+(h-2*pad) - ((v-min)/range)*(h-2*pad))).join(' ');
    return '<polyline points="'+pts+'" fill="none" stroke="'+s.color+'" stroke-width="2.5"/>';
  }).join('');
  return '<svg viewBox="0 0 '+w+' '+h+'" class="linechart" preserveAspectRatio="none">'+lines+'</svg>';
}
function stackChart(rows, w, h){ // rows: [{label, segs:[{value,color}]}]
  w=w||600; h=h||220;
  const max = Math.max(...rows.map(r=>r.segs.reduce((s,x)=>s+x.value,0)),1);
  const bw = w/rows.length*0.6, gap = w/rows.length;
  let html = '<svg viewBox="0 0 '+w+' '+h+'" class="stackchart">';
  rows.forEach((r,i) => {
    let y = h;
    const total = r.segs.reduce((s,x)=>s+x.value,0);
    const barH = (total/max)*(h-20);
    let yTop = h-barH;
    r.segs.forEach(seg => {
      const segH = (seg.value/max)*(h-20);
      y -= segH;
      html += '<rect x="'+(i*gap+ (gap-bw)/2)+'" y="'+y+'" width="'+bw+'" height="'+segH+'" fill="'+seg.color+'"/>';
    });
  });
  html += '</svg>';
  return html;
}

global.GC.S = S;
global.GC.currentUser = currentUser;
global.GC.hasRight = hasRight;
global.GC.canSeeSection = canSeeSection;
global.GC.toast = toast;
global.GC.tableHTML = tableHTML;
global.GC.filtersHTML = filtersHTML;
global.GC.applyFilters = applyFilters;
global.GC.openModal = openModal;
global.GC.closeModal = closeModal;
global.GC.mField = mField;
global.GC.modalHTML = modalHTML;
global.GC.statusPill = statusPill;
global.GC.tagChips = tagChips;
global.GC.barBlock = barBlock;
global.GC.spark = spark;
global.GC.ring = ring;
global.GC.gauge = gauge;
global.GC.donut = donut;
global.GC.lineChartMulti = lineChartMulti;
global.GC.stackChart = stackChart;

})(typeof window !== 'undefined' ? window : globalThis);
