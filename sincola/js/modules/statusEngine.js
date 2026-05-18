// ===================================================
// modules/statusEngine.js
// Motor de cálculo del estado de la frontera
// Algoritmo ponderado por recencia + reputación
// SinCola · Producción v2.0
// ===================================================

const StatusEngine = (() => {

  // ── Constantes ─────────────────────────────────

  const NIVEL_SCORE = { 'Poca': 1, 'Media': 2, 'Mucha': 3 };
  const SCORE_NIVEL = {
    low:  { label: 'POCA COLA',  cls: 'green',  emoji: '😌', wait: '~10 min', pct: 20 },
    mid:  { label: 'COLA MEDIA', cls: 'yellow', emoji: '😐', wait: '~30 min', pct: 55 },
    high: { label: 'MUCHA COLA', cls: 'red',    emoji: '😤', wait: '~55 min', pct: 88 },
  };

  // Peso por reputación del reporter (0–5 reportes → 0.7, 6–20 → 1.0, 21+ → 1.3)
  function reputationWeight(reportCount) {
    if (!reportCount || reportCount < 5) return 0.7;
    if (reportCount < 20)               return 1.0;
    return 1.3;
  }

  // Peso por recencia: decae exponencialmente
  // t = minutos desde el reporte
  // Vida media ≈ 45 min → prácticamente 0 a las 3 horas
  function recencyWeight(minutesAgo) {
    const halfLife = 45;
    return Math.pow(0.5, minutesAgo / halfLife);
  }

  // ── Función principal ───────────────────────────

  /**
   * Calcula el estado de una dirección a partir de reportes recientes.
   * @param {Array} reportes - Array de documentos Firestore
   * @param {string} direccion - 'entrada' | 'salida'
   * @returns {Object} { label, cls, emoji, wait, pct, confidence, count }
   */
  function calcularEstado(reportes, direccion) {
    const ahora = Date.now();
    const VENTANA_MS = 3 * 60 * 60 * 1000; // 3 horas

    // Filtrar por dirección y ventana temporal
    const relevantes = reportes.filter(r => {
      const ts = r.timestamp?.toDate?.() ?? new Date(r.timestamp);
      const edad = ahora - ts.getTime();
      const dirMatch = direccion === 'entrada'
        ? r.direccion?.includes('Marruecos') || r.direccion?.includes('→🇪🇸')
        : r.direccion?.includes('Ceuta') || r.direccion?.includes('→🇲🇦');
      return edad < VENTANA_MS && dirMatch;
    });

    // Sin reportes recientes → estado desconocido (mostrar último o default)
    if (relevantes.length === 0) {
      return {
        ...SCORE_NIVEL.mid,
        confidence: 0,
        count: 0,
        stale: true,
      };
    }

    // Calcular score ponderado
    let totalWeight = 0;
    let weightedScore = 0;

    relevantes.forEach(r => {
      const ts = r.timestamp?.toDate?.() ?? new Date(r.timestamp);
      const minutesAgo = (ahora - ts.getTime()) / 60000;
      const rWeight = recencyWeight(minutesAgo);
      const repWeight = reputationWeight(r.reporterCount);
      const w = rWeight * repWeight;
      const score = NIVEL_SCORE[r.nivel] ?? 2;

      weightedScore += score * w;
      totalWeight   += w;
    });

    const avgScore = totalWeight > 0 ? weightedScore / totalWeight : 2;

    // Mapear score a nivel
    let nivel;
    if      (avgScore < 1.5) nivel = SCORE_NIVEL.low;
    else if (avgScore < 2.5) nivel = SCORE_NIVEL.mid;
    else                     nivel = SCORE_NIVEL.high;

    // Calcular confianza (0–5) basada en número y recencia de reportes
    const recentCount = relevantes.filter(r => {
      const ts = r.timestamp?.toDate?.() ?? new Date(r.timestamp);
      return (ahora - ts.getTime()) < 30 * 60000; // últimos 30 min
    }).length;

    const confidence = Math.min(5, Math.floor(recentCount * 1.5 + relevantes.length * 0.5));

    // Ajustar % de barra a score real
    const barPct = Math.round(((avgScore - 1) / 2) * 80 + 10); // 10–90%

    return {
      ...nivel,
      pct: barPct,
      confidence,
      count: relevantes.length,
      stale: false,
    };
  }

  // ── Mejor hora del día ──────────────────────────

  /**
   * Determina la mejor hora para cruzar hoy.
   * Basado en datos históricos + hora actual.
   */
  function mejorHoraHoy() {
    const ahora = new Date();
    const horaActual = ahora.getHours();

    // Franjas históricamente tranquilas
    const franjas = [
      { h: 6,  label: '06:00' },
      { h: 7,  label: '07:00' },
      { h: 8,  label: '08:00' },
      { h: 21, label: '21:00' },
      { h: 22, label: '22:00' },
    ];

    // Filtrar franjas futuras (o primeras del día siguiente)
    const futuras = franjas.filter(f => f.h > horaActual);
    const objetivo = futuras.length > 0 ? futuras[0] : franjas[0];

    return objetivo.label;
  }

  // ── Exportar ────────────────────────────────────
  return { calcularEstado, mejorHoraHoy, SCORE_NIVEL };

})();
