import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { UserSubject } from '@tutor/shared';

export const useSubjectStore = defineStore('subject', () => {
  const subjects = ref<UserSubject[]>([]);
  const activeSubjectId = ref<number | null>(null);

  function setSubjects(list: UserSubject[]) {
    subjects.value = list;
  }

  function setActiveSubject(id: number | null) {
    activeSubjectId.value = id;
  }

  function removeSubject(id: number) {
    subjects.value = subjects.value.filter((s) => s.id !== id);
    if (activeSubjectId.value === id) {
      activeSubjectId.value = subjects.value[0]?.id ?? null;
    }
  }

  return { subjects, activeSubjectId, setSubjects, setActiveSubject, removeSubject };
});
