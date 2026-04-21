<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">个人信息</h1>
      <p class="page-desc">管理您的账号资料和安全设置</p>
    </div>

    <a-row :gutter="[24, 24]">
      <!-- Profile Card -->
      <a-col :span="8">
        <profile-card
          :user="authStore.user"
          :stats="profileStats"
          @avatar-change="handleAvatarChange"
        />
      </a-col>

      <!-- Edit Forms -->
      <a-col :span="16">
        <!-- Basic Info -->
        <div class="settings-card">
          <div class="settings-card-title">基本信息</div>
          <a-form
            :model="profileForm"
            layout="vertical"
            class="settings-form"
            @finish="saveProfile"
          >
            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item label="用户名">
                  <a-input
                    v-model:value="profileForm.username"
                    placeholder="输入新的用户名"
                    maxlength="20"
                    show-count
                  />
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="手机号">
                  <a-input :value="authStore.user?.phone" disabled />
                </a-form-item>
              </a-col>
            </a-row>
            <a-form-item>
              <a-button
                type="primary"
                html-type="submit"
                :loading="savingProfile"
                class="save-btn"
              >
                保存基本信息
              </a-button>
            </a-form-item>
          </a-form>
        </div>

        <!-- Password -->
        <div class="settings-card" style="margin-top: 16px">
          <div class="settings-card-title">修改密码</div>
          <a-form
            :model="passwordForm"
            :rules="passwordRules"
            layout="vertical"
            class="settings-form"
            @finish="changePassword"
          >
            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item name="oldPassword" label="当前密码">
                  <a-input-password
                    v-model:value="passwordForm.oldPassword"
                    placeholder="输入当前密码"
                  />
                </a-form-item>
              </a-col>
            </a-row>
            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item name="newPassword" label="新密码">
                  <a-input-password
                    v-model:value="passwordForm.newPassword"
                    placeholder="至少 6 位"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item name="confirmNewPassword" label="确认新密码">
                  <a-input-password
                    v-model:value="passwordForm.confirmNewPassword"
                    placeholder="再次输入新密码"
                  />
                </a-form-item>
              </a-col>
            </a-row>
            <a-form-item>
              <a-button
                html-type="submit"
                :loading="changingPassword"
                class="save-btn"
              >
                修改密码
              </a-button>
            </a-form-item>
          </a-form>
        </div>

        <!-- Danger Zone -->
        <div class="settings-card danger-zone" style="margin-top: 16px">
          <div class="settings-card-title danger-title">账号操作</div>
          <div class="danger-actions">
            <div class="danger-item">
              <div>
                <div class="danger-item-title">退出登录</div>
                <div class="danger-item-desc">退出当前账号，返回登录页</div>
              </div>
              <a-button danger @click="handleLogout">退出登录</a-button>
            </div>
          </div>
        </div>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { authApi } from '@/api/auth';
import { subjectsApi } from '@/api/subjects';
import { chatApi } from '@/api/chat';
import { knowledgeApi } from '@/api/knowledge';
import { useAuthStore } from '@/stores/auth';
import ProfileCard from '@/components/profile/ProfileCard.vue';

const router = useRouter();
const authStore = useAuthStore();

const savingProfile = ref(false);
const changingPassword = ref(false);

const profileStats = ref({ subjects: 0, conversations: 0, knowledgeBases: 0 });

const profileForm = ref({ username: authStore.user?.username ?? '' });

const passwordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmNewPassword: '',
});

const passwordRules = {
  oldPassword: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' },
  ],
  confirmNewPassword: [
    {
      validator: (_: unknown, v: string) =>
        v === passwordForm.value.newPassword
          ? Promise.resolve()
          : Promise.reject('两次密码不一致'),
      trigger: 'blur',
    },
  ],
};

function handleAvatarChange(file: File) {
  const url = URL.createObjectURL(file);
  authStore.updateUser({ avatar: url });
  message.success('头像已更新（预览）');
}

async function saveProfile() {
  if (!profileForm.value.username.trim()) {
    message.warning('用户名不能为空');
    return;
  }
  savingProfile.value = true;
  try {
    const updated = await authApi.updateProfile({ username: profileForm.value.username });
    authStore.updateUser(updated);
    message.success('保存成功');
  } finally {
    savingProfile.value = false;
  }
}

async function changePassword() {
  changingPassword.value = true;
  try {
    await authApi.updatePassword({
      oldPassword: passwordForm.value.oldPassword,
      newPassword: passwordForm.value.newPassword,
      confirmNewPassword: passwordForm.value.confirmNewPassword,
    });
    message.success('密码修改成功，请重新登录');
    authStore.clearAuth();
    router.push('/login');
  } finally {
    changingPassword.value = false;
  }
}

function handleLogout() {
  authStore.clearAuth();
  message.success('已退出登录');
  router.push('/');
}

onMounted(async () => {
  profileForm.value.username = authStore.user?.username ?? '';
  const [subjects, convResult, kbs] = await Promise.allSettled([
    subjectsApi.getMySubjects(),
    chatApi.getConversations({ pageSize: 1 }),
    knowledgeApi.getKnowledgeBases(),
  ]);
  if (subjects.status === 'fulfilled') profileStats.value.subjects = subjects.value.length;
  if (convResult.status === 'fulfilled') profileStats.value.conversations = convResult.value.total;
  if (kbs.status === 'fulfilled') profileStats.value.knowledgeBases = kbs.value.length;
});
</script>

<style scoped lang="less">
.page-container {
  padding: 24px 32px;
  max-width: 1000px;
}

.page-header {
  margin-bottom: 24px;
}

.page-title {
  font-family: @font-serif;
  font-size: 24px;
  font-weight: 700;
  color: @color-text-primary;
  margin: 0;
}

.page-desc {
  font-size: 14px;
  color: @color-text-muted;
  margin: 4px 0 0;
}

.settings-card {
  background: #fff;
  border-radius: @radius-lg;
  padding: 24px;
  border: 1px solid @color-border;
  box-shadow: @shadow-sm;
}

.settings-card-title {
  font-family: @font-serif;
  font-size: 16px;
  font-weight: 600;
  color: @color-text-primary;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid @color-border-light;
}

.settings-form {
  margin-top: 4px;
}

:deep(.ant-form-item-label label) {
  font-weight: 500;
  color: @color-text-secondary;
}

.save-btn {
  min-width: 120px;
}

.danger-zone {
  border-color: rgba(255, 77, 79, 0.2) !important;
}

.danger-title {
  color: #ff4d4f !important;
}

.danger-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.danger-item-title {
  font-size: 14px;
  font-weight: 500;
  color: @color-text-primary;
}

.danger-item-desc {
  font-size: 13px;
  color: @color-text-muted;
  margin-top: 4px;
}
</style>
