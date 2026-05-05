export interface LearningAnalytics {
  userId: string;
  subjectId: number;
  subjectName: string;
  weakPoints: WeakPoint[];
  wordCloud: WordCloudItem[];
  summary?: string;
  summaryGeneratedAt?: string;
  updatedAt: string;
}

export interface WeakPoint {
  id: string;
  keyword: string;
  level: WeaknessLevel;
  count: number;
  relatedChapter?: string;
}

export type WeaknessLevel = 'low' | 'medium' | 'high';

export interface WordCloudItem {
  text: string;
  weight: number;
  level: WeaknessLevel;
}

export interface AnalyticsSummaryRequest {
  subjectId: number;
}
