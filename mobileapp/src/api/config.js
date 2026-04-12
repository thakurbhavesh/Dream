import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// API URL — uses env variable, fallback for development only
const DEFAULT_URL = 'https://dream-s3pi.onrender.com';
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || DEFAULT_URL;
if (__DEV__ && !process.env.EXPO_PUBLIC_API_URL) {
  console.warn('[config] Using default API URL:', DEFAULT_URL);
}
export const SOCKET_URL = API_BASE_URL;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token to every request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 — try refresh with stored refresh_token
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }
    original._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      });
    }

    isRefreshing = true;
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      if (!refreshToken) throw new Error('No refresh token');

      // Send refresh token in body (mobile doesn't use cookies)
      const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
        refresh_token: refreshToken,
      });

      const result = data?.data || data;
      const newAccess = result?.access_token;
      const newRefresh = result?.refresh_token;

      if (newAccess) {
        await SecureStore.setItemAsync('accessToken', newAccess);
        if (newRefresh) await SecureStore.setItemAsync('refreshToken', newRefresh);
        original.headers.Authorization = `Bearer ${newAccess}`;
        processQueue(null, newAccess);
        return api(original);
      }
      throw new Error('No token in refresh response');
    } catch (refreshError) {
      processQueue(refreshError);
      // Only delete tokens if server explicitly rejected (401/403)
      // Don't delete on network errors — user should stay logged in
      const refreshStatus = refreshError?.response?.status;
      if (refreshStatus === 401 || refreshStatus === 403) {
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
