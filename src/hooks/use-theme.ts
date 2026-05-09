"use client";

import { useState, useEffect } from "react";

export type Theme = "light" | "dark";

const THEME_KEY = "jeff:theme";

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const saved = (localStorage.getItem(THEME_KEY) as Theme) ?? "light";
    setTheme(saved);
    applyTheme(saved);
  }, []);

  function toggle() {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
      return next;
    });
  }

  return { theme, isDark: theme === "dark", toggle };
}
