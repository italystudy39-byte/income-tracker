/* ==========================================================
   Income Tracker — Road to 120 Million UZS
   Этап 1: ядро приложения (данные, расчёты, интерфейс)
   Все суммы хранятся и считаются в целых сумах (integer).
   ========================================================== */
'use strict';

/* ---------- Конфигурация ---------- */
const CONFIG = Object.freeze({
  goal: 120000000,
  startBalance: 0,
  startDate: '2026-10-12',
  endDate: '2028-01-01',
  currency: 'сум',
  storageKey: 'incomeTracker.v1',
  maxAmount: 1000000000000, // 1 трлн — защита от опечаток
  milestones: [10000000, 25000000, 50000000, 75000000, 100000000, 120000000],
});

const CATEGORIES = [
  { id: 'freelance', name: 'Фриланс', color: '#00E5A8', icon: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>' },
  { id: 'web', name: 'Разработка сайтов', color: '#4C9AFF', icon: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>' },
  { id: 'ai', name: 'AI-разработка', color: '#A78BFA', icon: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>' },
  { id: 'telegram', name: 'Telegram-боты', color: '#22D3EE', icon: '<path d="M21 3L3 10.5l7 2.5 2.5 7z"/><path d="M10 13L21 3"/>' },
  { id: 'youtube', name: 'YouTube', color: '#FF5C7A', icon: '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9l5 3-5 3z"/>' },
  { id: 'saas', name: 'SaaS', color: '#FFC24B', icon: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>' },
  { id: 'other', name: 'Другое', color: '#94A3B8', icon: '<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>' },
];
const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WEEKDAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

const PAGE_TITLES = {
  dashboard: 'Главная', incomes: 'Доходы', analytics: 'Аналитика',
  calendar: 'Календарь', goals: 'Цели', settings: 'Настройки',
};

/* ---------- Утилиты ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const NBSP = ' ';

/** 12500000 → "12 500 000" (только целые числа) */
function formatNumber(n) {
  const sign = n < 0 ? '-' : '';
  return sign + String(Math.abs(Math.trunc(n))).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}
/** 12500000 → "12 500 000 сум" */
function formatMoney(n) { return formatNumber(n) + NBSP + CONFIG.currency; }

/** Короткий формат для календаря/графиков: 2 500 000 → "2,5 млн" */
function formatCompact(n) {
  const abs = Math.abs(n);
  const fmt = (v) => (Math.round(v * 10) / 10).toString().replace('.', ',');
  if (abs >= 1e9) return fmt(n / 1e9) + ' млрд';
  if (abs >= 1e6) return fmt(n / 1e6) + ' млн';
  if (abs >= 1e3) return fmt(n / 1e3) + ' тыс';
  return String(n);
}

/** Проценты из базисных пунктов: 1234 → "12,34%" */
function formatBp(bp) {
  const whole = Math.floor(bp / 100);
  const frac = String(bp % 100).padStart(2, '0');
  return `${whole},${frac}%`;
}

/** "2 500 000", "2500000 сум" → 2500000; иначе NaN */
function parseAmount(value) {
  const digits = String(value).replace(/[\s ]/g, '').replace(/сум$/i, '');
  if (!/^\d+$/.test(digits)) return NaN;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : NaN;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/* --- Даты: работаем со строками YYYY-MM-DD и UTC-днями, чтобы не ловить сдвиги часовых поясов --- */
const DAY_MS = 86400000;
const pad2 = (n) => String(n).padStart(2, '0');

function isValidISODate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
function isoToDay(s) { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) / DAY_MS; }
function dayToISO(day) { const d = new Date(day * DAY_MS); return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`; }
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function daysBetween(a, b) { return isoToDay(b) - isoToDay(a); }
const ETA_MAX_DAYS = 36525; // 100 лет: дальше прогноз даты не показываем
function addDaysISO(s, n) { return dayToISO(isoToDay(s) + n); }
function formatDate(s) { const [y, m, d] = s.split('-'); return `${d}.${m}.${y}`; }
function formatDateLong(s) { const [y, m, d] = s.split('-').map(Number); return `${d} ${MONTHS_GEN[m - 1]} ${y}`; }
function weekdayName(s) { return WEEKDAYS[new Date(isoToDay(s) * DAY_MS).getUTCDay()]; }
function monthKey(s) { return s.slice(0, 7); }
function monthLabel(key) { const [y, m] = key.split('-').map(Number); return `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`; }
function monthKeysBetween(fromKey, toKey) {
  const keys = [];
  let [y, m] = fromKey.split('-').map(Number);
  const [ty, tm] = toKey.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    keys.push(`${y}-${pad2(m)}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return keys;
}

const TOTAL_DAYS = daysBetween(CONFIG.startDate, CONFIG.endDate); // 446

/* ==========================================================
   Хранилище (LocalStorage)
   ========================================================== */
const Store = {
  key: CONFIG.storageKey,
  backupKey: CONFIG.storageKey + '.backup',
  available: true,
  lastSavedAt: null,

  fresh() {
    return {
      version: 1,
      incomes: [],
      milestonesReached: [],
      ext: {}, // данные расширений (этап 2+)
      meta: { createdAt: new Date().toISOString(), updatedAt: null },
    };
  },

  /** Проверка и нормализация одной операции. Возвращает объект или null. */
  normalizeIncome(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const amount = typeof raw.amount === 'number' ? raw.amount : parseAmount(raw.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > CONFIG.maxAmount) return null;
    if (!isValidISODate(raw.date)) return null;
    const category = CATEGORY_MAP[raw.category] ? raw.category : 'other';
    const source = String(raw.source ?? '').trim().slice(0, 120);
    if (!source) return null;
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
      amount,
      date: raw.date,
      category,
      source,
      comment: String(raw.comment ?? '').trim().slice(0, 500),
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
    };
  },

  /** Проверяет структуру состояния. Бросает ошибку при некорректных данных. */
  validate(data) {
    if (!data || typeof data !== 'object' || !Array.isArray(data.incomes)) {
      throw new Error('Неверный формат данных');
    }
    const incomes = [];
    const seen = new Set();
    data.incomes.forEach((raw, i) => {
      const inc = this.normalizeIncome(raw);
      if (!inc) throw new Error(`Некорректная операция №${i + 1}`);
      if (seen.has(inc.id)) inc.id = uid();
      seen.add(inc.id);
      incomes.push(inc);
    });
    const state = this.fresh();
    state.incomes = incomes;
    state.milestonesReached = Array.isArray(data.milestonesReached)
      ? data.milestonesReached.filter(v => CONFIG.milestones.includes(v)) : [];
    state.ext = data.ext && typeof data.ext === 'object' ? data.ext : {};
    if (data.meta && typeof data.meta === 'object') Object.assign(state.meta, data.meta);
    return state;
  },

  load() {
    let raw = null;
    try {
      raw = localStorage.getItem(this.key);
    } catch (e) {
      this.available = false;
      return { state: this.fresh(), warning: 'LocalStorage недоступен: данные не будут сохраняться между сессиями.' };
    }
    if (raw === null) return { state: this.fresh() };
    try {
      return { state: this.validate(JSON.parse(raw)) };
    } catch (e) {
      // Не затираем повреждённые данные: откладываем их в отдельный ключ
      const corruptKey = `${this.key}.corrupt.${Date.now()}`;
      try { localStorage.setItem(corruptKey, raw); } catch (_) { /* ignore */ }
      // Пытаемся восстановиться из последней удачной копии
      try {
        const backup = localStorage.getItem(this.backupKey);
        if (backup) {
          const state = this.validate(JSON.parse(backup));
          return { state, restored: true, warning: 'Основные данные повреждены — восстановлена последняя резервная копия.' };
        }
      } catch (_) { /* ignore */ }
      return { state: this.fresh(), warning: `Сохранённые данные повреждены и отложены (${corruptKey}). Импортируйте резервную копию.` };
    }
  },

  save(state) {
    if (!this.available) return false;
    try {
      state.meta.updatedAt = new Date().toISOString();
      const json = JSON.stringify(state);
      localStorage.setItem(this.key, json);
      // зеркальная копия последнего удачного сохранения — на случай повреждения основного ключа
      try { localStorage.setItem(this.backupKey, json); } catch (_) { /* основной ключ уже сохранён */ }
      this.lastSavedAt = new Date();
      return true;
    } catch (e) {
      toast('error', 'Ошибка сохранения', 'Не удалось сохранить данные. Возможно, хранилище переполнено. Сделайте экспорт.');
      return false;
    }
  },
};

/* ==========================================================
   Состояние приложения и расчёты
   ========================================================== */
const App = {
  state: null,
  ui: {
    page: 'dashboard',
    history: { query: '', category: '', sortKey: 'date', sortDir: 'desc' },
    calendar: { year: 2026, month: 9, selected: null },
  },
  renderers: [],   // дополнительные функции отрисовки (этап 2+)
  charts: {},

  /** Регистрация расширения: fn(stats) вызывается при каждом обновлении данных */
  onRender(fn) { this.renderers.push(fn); },

  get incomes() { return this.state.incomes; },

  total() {
    return this.state.incomes.reduce((sum, i) => sum + i.amount, CONFIG.startBalance);
  },

  /** Ключевые показатели. Все значения — целые числа. */
  stats(today = todayISO()) {
    const earned = this.total();
    const remaining = Math.max(0, CONFIG.goal - earned);
    const percentBp = Math.min(10000, Math.floor(earned * 10000 / CONFIG.goal)); // базисные пункты
    let daysLeft;
    if (today < CONFIG.startDate) daysLeft = TOTAL_DAYS;
    else if (today >= CONFIG.endDate) daysLeft = 0;
    else daysLeft = daysBetween(today, CONFIG.endDate);
    const daysPassed = Math.min(TOTAL_DAYS, Math.max(0, daysBetween(CONFIG.startDate, today) + 1));
    const perDay = remaining > 0 && daysLeft > 0 ? Math.ceil(remaining / daysLeft) : (remaining > 0 ? remaining : 0);
    // Средний месяц = 365.25 / 12 = 1461 / 48 дня
    const perMonth = remaining > 0 && daysLeft > 0
      ? Math.min(remaining, Math.ceil(remaining * 1461 / (daysLeft * 48)))
      : remaining;
    return { earned, remaining, percentBp, daysLeft, daysPassed, perDay, perMonth, today, goalReached: earned >= CONFIG.goal };
  },

  sorted(dir = 'desc') {
    const list = [...this.state.incomes];
    list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt < b.createdAt ? -1 : 1)));
    return dir === 'desc' ? list.reverse() : list;
  },

  addIncome(data) {
    const inc = Store.normalizeIncome({ ...data, id: uid(), createdAt: new Date().toISOString() });
    if (!inc) throw new Error('Некорректные данные операции');
    this.state.incomes.push(inc);
    this.commit();
    return inc;
  },

  updateIncome(id, data) {
    const idx = this.state.incomes.findIndex(i => i.id === id);
    if (idx === -1) throw new Error('Операция не найдена');
    const old = this.state.incomes[idx];
    const inc = Store.normalizeIncome({ ...old, ...data, id, createdAt: old.createdAt, updatedAt: new Date().toISOString() });
    if (!inc) throw new Error('Некорректные данные операции');
    this.state.incomes[idx] = inc;
    this.commit();
    return inc;
  },

  deleteIncome(id) {
    const before = this.state.incomes.length;
    this.state.incomes = this.state.incomes.filter(i => i.id !== id);
    if (this.state.incomes.length !== before) this.commit();
  },

  replaceState(newState) {
    this.state = newState;
    this.syncMilestones(false);
    this.commit();
  },

  /** Сохранение + проверка этапов + перерисовка */
  commit() {
    this.syncMilestones(true);
    Store.save(this.state);
    render();
  },

  /** Отмечает достигнутые этапы; notify=true показывает уведомление о новых */
  syncMilestones(notify) {
    const total = this.total();
    const reached = new Set(this.state.milestonesReached);
    const newly = [];
    CONFIG.milestones.forEach(m => {
      if (total >= m && !reached.has(m)) { reached.add(m); newly.push(m); }
      if (total < m && reached.has(m)) reached.delete(m);
    });
    this.state.milestonesReached = CONFIG.milestones.filter(m => reached.has(m));
    if (notify) {
      newly.forEach((m, i) => setTimeout(() => {
        const final = m === CONFIG.goal;
        toast('milestone',
          final ? 'Цель достигнута! 120 000 000 сум' : `Этап достигнут: ${formatCompact(m)} сум`,
          final ? 'Road to 120 Million пройдена. Поздравляем!' : `Вы заработали больше ${formatMoney(m)}. Так держать!`,
          final ? '🏆' : '🎯', 6000);
      }, 350 + i * 400));
    }
    return newly;
  },
};

