export type Theme = "dark" | "light";

const THEME_KEY = "ethos-theme";
const SIDEBAR_KEY = "ethos-sidebar";

/**
 * Runs in <head> before first paint so the stored theme and sidebar width never flash.
 * Dark is the server-rendered default; this only ever switches away from it.
 */
export const preferenceBootScript = `(function(){try{var d=document.documentElement;if(localStorage.getItem("${THEME_KEY}")==="light")d.classList.remove("dark");if(localStorage.getItem("${SIDEBAR_KEY}")==="collapsed")d.dataset.sidebar="collapsed"}catch(e){}})()`;

function persist(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode); the preference still applies for this visit.
  }
}

export function readDocumentPreferences(): { theme: Theme; sidebarCollapsed: boolean } {
  const root = document.documentElement;
  return {
    theme: root.classList.contains("dark") ? "dark" : "light",
    sidebarCollapsed: root.dataset.sidebar === "collapsed",
  };
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  persist(THEME_KEY, theme);
}

export function applySidebarCollapsed(collapsed: boolean): void {
  const root = document.documentElement;
  if (collapsed) root.dataset.sidebar = "collapsed";
  else delete root.dataset.sidebar;
  persist(SIDEBAR_KEY, collapsed ? "collapsed" : "expanded");
}
