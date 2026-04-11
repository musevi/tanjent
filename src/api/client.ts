import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '',  // Vite proxy forwards /auth and /sessions to :8000
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
