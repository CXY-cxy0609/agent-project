/**
 * Agent Service Entry Point
 * Express HTTP 服务，对外暴露 SSE 流式接口
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createContainer, loadConfig } from './container.js';

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT ?? 8001;
const config = loadConfig();  // 加载配置
const { orchestratorAgent, knowledgeBaseAgent, assessmentAgent, learningSummaryAgent } = createContainer(config);  // 创建容器

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'tutor-agent', timestamp: new Date().toISOString() });
});

function requireInternalToken(req: express.Request, res: express.Response): boolean {
  const expected = process.env.INTERNAL_TOKEN ?? '';
  if (!expected) return true;
  if (req.header('x-internal-token') === expected) return true;
  res.status(401).json({ error: 'unauthorized internal call' });
  return false;
}

// ─── Chat Stream ──────────────────────────────────────────────────────────────

/**
 * POST /chat/stream
 * 流式问答接口，返回 SSE 格式
 */
app.post('/chat/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const {
    content,
    subjectId,
    availableSubjects,
    conversationId,
    messageCount,
    generateVideo = false,
    userId = 'anonymous',
    assistantMessageId,
    images,
  } = req.body as {
    content: string;
    subjectId?: string | number | null;
    availableSubjects?: Array<{ id: string | number; name: string; code?: string | number }>;
    conversationId?: string;
    messageCount?: number;
    generateVideo?: boolean;
    userId?: string;
    assistantMessageId?: string;
    images?: Array<{ url?: string; mediaType?: string; media_type?: string }>;
  };
  const normalizedImages = normalizeRequestImages(images);

  const sendEvent = (data: unknown) => {  // 发送事件
    res.write(`data: ${JSON.stringify(data)}\n\n`);  // 发送 SSE 事件
  };

  const ctx = {
    userId,
    sessionId: conversationId ?? uuidv4(),  // 会话 ID
    traceId: uuidv4(),  // 链路 ID
    metadata: {
      tokenEmitter: (token: string) => {
        sendEvent({ type: 'delta', delta: token });
      },
      reasoningEmitter: (event: { intent: string; reasoning?: string; semanticSummary?: string; title?: string }) => {
        sendEvent({ type: 'intent', assistantMessageId, ...event });
      },
    },
  };

  try {
    sendEvent({ type: 'start', traceId: ctx.traceId });  // 发送开始事件

    const result = await orchestratorAgent.run(  // 运行 orchestratorAgent
      {
        userMessage: content,
        subjectId: normalizeRequestSubjectId(subjectId),  // 学科 ID
        availableSubjects: availableSubjects?.map((item) => ({
          id: String(item.id),
          name: item.name,
          code: item.code !== undefined ? String(item.code) : undefined,
        })),
        conversationId,
        messageCount,
        generateVideo,
        images: normalizedImages,
      },
      ctx,
    );

    sendEvent({  // 发送回复事件
      type: 'reply',
      content: result.reply,
      intent: result.intent,  // 意图
      subjectId: result.subjectId,
      videoUrl: result.videoUrl,  // 视频 URL
      videoRunId: result.videoRunId,
      artifactBundleUrl: result.artifactBundleUrl,
      artifactManifestUrl: result.artifactManifestUrl,
      conversationId: result.conversationId,  // 会话 ID
      title: result.title,
    });

    sendEvent({ type: 'done' });
    res.end();
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    sendEvent({ type: 'error', message: errMsg });
    res.end();
  }
});

function normalizeRequestSubjectId(subjectId: string | number | null | undefined): string | undefined {
  if (subjectId === null || subjectId === undefined) return undefined;
  const normalized = String(subjectId).trim();
  return normalized === '' ? undefined : normalized;
}

function normalizeRequestImages(
  images?: Array<{ url?: string; mediaType?: string; media_type?: string }>,
): Array<{ url: string; mediaType?: string }> {
  return (Array.isArray(images) ? images : [])
    .map((item) => ({
      url: typeof item.url === 'string' ? item.url : '',
      mediaType: typeof item.mediaType === 'string'
        ? item.mediaType
        : typeof item.media_type === 'string'
          ? item.media_type
          : undefined,
    }))
    .filter((item) => item.url.trim() !== '')
    .slice(0, 9);
}

