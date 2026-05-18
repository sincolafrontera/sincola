# SinCola v2.0 — Guía de producción

> Estado en tiempo real de la frontera del Tarajal (Ceuta ↔ Marruecos)

---

## Estructura del proyecto

```
sincola/
├── index.html                  ← HTML principal (home + contacto)
├── sw.js                       ← Service Worker (PWA offline)
├── firestore.rules             ← Reglas de seguridad Firestore ← IMPORTANTE
│
├── css/
│   ├── base.css                ← Variables CSS, reset, utilidades, animaciones
│   ├── layout.css              ← Nav, hero, grid, cards, footer, responsive
│   └── components.css          ← Botones, modales, feed, ranking, charts, cookies
│
├── js/
│   ├── firebase.js             ← Inicialización Firebase
│   ├── app.js                  ← Controlador principal (UI, eventos, tiempo real)
│   └── modules/
│       ├── statusEngine.js     ← Motor de cálculo del estado (algoritmo ponderado)
│       ├── antiSpam.js         ← Control de frecuencia, cooldown, duplicados
│       ├── cookies.js          ← Gestión RGPD real (esenciales/analytics/ads)
│       ├── reputation.js       ← Sistema de niveles, badges y reputación
│       └── geolocation.js      ← Geolocalización y distancia al Tarajal
│
├── pwa/
│   ├── manifest.json           ← PWA manifest
│   ├── offline.html            ← Página sin conexión
│   └── icons/                  ← Iconos PWA (ver sección Iconos más abajo)
│
├── admin/
│   └── index.html              ← Panel de administración (acceso restringido)
│
└── public/
    ├── sitemap.xml
    └── robots.txt
```

---

## Pasos obligatorios antes de publicar

### 1. Aplicar reglas de Firestore

1. Ve a **Firebase Console** → tu proyecto → Firestore Database → **Rules**
2. Copia el contenido de `firestore.rules` y pégalo
3. Haz clic en **Publicar**

> ⚠️ Sin esto la base de datos está completamente abierta.

### 2. Crear el primer admin

Para que el panel de administración funcione necesitas crear un documento en Firestore:

```
Colección: admins
Documento ID: <tu UID de Firebase Auth>
Campos: { role: "superadmin" }
```

Obtén tu UID iniciando sesión en la app y mirando Firebase Auth.

### 3. Integrar Formspree para el formulario de contacto