/* ==========================================================
   Уведомления (toast)
   ========================================================== */
function toast(type, title, text = '', icon = null, timeout = 3800) {
  const box = $('#toasts');
  if (!box) return;
  const icons = { success: '✓', error: '⚠', info: 'ℹ', milestone: '🎯' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="t-icon">${icon || icons[type] || ''}</span><div><strong>${escapeHtml(title)}</strong>${text ? `<span class="muted small">${escapeHtml(text)}</span>` : ''}</div>`;
  box.appendChild(el);
  while (box.children.length > 4) box.firstElementChild.remove(); // не больше 4 уведомлений одновременно
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, timeout);
}

/* ==========================================================
   Отрисовка
   ========================================================== */
function catIcon(id, size = 36) {
  const c = CATEGORY_MAP[id] || CATEGORY_MAP.other;
  return `<span class="cat-dot" style="background:${c.color}1F;color:${c.color};width:${size}px;height:${size}px"><svg viewBox="0 0 24 24">${c.icon}</svg></span>`;
}
function catBadge(id) {
  const c = CATEGORY_MAP[id] || CATEGORY_MAP.other;
  return `<span class="badge" style="background:${c.color}1F;color:${c.color}">${escapeHtml(c.name)}</span>`;
}
function incomeItemHtml(inc, withActions = false) {
  return `<li class="recent-item">
    ${catIcon(inc.category)}
    <div class="recent-body">
      <span class="recent-title" title="${escapeHtml(inc.source)}">${escapeHtml(inc.source)}</span>
      <span class="muted small">${formatDate(inc.date)} · ${escapeHtml(CATEGORY_MAP[inc.category].name)}${inc.comment ? ' · ' + escapeHtml(inc.comment) : ''}</span>
    </div>
    <span class="recent-amount">+${formatMoney(inc.amount)}</span>
    ${withActions ? `<div class="recent-actions">${actionButtons(inc.id)}</div>` : ''}
  </li>`;
}
function actionButtons(id) {
  return `<button class="icon-btn sm" data-action="edit" data-id="${escapeHtml(id)}" aria-label="Редактировать" title="Редактировать"><svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg></button>
    <button class="icon-btn sm danger" data-action="delete" data-id="${escapeHtml(id)}" aria-label="Удалить" title="Удалить"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>`;
}

function render() {
  const s = App.stats();
  renderHeader(s);
  renderDashboard(s);
  renderHistory();
  renderCalendar();
  renderMilestones(s);
  renderSettings();
  App.renderers.forEach(fn => { try { fn(s); } catch (e) { console.error('Ошибка расширения', e); } });
  updateCharts();
}

function renderHeader(s) {
  $('#pageTitle').textContent = PAGE_TITLES[App.ui.page] || App.ui.page;
  const today = s.today;
  let dayInfo;
  if (today < CONFIG.startDate) dayInfo = `Старт ${formatDateLong(CONFIG.startDate)}`;
  else if (today >= CONFIG.endDate) dayInfo = 'Срок цели завершён';
  else dayInfo = `День ${s.daysPassed} из ${TOTAL_DAYS}`;
  $('#todayLabel').textContent = `${weekdayName(today)}, ${formatDateLong(today)} · ${dayInfo}`;
  $('#sidebarProgress').style.width = (s.percentBp / 100) + '%';
  $('#sidebarPercent').textContent = `${formatBp(s.percentBp)} · ${formatCompact(s.earned)} сум`;
}

function renderDashboard(s) {
  animateNumber($('#earnedValue'), s.earned);
  $('#percentValue').textContent = formatBp(s.percentBp);
  $('#remainingValue').textContent = formatMoney(s.remaining);
  $('#daysLeftValue').textContent = formatNumber(s.daysLeft);
  $('#daysHint').textContent = `из ${TOTAL_DAYS} дней · до ${formatDate(CONFIG.endDate)}`;
  $('#perDayValue').textContent = formatMoney(s.perDay);
  $('#perMonthValue').textContent = formatMoney(s.perMonth);
  $('#remainingValue').classList.toggle('good', s.goalReached);

  const bar = $('#mainProgress');
  bar.setAttribute('aria-valuenow', String(s.percentBp / 100));
  // запуск анимации после отрисовки
  requestAnimationFrame(() => { $('#mainProgressFill').style.width = (s.percentBp / 100) + '%'; });

  const marks = $('#progressMarks');
  if (!marks.childElementCount) {
    marks.innerHTML = CONFIG.milestones.slice(0, -1)
      .map(m => `<span style="left:${(m / CONFIG.goal) * 100}%" title="${formatCompact(m)}"></span>`).join('');
  }

  const recent = App.sorted('desc').slice(0, 5);
  $('#recentList').innerHTML = recent.length
    ? recent.map(i => incomeItemHtml(i)).join('')
    : '<li class="list-empty">Доходов пока нет. Нажмите «+ Добавить доход», чтобы начать путь к цели.</li>';

  $('#milestonesMini').innerHTML = CONFIG.milestones.map(m => {
    const done = s.earned >= m;
    return `<div class="ms-chip ${done ? 'done' : ''}"><strong>${formatCompact(m)}</strong><span>${done ? 'Достигнуто' : 'Не достигнуто'}</span></div>`;
  }).join('');
}

/** Плавная анимация числа */
function animateNumber(el, to) {
  const from = Number(el.dataset.value || 0);
  el.dataset.value = String(to);
  if (from === to || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = formatNumber(to); return; }
  const start = performance.now();
  const dur = 900;
  cancelAnimationFrame(el._raf);
  const step = (t) => {
    const k = Math.min(1, (t - start) / dur);
    const eased = 1 - Math.pow(1 - k, 3);
    el.textContent = formatNumber(Math.round(from + (to - from) * eased));
    if (k < 1) el._raf = requestAnimationFrame(step);
    else el.textContent = formatNumber(to);
  };
  el._raf = requestAnimationFrame(step);
}

/* ---------- История ---------- */
function filteredHistory() {
  const { query, category, sortKey, sortDir } = App.ui.history;
  const q = query.trim().toLowerCase();
  let list = App.incomes.filter(i =>
    (!category || i.category === category) &&
    (!q || i.source.toLowerCase().includes(q) || i.comment.toLowerCase().includes(q)));
  const mul = sortDir === 'asc' ? 1 : -1;
  list.sort((a, b) => {
    let r;
    if (sortKey === 'amount') r = a.amount - b.amount || (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    else r = a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt < b.createdAt ? -1 : 1);
    return r * mul;
  });
  return list;
}

function renderHistory() {
  const list = filteredHistory();
  const tbody = $('#historyBody');
  tbody.innerHTML = list.map(i => `<tr data-id="${escapeHtml(i.id)}">
      <td class="c-date">${formatDate(i.date)}</td>
      <td class="c-source"><div class="source">${escapeHtml(i.source)}</div>${i.comment ? `<div class="comment" title="${escapeHtml(i.comment)}">${escapeHtml(i.comment)}</div>` : ''}</td>
      <td class="c-cat">${catBadge(i.category)}</td>
      <td class="num amount c-amount">+${formatMoney(i.amount)}</td>
      <td class="c-actions"><div class="row-actions">${actionButtons(i.id)}</div></td>
    </tr>`).join('');

  const empty = $('#historyEmpty');
  const hasAny = App.incomes.length > 0;
  empty.classList.toggle('show', list.length === 0);
  empty.querySelector('p').textContent = hasAny ? 'Ничего не найдено' : 'Доходов пока нет';
  $('#historyTable thead').style.visibility = list.length ? '' : 'hidden';

  const sum = list.reduce((s, i) => s + i.amount, 0);
  $('#historySummary').textContent = hasAny ? `${list.length} опер. · ${formatMoney(sum)}` : '';

  $$('.sort-btn').forEach(btn => {
    const active = btn.dataset.sort === App.ui.history.sortKey;
    btn.classList.toggle('active', active);
    btn.querySelector('.sort-dir').textContent = active ? (App.ui.history.sortDir === 'desc' ? '↓' : '↑') : '';
  });
}

/* ---------- Календарь ---------- */
const CAL_MIN = { year: 2026, month: 9 };   // октябрь 2026 (месяц 0-based)
const CAL_MAX = { year: 2028, month: 0 };   // январь 2028
const calIndex = (y, m) => y * 12 + m;

function dailyTotals() {
  const map = new Map();
  App.incomes.forEach(i => map.set(i.date, (map.get(i.date) || 0) + i.amount));
  return map;
}

function renderCalendar() {
  const { year, month, selected } = App.ui.calendar;
  const totals = dailyTotals();
  const today = todayISO();
  $('#calTitle').textContent = `${MONTHS[month]} ${year}`;
  $('#calPrev').disabled = calIndex(year, month) <= calIndex(CAL_MIN.year, CAL_MIN.month);
  $('#calNext').disabled = calIndex(year, month) >= calIndex(CAL_MAX.year, CAL_MAX.month);

  const first = `${year}-${pad2(month + 1)}-01`;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const offset = (new Date(isoToDay(first) * DAY_MS).getUTCDay() + 6) % 7; // понедельник = 0
  let html = '';
  for (let i = 0; i < offset; i++) html += '<div class="cal-day blank" aria-hidden="true"></div>';
  let monthTotal = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${pad2(month + 1)}-${pad2(d)}`;
    const sum = totals.get(iso) || 0;
    monthTotal += sum;
    const inRange = iso >= CONFIG.startDate && iso <= CONFIG.endDate;
    const cls = ['cal-day'];
    if (!inRange) cls.push('disabled');
    if (sum) cls.push('has-income');
    if (iso === today) cls.push('today');
    if (iso === selected) cls.push('selected');
    if (iso === CONFIG.endDate) cls.push('deadline');
    html += `<button class="${cls.join(' ')}" data-date="${iso}" ${inRange ? '' : 'disabled'} aria-label="${formatDateLong(iso)}${sum ? ', ' + formatMoney(sum) : ''}">
      <span class="d">${d}</span>${sum ? `<span class="s">+${formatCompact(sum)}</span>` : ''}</button>`;
  }
  $('#calGrid').innerHTML = html;
  $('#calMonthTotal').textContent = formatMoney(monthTotal);
  renderDayPanel();
}

