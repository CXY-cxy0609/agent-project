import axios from 'axios';
import { message } from 'ant-design-vue';
import { useAuthStore } from '@/stores/auth';
import router from '@/router';

const http = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  const authStore = useAuthStore();
  if (authStore.token?.accessToken) {
    config.headers.Authorization = `Bearer ${authStore.token.accessToken}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status;
    if (status === 401) {
      const authStore = useAuthStore();
      authStore.clearAuth();
      router.push({ name: 'login' });
      message.error('登录已过期，请重新登录');
    } else if (status === 403) {
      message.error('无权限访问');
    } else if (status === 429) {
      message.error('请求过于频繁，请稍后再试');
    } else {
      const msg = error.response?.data?.message || '服务器异常，请稍后再试';
      message.error(msg);
    }
    return Promise.reject(error);
  },
);

export default http;
