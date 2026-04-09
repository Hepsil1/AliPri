/* СчётДетей — Phone SPA */

const API = {
  async req(p, o = {}) {
    const r = await fetch(`/api${p}`, {
      headers: { 'Content-Type': 'application/json' }, ...o,
      body: o.body ? JSON.stringify(o.body) : undefined,
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || 'Ошибка');
    return d;
  },
  get: p => API.req(p),
  post: (p, b) => API.req(p, { method: 'POST', body: b }),
  put: (p, b) => API.req(p, { method: 'PUT', body: b }),
  del: p => API.req(p, { method: 'DELETE' }),
};

/* Toast */
function toast(msg, type = 'info', ms = 2500) {
  const c = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = `toast toast--${type}`;
  t.innerHTML = `<span class="toast__msg">${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 200); }, ms);
}

/* Modal (bottom sheet) */
function modal(title, body, foot) {
  document.getElementById('modal').innerHTML = `
    <div class="overlay" onclick="if(event.target===this)closeModal()">
      <div class="sheet">
        <div class="sheet__bar"></div>
        <div class="sheet__head">
          <div class="sheet__title">${title}</div>
          <button class="sheet__x" onclick="closeModal()">✕</button>
        </div>
        <div class="sheet__body">${body}</div>
        ${foot ? `<div class="sheet__foot">${foot}</div>` : ''}
      </div>
    </div>`;
}
function closeModal() { document.getElementById('modal').innerHTML = ''; }

/* Confetti */
function confetti() {
  const b = document.getElementById('confettiBox');
  const cols = ['#7C6AEF','#22C55E','#EAB308','#EF4444','#22D3EE'];
  for (let i = 0; i < 40; i++) {
    const e = document.createElement('div');
    e.className = 'cf';
    e.style.left = Math.random()*100+'%';
    e.style.background = cols[~~(Math.random()*cols.length)];
    e.style.width = (5+Math.random()*5)+'px';
    e.style.height = e.style.width;
    e.style.animationDuration = (1.2+Math.random()*1.5)+'s';
    e.style.animationDelay = Math.random()*0.3+'s';
    e.style.borderRadius = Math.random()>.5?'50%':'2px';
    b.appendChild(e);
  }
  setTimeout(() => b.innerHTML='', 3000);
}

/* Helpers */
function avColor(n) {
  const c = ['#5B5BD6','#6E56CF','#AB4ABA','#D6395B','#CF6E4E','#557B5B','#3E63DD','#30A46C','#7C6AEF'];
  let h = 0;
  for (let i = 0; i < n.length; i++) h = n.charCodeAt(i) + ((h<<5)-h);
  return c[Math.abs(h)%c.length];
}

function ini(n) { return n.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase(); }
function esc(s) { return s.replace(/'/g,"\\'"); }

function todayStr() {
  const d = new Date();
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const days = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function monthName() {
  const m = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
  return m[new Date().getMonth()];
}

function sw(n) {
  const a = Math.abs(n)%100, b = a%10;
  if (a>10&&a<20) return 'занятий';
  if (b>1&&b<5) return 'занятия';
  if (b===1) return 'занятие';
  return 'занятий';
}

/* Router */
function route() {
  const h = (location.hash||'#/').replace('#','');
  document.querySelectorAll('.nav__item').forEach(t =>
    t.classList.toggle('active', t.getAttribute('href')==='#'+h));

  const m = document.getElementById('mainContent');
  m.innerHTML = '<div class="spin"></div>';

  if (h==='/'||h==='') pageTrain(m);
  else if (h==='/singles') pageSingles(m);
  else if (h==='/groups') pageGroups(m);
  else if (h.startsWith('/group/')) pageGroupDetail(m, h.split('/')[2]);
  else pageTrain(m);
}

/* ═══════════════════════════════════════
   ⚡ ТРЕНИРОВКА — main page
   Only +1 / −1 counter, no limits
   ═══════════════════════════════════════ */
async function pageTrain(m) {
  try {
    const all = await API.get('/athletes');
    const withSub = all.filter(a =>
      a.active_subscription && (a.active_subscription.status==='active'||a.active_subscription.status==='frozen')
    );

    // Group by group
    const groups = {};
    withSub.forEach(a => {
      if (!groups[a.group_id]) groups[a.group_id] = {
        name: a.group_name||'—',
        color: a.group_color||'#7C6AEF',
        items: []
      };
      groups[a.group_id].items.push(a);
    });

    let html = `
      <div class="title">Тренировка</div>
      <div class="date-pill">📅 ${todayStr()}</div>`;

    html += `<div class="search"><input placeholder="Найти..." oninput="filterRows(this.value)"></div>`;

    if (!withSub.length) {
      html += `<div class="empty">
        <div class="empty__icon">⚡</div>
        <div class="empty__title">Нет абонементов</div>
        <div class="empty__desc">Зайдите в «Группы», добавьте спортсменов и выдайте абонемент</div>
      </div>`;
    } else {
      for (const gId of Object.keys(groups)) {
        const g = groups[gId];
        html += `<div class="glabel">
          <div class="glabel__dot" style="background:${g.color}"></div>
          <span class="glabel__name">${g.name}</span>
          <span class="glabel__cnt">${g.items.length}</span>
        </div>`;
        g.items.forEach(a => {
          const s = a.active_subscription;
          const rem = s.total_sessions - s.used_sessions;
          let numClass = 'counter__num--ok';
          if (rem <= 0) numClass = 'counter__num--zero';
          else if (rem <= 1) numClass = 'counter__num--bad';
          else if (rem <= 2) numClass = 'counter__num--warn';

          html += `<div class="row" data-search="${a.name.toLowerCase()}">
            <div class="av" style="background:${avColor(a.name)}">${ini(a.name)}</div>
            <div class="row__info">
              <div class="row__name">${a.name}</div>
              <div class="row__sub">${rem}/${s.total_sessions} ${sw(rem)}</div>
            </div>
            <div class="counter">
              <button class="counter__btn counter__btn--minus" onclick="subPlus(${s.id})">−</button>
              <div class="counter__num ${numClass}">${rem}</div>
              <button class="counter__btn counter__btn--plus" onclick="subMinus(${s.id})">+</button>
            </div>
            <button class="more-btn" onclick="trainMenu(${a.id},'${esc(a.name)}',${s.id})">⋮</button>
          </div>`;
        });
      }
    }

    m.innerHTML = html;
  } catch (e) {
    m.innerHTML = `<div class="empty"><div class="empty__icon">✕</div><div class="empty__title">${e.message}</div></div>`;
  }
}

/* +1 used (remaining goes down) */
async function subPlus(sid) {
  try {
    const r = await API.post(`/subscriptions/${sid}/plus`);
    if (r.alert) {
      if (r.alert.type === 'expired') {
        confetti();
        toast('Абонемент закончился!', 'warn', 4000);
      } else if (r.alert.type === 'low') {
        toast(`Осталось ${r.alert.remaining} ${sw(r.alert.remaining)}`, 'warn');
      }
    } else {
      toast('−1 ✓', 'ok', 1500);
    }
    pageTrain(document.getElementById('mainContent'));
  } catch (e) { toast(e.message, 'bad'); }
}

/* -1 used (remaining goes up) */
async function subMinus(sid) {
  try {
    await API.post(`/subscriptions/${sid}/minus`);
    toast('+1 ↩', 'info', 1500);
    pageTrain(document.getElementById('mainContent'));
  } catch (e) { toast(e.message, 'bad'); }
}

/* Context menu on training row */
function trainMenu(id, name, sid) {
  modal(name, `<div class="menu">
    <button class="menu__item" onclick="closeModal();addSubModal(${id},'${esc(name)}')">🔄 Новый абонемент</button>
    <button class="menu__item" onclick="closeModal();editAthleteModal(${id})">✏️ Редактировать</button>
    <button class="menu__item menu__item--bad" onclick="closeModal();delAthlete(${id},'${esc(name)}')">🗑 Удалить</button>
  </div>`);
}

/* ═══════════════════════════════════════
   💰 РАЗОВЫЕ — single-payment athletes
   
   Как пользоваться:
   1. Спортсмен платит за каждое занятие 
   2. Нажмите «Был» когда он пришёл 
   3. Внизу видно сколько раз приходил за месяц
   ═══════════════════════════════════════ */
async function pageSingles(m) {
  try {
    const data = await API.get('/singles/status');

    let html = `
      <div class="title">Разовые</div>
      <div class="subtitle">Отмечайте кто пришёл — «Был» / «Не был»</div>
      <div class="date-pill">📅 ${todayStr()}</div>`;

    if (!data.length) {
      html += `<div class="empty">
        <div class="empty__icon">💰</div>
        <div class="empty__title">Нет спортсменов с разовой оплатой</div>
        <div class="empty__desc">Добавьте спортсмена в «Группы» и выберите тип оплаты «Разовые»</div>
      </div>`;
    } else {
      const todayMarked = data.filter(a => a.marked_today).length;
      html += `<div class="date-pill" style="margin-bottom:16px">✅ Отмечено сегодня: <b>${todayMarked}</b> из ${data.length}</div>`;

      // Group by group
      const groups = {};
      data.forEach(a => {
        if (!groups[a.group_id]) groups[a.group_id] = { name: a.group_name||'—', color: a.group_color||'#7C6AEF', items: [] };
        groups[a.group_id].items.push(a);
      });

      for (const gId of Object.keys(groups)) {
        const g = groups[gId];
        html += `<div class="glabel">
          <div class="glabel__dot" style="background:${g.color}"></div>
          <span class="glabel__name">${g.name}</span>
          <span class="glabel__cnt">${g.items.length}</span>
        </div>`;

        g.items.forEach(a => {
          html += `<div class="single-row">
            <div class="av" style="background:${avColor(a.name)}">${ini(a.name)}</div>
            <div class="single-info">
              <div class="single-name">${a.name}</div>
              <div class="single-meta">${a.month_count} ${sw(a.month_count)} за ${monthName()}</div>
            </div>
            <button class="mark-btn ${a.marked_today ? 'mark-btn--done' : 'mark-btn--go'}" onclick="toggleSingle(${a.id})">
              ${a.marked_today ? '✓ Был' : 'Отметить'}
            </button>
          </div>`;
        });
      }
    }

    m.innerHTML = html;
  } catch (e) {
    m.innerHTML = `<div class="empty"><div class="empty__icon">✕</div><div class="empty__title">${e.message}</div></div>`;
  }
}

async function toggleSingle(athleteId) {
  try {
    const r = await API.post('/singles/mark', { athlete_id: athleteId });
    toast(r.marked ? '✓ Отмечен' : '↩ Снято', r.marked ? 'ok' : 'info', 1500);
    pageSingles(document.getElementById('mainContent'));
  } catch (e) { toast(e.message, 'bad'); }
}

/* ═══════════════════════════════════════
   📋 ГРУППЫ
   ═══════════════════════════════════════ */
async function pageGroups(m) {
  try {
    const gs = await API.get('/groups');
    let html = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
        <div>
          <div class="title">Группы</div>
          <div class="subtitle">${gs.length} групп</div>
        </div>
        <button class="btn btn--accent" onclick="addGroupModal()">+ Группа</button>
      </div>
      <div class="tiles">`;

    gs.forEach(g => {
      html += `<div class="tile" onclick="location.hash='#/group/${g.id}'" style="--tc:${g.color}">
        <div class="tile__name">${g.name}</div>
        <div class="tile__num">${g.athlete_count}</div>
        <div class="tile__label">спортсменов →</div>
      </div>`;
    });

    html += '</div>';
    m.innerHTML = html;
  } catch (e) {
    m.innerHTML = `<div class="empty"><div class="empty__icon">✕</div><div class="empty__title">${e.message}</div></div>`;
  }
}

