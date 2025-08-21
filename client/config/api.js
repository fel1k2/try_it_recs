import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

//const API_URL = 'https://tryitrecommendations.ru'; 
const API_URL = 'http://192.168.0.15:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const shouldRefreshToken = async () => {
  try {
    const tokenData = await AsyncStorage.getItem('refresh_token_data');
    if (!tokenData) return true;
    const { timestamp } = JSON.parse(tokenData);
    const now = Date.now();
    const tokenAge = now - timestamp;
    const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
    return tokenAge > oneWeekInMs;
  } catch {
    return true;
  }
};

api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch(err => Promise.reject(err));
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const refresh_token = await AsyncStorage.getItem('refresh_token');
        if (!refresh_token) {
          throw new Error('Refresh token не найден');
        }
        const accessResponse = await api.post('/refresh-access', {
          refresh_token,
        });
        const { access_token } = accessResponse.data;
        await AsyncStorage.setItem('access_token', access_token);
        if (await shouldRefreshToken()) {
          const refreshResponse = await api.post('/refresh-token', {
            refresh_token,
          });
          const { refresh_token: new_refresh_token } = refreshResponse.data;
          await AsyncStorage.setItem('refresh_token', new_refresh_token);
          await AsyncStorage.setItem('refresh_token_data', JSON.stringify({
            timestamp: Date.now()
          }));
        }
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        processQueue(null, access_token);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await AsyncStorage.removeItem('access_token');
        await AsyncStorage.removeItem('refresh_token');
        await AsyncStorage.removeItem('refresh_token_data');
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export const loginUser = async (login, password) => {
  try {
      const response = await api.post('/login', {
      login,
      password,
      });
      const { access_token, refresh_token } = response.data;
      await AsyncStorage.setItem('access_token', access_token);
      await AsyncStorage.setItem('refresh_token', refresh_token);
      await AsyncStorage.setItem('refresh_token_data', JSON.stringify({
      timestamp: Date.now()
      }));
      return response.data;
  } catch (error) {
    if (error.response) {
      if (error.response.data.detail.includes('wrong login or password')) {
        throw new Error('Неверный логин или пароль');
      } else {
        throw new Error(error.response.data.detail || 'Ошибка при входе');
      }
    }
    console.log("error:", error);
    throw new Error('Ошибка сети');
  }
};

export const registerUser = async (login, password, steamid64) => {
  try {
    const response = await api.post('/register', {
      login,
      password,
      steamid64,
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      if (error.response.data.detail.includes('invalid Steam ID')) {
        throw new Error('Неверный Steam ID. Пожалуйста, проверьте правильность введенного ID');
      } 
      if (error.response.data.detail.includes('User with this login already exists')) {
        throw new Error('Пользователь с данным email уже существует')
      } else {
        throw new Error(error.response.data.detail || 'Ошибка при регистрации');
      }
    }
    throw new Error('Ошибка сети');
  }
};

export const refreshAccessToken = async () => {
  try {
    const refresh_token = await AsyncStorage.getItem('refresh_token');
    if (!refresh_token) {
      throw new Error('Refresh token не найден');
    }
    const response = await api.post('/refresh-access', {
      refresh_token,
    });
    const { access_token } = response.data;
    await AsyncStorage.setItem('access_token', access_token);
    return access_token;
  } catch (error) {
    await AsyncStorage.removeItem('access_token');
    await AsyncStorage.removeItem('refresh_token');
    await AsyncStorage.removeItem('refresh_token_data');
    throw error;
  }
};

export const checkAuth = async () => {
  try {
    const refresh_token = await AsyncStorage.getItem('refresh_token');
    if (!refresh_token) {
      return false;
    }
    await refreshAccessToken();
    return true;
  } catch (error) {
    return false;
  }
};

export const logout = async () => {
  try {
    await AsyncStorage.multiRemove([
      'access_token',
      'refresh_token',
      'refresh_token_data'
    ]);
    return true;
  } catch (error) {
    console.error('Ошибка при выходе:', error);
    throw error;
  }
};

export default api; 