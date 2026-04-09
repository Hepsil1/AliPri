/* ═══════════════════════════════════════
   СчётДетей — Clean Mobile-First SPA
   ═══════════════════════════════════════ */

const API = {
  base: '/api',
  async req(p, o = {}) {
    const r = await fetch(`${this.base}${p}`, {
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

const Toast = {
  show(msg, type = 'info', ms = 3000) {
    const c = document.getElementById('toastContainer');
    const ic = { ok: '✓', warn: '!', bad: '✕', info: '→' };
    const t = document.createElement('div');
    t.className = `toast toast--${type}`;
    t.innerHTML = `<span class="toast__i">${ic[type] || '→'}</span><span class="toast__m">${msg}</span><button class="toast__x" onclick="this.closest('.toast').remove()">✕</button>`;
    c.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 250); }, ms);
  }
};

const Modal = {
  show(title, body, foot = '') {
    document.getElementById('modalRoot').innerHTML = `
      <div class="modal-bg" onclick="if(event.target===this)Modal.close()">
        <div class="modal">
          <div class="modal__bar"></div>
          <div class="modal__head">
            <div class="modal__title">${title}</div>
            <button class="modal__x" onclick="Modal.close()">✕</button>
          </div>
          <div class="modal__body">${body}</div>
          ${foot ? `<div class="modal__foot">${foot}</div>` : ''}
        </div>
      </div>`;
  },
  close() { document.getElementById('modalRoot').innerHTML = ''; }
};

const Confetti = {
  go() {
    const b = document.getElementById('confettiBox');
    const cols = ['#786CFF', '#4ADE80', '#FBBF24', '#F87171', '#67E8F9', '#9B8FFF'];
    for (let i = 0; i < 50; i++) {
      const e = document.createElement('div');
      e.className = 'cf';
      e.style.left = Math.random() * 100 + '%';
      e.style.background = cols[~~(Math.random() * cols.length)];
      e.style.width = (5 + Math.random() * 6) + 'px';
      e.style.height = (5 + Math.random() * 6) + 'px';
      e.style.animationDuration = (1.2 + Math.random() * 1.8) + 's';
      e.style.animationDelay = Math.random() * 0.4 + 's';
      e.style.borderRadius = Math.random() > 0.5 ? '50%' : '1px';
      b.appendChild(e);
    }
    setTimeout(() => b.innerHTML = '', 3500);
  }
};

// Helpers
function avBg(n) {
  const c = ['#5B5BD6','#6E56CF','#AB4ABA','#E54666','#D65B5B','#D6925B','#5BB98B','#3E63DD','#30A46C'];
  let h = 0;
  for (let i = 0; i < n.length; i++) h = n.charCodeAt(i) + ((h << 5) - h);
  return c[Math.abs(h) % c.length];
}

function ini(n) { return n.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase(); }

function sc(sub) {
  if (!sub) return { r: 0, t: 0, p: 0, l: 'none', s: 'Нет' };
  const r = sub.total_sessions - sub.used_sessions;
  const p = Math.max(0, (r / sub.total_sessions) * 100);
  let l = 'ok';
  if (sub.status === 'frozen') l = 'ice';
  else if (r <= 0) l = 'dead';
  else if (r <= 1) l = 'bad';
  else if (r <= 2) l = 'warn';
  return { r, t: sub.total_sessions, p, l, s: `${r}/${sub.total_sessions}` };
}

function tagH(info, frozen) {
  if (frozen) return `<span class="tag tag--ice">❄ ${info.s}</span>`;
  if (info.l === 'none') return '<span class="tag tag--none">нет абонемента</span>';
  if (info.l === 'dead') return '<span class="tag tag--dead">закончился</span>';
  if (info.l === 'bad') return `<span class="tag tag--bad">${info.s}</span>`;
  if (info.l === 'warn') return `<span class="tag tag--warn">${info.s}</span>`;
  return `<span class="tag tag--ok">${info.s}</span>`;
}

function barH(info) {
  if (info.l === 'none' || info.l === 'ice') return '';
  const c = (info.l === 'dead' || info.l === 'bad') ? 'bad' : info.l === 'warn' ? 'warn' : 'ok';
  return `<div class="bar"><div class="bar__f bar__f--${c}" style="width:${info.p}%"></div></div>`;
}

function ringH(pct, color) {
  const r = 18, c = 2 * Math.PI * r, o = c - (pct / 100) * c;
  return `<svg viewBox="0 0 46 46"><circle class="rbg" cx="23" cy="23" r="${r}"/><circle class="rfill" cx="23" cy="23" r="${r}" stroke="${color}" stroke-dasharray="${c}" stroke-dashoffset="${o}"/></svg>`;
}

function ringC(l) {
  return { ok: '#4ADE80', warn: '#FBBF24', bad: '#F87171', ice: '#67E8F9', dead: '#F87171', none: '#55556A' }[l] || '#786CFF';
}

function sw(n) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return 'занятий';
  if (b > 1 && b < 5) return 'занятия';
  if (b === 1) return 'занятие';
  return 'занятий';
}

