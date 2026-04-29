"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "penita-theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Light es el default. Solo cambia si el usuario lo guardó previamente.
  const [theme, setThemeState] = useState<Theme>("light");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stored === "dark" || stored === "light") setThemeState(stored);
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
  }, [theme, hydrated]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState, toggleTheme: () => setThemeState((p) => p === "light" ? "dark" : "light") }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) return { theme: "light" as Theme, setTheme: () => {}, toggleTheme: () => {} };
  return ctx;
}
