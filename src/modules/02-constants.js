/* ===== 02. BUSINESS CONSTANTS & ENUMERATIONS ===== */
(function(global){
'use strict';

const CONST = {
  RATE: 120,
  IDLE: 320,
  TO_KM: 9000,
  DEBT_LIMIT_DAYS: 4,
  DEPOSIT_DAYS: 5,
  DEP_TARGET: 1500,
  FIX_PAY: 6000,
  BONUS: 9000,
  FINE_NONRETURN: 1500,
  PERIOD: 30,
  CDAYS: 30,
  AF: { maxCost: 900, maxDur: 150, minDur: 3, maxPerHour: 6 }
};

const ENUM = {
  STATUS:  ['Работает','В отпуске','Заблокирован','Уволен'],
  YSTATUS: ['Работает','Заблокирован','Нет аккаунта'],
  FORMS:   ['Штатный','Самозанятый','ИП'],
  SOURCES: ['Баланс','Баланс Яндекс','Баланс штрафов','Баланс повреждений'],
  OPTYPES: ['Пополнение','Списание'],
  IFACES:  ['Личный кабинет','Терминал','Менеджер','Система по расписанию'],
  MODELS:  ['Bestune B70','Bestune T55','Bestune T77','MG5','Dacia Logan',
            'Dacia Sandero','Renault Logan','Hyundai Accent'],
  PRIO:    ['Критично','Высокий','Обычный'],
  VIOL:    ['Превышение скорости','Стоянка в запрещённом месте','Проезд на красный',
            'Ремень безопасности','Телефон за рулём','Разметка','Тонировка'],
  CAR_STATUS: ['В работе','На сервисе','Свободен','Списан','Изъят'],
  FINE_STATUS: ['Не оплачен','Оплачен','Оспаривается'],
  COMP_STATUS: ['На одобрении','Одобрено','Отказано'],
  SHIFT_STATUS: ['Открыта','Закрыта','Просрочена'],
  CONTRACT_STATUS: ['Подписан','Ожидает подписи','Истёк'],
  PAYOUT_STATUS: ['Выплачена','На проверке','Отклонена'],
  REPAIR_PHASES: ['Записан','Приёмка в гараже','Работы и запчасти','Выдача запчастей',
                  'В ремонте','Проверка перед выдачей','Готова после ремонта'],
  REPAIR_PHASE_OWNER: ['Приёмщик на ремонт','Приёмщик + водитель','Механик','Кладовщик','Механик','Приёмщик на ремонт','—'],
  REPAIR_PHASE_SLA_H: [2,1,24,48,48,12,0],
  ROLES: ['Кантри-менеджер','Менеджер парка','Приёмщик на ремонт','Механик','Кладовщик','Водитель','Диспетчер'],
  RIGHTS: ['Все разделы','Водители','Автопарк','Касса','Штрафы','Рассрочка','Ремонты','Ремонты: склад',
           'Приём-выдача','Путевые листы','Компенсации: запросы','Компенсации: одобрение',
           'Справочники','Пользователи'],
  AKPP: ['АКПП','МКПП']
};

// Sections controlled by role -> which of the 23 menu sections a role can see
const ROLE_SECTIONS = {
  'Кантри-менеджер': ['dash','dispatch','tasks','notif','cars','repairs','handover','shifts','inspections',
    'incidents','drivers','contracts','tickets','import','comments','mgmt','fines','deposits','leasing',
    'pnl','stats','refs','users'],
  'Менеджер парка': ['dash','dispatch','tasks','notif','cars','repairs','handover','shifts','inspections',
    'incidents','drivers','contracts','tickets','import','comments','mgmt','fines','deposits','leasing',
    'pnl','stats'],
  'Приёмщик на ремонт': ['dash','tasks','repairs','handover','cars','shifts','inspections','incidents'],
  'Механик': ['dash','tasks','repairs','cars','inspections'],
  'Кладовщик': ['dash','tasks','repairs'],
  'Водитель': ['dash','tasks','repairs'],
  'Диспетчер': ['dash','dispatch','drivers','cars','notif','tasks','shifts','tickets','comments']
};

// Map arbitrary job titles to access role
const TITLE_TO_ROLE = {
  'Руководитель страны': 'Кантри-менеджер',
  'Финансовый контролёр': 'Менеджер парка',
  'Старший диспетчер': 'Диспетчер'
};

global.GC = global.GC || {};
global.GC.CONST = CONST;
global.GC.ENUM = ENUM;
global.GC.ROLE_SECTIONS = ROLE_SECTIONS;
global.GC.TITLE_TO_ROLE = TITLE_TO_ROLE;

})(typeof window !== 'undefined' ? window : globalThis);
