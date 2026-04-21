import { createApp } from 'vue';
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import Antd from 'ant-design-vue';
import 'ant-design-vue/dist/reset.css';
import App from './App.vue';
import router from './router';
import './assets/styles/global.less';
import { USE_MOCK } from './mock/config';
import { MOCK_USER, MOCK_TOKEN } from './mock/data';
import { useAuthStore } from './stores/auth';

const app = createApp(App);

const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

app.use(pinia);
app.use(router);
app.use(Antd);

// 在 Mock 模式下自动填充认证状态，跳过登录流程
if (USE_MOCK) {
  const authStore = useAuthStore();
  if (!authStore.isLoggedIn) {
    authStore.setAuth(MOCK_USER, MOCK_TOKEN);
  }
}

app.mount('#app');
