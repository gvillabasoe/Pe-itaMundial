"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return <span className="theme-toggle" aria-hidden="true"><span style={{ width: 16, height: 16 }} /></span>;
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={theme === "light" ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
      title={theme === "light" ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
    >
      {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}
