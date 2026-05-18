// ===================================================
// modules/reputation.js
// Sistema de reputación, niveles y badges
// SinCola · Producción v2.0
// ===================================================

const ReputationSystem = (() => {

  // ── Niveles ─────────────────────────────────────

  const LEVELS = [
    { min: 0,    max: 49,   name: 'Viajero',    emoji: '🚶', color: '#6b7280' },
    { min: 50,   max: 199,  name: 'Explorador', emoji: '🧭', color: '#3b82f6' },
    { min: 200,  max: 499,  name: 'Local',      emoji: '🏠', color: '#22c55e' },
    { min: 500,  max: 999,  name: 'Guía',       emoji: '⭐', color: '#f59e0b' },
    { min: 1000, max: 2499, name: 'Experto',    emoji: '🔥', color: '#f97316' },
    { min: 2500, max: 4999, name: 'Leyenda',    emoji: '👑', color: '#f43f5e' },
    { min: 5000, max: Infinity, name: 'Embajador', emoji: '🏆', color: '#c0c0c0' },
  ];

  // ── Badges ──────────────────────────────────────

  const BADGES = [
    { id: 'primer_reporte', name: 'Primer Reporte', emoji: '🎯', desc: 'Enviaste tu primer reporte', req: r => r.totalReportes >= 1 },
    { id: 'diez_reportes',  name: 'Frecuente',      emoji: '📍', desc: '10 reportes enviados',       req: r => r.totalReportes >= 10 },
    { id: 'cien_reportes',  name: 'Veterano',       emoji: '🏅', desc: '100 reportes enviados',      req: r => r.totalReportes >= 100 },
    { id: 'racha_semana',   name: 'Racha Semanal',  emoji: '⚡', desc: 'Reportaste 7 días seguidos', req: r => r.rachaDias >= 7 },
    { id: 'madrug',         name: 'Madrugador',     emoji: '🌅', desc: 'Reporte antes de las 8am',   req: r => r.reportesManana >= 1 },
    { id: 'veraz',          name: 'Veraz',          emoji: '✅', desc: '20 reportes verificados',    req: r => r.reportesVerificados >= 20 },
    { id: 'comunidad',      name: 'Comunidad',      emoji: '🌍', desc: 'Referiste a 3 personas',     req: r => r.referidos >= 3 },
  ];

  // ── Funciones principales ───────────────────────

  /**
   * Obtiene el nivel según puntos.
   */
  function getLevel(puntos) {
    return LEVELS.find(l => puntos >= l.min && puntos <= l.max) ?? LEVELS[0];
  }

  /**
   * Obtiene los badges ganados por un usuario.
   */
  function getBadges(stats) {
    return BADGES.filter(b => b.req(stats));
  }

  /**
   * Calcula el progreso hacia el siguiente nivel (0–100).
   */
  function getLevelProgress(puntos) {
    const level    = getLevel(puntos);
    const nextLevel = LEVELS[LEVELS.indexOf(level) + 1];
    if (!nextLevel) return 100; // Ya es máximo

    const range    = nextLevel.min - level.min;
    const progress = puntos - level.min;
    return Math.round((progress / range) * 100);
  }

  /**
   * Peso de reputación para el motor de estado.
   * Más puntos = reportes con más peso.
   */
  function getReportWeight(puntos) {
    const level = getLevel(puntos);
    const idx   = LEVELS.indexOf(level);
    // 0.6 → 1.5 según nivel (7 niveles)
    return 0.6 + (idx * 0.15);
  }

  /**
   * Renderiza el badge de nivel en HTML seguro (sin innerHTML).
   */
  function renderLevelBadge(puntos) {
    const level    = getLevel(puntos);
    const progress = getLevelProgress(puntos);

    const wrapper  = document.createElement('div');
    wrapper.className = 'level-badge';
    wrapper.setAttribute('title', `${level.name} · ${puntos} pts`);

    const emoji = document.createElement('span');
    emoji.textContent = level.emoji;
    emoji.className   = 'level-badge__emoji';

    const name = document.createElement('span');
    name.textContent = level.name;
    name.className   = 'level-badge__name';
    name.style.color = level.color;

    wrapper.appendChild(emoji);
    wrapper.appendChild(name);
    return wrapper;
  }

  return { getLevel, getBadges, getLevelProgress, getReportWeight, renderLevelBadge, LEVELS, BADGES };

})();
