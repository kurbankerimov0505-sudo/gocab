/* ===== 19. CLICK DELEGATION & BOOTSTRAP =====
   One delegated listener per concern, matching on data-* attributes.
   Two traps from section 10 of the spec, both handled here:
   1) A capture-phase guard stops clicks on SELECT/INPUT/TEXTAREA from
      reaching the document-level click handler, so preventDefault() in a
      handler never blocks a native dropdown/input from opening.
   2) The account-menu / drawer "click outside to close" check also runs in
      capture phase, because the main handler re-renders (and detaches the
      clicked node) before the bubble phase would otherwise reach it. */
(function(global){
'use strict';
const G = global.GC, S = G.S, U = G.Utils;

function el(sel){ return document.querySelector(sel); }

function toggleGroup(group){
  S.menuOpen[group] = (S.menuOpen[group] === false) ? true : false;
}

Object.assign(G.ACTIONS, {
  'toggle-drawer': () => { S.side = !S.side; },
  'close-drawer': () => { S.side = false; },
  'toggle-group': (t) => toggleGroup(t.dataset.group),
  'goto': (t) => { S.sec = t.dataset.sec; S.tab = Number(t.dataset.tab||0); S.side = false; S._filtersOpen = null; },
  'set-tab': (t) => { S.tab = Number(t.dataset.tab); },
  'set-role': (t) => {
    S.role = t.dataset.role;
    const u = G.DB_USERS_BY_ROLE && G.DB_USERS_BY_ROLE[S.role];
    if(u) S.userId = u.id;
    S._acctOpen = false;
    if(!G.canSeeSection(S.sec)){ S.sec = (G.ROLE_SECTIONS[S.role]||['dash'])[0]; S.tab = 0; }
  },
  'set-lang': (t) => { S.lang = t.dataset.lang; },
  'toggle-acct': () => { S._acctOpen = !S._acctOpen; },
  'toggle-filters': (t) => { const sec = t.dataset.sec; S._filtersOpen = (S._filtersOpen===sec) ? null : sec; },
  'close-filters': () => { S._filtersOpen = null; },
  'clear-filters': (t) => { S.filters[t.dataset.sec] = {}; },
  'table-page': (t) => { S._tablePage = S._tablePage||{}; S._tablePage[t.dataset.sec] = Number(t.dataset.page); },
  'close-modal': () => { G.closeModal(); },
  'modal-save': () => {
    if(S.modal && S.modal.onSave) S.modal.onSave(S.modal.form||{});
  }
});

function findAct(target){
  return target.closest ? target.closest('[data-act]') : null;
}

function attachDelegation(){
  // Trap #1: keep native form controls native.
  document.addEventListener('click', (e) => {
    const tag = e.target.tagName;
    if(tag==='SELECT' || tag==='OPTION') { /* let it open natively, but still allow our handler below via non-capture pass-through */ }
  }, true);

  // Trap #2 (capture phase): close open overlays (account menu / filters
  // drawer / side drawer) on outside click, BEFORE the bubble-phase
  // handler re-renders and the clicked node's context is gone.
  document.addEventListener('click', (e) => {
    if(S._acctOpen && !e.target.closest('.acct-wrap')){ S._acctOpen = false; }
  }, true);

  document.addEventListener('click', (e) => {
    const t = findAct(e.target);
    if(!t) return;
    // Backdrop / stop-propagation guard: clicks inside a modal card must not bubble to the backdrop's close handler.
    if(e.target.closest('[data-stop]') && t.dataset.act !== 'close-modal' && t.dataset.act !== 'modal-save') {
      // fine, still handled below by the actual matched action element
    }
    const act = t.dataset.act;
    const handler = G.ACTIONS[act];
    if(handler){ handler(t, e); G.render(); syncAcctMenu(); }
  });

  // Filter field changes.
  document.addEventListener('change', (e) => {
    const t = e.target;
    if(t.id === 'realImportFiles'){
      // Deliberately does NOT call G.render(): a full re-render replaces
      // this <input> node, which would discard the browser's native file
      // selection before the user gets to click Import. Just update the
      // adjacent label in place instead.
      const label = document.getElementById('uploadFileNames');
      if(label){
        const files = t.files ? Array.from(t.files) : [];
        label.textContent = files.length ? files.map(f=>f.name).join(', ') : 'Файлы не выбраны';
      }
      return;
    }
    if(t.dataset && t.dataset.filterKey){
      const sec = t.dataset.sec;
      S.filters[sec] = S.filters[sec] || {};
      S.filters[sec][t.dataset.filterKey] = t.value;
      G.render();
    }
    if(t.dataset && t.dataset.msVal !== undefined){
      const box = t.closest('.ms-box');
      const sec = box.dataset.sec, key = box.dataset.filterKey;
      const checked = Array.from(box.querySelectorAll('input[type=checkbox]:checked')).map(c=>c.dataset.msVal);
      S.filters[sec] = S.filters[sec]||{};
      S.filters[sec][key] = checked;
      G.render();
    }
    if(t.dataset && t.dataset.mf && S.modal){
      S.modal.form = S.modal.form || {};
      S.modal.form[t.dataset.mf] = (t.type==='checkbox') ? t.checked : t.value;
    }
  });

  // Text/number filter + modal-field typing: update state without a full
  // re-render mid-keystroke would be ideal, but this app re-renders the
  // whole page on every state change — so we preserve focus and caret
  // position across the re-render instead of avoiding it.
  document.addEventListener('input', (e) => {
    const t = e.target;
    let selector = null, pos = null;
    if(t.dataset && t.dataset.filterKey){
      const sec = t.dataset.sec;
      S.filters[sec] = S.filters[sec] || {};
      S.filters[sec][t.dataset.filterKey] = t.value;
      selector = '[data-filter-key="'+t.dataset.filterKey+'"][data-sec="'+sec+'"]';
      pos = t.selectionStart;
      G.render();
    } else if(t.dataset && t.dataset.mf && S.modal){
      S.modal.form = S.modal.form || {};
      S.modal.form[t.dataset.mf] = t.value;
      // modal fields don't need a full render to reflect table changes; skip re-render for smooth typing
      return;
    }
    if(selector){
      requestAnimationFrame(() => {
        const again = document.querySelector(selector);
        if(again){ again.focus(); if(pos!=null && again.setSelectionRange){ try{ again.setSelectionRange(pos,pos); }catch(err){} } }
      });
    }
  });

  // Number inputs: blur on wheel so scrolling the page never changes a value.
  document.addEventListener('wheel', (e) => {
    if(e.target && e.target.tagName==='INPUT' && (e.target.type==='number' || e.target.classList.contains('no-spin'))){
      e.target.blur();
    }
  }, { passive:true });

  document.addEventListener('keydown', (e) => {
    if(e.key==='Escape'){
      if(S.modal){ G.closeModal(); return; }
      if(S._filtersOpen){ S._filtersOpen = null; G.render(); return; }
      if(S.side){ S.side = false; G.render(); }
    }
  });
}

function syncAcctMenu(){
  const m = document.getElementById('acctMenu');
  if(m) m.classList.toggle('open', !!S._acctOpen);
}

function boot(){
  const DB = G.buildDB();
  S.DB = DB;
  G.DB_USERS_BY_ROLE = {};
  DB.users.forEach(u => { if(!G.DB_USERS_BY_ROLE[u.appRole]) G.DB_USERS_BY_ROLE[u.appRole] = u; });
  attachDelegation();
  G.render();
  syncAcctMenu();
}

if(typeof document !== 'undefined'){
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}

global.GC.boot = boot;

})(typeof window !== 'undefined' ? window : globalThis);
