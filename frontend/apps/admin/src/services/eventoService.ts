import api from './api';

export interface Evento {
  id_evento: number;
  nombre: string;
  id_admin: number;
  id_paleta: number;
  fecha_evento: string;
  estado: 'ACTIVO' | 'INACTIVO' | 'FINALIZADO';
  logo_url: string | null;
  creado_en: string;
  admin_email?: string;
  admin_nombre?: string;
  paleta_nombre?: string;
  color_primario_base?: string;
  color_secundario_base?: string;
  color_acento_base?: string;
  codigo_caja?: string;
  slug?: string;
}

export const eventoService = {
  getEventos: async (): Promise<Evento[]> => {
    const response = await api.get('/eventos');
    return response.data;
  },

  crearEvento: async (data: any): Promise<Evento> => {
    const response = await api.post('/eventos', data);
    return response.data;
  },

  actualizarEvento: async (id: number, data: any): Promise<Evento> => {
    const response = await api.put(`/eventos/${id}`, data);
    return response.data;
  },

  actualizarEstado: async (id: number, estado: string): Promise<Evento> => {
    const response = await api.put(`/eventos/${id}/estado`, { estado });
    return response.data;
  },

  eliminarEvento: async (id: number): Promise<void> => {
    await api.delete(`/eventos/${id}`);
  }
};
