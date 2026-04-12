// i18n utilities for Astro

// Get the relative URL for a locale (e.g., '/en' or '/zh-TW')
export function getRelativeLocaleUrl(locale: string): string {
  return locale === 'en' ? '/en' : '/zh-TW';
}