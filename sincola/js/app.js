// ===================================================
// app.js — Controlador principal SinCola
// UI, eventos, tiempo real, ranking, feed
// SinCola · Producción v2.0
// ===================================================

'use strict';

const App = (() => {

  // ── Estado de la aplicación ─────────────────────

  let currentUser   = null;
  let allReportes   = [];
  let reportModal_openedAt = 0;
  let activeTabRanking = 'semanal';

  // Unsubscribers de Firestore listeners
  const unsubs = [];

  // ── Utilidades DOM seguras ──────────────────────

  const $ = id => document.getElementById(id);
  const $$ = sel => document.querySelectorAll(sel);

  /** Crear elemento con propiedades. Sin innerHTML para evitar XSS. */
  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'className') node.className = v;
      else if (k === 'textContent') node.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else node.setAttribute(k, v);
    }
    children.forEach(c => c && node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return node;
  }

  // ── Toast ───────────────────────────────────────

  let toastTimer = null;
  function showToast(title, sub = '', type = 'success') {
    const icons = { success: '🎉', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toastEl = $('toast');
    if (!toastEl) return;

    $('toastIcon').textContent  = icons[type] ?? '🎉';
    $('toastTitle').textContent = title;
    $('toastSub').textContent   = sub;

    toastEl.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('visible'), 3500);
  }

  // ── Navegación ──────────────────────────────────

  function showPage(page) {
    $('homePage').classList.toggle('active', page === 'home');
    $('contactPage').classList.toggle('active', page === 'contact');
    window.scrollTo(0, 0);
  }

  // ── Tema ────────────────────────────────────────

  function toggleTheme() {
    const isLight = document.body.getAttribute('data-theme') === 'light';
    document.body.setAttribute('data-theme', isLight ? 'dark' : 'light');
    $('themeBtn').textContent = isLight ? '🌙' : '☀️';
    try { localStorage.setItem('sc_theme', isLight ? 'dark' : 'light'); } catch {}
  }

  function initTheme() {
    try {
      const saved = localStorage.getItem('sc_theme');
      if (saved) { document.body.setAttribute('data-theme', saved); }
      $('themeBtn').textContent = saved === 'light' ? '☀️' : '🌙';
    } catch {}
  }

  // ── Hero slideshow ──────────────────────────────

  function initHero() {
    let current = 0;
    const slides = $$('.hero__slide');
    const dots   = $$('.hero__dot');
    if (!slides.length) return;

    function goTo(n) {
      slides[current].classList.remove('active');
      dots[current].classList.remove('active');
      current = n;
      slides[current].classList.add('active');
      dots[current].classList.add('active');
    }

    // Exponer goTo para botones
    window._heroGoTo = goTo;
    setInterval(() => goTo((current + 1) % slides.length), 4500);
  }

  // ── Actualización del estado ────────────────────

  let minAgo = 0;
  let updateTimer;

  function startUpdateTimer() {
    clearInterval(updateTimer);
    minAgo = 0;
    $('lastUpdate').textContent = 'Actualizado ahora mismo';
    updateTimer = setInterval(() => {
      minAgo++;
      $('lastUpdate').textContent = `Actualizado hace ${minAgo} min`;
    }, 60000);
  }

  function updateDirectionUI(dir, estado) {
    const prefix = dir === 'entrada' ? 'Entrada' : 'Salida';

    const statusEl   = $(`status${prefix}`);
    const waitEl     = $(`wait${prefix}`);
    const iconEl     = $(`icon${prefix}`);
    const fillEl     = $(`fill${prefix}`);
    const confEl     = $(`confidence${prefix}`);

    if (!statusEl) return;

    // Limpiar clases antiguas
    ['green', 'yellow', 'red'].forEach(c => {
      statusEl.classList.remove(`status-label--${c}`);
      iconEl.classList.remove(`status-icon--${c}`);
      fillEl.classList.remove(`progress-fill--${c}`);
    });

    statusEl.textContent = estado.label;
    statusEl.classList.add(`status-label--${estado.cls}`);

    iconEl.textContent = estado.emoji;
    iconEl.classList.add(`status-icon--${estado.cls}`);

    waitEl.textContent = estado.stale
      ? 'Sin reportes recientes'
      : estado.wait + ' de espera estimada';

    fillEl.style.width = estado.pct + '%';
    fillEl.classList.add(`progress-fill--${estado.cls}`);

    // Confianza
    if (confEl) {
      const dots = confEl.querySelectorAll('.confidence-dot');
      dots.forEach((d, i) => {
        d.classList.toggle('filled', i < estado.confidence);
      });
    }
  }

  function recalcularEstado() {
    const estadoEntrada = StatusEngine.calcularEstado(allReportes, 'entrada');
    const estadoSalida  = StatusEngine.calcularEstado(allReportes, 'salida');
    updateDirectionUI('entrada', estadoEntrada);
    updateDirectionUI('salida',  estadoSalida);
    updateBestTime();
  }

  function updateBestTime() {
    const hora = StatusEngine.mejorHoraHoy();
    const el   = $('bestTimeHour');
    if (el) el.textContent = hora;
  }

  // ── Feed de reportes (sin innerHTML) ───────────

  function tiempoDesde(timestamp) {
    if (!timestamp) return 'Ahora';
    const fecha = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diff  = Math.floor((Date.now() - fecha) / 60000);
    if (diff < 1)  return 'Ahora mismo';
    if (diff < 60) return `Hace ${diff} min`;
    return `Hace ${Math.floor(diff / 60)}h`;
  }

  function createFeedItem(data) {
    const tagCls   = data.nivel === 'Poca' ? 'green' : data.nivel === 'Mucha' ? 'red' : 'yellow';
    const emoji    = data.nivel === 'Poca' ? '😌' : data.nivel === 'Mucha' ? '😤' : '😐';
    const usuario  = data.usuario || 'Anónimo';
    const hace     = tiempoDesde(data.timestamp);

    const item = el('div', { className: 'feed__item' });

    const avatar = el('div', { className: 'feed__avatar', 'aria-hidden': 'true' }, emoji);

    const body = el('div', { className: 'feed__body' });
    const user = el('div', { className: 'feed__user', textContent: usuario });

    const msg = el('div', { className: 'feed__msg' });
    const dir = document.createTextNode(`${data.direccion ?? ''} · ${data.tipo ?? ''} `);
    const tag = el('span', { className: `feed__tag feed__tag--${tagCls}` }, `${data.nivel} cola`);
    msg.appendChild(dir);
    msg.appendChild(tag);

    const timeEl  = el('div', { className: 'feed__time' });
    timeEl.textContent = hace + (data.policia ? ` · ${data.policia}` : '') +
      (data.horas && (parseInt(data.horas) > 0 || parseInt(data.minutos) > 0)
        ? ` · ${data.horas}h ${data.minutos}min espera`
        : '');

    body.append(user, msg, timeEl);

    const pts = el('div', { className: 'feed__pts' });
    pts.textContent = data.puntos ? `+${data.puntos} pts` : '';

    item.append(avatar, body, pts);
    return item;
  }

  function renderFeed(snapshot) {
    const feedEl = $('feedReal');
    if (!feedEl) return;

    if (snapshot.empty) {
      feedEl.innerHTML = '';
      feedEl.appendChild(
        el('div', { className: 'feed__empty' }, '🌟 Sé el primero en reportar hoy')
      );
      return;
    }

    // Actualizar solo items nuevos (diff simple por ID)
    const existingIds = new Set(
      [...feedEl.querySelectorAll('[data-id]')].map(n => n.dataset.id)
    );

    const fragment = document.createDocumentFragment();

    snapshot.forEach(doc => {
      if (existingIds.has(doc.id)) return; // Ya está, no re-renderizar
      const item = createFeedItem(doc.data());
      item.dataset.id = doc.id;
      fragment.prepend(item);
    });

    // Si hay items viejos que ya no están, eliminarlos
    feedEl.querySelectorAll('[data-id]').forEach(node => {
      const stillExists = snapshot.docs.some(d => d.id === node.dataset.id);
      if (!stillExists) feedEl.removeChild(node);
    });

    if (fragment.childNodes.length > 0) {
      feedEl.prepend(fragment);
    }

    // Si el feed está vacío ahora
    if (feedEl.children.length === 0) {
      feedEl.appendChild(el('div', { className: 'feed__empty' }, '🌟 Sé el primero en reportar hoy'));
    }
  }

  // ── Ranking dinámico ────────────────────────────

  function renderRanking(docs) {
    const list = $('rankingList');
    if (!list) return;

    list.innerHTML = '';

    if (docs.length === 0) {
      list.appendChild(el('div', { className: 'rank-loading' }, 'Nadie en el ranking todavía. ¡Empieza a reportar!'));
      return;
    }

    const medalEmojis = ['👑', '🥈', '🥉'];
    const numClasses  = ['rank-num--gold', 'rank-num--silver', 'rank-num--bronze'];
    const avatarEmojis = ['🦁', '🎯', '⭐', '🚀', '💫'];

    docs.forEach((doc, i) => {
      const data   = doc.data();
      const nombre = data.nombre || 'Anónimo';
      const puntos = data.puntos ?? data.puntosSemanal ?? 0;

      const row = el('div', { className: 'rank-row' + (data.userId === currentUser?.uid ? ' me' : '') });

      const num = el('div', { className: `rank-num ${numClasses[i] ?? ''}`, textContent: String(i + 1) });

      const avatar = el('div', {
        className: 'rank-avatar',
        style: { background: `rgba(${['245,158,11', '148,163,184', '180,83,9'][i] ?? '255,255,255'},.1)` },
      }, medalEmojis[i] ?? avatarEmojis[i % avatarEmojis.length]);

      const nameEl = el('div', { className: 'rank-name', textContent: nombre });
      const badge  = el('span', { className: 'rank-badge' }, i < 3 ? '🏅' : '');
      const ptsEl  = el('div', { className: 'rank-pts' }, `${puntos.toLocaleString('es')} pts`);

      row.append(num, avatar, nameEl, badge, ptsEl);
      list.appendChild(row);
    });
  }

  function initRanking() {
    const semanalBtn = $('rankTabSemanal');
    const totalBtn   = $('rankTabTotal');

    function loadRanking(type) {
      activeTabRanking = type;
      semanalBtn?.classList.toggle('active', type === 'semanal');
      totalBtn?.classList.toggle('active', type === 'total');

      const field = type === 'semanal' ? 'puntosSemanal' : 'puntos';

      const unsub = db.collection('usuarios')
        .orderBy(field, 'desc')
        .limit(10)
        .onSnapshot(snap => renderRanking(snap.docs), err => {
          console.error('[Ranking]', err);
        });

      unsubs.push(unsub);
    }

    semanalBtn?.addEventListener('click', () => loadRanking('semanal'));
    totalBtn?.addEventListener('click', () => loadRanking('total'));

    loadRanking('semanal');
  }

  // ── Gráficos históricos ─────────────────────────

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
      const pkEl = $(pkId);
      if (!pkEl) return;
      pkEl.classList.add('active');
      pkEl.querySelector('.peak-day').textContent = ds[i];
      const pv = pkEl.querySelector('.peak-val');
      pv.textContent = `${val} min`;
      pv.style.color  = color;
      pv.style.fontSize = '1.3rem';
      pv.style.fontWeight = '800';
      pkEl.querySelector('.peak-hora').textContent = `pico a las ${ph[key][i]}`;
    }

    function renderChart(elId, data, color, pkId, key) {
      const el     = $(elId);
      if (!el) return;
      const max    = Math.max(...data);
      const avg    = Math.round(data.reduce((a, b) => a + b) / data.length);
      el.innerHTML = '';

      data.forEach((val, i) => {
        const pct  = Math.round((val / max) * 100);
        const wrap = document.createElement('div');
        wrap.className = 'week-chart__item';

        const bar = document.createElement('div');
        bar.className    = 'week-chart__bar';
        bar.style.height = `${pct}%`;
        bar.style.background = color;
        bar.style.opacity    = i === 5 ? '1' : '0.5';

        const lbl = document.createElement('span');
        lbl.className   = 'week-chart__label';
        lbl.textContent = ds[i];
        lbl.style.color = i === 5 ? 'var(--text)' : 'var(--muted)';
        if (i === 5) lbl.style.fontWeight = '700';

        wrap.appendChild(bar);
        wrap.appendChild(lbl);

        wrap.addEventListener('click', () => {
          el.querySelectorAll('.week-chart__bar').forEach(b => {
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

        el.appendChild(wrap);
      });

      // Animar entrada
      requestAnimationFrame(() => {
        setTimeout(() => {
          el.querySelectorAll('.week-chart__bar').forEach((b, i) => {
            const h = b.style.height;
            b.style.height = '0';
            b.style.transition = `height .6s cubic-bezier(.34,1.1,.64,1) ${i * 0.05}s`;
            requestAnimationFrame(() => { b.style.height = h; });
          });
        }, 300);
      });

      return avg;
    }

    const avgP = renderChart('chP', wd.P, 'var(--yellow)', 'pkP', 'P');
    const avgM = renderChart('chM', wd.M, 'var(--green)',  'pkM', 'M');
    const avgC = renderChart('chC', wd.C, 'var(--red)',    'pkC', 'C');

    if ($('avgP')) $('avgP').textContent = avgP;
    if ($('avgM')) $('avgM').textContent = avgM;
    if ($('avgC')) $('avgC').textContent = avgC;
  }

  // ── Timeline "Mejor hora" ───────────────────────

  function initTimeline() {
    const hrs = [
      { h: '6h', v: 10, c: 'var(--green)' }, { h: '7h', v: 15, c: 'var(--green)' },
      { h: '8h', v: 22, c: 'var(--green)' }, { h: '9h', v: 45, c: 'var(--yellow)' },
      { h: '10h', v: 60, c: 'var(--yellow)' }, { h: '11h', v: 70, c: 'var(--yellow)' },
      { h: '12h', v: 100, c: 'var(--red)' }, { h: '13h', v: 95, c: 'var(--red)' },
      { h: '14h', v: 85, c: 'var(--red)' }, { h: '15h', v: 55, c: 'var(--yellow)' },
      { h: '16h', v: 50, c: 'var(--yellow)' }, { h: '17h', v: 90, c: 'var(--red)' },
      { h: '18h', v: 80, c: 'var(--red)' }, { h: '19h', v: 55, c: 'var(--yellow)' },
      { h: '20h', v: 40, c: 'var(--yellow)' }, { h: '21h', v: 25, c: 'var(--green)' },
      { h: '22h', v: 15, c: 'var(--green)' },
    ];

    const container = $('timelineChart');
    if (!container) return;

    hrs.forEach(h => {
      const wrap = el('div', { className: 'bar-chart__item' });
      const bar  = el('div', { className: 'bar-chart__bar', style: { height: `${h.v}%`, background: h.c, opacity: '0.85' } });
      const lbl  = el('span', { className: 'bar-chart__label' }, h.h);
      wrap.append(bar, lbl);
      container.appendChild(wrap);
    });
  }

  // ── Modal de reporte ────────────────────────────

  let selDir   = '🇲🇦→🇪🇸 Entrando';
  let selTipo  = '🚶 Peatonal';
  let selNivel = 'Media';
  let selPolicia = '';

  function openReport() {
    reportModal_openedAt = Date.now();

    // Comprobar cooldown antes de abrir
    const check = AntiSpam.canReport(!!currentUser);
    if (!check.ok && check.reason === 'cooldown') {
      const msg = $('cooldownMsg');
      if (msg) {
        msg.textContent = `⏳ Espera ${check.waitMin} min antes de reportar de nuevo.`;
        msg.classList.add('visible');
        setTimeout(() => msg.classList.remove('visible'), 4000);
      }
      showToast('Demasiado rápido', `Espera ${check.waitMin} min`, 'warning');
      return;
    }

    updateRepBanner();
    $('reportModal').classList.add('open');
  }

  function closeReport() {
    $('reportModal').classList.remove('open');
    $('hInput').value = '';
    $('mInput').value = '';
  }

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

  function selBtn(btn, group) {
    btn.closest('.sel-group, .police-grid').querySelectorAll('.sel-btn').forEach(b => {
      b.classList.remove('active', 'active--green', 'active--yellow', 'active--red');
    });

    if (group === 'l') {
      const map = { Poca: 'active--green', Media: 'active--yellow', Mucha: 'active--red' };
      const nivel = btn.textContent.includes('Poca') ? 'Poca' : btn.textContent.includes('Mucha') ? 'Mucha' : 'Media';
      btn.classList.add(map[nivel]);
      selNivel = nivel;
    } else {
      btn.classList.add('active');
    }

    if (group === 'd') selDir     = btn.textContent.trim();
    if (group === 't') selTipo    = btn.textContent.trim();
    if (group === 'p') selPolicia = btn.querySelector('.name')?.textContent ?? btn.textContent.trim();
  }

  async function submitReport() {
    // Anti-bot: demasiado rápido
    if (AntiSpam.isBot(reportModal_openedAt)) {
      console.warn('[AntiSpam] Posible bot detectado');
      return;
    }

    // Cooldown check
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
      horas:     $('hInput').value || '0',
      minutos:   $('mInput').value || '0',
    };

    // Duplicado check
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
        const userRef = db.collection('usuarios').doc(currentUser.uid);
        await userRef.set({
          nombre:         currentUser.displayName || currentUser.email,
          email:          currentUser.email,
          puntos:         firebase.firestore.FieldValue.increment(10),
          puntosSemanal:  firebase.firestore.FieldValue.increment(10),
          totalReportes:  firebase.firestore.FieldValue.increment(1),
          ultimoReporte:  firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      AntiSpam.registrarReporte(datos);
      closeReport();
      showToast('¡Reporte enviado!', currentUser ? 'Has ganado +10 puntos 🎯' : 'Reportado como anónimo');

    } catch (err) {
      console.error('[Report] Error:', err);
      showToast('Error al enviar', 'Comprueba tu conexión', 'error');
    }
  }

  // ── Auth ────────────────────────────────────────

  function openLogin()  { $('loginModal').classList.add('open'); }
  function closeLogin() { $('loginModal').classList.remove('open'); }

  async function loginGoogle() {
    try {
      const result = await auth.signInWithPopup(googleProvider);
      closeLogin();
      showToast(`Bienvenido ${result.user.displayName}! 🎉`, 'Ya puedes ganar puntos');
    } catch (err) {
      console.error('[Auth]', err);
      showToast('Error al iniciar sesión', err.message, 'error');
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

  // ── Menú móvil ──────────────────────────────────

  function openMobileMenu()  { $('mobileNav').classList.add('open'); document.body.classList.add('locked'); }
  function closeMobileMenu() { $('mobileNav').classList.remove('open'); document.body.classList.remove('locked'); }

  // ── Formulario de contacto ──────────────────────

  async function sendContact() {
    const nombre  = $('cNombre').value.trim();
    const email   = $('cEmail').value.trim();
    const asunto  = $('cAsunto').value.trim();
    const msg     = $('cMsg').value.trim();
    const status  = $('cStatus');
    const btn     = $('cBtn');

    // Validaciones
    if (!nombre || !email || !msg) {
      status.className = 'form-status err';
      status.textContent = 'Rellena todos los campos obligatorios.';
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      status.className = 'form-status err';
      status.textContent = 'El email no tiene un formato válido.';
      return;
    }

    btn.textContent = 'Enviando...';
    btn.disabled    = true;

    try {
      // Guardar en Firestore como backup
      await db.collection('contacto').add({
        nombre, email, asunto, mensaje: msg,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });

      // Formspree (reemplazar FORM_ID con el real)
      const FORMSPREE_URL = 'https://formspree.io/f/YOUR_FORM_ID';
      const res = await fetch(FORMSPREE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ nombre, email, asunto, message: msg }),
      });

      if (!res.ok && res.status !== 200) {
        // Si Formspree falla pero Firestore OK, igual considerar éxito
        console.warn('[Contact] Formspree falló, guardado en Firestore');
      }

      status.className   = 'form-status ok';
      status.textContent = '✅ Mensaje enviado. Te respondemos pronto.';
      btn.textContent    = 'Enviado ✓';

      ['cNombre', 'cEmail', 'cAsunto', 'cMsg'].forEach(id => { $(id).value = ''; });
      $('cCount').textContent = '0 / 500';

    } catch (err) {
      status.className   = 'form-status err';
      status.textContent = 'Error al enviar. Escríbenos a sincola.frontera@gmail.com';
      btn.textContent    = 'Enviar mensaje';
      btn.disabled       = false;
    }
  }

  // ── Modal legal ─────────────────────────────────

  const LEGAL_CONTENT = {
    aviso: `
      <div class="modal__title">Aviso Legal</div>
      <div style="font-size:.82rem;color:var(--muted);line-height:1.8;margin-top:12px;">
        <p style="margin-bottom:12px;"><strong style="color:var(--text)">Titular:</strong><br>
        SinCola · Ceuta, España · sincola.frontera@gmail.com</p>
        <p style="margin-bottom:12px;"><strong style="color:var(--text)">Objeto:</strong><br>
        SinCola es una plataforma informativa comunitaria que muestra reportes voluntarios sobre el estado de la frontera del Tarajal.</p>
        <p style="margin-bottom:12px;"><strong style="color:var(--text)">Responsabilidad:</strong><br>
        SinCola no se responsabiliza de decisiones tomadas en base a la información publicada. Los datos provienen de la comunidad y pueden no ser precisos. Queda prohibido el uso automatizado (bots).</p>
        <p><strong style="color:var(--text)">Legislación:</strong><br>
        Este sitio se rige por la legislación española vigente y el Reglamento (UE) 2016/679 (RGPD).</p>
      </div>`,
    privacidad: `
      <div class="modal__title">Política de Privacidad</div>
      <div style="font-size:.82rem;color:var(--muted);line-height:1.8;margin-top:12px;">
        <p style="margin-bottom:12px;"><strong style="color:var(--text)">Responsable:</strong><br>SinCola · sincola.frontera@gmail.com</p>
        <p style="margin-bottom:12px;"><strong style="color:var(--text)">Datos que recogemos:</strong><br>Email y nombre al registrarte, autenticación social mediante Google, reportes enviados (dirección, tipo, nivel), IP anonimizada para análisis, cookies según consentimiento.</p>
        <p style="margin-bottom:12px;"><strong style="color:var(--text)">Finalidad:</strong><br>Gestionar tu cuenta, publicar reportes y mejorar el servicio. <strong>No vendemos ni cedemos datos a terceros.</strong></p>
        <p style="margin-bottom:12px;"><strong style="color:var(--text)">Base legal:</strong><br>Consentimiento (Art. 6.1.a RGPD) y ejecución de contrato (Art. 6.1.b RGPD).</p>
        <p style="margin-bottom:12px;"><strong style="color:var(--text)">Conservación:</strong><br>Reportes: 90 días. Datos de cuenta: hasta solicitud de baja.</p>
        <p><strong style="color:var(--text)">Tus derechos:</strong><br>Acceso, rectificación, supresión, portabilidad, limitación y oposición. Contacta: sincola.frontera@gmail.com</p>
      </div>`,
    terminos: `
      <div class="modal__title">Términos de Uso</div>
      <div style="font-size:.82rem;color:var(--muted);line-height:1.8;margin-top:12px;">
        <p style="margin-bottom:12px;"><strong style="color:var(--text)">Uso:</strong><br>Servicio gratuito. Al usarlo aceptas estas condiciones.</p>
        <p style="margin-bottom:12px;"><strong style="color:var(--text)">Reportes:</strong><br>Deben ser verídicos y basados en observación real. Prohibido: información falsa, spam, uso de bots o sistemas automatizados.</p>
        <p style="margin-bottom:12px;"><strong style="color:var(--text)">Moderación:</strong><br>Podemos eliminar reportes y suspender cuentas que incumplan estas normas, sin previo aviso.</p>
        <p><strong style="color:var(--text)">Responsabilidad:</strong><br>No garantizamos exactitud de los datos. Al enviar un reporte cedes a SinCola el derecho de publicarlo.</p>
      </div>`,
  };

  function openLegal(type) {
    const content = LEGAL_CONTENT[type];
    if (!content) return;

    // Para cookies, mostrar panel de configuración real
    if (type === 'cookies') {
      openCookieSettings();
      return;
    }

    $('legalContent').innerHTML = content; // Contenido estático propio, seguro
    $('legalModal').classList.add('open');
  }

  function closeLegal() { $('legalModal').classList.remove('open'); }

  function openCookieSettings() {
    const prefs = CookieConsent.getPrefs();
    $('cookieAnalytics').checked = prefs.analytics;
    $('cookieAds').checked       = prefs.advertising;
    CookieConsent.showBanner();
  }

  // ── Firestore listeners ─────────────────────────

  function initRealtimeListeners() {
    // Reportes en tiempo real
    const unsubReportes = db.collection('reportes')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .onSnapshot(snapshot => {
        // Acumular todos los reportes para el motor de estado
        allReportes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderFeed(snapshot);
        recalcularEstado();
        startUpdateTimer();
      }, err => {
        console.error('[Firestore] Error reportes:', err);
      });

    unsubs.push(unsubReportes);
  }

  // ── Exponer funciones globales necesarias para HTML ──

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
    window.acceptAllCookies  = CookieConsent.acceptAll;
    window.rejectAllCookies  = CookieConsent.rejectAll;
    window.saveCookiePrefs   = CookieConsent.saveFromBanner;
  }

  // ── Inicialización ──────────────────────────────

  function init() {
    exposeGlobals();
    initTheme();
    initHero();
    initTimeline();
    initCharts();
    GeoModule.showGeoBanner();

    // Cookies & RGPD
    CookieConsent.init();

    // Auth listener
    auth.onAuthStateChanged(user => {
      currentUser = user;
      updateNavAuth(user);
      updateRepBanner();
    });

    // Firestore
    initRealtimeListeners();
    initRanking();

    // Cerrar modales al clicar fuera
    ['loginModal', 'reportModal', 'legalModal'].forEach(id => {
      $(id)?.addEventListener('click', e => {
        if (e.target === $(id)) {
          $(id).classList.remove('open');
          document.body.classList.remove('locked');
        }
      });
    });

    // Cerrar modales con Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        $$('.overlay.open').forEach(m => m.classList.remove('open'));
        $('mobileNav')?.classList.remove('open');
        document.body.classList.remove('locked');
      }
    });

    // Char counter del formulario de contacto
    $('cMsg')?.addEventListener('input', function() {
      $('cCount').textContent = `${this.value.length} / 500`;
    });
  }

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { showToast, showPage };

})();