function renderDayPanel() {
  const sel = App.ui.calendar.selected;
  const list = $('#dayList');
  const addBtn = $('#dayAddBtn');
  if (!sel) {
    $('#dayTitle').textContent = 'Выберите дату';
    $('#dayTotal').textContent = '';
    list.innerHTML = '<li class="list-empty">Нажмите на день в календаре, чтобы увидеть операции.</li>';
    addBtn.hidden = true;
    return;
  }
  const items = App.sorted('asc').filter(i => i.date === sel);
  const sum = items.reduce((s, i) => s + i.amount, 0);
  $('#dayTitle').textContent = `${formatDateLong(sel)}`;
  $('#dayTotal').textContent = sum ? '+' + formatMoney(sum) : '';
  list.innerHTML = items.length ? items.map(i => incomeItemHtml(i, true)).join('') : '<li class="list-empty">В этот день поступлений нет.</li>';
  addBtn.hidden = sel > todayISO() || sel < CONFIG.startDate || sel > CONFIG.endDate;
}

function shiftCalendar(delta) {
  const c = App.ui.calendar;
  let idx = calIndex(c.year, c.month) + delta;
  idx = Math.max(calIndex(CAL_MIN.year, CAL_MIN.month), Math.min(calIndex(CAL_MAX.year, CAL_MAX.month), idx));
  c.year = Math.floor(idx / 12); c.month = idx % 12;
  renderCalendar();
}

function calendarGoTo(iso) {
  const [y, m] = iso.split('-').map(Number);
  App.ui.calendar.year = y; App.ui.calendar.month = m - 1;
  shiftCalendar(0);
}

/* ---------- Цели ---------- */
const MS_ICON_DONE = '<svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg>';
const MS_ICON_LOCK = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>';

function renderMilestones(s) {
  const done = CONFIG.milestones.filter(m => s.earned >= m).length;
  $('#milestonesSummary').textContent = `Достигнуто ${done} из ${CONFIG.milestones.length}`;
  $('#milestonesList').innerHTML = CONFIG.milestones.map(m => {
    const ok = s.earned >= m;
    const pct = Math.min(100, Math.floor(s.earned * 10000 / m) / 100);
    const left = Math.max(0, m - s.earned);
    return `<div class="milestone ${ok ? 'done' : ''}">
      <div class="milestone-icon">${ok ? MS_ICON_DONE : MS_ICON_LOCK}</div>
      <div>
        <div class="milestone-title">${formatNumber(m)} сум</div>
        <div class="muted small">${ok ? 'Этап пройден' : `Осталось ${formatMoney(left)} · ${String(pct).replace('.', ',')}%`}</div>
        <div class="milestone-bar"><div style="width:${pct}%"></div></div>
      </div>
      <span class="status ${ok ? 'done' : 'pending'}">${ok ? 'Достигнуто' : 'Не достигнуто'}</span>
    </div>`;
  }).join('');
}

/* ---------- Настройки ---------- */
function renderSettings() {
  const n = App.incomes.length;
  const saved = App.state.meta.updatedAt ? new Date(App.state.meta.updatedAt) : null;
  const savedText = saved ? `${saved.toLocaleDateString('ru-RU')} ${saved.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : '—';
  $('#storageInfo').textContent = Store.available
    ? `Операций: ${n} · Последнее сохранение: ${savedText}`
    : 'LocalStorage недоступен в этом браузере — используйте экспорт.';
}

/* ==========================================================
   Графики (Chart.js)
   ========================================================== */
const hasChart = () => typeof window.Chart !== 'undefined';

function chartDefaults() {
  if (!hasChart() || chartDefaults.done) return;
  chartDefaults.done = true;
  Chart.defaults.color = '#94A3B8';
  Chart.defaults.font.family = "'Manrope', 'Inter', system-ui, sans-serif";
  Chart.defaults.borderColor = 'rgba(148, 163, 184, 0.1)';
  Chart.defaults.plugins.tooltip.backgroundColor = '#1B2335';
  Chart.defaults.plugins.tooltip.borderColor = '#2E3954';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.titleColor = '#FFFFFF';
  Chart.defaults.plugins.tooltip.bodyColor = '#E2E8F0';
  Chart.defaults.plugins.legend.labels.boxWidth = 12;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
}

/** Создаёт или обновляет график. Невидимые графики обновляются при показе страницы. */
function upsertChart(id, buildConfig) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  if (!hasChart()) {
    if (!canvas.parentElement.querySelector('.chart-fallback')) {
      canvas.insertAdjacentHTML('afterend', '<div class="chart-fallback">Не удалось загрузить Chart.js. Проверьте подключение к интернету — данные в безопасности.</div>');
    }
    return;
  }
  if (canvas.offsetParent === null) { canvas.dataset.dirty = '1'; return; }
  const cfg = buildConfig();
  const existing = App.charts[id];
  if (existing) {
    existing.data = cfg.data;
    if (cfg.options) existing.options = cfg.options;
    existing.update();
  } else {
    App.charts[id] = new Chart(canvas, cfg);
  }
  canvas.dataset.dirty = '';
}

const moneyTick = (v) => formatCompact(v);
const moneyTooltip = (ctx) => `${ctx.dataset.label}: ${formatMoney(ctx.parsed.y ?? ctx.parsed)}`;

/** Данные накопленного дохода по дням за весь период */
function growthSeries(compact = false) {
  const totals = dailyTotals();
  const today = todayISO();
  const lastIncome = App.incomes.reduce((max, i) => (i.date > max ? i.date : max), CONFIG.startDate);
  let actualUntil = today > lastIncome ? today : lastIncome;
  if (actualUntil > CONFIG.endDate) actualUntil = CONFIG.endDate;
  const labels = [], actual = [], plan = [];
  let acc = CONFIG.startBalance;
  // доходы до старта (если есть) учитываем в начальной точке
  App.incomes.forEach(i => { if (i.date < CONFIG.startDate) acc += i.amount; });
  // компактный режим (главная): от старта до последней даты, минимум 30 дней
  const lastDay = compact ? Math.min(TOTAL_DAYS, Math.max(29, daysBetween(CONFIG.startDate, actualUntil))) : TOTAL_DAYS;
  for (let d = 0; d <= lastDay; d++) {
    const iso = addDaysISO(CONFIG.startDate, d);
    acc += totals.get(iso) || 0;
    labels.push(formatDate(iso));
    actual.push(iso <= actualUntil ? acc : null);
    plan.push(Math.round(CONFIG.goal * d / TOTAL_DAYS));
  }
  return { labels, actual, plan };
}

function growthConfig(compact = false) {
  const { labels, actual, plan } = growthSeries(compact);
  return {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Заработано', data: actual, borderColor: '#00E5A8', borderWidth: 2.5,
          // точка на последнем значении — видна даже при одном дне данных
          pointRadius: actual.map((v, i) => (v !== null && (i === actual.length - 1 || actual[i + 1] === null) ? 4 : 0)),
          pointBackgroundColor: '#00E5A8', pointHoverRadius: 5, tension: 0.25, fill: true,
          backgroundColor: (ctx) => {
            const { chart } = ctx; const { ctx: c, chartArea } = chart;
            if (!chartArea) return 'rgba(0,229,168,0.1)';
            const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            g.addColorStop(0, 'rgba(0,229,168,0.35)'); g.addColorStop(1, 'rgba(0,229,168,0)');
            return g;
          },
        },
        {
          label: 'План до 120 млн', data: plan, borderColor: 'rgba(148,163,184,0.55)', borderWidth: 1.5,
          borderDash: [6, 6], pointRadius: 0, pointHoverRadius: 0, fill: false,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 700 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: !compact, position: 'bottom' },
        tooltip: { callbacks: { label: moneyTooltip } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: compact ? 5 : 10, maxRotation: 0 } },
        y: { beginAtZero: true, suggestedMax: compact ? undefined : CONFIG.goal, ticks: { callback: moneyTick, maxTicksLimit: 6 } },
      },
    },
  };
}

function monthlyConfig() {
  const endKey = monthKey(CONFIG.endDate > todayISO() ? '2027-12-31' : CONFIG.endDate);
  const lastKey = App.incomes.reduce((max, i) => (monthKey(i.date) > max ? monthKey(i.date) : max), endKey);
  const keys = monthKeysBetween(monthKey(CONFIG.startDate), lastKey);
  const sums = new Map(keys.map(k => [k, 0]));
  App.incomes.forEach(i => { const k = monthKey(i.date); if (sums.has(k)) sums.set(k, sums.get(k) + i.amount); });
  const target = Math.round(CONFIG.goal * 1461 / (TOTAL_DAYS * 48)); // средний план на месяц
  return {
    type: 'bar',
    data: {
      labels: keys.map(monthLabel),
      datasets: [
        { type: 'bar', label: 'Доход за месяц', data: keys.map(k => sums.get(k)), backgroundColor: 'rgba(0,229,168,0.75)', hoverBackgroundColor: '#00E5A8', borderRadius: 8, maxBarThickness: 36 },
        { type: 'line', label: 'Средний план в месяц', data: keys.map(() => target), borderColor: 'rgba(255,194,75,0.7)', borderDash: [5, 5], borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: moneyTooltip } } },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true } },
        y: { beginAtZero: true, ticks: { callback: moneyTick, maxTicksLimit: 6 } },
      },
    },
  };
}

function categoryTotals() {
  const sums = Object.fromEntries(CATEGORIES.map(c => [c.id, 0]));
  App.incomes.forEach(i => { sums[i.category] += i.amount; });
  return sums;
}

function categoryConfig() {
  const sums = categoryTotals();
  const cats = CATEGORIES.filter(c => sums[c.id] > 0);
  const total = cats.reduce((s, c) => s + sums[c.id], 0);
  return {
    type: 'doughnut',
    data: {
      labels: cats.map(c => c.name),
      datasets: [{ data: cats.map(c => sums[c.id]), backgroundColor: cats.map(c => c.color), borderColor: '#151B2B', borderWidth: 3, hoverOffset: 8 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '64%',
      plugins: {
        legend: { position: 'right' },
        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatMoney(ctx.parsed)} (${total ? (Math.round(ctx.parsed * 1000 / total) / 10).toString().replace('.', ',') : 0}%)` } },
      },
    },
  };
}

function updateCharts() {
  chartDefaults();
  upsertChart('dashGrowthChart', () => growthConfig(true));
  upsertChart('growthChart', () => growthConfig(false));
  upsertChart('monthlyChart', monthlyConfig);
  const hasCat = App.incomes.length > 0;
  $('#categoryEmpty').hidden = hasCat;
  $('#categoryChart').parentElement.hidden = !hasCat;
  if (hasCat) upsertChart('categoryChart', categoryConfig);
  App.chartUpdaters.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  // легенда круговой диаграммы снизу на узких экранах
  const cat = App.charts.categoryChart;
  if (cat) {
    const pos = window.innerWidth < 560 ? 'bottom' : 'right';
    if (cat.options.plugins.legend.position !== pos) { cat.options.plugins.legend.position = pos; cat.update('none'); }
  }
}
App.chartUpdaters = []; // графики расширений (этап 2+)

/* ==========================================================
   Модальные окна
   ========================================================== */
