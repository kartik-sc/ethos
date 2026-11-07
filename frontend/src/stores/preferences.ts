import { create } from "zustand";

import {
  applySidebarDocked,
  applyTheme,
  readDocumentPreferences,
  type Theme,
} from "@/lib/preferences";

interface PreferencesState {
  theme: Theme;
  sidebarDocked: boolean;
  /** Floating sidebar currently slid in. Never persisted. */
  sidebarOpen: boolean;
  syncFromDocument: () => void;
  setTheme: (theme: Theme) => void;
  toggleSidebarDocked: () => void;
  setSidebarOpen: (open: boolean) => void;
}

// Defaults match the server render; syncFromDocument picks up the boot script's result.
export const usePreferences = create<PreferencesState>()((set, get) => ({
  theme: "dark",
  sidebarDocked: false,
  sidebarOpen: false,
  syncFromDocument: () => set(readDocumentPreferences()),
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  toggleSidebarDocked: () => {
    const sidebarDocked = !get().sidebarDocked;
    applySidebarDocked(sidebarDocked);
    set({ sidebarDocked, sidebarOpen: false });
  },
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}));