const esc = s => s.replace(/'/g, "\\'");

// Router
const R = {
  init() { window.addEventListener('hashchange', () => this.go()); this.go(); },
  go() {
    const h = (location.hash || '#/').replace('#', '');
    document.querySelectorAll('.tab').forEach(t =>
      t.classList.toggle('active', t.getAttribute('href') === '#' + h));
    if (h === '/' || h === '') App.active();
    else if (h === '/free') App.free();
    else if (h === '/groups') App.groups();
    else if (h.startsWith('/group/')) App.groupDetail(h.split('/')[2]);
    else App.active();
  }
};

// ── App ──
const App = {

  // ═════ 💎 АБОНЕМЕНТЫ ═════
  async active() {
    const m = document.getElementById('mainContent');
    m.innerHTML = '<div class="spin"><div class="spin__circle"></div></div>';
    try {
      const all = await API.get('/athletes');
      const ws = all.filter(a => a.active_subscription && (a.active_subscription.status === 'active' || a.active_subscription.status === 'frozen'));

      const bg = {}; let fz = 0, dg = 0;
      ws.forEach(a => {
        if (!bg[a.group_id]) bg[a.group_id] = { n: a.group_name || '—', c: a.group_color || '#786CFF', a: [] };
        bg[a.group_id].a.push(a);
        const i = sc(a.active_subscription);
        if (i.l === 'ice') fz++;
        if (i.l === 'bad' || i.l === 'warn') dg++;
      });

      let h = '';
      h += `<div class="pills">
        <div class="pill pill--accent">⚡ <span class="pill__n">${ws.length}</span> активных</div>
        ${fz ? `<div class="pill pill--ice">❄ <span class="pill__n">${fz}</span> замороз.</div>` : ''}
        ${dg ? `<div class="pill pill--amber">! <span class="pill__n">${dg}</span> заканч.</div>` : ''}
      </div>`;

      h += `<div class="search"><span class="search__icon">🔍</span><input class="search__input" placeholder="Поиск по имени…" oninput="App.filt(this.value)"></div>`;

      if (!ws.length) {
        h += '<div class="empty"><div class="empty__i">⚡</div><div class="empty__t">Нет активных абонементов</div><div class="empty__d">Добавьте спортсменов через «Группы» и выдайте абонемент</div></div>';
      } else {
        for (const gId of Object.keys(bg)) {
          const g = bg[gId];
          h += `<div class="grp"><div class="grp__head"><div class="grp__dot" style="background:${g.c}"></div><span class="grp__name">${g.n}</span><span class="grp__cnt">${g.a.length}</span></div>`;
          g.a.forEach(a => h += this._row(a, 'sub'));
          h += '</div>';
        }
      }

      m.innerHTML = `<div class="hdr"><div><div class="hdr__title">Абонементы</div><div class="hdr__sub">${ws.length} чел.</div></div></div>${h}`;
    } catch (e) { m.innerHTML = `<div class="empty"><div class="empty__i">✕</div><div class="empty__t">${e.message}</div></div>`; }
  },

  // ═════ 👤 БЕЗ АБОНЕМЕНТА ═════
  async free() {
    const m = document.getElementById('mainContent');
    m.innerHTML = '<div class="spin"><div class="spin__circle"></div></div>';
    try {
      const all = await API.get('/athletes');
      const ns = all.filter(a => !a.active_subscription || (a.active_subscription.status !== 'active' && a.active_subscription.status !== 'frozen'));

      const bg = {};
      ns.forEach(a => {
        if (!bg[a.group_id]) bg[a.group_id] = { n: a.group_name || '—', c: a.group_color || '#786CFF', a: [] };
        bg[a.group_id].a.push(a);
      });

      let h = '';
      h += `<div class="search"><span class="search__icon">🔍</span><input class="search__input" placeholder="Поиск по имени…" oninput="App.filt(this.value)"></div>`;

      if (!ns.length) {
        h += '<div class="empty"><div class="empty__i">✓</div><div class="empty__t">У всех есть абонемент</div><div class="empty__d">Или спортсменов пока нет</div></div>';
      } else {
        for (const gId of Object.keys(bg)) {
          const g = bg[gId];
          h += `<div class="grp"><div class="grp__head"><div class="grp__dot" style="background:${g.c}"></div><span class="grp__name">${g.n}</span><span class="grp__cnt">${g.a.length}</span></div>`;
          g.a.forEach(a => h += this._row(a, 'free'));
          h += '</div>';
        }
      }

      m.innerHTML = `<div class="hdr"><div><div class="hdr__title">Разовые</div><div class="hdr__sub">${ns.length} чел.</div></div></div>${h}`;
    } catch (e) { m.innerHTML = `<div class="empty"><div class="empty__i">✕</div><div class="empty__t">${e.message}</div></div>`; }
  },

  // ═════ 📋 ГРУППЫ ═════
  async groups() {
    const m = document.getElementById('mainContent');
    m.innerHTML = '<div class="spin"><div class="spin__circle"></div></div>';
    try {
      const gs = await API.get('/groups');
      let h = '<div class="tiles">';
      gs.forEach(g => {
        h += `<div class="tile" onclick="location.hash='#/group/${g.id}'" style="--tc:${g.color}">
          <div class="tile__edit"><button class="btn btn--icon btn--ghost btn--sm" onclick="event.stopPropagation();App.editGroup(${g.id},'${esc(g.name)}','${g.color}','${esc(g.schedule || '')}')" title="✏️">✏️</button></div>
          <div class="tile__name">${g.name}</div>
          <div class="tile__num">${g.athlete_count}</div>
          <div class="tile__lbl">спортсменов →</div>
          ${g.schedule ? `<div class="tile__sched">📅 ${g.schedule}</div>` : ''}
        </div>`;
      });
      h += '</div>';
      m.innerHTML = `<div class="hdr"><div><div class="hdr__title">Группы</div><div class="hdr__sub">${gs.length} групп</div></div><button class="btn btn--primary" onclick="App.addGroup()">+ Группа</button></div>${h}`;
    } catch (e) { m.innerHTML = `<div class="empty"><div class="empty__i">✕</div><div class="empty__t">${e.message}</div></div>`; }
  },

  // ═════ GROUP DETAIL ═════
  async groupDetail(gId) {
    const m = document.getElementById('mainContent');
    m.innerHTML = '<div class="spin"><div class="spin__circle"></div></div>';
    try {
      const g = await API.get(`/groups/${gId}`);
      const as = await API.get(`/athletes?group_id=${gId}`);
      let h = '';
      if (!as.length) h = '<div class="empty"><div class="empty__i">👤</div><div class="empty__t">Пусто</div><div class="empty__d">Добавьте спортсменов</div></div>';
      else as.forEach(a => h += this._row(a, 'grp'));
      m.innerHTML = `<div class="hdr"><div><div class="hdr__title" style="display:flex;gap:8px;align-items:center"><span class="grp__dot" style="background:${g.color};width:12px;height:12px"></span> ${g.name}</div><div class="hdr__sub">${as.length} чел.</div></div><div class="flex gap-sm"><button class="btn btn--ghost" onclick="location.hash='#/groups'">← Назад</button><button class="btn btn--primary" onclick="App.addAthlete(${gId})">+ Спортсмен</button></div></div>${h}`;
    } catch (e) { m.innerHTML = `<div class="empty"><div class="empty__i">✕</div><div class="empty__t">${e.message}</div></div>`; }
  },

  // ═════ ROW BUILDER ═════
  _row(a, mode) {
    const s = a.active_subscription, info = sc(s), frozen = s && s.status === 'frozen';
    const ne = esc(a.name);
    let acts = '';
    if (mode === 'sub') {
      if (frozen) {
        acts = `<button class="ab ab--sun" onclick="App.unfreeze(${s.id})">☀</button>`;
      } else {
        acts = `<button class="ab ab--star" onclick="App.qm(${a.id},'present')">⭐</button>
                <button class="ab ab--down" onclick="App.qm(${a.id},'absent_counted')">−</button>
                <button class="ab ab--ice" onclick="App.freeze(${s.id})">❄</button>
                <button class="ab ab--undo" onclick="App.undo(${a.id})">↩</button>`;
      }
    } else if (mode === 'free') {
      acts = `<button class="ab ab--add" onclick="App.addSub(${a.id},'${ne}')">+</button>
              <button class="ab ab--pay" onclick="App.singlePay(${a.id},'${ne}')">₽</button>`;
    }
    acts += `<button class="ab ab--dot" onclick="App.amenu(${a.id},'${ne}',${s ? s.id : 'null'})">⋮</button>`;

    const hasRing = s && s.status === 'active';
    const avHtml = hasRing
      ? `<div class="av-wrap"><div class="av" style="background:${avBg(a.name)}">${ini(a.name)}</div>${ringH(info.p, ringC(info.l))}</div>`
      : `<div class="av" style="background:${avBg(a.name)}">${ini(a.name)}</div>`;

    return `<div class="row searchable" data-n="${a.name.toLowerCase()}">
      ${avHtml}
      <div class="row__info">
        <div class="row__name">${a.name}</div>
        <div class="row__meta">
          ${s ? tagH(info, frozen) : (a.payment_type === 'single' ? '<span class="tag tag--single">разовые</span>' : '<span class="tag tag--none">нет абонемента</span>')}
          ${hasRing ? barH(info) : ''}
        </div>
      </div>
      <div class="row__acts">${acts}</div>
    </div>`;
  },

  // ═════ SEARCH ═════
  filt(q) {
    const v = q.toLowerCase().trim();
    document.querySelectorAll('.row.searchable').forEach(r => {
      r.style.display = (r.dataset.n || '').includes(v) ? '' : 'none';
    });
  },

  // ═════ ACTIONS ═════
  async qm(id, status) {
    try {
      const r = await API.post('/attendance/quick', { athlete_id: id, status });
      if (r.alert) {
        if (r.alert.type === 'subscription_expired') {
          Confetti.go();
          Toast.show('Абонемент закончился!', 'warn', 4000);
          setTimeout(() => this.active(), 300);
          return;
        }
        if (r.alert.type === 'subscription_expiring') Toast.show(`Осталось ${r.alert.remaining} ${sw(r.alert.remaining)}`, 'warn', 3500);
        if (r.alert.type === 'no_subscription') { Toast.show('Нет абонемента', 'bad'); return; }
      }
      Toast.show(status === 'present' ? '⭐ +1 занятие' : '−1 списано', 'ok');
      this.active();
    } catch (e) { Toast.show(e.message, 'bad'); }
  },

  async undo(id) {
    try { await API.post('/attendance/undo-last', { athlete_id: id }); Toast.show('↩ Отменено', 'info'); this.active(); }
    catch (e) { Toast.show(e.message, 'bad'); }
  },

  freeze(sid) {
    Modal.show('Заморозить', `
      <div class="fi"><label class="fi__label">Причина</label>
        <select class="fi__select" id="fR">
          <option value="Болезнь">Болезнь</option><option value="Травма">Травма</option>
          <option value="Отпуск">Отпуск</option><option value="Другое">Другое</option>
        </select></div>
    `, `<button class="btn btn--ghost" onclick="Modal.close()">Отмена</button><button class="btn btn--primary" onclick="App.doFreeze(${sid})">Заморозить</button>`);
  },

  async doFreeze(sid) {
    Modal.close();
    try { await API.put(`/subscriptions/${sid}/freeze`, { reason: document.getElementById('fR').value }); Toast.show('❄ Заморожен', 'info'); this.active(); }
    catch (e) { Toast.show(e.message, 'bad'); }
  },

  async unfreeze(sid) {
    try { await API.put(`/subscriptions/${sid}/unfreeze`); Toast.show('☀ Разморожен', 'ok'); this.active(); }
    catch (e) { Toast.show(e.message, 'bad'); }
  },

  addSub(id, name) {
    Modal.show('Новый абонемент', `
      <p style="margin-bottom:12px;font-weight:600">${name}</p>
      <div class="fi"><label class="fi__label">Занятий</label>
        <select class="fi__select" id="sN">
          <option value="4">4</option><option value="8" selected>8</option>
          <option value="12">12</option><option value="16">16</option>
        </select></div>
    `, `<button class="btn btn--ghost" onclick="Modal.close()">Отмена</button><button class="btn btn--green" onclick="App.doAddSub(${id})">Создать</button>`);
  },

  async doAddSub(id) {
    const n = +document.getElementById('sN').value; Modal.close();
    try { await API.post('/subscriptions', { athlete_id: id, total_sessions: n }); Confetti.go(); Toast.show(`Абонемент на ${n} ${sw(n)}`, 'ok'); const h = location.hash; if (h === '#/free') this.free(); else R.go(); }
    catch (e) { Toast.show(e.message, 'bad'); }
  },

  singlePay(id, name) {
    Modal.show('Разовая', `
      <p style="margin-bottom:12px;font-weight:600">${name}</p>
      <div class="fi"><label class="fi__label">Сумма ₽</label><input type="number" class="fi__input" id="spA" value="500"></div>
    `, `<button class="btn btn--ghost" onclick="Modal.close()">Отмена</button><button class="btn btn--primary" onclick="App.doSP(${id})">Оплата</button>`);
  },

  async doSP(id) {
    const a = +document.getElementById('spA').value || 0; Modal.close();
    try { await API.post('/attendance/quick', { athlete_id: id, status: 'single_pay', amount_paid: a }); Toast.show(`${a}₽ оплачено`, 'ok'); }
    catch (e) { Toast.show(e.message, 'bad'); }
  },

  amenu(id, name, sid) {
    let items = '';
    if (sid) {
      items += `<button class="mi" onclick="Modal.close();App.tg('${esc(name)}')">📱 Telegram текст</button>`;
      items += `<button class="mi" onclick="Modal.close();App.expSub(${sid})">⛔ Завершить абонемент</button>`;
    } else {
      items += `<button class="mi" onclick="Modal.close();App.addSub(${id},'${esc(name)}')">⚡ Выдать абонемент</button>`;
    }
    items += `<button class="mi" onclick="Modal.close();App.editAth(${id})">✏️ Редактировать</button>`;
    items += `<button class="mi mi--bad" onclick="Modal.close();App.delAth(${id},'${esc(name)}')">🗑 Удалить</button>`;
    Modal.show(name, `<div class="menu">${items}</div>`);
  },

  tg(name) {
    const f = name.split(' ')[0];
    const msg = `Привет! Абонемент ${f} закончился. Последнее занятие — сегодня. Для продления напиши мне!`;
    Modal.show('Telegram', `
      <p style="font-size:12px;color:var(--text-3);margin-bottom:8px">Скопируйте и отправьте:</p>
      <div class="tg" id="tgT">${msg}</div>
      <button class="btn btn--primary btn--sm" style="margin-top:12px" onclick="navigator.clipboard.writeText(document.getElementById('tgT').innerText);Toast.show('Скопировано','ok')">📋 Копировать</button>
    `);
  },

  async expSub(sid) {
    if (!confirm('Завершить абонемент?')) return;
    try { await API.put(`/subscriptions/${sid}/expire`); Toast.show('Завершён', 'info'); R.go(); }
    catch (e) { Toast.show(e.message, 'bad'); }
  },

  // ── GROUPS CRUD ──
  addGroup() {
    Modal.show('Новая группа', `
      <div class="fi"><label class="fi__label">Название</label><input class="fi__input" id="gN" placeholder="Начинающие"></div>
      <div class="fi-row">
        <div class="fi"><label class="fi__label">Цвет</label><input type="color" class="fi__input" id="gC" value="#786CFF" style="padding:4px;height:44px"></div>
        <div class="fi"><label class="fi__label">Расписание</label><input class="fi__input" id="gS" placeholder="Пн/Ср/Пт"></div>
      </div>
    `, `<button class="btn btn--ghost" onclick="Modal.close()">Отмена</button><button class="btn btn--primary" onclick="App.doAddG()">Создать</button>`);
  },

  async doAddG() {
    const n = document.getElementById('gN').value; if (!n) return Toast.show('Введите название', 'warn');
    Modal.close();
    try { await API.post('/groups', { name: n, color: document.getElementById('gC').value, schedule: document.getElementById('gS').value }); Toast.show(`«${n}» создана`, 'ok'); this.groups(); }
    catch (e) { Toast.show(e.message, 'bad'); }
  },

  editGroup(id, name, color, sched) {
    Modal.show('Редактировать', `
      <div class="fi"><label class="fi__label">Название</label><input class="fi__input" id="gN" value="${name}"></div>
      <div class="fi-row">
        <div class="fi"><label class="fi__label">Цвет</label><input type="color" class="fi__input" id="gC" value="${color}" style="padding:4px;height:44px"></div>
        <div class="fi"><label class="fi__label">Расписание</label><input class="fi__input" id="gS" value="${sched}"></div>
      </div>
    `, `<button class="btn btn--ghost" onclick="Modal.close()">Отмена</button><button class="btn btn--primary" onclick="App.doEditG(${id})">Сохранить</button>`);
  },

  async doEditG(id) {
    Modal.close();
    try { await API.put(`/groups/${id}`, { name: document.getElementById('gN').value, color: document.getElementById('gC').value, schedule: document.getElementById('gS').value }); Toast.show('Сохранено', 'ok'); this.groups(); }
    catch (e) { Toast.show(e.message, 'bad'); }
  },

  // ── ATHLETES CRUD ──
  async addAthlete(gId) {
    const gs = await API.get('/groups');
    const opts = gs.map(g => `<option value="${g.id}" ${g.id == gId ? 'selected' : ''}>${g.name}</option>`).join('');
    Modal.show('Новый спортсмен', `
      <div class="fi"><label class="fi__label">ФИО</label><input class="fi__input" id="aN" placeholder="Иванов Иван"></div>
      <div class="fi"><label class="fi__label">Группа</label><select class="fi__select" id="aG">${opts}</select></div>
      <div class="fi-row">
        <div class="fi"><label class="fi__label">Телефон</label><input class="fi__input" id="aP" placeholder="+7…"></div>
        <div class="fi"><label class="fi__label">Telegram</label><input class="fi__input" id="aT" placeholder="@…"></div>
      </div>
      <div class="fi"><label class="fi__label">Тип оплаты</label>
        <select class="fi__select" id="aPT"><option value="subscription">Абонемент</option><option value="single">Разовые</option></select></div>
    `, `<button class="btn btn--ghost" onclick="Modal.close()">Отмена</button><button class="btn btn--primary" onclick="App.doAddA()">Добавить</button>`);
  },

  async doAddA() {
    const n = document.getElementById('aN').value; if (!n) return Toast.show('Введите ФИО', 'warn');
    Modal.close();
    try { await API.post('/athletes', { name: n, group_id: +document.getElementById('aG').value, phone: document.getElementById('aP').value, telegram: document.getElementById('aT').value, payment_type: document.getElementById('aPT').value }); Toast.show(`${n} добавлен(а)`, 'ok'); R.go(); }
    catch (e) { Toast.show(e.message, 'bad'); }
  },

  async editAth(id) {
    const a = await API.get(`/athletes/${id}`);
    const gs = await API.get('/groups');
    const opts = gs.map(g => `<option value="${g.id}" ${g.id == a.group_id ? 'selected' : ''}>${g.name}</option>`).join('');
    Modal.show('Редактировать', `
      <div class="fi"><label class="fi__label">ФИО</label><input class="fi__input" id="aN" value="${a.name}"></div>
      <div class="fi"><label class="fi__label">Группа</label><select class="fi__select" id="aG">${opts}</select></div>
      <div class="fi-row">
        <div class="fi"><label class="fi__label">Телефон</label><input class="fi__input" id="aP" value="${a.phone || ''}"></div>
        <div class="fi"><label class="fi__label">Telegram</label><input class="fi__input" id="aT" value="${a.telegram || ''}"></div>
      </div>
      <div class="fi"><label class="fi__label">Тип оплаты</label>
        <select class="fi__select" id="aPT"><option value="subscription" ${a.payment_type === 'subscription' ? 'selected' : ''}>Абонемент</option><option value="single" ${a.payment_type === 'single' ? 'selected' : ''}>Разовые</option></select></div>
    `, `<button class="btn btn--ghost" onclick="Modal.close()">Отмена</button><button class="btn btn--primary" onclick="App.doEditA(${id})">Сохранить</button>`);
  },

  async doEditA(id) {
    Modal.close();
    try { await API.put(`/athletes/${id}`, { name: document.getElementById('aN').value, group_id: +document.getElementById('aG').value, phone: document.getElementById('aP').value, telegram: document.getElementById('aT').value, payment_type: document.getElementById('aPT').value }); Toast.show('Сохранено', 'ok'); R.go(); }
    catch (e) { Toast.show(e.message, 'bad'); }
  },

  async delAth(id, name) {
    if (!confirm(`Удалить «${name}»?`)) return;
    try { await API.del(`/athletes/${id}`); Toast.show(`${name} удалён(а)`, 'info'); R.go(); }
    catch (e) { Toast.show(e.message, 'bad'); }
  },
};

document.addEventListener('DOMContentLoaded', () => R.init());
