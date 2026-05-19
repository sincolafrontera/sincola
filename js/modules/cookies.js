// ===================================================
// modules/cookies.js — Gestión RGPD
// SinCola · v2.1 — Banner corregido
// ===================================================

const CookieConsent = (() => {

  const STORAGE_KEY = 'sc_cookie_consent';
  const VERSION     = '1.1'; // Subir versión fuerza re-consentimiento

  const DEFAULT_PREFS = {
    essential:   true,
    analytics:   true,
    advertising: true,
    version:     VERSION,
    timestamp:   null,
  };

  // ── Persistencia ────────────────────────────────

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const prefs = JSON.parse(raw);
      if (prefs.version !== VERSION) return null; // Versión distinta → pedir de nuevo
      return prefs;
    } catch {
      return null;
    }
  }

  function save(prefs) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...prefs,
        version:   VERSION,
        timestamp: new Date().toISOString(),
      }));
    } catch { /* Safari privado */ }
  }

  let _prefs = load();

  function hasConsented() { return _prefs !== null; }
  function getPrefs()     { return _prefs ?? { ...DEFAULT_PREFS }; }

  // ── Aplicar preferencias ────────────────────────

  function applyPrefs(prefs) {
    _prefs = { ...DEFAULT_PREFS, ...prefs, essential: true };
    save(_prefs);
    window.dispatchEvent(new CustomEvent('cookieConsentUpdated', { detail: _prefs }));
  }

  function acceptAll()  { applyPrefs({ analytics: true,  advertising: true  }); hideBanner(); }
  function rejectAll()  { applyPrefs({ analytics: false, advertising: false }); hideBanner(); }

  function saveFromBanner() {
    const analytics   = document.getElementById('cookieAnalytics')?.checked ?? true;
    const advertising = document.getElementById('cookieAds')?.checked ?? true;
    applyPrefs({ analytics, advertising });
    hideBanner();
  }

  // ── Mostrar / ocultar banner ────────────────────
  // IMPORTANTE: usa la clase 'show' que está definida en components.css

  function showBanner() {
    const overlay = document.getElementById('cookieOverlay');
    const banner  = document.getElementById('cookieBanner');
    if (!overlay || !banner) return;

    // Prerellenar toggles con valores actuales
    const analyticsToggle = document.getElementById('cookieAnalytics');
    const adsToggle       = document.getElementById('cookieAds');
    const prefs           = getPrefs();
    if (analyticsToggle) analyticsToggle.checked = prefs.analytics !== false;
    if (adsToggle)       adsToggle.checked       = prefs.advertising !== false;

    overlay.classList.add('show');
    banner.classList.add('show');
    document.body.classList.add('locked');
  }

  function hideBanner() {
    document.getElementById('cookieOverlay')?.classList.remove('show');
    document.getElementById('cookieBanner')?.classList.remove('show');
    document.body.classList.remove('locked');
  }

  // ── Init ────────────────────────────────────────

  function init() {
    if (hasConsented()) {
      // Ya consintió antes → aplicar preferencias guardadas sin mostrar banner
      applyPrefs(_prefs);
      return;
    }
    // Primera visita → mostrar banner con pequeño delay
    setTimeout(showBanner, 900);
  }

  return {
    init,
    hasConsented,
    getPrefs,
    acceptAll,
    rejectAll,
    saveFromBanner,
    showBanner,
    hideBanner,
  };

})();
