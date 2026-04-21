import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import { resolve } from 'path';

const variablesPath = resolve(__dirname, 'src/assets/styles/variables.less');

export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  css: {
    preprocessorOptions: {
      less: {
        additionalData: `@import "${variablesPath}";`,
        modifyVars: {
          'primary-color': '#1a3a6e',
          'link-color': '#1a3a6e',
          'border-radius-base': '6px',
        },
        javascriptEnabled: true,
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'ant-design-vue': ['ant-design-vue'],
          'ant-design-x-vue': ['ant-design-x-vue'],
          'echarts': ['echarts', 'vue-echarts'],
          'vendor': ['vue', 'vue-router', 'pinia', 'axios', 'dayjs'],
        },
      },
    },
  },
});
