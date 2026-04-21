<template>
  <div class="auth-left">
    <div class="auth-brand">
      <div class="brand-icon" @click="$router.push('/')">研</div>
      <span class="brand-name" @click="$router.push('/')">研智辅导</span>
    </div>

    <div class="auth-quote">
      <blockquote>
        <p>{{ quote }}</p>
        <cite>{{ quoteSource }}</cite>
      </blockquote>
    </div>

    <div class="auth-left-bottom">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  quote: string;
  quoteSource: string;
}>();
</script>

<style scoped lang="less">
.auth-left {
  flex: 0 0 440px;
  background: linear-gradient(160deg, @color-primary-dark 0%, @color-primary 60%, @color-primary-light 100%);
  display: flex;
  flex-direction: column;
  padding: 40px 48px;
  position: relative;
  overflow: hidden;
}

.auth-left::before {
  content: '';
  position: absolute;
  width: 400px;
  height: 400px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.04);
  top: -100px;
  right: -120px;
}

.auth-left::after {
  content: '';
  position: absolute;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  background: rgba(212, 160, 23, 0.08);
  bottom: -80px;
  left: -80px;
}

.auth-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  position: relative;
  z-index: 1;
}

.brand-icon {
  width: 38px;
  height: 38px;
  background: rgba(212, 160, 23, 0.2);
  border: 2px solid @color-accent;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: @font-serif;
  font-size: 18px;
  font-weight: 700;
  color: @color-accent;
}

.brand-name {
  font-family: @font-serif;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.auth-quote {
  flex: 1;
  display: flex;
  align-items: center;
  position: relative;
  z-index: 1;
}

.auth-quote blockquote {
  border-left: 3px solid @color-accent;
  padding-left: 20px;
}

.auth-quote p {
  font-family: @font-serif;
  font-size: 22px;
  color: rgba(255, 255, 255, 0.95);
  line-height: 1.5;
  margin-bottom: 10px;
}

.auth-quote cite {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  font-style: normal;
}

.auth-left-bottom {
  position: relative;
  z-index: 1;
}
</style>
