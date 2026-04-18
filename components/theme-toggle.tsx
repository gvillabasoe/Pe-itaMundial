"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <button
      type="button"
      aria-label="Cambiar tema"
      className="theme-toggle"
      onClick={toggleTheme}
    >
      <span className="theme-toggle__inner">
        {!mounted ? <span className="theme-toggle__placeholder" /> : theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
      </span>
    </button>
  );
}