1. Crea una cuenta en [formspree.io](https://formspree.io)
2. Crea un nuevo formulario
3. En `js/app.js`, busca `YOUR_FORM_ID` y reemplázalo por tu ID real:
   ```js
   const FORMSPREE_URL = 'https://formspree.io/f/TU_ID_REAL';
   ```

### 4. Generar los iconos PWA

Necesitas estos tamaños: `72, 96, 128, 144, 192, 512` px.

Herramientas:
- [PWA Asset Generator](https://github.com/elegantapp/pwa-asset-generator)
- [Favicon.io](https://favicon.io)
- [RealFaviconGenerator](https://realfavicongenerator.net)

Colócalos en `pwa/icons/icon-{size}.png`.

### 5. Imagen OG (Open Graph)

Crea una imagen de 1200×630 px y colócala en `pwa/og-image.jpg`.
Herramientas: Canva, Figma, o cualquier editor gráfico.

### 6. Google Analytics (opcional)

Si tienes consentimiento de cookies analytics, añade en `<head>` de `index.html`:
```html
<!-- Google Analytics con modo consentimiento -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```
El módulo `cookies.js` ya gestiona el consentimiento correctamente.

### 7. Firebase App Check (anti-bot avanzado)

Para mayor seguridad en producción:
1. Activa **App Check** en Firebase Console
2. Usa reCAPTCHA v3 como proveedor
3. Añade en `firebase.js`:
   ```js
   const appCheck = firebase.appCheck();
   appCheck.activate('TU_RECAPTCHA_V3_SITE_KEY', true);
   ```

---

## Arquitectura del motor de estado

El estado de la frontera **no está hardcodeado**. Se calcula en `statusEngine.js` usando:

### Algoritmo ponderado

Cada reporte recibe un peso combinado:

```
peso_total = peso_recencia × peso_reputación
```

- **Peso por recencia**: Decae exponencialmente. Vida media = 45 min. A las 3h el peso es ~0.1.
- **Peso por reputación**: Usuarios con más reportes tienen más peso (0.7 → 1.3).

```
score_ponderado = Σ(score_nivel × peso) / Σ(peso)

score → nivel:
  < 1.5 → Poca cola
  1.5–2.5 → Cola media
  > 2.5 → Mucha cola
```

### Confianza del dato

Se muestra con 5 puntos naranjas bajo el estado. Cuantos más reportes recientes (últimos 30 min), más puntos llenos.

---

## Sistema anti-spam

El módulo `antiSpam.js` implementa:

| Protección | Detalle |
|-----------|---------|
| **Cooldown anónimo** | 5 min entre reportes |
| **Cooldown registrado** | 2 min entre reportes |
| **Rate limit** | Max 6 reportes/hora |
| **Anti-duplicados** | Bloquea el mismo reporte en 3 min |
| **Anti-bot** | Rechaza envíos en < 1.5 segundos |

Las Firestore Security Rules añaden una segunda capa de protección en el servidor.

---

## Sistema de cookies RGPD

El módulo `cookies.js` implementa consentimiento **real y granular**:

- **Esenciales**: Siempre activas, no desactivables
- **Analytics**: Google Analytics (activado solo con consentimiento)
- **Publicidad**: Google AdSense (activado solo con consentimiento)

Las preferencias se guardan en `localStorage` con versión, forzando re-consentimiento cuando cambien las políticas.

Usa el modo de consentimiento de Google (`gtag consent`) para cumplir con la normativa europea.

---

## Panel de administración

Acceso: `/admin/` (solo usuarios en la colección `admins`)

Funcionalidades:
- Dashboard con estadísticas en tiempo real
- Ver y eliminar reportes
- Marcar reportes como spam
- Ver usuarios y sus puntos
- Banear usuarios abusivos
- Resetear puntos semanales
- Ver mensajes de contacto

---

## Sistema de reputación

Niveles (en `reputation.js`):

| Nivel | Puntos | Emoji |
|-------|--------|-------|
| Viajero | 0-49 | 🚶 |
| Explorador | 50-199 | 🧭 |
| Local | 200-499 | 🏠 |
| Guía | 500-999 | ⭐ |
| Experto | 1000-2499 | 🔥 |
| Leyenda | 2500-4999 | 👑 |
| Embajador | 5000+ | 🏆 |

Badges: Primer Reporte, Frecuente, Veterano, Racha Semanal, Madrugador, Veraz, Comunidad.

---

## Accesibilidad (WCAG 2.1 AA)

Implementado en esta versión:
- `aria-label` en todos los elementos interactivos
- `aria-live` en zonas dinámicas (estado, feed, ranking)
- `role="dialog"` y `aria-modal` en todos los modales
- `role="feed"` en el feed de reportes
- `role="tablist"` y `role="tab"` en tabs de ranking
- `role="progressbar"` en barras de progreso
- `aria-pressed` en botones de selección
- Skip link (`Ir al contenido principal`)
- Focus visible con `:focus-visible`
- Textos alternativos en imágenes
- Contraste suficiente en todos los colores principales

---

## PWA

- **Manifest**: categorías travel+utilities, shortcuts, screenshots
- **Service Worker**: Cache offline para assets, Network First para contenido
- **Instalable**: en Android, iOS y escritorio
- **Offline**: página de fallback con instrucciones claras
- **Shortcut**: "Reportar ahora" desde el icono de la app

---

## SEO

- Meta description optimizada con palabras clave locales
- Open Graph completo con imagen
- Twitter Cards
- Schema.org `WebApplication` con geolocalización del Tarajal
- `sitemap.xml`
- `robots.txt`
- `<link rel="canonical">`
- Atributos `lang="es"` y `hreflang`

---

## Próximos pasos sugeridos

1. **Cloud Functions**: mover el incremento de puntos al backend para mayor seguridad
2. **Notificaciones Push**: alertar cuando cambia el estado de la frontera
3. **Modo árabe/francés**: i18n para usuarios de Marruecos
4. **Histórico real**: guardar estado calculado cada hora en Firestore para alimentar las gráficas
5. **Verificación de reportes**: sistema de thumbs up/down para validar reportes entre usuarios
6. **App nativa**: React Native o Capacitor para App Store y Google Play
