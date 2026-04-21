import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'welcome',
      component: () => import('@/views/welcome/index.vue'),
      meta: { requiresAuth: false, layout: 'blank' },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/auth/login.vue'),
      meta: { requiresAuth: false, layout: 'auth' },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/auth/register.vue'),
      meta: { requiresAuth: false, layout: 'auth' },
    },
    {
      path: '/app',
      component: () => import('@/layouts/BasicLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: '/app/chat',
        },
        {
          path: 'chat',
          name: 'chat',
          component: () => import('@/views/chat/index.vue'),
          meta: { title: '问答中心', icon: 'MessageOutlined' },
        },
        {
          path: 'history',
          name: 'history',
          component: () => import('@/views/history/index.vue'),
          meta: { title: '问答历史', icon: 'HistoryOutlined' },
        },
        {
          path: 'analytics',
          name: 'analytics',
          component: () => import('@/views/analytics/index.vue'),
          meta: { title: '学情记录', icon: 'BarChartOutlined' },
        },
        {
          path: 'knowledge',
          name: 'knowledge',
          component: () => import('@/views/knowledge/index.vue'),
          meta: { title: '知识库', icon: 'BookOutlined' },
        },
        {
          path: 'subjects',
          name: 'subjects',
          component: () => import('@/views/subjects/index.vue'),
          meta: { title: '学科管理', icon: 'AppstoreOutlined' },
        },
        {
          path: 'admin',
          name: 'admin',
          component: () => import('@/views/admin/index.vue'),
          meta: { title: '管理中心', icon: 'SettingOutlined', adminOnly: true },
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('@/views/profile/index.vue'),
          meta: { title: '个人信息', icon: 'UserOutlined' },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
});

router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore();
  const requiresAuth = to.meta.requiresAuth !== false;

  if (requiresAuth && !authStore.isLoggedIn) {
    next({ name: 'login', query: { redirect: to.fullPath } });
    return;
  }

  if (!requiresAuth && authStore.isLoggedIn && (to.name === 'login' || to.name === 'register')) {
    next({ path: '/app/chat' });
    return;
  }

  if (to.meta.adminOnly && authStore.user?.role !== 'admin') {
    next({ path: '/app/chat' });
    return;
  }

  next();
});

export default router;
