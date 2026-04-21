<template>
  <a-layout-sider
    v-model:collapsed="collapsed"
    :width="240"
    :collapsed-width="64"
    collapsible
    :trigger="null"
    class="app-sidebar"
  >
    <!-- Logo -->
    <div class="sidebar-logo" :class="{ collapsed }">
      <div class="logo-icon">研</div>
      <transition name="fade">
        <span v-if="!collapsed" class="logo-text">研智辅导</span>
      </transition>
    </div>

    <!-- Navigation Menu -->
    <a-menu
      v-model:selectedKeys="selectedKeys"
      theme="dark"
      mode="inline"
      :inline-collapsed="collapsed"
      class="sidebar-menu"
      @select="handleMenuSelect"
    >
      <a-menu-item key="chat" @click="$router.push('/app/chat')">
        <template #icon><MessageOutlined /></template>
        <span>问答中心</span>
      </a-menu-item>

      <a-menu-item key="history" @click="$router.push('/app/history')">
        <template #icon><HistoryOutlined /></template>
        <span>问答历史</span>
      </a-menu-item>

      <a-menu-item key="analytics" @click="$router.push('/app/analytics')">
        <template #icon><BarChartOutlined /></template>
        <span>学情记录</span>
      </a-menu-item>

      <a-menu-item key="knowledge" @click="$router.push('/app/knowledge')">
        <template #icon><BookOutlined /></template>
        <span>知识库</span>
      </a-menu-item>

      <a-menu-item key="subjects" @click="$router.push('/app/subjects')">
        <template #icon><AppstoreOutlined /></template>
        <span>学科管理</span>
      </a-menu-item>

      <a-menu-item v-if="authStore.isAdmin" key="admin" @click="$router.push('/app/admin')">
        <template #icon><SettingOutlined /></template>
        <span>管理中心</span>
      </a-menu-item>
    </a-menu>

    <!-- Collapse Toggle -->
    <div class="sidebar-collapse-btn" @click="collapsed = !collapsed">
      <MenuFoldOutlined v-if="!collapsed" />
      <MenuUnfoldOutlined v-else />
    </div>

    <!-- User Profile (bottom) -->
    <div class="sidebar-user" :class="{ collapsed }" @click="$router.push('/app/profile')">
      <a-avatar :size="32" :src="authStore.user?.avatar" class="user-avatar">
        {{ authStore.user?.username?.[0]?.toUpperCase() }}
      </a-avatar>
      <transition name="fade">
        <div v-if="!collapsed" class="user-info">
          <div class="user-name">{{ authStore.user?.username }}</div>
          <div class="user-role">{{ authStore.user?.role === 'admin' ? '管理员' : '学生' }}</div>
        </div>
      </transition>
    </div>
  </a-layout-sider>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  MessageOutlined,
  HistoryOutlined,
  BarChartOutlined,
  BookOutlined,
  AppstoreOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons-vue';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const authStore = useAuthStore();
const collapsed = ref(false);

const selectedKeys = computed(() => {
  const name = route.name as string;
  return [name];
});

function handleMenuSelect() {}

watch(
  () => route.name,
  () => {},
);
</script>

<style scoped lang="less">
.app-sidebar {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: @color-bg-sidebar !important;
  position: sticky;
  top: 0;
  left: 0;
  overflow: hidden;
  flex-shrink: 0;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
  height: 56px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.sidebar-logo.collapsed {
  padding: 0;
  justify-content: center;
}

.logo-icon {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, @color-accent, @color-accent-dark);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: @font-serif;
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.logo-text {
  font-family: @font-serif;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
}

.sidebar-menu {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  background: transparent !important;
  border: none !important;
  padding: 8px 0;
}

:deep(.ant-menu-item) {
  margin: 2px 8px !important;
  border-radius: 8px !important;
  width: calc(100% - 16px) !important;
}

:deep(.ant-menu-item-selected) {
  background-color: rgba(212, 160, 23, 0.18) !important;
  color: @color-accent !important;
}

:deep(.ant-menu-item-selected .anticon) {
  color: @color-accent !important;
}

.sidebar-collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  color: @color-text-sidebar-muted;
  cursor: pointer;
  font-size: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  transition: color 0.2s;
}

.sidebar-collapse-btn:hover {
  color: @color-text-sidebar;
}

.sidebar-user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  cursor: pointer;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  transition: background 0.2s;
  min-height: 60px;
}

.sidebar-user:hover {
  background: @color-bg-sidebar-hover;
}

.sidebar-user.collapsed {
  justify-content: center;
  padding: 12px 0;
}

.user-avatar {
  background: @color-primary-light;
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
}

.user-info {
  overflow: hidden;
}

.user-name {
  color: @color-text-sidebar;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role {
  color: @color-text-sidebar-muted;
  font-size: 11px;
  white-space: nowrap;
}
</style>
