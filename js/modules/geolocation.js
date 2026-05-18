// ===================================================
// modules/geolocation.js
// Detección de ubicación y distancia al Tarajal
// SinCola · Producción v2.0
// ===================================================

const GeoModule = (() => {

  // Coordenadas del Tarajal
  const TARAJAL = { lat: 35.8883, lng: -5.3195 };

  let userPosition = null;

  /**
   * Calcula distancia en km entre dos puntos (Haversine).
   */
  function haversine(lat1, lng1, lat2, lng2) {
    const R    = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a    = Math.sin(dLat / 2) ** 2 +
                 Math.cos(lat1 * Math.PI / 180) *
                 Math.cos(lat2 * Math.PI / 180) *
                 Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * Solicita la ubicación del usuario.
   * @returns {Promise<{lat, lng, distancia}>}
   */
  function requestLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalización no soportada'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        pos => {
          const { latitude: lat, longitude: lng } = pos.coords;
          const distancia = haversine(lat, lng, TARAJAL.lat, TARAJAL.lng);
          userPosition = { lat, lng, distancia };
          resolve(userPosition);
        },
        err => reject(err),
        { timeout: 8000, enableHighAccuracy: false }
      );
    });
  }

  /**
   * Formatea la distancia para mostrar en UI.
   */
  function formatDistancia(km) {
    if (km < 1) return `${Math.round(km * 1000)} m del Tarajal`;
    return `${km.toFixed(1)} km del Tarajal`;
  }

  /**
   * Muestra el banner de geolocalización en la UI.
   */
  function showGeoBanner(callback) {
    const banner = document.getElementById('geoBanner');
    if (!banner) return;
    banner.style.display = 'flex';

    document.getElementById('geoBtn')?.addEventListener('click', async () => {
      try {
        const pos = await requestLocation();
        const dist = formatDistancia(pos.distancia);

        banner.querySelector('.geo-banner__text strong').textContent = dist;
        banner.querySelector('.geo-banner__btn').textContent = '✅ Ubicación detectada';
        document.getElementById('geoBtn').disabled = true;

        if (callback) callback(pos);
      } catch {
        banner.querySelector('.geo-banner__text').textContent = 'No se pudo obtener la ubicación.';
      }
    }, { once: true });
  }

  /**
   * Devuelve si el usuario está cerca del Tarajal (<5 km).
   */
  function isNearBorder() {
    if (!userPosition) return false;
    return userPosition.distancia < 5;
  }

  return { requestLocation, formatDistancia, showGeoBanner, isNearBorder };

})();