/* Group detail */
async function pageGroupDetail(m, gId) {
  try {
    const g = await API.get(`/groups/${gId}`);
    const athletes = await API.get(`/athletes?group_id=${gId}`);

    let html = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
        <div>
          <div class="title" style="display:flex;gap:8px;align-items:center">
            <div class="glabel__dot" style="background:${g.color};width:12px;height:12px"></div>
            ${g.name}
          </div>
          <div class="subtitle">${athletes.length} чел.</div>
        </div>
        <div class="flex gap">
          <button class="btn btn--ghost btn--sm" onclick="location.hash='#/groups'">←</button>
          <button class="btn btn--accent btn--sm" onclick="addAthleteModal(${gId})">+ Спортсмен</button>
        </div>
      </div>`;

    if (!athletes.length) {
      html += `<div class="empty"><div class="empty__icon">👤</div><div class="empty__title">Пусто</div><div class="empty__desc">Добавьте спортсменов</div></div>`;
    } else {
      athletes.forEach(a => {
        const s = a.active_subscription;
        let badge = '';
        if (s && (s.status==='active'||s.status==='frozen')) {
          const rem = s.total_sessions - s.used_sessions;
          badge = `<span style="font-size:12px;color:var(--w2)">${rem}/${s.total_sessions}</span>`;
        } else {
          badge = `<span class="tag-nosub">нет абонемента</span>`;
        }

        html += `<div class="row">
          <div class="av" style="background:${avColor(a.name)}">${ini(a.name)}</div>
          <div class="row__info">
            <div class="row__name">${a.name}</div>
            <div class="row__sub">${a.payment_type==='single' ? 'Разовые' : badge}</div>
          </div>
          <button class="more-btn" onclick="athleteMenu(${a.id},'${esc(a.name)}',${s?s.id:'null'},${gId})">⋮</button>
        </div>`;
      });
    }
    m.innerHTML = html;
  } catch (e) {
    m.innerHTML = `<div class="empty"><div class="empty__icon">✕</div><div class="empty__title">${e.message}</div></div>`;
  }
}

/* Athlete context menu (from group detail) */
function athleteMenu(id, name, sid, gId) {
  let items = '';
  if (!sid) {
    items += `<button class="menu__item" onclick="closeModal();addSubModal(${id},'${esc(name)}')">⚡ Выдать абонемент</button>`;
  } else {
    items += `<button class="menu__item" onclick="closeModal();expireSub(${sid})">⛔ Завершить абонемент</button>`;
    items += `<button class="menu__item" onclick="closeModal();addSubModal(${id},'${esc(name)}')">🔄 Новый абонемент</button>`;
  }
  items += `<button class="menu__item" onclick="closeModal();editAthleteModal(${id})">✏️ Редактировать</button>`;
  items += `<button class="menu__item menu__item--bad" onclick="closeModal();delAthlete(${id},'${esc(name)}')">🗑 Удалить</button>`;
  modal(name, `<div class="menu">${items}</div>`);
}

/* ═══════════════════════════════════════
   CRUD Modals
   ═══════════════════════════════════════ */

/* Add subscription */
function addSubModal(athleteId, name) {
  modal('Новый абонемент', `
    <p style="font-weight:700;margin-bottom:12px">${name}</p>
    <div class="field"><label>Количество занятий</label>
      <select id="mSubN">
        <option value="4">4</option><option value="8" selected>8</option>
        <option value="12">12</option><option value="16">16</option><option value="24">24</option>
      </select></div>
  `, `<button class="btn btn--ghost" onclick="closeModal()">Отмена</button>
      <button class="btn btn--accent" onclick="doAddSub(${athleteId})">Создать</button>`);
}

async function doAddSub(id) {
  const n = +document.getElementById('mSubN').value; closeModal();
  try {
    await API.post('/subscriptions', { athlete_id: id, total_sessions: n });
    confetti();
    toast(`Абонемент на ${n} ${sw(n)} создан`, 'ok');
    route();
  } catch (e) { toast(e.message, 'bad'); }
}

async function expireSub(sid) {
  if (!confirm('Завершить абонемент?')) return;
  try { await API.put(`/subscriptions/${sid}/expire`); toast('Завершён','info'); route(); }
  catch (e) { toast(e.message,'bad'); }
}

/* Add group */
function addGroupModal() {
  modal('Новая группа', `
    <div class="field"><label>Название</label><input id="mGn" placeholder="Начинающие"></div>
    <div class="field-row">
      <div class="field"><label>Цвет</label><input type="color" id="mGc" value="#7C6AEF" style="padding:4px;height:44px"></div>
      <div class="field"><label>Расписание</label><input id="mGs" placeholder="Пн/Ср/Пт"></div>
    </div>
  `, `<button class="btn btn--ghost" onclick="closeModal()">Отмена</button>
      <button class="btn btn--accent" onclick="doAddGroup()">Создать</button>`);
}

async function doAddGroup() {
  const n = document.getElementById('mGn').value;
  if (!n) return toast('Название','warn');
  closeModal();
  try { await API.post('/groups',{name:n,color:document.getElementById('mGc').value,schedule:document.getElementById('mGs').value}); toast('Группа создана','ok'); pageGroups(document.getElementById('mainContent')); }
  catch (e) { toast(e.message,'bad'); }
}

/* Add athlete */
async function addAthleteModal(gId) {
  const gs = await API.get('/groups');
  const opts = gs.map(g=>`<option value="${g.id}" ${g.id==gId?'selected':''}>${g.name}</option>`).join('');
  modal('Новый спортсмен', `
    <div class="field"><label>ФИО</label><input id="mAn" placeholder="Иванов Иван"></div>
    <div class="field"><label>Группа</label><select id="mAg">${opts}</select></div>
    <div class="field-row">
      <div class="field"><label>Телефон</label><input id="mAp" placeholder="+7…"></div>
      <div class="field"><label>Telegram</label><input id="mAt" placeholder="@…"></div>
    </div>
    <div class="field"><label>Тип оплаты</label>
      <select id="mApt"><option value="subscription">Абонемент</option><option value="single">Разовые</option></select></div>
  `, `<button class="btn btn--ghost" onclick="closeModal()">Отмена</button>
      <button class="btn btn--accent" onclick="doAddAthlete()">Добавить</button>`);
}

async function doAddAthlete() {
  const n = document.getElementById('mAn').value;
  if (!n) return toast('Введите ФИО','warn');
  closeModal();
  try {
    await API.post('/athletes',{name:n,group_id:+document.getElementById('mAg').value,phone:document.getElementById('mAp').value,telegram:document.getElementById('mAt').value,payment_type:document.getElementById('mApt').value});
    toast(`${n} добавлен(а)`,'ok'); route();
  } catch (e) { toast(e.message,'bad'); }
}

/* Edit athlete */
async function editAthleteModal(id) {
  const a = await API.get(`/athletes/${id}`);
  const gs = await API.get('/groups');
  const opts = gs.map(g=>`<option value="${g.id}" ${g.id==a.group_id?'selected':''}>${g.name}</option>`).join('');
  modal('Редактировать', `
    <div class="field"><label>ФИО</label><input id="mAn" value="${a.name}"></div>
    <div class="field"><label>Группа</label><select id="mAg">${opts}</select></div>
    <div class="field-row">
      <div class="field"><label>Телефон</label><input id="mAp" value="${a.phone||''}"></div>
      <div class="field"><label>Telegram</label><input id="mAt" value="${a.telegram||''}"></div>
    </div>
    <div class="field"><label>Тип оплаты</label>
      <select id="mApt"><option value="subscription" ${a.payment_type==='subscription'?'selected':''}>Абонемент</option><option value="single" ${a.payment_type==='single'?'selected':''}>Разовые</option></select></div>
  `, `<button class="btn btn--ghost" onclick="closeModal()">Отмена</button>
      <button class="btn btn--accent" onclick="doEditAthlete(${id})">Сохранить</button>`);
}

async function doEditAthlete(id) {
  closeModal();
  try {
    await API.put(`/athletes/${id}`,{name:document.getElementById('mAn').value,group_id:+document.getElementById('mAg').value,phone:document.getElementById('mAp').value,telegram:document.getElementById('mAt').value,payment_type:document.getElementById('mApt').value});
    toast('Сохранено','ok'); route();
  } catch (e) { toast(e.message,'bad'); }
}

/* Delete athlete */
async function delAthlete(id, name) {
  if (!confirm(`Удалить «${name}»?`)) return;
  try { await API.del(`/athletes/${id}`); toast('Удалён','info'); route(); }
  catch (e) { toast(e.message,'bad'); }
}

/* ── Search filter ── */
function filterRows(q) {
  const v = q.toLowerCase().trim();
  document.querySelectorAll('[data-search]').forEach(r => {
    r.style.display = r.dataset.search.includes(v) ? '' : 'none';
  });
}

/* ── Init ── */
window.addEventListener('hashchange', route);
document.addEventListener('DOMContentLoaded', route);
