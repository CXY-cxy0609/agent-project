<template>
  <a-layout class="basic-layout">
    <AppSidebar />
    <a-layout class="main-container">
      <a-layout-content class="page-content">
        <router-view v-slot="{ Component, route }">
          <transition name="fade" mode="out-in">
            <component :is="Component" :key="route.fullPath" />
          </transition>
        </router-view>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import AppSidebar from './components/AppSidebar.vue';
</script>

<style scoped lang="less">
.basic-layout {
  height: 100dvh;
  overflow: hidden;
  display: flex;
}

.main-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.page-content {
  flex: 1;
  overflow: auto;
  background: @color-bg;
  min-height: 0;
}
</style>
