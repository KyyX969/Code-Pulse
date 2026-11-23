import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  LanguageContext,
  type Locale,
  readStoredLocale,
  saveStoredLocale,
} from '../lib/i18nContext.ts';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale());

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    saveStoredLocale(next);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((prev) => {
      const next: Locale = prev === 'id' ? 'en' : 'id';
      saveStoredLocale(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      toggleLocale,
      L: <T = string,>(idText: T, enText: T): T => (locale === 'id' ? idText : enText),
    }),
    [locale, setLocale, toggleLocale],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

