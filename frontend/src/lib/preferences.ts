export type Theme = "dark" | "light";

const THEME_KEY = "ethos-theme";
const SIDEBAR_KEY = "ethos-sidebar";

/**
 * Runs in <head> before first paint so the stored theme and sidebar mode never flash.
 * Dark is the server-rendered default; this only ever switches away from it.
 */
export const preferenceBootScript = `(function(){try{var d=document.documentElement;if(localStorage.getItem("${THEME_KEY}")==="light")d.classList.remove("dark");if(localStorage.getItem("${SIDEBAR_KEY}")==="docked")d.dataset.sidebar="docked"}catch(e){}})()`;

function persist(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode); the preference still applies for this visit.
  }
}

export function readDocumentPreferences(): { theme: Theme; sidebarDocked: boolean } {
  const root = document.documentElement;
  return {
    theme: root.classList.contains("dark") ? "dark" : "light",
    sidebarDocked: root.dataset.sidebar === "docked",
  };
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  persist(THEME_KEY, theme);
}

/** Docked keeps the sidebar in the layout; otherwise it floats in on demand. */
export function applySidebarDocked(docked: boolean): void {
  const root = document.documentElement;
  if (docked) root.dataset.sidebar = "docked";
  else delete root.dataset.sidebar;
  persist(SIDEBAR_KEY, docked ? "docked" : "floating");
}
