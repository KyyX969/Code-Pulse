import { createContext, useContext } from 'react';

export type Locale = 'id' | 'en';

export const LOCALE_STORAGE_KEY = 'cp_locale';

export interface LanguageContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  toggleLocale: () => void;
  L: <T = string>(idText: T, enText: T) => T;
}

export function readStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'id';
  try {
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved === 'en' || saved === 'id') return saved;
  } catch {
    // ignore storage errors
  }
  return 'id';
}

export function saveStoredLocale(locale: Locale): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore storage errors
  }
}

export const LanguageContext = createContext<LanguageContextValue>({
  locale: 'id',
  setLocale: () => {},
  toggleLocale: () => {},
  L: <T,>(idText: T) => idText,
});

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}

