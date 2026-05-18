// ===================================================
// modules/antiSpam.js
// Control de frecuencia, cooldown y detección duplicados
// SinCola · Producción v2.0
// ===================================================

const AntiSpam = (() => {

  // ── Configuración ───────────────────────────────

  const CONFIG = {
    cooldownMs:       5 * 60 * 1000,   // 5 min entre reportes (anónimo)
    cooldownAuthMs:   2 * 60 * 1000,   // 2 min entre reportes (registrado)
    maxReportsPerHour: 6,              // Máximo reportes por hora
    duplicateWindowMs: 3 * 60 * 1000, // 3 min para detectar duplicados
    storageKey: 'sc_spam_data',
  };

  // ── Estado local (en memoria + localStorage) ────

  function loadData() {
    try {
      const raw = localStorage.getItem(CONFIG.storageKey);
      return raw ? JSON.parse(raw) : { reports: [], blocked: false };
    } catch {
      return { reports: [], blocked: false };
    }
  }

  function saveData(data) {
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(data));
    } catch { /* Safari privado u otros límites */ }
  }

  function limpiarAntiguos() {
    const data = loadData();
    const cutoff = Date.now() - 2 * 60 * 60 * 1000; // 2 horas
    data.reports = data.reports.filter(r => r.ts > cutoff);
    saveData(data);
    return data;
  }

  // ── Validaciones públicas ───────────────────────

  /**
   * Comprueba si el usuario puede enviar un reporte ahora.
   * @param {boolean} isAuthenticated
   * @returns {{ ok: boolean, reason?: string, waitMs?: number }}
   */
  function canReport(isAuthenticated) {
    const data = limpiarAntiguos();
    const ahora = Date.now();

    if (data.reports.length === 0) return { ok: true };

    const cooldown = isAuthenticated ? CONFIG.cooldownAuthMs : CONFIG.cooldownMs;
    const ultimo   = data.reports[data.reports.length - 1].ts;
    const elapsed  = ahora - ultimo;

    if (elapsed < cooldown) {
      return {
        ok: false,
        reason: 'cooldown',
        waitMs: cooldown - elapsed,
        waitMin: Math.ceil((cooldown - elapsed) / 60000),
      };
    }

    // Límite por hora
    const cutoffHour = ahora - 60 * 60 * 1000;
    const enUltimaHora = data.reports.filter(r => r.ts > cutoffHour).length;

    if (enUltimaHora >= CONFIG.maxReportsPerHour) {
      return {
        ok: false,
        reason: 'rate_limit',
        waitMs: 60 * 60 * 1000,
      };
    }

    return { ok: true };
  }

  /**
   * Comprueba si el reporte es duplicado del anterior.
   * @param {Object} reporte - { direccion, tipo, nivel }
   * @returns {boolean}
   */
  function isDuplicate(reporte) {
    const data = loadData();
    const ahora = Date.now();
    const cutoff = ahora - CONFIG.duplicateWindowMs;

    return data.reports.some(r =>
      r.ts > cutoff &&
      r.direccion === reporte.direccion &&
      r.tipo      === reporte.tipo &&
      r.nivel     === reporte.nivel
    );
  }

  /**
   * Registra un reporte enviado.
   * @param {Object} reporte
   */
  function registrarReporte(reporte) {
    const data = limpiarAntiguos();
    data.reports.push({
      ts: Date.now(),
      direccion: reporte.direccion,
      tipo:      reporte.tipo,
      nivel:     reporte.nivel,
    });
    saveData(data);
  }

  /**
   * Tiempo restante de cooldown en segundos (para mostrar en UI).
   * @param {boolean} isAuthenticated
   * @returns {number} Segundos restantes, 0 si puede reportar.
   */
  function cooldownRemaining(isAuthenticated) {
    const result = canReport(isAuthenticated);
    if (result.ok) return 0;
    return Math.ceil((result.waitMs || 0) / 1000);
  }

  // ── Honeypot básico ─────────────────────────────

  /**
   * Detecta comportamiento de bot por velocidad de envío.
   * @param {number} formOpenedAt - timestamp cuando se abrió el modal
   * @returns {boolean} true si parece bot
   */
  function isBot(formOpenedAt) {
    const elapsed = Date.now() - formOpenedAt;
    return elapsed < 1500; // Menos de 1.5 segundos = sospechoso
  }

  return { canReport, isDuplicate, registrarReporte, cooldownRemaining, isBot };

})();
