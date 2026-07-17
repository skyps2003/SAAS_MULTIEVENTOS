import api from './api';

export interface Paleta {
  id_paleta: number;
  nombre: string;
  color_primario_base: string;
  color_secundario_base: string;
  color_acento_base: string;
  color_primario_hover: string;
  color_secundario_hover: string;
  color_acento_hover: string;
  color_primario_active: string;
  color_secundario_active: string;
  color_acento_active: string;
  creado_en: string;
}

export const paletaService = {
  getPaletas: async (): Promise<Paleta[]> => {
    const response = await api.get('/paletas');
    return response.data;
  },

  crearPaleta: async (data: Partial<Paleta>): Promise<Paleta> => {
    const response = await api.post('/paletas', data);
    return response.data;
  },

  actualizarPaleta: async (id: number, data: Partial<Paleta>): Promise<Paleta> => {
    const response = await api.put(`/paletas/${id}`, data);
    return response.data;
  },

  eliminarPaleta: async (id: number): Promise<void> => {
    await api.delete(`/paletas/${id}`);
  }
};
