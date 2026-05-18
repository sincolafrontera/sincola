// ===================================================
// modules/cookies.js
// Gestión RGPD real: esenciales, analytics, publicidad
// SinCola · Producción v2.0
// ===================================================

const CookieConsent = (() => {

  const STORAGE_KEY = 'sc_cookie_consent';
  const VERSION     = '1.0'; // Incrementar para forzar re-consentimiento

  // Estado de consentimiento por defecto
  const DEFAULT_PREFS = {
    essential:   true,  // Siempre activo, no se puede desactivar
    analytics:   false,
    advertising: false,
    version:     VERSION,
    timestamp:   null,
  };

  // ── Persistencia ───────────────────────────────

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const prefs = JSON.parse(raw);
      // Forzar re-consentimiento si cambió la versión
      if (prefs.version !== VERSION) return null;
      return prefs;
    } catch {
      return null;
    }
  }

  function save(prefs) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...prefs,
        version: VERSION,
        timestamp: new Date().toISOString(),
      }));
    } catch { /* noop */ }
  }

  // ── Estado actual ───────────────────────────────

  let _prefs = load();

  function hasConsented() {
    return _prefs !== null;
  }

  function getPrefs() {
    return _prefs ?? { ...DEFAULT_PREFS };
  }

  function isAllowed(type) {
    if (!_prefs) return type === 'essential';
    return _prefs[type] === true;
  }

  // ── Aplicar preferencias ────────────────────────

  function applyPrefs(prefs) {
    _prefs = { ...DEFAULT_PREFS, ...prefs, essential: true };
    save(_prefs);

    // Analytics
    if (_prefs.analytics) {
      enableAnalytics();
    } else {
      disableAnalytics();
    }

    // Publicidad
    if (_prefs.advertising) {
      enableAds();
    } else {
      disableAds();
    }

    // Disparar evento para que otros módulos reaccionen
    window.dispatchEvent(new CustomEvent('cookieConsentUpdated', { detail: _prefs }));
  }

  function acceptAll() {
    applyPrefs({ essential: true, analytics: true, advertising: true });
  }

  function rejectAll() {
    applyPrefs({ essential: true, analytics: false, advertising: false });
  }

  // ── Integraciones externas ──────────────────────

  function enableAnalytics() {
    // Google Analytics: activar
    if (window.gtag) {
      gtag('consent', 'update', {
        analytics_storage: 'granted',
      });
    }
    console.info('[Cookies] Analytics habilitado');
  }

  function disableAnalytics() {
    if (window.gtag) {
      gtag('consent', 'update', {
        analytics_storage: 'denied',
      });
    }
    console.info('[Cookies] Analytics deshabilitado');
  }

  function enableAds() {
    if (window.gtag) {
      gtag('consent', 'update', {
        ad_storage:                'granted',
        ad_user_data:              'granted',
        ad_personalization:        'granted',
      });
    }
    // Reactivar AdSense si estaba pausado
    if (window.adsbygoogle) {
      // AdSense se carga solo si está en el DOM y hay consentimiento
    }
    console.info('[Cookies] Publicidad habilitada');
  }

  function disableAds() {
    if (window.gtag) {
      gtag('consent', 'update', {
        ad_storage:         'denied',
        ad_user_data:       'denied',
        ad_personalization: 'denied',
      });
    }
    console.info('[Cookies] Publicidad deshabilitada');
  }

  // ── Inicialización ──────────────────────────────

  /**
   * Inicializa el sistema de cookies.
   * Si ya hay consentimiento guardado, aplica sin mostrar el banner.
   * Si no, muestra el banner.
   */
  function init() {
    // Establecer modo restringido por defecto (antes de consentimiento)
    if (window.gtag) {
      gtag('consent', 'default', {
        analytics_storage:   'denied',
        ad_storage:          'denied',
        ad_user_data:        'denied',
        ad_personalization:  'denied',
      });
    }

    if (hasConsented()) {
      // Aplicar preferencias guardadas sin mostrar banner
      applyPrefs(_prefs);
      return;
    }

    // Mostrar banner con delay
    setTimeout(() => showBanner(), 800);
  }

  function showBanner() {
    document.getElementById('cookieOverlay')?.classList.add('visible');
    document.getElementById('cookieBanner')?.classList.add('visible');
    document.body.classList.add('locked');

    // Pre-rellenar toggles con valores por defecto
    const analyticsToggle = document.getElementById('cookieAnalytics');
    const adsToggle       = document.getElementById('cookieAds');
    if (analyticsToggle) analyticsToggle.checked = false;
    if (adsToggle)       adsToggle.checked = false;
  }

  function hideBanner() {
    document.getElementById('cookieOverlay')?.classList.remove('visible');
    document.getElementById('cookieBanner')?.classList.remove('visible');
    document.body.classList.remove('locked');
  }

  function saveFromBanner() {
    const analytics   = document.getElementById('cookieAnalytics')?.checked ?? false;
    const advertising = document.getElementById('cookieAds')?.checked ?? false;
    applyPrefs({ analytics, advertising });
    hideBanner();
  }

  return {
    init,
    hasConsented,
    getPrefs,
    isAllowed,
    applyPrefs,
    acceptAll: () => { acceptAll(); hideBanner(); },
    rejectAll: () => { rejectAll(); hideBanner(); },
    saveFromBanner,
    showBanner,
    hideBanner,
  };

})();
