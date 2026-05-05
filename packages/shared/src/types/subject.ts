export interface Subject {
  id: number;
  name: string;
  code: number;
  parentId: number | null;
  level: SubjectLevel;
  description?: string;
  outline?: SubjectOutline;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectOutline {
  modules: OutlineModule[];
}

export interface OutlineModule {
  id: number;
  title: string;
  topics: OutlineTopic[];
  order: number;
}

export interface OutlineTopic {
  id: number;
  title: string;
  points: OutlinePoint[];
  order: number;
}

export interface OutlinePoint {
  id: number;
  title: string;
  order: number;
}

export type SubjectLevel = 1 | 2;

export interface CreateSubjectDto {
  name: string;
  code: number;
  parentId?: number | null;
  description?: string;
}

export interface UpdateSubjectDto extends Partial<CreateSubjectDto> {
  outline?: SubjectOutline;
}

export interface UserSubject extends Subject {
  isOwner: boolean;
}
