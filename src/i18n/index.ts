import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const SUPPORTED_LANGS = ['fr', 'en', 'vi', 'ja', 'it', 'es', 'pt', 'de', 'ar'] as const;
export type SupportedLang = typeof SUPPORTED_LANGS[number];

export const RTL_LANGS: SupportedLang[] = ['ar'];

export const LANG_META: Record<SupportedLang, { flag: string; label: string }> = {
  fr: { flag: '🇫🇷', label: 'Français' },
  en: { flag: '🇬🇧', label: 'English' },
  vi: { flag: '🇻🇳', label: 'Tiếng Việt' },
  ja: { flag: '🇯🇵', label: '日本語' },
  it: { flag: '🇮🇹', label: 'Italiano' },
  es: { flag: '🇪🇸', label: 'Español' },
  pt: { flag: '🇵🇹', label: 'Português' },
  de: { flag: '🇩🇪', label: 'Deutsch' },
  ar: { flag: '🇦🇪', label: 'العربية' },
};

function detectLang(): SupportedLang {
  // Check localStorage first (user preference persisted locally)
  try {
    const stored = localStorage.getItem('i18n_lang');
    if (stored && SUPPORTED_LANGS.includes(stored as SupportedLang)) return stored as SupportedLang;
  } catch {}
  // Navigator language
  const nav = navigator.language?.slice(0, 2).toLowerCase();
  if (nav && SUPPORTED_LANGS.includes(nav as SupportedLang)) return nav as SupportedLang;
  return 'fr';
}

/** Apply document direction + Noto Sans JP when language is Japanese */
export function applyLangSideEffects(lang: SupportedLang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = RTL_LANGS.includes(lang) ? 'rtl' : 'ltr';
  // Japanese font
  let jpLink = document.getElementById('noto-sans-jp') as HTMLLinkElement | null;
  if (lang === 'ja') {
    if (!jpLink) {
      jpLink = document.createElement('link');
      jpLink.id = 'noto-sans-jp';
      jpLink.rel = 'stylesheet';
      jpLink.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600;700&display=swap';
      document.head.appendChild(jpLink);
    }
    document.documentElement.style.fontFamily = "'Noto Sans JP', sans-serif";
  } else {
    document.documentElement.style.fontFamily = '';
  }
  // Persist
  try { localStorage.setItem('i18n_lang', lang); } catch {}
}

const detectedLang = detectLang();
applyLangSideEffects(detectedLang);

// Lazy-load translations per language
async function loadResources(lang: SupportedLang) {
  const module = await import(`./locales/${lang}/translation.json`);
  return module.default;
}

// Preload detected lang only
const initialResources: Record<string, { translation: object }> = {};

i18n
  .use(initReactI18next)
  .init({
    lng: detectedLang,
    fallbackLng: 'fr',
    resources: initialResources,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

// Load initial lang
loadResources(detectedLang).then((data) => {
  i18n.addResourceBundle(detectedLang, 'translation', data, true, true);
  i18n.changeLanguage(detectedLang);
});

/** Switch language at runtime — loads bundle if needed */
export async function switchLanguage(lang: SupportedLang) {
  if (!i18n.hasResourceBundle(lang, 'translation')) {
    const data = await loadResources(lang);
    i18n.addResourceBundle(lang, 'translation', data, true, true);
  }
  await i18n.changeLanguage(lang);
  applyLangSideEffects(lang);
}

export default i18n;
