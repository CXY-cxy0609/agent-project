import type { Subject, UserSubject, CreateSubjectDto, UpdateSubjectDto, SubjectOutline } from '@kaoyan/shared';
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
    return MOCK_ALL_SUBJECTS.filter(
      (s) => s.name.includes(kw) || s.code.toLowerCase().includes(kw),
    );
  },

  async createSubject(data: CreateSubjectDto): Promise<Subject> {
    await delay();
    const newSubject: Subject = {
      id: `subj-${Date.now()}`,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    _subjects.push({ ...newSubject, isOwner: true });
    return newSubject;
  },

  async updateSubject(id: string, data: UpdateSubjectDto): Promise<Subject> {
    await delay();
    const idx = _subjects.findIndex((s) => s.id === id);
    if (idx !== -1) {
      _subjects[idx] = { ..._subjects[idx], ...data, updatedAt: new Date().toISOString() };
    }
    return _subjects[idx] as Subject;
  },

  async deleteSubject(id: string): Promise<void> {
    await delay();
    _subjects = _subjects.filter((s) => s.id !== id);
  },

  async addMySubject(subjectId: string): Promise<void> {
    await delay();
    const subject = MOCK_ALL_SUBJECTS.find((s) => s.id === subjectId);
    if (subject && !_subjects.find((s) => s.id === subjectId)) {
      _subjects.push({ ...subject, isOwner: false });
    }
  },

  async removeMySubject(subjectId: string): Promise<void> {
    await delay();
    _subjects = _subjects.filter((s) => s.id !== subjectId);
  },

  async getOutline(id: string): Promise<SubjectOutline> {
    await delay(300);
    const subject = _subjects.find((s) => s.id === id);
    return subject?.outline ?? { chapters: [] };
  },

  async updateOutline(id: string, outline: SubjectOutline): Promise<void> {
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

  async adminDeleteSubject(id: string): Promise<void> {
    await delay();
    _subjects = _subjects.filter((s) => s.id !== id);
  },
};
