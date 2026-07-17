import api from './api';

export interface Usuario {
  id_usuario: number;
  nombre: string;
  email: string;
  rol: string;
  fecha_creacion: string;
}

export const usuarioService = {
  getAdministradores: async (): Promise<Usuario[]> => {
    const response = await api.get('/usuarios');
    return response.data;
  },

  crearAdministrador: async (data: any): Promise<Usuario> => {
    const response = await api.post('/usuarios', data);
    return response.data;
  },

  actualizarAdministrador: async (id: number, data: any): Promise<Usuario> => {
    const response = await api.put(`/usuarios/${id}`, data);
    return response.data;
  },

  eliminarAdministrador: async (id: number): Promise<void> => {
    await api.delete(`/usuarios/${id}`);
  }
};
