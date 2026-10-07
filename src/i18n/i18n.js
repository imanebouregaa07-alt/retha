/**
 * RETHA REAL ESTATE — Global Bilingual Architecture (i18n) Engine
 * Manages language switching, persistent state, dynamic DOM localization,
 * and RTL/LTR layout transitions across the platform.
 */
import { translations } from './translations.js';

const STORAGE_KEY = 'retha_lang';
let currentLang = 'en';

/**
 * Get current active language ('en' | 'ar')
 */
export function getLanguage() {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ar' || saved === 'en') {
      currentLang = saved;
    }
  }
  return currentLang;
}

/**
 * Retrieve translation string for a given key in active language
 */
export function t(key, fallback = '') {
  const lang = getLanguage();
  return translations[lang]?.[key] || translations['en']?.[key] || fallback || key;
}

/**
 * Set active language and apply layout direction & DOM translations
 */
export function setLanguage(lang) {
  if (lang !== 'ar' && lang !== 'en') return;
  currentLang = lang;

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, lang);

    // Apply document level language and direction
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

    // Update Language switcher buttons in navbar & mobile drawer
    updateLanguageSwitcherUI(lang);

    // Apply translations across all data-i18n elements
    applyDomTranslations(lang);

    // Dispatch global event for reactive JS components
    window.dispatchEvent(new CustomEvent('retha:lang-changed', {
      detail: { lang, dir: document.documentElement.dir }
    }));
  }
}

/**
 * Toggle between 'ar' and 'en'
 */
export function toggleLanguage() {
  const nextLang = getLanguage() === 'ar' ? 'en' : 'ar';
  setLanguage(nextLang);
  return nextLang;
}

/**
 * Update Language Switcher UI labels
 */
function updateLanguageSwitcherUI(lang) {
  // Desktop header button
  const labelEl = document.getElementById('lang-toggle-label');
  if (labelEl) {
    // If current is 'ar', show option to switch to 'English'; if 'en', show 'العربية'
    labelEl.textContent = lang === 'ar' ? 'English' : 'العربية';
  }

  // Mobile menu button
  const mobileLabel = document.querySelector('#mobile-lang-toggle-btn .lang-label');
  if (mobileLabel) {
    mobileLabel.textContent = lang === 'ar' ? 'English' : 'العربية';
  }
}

/**
 * Localize all DOM elements bearing data-i18n or data-i18n-placeholder attributes
 */
export function applyDomTranslations(lang = getLanguage()) {
  const dict = translations[lang] || translations['en'];

  // Text content
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });

  // HTML content (for elements with markup like icons or spans)
  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const key = el.getAttribute('data-i18n-html');
    if (dict[key]) {
      el.innerHTML = dict[key];
    }
  });

  // Input placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (dict[key]) {
      el.setAttribute('placeholder', dict[key]);
    }
  });

  // Title attributes
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (dict[key]) {
      el.setAttribute('title', dict[key]);
    }
  });
}

/**
 * Initialize i18n subsystem on DOM ready
 */
export function initI18n() {
  const lang = getLanguage();
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

  // Bind desktop toggle button
  const desktopBtn = document.getElementById('lang-toggle-btn');
  if (desktopBtn) {
    desktopBtn.addEventListener('click', () => {
      toggleLanguage();
    });
  }

  // Bind mobile toggle button
  const mobileBtn = document.getElementById('mobile-lang-toggle-btn');
  if (mobileBtn) {
    mobileBtn.addEventListener('click', () => {
      toggleLanguage();
    });
  }

  updateLanguageSwitcherUI(lang);
  applyDomTranslations(lang);

  return lang;
}
