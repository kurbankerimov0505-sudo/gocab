/* ===== 20. I18N — flat RU-keyed dictionary + DOM text-walker.
   Loaded last so every RU string used anywhere above this file can be
   collected here. Views always render their literal Russian source text;
   applyI18n() runs after every render and swaps substrings in place for
   EN/FR, longest key first, respecting Cyrillic word boundaries (JS's \b
   is Latin-only, so a manual lookaround is used instead). Applied to text
   nodes plus placeholder/title/aria-label attributes, per spec §11.
   NOTE: this covers navigation, section/tab labels, enums, table headers
   and common UI chrome (~300 keys) rather than the full ~900 a production
   build would eventually accumulate — the engine below is what matters;
   growing the table is just adding entries. */
(function(global){
'use strict';
const G = global.GC;

const RU_EN = {
  // menu groups
  'Обзор':'Overview','Парк':'Fleet','Люди':'People','Деньги':'Money','Аналитика':'Analytics','Настройки':'Settings',
  // menu items / sections
  'Главное':'Dashboard','Диспетчерская':'Dispatch','Мои задачи':'My tasks','Уведомления':'Notifications',
  'Автопарк':'Vehicles','Автосервис':'Garage','Склад':'Warehouse','Приём-выдача':'Handover','Осмотры':'Inspections',
  'ДТП и страховые':'Incidents & insurance','Водители':'Drivers','Смены':'Shifts','Договоры':'Contracts',
  'Обращения':'Tickets','Импорт водителей':'Import drivers','Комментарии':'Comments','Банк и касса':'Cash desk',
  'Штрафы':'Fines','Депозиты и выплаты':'Deposits & payouts','Лизинг':'Leasing','Доходы и расходы':'P&L',
  'Отчеты':'Reports','Справочники':'References','Пользователи':'Users',
  // tabs
  'Карта':'Map','Все':'All','Документы':'Documents','Финансы':'Finance',
  'Список водителей':'Driver list','Дубли':'Duplicates',
  'Список автомобилей':'Vehicle list','Парк построчно':'Vehicle cards',
  'Наряд-заказы':'Work orders','Календарь записи':'Booking calendar','Посты и загрузка':'Bays & load',
  'Склад запчастей':'Parts stock','Эффективность':'Efficiency',
  'Акты приёма-выдачи':'Handover acts','Новый акт':'New act',
  'Журнал смен':'Shift log','Выпуск на линию':'Release to line',
  'Журнал осмотров':'Inspection log','Тарифы повреждений':'Damage tariffs',
  'Реестр случаев':'Case registry',
  'Касса':'Cash desk','Рассрочка':'Instalments','Заказы':'Orders','История':'History','Компенсации':'Compensations',
  'Финансовый обзор':'Financial overview',
  'Реестр штрафов':'Fine registry','Выгрузки в банк':'Bank exports',
  'Депозиты':'Deposits','Моментальные выплаты':'Instant payouts',
  'Электронные документы':'E-documents',
  'Договоры лизинга':'Lease contracts','График платежей':'Payment schedule',
  'Операции':'Entries','План и факт':'Plan vs actual',
  'Рассылки':'Mailings','Загрузка файла':'File upload','История загрузок':'Upload history',
  'Сводка':'Summary','Подразделения':'Branches','Задолженность по дням':'Debt by day',
  'Собираемость':'Collection','KPI менеджеров':'Manager KPI','Светофор':'Traffic light',
  'Организации':'Organisations','Диспетчерские':'Dispatch units','Терминалы':'Terminals','Банки':'Banks',
  'Компенсации причины':'Compensation reasons','Страховые компании':'Insurers','Теги':'Tags',
  'Все комментарии':'All comments',
  // roles
  'Кантри-менеджер':'Country manager','Менеджер парка':'Fleet manager','Приёмщик на ремонт':'Service advisor',
  'Механик':'Mechanic','Кладовщик':'Storekeeper','Водитель':'Driver','Диспетчер':'Dispatcher',
  // statuses / enums
  'Работает':'Active','В отпуске':'On leave','Заблокирован':'Blocked','Уволен':'Dismissed','Нет аккаунта':'No account',
  'Штатный':'Staff','Самозанятый':'Self-employed','ИП':'Sole proprietor',
  'Баланс':'Balance','Баланс Яндекс':'Yandex balance','Баланс штрафов':'Fines balance','Баланс повреждений':'Damage balance',
  'Пополнение':'Credit','Списание':'Debit',
  'Личный кабинет':'Driver app','Терминал':'Terminal','Менеджер':'Manager','Система по расписанию':'Scheduled system',
  'Критично':'Critical','Высокий':'High','Обычный':'Normal',
  'В работе':'In service','На сервисе':'In garage','Свободен':'Free','Списан':'Written off',
  'Не оплачен':'Unpaid','Оплачен':'Paid','Оспаривается':'Disputed',
  'На одобрении':'Pending','Одобрено':'Approved','Отказано':'Rejected',
  'Открыта':'Open','Закрыта':'Closed','Просрочена':'Overdue',
  'Подписан':'Signed','Ожидает подписи':'Awaiting signature','Истёк':'Expired',
  'Выплачена':'Paid out','На проверке':'Under review','Отклонена':'Declined',
  'Записан':'Booked','Приёмка в гараже':'Garage intake','Работы и запчасти':'Jobs & parts',
  'Выдача запчастей':'Parts handout','В ремонте':'In repair','Проверка перед выдачей':'Pre-release check',
  'Готова после ремонта':'Ready after repair',
  // common chrome
  'Фильтр':'Filter','Фильтры':'Filters','Сбросить':'Reset','Применить':'Apply','Закрыть':'Close','Сохранить':'Save',
  'Отмена':'Cancel','Создать':'Create','Показано':'Showing','из':'of','Нет данных':'No data',
  'Добавить':'Add','Карточка':'Card','Оплатить':'Pay','Одобрить':'Approve','Отказать':'Reject',
  'Изменить права':'Edit permissions','Не дубль':'Not a duplicate','Объединить':'Merge',
  'Раздел в разработке':'Section under construction','Ошибка отображения':'Render error',
  // dashboard / stat tiles
  'Водители активных':'active drivers','всего':'total','план':'plan','среднее достижение':'average achievement',
  'требуют внимания':'need attention','с отрицательным балансом':'with a negative balance',
  'завершено':'completed','в работе':'in service',
  'Собираемость аренды':'Rent collection','Утилизация автопарка':'Fleet utilisation','Простой автопарка':'Fleet idle time',
  'Собираемость штрафов':'Fine collection','Долги уволенных водителей':'Departed-driver debt',
  'Автопарк по филиалам':'Fleet by branch','Долг по аренде':'Rent debt','Ремонты в работе':'Open repairs',
  'KPI менеджеров':'Manager KPI',
  // table headers commonly reused
  'ФИО':'Full name','Телефон':'Phone','Статус':'Status','Авто':'Vehicle','Филиал':'Branch',
  'Госномер':'Plate','Модель':'Model','Год':'Year','Пробег':'Mileage',
  'Нарушение':'Violation','Дата':'Date','Сумма':'Amount',
  'Источник':'Source','Тип':'Type','Интерфейс':'Interface','Было':'Before','Стало':'After',
  'Вид':'Kind','Всего':'Total','Остаток':'Left','В день':'Per day',
  'Причина':'Reason','Комментарий':'Comment','Слот':'Slot','Приоритет':'Priority','Артикул':'SKU','Название':'Name',
  'Поставщик':'Supplier','Цена':'Price','Зона':'Zone','Тип повреждения':'Damage type',
  'Кем':'By whom','Повреждения':'Damage','Подписан ':'Signed ','Начало':'Start','Конец':'End','Часы':'Hours',
  'Выручка':'Revenue','Путевой лист':'Waybill','Тема':'Subject','Ответственный':'Owner',
  'Кто':'Who','Объект':'Object','Поле':'Field',
  'Оклад + бонус':'Base + bonus','Бонус':'Bonus','Списано':'Written off',
  'Не заводится':'Won’t start','Прочее':'Other','Шиномонтаж':'Tyres','Электрика':'Electrics','Кондиционер':'A/C','Кузов':'Body shop',
  'Слесарные работы':'Mechanical work','Плановое ТО':'Scheduled service',
  // frequent words inside dynamically-composed dashboard strings
  'машин':'vehicles','водителей':'drivers','активных':'active','всего':'total',
  'наряд-заказов':'work orders','водитель':'driver','дн.':'d.','дней':'days','дня':'days',
  'просрочено':'overdue','месяцам':'months','по месяцам':'by month'
};

const RU_FR = {
  'Обзор':'Aperçu','Парк':'Parc','Люди':'Personnel','Деньги':'Finances','Аналитика':'Analytique','Настройки':'Paramètres',
  'Главное':'Tableau de bord','Диспетчерская':'Répartition','Мои задачи':'Mes tâches','Уведомления':'Notifications',
  'Автопарк':'Véhicules','Автосервис':'Atelier','Склад':'Entrepôt','Приём-выдача':'Remise','Осмотры':'Inspections',
  'ДТП и страховые':'Sinistres & assurances','Водители':'Chauffeurs','Смены':'Vacations','Договоры':'Contrats',
  'Обращения':'Tickets','Импорт водителей':'Import chauffeurs','Комментарии':'Commentaires','Банк и касса':'Caisse',
  'Штрафы':'Amendes','Депозиты и выплаты':'Dépôts & versements','Лизинг':'Location','Доходы и расходы':'Résultat',
  'Отчеты':'Rapports','Справочники':'Référentiels','Пользователи':'Utilisateurs',
  'Карта':'Carte','Все':'Tous','Документы':'Documents','Финансы':'Finances',
  'Список водителей':'Liste des chauffeurs','Дубли':'Doublons',
  'Список автомобилей':'Liste des véhicules','Парк построчно':'Fiches véhicule',
  'Наряд-заказы':'Ordres de réparation','Календарь записи':'Calendrier','Посты и загрузка':'Postes & charge',
  'Склад запчастей':'Stock pièces','Эффективность':'Efficacité',
  'Акты приёма-выдачи':'Procès-verbaux','Новый акт':'Nouveau P-V',
  'Журнал смен':'Registre des vacations','Выпуск на линию':'Mise en service',
  'Журнал осмотров':'Registre d’inspections','Тарифы повреждений':'Tarifs dommages',
  'Реестр случаев':'Registre des sinistres',
  'Касса':'Caisse','Рассрочка':'Échelonnement','Заказы':'Commandes','История':'Historique','Компенсации':'Compensations',
  'Финансовый обзор':'Aperçu financier',
  'Реестр штрафов':'Registre des amendes','Выгрузки в банк':'Exports bancaires',
  'Депозиты':'Dépôts','Моментальные выплаты':'Versements instantanés',
  'Электронные документы':'Documents électroniques',
  'Договоры лизинга':'Contrats de location','График платежей':'Échéancier',
  'Операции':'Écritures','План и факт':'Prévu vs réel',
  'Рассылки':'Campagnes','Загрузка файла':'Téléversement','История загрузок':'Historique des imports',
  'Сводка':'Résumé','Подразделения':'Filiales','Задолженность по дням':'Dette par jour',
  'Собираемость':'Recouvrement','KPI менеджеров':'KPI des managers','Светофор':'Feu tricolore',
  'Организации':'Organisations','Диспетчерские':'Unités de répartition','Терминалы':'Terminaux','Банки':'Banques',
  'Компенсации причины':'Motifs de compensation','Страховые компании':'Assureurs','Теги':'Étiquettes',
  'Все комментарии':'Tous les commentaires',
  'Кантри-менеджер':'Directeur pays','Менеджер парка':'Responsable de parc','Приёмщик на ремонт':'Réceptionnaire',
  'Механик':'Mécanicien','Кладовщик':'Magasinier','Водитель':'Chauffeur','Диспетчер':'Répartiteur',
  'Работает':'Actif','В отпуске':'En congé','Заблокирован':'Bloqué','Уволен':'Licencié','Нет аккаунта':'Sans compte',
  'Штатный':'Salarié','Самозанятый':'Indépendant','ИП':'Entrepreneur',
  'Баланс':'Solde','Баланс Яндекс':'Solde Yandex','Баланс штрафов':'Solde amendes','Баланс повреждений':'Solde dommages',
  'Пополнение':'Crédit','Списание':'Débit',
  'Личный кабинет':'Appli chauffeur','Терминал':'Terminal','Менеджер':'Manager','Система по расписанию':'Système planifié',
  'Критично':'Critique','Высокий':'Élevé','Обычный':'Normal',
  'В работе':'En service','На сервисе':'En atelier','Свободен':'Disponible','Списан':'Radié',
  'Не оплачен':'Impayée','Оплачен':'Payée','Оспаривается':'Contestée',
  'На одобрении':'En attente','Одобрено':'Approuvé','Отказано':'Refusé',
  'Открыта':'Ouverte','Закрыта':'Fermée','Просрочена':'En retard',
  'Подписан':'Signé','Ожидает подписи':'En attente de signature','Истёк':'Expiré',
  'Выплачена':'Versée','На проверке':'En vérification','Отклонена':'Rejetée',
  'Записан':'Planifié','Приёмка в гараже':'Réception atelier','Работы и запчасти':'Travaux & pièces',
  'Выдача запчастей':'Remise des pièces','В ремонте':'En réparation','Проверка перед выдачей':'Contrôle final',
  'Готова после ремонта':'Prête après réparation',
  'Фильтр':'Filtre','Фильтры':'Filtres','Сбросить':'Réinitialiser','Применить':'Appliquer','Закрыть':'Fermer','Сохранить':'Enregistrer',
  'Отмена':'Annuler','Создать':'Créer','Показано':'Affiché','из':'sur','Нет данных':'Aucune donnée',
  'Добавить':'Ajouter','Карточка':'Fiche','Оплатить':'Payer','Одобрить':'Approuver','Отказать':'Refuser',
  'Изменить права':'Modifier les droits','Не дубль':'Pas un doublon','Объединить':'Fusionner',
  'Раздел в разработке':'Section en construction','Ошибка отображения':'Erreur d’affichage',
  'Собираемость аренды':'Recouvrement des loyers','Утилизация автопарка':'Utilisation du parc','Простой автопарка':'Immobilisation du parc',
  'Собираемость штрафов':'Recouvrement des amendes','Долги уволенных водителей':'Dette des chauffeurs partis',
  'Автопарк по филиалам':'Parc par filiale','Долг по аренде':'Dette de loyer','Ремонты в работе':'Réparations en cours',
  'ФИО':'Nom complet','Телефон':'Téléphone','Статус':'Statut','Авто':'Véhicule','Филиал':'Filiale',
  'Госномер':'Plaque','Модель':'Modèle','Год':'Année','Пробег':'Kilométrage',
  'Нарушение':'Infraction','Дата':'Date','Сумма':'Montant',
  'Источник':'Source','Тип':'Type','Интерфейс':'Interface','Было':'Avant','Стало':'Après',
  'Вид':'Genre','Всего':'Total','Остаток':'Restant','В день':'Par jour',
  'Причина':'Motif','Комментарий':'Commentaire','Слот':'Créneau','Приоритет':'Priorité','Артикул':'Référence','Название':'Nom',
  'Поставщик':'Fournisseur','Цена':'Prix','Зона':'Zone','Тип повреждения':'Type de dommage',
  'Кем':'Par','Повреждения':'Dommages','Начало':'Début','Конец':'Fin','Часы':'Heures',
  'Выручка':'Recette','Путевой лист':'Feuille de route','Тема':'Sujet','Ответственный':'Responsable',
  'Кто':'Qui','Объект':'Objet','Поле':'Champ',
  'Оклад + бонус':'Salaire + prime','Бонус':'Prime','Списано':'Radié',
  'Не заводится':'Ne démarre pas','Прочее':'Autre','Шиномонтаж':'Pneus','Электрика':'Électricité','Кондиционер':'Clim','Кузов':'Carrosserie',
  'Слесарные работы':'Travaux mécaniques','Плановое ТО':'Entretien planifié',
  'машин':'véhicules','водителей':'chauffeurs','активных':'actifs','всего':'au total',
  'наряд-заказов':'ordres de réparation','водитель':'chauffeur','дн.':'j.','дней':'jours','дня':'jours',
  'просрочено':'en retard','месяцам':'mois','по месяцам':'par mois'
};

function escapeRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

const CACHE = {};
function getMatcher(lang){
  if(CACHE[lang]) return CACHE[lang];
  const dict = lang==='en' ? RU_EN : (lang==='fr' ? RU_FR : null);
  if(!dict) return null;
  const keys = Object.keys(dict).sort((a,b)=> b.length-a.length).map(escapeRe);
  // Cyrillic-aware boundary: JS \b only recognises [A-Za-z0-9_], so a
  // Cyrillic word like "Работает" would otherwise get clipped mid-string
  // by a naive \b (or not bounded at all) — use an explicit lookaround
  // against the Cyrillic letter range instead.
  const re = new RegExp('(?<![А-Яа-яЁё])(?:' + keys.join('|') + ')(?![А-Яа-яЁё])', 'g');
  const matcher = { re, dict };
  CACHE[lang] = matcher;
  return matcher;
}

function translate(str, matcher){
  if(!str || !matcher) return str;
  if(!/[А-Яа-яЁё]/.test(str)) return str;
  return str.replace(matcher.re, (m) => matcher.dict[m] !== undefined ? matcher.dict[m] : m);
}

function applyI18n(){
  const S = G.S;
  const matcher = getMatcher(S.lang);
  const root = document.getElementById('app');
  if(!root) return;
  if(!matcher) return; // ru: nothing to do, views already render RU natively

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const textNodes = [];
  let n;
  while((n = walker.nextNode())) textNodes.push(n);
  textNodes.forEach(node => {
    const t = translate(node.nodeValue, matcher);
    if(t !== node.nodeValue) node.nodeValue = t;
  });

  const attrSel = '[placeholder],[title],[aria-label]';
  root.querySelectorAll(attrSel).forEach(el => {
    ['placeholder','title','aria-label'].forEach(attr => {
      const v = el.getAttribute(attr);
      if(v){ const t = translate(v, matcher); if(t!==v) el.setAttribute(attr, t); }
    });
  });
}

global.GC.applyI18n = applyI18n;
global.GC.I18N = { en: RU_EN, fr: RU_FR };

})(typeof window !== 'undefined' ? window : globalThis);
