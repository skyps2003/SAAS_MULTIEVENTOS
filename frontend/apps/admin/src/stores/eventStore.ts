import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';
import { applyEventPalette, clearEventPalette } from '../lib/eventTheme';

export interface EventData {
  id_evento: number;
  nombre: string;
  slug: string;
  codigo_caja: string;
  logo_url: string | null;
  estado: string;
  fecha_evento: string;
  paleta: {
    id_paleta: number;
    nombre: string;
    color_primario_base: string;
    color_secundario_base: string;
    color_acento_base: string;
  } | null;
  stats?: {
    cajeros: number;
    productos: number;
    combos: number;
    ordenes: number;
    ingresos: number;
  };
}

interface EventState {
  currentEvent: EventData | null;
  isLoading: boolean;
  fetchCurrentEvent: () => Promise<void>;
  setCurrentEvent: (evento: EventData) => void;
  clearEvent: () => void;
}

export const useEventStore = create<EventState>()(
  persist(
    (set) => ({
      currentEvent: null,
      isLoading: false,
      fetchCurrentEvent: async () => {
        try {
          set({ isLoading: true });
          const res = await api.get('/evento/mi-evento');
          const eventData = res.data;
          
          if (eventData?.paleta) {
            applyEventPalette(eventData.paleta);
          }
          
          set({ currentEvent: eventData, isLoading: false });
        } catch (error) {
          console.error("Error fetching current event", error);
          set({ isLoading: false });
        }
      },
      setCurrentEvent: (evento: EventData) => {
        applyEventPalette(evento.paleta);
        set({ currentEvent: evento });
      },
      clearEvent: () => {
        clearEventPalette();
        set({ currentEvent: null });
      }
    }),
    {
      name: 'event-storage',
      onRehydrateStorage: () => (state) => {
        if (state?.currentEvent?.paleta) {
          applyEventPalette(state.currentEvent.paleta);
        }
      }
    }
  )
);
