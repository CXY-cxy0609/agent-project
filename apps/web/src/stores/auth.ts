import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { User, AuthToken } from '@tutor/shared';

export const useAuthStore = defineStore(
  'auth',
  () => {
    const user = ref<User | null>(null);
    const token = ref<AuthToken | null>(null);

    const isLoggedIn = computed(() => !!token.value?.accessToken && !!user.value);
    const isAdmin = computed(() => user.value?.role === 'admin');

    function setAuth(newUser: User, newToken: AuthToken) {
      user.value = newUser;
      token.value = newToken;
    }

    function clearAuth() {
      user.value = null;
      token.value = null;
    }

    function updateUser(updates: Partial<User>) {
      if (user.value) {
        user.value = { ...user.value, ...updates };
      }
    }

    return { user, token, isLoggedIn, isAdmin, setAuth, clearAuth, updateUser };
  },
  {
    persist: {
      key: 'tutor-auth',
      storage: localStorage,
    },
  },
);
