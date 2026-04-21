import { StateGraph, Annotation, END } from '@langchain/langgraph';
import { ChatAnthropic } from '@langchain/anthropic';

/**
 * Learning Analytics Agent Graph
 * Analyzes user learning data and generates a personalized summary
 */

const AnalyticsState = Annotation.Root({
  subjectId: Annotation<string>(),
  userId: Annotation<string>(),
  weakPoints: Annotation<Array<{ keyword: string; level: string; count: number }>>({
    default: () => [],
    reducer: (_a, b) => b,
  }),
  summary: Annotation<string>(),
});

async function fetchWeakPoints(state: typeof AnalyticsState.State) {
  // Fetch user weak points from the backend (via HTTP call to server)
  const serverUrl = process.env.SERVER_URL ?? 'http://localhost:3000';
  try {
    const res = await fetch(`${serverUrl}/api/analytics/${state.subjectId}/weak-points`, {
      headers: { 'x-internal-token': process.env.INTERNAL_TOKEN ?? '' },
    });
    if (!res.ok) return { weakPoints: [] };
    const data = (await res.json()) as typeof state.weakPoints;
    return { weakPoints: data };
  } catch {
    return { weakPoints: [] };
  }
}

async function generateSummary(state: typeof AnalyticsState.State) {
  const llm = new ChatAnthropic({
    model: 'claude-3-5-haiku-20241022',
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const weakPointsText = state.weakPoints
    .map((wp) => `- ${wp.keyword}（${wp.level === 'high' ? '高危' : wp.level === 'medium' ? '需注意' : '良好'}，出现 ${wp.count} 次）`)
    .join('\n');

  const prompt = `根据以下学生在${state.subjectId}学科的薄弱知识点数据，生成一份简洁实用的学情总结和复习建议：

薄弱点列表：
${weakPointsText || '（暂无数据）'}

请生成：
1. 整体学情评估（1-2句话）
2. 重点关注的知识点（优先高危）
3. 具体复习建议（3条左右）

语言简洁，面向考研备考，不超过200字。`;

  const result = await llm.invoke([{ role: 'user', content: prompt }]);

  return { summary: result.content as string };
}

const graph = new StateGraph(AnalyticsState)
  .addNode('fetchWeakPoints', fetchWeakPoints)
  .addNode('generateSummary', generateSummary)
  .addEdge('__start__', 'fetchWeakPoints')
  .addEdge('fetchWeakPoints', 'generateSummary')
  .addEdge('generateSummary', END);

export const analyticsGraph = graph.compile();
