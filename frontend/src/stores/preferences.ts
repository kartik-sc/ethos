import { create } from "zustand";

import {
  applySidebarCollapsed,
  applyTheme,
  readDocumentPreferences,
  type Theme,
} from "@/lib/preferences";

interface PreferencesState {
  theme: Theme;
  sidebarCollapsed: boolean;
  syncFromDocument: () => void;
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
}

// Defaults match the server render; syncFromDocument picks up the boot script's result.
export const usePreferences = create<PreferencesState>()((set, get) => ({
  theme: "dark",
  sidebarCollapsed: false,
  syncFromDocument: () => set(readDocumentPreferences()),
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  toggleSidebar: () => {
    const sidebarCollapsed = !get().sidebarCollapsed;
    applySidebarCollapsed(sidebarCollapsed);
    set({ sidebarCollapsed });
  },
}));
