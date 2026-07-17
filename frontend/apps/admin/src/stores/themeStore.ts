import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const getInitialDarkMode = () => {
  try {
    const persisted = localStorage.getItem('theme-storage');
    if (persisted) {
      const parsed = JSON.parse(persisted);
      if (typeof parsed?.state?.isDarkMode === 'boolean') return parsed.state.isDarkMode;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
};

const initialDarkMode = getInitialDarkMode();
document.documentElement.classList.toggle('dark', initialDarkMode);

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      isDarkMode: initialDarkMode,
      toggleTheme: () => set((state) => {
        const newMode = !state.isDarkMode;
        document.documentElement.classList.toggle('dark', newMode);
        return { isDarkMode: newMode };
      }),
    }),
    {
      name: 'theme-storage',
      onRehydrateStorage: () => (state) => {
        document.documentElement.classList.toggle('dark', Boolean(state?.isDarkMode));
      },
    }
  )
);
