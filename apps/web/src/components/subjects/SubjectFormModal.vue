<template>
  <a-modal
    :open="open"
    :title="editingSubject ? '编辑学科' : '新建学科'"
    ok-text="保存"
    cancel-text="取消"
    :confirm-loading="saving"
    @ok="handleSave"
    @cancel="$emit('update:open', false)"
  >
    <a-form :model="form" layout="vertical" style="margin-top: 8px">
      <a-form-item label="学科名称" required>
        <a-input
          v-model:value="form.name"
          placeholder="如：高等数学、英语、政治"
          maxlength="20"
        />
      </a-form-item>
      <a-form-item label="学科编号" required>
        <a-input v-model:value="form.code" placeholder="如：MATH101" maxlength="20" />
      </a-form-item>
      <a-form-item label="说明（选填）">
        <a-textarea
          v-model:value="form.description"
          placeholder="学科简介..."
          :rows="3"
          maxlength="200"
          show-count
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { UserSubject } from '@tutor/shared';

interface SubjectFormData {
  name: string;
  code: string;
  description: string;
}

const props = defineProps<{
  open: boolean;
  editingSubject: UserSubject | null;
  saving: boolean;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  save: [data: SubjectFormData];
}>();

const form = ref<SubjectFormData>({ name: '', code: '', description: '' });

watch(
  () => props.open,
  (val) => {
    if (val) {
      form.value = props.editingSubject
        ? { name: props.editingSubject.name, code: props.editingSubject.code, description: props.editingSubject.description ?? '' }
        : { name: '', code: '', description: '' };
    }
  },
);

function handleSave() {
  emit('save', { ...form.value });
}
</script>
