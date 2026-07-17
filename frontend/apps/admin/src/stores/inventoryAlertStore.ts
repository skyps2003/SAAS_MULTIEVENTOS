import { create } from 'zustand';
import api from '../services/api';
import { buildInventoryAlerts, type InventoryAlert } from '../lib/inventoryAlerts';

type InventoryAlertState = {
  alerts: InventoryAlert[];
  isLoading: boolean;
  lastUpdated: Date | null;
  error: string | null;
  fetchAlerts: () => Promise<void>;
};

let pendingRequest: Promise<void> | null = null;

export const useInventoryAlertStore = create<InventoryAlertState>((set) => ({
  alerts: [],
  isLoading: false,
  lastUpdated: null,
  error: null,
  fetchAlerts: async () => {
    if (pendingRequest) return pendingRequest;

    set({ isLoading: true });
    pendingRequest = (async () => {
      try {
        const [productsResponse, combosResponse] = await Promise.all([
          api.get('/productos'),
          api.get('/combos'),
        ]);
        set({
          alerts: buildInventoryAlerts(productsResponse.data || [], combosResponse.data || []),
          lastUpdated: new Date(),
          error: null,
        });
      } catch (error: any) {
        set({ error: error.response?.data?.error || 'No se pudieron actualizar las alertas.' });
      } finally {
        set({ isLoading: false });
        pendingRequest = null;
      }
    })();

    return pendingRequest;
  },
}));
