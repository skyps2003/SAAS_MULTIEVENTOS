import api from './api';

export interface LoginResponse {
  token: string;
  usuario: {
    id_usuario: number;
    nombre: string;
    email: string;
    rol: string;
    id_evento?: number;
  };
  evento?: {
    id_evento: number;
    evento_nombre?: string;
  };
  paleta?: Record<string, string>;
}

export const authService = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/login', { email, password });
    return response.data;
  },
};
