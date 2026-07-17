import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clearEventPalette } from '../lib/eventTheme';

export interface User {
  id_usuario: number;
  nombre: string;
  email: string;
  rol: string;
  id_evento?: number;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('paleta');
        localStorage.removeItem('event-storage');
        localStorage.removeItem('codigo_caja');
        clearEventPalette();
        set({ token: null, user: null });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
