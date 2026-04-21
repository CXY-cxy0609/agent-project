<template>
  <div class="auth-page">
    <auth-left-panel
      quote="学而不思则罔，思而不学则殆。"
      quote-source="—— 《论语·为政》"
    >
      <div class="auth-left-visual">
        <div class="visual-card">
          <BarChartOutlined class="vc-icon" />
          <span>智能学情分析，精准定位薄弱点</span>
        </div>
        <div class="visual-card">
          <BulbOutlined class="vc-icon" />
          <span>AI 深度讲解，告别死记硬背</span>
        </div>
        <div class="visual-card">
          <TrophyOutlined class="vc-icon" />
          <span>个性化复习计划，高效备考</span>
        </div>
      </div>
    </auth-left-panel>

    <div class="auth-right">
      <div class="auth-card">
        <div class="auth-card-header">
          <h2 class="auth-title">欢迎回来</h2>
          <p class="auth-subtitle">登录您的账号，继续备考之旅</p>
        </div>

        <!-- Login Mode Tabs -->
        <a-tabs v-model:activeKey="loginMode" class="auth-tabs" centered>
          <a-tab-pane key="password" tab="密码登录" />
          <a-tab-pane key="code" tab="验证码登录" />
        </a-tabs>

        <!-- Password Login Form -->
        <a-form
          v-if="loginMode === 'password'"
          ref="passwordFormRef"
          :model="passwordForm"
          :rules="passwordRules"
          layout="vertical"
          class="auth-form"
          @finish="handlePasswordLogin"
        >
          <a-form-item name="phone" label="手机号">
            <a-input
              v-model:value="passwordForm.phone"
              size="large"
              placeholder="请输入手机号"
              :prefix="h(MobileOutlined)"
              maxlength="11"
            />
          </a-form-item>
          <a-form-item name="password" label="密码">
            <a-input-password
              v-model:value="passwordForm.password"
              size="large"
              placeholder="请输入密码"
              :prefix="h(LockOutlined)"
            />
          </a-form-item>
          <a-form-item>
            <a-button
              type="primary"
              html-type="submit"
              size="large"
              block
              :loading="loading"
              class="submit-btn"
            >
              登录
            </a-button>
          </a-form-item>
        </a-form>

        <!-- Code Login Form -->
        <a-form
          v-else
          ref="codeFormRef"
          :model="codeForm"
          :rules="codeRules"
          layout="vertical"
          class="auth-form"
          @finish="handleCodeLogin"
        >
          <a-form-item name="phone" label="手机号">
            <a-input
              v-model:value="codeForm.phone"
              size="large"
              placeholder="请输入手机号"
              :prefix="h(MobileOutlined)"
              maxlength="11"
            />
          </a-form-item>
          <a-form-item name="code" label="验证码">
            <a-input
              v-model:value="codeForm.code"
              size="large"
              placeholder="请输入验证码"
              :prefix="h(SafetyOutlined)"
              maxlength="6"
            >
              <template #suffix>
                <a-button
                  type="link"
                  size="small"
                  :disabled="countdown > 0 || !codeForm.phone"
                  style="padding: 0; font-size: 13px"
                  @click="sendCode"
                >
                  {{ countdown > 0 ? `${countdown}s 后重发` : '获取验证码' }}
                </a-button>
              </template>
            </a-input>
          </a-form-item>
          <a-form-item>
            <a-button
              type="primary"
              html-type="submit"
              size="large"
              block
              :loading="loading"
              class="submit-btn"
            >
              登录
            </a-button>
          </a-form-item>
        </a-form>

        <div class="auth-footer-link">
          还没有账号？
          <router-link to="/register">立即注册</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, h } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { message } from 'ant-design-vue';
import {
  MobileOutlined,
  LockOutlined,
  SafetyOutlined,
  BarChartOutlined,
  BulbOutlined,
  TrophyOutlined,
} from '@ant-design/icons-vue';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/stores/auth';
import AuthLeftPanel from '@/components/auth/AuthLeftPanel.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const loginMode = ref<'password' | 'code'>('password');
const loading = ref(false);
const countdown = ref(0);

const passwordForm = ref({ phone: '', password: '' });
const codeForm = ref({ phone: '', code: '' });

const phoneValidator = (_: unknown, value: string) => {
  if (!value) return Promise.reject('请输入手机号');
  if (!/^1[3-9]\d{9}$/.test(value)) return Promise.reject('手机号格式不正确');
  return Promise.resolve();
};

const passwordRules = {
  phone: [{ validator: phoneValidator, trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' },
  ],
};

const codeRules = {
  phone: [{ validator: phoneValidator, trigger: 'blur' }],
  code: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { len: 6, message: '验证码为 6 位', trigger: 'blur' },
  ],
};

async function sendCode() {
  if (!codeForm.value.phone || !/^1[3-9]\d{9}$/.test(codeForm.value.phone)) {
    message.warning('请先输入正确的手机号');
    return;
  }
  try {
    await authApi.sendCode(codeForm.value.phone);
    message.success('验证码已发送');
    countdown.value = 60;
    const timer = setInterval(() => {
      countdown.value--;
      if (countdown.value <= 0) clearInterval(timer);
    }, 1000);
  } catch {}
}

async function handlePasswordLogin() {
  loading.value = true;
  try {
    const res = await authApi.loginByPassword(passwordForm.value);
    authStore.setAuth(res.user, res.token);
    message.success('登录成功');
    const redirect = (route.query.redirect as string) || '/app/chat';
    router.push(redirect);
  } finally {
    loading.value = false;
  }
}

async function handleCodeLogin() {
  loading.value = true;
  try {
    const res = await authApi.loginByCode(codeForm.value);
    authStore.setAuth(res.user, res.token);
    message.success('登录成功');
    const redirect = (route.query.redirect as string) || '/app/chat';
    router.push(redirect);
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped lang="less">
.auth-page {
  min-height: 100vh;
  display: flex;
}

.auth-left-visual {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.visual-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}

.vc-icon {
  font-size: 18px;
  color: @color-accent;
  flex-shrink: 0;
}

.auth-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: #fff;
}

.auth-card {
  width: 100%;
  max-width: 400px;
}

.auth-card-header {
  margin-bottom: 24px;
}

.auth-title {
  font-family: @font-serif;
  font-size: 28px;
  font-weight: 700;
  color: @color-text-primary;
  margin-bottom: 6px;
}

.auth-subtitle {
  font-size: 14px;
  color: @color-text-muted;
}

.auth-tabs {
  margin-bottom: 8px;
}

:deep(.ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn) {
  color: @color-primary !important;
  font-weight: 600;
}

:deep(.ant-tabs-ink-bar) {
  background: @color-primary !important;
}

.auth-form {
  margin-top: 8px;
}

:deep(.ant-input-affix-wrapper),
:deep(.ant-input) {
  border-radius: 8px !important;
}

:deep(.ant-form-item-label label) {
  font-weight: 500;
  color: @color-text-secondary;
}

.submit-btn {
  height: 46px !important;
  font-size: 15px !important;
  font-weight: 500 !important;
  border-radius: 8px !important;
  background: linear-gradient(135deg, @color-primary, @color-primary-light) !important;
  border: none !important;
  box-shadow: 0 6px 20px rgba(26, 58, 110, 0.2) !important;
  margin-top: 4px;
}

.auth-footer-link {
  text-align: center;
  font-size: 14px;
  color: @color-text-muted;
}

.auth-footer-link a {
  color: @color-primary;
  font-weight: 500;
}
</style>