let lastFocus = null;
function openModal(id) {
  lastFocus = document.activeElement;
  const m = document.getElementById(id);
  m.classList.add('open');
  m.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  const m = document.getElementById(id);
  m.classList.remove('open');
  m.setAttribute('aria-hidden', 'true');
  if (!$('.modal-backdrop.open')) document.body.style.overflow = '';
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

function maxIncomeDate() {
  const t = todayISO();
  return t > CONFIG.endDate ? CONFIG.endDate : (t < CONFIG.startDate ? CONFIG.startDate : t);
}

function openIncomeModal(income = null, presetDate = null) {
  const form = $('#incomeForm');
  form.reset();
  clearErrors();
  $('#incomeModalTitle').textContent = income ? 'Редактировать доход' : 'Новый доход';
  $('#incomeSubmit').textContent = income ? 'Сохранить изменения' : 'Добавить доход';
  $('#incomeId').value = income ? income.id : '';
  const dateInput = $('#incomeDate');
  dateInput.min = CONFIG.startDate;
  dateInput.max = maxIncomeDate();
  dateInput.value = income ? income.date : (presetDate || maxIncomeDate());
  $('#incomeAmount').value = income ? formatNumber(income.amount).replace(/ /g, ' ') : '';
  $('#incomeCategory').value = income ? income.category : 'freelance';
  $('#incomeSource').value = income ? income.source : '';
  $('#incomeComment').value = income ? income.comment : '';
  openModal('incomeModal');
  setTimeout(() => $('#incomeAmount').focus(), 60);
}

function clearErrors() {
  $$('#incomeForm .error').forEach(e => { e.textContent = ''; });
  $$('#incomeForm .form-field').forEach(f => f.classList.remove('invalid'));
}
function setError(fieldId, msg) {
  const el = $(`[data-error-for="${fieldId}"]`);
  if (el) { el.textContent = msg; el.closest('.form-field').classList.add('invalid'); }
}

function readIncomeForm() {
  clearErrors();
  const amount = parseAmount($('#incomeAmount').value);
  const date = $('#incomeDate').value;
  const category = $('#incomeCategory').value;
  const source = $('#incomeSource').value.trim();
  const comment = $('#incomeComment').value.trim();
  let ok = true;
  if (!$('#incomeAmount').value.trim()) { setError('incomeAmount', 'Введите сумму'); ok = false; }
  else if (!Number.isSafeInteger(amount)) { setError('incomeAmount', 'Только целое число сумов, без копеек и букв'); ok = false; }
  else if (amount <= 0) { setError('incomeAmount', 'Сумма должна быть больше нуля'); ok = false; }
  else if (amount > CONFIG.maxAmount) { setError('incomeAmount', 'Слишком большая сумма — проверьте ввод'); ok = false; }
  if (!isValidISODate(date)) { setError('incomeDate', 'Укажите дату'); ok = false; }
  else if (date < CONFIG.startDate) { setError('incomeDate', `Не раньше ${formatDate(CONFIG.startDate)}`); ok = false; }
  else if (date > maxIncomeDate()) { setError('incomeDate', date > CONFIG.endDate ? `Не позже ${formatDate(CONFIG.endDate)}` : 'Дата не может быть в будущем'); ok = false; }
  if (!CATEGORY_MAP[category]) { setError('incomeCategory', 'Выберите категорию'); ok = false; }
  if (!source) { setError('incomeSource', 'Укажите проект или клиента'); ok = false; }
  return ok ? { amount, date, category, source, comment } : null;
}

/** Универсальное подтверждение. Возвращает Promise<boolean>. */
function confirmDialog({ title = 'Подтверждение', text = '', okText = 'Удалить', danger = true, requireText = '' } = {}) {
  return new Promise(resolve => {
    $('#confirmTitle').textContent = title;
    $('#confirmText').textContent = text;
    const ok = $('#confirmOk');
    const input = $('#confirmInput');
    ok.textContent = okText;
    ok.className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
    input.hidden = !requireText;
    input.value = '';
    input.placeholder = requireText ? `Введите «${requireText}»` : '';
    ok.disabled = !!requireText;
    const onInput = () => { ok.disabled = input.value.trim().toUpperCase() !== requireText.toUpperCase(); };
    const done = (result) => {
      ok.removeEventListener('click', onOk);
      $('#confirmCancel').removeEventListener('click', onCancel);
      input.removeEventListener('input', onInput);
      $('#confirmModal')._cancel = null;
      closeModal('confirmModal');
      resolve(result);
    };
    const onOk = () => done(true);
    const onCancel = () => done(false);
    ok.addEventListener('click', onOk);
    $('#confirmCancel').addEventListener('click', onCancel);
    input.addEventListener('input', onInput);
    $('#confirmModal')._cancel = onCancel;
    openModal('confirmModal');
    setTimeout(() => (requireText ? input : ok).focus(), 60);
  });
}

async function deleteIncomeFlow(id) {
  const inc = App.incomes.find(i => i.id === id);
  if (!inc) return;
  const yes = await confirmDialog({
    title: 'Удалить операцию?',
    text: `«${inc.source}» от ${formatDate(inc.date)} на ${formatMoney(inc.amount)}. Баланс будет пересчитан.`,
  });
  if (!yes) return;
  App.deleteIncome(id);
  toast('success', 'Операция удалена', `Баланс: ${formatMoney(App.total())}`);
}

/* ==========================================================
   Экспорт / импорт
   ========================================================== */
function exportData() {
  const payload = {
    app: 'income-tracker',
    version: App.state.version,
    exportedAt: new Date().toISOString(),
    config: { goal: CONFIG.goal, startDate: CONFIG.startDate, endDate: CONFIG.endDate, currency: 'UZS' },
    incomes: App.incomes,
    milestonesReached: App.state.milestonesReached,
    ext: App.state.ext,
    meta: App.state.meta,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `income-tracker-backup-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('success', 'Экспорт готов', `${App.incomes.length} опер. сохранено в файл`);
}

function importFile(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { toast('error', 'Файл слишком большой', 'Максимум 10 МБ'); return; }
  const reader = new FileReader();
  reader.onerror = () => toast('error', 'Не удалось прочитать файл');
  reader.onload = async () => {
    let state;
    try {
      const data = JSON.parse(String(reader.result));
      const normalized = Array.isArray(data) ? { incomes: data } : data;
      state = Store.validate(normalized);
    } catch (e) {
      toast('error', 'Импорт отменён', e instanceof SyntaxError ? 'Файл не является корректным JSON' : e.message);
      return;
    }
    const sum = state.incomes.reduce((s, i) => s + i.amount, 0);
    const yes = await confirmDialog({
      title: 'Импортировать резервную копию?',
      text: `В файле ${state.incomes.length} опер. на ${formatMoney(sum)}. Текущие данные (${App.incomes.length} опер.) будут заменены.`,
      okText: 'Импортировать', danger: false,
    });
    if (!yes) return;
    App.replaceState(state);
    toast('success', 'Данные восстановлены', `Баланс: ${formatMoney(App.total())}`);
  };
  reader.readAsText(file);
}

async function resetAll() {
  const yes = await confirmDialog({
    title: 'Удалить все данные?',
    text: `Будут удалены все операции (${App.incomes.length}). Рекомендуем сначала сделать экспорт. Для подтверждения введите слово УДАЛИТЬ.`,
    okText: 'Удалить всё', requireText: 'УДАЛИТЬ',
  });
  if (!yes) return;
  const ext = App.state.ext;
  const fresh = Store.fresh();
  fresh.ext = ext; // настройки расширений сохраняем
  App.replaceState(fresh);
  toast('success', 'Данные удалены', 'Баланс сброшен до 0 сум');
}

/* ==========================================================
   Навигация
   ========================================================== */
function navigate(page, { push = true } = {}) {
  if (!document.getElementById(`page-${page}`)) page = 'dashboard';
  App.ui.page = page;
  $$('.page').forEach(p => p.classList.toggle('active', p.id === `page-${page}`));
  $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  $('#pageTitle').textContent = PAGE_TITLES[page] || page;
  if (push && location.hash !== `#${page}`) history.replaceState(null, '', `#${page}`);
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  updateCharts();
}

/* ==========================================================
   События
   ========================================================== */
function bindEvents() {
  // навигация
  document.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-page]');
    if (nav && nav.classList.contains('nav-item')) { navigate(nav.dataset.page); return; }
    const go = e.target.closest('[data-goto]');
    if (go) { navigate(go.dataset.goto); return; }
    const act = e.target.closest('[data-action]');
    if (act) {
      const id = act.dataset.id;
      if (act.dataset.action === 'edit') {
        const inc = App.incomes.find(i => i.id === id);
        if (inc) openIncomeModal(inc);
      } else if (act.dataset.action === 'delete') {
        deleteIncomeFlow(id);
      }
    }
  });

  $('#addIncomeBtn').addEventListener('click', () => openIncomeModal());
  $('#fabAdd').addEventListener('click', () => openIncomeModal());

  // модальное окно дохода
  $$('#incomeModal [data-close]').forEach(b => b.addEventListener('click', () => closeModal('incomeModal')));
  $('#incomeModal').addEventListener('mousedown', (e) => { if (e.target.id === 'incomeModal') closeModal('incomeModal'); });
  $('#confirmModal').addEventListener('mousedown', (e) => { if (e.target.id === 'confirmModal' && $('#confirmModal')._cancel) $('#confirmModal')._cancel(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if ($('#confirmModal').classList.contains('open')) { $('#confirmModal')._cancel && $('#confirmModal')._cancel(); return; }
    if ($('#incomeModal').classList.contains('open')) closeModal('incomeModal');
  });

  // форматирование суммы при вводе: 2500000 → 2 500 000
  $('#incomeAmount').addEventListener('input', (e) => {
    const el = e.target;
    const digits = el.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 13);
    const fromEnd = el.value.length - (el.selectionEnd ?? el.value.length);
    el.value = digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : '';
    const pos = Math.max(0, el.value.length - fromEnd);
    try { el.setSelectionRange(pos, pos); } catch (_) { /* ignore */ }
  });

  $('#incomeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = readIncomeForm();
    if (!data) return;
    const id = $('#incomeId').value;
    try {
      if (id) {
        App.updateIncome(id, data);
        toast('success', 'Изменения сохранены', `${data.source}: ${formatMoney(data.amount)}`);
      } else {
        App.addIncome(data);
        toast('success', 'Доход добавлен', `+${formatMoney(data.amount)} · ${data.source}`);
      }
      closeModal('incomeModal');
      if (App.ui.calendar.selected === data.date) renderDayPanel();
    } catch (err) {
      toast('error', 'Не удалось сохранить', err.message);
    }
  });

  // история
  $('#searchInput').addEventListener('input', (e) => { App.ui.history.query = e.target.value; renderHistory(); });
  $('#categoryFilter').addEventListener('change', (e) => { App.ui.history.category = e.target.value; renderHistory(); });
  $$('.sort-btn').forEach(btn => btn.addEventListener('click', () => {
    const h = App.ui.history;
    if (h.sortKey === btn.dataset.sort) h.sortDir = h.sortDir === 'desc' ? 'asc' : 'desc';
    else { h.sortKey = btn.dataset.sort; h.sortDir = 'desc'; }
    renderHistory();
  }));

  // календарь
  $('#calPrev').addEventListener('click', () => shiftCalendar(-1));
  $('#calNext').addEventListener('click', () => shiftCalendar(1));
  $('#calToday').addEventListener('click', () => {
    const t = todayISO();
    const target = t < CONFIG.startDate ? CONFIG.startDate : (t > CONFIG.endDate ? CONFIG.endDate : t);
    App.ui.calendar.selected = target;
    calendarGoTo(target);
  });
  $('#calGrid').addEventListener('click', (e) => {
    const day = e.target.closest('.cal-day[data-date]');
    if (!day || day.disabled) return;
    App.ui.calendar.selected = day.dataset.date;
    $$('.cal-day.selected').forEach(d => d.classList.remove('selected'));
    day.classList.add('selected');
    renderDayPanel();
  });
  $('#dayAddBtn').addEventListener('click', () => openIncomeModal(null, App.ui.calendar.selected));

  // настройки
  $('#exportBtn').addEventListener('click', exportData);
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', (e) => { importFile(e.target.files[0]); e.target.value = ''; });
  $('#resetBtn').addEventListener('click', resetAll);

  // синхронизация между вкладками
  window.addEventListener('storage', (e) => {
    if (e.key !== Store.key || e.newValue === null) return;
    try {
      App.state = Store.validate(JSON.parse(e.newValue));
      render();
    } catch (_) { /* игнорируем некорректные данные из другой вкладки */ }
  });

  window.addEventListener('hashchange', () => navigate(location.hash.slice(1), { push: false }));
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(updateCharts, 200); });

  // обновление счётчика дней при смене даты (вкладка открыта через полночь)
  let lastDay = todayISO();
  setInterval(() => { if (todayISO() !== lastDay) { lastDay = todayISO(); render(); } }, 60000);
}

