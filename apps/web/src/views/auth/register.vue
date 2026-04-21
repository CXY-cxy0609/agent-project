<template>
  <div class="auth-page">
    <auth-left-panel
      quote="路漫漫其修远兮，吾将上下而求索。"
      quote-source="—— 屈原《离骚》"
    >
      <div class="auth-steps">
        <div class="steps-title">注册后即可享受</div>
        <div v-for="(item, i) in benefits" :key="i" class="benefit-item">
          <div class="benefit-num">{{ i + 1 }}</div>
          <span>{{ item }}</span>
        </div>
      </div>
    </auth-left-panel>

    <div class="auth-right">
      <div class="auth-card">
        <div class="auth-card-header">
          <h2 class="auth-title">创建账号</h2>
          <p class="auth-subtitle">加入研智辅导，开启智能备考</p>
        </div>

        <a-form
          ref="formRef"
          :model="form"
          :rules="rules"
          layout="vertical"
          class="auth-form"
          @finish="handleRegister"
        >
          <a-form-item name="phone" label="手机号">
            <a-input
              v-model:value="form.phone"
              size="large"
              placeholder="请输入手机号"
              :prefix="h(MobileOutlined)"
              maxlength="11"
            />
          </a-form-item>

          <a-form-item name="username" label="用户名">
            <a-input
              v-model:value="form.username"
              size="large"
              placeholder="请设置用户名（2-20个字符）"
              :prefix="h(UserOutlined)"
              maxlength="20"
            />
          </a-form-item>

          <a-form-item name="password" label="密码">
            <a-input-password
              v-model:value="form.password"
              size="large"
              placeholder="请设置密码（至少6位）"
              :prefix="h(LockOutlined)"
            />
          </a-form-item>

          <a-form-item name="confirmPassword" label="确认密码">
            <a-input-password
              v-model:value="form.confirmPassword"
              size="large"
              placeholder="请再次输入密码"
              :prefix="h(LockOutlined)"
            />
          </a-form-item>

          <a-form-item style="margin-top: 8px">
            <a-button
              type="primary"
              html-type="submit"
              size="large"
              block
              :loading="loading"
              class="submit-btn"
            >
              注册账号
            </a-button>
          </a-form-item>
        </a-form>

        <div class="auth-footer-link">
          已有账号？
          <router-link to="/login">立即登录</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, h } from 'vue';
import { useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { MobileOutlined, LockOutlined, UserOutlined } from '@ant-design/icons-vue';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/stores/auth';
import AuthLeftPanel from '@/components/auth/AuthLeftPanel.vue';

const router = useRouter();
const authStore = useAuthStore();
const loading = ref(false);

const form = ref({
  phone: '',
  username: '',
  password: '',
  confirmPassword: '',
});

const rules = {
  phone: [
    {
      validator: (_: unknown, value: string) => {
        if (!value) return Promise.reject('请输入手机号');
        if (!/^1[3-9]\d{9}$/.test(value)) return Promise.reject('手机号格式不正确');
        return Promise.resolve();
      },
      trigger: 'blur',
    },
  ],
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, max: 20, message: '用户名长度为 2-20 个字符', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' },
  ],
  confirmPassword: [
    {
      validator: (_: unknown, value: string) => {
        if (!value) return Promise.reject('请再次输入密码');
        if (value !== form.value.password) return Promise.reject('两次密码输入不一致');
        return Promise.resolve();
      },
      trigger: 'blur',
    },
  ],
};

const benefits = [
  '免费使用 AI 知识点讲解与题目解析',
  '上传个人知识库，获得个性化检索',
  '学情分析追踪薄弱知识点，精准复习',
];

async function handleRegister() {
  loading.value = true;
  try {
    const res = await authApi.register(form.value);
    authStore.setAuth(res.user, res.token);
    message.success('注册成功，欢迎加入研智辅导！');
    router.push('/app/chat');
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

.auth-steps {
  display: flex;
  flex-direction: column;
}

.steps-title {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 14px;
}

.benefit-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}

.benefit-num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: @color-accent;
  color: #1a2744;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
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
}

.auth-footer-link {
  text-align: center;
  font-size: 14px;
  color: @color-text-muted;
  margin-top: 16px;
}

.auth-footer-link a {
  color: @color-primary;
  font-weight: 500;
}
</style>
