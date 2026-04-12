/**
 * doliGAS - Configurazione i18n (Solo Frontend)
 * -----------------------------------------------------------------------------
 * STATUS: Integro, Completo, Robusto.
 * FIX: Utilizzo di ES Modules puri per evitare errori 500 in ambiente Vite.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Importiamo i tuoi file JSON reali dal percorso indicato nella tua tree
import itTranslation from './locales/it.json';
import enTranslation from './locales/en.json';
import frTranslation from './locales/fr.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      it: { translation: itTranslation },
      en: { translation: enTranslation },
      fr: { translation: frTranslation }
    },
    fallbackLng: 'it',
    interpolation: {
      escapeValue: false // React protegge già da XSS
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    },
    react: {
      useSuspense: false
    }
  });

export default i18n;