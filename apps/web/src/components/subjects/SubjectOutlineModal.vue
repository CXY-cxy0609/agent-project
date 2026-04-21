<template>
  <a-modal
    :open="open"
    :title="`${subject?.name} · 学科大纲`"
    width="700"
    :footer="outlineMode === 'view' ? null : undefined"
    ok-text="保存大纲"
    cancel-text="取消"
    :confirm-loading="savingOutline"
    @ok="handleSave"
    @cancel="$emit('update:open', false)"
  >
    <div class="outline-modal-header">
      <a-radio-group v-model:value="outlineMode" size="small" button-style="solid">
        <a-radio-button value="view">查看</a-radio-button>
        <a-radio-button value="edit">编辑</a-radio-button>
      </a-radio-group>
    </div>

    <!-- View Mode -->
    <div v-if="outlineMode === 'view'" class="outline-view">
      <outline-tree :outline="localOutline" empty-text="暂无大纲，切换到编辑模式添加章节" />
    </div>

    <!-- Edit Mode -->
    <div v-else class="outline-edit">
      <div
        v-for="(chapter, ci) in localOutline.chapters"
        :key="chapter.id"
        class="oe-chapter"
      >
        <div class="oe-chapter-header">
          <span class="oe-num">第 {{ chapter.order }} 章</span>
          <a-input
            v-model:value="chapter.title"
            size="small"
            placeholder="章节标题"
            class="oe-title-input"
          />
          <a-button size="small" type="text" danger @click="removeChapter(ci)">
            <DeleteOutlined />
          </a-button>
        </div>

        <div class="oe-sections">
          <div
            v-for="(sec, si) in chapter.sections"
            :key="sec.id"
            class="oe-section"
          >
            <span class="oe-sec-num">{{ sec.order }}.</span>
            <a-input
              v-model:value="sec.title"
              size="small"
              placeholder="小节标题"
              class="oe-title-input"
            />
            <a-button size="small" type="text" danger @click="removeSection(ci, si)">
              <CloseOutlined />
            </a-button>
          </div>
        </div>

        <a-button size="small" type="dashed" class="add-section-btn" @click="addSection(ci)">
          <PlusOutlined /> 添加小节
        </a-button>
      </div>

      <a-button type="dashed" block class="add-chapter-btn" @click="addChapter">
        <PlusOutlined /> 添加章节
      </a-button>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { DeleteOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons-vue';
import OutlineTree from '@/components/common/OutlineTree.vue';
import type { UserSubject, SubjectOutline } from '@kaoyan/shared';

const props = defineProps<{
  open: boolean;
  subject: UserSubject | null;
  savingOutline: boolean;
  initialOutline?: SubjectOutline;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  save: [outline: SubjectOutline];
}>();

const outlineMode = ref<'view' | 'edit'>('view');
const localOutline = ref<SubjectOutline>({ chapters: [] });

watch(
  () => props.open,
  (val) => {
    if (val) {
      outlineMode.value = 'view';
      localOutline.value = props.initialOutline
        ? JSON.parse(JSON.stringify(props.initialOutline))
        : { chapters: [] };
    }
  },
);

watch(
  () => props.initialOutline,
  (outline) => {
    if (props.open && outline) {
      localOutline.value = JSON.parse(JSON.stringify(outline));
    }
  },
);

function addChapter() {
  localOutline.value.chapters.push({
    id: `new-${Date.now()}`,
    title: '',
    sections: [],
    order: localOutline.value.chapters.length + 1,
  });
}

function removeChapter(idx: number) {
  localOutline.value.chapters.splice(idx, 1);
  localOutline.value.chapters.forEach((c, i) => { c.order = i + 1; });
}

function addSection(chapterIdx: number) {
  const chapter = localOutline.value.chapters[chapterIdx];
  chapter.sections.push({
    id: `new-${Date.now()}`,
    title: '',
    order: chapter.sections.length + 1,
  });
}

function removeSection(chapterIdx: number, sectionIdx: number) {
  const chapter = localOutline.value.chapters[chapterIdx];
  chapter.sections.splice(sectionIdx, 1);
  chapter.sections.forEach((s, i) => { s.order = i + 1; });
}

function handleSave() {
  emit('save', localOutline.value);
}
</script>

<style scoped lang="less">
.outline-modal-header {
  margin-bottom: 16px;
}

.outline-view {
  max-height: 480px;
  overflow-y: auto;
}

.outline-edit {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 480px;
  overflow-y: auto;
}

.oe-chapter {
  border: 1px solid @color-border;
  border-radius: 8px;
  padding: 12px 14px;
}

.oe-chapter-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.oe-num {
  font-size: 12px;
  font-weight: 600;
  color: @color-primary;
  white-space: nowrap;
  flex-shrink: 0;
}

.oe-title-input {
  flex: 1;
}

.oe-sections {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
  padding-left: 16px;
}

.oe-section {
  display: flex;
  align-items: center;
  gap: 6px;
}

.oe-sec-num {
  font-size: 12px;
  color: @color-text-muted;
  flex-shrink: 0;
  min-width: 20px;
}

.add-section-btn {
  margin-top: 4px;
  width: calc(100% - 16px);
  margin-left: 16px;
}

.add-chapter-btn {
  margin-top: 4px;
}
</style>
