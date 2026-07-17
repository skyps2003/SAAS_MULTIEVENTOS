import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://tupos.onrender.com/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = 'Bearer ' + token;
  }
  return config;
});

let isRedirectingToLogin = false;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = String(error.config?.url || '');
    const isLoginRequest = requestUrl.includes('/auth/login');

    if (status === 401 && !isLoginRequest && !isRedirectingToLogin) {
      isRedirectingToLogin = true;
      localStorage.removeItem('token');
      localStorage.removeItem('auth-storage');
      localStorage.removeItem('event-storage');
      localStorage.removeItem('paleta');
      localStorage.removeItem('codigo_caja');
      window.location.assign('/login?session=expired');
    }

    return Promise.reject(error);
  },
);

export default api;
