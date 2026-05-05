<template>
  <a-modal
    :open="open"
    :title="editingSubject ? '编辑学科' : (creatingParentSubject ? '新建子学科' : '新建一级学科')"
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
        <a-input-number
          v-model:value="form.code"
          style="width: 100%"
          :min="1"
          :precision="0"
          placeholder="如：1001"
        />
      </a-form-item>
      <a-form-item v-if="creatingParentSubject" label="所属一级学科">
        <a-tag color="blue">{{ creatingParentSubject.name }}（ID: {{ creatingParentSubject.id }}）</a-tag>
      </a-form-item>
      <a-form-item v-else-if="editingSubject?.parentId" label="所属一级学科">
        <a-tag>{{ editingSubject.parentId }}</a-tag>
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
  code: number | null;
  parentId: number | null;
  description: string;
}

const props = defineProps<{
  open: boolean;
  editingSubject: UserSubject | null;
  creatingParentSubject: UserSubject | null;
  saving: boolean;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  save: [data: SubjectFormData];
}>();

const form = ref<SubjectFormData>({ name: '', code: null, parentId: null, description: '' });

watch(
  () => props.open,
  (val) => {
    if (val) {
      form.value = props.editingSubject
        ? {
            name: props.editingSubject.name,
            code: props.editingSubject.code,
            parentId: props.editingSubject.parentId,
            description: props.editingSubject.description ?? '',
          }
        : {
            name: '',
            code: null,
            parentId: props.creatingParentSubject?.id ?? null,
            description: '',
          };
    }
  },
);

function handleSave() {
  emit('save', { ...form.value });
}
</script>
