// ===================================================
// firebase.js — Inicialización Firebase + Config
// SinCola · Producción v2.0
// ===================================================

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBfpxXRX-8EGUypXWZALCZI6ntvloe849A",
  authDomain: "sincola-3cf36.firebaseapp.com",
  projectId: "sincola-3cf36",
  storageBucket: "sincola-3cf36.appspot.com",
  messagingSenderId: "1058044123494",
  appId: "1:1058044123494:web:f5c45982cd174f422790a7"
};

// Inicializar Firebase
firebase.initializeApp(FIREBASE_CONFIG);

// Exportar instancias globales
const auth = firebase.auth();
const db   = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Habilitar persistencia offline
db.enablePersistence({ synchronizeTabs: true }).catch(err => {
  if (err.code === 'failed-precondition') {
    console.warn('[Firestore] Persistencia desactivada: múltiples pestañas abiertas.');
  } else if (err.code === 'unimplemented') {
    console.warn('[Firestore] Persistencia no soportada en este navegador.');
  }
});

// Configurar Google Auth
googleProvider.setCustomParameters({ prompt: 'select_account' });
