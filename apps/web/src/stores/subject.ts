import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { UserSubject } from '@kaoyan/shared';

export const useSubjectStore = defineStore('subject', () => {
  const subjects = ref<UserSubject[]>([]);
  const activeSubjectId = ref<string | null>(null);

  function setSubjects(list: UserSubject[]) {
    subjects.value = list;
  }

  function setActiveSubject(id: string | null) {
    activeSubjectId.value = id;
  }

  function removeSubject(id: string) {
    subjects.value = subjects.value.filter((s) => s.id !== id);
    if (activeSubjectId.value === id) {
      activeSubjectId.value = subjects.value[0]?.id ?? null;
    }
  }

  return { subjects, activeSubjectId, setSubjects, setActiveSubject, removeSubject };
});
