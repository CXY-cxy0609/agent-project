export interface Subject {
  id: string;
  name: string;
  code: string;
  description?: string;
  outline?: SubjectOutline;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectOutline {
  chapters: OutlineChapter[];
}

export interface OutlineChapter {
  id: string;
  title: string;
  sections: OutlineSection[];
  order: number;
}

export interface OutlineSection {
  id: string;
  title: string;
  order: number;
}

export interface CreateSubjectDto {
  name: string;
  code: string;
  description?: string;
}

export interface UpdateSubjectDto extends Partial<CreateSubjectDto> {
  outline?: SubjectOutline;
}

export interface UserSubject extends Subject {
  isOwner: boolean;
}
