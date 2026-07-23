"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

/**
 * Own tiny theme provider (replaces next-themes: its in-component <script>
 * triggers a React 19 dev warning). The no-flash init script lives in
 * layout.tsx OUTSIDE React rendering; here we only manage state + class.
 */
export type ThemeMode = "light" | "dark" | "system";
export const THEME_KEY = "wq-theme";

const ThemeContext = createContext<{
  theme: ThemeMode;
  setTheme: (m: ThemeMode) => void;
}>({ theme: "system", setTheme: () => {} });

function applyTheme(mode: ThemeMode) {
  const dark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("system");

  // read the persisted choice after mount (SSR-safe)
  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY) as ThemeMode | null;
    if (stored === "light" || stored === "dark" || stored === "system") {
      setThemeState(stored);
    }
  }, []);

  // apply on change + follow OS while in "system"
  useEffect(() => {
    applyTheme(theme);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => theme === "system" && applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((m: ThemeMode) => {
    localStorage.setItem(THEME_KEY, m);
    setThemeState(m);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
