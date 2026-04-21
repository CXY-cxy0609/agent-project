<template>
  <a-modal
    :open="open"
    :title="editingKb ? '编辑知识库' : '新建知识库'"
    :confirm-loading="saving"
    ok-text="保存"
    cancel-text="取消"
    @ok="handleSave"
    @cancel="$emit('update:open', false)"
  >
    <a-form :model="form" layout="vertical" style="margin-top: 8px">
      <a-form-item label="知识库名称" required>
        <a-input v-model:value="form.name" placeholder="请输入知识库名称" maxlength="50" />
      </a-form-item>
      <a-form-item label="所属学科">
        <a-input :value="subjectName" disabled />
      </a-form-item>
      <a-form-item label="类型" required>
        <a-radio-group v-model:value="form.type">
          <a-radio value="private">私有（仅自己可见）</a-radio>
          <a-radio value="public">公有（所有人可使用）</a-radio>
        </a-radio-group>
      </a-form-item>
      <a-form-item label="描述（选填）">
        <a-textarea
          v-model:value="form.description"
          placeholder="请输入知识库描述"
          :rows="3"
          :maxlength="200"
          show-count
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { KnowledgeBase } from '@kaoyan/shared';

interface KbFormData {
  name: string;
  type: 'public' | 'private';
  description: string;
}

const props = defineProps<{
  open: boolean;
  editingKb: KnowledgeBase | null;
  subjectName: string;
  saving: boolean;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  save: [data: KbFormData];
}>();

const form = ref<KbFormData>({ name: '', type: 'private', description: '' });

watch(
  () => props.open,
  (val) => {
    if (val) {
      form.value = props.editingKb
        ? { name: props.editingKb.name, type: props.editingKb.type, description: props.editingKb.description ?? '' }
        : { name: '', type: 'private', description: '' };
    }
  },
);

function handleSave() {
  emit('save', { ...form.value });
}
</script>