/* ==========================================================
   Инициализация
   ========================================================== */
function init() {
  if (!document.getElementById('nav')) return; // страница виджета (widget.html) инициализируется сама
  // категории в формах
  const opts = CATEGORIES.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  $('#incomeCategory').innerHTML = opts;
  $('#categoryFilter').innerHTML = '<option value="">Все категории</option>' + opts;

  // мобильная навигация = копия бокового меню
  $('#bottomNav').innerHTML = $('#nav').innerHTML;

  const { state, warning, restored } = Store.load();
  App.state = state;
  App.syncMilestones(false);
  if (restored) Store.save(App.state);

  // календарь открывается на текущем месяце в пределах периода
  const t = todayISO();
  const calStart = t < CONFIG.startDate ? CONFIG.startDate : (t > CONFIG.endDate ? CONFIG.endDate : t);
  App.ui.calendar.year = Number(calStart.slice(0, 4));
  App.ui.calendar.month = Number(calStart.slice(5, 7)) - 1;

  bindEvents();
  if (typeof window.initStage2 === 'function') window.initStage2(App);
  navigate(location.hash.slice(1) || 'dashboard', { push: false });
  render();
  if (warning) toast('error', 'Внимание', warning, null, 8000);
}

document.addEventListener('DOMContentLoaded', init);

/* ==========================================================
   ЭТАП 2: расширенная статистика, прогнозы, планирование,
   достижения и дополнительные функции.
   Подключается через точки расширения ядра (App.onRender,
   App.chartUpdaters, App.state.ext) и не меняет логику этапа 1.
   ========================================================== */

/** Месяцы периода цели: октябрь 2026 — декабрь 2027 (последний день периода — 31.12.2027) */
const PLAN_MONTHS = monthKeysBetween(monthKey(CONFIG.startDate), monthKey(addDaysISO(CONFIG.endDate, -1)));

