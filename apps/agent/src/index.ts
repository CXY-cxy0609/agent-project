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
const { orchestratorAgent, knowledgeBaseAgent } = createContainer(config);  // 创建容器

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'tutor-agent', timestamp: new Date().toISOString() });
});

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
    conversationId,
    userId = 'anonymous',
    imageBase64,
    imageMediaType,
  } = req.body as {
    content: string;
    subjectId?: string;
    conversationId?: string;
    userId?: string;
    imageBase64?: string;
    imageMediaType?: string;
  };

  const ctx = {
    userId,
    sessionId: conversationId ?? uuidv4(),  // 会话 ID
    traceId: uuidv4(),  // 链路 ID
  };

  const sendEvent = (data: unknown) => {  // 发送事件
    res.write(`data: ${JSON.stringify(data)}\n\n`);  // 发送 SSE 事件
  };

  try {
    sendEvent({ type: 'start', traceId: ctx.traceId });  // 发送开始事件

    const result = await orchestratorAgent.run(  // 运行 orchestratorAgent
      {
        userMessage: content,
        subjectId,  // 学科 ID
        conversationId,
        imageBase64,
        imageMediaType,
      },
      ctx,
    );

    sendEvent({  // 发送回复事件
      type: 'reply',
      content: result.reply,
      intent: result.intent,  // 意图
      videoUrl: result.videoUrl,  // 视频 URL
      conversationId: result.conversationId,  // 会话 ID
    });

    sendEvent({ type: 'done' });
    res.end();
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    sendEvent({ type: 'error', message: errMsg });
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
