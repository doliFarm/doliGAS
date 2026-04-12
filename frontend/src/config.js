export const APP_CONFIG = {
  // Durata sessione in minuti (Lettura da env con fallback a 120)
  SESSION_DURATION_MINUTES: Number(import.meta.env.VITE_SESSION_DURATION_MINUTES) || 120,

  // Endpoint API
  // In produzione con Nginx, DEVE essere stringa vuota '' (per usare i path relativi)
  // In sviluppo locale senza Docker, si potrebbe voler puntare a localhost:3000
  API_URL: import.meta.env.VITE_API_URL || '',
  APP_ENV: import.meta.env.VITE_APP_ENV || 'prod',
  // Rotte di default per ruolo
  DEFAULT_ROUTES: {
    admin: '/admin',
    producer: '/producer',
    member: '/app'
  }
};
