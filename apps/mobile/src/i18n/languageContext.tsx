import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Language } from "../shared-kernel/types";
import { getInitialLanguage, readLanguagePreference, writeLanguagePreference } from "./languagePreference";
import { setRuntimeLanguage } from "./translations";

type LanguageContextValue = {
  initialized: boolean;
  language: Language;
  setLanguage: (language: Language) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    let active = true;
    void readLanguagePreference().then((savedLanguage) => {
      if (!active) return;
      setLanguageState(savedLanguage);
      setInitialized(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    void writeLanguagePreference(nextLanguage);
  }, []);

  setRuntimeLanguage(language);
  const value = useMemo(() => ({ initialized, language, setLanguage }), [initialized, language, setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
