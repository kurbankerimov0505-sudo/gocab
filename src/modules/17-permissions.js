/* ===== 17. PERMISSIONS EDITOR (Настройки → Пользователи → «Изменить права») ===== */
(function(global){
'use strict';
const G = global.GC, U = G.Utils, E = G.ENUM;
const { esc } = U;
const S = G.S;

const RIGHT_DESC = {
  'Все разделы': 'Полный доступ ко всем 23 разделам приложения, минуя проверку по ролям.',
  'Водители': 'Просмотр и редактирование карточек водителей, баланс, теги, заметки.',
  'Автопарк': 'Просмотр и редактирование автомобилей, документов, статусов.',
  'Касса': 'Просмотр кассовых операций и создание новых проводок.',
  'Штрафы': 'Работа с реестром штрафов и выгрузками в банк.',
  'Рассрочка': 'Оформление и контроль рассрочек по удержаниям.',
  'Ремонты': 'Ведение наряд-заказов на ремонт по всем 7 фазам.',
  'Ремонты: склад': 'Выдача и учёт запчастей на складе автосервиса.',
  'Приём-выдача': 'Оформление актов приёма и выдачи автомобилей.',
  'Путевые листы': 'Выпуск на линию и журнал смен.',
  'Компенсации: запросы': 'Создание запросов на компенсацию водителю.',
  'Компенсации: одобрение': 'Одобрение или отклонение запросов на компенсацию.',
  'Справочники': 'Редактирование справочников (организации, банки, теги и т.д.).',
  'Пользователи': 'Управление учётными записями и правами доступа.'
};

function sectionGroups(){
  const groups = {};
  G.MENU.forEach(g => g.items.forEach(it => {
    groups[g.group] = groups[g.group] || [];
    if(!groups[g.group].includes(it.key)) groups[g.group].push(it.key);
  }));
  return groups;
}

function openRightsEditor(userId){
  const u = S.DB.users.find(x=>x.id===userId);
  if(!u) return;
  const groups = sectionGroups();
  const currentSections = G.ROLE_SECTIONS[u.appRole] || [];
  let body = '<div class="muted">Изменение прав пользователя <b>'+esc(u.name)+'</b> (роль доступа: '+esc(u.appRole)+').</div>';
  body += '<div><b>Функциональные права</b></div>';
  body += G.ENUM.RIGHTS.map(r => {
    const checked = u.rights.includes(r);
    return '<label class="m-field m-check"><input type="checkbox" data-right="'+esc(r)+'" '+(checked?'checked':'')+'> '
      + '<span><b>'+esc(r)+'</b><br><span class="muted">'+esc(RIGHT_DESC[r]||'')+'</span></span></label>';
  }).join('');
  body += '<div style="margin-top:10px"><b>Доступные разделы для роли «'+esc(u.appRole)+'»</b>'
    + '<div class="pill pill-warn" style="display:inline-block;margin-left:8px">Изменения применятся ко всем сотрудникам с этой ролью</div></div>';
  Object.keys(groups).forEach(g => {
    body += '<div class="muted" style="margin-top:6px">'+esc(g)+'</div>';
    groups[g].forEach(key => {
      const label = G.SECTION_LABEL[key] || key;
      const checked = currentSections.includes(key);
      const isDash = key==='dash';
      body += '<label class="m-field m-check"><input type="checkbox" data-section="'+esc(key)+'" '+(checked?'checked':'')+' '+(isDash?'disabled':'')+'> '
        + esc(label) + (isDash?' <span class="muted">(всегда включён)</span>':'') + '</label>';
    });
  });

  G.openModal({
    title: 'Изменить права', body,
    saveLabel:'Сохранить',
    onSave: () => {
      const modalEl = document.querySelector('.modal-card');
      if(!modalEl) return;
      const rights = Array.from(modalEl.querySelectorAll('[data-right]:checked')).map(el=>el.dataset.right);
      const sections = Array.from(modalEl.querySelectorAll('[data-section]:checked')).map(el=>el.dataset.section);
      if(!sections.includes('dash')) sections.push('dash');
      if(sections.length===0){ G.toast('Нельзя сохранить пустой список разделов'); return; }
      u.rights = rights.length ? rights : ['Водители'];
      G.ROLE_SECTIONS[u.appRole] = sections;
      G.toast('Права сохранены для роли «'+u.appRole+'»');
      G.closeModal();
    }
  });
}

Object.assign(G.ACTIONS, {
  'edit-rights': (t) => openRightsEditor(t.dataset.id)
});

global.GC.openRightsEditor = openRightsEditor;

})(typeof window !== 'undefined' ? window : globalThis);
