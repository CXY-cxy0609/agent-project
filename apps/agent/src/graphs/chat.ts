import { StateGraph, Annotation, END } from '@langchain/langgraph';
import { ChatAnthropic } from '@langchain/anthropic';

/**
 * Chat Agent Graph
 * Handles knowledge point explanation and Q&A
 */

const ChatState = Annotation.Root({
  content: Annotation<string>(),
  subjectId: Annotation<string>(),
  conversationId: Annotation<string | undefined>(),
  model: Annotation<string>(),
  userId: Annotation<string>(),
  generateVideo: Annotation<boolean | undefined>(),
  response: Annotation<string>(),
  thoughtChain: Annotation<Array<{ title: string; content: string; status: string }>>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
  ragContext: Annotation<string | undefined>(),
});

async function retrieveRagContext(state: typeof ChatState.State) {
  // Call RAG service for relevant context
  try {
    const ragUrl = process.env.RAG_SERVICE_URL ?? 'http://localhost:8000';
    const res = await fetch(`${ragUrl}/retrieve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: state.content, subjectId: state.subjectId }),
    });
    if (!res.ok) return { ragContext: undefined };
    const data = (await res.json()) as { context: string };
    return {
      ragContext: data.context,
      thoughtChain: [{ title: '检索知识库', content: '已从知识库检索相关内容', status: 'done' }],
    };
  } catch {
    return { ragContext: undefined };
  }
}

async function generateResponse(state: typeof ChatState.State) {
  const modelId = state.model ?? 'claude-3-5-sonnet-20241022';
  const llm = new ChatAnthropic({
    model: modelId,
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const systemPrompt = `你是一位专业的考研辅导老师，专注于${state.subjectId}相关内容的讲解。
请用清晰、条理分明的方式解答学生的问题。
${state.ragContext ? `\n以下是从知识库中检索到的相关内容，请参考：\n${state.ragContext}` : ''}
请确保回答准确、易于理解，并在适当时使用数学公式（用 $...$ 包裹）。`;

  const result = await llm.invoke([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: state.content },
  ]);

  return {
    response: result.content as string,
    thoughtChain: [{ title: '生成回答', content: '已完成知识点讲解', status: 'done' }],
  };
}

const graph = new StateGraph(ChatState)
  .addNode('retrieve', retrieveRagContext)
  .addNode('generate', generateResponse)
  .addEdge('__start__', 'retrieve')
  .addEdge('retrieve', 'generate')
  .addEdge('generate', END);

export const chatGraph = graph.compile();
