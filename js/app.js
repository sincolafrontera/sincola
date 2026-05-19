// ===================================================
// app.js — Controlador principal SinCola v2.2
// ===================================================

'use strict';

const App = (() => {

  let currentUser = null;
  let allReportes = [];
  let reportModal_openedAt = 0;
  let unsubs = [];

  // ── DOM helpers ─────────────────────────────────
  const $ = id => document.getElementById(id);
  const $$ = sel => document.querySelectorAll(sel);

  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'className')                           node.className = v;
      else if (k === 'textContent')                    node.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else                                             node.setAttribute(k, v);
    }
    children.forEach(c => {
      if (!c) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  // ── Toast ────────────────────────────────────────
  let toastTimer = null;
  function showToast(title, sub = '', type = 'success') {
    const icons = { success: '🎉', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const t = $('toast');
    if (!t) return;
    $('toastIcon').textContent  = icons[type] ?? '🎉';
    $('toastTitle').textContent = title;
    $('toastSub').textContent   = sub;
    t.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('visible'), 3500);
  }

  // ── Navegación ───────────────────────────────────
  function showPage(page) {
    $('homePage').classList.toggle('active', page === 'home');
    $('contactPage').classList.toggle('active', page === 'contact');
    window.scrollTo(0, 0);
  }

  // ── Tema ─────────────────────────────────────────
  function toggleTheme() {
    const isLight = document.body.getAttribute('data-theme') === 'light';
    document.body.setAttribute('data-theme', isLight ? 'dark' : 'light');
    $('themeBtn').textContent = isLight ? '🌙' : '☀️';
    try { localStorage.setItem('sc_theme', isLight ? 'dark' : 'light'); } catch {}
  }

  function initTheme() {
    try {
      const saved = localStorage.getItem('sc_theme');
      if (saved) document.body.setAttribute('data-theme', saved);
      $('themeBtn').textContent = saved === 'light' ? '☀️' : '🌙';
    } catch {}
  }

  // ── Hero slideshow ───────────────────────────────
  function initHero() {
    let current = 0;
    const slides = $$('.hero__slide');
    const dots   = $$('.hero__dot');
    if (!slides.length) return;

    function goTo(n) {
      slides[current].classList.remove('active');
      dots[current].classList.remove('active');
      current = (n + slides.length) % slides.length;
      slides[current].classList.add('active');
      dots[current].classList.add('active');
    }

    window._heroGoTo = goTo;
    setInterval(() => goTo(current + 1), 4500);
  }

  // ── Timer "actualizado hace X min" ───────────────
  let minAgo = 0;
  let updateTimer;

  function startUpdateTimer() {
    clearInterval(updateTimer);
    minAgo = 0;
    const lu = $('lastUpdate');
    if (lu) lu.textContent = 'Actualizado ahora mismo';
    updateTimer = setInterval(() => {
      minAgo++;
      const lu = $('lastUpdate');
      if (lu) lu.textContent = `Actualizado hace ${minAgo} min`;
    }, 60000);
  }

  // ── Estado de la frontera ─────────────────────────

  // Textos de tiempo por nivel para los segmentos
  const SEG_TIMES = {
    stale:  { peat: '—',     coche: '—',     moto: '—'    },
    Poca:   { peat: 'Libre', coche: '15 min', moto: '5 min' },
    Media:  { peat: '30 min', coche: '25 min', moto: '15 min' },
    Mucha:  { peat: '+1h',   coche: '40 min', moto: '25 min' },
  };

  const SEG_COLOR = {
    stale: 'green',
    Poca:  'green',
    Media: 'yellow',
    Mucha: 'red',
  };

  function updateDirectionUI(dir, estado) {
    const prefix   = dir === 'entrada' ? 'Entrada' : 'Salida';
    const statusEl = $(`status${prefix}`);
    const waitEl   = $(`wait${prefix}`);
    const iconEl   = $(`icon${prefix}`);
    const fillEl   = $(`fill${prefix}`);
    const segPeat  = $(`seg${prefix}Peat`);
    const segCoche = $(`seg${prefix}Coche`);
    const segMoto  = $(`seg${prefix}Moto`);

    if (!statusEl) return;

    // Limpiar clases anteriores
    ['green', 'yellow', 'red'].forEach(c => {
      statusEl.classList.remove(`status-label--${c}`);
      iconEl.classList.remove(`status-icon--${c}`);
      fillEl.classList.remove(`progress-fill--${c}`);
    });

    if (estado.stale) {
      iconEl.textContent = '❓';
      iconEl.classList.add('status-icon--green');
      statusEl.textContent = 'SIN DATOS AÚN';
      statusEl.classList.add('status-label--green');
      waitEl.textContent = 'Sé el primero en reportar';
      fillEl.style.width = '5%';
      fillEl.classList.add('progress-fill--green');

      // Segmentos en vacío
      const times = SEG_TIMES.stale;
      const cls   = SEG_COLOR.stale;
      if (segPeat)  { segPeat.textContent  = times.peat;  segPeat.className  = `segment__val segment__val--${cls}`; }
      if (segCoche) { segCoche.textContent = times.coche; segCoche.className = `segment__val segment__val--${cls}`; }
      if (segMoto)  { segMoto.textContent  = times.moto;  segMoto.className  = `segment__val segment__val--${cls}`; }

    } else {
      iconEl.textContent = estado.emoji;
      iconEl.classList.add(`status-icon--${estado.cls}`);
      statusEl.textContent = estado.label;
      statusEl.classList.add(`status-label--${estado.cls}`);
      waitEl.textContent = estado.wait + ' de espera estimada';
      fillEl.style.width = estado.pct + '%';
      fillEl.classList.add(`progress-fill--${estado.cls}`);

      // Segmentos con datos reales según nivel
      const times = SEG_TIMES[estado.nivelRaw] ?? SEG_TIMES.Media;
      const cls   = SEG_COLOR[estado.nivelRaw] ?? 'yellow';
      if (segPeat)  { segPeat.textContent  = times.peat;  segPeat.className  = `segment__val segment__val--${cls}`; }
      if (segCoche) { segCoche.textContent = times.coche; segCoche.className = `segment__val segment__val--${cls}`; }
      if (segMoto)  { segMoto.textContent  = times.moto;  segMoto.className  = `segment__val segment__val--${cls}`; }
    }
  }

  function recalcularEstado() {
    const estadoEntrada = StatusEngine.calcularEstado(allReportes, 'entrada');
    const estadoSalida  = StatusEngine.calcularEstado(allReportes, 'salida');
    updateDirectionUI('entrada', estadoEntrada);
    updateDirectionUI('salida',  estadoSalida);
  }

  // ── Historial: vacío vs con datos ────────────────
  function updateHistorico() {
    const vacio  = $('historicoVacio');
    const charts = $('historicoCharts');
    if (!vacio || !charts) return;

    if (allReportes.length > 0) {
      vacio.style.display  = 'none';
      charts.style.display = 'block';
    } else {
      vacio.style.display  = 'block';
      charts.style.display = 'none';
    }
  }

  // ── Timeline ─────────────────────────────────────
  function initTimeline() {
    const hrs = [
      { h: '6h',  v: 10,  c: 'var(--green)'  },
      { h: '7h',  v: 15,  c: 'var(--green)'  },
      { h: '8h',  v: 22,  c: 'var(--green)'  },
      { h: '9h',  v: 45,  c: 'var(--yellow)' },
      { h: '10h', v: 60,  c: 'var(--yellow)' },
      { h: '11h', v: 70,  c: 'var(--yellow)' },
      { h: '12h', v: 100, c: 'var(--red)'    },
      { h: '13h', v: 95,  c: 'var(--red)'    },
      { h: '14h', v: 85,  c: 'var(--red)'    },
      { h: '15h', v: 55,  c: 'var(--yellow)' },
      { h: '16h', v: 50,  c: 'var(--yellow)' },
      { h: '17h', v: 90,  c: 'var(--red)'    },
      { h: '18h', v: 80,  c: 'var(--red)'    },
      { h: '19h', v: 55,  c: 'var(--yellow)' },
      { h: '20h', v: 40,  c: 'var(--yellow)' },
      { h: '21h', v: 25,  c: 'var(--green)'  },
      { h: '22h', v: 15,  c: 'var(--green)'  },
    ];

    const container = $('timelineChart');
    if (!container) return;
    container.innerHTML = '';

    hrs.forEach(h => {
      const wrap = el('div', { className: 'bar-chart__item' });
      const bar  = el('div', { className: 'bar-chart__bar', style: { height: `${h.v}%`, background: h.c, opacity: '0.85' } });
      const lbl  = el('span', { className: 'bar-chart__label' }, h.h);
      wrap.append(bar, lbl);
      container.appendChild(wrap);
    });
  }

  // ── Gráficos histórico ────────────────────────────
  function initCharts() {
    const ds = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    const wd = {
      P: [45, 62, 38, 75, 90, 110, 55],
      M: [18, 25, 15, 30, 42, 50, 22],
      C: [30, 48, 25, 55, 70, 85, 38],
    };
    const ph = {
      P: ['13:30', '12:45', '14:00', '13:15', '17:30', '12:00', '16:00'],
      M: ['12:00', '13:30', '11:45', '14:00', '18:00', '13:00', '15:30'],
      C: ['13:00', '12:30', '13:45', '14:30', '17:45', '12:30', '16:30'],
    };

    function showPeak(pkId, key, i, val, color) {
      const pk = $(pkId);
      if (!pk) return;
      pk.classList.add('active');
      pk.querySelector('.peak-day').textContent = ds[i];
      const pv = pk.querySelector('.peak-val');
      pv.textContent      = `${val} min`;
      pv.style.color      = color;
      pv.style.fontSize   = '1.3rem';
      pv.style.fontWeight = '800';
      pv.style.flex       = '1';
      pk.querySelector('.peak-hora').textContent = `pico a las ${ph[key][i]}`;
    }

    function renderChart(elId, data, color, pkId, key) {
      const container = $(elId);
      if (!container) return 0;
      const max = Math.max(...data);
      const avg = Math.round(data.reduce((a, b) => a + b) / data.length);
      container.innerHTML = '';

      data.forEach((val, i) => {
        const pct  = Math.round((val / max) * 100);
        const wrap = document.createElement('div');
        wrap.className = 'week-chart__item';

        const bar = document.createElement('div');
        bar.className        = 'week-chart__bar';
        bar.style.height     = `${pct}%`;
        bar.style.background = color;
        bar.style.opacity    = i === 5 ? '1' : '0.5';

        const lbl = document.createElement('span');
        lbl.className      = 'week-chart__label';
        lbl.textContent    = ds[i];
        lbl.style.color    = i === 5 ? 'var(--text)' : 'var(--muted)';
        lbl.style.fontWeight = i === 5 ? '700' : '400';

        wrap.appendChild(bar);
        wrap.appendChild(lbl);

        wrap.addEventListener('click', () => {
          container.querySelectorAll('.week-chart__bar').forEach(b => {
            b.style.opacity = '0.45';
            b.style.filter  = 'none';
          });
          bar.style.opacity = '1';
          bar.style.filter  = 'brightness(1.3)';
          showPeak(pkId, key, i, val, color);
        });

        wrap.addEventListener('mouseenter', () => {
          if (bar.style.opacity !== '1') bar.style.filter = 'brightness(1.25)';
        });
        wrap.addEventListener('mouseleave', () => {
          if (bar.style.opacity !== '1') bar.style.filter = 'none';
        });

        container.appendChild(wrap);
      });

      setTimeout(() => {
        container.querySelectorAll('.week-chart__bar').forEach((b, i) => {
          const h = b.style.height;
          b.style.height     = '0';
          b.style.transition = `height .6s cubic-bezier(.34,1.1,.64,1) ${i * 0.05}s`;
          requestAnimationFrame(() => { b.style.height = h; });
        });
      }, 200);

      return avg;
    }

    const avgP = renderChart('chP', wd.P, 'var(--yellow)', 'pkP', 'P');
    const avgM = renderChart('chM', wd.M, 'var(--green)',  'pkM', 'M');
    const avgC = renderChart('chC', wd.C, 'var(--red)',    'pkC', 'C');

    if ($('avgP')) $('avgP').textContent = avgP;
    if ($('avgM')) $('avgM').textContent = avgM;
    if ($('avgC')) $('avgC').textContent = avgC;
  }

  // ── Feed ─────────────────────────────────────────
  function tiempoDesde(timestamp) {
    if (!timestamp) return 'Ahora';
    const fecha = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diff  = Math.floor((Date.now() - fecha) / 60000);
    if (diff < 1)  return 'Ahora mismo';
    if (diff < 60) return `Hace ${diff} min`;
    return `Hace ${Math.floor(diff / 60)}h`;
  }

  function createFeedItem(data) {
    const tagCls  = data.nivel === 'Poca' ? 'green' : data.nivel === 'Mucha' ? 'red' : 'yellow';
    const emoji   = data.nivel === 'Poca' ? '😌' : data.nivel === 'Mucha' ? '😤' : '😐';
    const usuario = data.usuario || 'Anónimo';
    const hace    = tiempoDesde(data.timestamp);

    const item   = el('div', { className: 'feed__item' });
    const avatar = el('div', { className: 'feed__avatar' }, emoji);
    const body   = el('div', { className: 'feed__body' });
    const user   = el('div', { className: 'feed__user', textContent: usuario });
    const msg    = el('div', { className: 'feed__msg' });

    msg.appendChild(document.createTextNode(`${data.direccion ?? ''} · ${data.tipo ?? ''} `));
    msg.appendChild(el('span', { className: `feed__tag feed__tag--${tagCls}` }, `${data.nivel} cola`));

    const timeEl = el('div', { className: 'feed__time' });
    let timeText = hace;
    if (data.policia) timeText += ` · ${data.policia}`;
    if (parseInt(data.horas) > 0 || parseInt(data.minutos) > 0) {
      timeText += ` · ${data.horas}h ${data.minutos}min espera`;
    }
    timeEl.textContent = timeText;

    body.append(user, msg, timeEl);

    const pts = el('div', { className: 'feed__pts' });
    if (data.puntos) pts.textContent = `+${data.puntos} pts`;

    item.append(avatar, body, pts);
    return item;
  }

  function renderFeed(snapshot) {
    const feedEl = $('feedReal');
    if (!feedEl) return;

    if (snapshot.empty) {
      feedEl.innerHTML = '';
      feedEl.appendChild(el('div', { className: 'feed__empty' },
        '🌟 Aún no hay reportes. ¡Sé el primero!'));
      return;
    }

    const existingIds = new Set(
      [...feedEl.querySelectorAll('[data-id]')].map(n => n.dataset.id)
    );

    feedEl.querySelectorAll('[data-id]').forEach(node => {
      if (!snapshot.docs.some(d => d.id === node.dataset.id)) {
        feedEl.removeChild(node);
      }
    });

    const fragment = document.createDocumentFragment();
    snapshot.forEach(doc => {
      if (existingIds.has(doc.id)) return;
      const item = createFeedItem(doc.data());
      item.dataset.id = doc.id;
      fragment.appendChild(item);
    });

    if (fragment.childNodes.length > 0) {
      feedEl.prepend(fragment);
    }

    const emptyMsg = feedEl.querySelector('.feed__empty');
    if (emptyMsg && feedEl.querySelectorAll('[data-id]').length > 0) {
      emptyMsg.remove();
    }
  }

  // ── Ranking ──────────────────────────────────────
  function renderRanking(docs) {
    const list = $('rankingList');
    if (!list) return;
    list.innerHTML = '';

    if (docs.length === 0) {
      list.appendChild(el('div', { className: 'rank-loading' },
        '¡Aún no hay nadie! Reporta para ser el primero.'));
      return;
    }

    const medalEmoji   = ['👑', '🥈', '🥉'];
    const numCls       = ['rank-num--gold', 'rank-num--silver', 'rank-num--bronze'];
    const avatarEmojis = ['🦁', '🎯', '⭐', '🚀', '💫', '🔥', '🌟', '🎪', '🎭', '🎨'];

    docs.forEach((doc, i) => {
      const data   = doc.data();
      const nombre = data.nombre || 'Anónimo';
      const puntos = data.puntos ?? data.puntosSemanal ?? 0;

      const row    = el('div', { className: 'rank-row' });
      const num    = el('div', { className: `rank-num ${numCls[i] ?? ''}`, textContent: String(i + 1) });
      const avatar = el('div', { className: 'rank-avatar' }, medalEmoji[i] ?? avatarEmojis[i % avatarEmojis.length]);
      const name   = el('div', { className: 'rank-name', textContent: nombre });
      const badge  = el('span', { className: 'rank-badge' }, i < 3 ? '🏅' : '');
      const ptsEl  = el('div', { className: 'rank-pts' }, `${puntos.toLocaleString('es')} pts`);

      row.append(num, avatar, name, badge, ptsEl);
      list.appendChild(row);
    });
  }

  function initRanking() {
    const semBtn = $('rankTabSemanal');
    const totBtn = $('rankTabTotal');
    let currentUnsub = null;

    function loadRanking(type) {
      semBtn?.classList.toggle('active', type === 'semanal');
      totBtn?.classList.toggle('active', type === 'total');
      semBtn?.setAttribute('aria-selected', String(type === 'semanal'));
      totBtn?.setAttribute('aria-selected', String(type === 'total'));

      if (currentUnsub) currentUnsub();

      const field = type === 'semanal' ? 'puntosSemanal' : 'puntos';
      currentUnsub = db.collection('usuarios')
        .orderBy(field, 'desc')
        .limit(10)
        .onSnapshot(snap => renderRanking(snap.docs), err => {
          console.error('[Ranking]', err);
        });
    }

    semBtn?.addEventListener('click', () => loadRanking('semanal'));
    totBtn?.addEventListener('click', () => loadRanking('total'));
    loadRanking('semanal');
  }

  // ── Auth ─────────────────────────────────────────
  function openLogin()  { $('loginModal')?.classList.add('open'); }
  function closeLogin() { $('loginModal')?.classList.remove('open'); }

  async function loginGoogle() {
    try {
      const result = await auth.signInWithPopup(googleProvider);
      closeLogin();
      showToast(`¡Bienvenido ${result.user.displayName}!`, 'Ya puedes ganar puntos 🎯');
    } catch (err) {
      console.error('[Auth]', err);
      if (err.code === 'auth/operation-not-supported-in-this-environment') {
        showToast('Abre la web en internet', 'El login no funciona desde un archivo local', 'error');
      } else {
        showToast('Error al iniciar sesión', err.message, 'error');
      }
    }
  }

  function updateNavAuth(user) {
    const btn = $('loginNavBtn');
    if (!btn) return;
    if (user) {
      btn.textContent = user.displayName || user.email;
      btn.classList.add('logged');
    } else {
      btn.textContent = 'Iniciar sesión · Registrar';
      btn.classList.remove('logged');
    }
  }

  // ── Reporte ──────────────────────────────────────
  let selDir    = '🇲🇦→🇪🇸 Entrando';
  let selTipo   = '🚶 Peatonal';
  let selNivel  = 'Media';
  let selPolicia = '';

  function updateRepBanner() {
    const nameEl = $('repName');
    const linkEl = $('repLoginLink');
    if (!nameEl) return;
    if (currentUser) {
      nameEl.textContent = `✅ ${currentUser.displayName || currentUser.email}`;
      nameEl.className   = 'report-banner__name logged';
      if (linkEl) linkEl.style.display = 'none';
    } else {
      nameEl.textContent = '👤 Anónimo';
      nameEl.className   = 'report-banner__name';
      if (linkEl) linkEl.style.display = 'inline';
    }
  }

  function openReport() {
    reportModal_openedAt = Date.now();

    const check = AntiSpam.canReport(!!currentUser);
    if (!check.ok && check.reason === 'cooldown') {
      showToast('Demasiado rápido', `Espera ${check.waitMin} min antes de volver a reportar`, 'warning');
      return;
    }

    updateRepBanner();
    $('reportModal')?.classList.add('open');
  }

  function closeReport() {
    $('reportModal')?.classList.remove('open');
    const h = $('hInput'), m = $('mInput');
    if (h) h.value = '';
    if (m) m.value = '';
  }

  function selBtn(btn, group) {
    const parent = btn.closest('.sel-group, .police-grid');
    if (!parent) return;
    parent.querySelectorAll('.sel-btn').forEach(b => {
      b.classList.remove('active', 'active--green', 'active--yellow', 'active--red');
      b.setAttribute('aria-pressed', 'false');
    });

    btn.setAttribute('aria-pressed', 'true');

    if (group === 'l') {
      const nivel = btn.textContent.includes('Poca') ? 'Poca'
                  : btn.textContent.includes('Mucha') ? 'Mucha' : 'Media';
      const clsMap = { Poca: 'active--green', Media: 'active--yellow', Mucha: 'active--red' };
      btn.classList.add('active', clsMap[nivel]);
      selNivel = nivel;
    } else {
      btn.classList.add('active');
    }

    if (group === 'd') selDir     = btn.textContent.trim();
    if (group === 't') selTipo    = btn.textContent.trim();
    if (group === 'p') selPolicia = btn.querySelector('.name')?.textContent ?? btn.textContent.trim();
  }

  async function submitReport() {
    if (AntiSpam.isBot(reportModal_openedAt)) return;

    const check = AntiSpam.canReport(!!currentUser);
    if (!check.ok) {
      showToast('Demasiado frecuente', `Espera ${check.waitMin ?? '?'} minutos`, 'warning');
      return;
    }

    const datos = {
      direccion: selDir,
      tipo:      selTipo,
      nivel:     selNivel,
      policia:   selPolicia,
      horas:     $('hInput')?.value || '0',
      minutos:   $('mInput')?.value || '0',
    };

    if (AntiSpam.isDuplicate(datos)) {
      showToast('Reporte duplicado', 'Ya enviaste este mismo reporte recientemente', 'warning');
      return;
    }

    try {
      await db.collection('reportes').add({
        ...datos,
        usuario:   currentUser ? (currentUser.displayName || currentUser.email) : 'Anónimo',
        userId:    currentUser ? currentUser.uid : null,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        puntos:    currentUser ? 10 : 0,
      });

      if (currentUser) {
        await db.collection('usuarios').doc(currentUser.uid).set({
          nombre:        currentUser.displayName || 'Usuario',
          email:         currentUser.email,
          puntos:        firebase.firestore.FieldValue.increment(10),
          puntosSemanal: firebase.firestore.FieldValue.increment(10),
          totalReportes: firebase.firestore.FieldValue.increment(1),
          ultimoReporte: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      AntiSpam.registrarReporte(datos);
      closeReport();
      showToast('¡Reporte enviado!', currentUser ? 'Has ganado +10 puntos 🎯' : 'Enviado como anónimo');

    } catch (err) {
      console.error('[Report] Error:', err);
      showToast('Error al enviar', 'Comprueba tu conexión', 'error');
    }
  }

  // ── Menú móvil ───────────────────────────────────
  function openMobileMenu() {
    $('mobileNav')?.classList.add('open');
    document.body.classList.add('locked');
    $('menuBtn')?.setAttribute('aria-expanded', 'true');
  }

  function closeMobileMenu() {
    $('mobileNav')?.classList.remove('open');
    document.body.classList.remove('locked');
    $('menuBtn')?.setAttribute('aria-expanded', 'false');
  }

  // ── Contacto ─────────────────────────────────────
  async function sendContact() {
    const nombre = $('cNombre')?.value.trim();
    const email  = $('cEmail')?.value.trim();
    const asunto = $('cAsunto')?.value.trim();
    const msg    = $('cMsg')?.value.trim();
    const status = $('cStatus');
    const btn    = $('cBtn');

    if (!nombre || !email || !msg) {
      status.className   = 'form-status err';
      status.textContent = '⚠️ Rellena los campos obligatorios: Nombre, Email y Mensaje.';
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      status.className   = 'form-status err';
      status.textContent = '⚠️ El email no tiene un formato válido.';
      return;
    }

    btn.textContent    = 'Enviando...';
    btn.disabled       = true;
    status.className   = '';
    status.textContent = '';

    let ok = false;

    // Guardar en Firestore
    try {
      await db.collection('contacto').add({
        nombre, email,
        asunto:  asunto || '(sin asunto)',
        mensaje: msg,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });
      ok = true;
    } catch (err) {
      console.warn('[Contact] Firestore error:', err);
    }

    // Enviar a Formspree (reemplaza YOUR_FORM_ID con el tuyo de formspree.io)
    const FORMSPREE_ID = 'YOUR_FORM_ID';
    if (FORMSPREE_ID !== 'YOUR_FORM_ID') {
      try {
        const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body:    JSON.stringify({ nombre, email, asunto, message: msg }),
        });
        if (res.ok) ok = true;
      } catch (err) {
        console.warn('[Contact] Formspree error:', err);
      }
    }

    if (ok) {
      status.className   = 'form-status ok';
      status.textContent = '✅ Mensaje enviado. Te respondemos lo antes posible.';
      btn.textContent    = 'Enviado ✓';
      ['cNombre', 'cEmail', 'cAsunto', 'cMsg'].forEach(id => {
        const input = $(id);
        if (input) input.value = '';
      });
      $('cCount').textContent = '0 / 500';
    } else {
      status.className   = 'form-status err';
      status.textContent = '❌ Error al enviar. Escríbenos a sincola.frontera@gmail.com';
      btn.textContent    = 'Enviar mensaje';
      btn.disabled       = false;
    }
  }

  // ── Legal ─────────────────────────────────────────
  const LEGAL_TEXTS = {
    aviso: `
      <div class="modal__title">Aviso Legal</div>
      <div style="font-size:.82rem;color:var(--muted);line-height:1.8;margin-top:12px">
        <p style="margin-bottom:12px"><strong style="color:var(--text)">Titular:</strong><br>SinCola · Ceuta, España · sincola.frontera@gmail.com</p>
        <p style="margin-bottom:12px"><strong style="color:var(--text)">Objeto:</strong><br>SinCola es una plataforma informativa comunitaria que muestra reportes voluntarios sobre el estado de la frontera del Tarajal.</p>
        <p style="margin-bottom:12px"><strong style="color:var(--text)">Responsabilidad:</strong><br>SinCola no se responsabiliza de decisiones tomadas en base a la información publicada. Los datos provienen de la comunidad y pueden no ser precisos. Queda prohibido el uso automatizado (bots).</p>
        <p><strong style="color:var(--text)">Legislación:</strong><br>Este sitio se rige por la legislación española vigente y el Reglamento (UE) 2016/679 (RGPD).</p>
      </div>`,
    privacidad: `
      <div class="modal__title">Política de Privacidad</div>
      <div style="font-size:.82rem;color:var(--muted);line-height:1.8;margin-top:12px">
        <p style="margin-bottom:12px"><strong style="color:var(--text)">Responsable:</strong><br>SinCola · sincola.frontera@gmail.com</p>
        <p style="margin-bottom:12px"><strong style="color:var(--text)">Datos que recogemos:</strong><br>Email y nombre al registrarte, autenticación mediante Google, reportes enviados, cookies según consentimiento.</p>
        <p style="margin-bottom:12px"><strong style="color:var(--text)">Finalidad:</strong><br>Gestionar tu cuenta y publicar reportes. No vendemos ni cedemos datos a terceros.</p>
        <p style="margin-bottom:12px"><strong style="color:var(--text)">Base legal:</strong><br>Consentimiento (Art. 6.1.a RGPD).</p>
        <p><strong style="color:var(--text)">Tus derechos:</strong><br>Acceso, rectificación y supresión. Contacta: sincola.frontera@gmail.com</p>
      </div>`,
    cookies: `
      <div class="modal__title">Política de Cookies</div>
      <div style="font-size:.82rem;color:var(--muted);line-height:1.8;margin-top:12px">
        <p style="margin-bottom:12px"><strong style="color:var(--text)">¿Qué son las cookies?</strong><br>Pequeños ficheros que se guardan en tu dispositivo para mejorar tu experiencia.</p>
        <p style="margin-bottom:12px"><strong style="color:var(--text)">Cookies que usamos:</strong><br>
          • <strong style="color:var(--text)">Esenciales:</strong> sesión y preferencias de tema. Siempre activas.<br>
          • <strong style="color:var(--text)">Analytics:</strong> Google Analytics para estadísticas anónimas de uso.<br>
          • <strong style="color:var(--text)">Publicidad:</strong> Google AdSense para mostrar anuncios que financian el servicio gratuito.
        </p>
        <p style="margin-bottom:16px"><strong style="color:var(--text)">Gestión:</strong><br>Puedes cambiar tus preferencias en cualquier momento desde "Gestionar cookies" en el pie de página.</p>
        <div style="display:flex;gap:8px">
          <button onclick="rejectAllCookies();closeLegal()" style="flex:1;padding:12px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--muted);font-family:inherit;font-size:.85rem;cursor:pointer">Solo esenciales</button>
          <button onclick="acceptAllCookies();closeLegal()" style="flex:1;padding:12px;border-radius:10px;border:none;background:var(--accent);color:#fff;font-family:inherit;font-size:.85rem;font-weight:600;cursor:pointer">Aceptar todo</button>
        </div>
      </div>`,
    terminos: `
      <div class="modal__title">Términos de Uso</div>
      <div style="font-size:.82rem;color:var(--muted);line-height:1.8;margin-top:12px">
        <p style="margin-bottom:12px"><strong style="color:var(--text)">Uso:</strong><br>Servicio gratuito. Al usarlo aceptas estas condiciones.</p>
        <p style="margin-bottom:12px"><strong style="color:var(--text)">Reportes:</strong><br>Deben ser verídicos y basados en observación real. Prohibido: información falsa, spam y bots.</p>
        <p style="margin-bottom:12px"><strong style="color:var(--text)">Moderación:</strong><br>Podemos eliminar reportes y suspender cuentas sin previo aviso.</p>
        <p><strong style="color:var(--text)">Responsabilidad:</strong><br>No garantizamos la exactitud de los datos. Al enviar un reporte cedes a SinCola el derecho de publicarlo.</p>
      </div>`,
  };

  function openLegal(type) {
    const content = LEGAL_TEXTS[type];
    if (!content) return;
    $('legalContent').innerHTML = content;
    $('legalModal')?.classList.add('open');
  }

  function closeLegal() {
    $('legalModal')?.classList.remove('open');
  }

  // ── Firestore realtime ───────────────────────────
  function initRealtimeListeners() {
    const unsub = db.collection('reportes')
      .orderBy('timestamp', 'desc')
      .limit(20)
      .onSnapshot(snapshot => {
        allReportes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderFeed(snapshot);
        recalcularEstado();
        updateHistorico();
        startUpdateTimer();
      }, err => {
        console.error('[Firestore]', err);
      });

    unsubs.push(unsub);
  }

  // ── Globals para el HTML ─────────────────────────
  function exposeGlobals() {
    window.showPage        = showPage;
    window.toggleTheme     = toggleTheme;
    window.openReport      = openReport;
    window.closeReport     = closeReport;
    window.openLogin       = openLogin;
    window.closeLogin      = closeLogin;
    window.loginGoogle     = loginGoogle;
    window.openMobileMenu  = openMobileMenu;
    window.closeMobileMenu = closeMobileMenu;
    window.selBtn          = selBtn;
    window.submitReport    = submitReport;
    window.sendContact     = sendContact;
    window.openLegal       = openLegal;
    window.closeLegal      = closeLegal;

    // Cookies
    window.acceptAllCookies = CookieConsent.acceptAll;
    window.rejectAllCookies = CookieConsent.rejectAll;
    window.saveCookiePrefs  = CookieConsent.saveFromBanner;
  }

  // ── Init ─────────────────────────────────────────
  function init() {
    exposeGlobals();
    initTheme();
    initHero();
    initTimeline();
    initCharts();

    // Cookies RGPD
    CookieConsent.init();

    // Auth
    auth.onAuthStateChanged(user => {
      currentUser = user;
      updateNavAuth(user);
      updateRepBanner();
    });

    // Realtime
    initRealtimeListeners();
    initRanking();

    // Cerrar modales al clicar fuera o con Escape
    ['loginModal', 'reportModal', 'legalModal'].forEach(id => {
      $(id)?.addEventListener('click', e => {
        if (e.target.id === id) $(id).classList.remove('open');
      });
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        $$('.overlay.open').forEach(m => m.classList.remove('open'));
        closeMobileMenu();
      }
    });

    // Contador caracteres contacto
    $('cMsg')?.addEventListener('input', function () {
      $('cCount').textContent = `${this.value.length} / 500`;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { showToast, showPage };

})();
