import express from 'express';

const app = express();
app.use(express.json());

const PORT = process.env.PORT ?? 8001;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'kaoyan-agent', timestamp: new Date().toISOString() });
});

/**
 * POST /chat/stream
 * Body: { conversationId?, subjectId, content, model, userId, generateVideo? }
 * Streams SSE response from the LangGraph agent
 */
app.post('/chat/stream', async (req, res) => {
  const { content, subjectId, conversationId, model, userId, generateVideo } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Placeholder: invoke the chat agent graph
    const { chatGraph } = await import('./graphs/chat.js');
    const stream = await chatGraph.stream(
      { content, subjectId, conversationId, model, userId, generateVideo },
      { streamMode: 'updates' },
    );

    for await (const chunk of stream) {
      const data = JSON.stringify(chunk);
      res.write(`data: ${data}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    res.write(`data: ${JSON.stringify({ type: 'error', message: errMsg })}\n\n`);
    res.end();
  }
});

/**
 * POST /analytics/generate
 * Body: { subjectId, userId }
 * Triggers the learning analytics agent
 */
app.post('/analytics/generate', async (req, res) => {
  const { subjectId, userId } = req.body;
  try {
    const { analyticsGraph } = await import('./graphs/analytics.js');
    const result = await analyticsGraph.invoke({ subjectId, userId });
    res.json({ summary: result.summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

app.listen(PORT, () => {
  console.log(`🤖 Agent service running on http://localhost:${PORT}`);
});