/** Сколько дней месяца входит в период цели */
function periodDaysInMonth(key) {
  const [y, m] = key.split('-').map(Number);
  const first = `${key}-01`;
  const last = `${key}-${pad2(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
  const from = first < CONFIG.startDate ? CONFIG.startDate : first;
  const lastInPeriod = addDaysISO(CONFIG.endDate, -1);
  const to = last > lastInPeriod ? lastInPeriod : last;
  return to < from ? 0 : daysBetween(from, to) + 1;
}

/** Базовый план: цель распределена по дням периода; сумма по месяцам ровно 120 000 000 */
const BASE_PLAN = (() => {
  const plan = {};
  let cum = 0;
  PLAN_MONTHS.forEach(k => {
    const d = periodDaysInMonth(k);
    plan[k] = Math.round(CONFIG.goal * (cum + d) / TOTAL_DAYS) - Math.round(CONFIG.goal * cum / TOTAL_DAYS);
    cum += d;
  });
  return plan;
})();

const ACHIEVEMENTS = [
  { id: 'first', icon: '🚀', title: 'Первый шаг', desc: 'Добавить первый доход', test: c => c.count >= 1 },
  { id: 'ops10', icon: '🔟', title: 'Десятка', desc: '10 поступлений', test: c => c.count >= 10 },
  { id: 'ops50', icon: '📚', title: 'Полсотни', desc: '50 поступлений', test: c => c.count >= 50 },
  { id: 'big1m', icon: '💵', title: 'Крупный чек', desc: 'Поступление от 1 000 000 сум', test: c => c.maxAmount >= 1000000 },
  { id: 'big10m', icon: '💎', title: 'Мега-контракт', desc: 'Поступление от 10 000 000 сум', test: c => c.maxAmount >= 10000000 },
  { id: 'cat3', icon: '🧩', title: 'Диверсификация', desc: 'Доход из 3 разных категорий', test: c => c.categories >= 3 },
  { id: 'catAll', icon: '🌐', title: 'Все направления', desc: 'Доход из всех 7 категорий', test: c => c.categories >= CATEGORIES.length },
  { id: 'monthPlan', icon: '📅', title: 'План месяца', desc: 'Выполнить план хотя бы одного месяца', test: c => c.monthsMet >= 1 },
  { id: 'streak3', icon: '🔥', title: 'Три месяца подряд', desc: 'Выполнить план 3 месяца подряд', test: c => c.bestMonthStreak >= 3 },
  { id: 'ahead', icon: '⚡', title: 'Впереди графика', desc: 'Заработано больше, чем требует план на сегодня', test: c => c.earned > 0 && c.earned >= c.planToDate },
  { id: 'active30', icon: '🗓️', title: 'Постоянство', desc: '30 дней с поступлениями', test: c => c.activeDays >= 30 },
  { id: 'half', icon: '⛰️', title: 'Экватор', desc: 'Заработать 60 000 000 сум', test: c => c.earned >= 60000000 },
  { id: 'goal', icon: '🏆', title: 'Road to 120M', desc: 'Достичь цели 120 000 000 сум', test: c => c.earned >= CONFIG.goal },
];

function initStage2(App) {
  const ext = () => {
    const e = App.state.ext;
    if (!e.plans || typeof e.plans !== 'object') e.plans = {};
    if (!e.achievements || typeof e.achievements !== 'object') e.achievements = {};
    return e;
  };
  let booted = false;

  /* ---------- Данные ---------- */
  const planFor = (k) => {
    const v = ext().plans[k];
    return Number.isSafeInteger(v) && v >= 0 ? v : BASE_PLAN[k] || 0;
  };
  const monthlyFacts = () => {
    const map = Object.fromEntries(PLAN_MONTHS.map(k => [k, 0]));
    App.incomes.forEach(i => { const k = monthKey(i.date); if (k in map) map[k] += i.amount; });
    return map;
  };
  const currentMonthKey = (today) => {
    const k = monthKey(today);
    if (k < PLAN_MONTHS[0]) return PLAN_MONTHS[0];
    if (k > PLAN_MONTHS[PLAN_MONTHS.length - 1]) return PLAN_MONTHS[PLAN_MONTHS.length - 1];
    return k;
  };

  /** Расширенная статистика и прогноз */
  function analyze(s) {
    const incomes = App.incomes;
    const today = s.today;
    const daysPassed = Math.max(1, s.daysPassed);
    const count = incomes.length;
    const byDay = dailyTotals();
    const facts = monthlyFacts();
    let maxInc = null;
    incomes.forEach(i => { if (!maxInc || i.amount > maxInc.amount) maxInc = i; });
    let bestDay = null;
    byDay.forEach((v, d) => { if (!bestDay || v > bestDay.sum) bestDay = { date: d, sum: v }; });
    let bestMonth = null;
    Object.entries(facts).forEach(([k, v]) => { if (v > 0 && (!bestMonth || v > bestMonth.sum)) bestMonth = { key: k, sum: v }; });

    const from30 = addDaysISO(today, -29);
    const last30 = incomes.filter(i => i.date >= from30 && i.date <= today).reduce((a, i) => a + i.amount, 0);
    const window30 = Math.min(30, daysPassed);

    const curKey = currentMonthKey(today);
    const idx = PLAN_MONTHS.indexOf(curKey);
    const prevKey = idx > 0 ? PLAN_MONTHS[idx - 1] : null;

    // Выполнение планов по месяцам (текущий месяц засчитывается, когда план уже выполнен)
    let monthsMet = 0, streak = 0, bestMonthStreak = 0;
    PLAN_MONTHS.forEach(k => {
      if (k > curKey) return;
      const met = planFor(k) > 0 && facts[k] >= planFor(k);
      if (met) { monthsMet++; streak++; bestMonthStreak = Math.max(bestMonthStreak, streak); }
      else if (k < curKey) streak = 0;
    });

    const planToDate = today < CONFIG.startDate ? 0 : Math.floor(CONFIG.goal * Math.min(TOTAL_DAYS, daysPassed) / TOTAL_DAYS);
    const rateAll = s.earned / daysPassed;
    const rate30 = last30 / window30;
    const project = (rate) => Math.round(s.earned + rate * s.daysLeft);
    const eta = (rate) => {
      if (s.remaining === 0) return 'done';
      if (rate <= 0) return null;
      const days = Math.ceil(s.remaining / rate);
      // при очень низком темпе дата уходит за пределы разумного (и 5+-значный год ломает сравнение строк)
      if (!Number.isFinite(days) || days > ETA_MAX_DAYS) return 'far';
      return addDaysISO(today < CONFIG.startDate ? CONFIG.startDate : today, days);
    };
    const cats = categoryTotals();
    const catCounts = Object.fromEntries(CATEGORIES.map(c => [c.id, 0]));
    incomes.forEach(i => { catCounts[i.category]++; });
    const usedCats = CATEGORIES.filter(c => catCounts[c.id] > 0).length;

    return {
      ...s, count, daysPassed, byDay, facts, maxInc, bestDay, bestMonth, last30, window30,
      curKey, prevKey, monthsMet, bestMonthStreak, planToDate, rateAll, rate30,
      projectAll: project(rateAll), project30: project(rate30), etaAll: eta(rateAll), eta30: eta(rate30),
      cats, catCounts, categories: usedCats, activeDays: byDay.size,
      maxAmount: maxInc ? maxInc.amount : 0,
    };
  }

  /* ---------- Разметка блоков ---------- */
  $('#dashboardExtra').outerHTML = `
    <div class="grid-3" id="dashboardExtra">
      <div class="card stat"><span class="stat-label">Темп относительно плана</span><span class="stat-value" id="s2PaceValue">—</span><span class="muted small" id="s2PaceHint"></span></div>
      <div class="card stat"><span class="stat-label">Прогноз на 01.01.2028</span><span class="stat-value" id="s2ForecastValue">—</span><span class="muted small" id="s2ForecastHint"></span></div>
      <div class="card stat"><span class="stat-label" id="s2MonthLabel">План на месяц</span><span class="stat-value" id="s2MonthValue">—</span>
        <div class="mini-bar"><div class="mini-bar-fill" id="s2MonthBar"></div></div><span class="muted small" id="s2MonthHint"></span></div>
    </div>`;

  $('#analyticsExtra').outerHTML = `
    <div class="extra-stack" id="analyticsExtra">
      <div class="card">
        <div class="card-head"><h3>Расширенная статистика</h3><span class="muted small" id="s2StatsNote"></span></div>
        <div class="kpi-grid" id="s2Kpis"></div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Финансовый прогноз</h3><span class="muted small">Линейная экстраполяция текущего темпа</span></div>
        <div class="kpi-grid" id="s2Forecast"></div>
        <div class="chart-box tall"><canvas id="forecastChart"></canvas></div>
        <p class="muted small" id="s2ForecastNote"></p>
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="card-head"><h3>Категории</h3></div>
          <div class="table-wrap"><table class="table compact-table" id="s2CatTable">
            <thead><tr><th>Категория</th><th class="num">Опер.</th><th class="num">Сумма</th><th class="num">Доля</th></tr></thead>
            <tbody></tbody></table></div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Доход по дням недели</h3></div>
          <div class="chart-box"><canvas id="weekdayChart"></canvas></div>
        </div>
      </div>
    </div>`;

  $('#goalsExtra').outerHTML = `
    <div class="extra-stack" id="goalsExtra">
      <div class="card">
        <div class="card-head">
          <h3>План по месяцам</h3>
          <div class="head-actions">
            <button class="btn btn-ghost btn-sm" id="s2Redistribute" title="Распределить оставшуюся сумму по текущему и будущим месяцам">Пересчитать план</button>
            <button class="btn btn-ghost btn-sm" id="s2ResetPlan">Сбросить</button>
          </div>
        </div>
        <p class="muted small" id="s2PlanSummary"></p>
        <div class="table-wrap"><table class="table plan-table" id="s2PlanTable">
          <thead><tr><th>Месяц</th><th class="num">План</th><th class="num">Факт</th><th>Выполнение</th><th class="num">Разница</th></tr></thead>
          <tbody></tbody></table></div>
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="card-head"><h3>Калькулятор цели</h3></div>
          <label class="form-field"><span>Если зарабатывать в месяц, сум</span>
            <input type="text" inputmode="numeric" id="s2CalcInput" placeholder="Например, 9 000 000" autocomplete="off"></label>
          <div class="calc-result" id="s2CalcResult"><span class="muted small">Введите сумму, чтобы узнать дату достижения цели.</span></div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Достижения</h3><span class="muted small" id="s2AchSummary"></span></div>
          <div class="ach-grid" id="s2Achievements"></div>
        </div>
      </div>
    </div>`;

  $('#settingsExtra').outerHTML = `
    <div class="card" id="settingsExtra">
      <div class="card-head"><h3>Дополнительно</h3></div>
      <div class="btn-row">
        <button class="btn btn-ghost" id="s2CsvBtn"><svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg><span>Экспорт в CSV (Excel)</span></button>
      </div>
      <p class="muted small">Горячие клавиши: <kbd>N</kbd> — добавить доход, <kbd>1</kbd>–<kbd>6</kbd> — переход по разделам, <kbd>Esc</kbd> — закрыть окно.</p>
    </div>`;

  /* ---------- Отрисовка ---------- */
  const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + formatMoney(Math.abs(n));
  const pct1 = (num, den) => den > 0 ? (Math.round(num * 1000 / den) / 10).toString().replace('.', ',') + '%' : '—';
  const monthName = (k) => { const [y, m] = k.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
  const kpi = (label, value, hint = '', cls = '') =>
    `<div class="kpi"><span class="stat-label">${label}</span><span class="kpi-value ${cls}">${value}</span>${hint ? `<span class="muted small">${hint}</span>` : ''}</div>`;

  function renderDashboardExtra(a) {
    const delta = a.earned - a.planToDate;
    const pace = $('#s2PaceValue');
    pace.textContent = a.earned === 0 && a.planToDate === 0 ? '—' : signed(delta);
    pace.className = 'stat-value ' + (delta >= 0 ? 'good' : 'bad');
    $('#s2PaceHint').textContent = delta >= 0 ? `Опережаете план (${formatMoney(a.planToDate)} на сегодня)` : `Отставание от плана (${formatMoney(a.planToDate)} на сегодня)`;

    const fv = $('#s2ForecastValue');
    if (a.earned === 0) { fv.textContent = '—'; fv.className = 'stat-value'; $('#s2ForecastHint').textContent = 'Добавьте доход, чтобы увидеть прогноз'; }
    else {
      fv.textContent = formatMoney(a.projectAll);
      fv.className = 'stat-value ' + (a.projectAll >= CONFIG.goal ? 'good' : 'warn');
      $('#s2ForecastHint').textContent = a.etaAll === 'done' ? 'Цель уже достигнута' :
        a.etaAll === 'far' ? 'При текущем темпе цель дальше 100 лет' :
        a.etaAll ? `Цель по текущему темпу: ${formatDate(a.etaAll)}` : '';
    }

    const plan = planFor(a.curKey), fact = a.facts[a.curKey] || 0;
    $('#s2MonthLabel').textContent = `План: ${monthName(a.curKey).toLowerCase()}`;
    $('#s2MonthValue').textContent = `${formatCompact(fact)} / ${formatCompact(plan)}`;
    $('#s2MonthBar').style.width = Math.min(100, plan ? fact * 100 / plan : 0) + '%';
    const [y, m] = a.curKey.split('-').map(Number);
    const monthEnd = `${a.curKey}-${pad2(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
    const daysLeftInMonth = Math.max(1, daysBetween(a.today < `${a.curKey}-01` ? `${a.curKey}-01` : a.today, monthEnd) + 1);
    $('#s2MonthHint').textContent = fact >= plan ? 'План месяца выполнен 🎉'
      : `Осталось ${formatMoney(plan - fact)} · ${formatMoney(Math.ceil((plan - fact) / daysLeftInMonth))}/день`;
  }

  function renderAnalyticsExtra(a) {
    const avgMonth = Math.round(a.earned * 1461 / (a.daysPassed * 48));
    const prev = a.prevKey ? a.facts[a.prevKey] : null;
    const cur = a.facts[a.curKey] || 0;
    let change = '—', changeCls = '';
    if (prev) { const d = Math.round((cur - prev) * 1000 / prev) / 10; change = (d > 0 ? '+' : '') + String(d).replace('.', ',') + '%'; changeCls = d >= 0 ? 'good' : 'bad'; }
    const topCat = CATEGORIES.reduce((best, c) => (a.cats[c.id] > (best ? a.cats[best.id] : 0) ? c : best), null);
    $('#s2StatsNote').textContent = `${a.daysPassed} ${a.daysPassed === 1 ? 'день' : 'дн.'} с начала пути`;
    $('#s2Kpis').innerHTML = [
      kpi('Средний доход в день', formatMoney(Math.round(a.rateAll))),
      kpi('Средний доход в месяц', formatMoney(avgMonth)),
      kpi('Средний чек', a.count ? formatMoney(Math.round(a.earned / a.count)) : '—', `${a.count} поступлений`),
      kpi('Крупнейшее поступление', a.maxInc ? formatMoney(a.maxInc.amount) : '—', a.maxInc ? escapeHtml(a.maxInc.source) : ''),
      kpi('Лучший день', a.bestDay ? formatMoney(a.bestDay.sum) : '—', a.bestDay ? formatDate(a.bestDay.date) : ''),
      kpi('Лучший месяц', a.bestMonth ? formatMoney(a.bestMonth.sum) : '—', a.bestMonth ? monthName(a.bestMonth.key) : ''),
      kpi('За последние 30 дней', formatMoney(a.last30), `${formatMoney(Math.round(a.rate30))} в день`),
      kpi('Этот месяц к прошлому', change, prev !== null ? `${formatCompact(cur)} против ${formatCompact(prev)}` : 'Нет прошлого месяца', changeCls),
      kpi('Дней с поступлениями', `${a.activeDays}`, `из ${a.daysPassed} · ${pct1(a.activeDays, a.daysPassed)}`),
      kpi('Главный источник', topCat ? escapeHtml(topCat.name) : '—', topCat ? `${pct1(a.cats[topCat.id], a.earned)} дохода` : ''),
    ].join('');

    const etaText = (e) => e === 'done' ? 'Достигнута' : e === 'far' ? 'Более 100 лет' : e ? formatDate(e) : '—';
    const etaCls = (e) => e === 'done' || (e && e !== 'far' && e <= CONFIG.endDate) ? 'good' : e ? 'bad' : '';
    const etaSub = (e) => !e ? (a.earned ? '' : 'Нет данных о доходах') : e === 'done' ? '' :
      e === 'far' ? 'Темп слишком низкий' : e <= CONFIG.endDate ? 'Успеваете к дедлайну' : 'Позже дедлайна';
    $('#s2Forecast').innerHTML = [
      kpi('Прогноз по среднему темпу', a.earned ? formatMoney(a.projectAll) : '—', a.earned ? `${pct1(a.projectAll, CONFIG.goal)} цели` : '', a.projectAll >= CONFIG.goal ? 'good' : ''),
      kpi('Прогноз по темпу 30 дней', a.earned ? formatMoney(a.project30) : '—', a.earned ? `${pct1(a.project30, CONFIG.goal)} цели` : '', a.project30 >= CONFIG.goal ? 'good' : ''),
      kpi('Дата достижения цели', etaText(a.etaAll), etaSub(a.etaAll), etaCls(a.etaAll)),
      kpi('Отклонение от плана', signed(a.earned - a.planToDate), `План на сегодня: ${formatMoney(a.planToDate)}`, a.earned >= a.planToDate ? 'good' : 'bad'),
    ].join('');
    $('#s2ForecastNote').textContent = a.earned === 0
      ? 'Прогноз появится после первого дохода.'
      : a.daysPassed < 14 ? 'Данных пока мало: прогноз станет точнее через пару недель.' : 'Прогноз предполагает, что текущий темп сохранится до дедлайна.';

    $('#s2CatTable tbody').innerHTML = CATEGORIES.map(c => `<tr>
        <td>${catBadge(c.id)}</td><td class="num">${a.catCounts[c.id]}</td>
        <td class="num">${formatMoney(a.cats[c.id])}</td><td class="num">${pct1(a.cats[c.id], a.earned)}</td></tr>`).join('');
  }

  function renderGoalsExtra(a) {
    const totalPlan = PLAN_MONTHS.reduce((sum, k) => sum + planFor(k), 0);
    const custom = Object.keys(ext().plans).length > 0;
    $('#s2PlanSummary').innerHTML = `Сумма плана: <strong>${formatMoney(totalPlan)}</strong>` +
      (totalPlan < CONFIG.goal ? ` · <span class="bad-text">не хватает ${formatMoney(CONFIG.goal - totalPlan)} до цели</span>` : '') +
      (custom ? ' · есть ручные правки' : ' · равномерный план по дням периода') +
      '. Нажмите на сумму плана, чтобы изменить её.';
    $('#s2PlanTable tbody').innerHTML = PLAN_MONTHS.map(k => {
      const plan = planFor(k), fact = a.facts[k];
      const past = k < a.curKey, current = k === a.curKey;
      const pct = plan ? Math.min(100, fact * 100 / plan) : (fact ? 100 : 0);
      const diff = fact - plan;
      const diffCls = (past || current) ? (diff >= 0 ? 'good-text' : past ? 'bad-text' : '') : 'muted';
      return `<tr class="${current ? 'current-month' : ''}">
        <td class="c-month"><strong>${monthName(k)}</strong>${current ? ' <span class="pill pill-sm">сейчас</span>' : ''}</td>
        <td class="num c-plan"><input class="plan-input" data-month="${k}" inputmode="numeric" value="${formatNumber(plan).replace(/ /g, ' ')}" aria-label="План на ${monthName(k)}"></td>
        <td class="num c-fact">${formatMoney(fact)}</td>
        <td class="c-bar"><div class="mini-bar"><div class="mini-bar-fill" style="width:${pct}%"></div></div></td>
        <td class="num c-diff ${diffCls}">${past || current || fact ? signed(diff) : '—'}</td></tr>`;
    }).join('');

    // достижения
    const unlocked = ext().achievements;
    const done = ACHIEVEMENTS.filter(x => unlocked[x.id]).length;
    $('#s2AchSummary').textContent = `${done} из ${ACHIEVEMENTS.length}`;
    $('#s2Achievements').innerHTML = ACHIEVEMENTS.map(x => {
      const on = unlocked[x.id];
      return `<div class="ach ${on ? 'on' : ''}" title="${escapeHtml(x.desc)}">
        <span class="ach-icon">${on ? x.icon : '🔒'}</span>
        <div><strong>${x.title}</strong><span class="muted small">${x.desc}${on ? ` · ${formatDate(on)}` : ''}</span></div></div>`;
    }).join('');
    renderCalc();
  }

  /** Достижения: открываем/закрываем по фактическим данным, уведомляем о новых */
  function syncAchievements(a) {
    const store = ext().achievements;
    let changed = false;
    const newly = [];
    ACHIEVEMENTS.forEach(x => {
      const ok = x.test(a);
      if (ok && !store[x.id]) { store[x.id] = a.today; newly.push(x); changed = true; }
      if (!ok && store[x.id]) { delete store[x.id]; changed = true; }
    });
    if (changed) Store.save(App.state);
    if (booted) newly.forEach((x, i) => setTimeout(() => toast('milestone', `Достижение: ${x.title}`, x.desc, x.icon, 5000), 900 + i * 450));
  }

  function renderCalc() {
    const input = $('#s2CalcInput');
    const out = $('#s2CalcResult');
    const perMonth = parseAmount(input.value);
    const s = App.stats();
    if (!input.value.trim() || !Number.isSafeInteger(perMonth) || perMonth <= 0) {
      out.innerHTML = '<span class="muted small">Введите сумму, чтобы узнать дату достижения цели.</span>';
      return;
    }
    if (s.remaining === 0) { out.innerHTML = '<strong class="accent">Цель уже достигнута 🏆</strong>'; return; }
    const startFrom = s.today < CONFIG.startDate ? CONFIG.startDate : s.today;
    const days = Math.ceil(s.remaining * 1461 / (perMonth * 48));
    if (days > ETA_MAX_DAYS) {
      out.innerHTML = '<strong class="bad-text">С таким доходом цель займёт больше 100 лет</strong>';
      return;
    }
    const eta = addDaysISO(startFrom, days);
    const months = Math.ceil(s.remaining / perMonth);
    const inTime = eta <= CONFIG.endDate;
    out.innerHTML = `<div class="calc-line"><span class="muted">Цель будет достигнута</span><strong class="${inTime ? 'accent' : 'bad-text'}">${formatDateLong(eta)}</strong></div>
      <div class="calc-line"><span class="muted">Понадобится</span><strong>≈ ${months} мес.</strong></div>
      <div class="calc-line"><span class="muted">${inTime ? 'Запас до дедлайна' : 'Опоздание'}</span><strong>${Math.abs(daysBetween(eta, CONFIG.endDate))} дн.</strong></div>
      <div class="calc-line"><span class="muted">Нужно в месяц для дедлайна</span><strong>${formatMoney(s.perMonth)}</strong></div>`;
  }

  /* ---------- Графики этапа 2 ---------- */
  function forecastConfig() {
    const s = App.stats();
    const a = analyze(s);
    const { labels, actual, plan } = growthSeries(false);
    const todayIdx = Math.max(0, Math.min(TOTAL_DAYS, daysBetween(CONFIG.startDate, s.today)));
    const rate = a.rateAll;
    const forecast = labels.map((_, i) => (a.earned > 0 && i >= todayIdx ? Math.round(s.earned + rate * (i - todayIdx)) : null));
    const cfg = growthConfig(false);
    cfg.data.datasets[0].data = actual;
    cfg.data.datasets[1].data = plan;
    cfg.data.datasets.push({
      label: 'Прогноз', data: forecast, borderColor: '#A78BFA', borderWidth: 2, borderDash: [3, 4],
      pointRadius: 0, pointHoverRadius: 4, fill: false,
    });
    cfg.options.scales.y.suggestedMax = Math.max(CONFIG.goal, ...forecast.filter(v => v !== null));
    return cfg;
  }

  function weekdayConfig() {
    const order = [1, 2, 3, 4, 5, 6, 0];
    const sums = [0, 0, 0, 0, 0, 0, 0];
    App.incomes.forEach(i => { sums[new Date(isoToDay(i.date) * DAY_MS).getUTCDay()] += i.amount; });
    return {
      type: 'bar',
      data: {
        labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
        datasets: [{ label: 'Доход', data: order.map(d => sums[d]), backgroundColor: 'rgba(76,154,255,0.75)', hoverBackgroundColor: '#4C9AFF', borderRadius: 8, maxBarThickness: 40 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: moneyTooltip } } },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { callback: moneyTick, maxTicksLimit: 5 } } },
      },
    };
  }

  App.chartUpdaters.push(() => {
    upsertChart('forecastChart', forecastConfig);
    upsertChart('weekdayChart', weekdayConfig);
  });

  /* ---------- События ---------- */
  $('#s2PlanTable').addEventListener('focusin', (e) => { if (e.target.classList.contains('plan-input')) e.target.select(); });
  $('#s2PlanTable').addEventListener('input', (e) => {
    if (!e.target.classList.contains('plan-input')) return;
    const digits = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 13);
    e.target.value = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  });
  $('#s2PlanTable').addEventListener('change', (e) => {
    if (!e.target.classList.contains('plan-input')) return;
    const k = e.target.dataset.month;
    const v = parseAmount(e.target.value || '0');
    if (!Number.isSafeInteger(v) || v > CONFIG.maxAmount) { toast('error', 'Некорректная сумма плана'); render(); return; }
    if (v === BASE_PLAN[k]) delete ext().plans[k]; else ext().plans[k] = v;
    App.commit();
    toast('success', 'План обновлён', `${monthName(k)}: ${formatMoney(v)}`);
  });
  $('#s2PlanTable').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList.contains('plan-input')) e.target.blur(); });

  $('#s2Redistribute').addEventListener('click', async () => {
    const s = App.stats();
    const cur = currentMonthKey(s.today);
    const facts = monthlyFacts();
    const before = PLAN_MONTHS.filter(k => k < cur).reduce((sum, k) => sum + facts[k], 0);
    const left = Math.max(0, CONFIG.goal - before);
    const months = PLAN_MONTHS.filter(k => k >= cur);
    const yes = await confirmDialog({
      title: 'Пересчитать план?',
      text: `Оставшиеся ${formatMoney(left)} будут распределены по ${months.length} мес. (с ${monthName(cur).toLowerCase()} по декабрь 2027) пропорционально дням. Прошлые месяцы не изменятся.`,
      okText: 'Пересчитать', danger: false,
    });
    if (!yes) return;
    const days = months.map(periodDaysInMonth);
    const totalDays = days.reduce((x, y) => x + y, 0);
    let cum = 0;
    months.forEach((k, i) => {
      ext().plans[k] = Math.round(left * (cum + days[i]) / totalDays) - Math.round(left * cum / totalDays);
      cum += days[i];
    });
    App.commit();
    toast('success', 'План пересчитан', `${formatMoney(left)} на ${months.length} мес.`);
  });

  $('#s2ResetPlan').addEventListener('click', async () => {
    const yes = await confirmDialog({ title: 'Сбросить план?', text: 'Все ручные правки плана будут удалены, вернётся равномерный план по дням периода.', okText: 'Сбросить' });
    if (!yes) return;
    ext().plans = {};
    App.commit();
    toast('success', 'План сброшен');
  });

  $('#s2CalcInput').addEventListener('input', (e) => {
    const digits = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 13);
    e.target.value = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    renderCalc();
  });

  $('#s2CsvBtn').addEventListener('click', () => {
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [['Дата', 'Источник', 'Категория', 'Сумма (сум)', 'Комментарий']]
      .concat(App.sorted('asc').map(i => [formatDate(i.date), i.source, CATEGORY_MAP[i.category].name, i.amount, i.comment]));
    const csv = '﻿' + rows.map(r => r.map(esc).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = `income-tracker-${todayISO()}.csv`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('success', 'CSV готов', `${App.incomes.length} опер.`);
  });

  // горячие клавиши
  const pages = ['dashboard', 'incomes', 'analytics', 'calendar', 'goals', 'settings'];
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if ($('.modal-backdrop.open') || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if (e.key === 'n' || e.key === 'N' || e.key === 'т' || e.key === 'Т') { e.preventDefault(); openIncomeModal(); }
    else if (/^[1-6]$/.test(e.key)) navigate(pages[Number(e.key) - 1]);
  });

  /* ---------- Регистрация ---------- */
  App.onRender((s) => {
    const a = analyze(s);
    syncAchievements(a);
    renderDashboardExtra(a);
    renderAnalyticsExtra(a);
    renderGoalsExtra(a);
  });
  setTimeout(() => { booted = true; }, 0);
}

