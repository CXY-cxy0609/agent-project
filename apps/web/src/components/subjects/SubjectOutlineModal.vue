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
        v-for="(module, mi) in localOutline.modules"
        :key="module.id"
        class="oe-module"
      >
        <div class="oe-module-header">
          <span class="oe-num">模块 {{ module.order }}</span>
          <a-input
            v-model:value="module.title"
            size="small"
            placeholder="一级标题（如：函数与极限）"
            class="oe-title-input"
          />
          <a-button size="small" type="text" danger @click="removeModule(mi)">
            <DeleteOutlined />
          </a-button>
        </div>

        <div class="oe-topics">
          <div
            v-for="(topic, ti) in module.topics"
            :key="topic.id"
            class="oe-topic"
          >
            <div class="oe-topic-header">
              <span class="oe-sec-num">{{ module.order }}.{{ topic.order }}</span>
              <a-input
                v-model:value="topic.title"
                size="small"
                placeholder="二级标题（如：极限理论）"
                class="oe-title-input"
              />
              <a-button size="small" type="text" danger @click="removeTopic(mi, ti)">
                <CloseOutlined />
              </a-button>
            </div>

            <div class="oe-points">
              <div
                v-for="(point, pi) in topic.points"
                :key="point.id"
                class="oe-point"
              >
                <span class="oe-point-num">{{ module.order }}.{{ topic.order }}.{{ point.order }}</span>
                <a-input
                  v-model:value="point.title"
                  size="small"
                  placeholder="三级知识点（如：夹逼定理）"
                  class="oe-title-input"
                />
                <a-button size="small" type="text" danger @click="removePoint(mi, ti, pi)">
                  <CloseOutlined />
                </a-button>
              </div>
            </div>

            <a-button size="small" type="dashed" class="add-point-btn" @click="addPoint(mi, ti)">
              <PlusOutlined /> 添加三级知识点
            </a-button>
          </div>
        </div>

        <a-button size="small" type="dashed" class="add-topic-btn" @click="addTopic(mi)">
          <PlusOutlined /> 添加二级标题
        </a-button>
      </div>

      <a-button type="dashed" block class="add-module-btn" @click="addModule">
        <PlusOutlined /> 添加一级模块
      </a-button>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { DeleteOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons-vue';
import OutlineTree from '@/components/common/OutlineTree.vue';
import type { UserSubject, SubjectOutline } from '@tutor/shared';

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
const localOutline = ref<SubjectOutline>({ modules: [] });

watch(
  () => props.open,
  (val) => {
    if (val) {
      outlineMode.value = 'view';
      localOutline.value = props.initialOutline
        ? JSON.parse(JSON.stringify(props.initialOutline))
        : { modules: [] };
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

function nextId(seed = 0) {
  return Date.now() + Math.floor(Math.random() * 1000) + seed;
}

function addModule() {
  localOutline.value.modules.push({
    id: nextId(),
    title: '',
    topics: [],
    order: localOutline.value.modules.length + 1,
  });
}

function removeModule(idx: number) {
  localOutline.value.modules.splice(idx, 1);
  localOutline.value.modules.forEach((m, i) => { m.order = i + 1; });
}

function addTopic(moduleIdx: number) {
  const module = localOutline.value.modules[moduleIdx];
  module.topics.push({
    id: nextId(1),
    title: '',
    points: [],
    order: module.topics.length + 1,
  });
}

function removeTopic(moduleIdx: number, topicIdx: number) {
  const module = localOutline.value.modules[moduleIdx];
  module.topics.splice(topicIdx, 1);
  module.topics.forEach((topic, i) => { topic.order = i + 1; });
}

function addPoint(moduleIdx: number, topicIdx: number) {
  const topic = localOutline.value.modules[moduleIdx].topics[topicIdx];
  topic.points.push({
    id: nextId(2),
    title: '',
    order: topic.points.length + 1,
  });
}

function removePoint(moduleIdx: number, topicIdx: number, pointIdx: number) {
  const topic = localOutline.value.modules[moduleIdx].topics[topicIdx];
  topic.points.splice(pointIdx, 1);
  topic.points.forEach((point, i) => { point.order = i + 1; });
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
  max-height: min(65vh, 560px);
  overflow-y: auto;
  padding-right: 4px;
}

.oe-module {
  border: 1px solid @color-border;
  border-radius: 10px;
  padding: 12px 14px;
  background: linear-gradient(180deg, #fff 0%, #fafcff 100%);
}

.oe-module-header {
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

.oe-topics {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
  padding-left: 12px;
  border-left: 2px solid @color-border-light;
}

.oe-topic {
  border: 1px dashed @color-border;
  border-radius: 8px;
  padding: 8px;
  background: rgba(26, 58, 110, 0.02);
}

.oe-topic-header {
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

.oe-points {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-left: 16px;
}

.oe-point {
  display: flex;
  align-items: center;
  gap: 6px;
}

.oe-point-num {
  font-size: 12px;
  color: @color-text-muted;
  min-width: 48px;
  flex-shrink: 0;
}

.add-point-btn {
  margin-top: 8px;
  margin-left: 16px;
  width: calc(100% - 16px);
}

.add-topic-btn {
  margin-top: 6px;
  margin-left: 12px;
  width: calc(100% - 12px);
}

.add-module-btn {
  margin-top: 4px;
}
</style>
