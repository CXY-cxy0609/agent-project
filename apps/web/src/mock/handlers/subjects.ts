import type { Subject, UserSubject, CreateSubjectDto, UpdateSubjectDto, SubjectOutline } from '@tutor/shared';
import { MOCK_SUBJECTS, MOCK_ALL_SUBJECTS } from '../data';

const delay = (ms = 400) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let _subjects = [...MOCK_SUBJECTS];

export const mockSubjectsApi = {
  async getMySubjects(): Promise<UserSubject[]> {
    await delay();
    return [..._subjects];
  },

  async searchSubjects(keyword: string): Promise<Subject[]> {
    await delay(300);
    const kw = keyword.toLowerCase();
    const numericKeyword = Number(keyword.trim());
    const hasNumericKeyword = Number.isFinite(numericKeyword);
    return MOCK_ALL_SUBJECTS.filter(
      (s) =>
        s.name.toLowerCase().includes(kw) ||
        String(s.code).includes(keyword.trim()) ||
        String(s.id).includes(keyword.trim()) ||
        (hasNumericKeyword && s.code === numericKeyword),
    );
  },

  async createSubject(data: CreateSubjectDto): Promise<Subject> {
    await delay();
    const parentSubject = data.parentId ? _subjects.find((subject) => subject.id === data.parentId) : null;
    const parentId = parentSubject?.level === 1 ? parentSubject.id : null;
    const newSubject: Subject = {
      id: Date.now(),
      ...data,
      parentId,
      level: parentId ? 2 : 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    _subjects.push({ ...newSubject, isOwner: true });
    return newSubject;
  },

  async updateSubject(id: number, data: UpdateSubjectDto): Promise<Subject> {
    await delay();
    const idx = _subjects.findIndex((s) => s.id === id);
    if (idx !== -1) {
      const requestedParent = data.parentId !== undefined ? data.parentId : _subjects[idx].parentId;
      const parentSubject = requestedParent
        ? _subjects.find((subject) => subject.id === requestedParent)
        : null;
      const nextParentId = parentSubject?.level === 1 ? parentSubject.id : null;
      _subjects[idx] = {
        ..._subjects[idx],
        ...data,
        parentId: nextParentId,
        level: nextParentId ? 2 : 1,
        updatedAt: new Date().toISOString(),
      };
    }
    return _subjects[idx] as Subject;
  },

  async deleteSubject(id: number): Promise<void> {
    await delay();
    _subjects = _subjects.filter((s) => s.id !== id);
  },

  async addMySubject(subjectId: number): Promise<void> {
    await delay();
    const subject = MOCK_ALL_SUBJECTS.find((s) => s.id === subjectId);
    if (subject && !_subjects.find((s) => s.id === subjectId)) {
      _subjects.push({ ...subject, isOwner: false });
    }
  },

  async removeMySubject(subjectId: number): Promise<void> {
    await delay();
    _subjects = _subjects.filter((s) => s.id !== subjectId);
  },

  async getOutline(id: number): Promise<SubjectOutline> {
    await delay(300);
    const subject = _subjects.find((s) => s.id === id);
    return subject?.outline ?? { modules: [] };
  },

  async updateOutline(id: number, outline: SubjectOutline): Promise<void> {
    await delay();
    const idx = _subjects.findIndex((s) => s.id === id);
    if (idx !== -1) {
      _subjects[idx] = { ..._subjects[idx], outline, updatedAt: new Date().toISOString() };
    }
  },

  async adminGetAll(): Promise<Subject[]> {
    await delay();
    return [...MOCK_ALL_SUBJECTS];
  },

  async adminDeleteSubject(id: number): Promise<void> {
    await delay();
    _subjects = _subjects.filter((s) => s.id !== id);
  },
};