/* ==========================================================
   Мини-окно прогресса (виджет на рабочий стол)
   1) Chrome / Edge 116+: окно Picture-in-Picture поверх всех окон
      (Document Picture-in-Picture API), обновляется вживую.
   2) Остальные браузеры: маленькое отдельное окно widget.html,
      которое читает те же данные из LocalStorage.
   ========================================================== */
const WIDGET_CSS = `
*{box-sizing:border-box}html,body{margin:0;height:100%}
body{background:#0B0F19;color:#fff;font-family:'Manrope','Inter',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden;cursor:default;user-select:none}
.w{height:100%;display:flex;flex-direction:column;justify-content:center;gap:9px;padding:14px 16px;background:radial-gradient(260px 120px at 100% 0%,rgba(0,229,168,.16),transparent 70%),#0B0F19}
.w-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.w-title{font-size:12px;font-weight:800;letter-spacing:.06em;color:#94A3B8}.w-title b{color:#00E5A8}
.w-pct{font-size:clamp(20px,9vw,34px);font-weight:800;color:#00E5A8;font-variant-numeric:tabular-nums;line-height:1}
.w-amount{font-size:clamp(17px,7.4vw,28px);font-weight:800;font-variant-numeric:tabular-nums;line-height:1.1;white-space:nowrap}
.w-amount small{font-size:.5em;color:#94A3B8;font-weight:600}
.w-bar{height:10px;border-radius:99px;background:#1B2335;border:1px solid #232C42;overflow:hidden}
.w-bar div{height:100%;border-radius:inherit;background:linear-gradient(90deg,#00B98A,#00E5A8 60%,#6BFFD6);box-shadow:0 0 12px rgba(0,229,168,.35);transition:width 1s cubic-bezier(.2,.8,.2,1)}
.w-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.w-grid div{background:#151B2B;border:1px solid #232C42;border-radius:10px;padding:6px 8px;display:flex;flex-direction:column;min-width:0}
.w-grid span{font-size:10px;color:#94A3B8;font-weight:600;white-space:nowrap}
.w-grid b{font-size:13px;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.w-foot{font-size:10px;color:#94A3B8;display:flex;justify-content:space-between;gap:8px}
.w-foot .ok{color:#00E5A8}.w-foot .bad{color:#FF5C7A}
@media (max-height:150px){.w-grid,.w-foot{display:none}}
`;

