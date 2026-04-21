<template>
  <a-config-provider :theme="antdTheme">
    <router-view />
  </a-config-provider>
</template>

<script setup lang="ts">
import { theme } from 'ant-design-vue';

const antdTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#1a3a6e',
    colorLink: '#1a3a6e',
    colorSuccess: '#52c41a',
    colorWarning: '#d4a017',
    colorError: '#ff4d4f',
    fontFamily: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    borderRadius: 6,
    fontSize: 14,
  },
  components: {
    Menu: {
      darkItemBg: '#0f1e3d',
      darkSubMenuItemBg: '#0a1628',
      darkItemColor: 'rgba(255,255,255,0.85)',
      darkItemHoverColor: '#ffffff',
      darkItemSelectedColor: '#d4a017',
      darkItemSelectedBg: 'rgba(212,160,23,0.15)',
    },
    Layout: {
      siderBg: '#0f1e3d',
      headerBg: '#ffffff',
    },
  },
};
</script>