// ─── Assessments ──────────────────────────────────────────────────────────────

app.post('/assessments/generate', async (req, res) => {
  if (!requireInternalToken(req, res)) return;
  const ctx = {
    userId: String(req.body.userId ?? 'anonymous'),
    sessionId: String(req.body.assessmentId ?? 'assessment'),
    traceId: String(req.body.traceId ?? uuidv4()),
  };
  try {
    const result = await assessmentAgent.run(req.body, ctx);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

app.post('/assessments/grade', async (req, res) => {
  if (!requireInternalToken(req, res)) return;
  const ctx = {
    userId: String(req.body.userId ?? 'anonymous'),
    sessionId: String(req.body.assessmentId ?? 'assessment'),
    traceId: String(req.body.traceId ?? uuidv4()),
  };
  try {
    const result = await assessmentAgent.run(req.body, ctx);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

app.post('/learning-summary/generate', async (req, res) => {
  if (!requireInternalToken(req, res)) return;
  const ctx = {
    userId: String(req.body.userId ?? 'anonymous'),
    sessionId: 'learning-summary',
    traceId: String(req.body.traceId ?? uuidv4()),
  };
  try {
    const result = await learningSummaryAgent.run(req.body, ctx);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

app.post('/learning-summary/stream', async (req, res) => {
  if (!requireInternalToken(req, res)) return;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const ctx = {
    userId: String(req.body.userId ?? 'anonymous'),
    sessionId: 'learning-summary',
    traceId: String(req.body.traceId ?? uuidv4()),
  };
  const sendEvent = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    sendEvent({ type: 'stage', stage: 'analyzing', message: '正在分析学习数据...' });
    for await (const event of learningSummaryAgent.stream(req.body, ctx)) {
      sendEvent(event);
    }
    sendEvent({ type: 'done' });
    res.end();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    sendEvent({ type: 'error', message: msg });
    res.end();
  }
});

// ─── Learning Report ──────────────────────────────────────────────────────────

/**
 * GET /analytics/:userId/report
 * 获取用户学情报告
 */
app.get('/analytics/:userId/report', async (req, res) => {
  const { userId } = req.params;
  const { subjectId } = req.query as { subjectId?: string };

  const ctx = { userId, sessionId: 'report', traceId: uuidv4() };

  try {
    const result = await orchestratorAgent.run(
      {
        userMessage: '生成学情报告',
        subjectId,
      },
      ctx,
    );
    res.json({ report: result.reply });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// ─── Knowledge Base ───────────────────────────────────────────────────────────

/**
 * POST /kb/upload
 * 上传文档到知识库（管理员接口）
 */
app.post('/kb/upload', async (req, res) => {
  const { knowledgeBaseId, subjectId, fileContentBase64, filename, docName } = req.body as {
    knowledgeBaseId: string;
    subjectId: string;
    fileContentBase64: string;
    filename: string;
    docName?: string;
  };

  const ctx = { userId: 'admin', sessionId: 'kb', traceId: uuidv4() };

  try {
    const result = await knowledgeBaseAgent.run(
      {
        action: 'index_document',
        knowledgeBaseId,
        subjectId,
        fileContentBase64,
        filename,
        docName,
      },
      ctx,
    );
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

/**
 * DELETE /kb/:knowledgeBaseId/:docId
 * 从知识库删除文档（管理员接口）
 */
app.delete('/kb/:knowledgeBaseId/:docId', async (req, res) => {
  const { knowledgeBaseId, docId } = req.params;
  const { subjectId } = req.query as { subjectId?: string };

  const ctx = { userId: 'admin', sessionId: 'kb', traceId: uuidv4() };

  try {
    const result = await knowledgeBaseAgent.run(
      {
        action: 'delete_document',
        knowledgeBaseId,
        subjectId: subjectId ?? '',
        docId,
      },
      ctx,
    );
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Agent service running on http://localhost:${PORT}`);
});