/** Разметка виджета по показателям App.stats() */
function widgetMarkup(s) {
  const planToDate = s.today < CONFIG.startDate ? 0 : Math.floor(CONFIG.goal * Math.min(TOTAL_DAYS, s.daysPassed) / TOTAL_DAYS);
  const delta = s.earned - planToDate;
  const pace = s.goalReached ? '<span class="ok">Цель достигнута 🏆</span>'
    : delta >= 0 ? `<span class="ok">Впереди плана на ${formatCompact(delta)}</span>`
      : `<span class="bad">Отставание ${formatCompact(-delta)}</span>`;
  return `<div class="w" title="Income Tracker — Road to 120 Million">
    <div class="w-head"><span class="w-title">ROAD TO <b>120M</b></span><span class="w-pct">${formatBp(s.percentBp)}</span></div>
    <div class="w-amount">${formatNumber(s.earned)} <small>/ 120 000 000 сум</small></div>
    <div class="w-bar"><div style="width:${s.percentBp / 100}%"></div></div>
    <div class="w-grid">
      <div><span>Осталось</span><b>${formatCompact(s.remaining)}</b></div>
      <div><span>Дней</span><b>${formatNumber(s.daysLeft)}</b></div>
      <div><span>Нужно/день</span><b>${formatCompact(s.perDay)}</b></div>
    </div>
    <div class="w-foot">${pace}<span>${formatDate(s.today)}</span></div>
  </div>`;
}

(function initMiniWindow() {
  let pip = null;

  function paint() {
    if (!pip || pip.closed || !App.state) return;
    pip.document.body.innerHTML = widgetMarkup(App.stats());
  }

  async function openMini() {
    if ('documentPictureInPicture' in window) {
      if (pip && !pip.closed) { pip.focus(); return; }
      try {
        pip = await window.documentPictureInPicture.requestWindow({ width: 340, height: 200 });
        const style = pip.document.createElement('style');
        style.textContent = WIDGET_CSS;
        pip.document.head.appendChild(style);
        document.querySelectorAll('link[href*="fonts.googleapis"]').forEach(l => pip.document.head.appendChild(l.cloneNode()));
        pip.document.title = 'Road to 120M';
        // клик по виджету возвращает к основному окну трекера
        pip.document.addEventListener('click', () => window.focus());
        pip.addEventListener('pagehide', () => { pip = null; });
        paint();
        toast('success', 'Мини-окно открыто', 'Оно остаётся поверх всех окон, пока открыта эта вкладка. Вкладку можно свернуть.');
        return;
      } catch (e) {
        console.warn('Picture-in-Picture недоступен', e);
      }
    }
    // запасной вариант — отдельное маленькое окно
    const w = window.open('widget.html', 'incomeTrackerWidget', 'popup=yes,width=360,height=230,resizable=yes');
    if (!w) toast('error', 'Окно заблокировано', 'Разрешите всплывающие окна или откройте файл widget.html вручную.');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('miniBtn');
    if (btn) btn.addEventListener('click', openMini);

    const settings = document.getElementById('settingsExtra');
    if (settings) {
      settings.insertAdjacentHTML('afterend', `
        <div class="card" id="miniCard">
          <div class="card-head"><h3>Мини-окно на рабочем столе</h3></div>
          <p class="muted small">Маленькое окно с прогрессом, которое висит поверх всех программ. В Chrome и Edge оно открывается поверх всех окон и обновляется сразу после каждого нового дохода. Вкладку трекера при этом можно свернуть, но не закрывать. В других браузерах откроется отдельное маленькое окно <b>widget.html</b>, оно берёт данные из этого же браузера.</p>
          <div class="btn-row"><button class="btn btn-primary" id="miniBtn2">
            <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="2"/><rect x="12" y="11" width="7" height="5" rx="1"/></svg>
            <span>Открыть мини-окно</span></button>
            <a class="btn btn-ghost" href="widget.html" target="_blank" rel="noopener">Открыть widget.html</a></div>
        </div>`);
      document.getElementById('miniBtn2').addEventListener('click', openMini);
    }
  });

  App.onRender(paint);
  // обновление даты и «дней до дедлайна» в мини-окне
  setInterval(paint, 60000);
})();

/* ==========================================================
   Виджет на рабочем столе (Rainmeter)
   Трекер записывает progress.txt в папку скина Rainmeter
   (File System Access API, Chrome / Edge). Скин читает файл
   каждые 10 секунд и рисует прогресс прямо на обоях.
   ========================================================== */
(function initDesktopWidget() {
  const DB = 'incomeTrackerFS', STORE = 'handles', KEY = 'widgetDir';
  const supported = 'showDirectoryPicker' in window && 'indexedDB' in window;
  let dir = null;
  let status = 'none'; // none | ok | permission | error
  let lastWrite = null;
  let timer = null;

  function idb(mode, fn) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => { resolve(req && req.result); open.result.close(); };
        tx.onerror = () => reject(tx.error);
      };
    });
  }

  const plain = (n) => formatNumber(n).replace(/ /g, ' ');

  /** Содержимое progress.txt: ключ=значение, UTF-8 */
  function progressText(s) {
    const planToDate = s.today < CONFIG.startDate ? 0 : Math.floor(CONFIG.goal * Math.min(TOTAL_DAYS, s.daysPassed) / TOTAL_DAYS);
    const delta = s.earned - planToDate;
    const pace = s.goalReached ? 'Цель достигнута!'
      : delta >= 0 ? `Впереди плана на ${formatCompact(delta)}` : `Отставание от плана ${formatCompact(-delta)}`;
    const now = new Date();
    const lines = {
      earned: s.earned,
      goal: CONFIG.goal,
      remaining: s.remaining,
      percent: (s.percentBp / 100).toFixed(2),
      earned_fmt: plain(s.earned),
      remaining_fmt: plain(s.remaining),
      percent_fmt: formatBp(s.percentBp),
      pace: delta >= 0 ? 1 : 0,
      pace_fmt: pace,
      updated: `${formatDate(todayISO())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
      tracker: location.href.split('#')[0],
      end: 1,
    };
    return Object.entries(lines).map(([k, v]) => `${k}=${String(v).replace(/[\r\n]/g, ' ')}`).join('\r\n') + '\r\n';
  }

  async function write() {
    if (!dir || status !== 'ok' || !App.state) return;
    try {
      const fh = await dir.getFileHandle('progress.txt', { create: true });
      const w = await fh.createWritable();
      await w.write(progressText(App.stats()));
      await w.close();
      lastWrite = new Date();
    } catch (e) {
      console.warn('Не удалось записать progress.txt', e);
      status = e && e.name === 'NotAllowedError' ? 'permission' : 'error';
    }
    paintUI();
  }
  const scheduleWrite = () => { clearTimeout(timer); timer = setTimeout(write, 400); };

  async function connect() {
    try {
      const picked = await window.showDirectoryPicker({ id: 'road120m', mode: 'readwrite', startIn: 'documents' });
      dir = picked;
      await idb('readwrite', st => st.put(dir, KEY));
      status = 'ok';
      await write();
      toast('success', 'Виджет подключён', `Прогресс записывается в папку «${dir.name}»`);
    } catch (e) {
      if (e && e.name !== 'AbortError') toast('error', 'Не удалось подключить папку', e.message);
    }
  }

  async function regrant() {
    if (!dir) return connect();
    try {
      const p = await dir.requestPermission({ mode: 'readwrite' });
      status = p === 'granted' ? 'ok' : 'permission';
      if (status === 'ok') { await write(); toast('success', 'Виджет снова обновляется'); }
    } catch (e) { status = 'error'; }
    paintUI();
  }

  async function disconnect() {
    dir = null; status = 'none';
    try { await idb('readwrite', st => st.delete(KEY)); } catch (_) { /* ignore */ }
    paintUI();
  }

  async function restore() {
    if (!supported) return;
    try {
      dir = await idb('readonly', st => st.get(KEY));
      if (!dir) return;
      const p = await dir.queryPermission({ mode: 'readwrite' });
      status = p === 'granted' ? 'ok' : 'permission';
      paintUI();
      if (status === 'ok') write();
    } catch (e) { console.warn(e); }
  }

  function paintUI() {
    const info = document.getElementById('dwStatus');
    if (info) {
      info.innerHTML = !supported
        ? 'Этот браузер не умеет записывать файлы. Откройте трекер в Chrome или Edge.'
        : status === 'ok' ? `<span class="good-text">Подключено</span> · папка «${escapeHtml(dir.name)}»${lastWrite ? ` · обновлено в ${pad2(lastWrite.getHours())}:${pad2(lastWrite.getMinutes())}:${pad2(lastWrite.getSeconds())}` : ''}`
          : status === 'permission' ? `<span class="bad-text">Нужно разрешение</span> · папка «${escapeHtml(dir.name)}»`
            : status === 'error' ? '<span class="bad-text">Ошибка записи</span> · подключите папку заново'
              : 'Папка не подключена';
    }
    const btn = document.getElementById('dwConnect');
    if (btn) btn.querySelector('span').textContent = status === 'permission' ? 'Разрешить запись' : status === 'ok' ? 'Выбрать другую папку' : 'Подключить папку виджета';
    const off = document.getElementById('dwDisconnect');
    if (off) off.hidden = status === 'none';
    const banner = document.getElementById('dwBanner');
    if (banner) banner.hidden = status !== 'permission';
  }

  document.addEventListener('DOMContentLoaded', () => {
    const anchor = document.getElementById('miniCard') || document.getElementById('settingsExtra');
    if (!anchor) return; // страница widget.html
    anchor.insertAdjacentHTML('afterend', `
      <div class="card" id="desktopWidgetCard">
        <div class="card-head"><h3>Виджет на рабочем столе (Windows)</h3></div>
        <p class="muted small">Виджет «Road to 120M» для бесплатной программы Rainmeter висит прямо на обоях, под всеми окнами. Трекер сохраняет прогресс в файл progress.txt в папке виджета, а виджет перечитывает его каждые 10 секунд. Один раз подключите папку <b>Документы\\Rainmeter\\Skins\\Road120M</b>.</p>
        <p class="small" id="dwStatus"></p>
        <div class="btn-row">
          <button class="btn btn-primary" id="dwConnect"><svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg><span>Подключить папку виджета</span></button>
          <button class="btn btn-ghost" id="dwDisconnect" hidden>Отключить</button>
        </div>
      </div>`);
    document.querySelector('.topbar').insertAdjacentHTML('afterend', `
      <div class="dw-banner" id="dwBanner" hidden>
        <span>Виджет на рабочем столе ждёт разрешения, чтобы обновляться.</span>
        <button class="btn btn-primary btn-sm" id="dwBannerBtn">Разрешить</button>
      </div>`);
    document.getElementById('dwConnect').addEventListener('click', () => (status === 'permission' ? regrant() : connect()));
    document.getElementById('dwDisconnect').addEventListener('click', disconnect);
    document.getElementById('dwBannerBtn').addEventListener('click', regrant);
    paintUI();
    restore();
  });

  App.onRender(scheduleWrite);
  // раз в 10 минут — чтобы дата и «отставание от плана» не устаревали
  setInterval(scheduleWrite, 600000);
})();
