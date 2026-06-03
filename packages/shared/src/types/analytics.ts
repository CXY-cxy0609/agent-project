export interface LearningAnalytics {
  userId: string;
  scope?: AnalyticsScope;
  subjectId: number | null;
  subjectName: string | null;
  cards?: AnalyticsCards;
  subjectDistribution?: SubjectDistributionItem[];
  weakPoints: WeakPoint[];
  wordCloud: WordCloudItem[];
  masteryTrend?: MasteryTrendItem[];
  activityHeatmap?: ActivityHeatmapItem[];
  knowledgeGraph?: KnowledgeGraphNode[];
  recommendations?: AnalyticsRecommendation[];
  summary?: string;
  summaryGeneratedAt?: string;
  summaryDetail?: AnalyticsSummaryDetail | null;
  updatedAt: string;
}

export interface WeakPoint {
  id: string;
  knowledgeKey?: string;
  keyword: string;
  level: WeaknessLevel;
  count: number;
  relatedChapter?: string;
  subjectId?: number | null;
  subjectName?: string | null;
  masteryScore?: number;
  weaknessScore?: number;
  accuracyRate?: number;
}

export type WeaknessLevel = 'low' | 'medium' | 'high';
export type AnalyticsScope = 'overall' | 'subject';

export interface WordCloudItem {
  text: string;
  weight: number;
  level: WeaknessLevel;
}

export interface AnalyticsSummaryRequest {
  scope: AnalyticsScope;
  subjectId?: number | null;
}

export interface AnalyticsSummaryDetail {
  summary: string;
  highlights: string[];
  weakPointAnalysis: string[];
  recommendedActions: AnalyticsSummaryAction[];
  riskLevel: AnalyticsRiskLevel;
  generatedAt?: string;
}

export interface AnalyticsSummaryAction {
  type: 'review' | 'assessment' | 'subject_create' | 'knowledge_base';
  title: string;
  reason: string;
  knowledgeKey?: string;
  subjectId?: number | null;
}

export type AnalyticsRiskLevel = 'low' | 'medium' | 'high';

export type AnalyticsSummaryStreamEvent =
  | {
      type: 'summary.start';
      streamId: string;
      sequence: number;
      summaryId: string;
      startedAt: string;
    }
  | {
      type: 'summary.stage';
      streamId: string;
      sequence: number;
      summaryId: string;
      stage: 'collecting' | 'analyzing' | 'generating' | 'saving';
      message: string;
    }
  | {
      type: 'summary.delta';
      streamId: string;
      sequence: number;
      summaryId: string;
      delta: string;
    }
  | {
      type: 'summary.saved';
      streamId: string;
      sequence: number;
      summaryId: string;
      summary: AnalyticsSummaryDetail;
    }
  | {
      type: 'summary.done';
      streamId: string;
      sequence: number;
      summaryId: string;
    }
  | {
      type: 'summary.error';
      streamId: string;
      sequence: number;
      summaryId?: string;
      message: string;
    };

export interface AnalyticsOverviewRequest extends AnalyticsSummaryRequest {
  timeRange?: AnalyticsTimeRange;
}

export interface AnalyticsTimeRange {
  preset?: 'last_7_days' | 'last_30_days' | 'all';
  startAt?: string | null;
  endAt?: string | null;
}

export interface AnalyticsCards {
  totalQuestions: number;
  activeDays: number;
  weakPointCount: number;
  masteryScore: number;
  trend?: string;
}

export interface SubjectDistributionItem {
  subjectId: number | null;
  subjectName: string;
  count: number;
  masteryScore: number;
}

export interface MasteryTrendItem {
  date: string;
  masteryScore: number;
  questionCount: number;
  testCount: number;
  wrongCount: number;
}

export interface ActivityHeatmapItem {
  date: string;
  count: number;
}

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  subjectId?: number | null;
  parentId?: string | null;
  masteryScore: number;
  weaknessScore: number;
}

export interface AnalyticsRecommendation {
  id: string;
  type: 'review' | 'assessment' | 'subject_create' | 'knowledge_base';
  title: string;
  description: string;
  knowledgeKey?: string;
  subjectId?: number | null;
}
