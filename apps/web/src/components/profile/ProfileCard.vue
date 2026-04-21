<template>
  <div class="profile-card">
    <div class="profile-avatar-section">
      <div class="avatar-wrapper" @click="triggerUpload">
        <a-avatar :size="88" :src="user?.avatar" class="profile-avatar">
          {{ user?.username?.[0]?.toUpperCase() }}
        </a-avatar>
        <div class="avatar-upload-overlay">
          <CameraOutlined />
        </div>
      </div>
      <input
        ref="avatarInput"
        type="file"
        accept="image/*"
        style="display: none"
        @change="handleAvatarChange"
      />
    </div>

    <div class="profile-user-info">
      <div class="profile-username">{{ user?.username }}</div>
      <div class="profile-role">
        <a-tag :color="user?.role === 'admin' ? 'gold' : 'blue'">
          {{ user?.role === 'admin' ? '管理员' : '学生' }}
        </a-tag>
      </div>
      <div class="profile-phone">{{ maskedPhone }}</div>
    </div>

    <a-divider />

    <div class="profile-stats">
      <div class="ps-item">
        <div class="ps-num">{{ stats.subjects }}</div>
        <div class="ps-label">学科</div>
      </div>
      <div class="ps-divider"></div>
      <div class="ps-item">
        <div class="ps-num">{{ stats.conversations }}</div>
        <div class="ps-label">对话</div>
      </div>
      <div class="ps-divider"></div>
      <div class="ps-item">
        <div class="ps-num">{{ stats.knowledgeBases }}</div>
        <div class="ps-label">知识库</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { message } from 'ant-design-vue';
import { CameraOutlined } from '@ant-design/icons-vue';

interface UserInfo {
  username?: string;
  avatar?: string;
  phone?: string;
  role?: string;
}

interface Stats {
  subjects: number;
  conversations: number;
  knowledgeBases: number;
}

const props = defineProps<{
  user: UserInfo | null | undefined;
  stats: Stats;
}>();

const emit = defineEmits<{
  'avatar-change': [file: File];
}>();

const avatarInput = ref<HTMLInputElement | null>(null);

const maskedPhone = computed(() => {
  const phone = props.user?.phone ?? '';
  if (phone.length === 11) return `${phone.slice(0, 3)}****${phone.slice(7)}`;
  return phone;
});

function triggerUpload() {
  avatarInput.value?.click();
}

function handleAvatarChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    message.warning('头像文件不超过 5MB');
    return;
  }
  emit('avatar-change', file);
}
</script>

<style scoped lang="less">
.profile-card {
  background: #fff;
  border-radius: @radius-xl;
  padding: 28px 24px;
  border: 1px solid @color-border;
  box-shadow: @shadow-sm;
  text-align: center;
}

.profile-avatar-section {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}

.avatar-wrapper {
  position: relative;
  display: inline-block;
  cursor: pointer;
}

.profile-avatar {
  background: linear-gradient(135deg, @color-primary, @color-primary-light) !important;
  font-size: 36px !important;
  font-weight: 700 !important;
}

.avatar-upload-overlay {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 20px;
  opacity: 0;
  transition: opacity 0.2s;
}

.avatar-wrapper:hover .avatar-upload-overlay {
  opacity: 1;
}

.profile-username {
  font-family: @font-serif;
  font-size: 20px;
  font-weight: 700;
  color: @color-text-primary;
  margin-bottom: 8px;
}

.profile-role {
  margin-bottom: 8px;
}

.profile-phone {
  font-size: 13px;
  color: @color-text-muted;
}

.profile-stats {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 4px 0;
}

.ps-item {
  text-align: center;
  flex: 1;
}

.ps-num {
  font-family: @font-serif;
  font-size: 24px;
  font-weight: 700;
  color: @color-primary;
}

.ps-label {
  font-size: 12px;
  color: @color-text-muted;
  margin-top: 4px;
}

.ps-divider {
  width: 1px;
  height: 36px;
  background: @color-border;
}
</style>
