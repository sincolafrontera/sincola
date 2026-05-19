// ===================================================
// modules/statusEngine.js
// Motor de cálculo del estado de la frontera
// SinCola · v2.1
// ===================================================

const StatusEngine = (() => {

  const NIVEL_SCORE = { 'Poca': 1, 'Media': 2, 'Mucha': 3 };

  const SCORE_NIVEL = {
    low:  { label: 'POCA COLA',  cls: 'green',  emoji: '😌', wait: '~10 min', pct: 20,  nivelRaw: 'Poca'  },
    mid:  { label: 'COLA MEDIA', cls: 'yellow', emoji: '😐', wait: '~30 min', pct: 55,  nivelRaw: 'Media' },
    high: { label: 'MUCHA COLA', cls: 'red',    emoji: '😤', wait: '~55 min', pct: 88,  nivelRaw: 'Mucha' },
  };

  // Peso por recencia: decae a la mitad cada 45 minutos
  function recencyWeight(minutesAgo) {
    return Math.pow(0.5, minutesAgo / 45);
  }

  // Peso por reputación según número de reportes del usuario
  function reputationWeight(reportCount) {
    if (!reportCount || reportCount < 5) return 0.7;
    if (reportCount < 20)               return 1.0;
    return 1.3;
  }

  /**
   * Calcula el estado de una dirección a partir de reportes recientes.
   * @param {Array} reportes
   * @param {string} dir - 'entrada' | 'salida'
   * @returns {Object}
   */
  function calcularEstado(reportes, dir) {
    const ahora     = Date.now();
    const VENTANA   = 3 * 60 * 60 * 1000; // 3 horas

    // Filtrar por dirección y ventana temporal
    const relevantes = reportes.filter(r => {
      const ts       = r.timestamp?.toDate?.() ?? new Date(r.timestamp ?? 0);
      const edad     = ahora - ts.getTime();
      const dirMatch = dir === 'entrada'
        ? (r.direccion?.includes('🇲🇦') || r.direccion?.includes('Entrando'))
        : (r.direccion?.includes('🇪🇸') || r.direccion?.includes('Saliendo'));
      return edad < VENTANA && dirMatch;
    });

    // Sin datos → estado stale
    if (relevantes.length === 0) {
      return { stale: true };
    }

    // Score ponderado
    let totalWeight   = 0;
    let weightedScore = 0;

    relevantes.forEach(r => {
      const ts         = r.timestamp?.toDate?.() ?? new Date(r.timestamp ?? 0);
      const minutesAgo = (ahora - ts.getTime()) / 60000;
      const rw         = recencyWeight(minutesAgo);
      const repw       = reputationWeight(r.reporterCount);
      const w          = rw * repw;
      const score      = NIVEL_SCORE[r.nivel] ?? 2;

      weightedScore += score * w;
      totalWeight   += w;
    });

    const avgScore = totalWeight > 0 ? weightedScore / totalWeight : 2;

    let nivel;
    if      (avgScore < 1.5) nivel = SCORE_NIVEL.low;
    else if (avgScore < 2.5) nivel = SCORE_NIVEL.mid;
    else                     nivel = SCORE_NIVEL.high;

    // Barra proporcional al score real
    const barPct = Math.round(((avgScore - 1) / 2) * 80 + 10);

    // Confianza: cuántos reportes en los últimos 30 min
    const recientes  = relevantes.filter(r => {
      const ts = r.timestamp?.toDate?.() ?? new Date(r.timestamp ?? 0);
      return (ahora - ts.getTime()) < 30 * 60000;
    }).length;
    const confidence = Math.min(5, Math.floor(recientes * 1.5 + relevantes.length * 0.5));

    return {
      ...nivel,
      pct: barPct,
      confidence,
      count: relevantes.length,
      stale: false,
    };
  }

  return { calcularEstado };

})();
