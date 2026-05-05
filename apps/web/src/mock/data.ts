import type {
  User,
  AuthToken,
  Subject,
  UserSubject,
  Conversation,
  Message,
  KnowledgeBase,
  LearningAnalytics,
} from '@tutor/shared';

// ── Auth ──────────────────────────────────────────────────────────────────────

export const MOCK_USER: User = {
  id: 'mock-user-001',
  username: '测试同学',
  phone: '13800138000',
  avatar: '',
  role: 'student',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

export const MOCK_ADMIN_USER: User = {
  id: 'mock-admin-001',
  username: '管理员',
  phone: '13900139000',
  avatar: '',
  role: 'admin',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

export const MOCK_TOKEN: AuthToken = {
  accessToken: 'mock-access-token-xxxx',
  refreshToken: 'mock-refresh-token-xxxx',
  expiresIn: 86400,
};

// ── Subjects ──────────────────────────────────────────────────────────────────

export const MOCK_SUBJECTS: UserSubject[] = [
  {
    id: 101,
    name: '高等数学',
    code: 1001,
    parentId: null,
    level: 1,
    description: '理工科考研必备，涵盖微积分、级数、微分方程等核心内容',
    isOwner: false,
    createdAt: '2025-01-10T00:00:00.000Z',
    updatedAt: '2025-03-01T00:00:00.000Z',
    outline: {
      modules: [
        {
          id: 10001,
          title: '函数与极限',
          order: 1,
          topics: [
            {
              id: 11001,
              title: '函数基础',
              order: 1,
              points: [
                { id: 12001, title: '函数的概念与性质', order: 1 },
                { id: 12002, title: '初等函数定义域与值域', order: 2 },
              ],
            },
            {
              id: 11002,
              title: '极限理论',
              order: 2,
              points: [
                { id: 12003, title: '数列极限', order: 1 },
                { id: 12004, title: '函数极限', order: 2 },
                { id: 12005, title: '夹逼定理与洛必达法则', order: 3 },
              ],
            },
          ],
        },
        {
          id: 10002,
          title: '导数与微分',
          order: 2,
          topics: [
            {
              id: 11003,
              title: '导数计算',
              order: 1,
              points: [
                { id: 12006, title: '导数的概念', order: 1 },
                { id: 12007, title: '求导法则', order: 2 },
                { id: 12008, title: '高阶导数', order: 3 },
              ],
            },
            {
              id: 11004,
              title: '应用题型',
              order: 2,
              points: [
                { id: 12009, title: '隐函数求导', order: 1 },
                { id: 12010, title: '相关变化率', order: 2 },
              ],
            },
          ],
        },
        {
          id: 10003,
          title: '积分学',
          order: 3,
          topics: [
            {
              id: 11005,
              title: '积分计算',
              order: 1,
              points: [
                { id: 12011, title: '不定积分', order: 1 },
                { id: 12012, title: '定积分', order: 2 },
                { id: 12013, title: '分部积分与换元法', order: 3 },
              ],
            },
            {
              id: 11006,
              title: '广义积分',
              order: 2,
              points: [
                { id: 12014, title: '广义积分收敛判别', order: 1 },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: 102,
    name: '线性代数',
    code: 1002,
    parentId: null,
    level: 1,
    description: '矩阵、行列式、向量空间、线性变换等基础内容',
    isOwner: false,
    createdAt: '2025-01-10T00:00:00.000Z',
    updatedAt: '2025-02-15T00:00:00.000Z',
    outline: {
      modules: [
        {
          id: 20001,
          title: '行列式',
          order: 1,
          topics: [
            {
              id: 21001,
              title: '核心概念',
              order: 1,
              points: [
                { id: 22001, title: '行列式的定义', order: 1 },
                { id: 22002, title: '行列式的性质', order: 2 },
              ],
            },
          ],
        },
        {
          id: 20002,
          title: '矩阵',
          order: 2,
          topics: [
            {
              id: 21002,
              title: '基础运算',
              order: 1,
              points: [
                { id: 22003, title: '矩阵的运算', order: 1 },
                { id: 22004, title: '逆矩阵', order: 2 },
              ],
            },
            {
              id: 21003,
              title: '结构分析',
              order: 2,
              points: [
                { id: 22005, title: '矩阵的秩', order: 1 },
                { id: 22006, title: '特征值与特征向量', order: 2 },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: 103,
    name: '英语',
    code: 2001,
    parentId: null,
    level: 1,
    description: '考研英语一/二，阅读理解、完型填空、写作全覆盖',
    isOwner: false,
    createdAt: '2025-01-10T00:00:00.000Z',
    updatedAt: '2025-03-10T00:00:00.000Z',
  },
  {
    id: 201,
    name: '高数（强化）',
    code: 100101,
    parentId: 101,
    level: 2,
    description: '高等数学强化阶段子学科，聚焦高频题型与跨章节综合',
    isOwner: true,
    createdAt: '2025-03-20T00:00:00.000Z',
    updatedAt: '2025-04-10T00:00:00.000Z',
  },
];

export const MOCK_ALL_SUBJECTS: Subject[] = MOCK_SUBJECTS.map(({ isOwner: _isOwner, ...s }) => s);

// ── Conversations ─────────────────────────────────────────────────────────────

export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-001',
    title: '如何求解极限 lim(x→0) sinx/x？',
    subjectId: 101,
    subjectName: '高等数学',
    userId: 'mock-user-001',
    messageCount: 4,
    createdAt: '2025-04-10T10:00:00.000Z',
    updatedAt: '2025-04-10T10:15:00.000Z',
  },
  {
    id: 'conv-002',
    title: '矩阵乘法的结合律证明',
    subjectId: 102,
    subjectName: '线性代数',
    userId: 'mock-user-001',
    messageCount: 6,
    createdAt: '2025-04-09T14:00:00.000Z',
    updatedAt: '2025-04-09T14:30:00.000Z',
  },
  {
    id: 'conv-003',
    title: '完型填空解题技巧',
    subjectId: 103,
    subjectName: '英语',
    userId: 'mock-user-001',
    messageCount: 2,
    createdAt: '2025-04-08T09:00:00.000Z',
    updatedAt: '2025-04-08T09:10:00.000Z',
  },
];

export const MOCK_MESSAGES: Record<string, Message[]> = {
  'conv-001': [
    {
      id: 'msg-001',
      conversationId: 'conv-001',
      role: 'user',
      content: '如何求解极限 lim(x→0) sinx/x？',
      status: 'done',
      createdAt: '2025-04-10T10:00:00.000Z',
    },
    {
      id: 'msg-002',
      conversationId: 'conv-001',
      role: 'assistant',
      content:
        '这是一个经典极限，可以用以下几种方法求解：\n\n**方法一：夹逼定理**\n\n利用不等式 $\\cos x < \\frac{\\sin x}{x} < 1$（当 $x\\in(0,\\frac{\\pi}{2})$），由夹逼定理得：\n$$\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$$\n\n**方法二：洛必达法则**\n\n当 $x\\to 0$ 时，分子分母均趋于 0（$\\frac{0}{0}$ 型），对分子分母分别求导：\n$$\\lim_{x \\to 0} \\frac{\\sin x}{x} = \\lim_{x \\to 0} \\frac{\\cos x}{1} = 1$$\n\n**方法三：等价无穷小替换**\n\n当 $x\\to 0$ 时，$\\sin x \\sim x$，因此 $\\frac{\\sin x}{x} \\to 1$。\n\n三种方法结论一致，答案为 **1**。',
      status: 'done',
      createdAt: '2025-04-10T10:01:00.000Z',
      metadata: { model: 'claude-3-5-sonnet', tokens: 256 },
    },
  ],
  'conv-002': [
    {
      id: 'msg-003',
      conversationId: 'conv-002',
      role: 'user',
      content: '请证明矩阵乘法满足结合律',
      status: 'done',
      createdAt: '2025-04-09T14:00:00.000Z',
    },
    {
      id: 'msg-004',
      conversationId: 'conv-002',
      role: 'assistant',
      content:
        '**定理**：设 $A$、$B$、$C$ 分别为 $m\\times n$、$n\\times p$、$p\\times q$ 矩阵，则 $(AB)C = A(BC)$。\n\n**证明**：\n\n设 $A=(a_{ij})$，$B=(b_{jk})$，$C=(c_{kl})$。\n\n$(AB)C$ 的第 $(i,l)$ 元素为：\n$$\\sum_{k=1}^{p}\\left(\\sum_{j=1}^{n} a_{ij}b_{jk}\\right)c_{kl} = \\sum_{k=1}^{p}\\sum_{j=1}^{n} a_{ij}b_{jk}c_{kl}$$\n\n$A(BC)$ 的第 $(i,l)$ 元素为：\n$$\\sum_{j=1}^{n} a_{ij}\\left(\\sum_{k=1}^{p} b_{jk}c_{kl}\\right) = \\sum_{j=1}^{n}\\sum_{k=1}^{p} a_{ij}b_{jk}c_{kl}$$\n\n两式中的有限和相等，因此 $(AB)C = A(BC)$，结合律得证。$\\blacksquare$',
      status: 'done',
      createdAt: '2025-04-09T14:02:00.000Z',
      metadata: { model: 'claude-3-5-sonnet', tokens: 312 },
    },
  ],
  'conv-003': [
    {
      id: 'msg-005',
      conversationId: 'conv-003',
      role: 'user',
      content: '考研英语完型填空有什么技巧？',
      status: 'done',
      createdAt: '2025-04-08T09:00:00.000Z',
    },
    {
      id: 'msg-006',
      conversationId: 'conv-003',
      role: 'assistant',
      content:
        '完型填空的核心技巧如下：\n\n1. **通读全文，把握主旨**：先略读全文，理解文章主题和作者态度，再做题。\n2. **利用上下文线索**：每个空格的答案往往在其前后句中有同义替换或逻辑呼应。\n3. **注意固定搭配**：动词+介词、形容词+介词等固定搭配是高频考点。\n4. **排除法**：对于拿不准的题，先排除明显错误的选项，缩小范围。\n5. **保持语篇连贯**：选词要符合文章整体逻辑（对比、转折、因果关系）。\n\n每天精做 1-2 篇完型，注重复盘和总结错误类型，效果会明显提升。',
      status: 'done',
      createdAt: '2025-04-08T09:02:00.000Z',
      metadata: { model: 'claude-3-5-sonnet', tokens: 198 },
    },
  ],
};

// ── Knowledge Bases ───────────────────────────────────────────────────────────

export const MOCK_KNOWLEDGE_BASES: KnowledgeBase[] = [
  {
    id: 'kb-001',
    name: '高数真题解析',
    subjectId: 101,
    subjectName: '高等数学',
    type: 'public',
    userId: 'mock-user-001',
    description: '近十年考研数学一高等数学部分真题与详解',
    files: [
      {
        id: 'kf-001',
        knowledgeBaseId: 'kb-001',
        name: '2023-math.pdf',
        displayName: '2023年真题',
        type: 'pdf',
        url: '/mock/files/2023-math.pdf',
        size: 204800,
        order: 1,
        createdAt: '2025-02-01T00:00:00.000Z',
        updatedAt: '2025-02-01T00:00:00.000Z',
      },
      {
        id: 'kf-002',
        knowledgeBaseId: 'kb-001',
        name: '2022-math.pdf',
        displayName: '2022年真题',
        type: 'pdf',
        url: '/mock/files/2022-math.pdf',
        size: 196608,
        order: 2,
        createdAt: '2025-02-01T00:00:00.000Z',
        updatedAt: '2025-02-01T00:00:00.000Z',
      },
    ],
    createdAt: '2025-02-01T00:00:00.000Z',
    updatedAt: '2025-03-01T00:00:00.000Z',
  },
  {
    id: 'kb-002',
    name: '线性代数笔记',
    subjectId: 102,
    subjectName: '线性代数',
    type: 'private',
    userId: 'mock-user-001',
    description: '个人整理的线性代数核心知识点笔记',
    files: [
      {
        id: 'kf-003',
        knowledgeBaseId: 'kb-002',
        name: 'linear-algebra-notes.md',
        displayName: '核心知识点',
        type: 'md',
        url: '/mock/files/la-notes.md',
        size: 51200,
        order: 1,
        content: '# 线性代数核心知识点\n\n## 行列式\n...',
        createdAt: '2025-03-01T00:00:00.000Z',
        updatedAt: '2025-03-15T00:00:00.000Z',
      },
    ],
    createdAt: '2025-03-01T00:00:00.000Z',
    updatedAt: '2025-03-15T00:00:00.000Z',
  },
];

// ── Analytics ─────────────────────────────────────────────────────────────────

export const MOCK_ANALYTICS: Record<number, LearningAnalytics> = {
  101: {
    userId: 'mock-user-001',
    subjectId: 101,
    subjectName: '高等数学',
    weakPoints: [
      { id: 'wp-001', keyword: '洛必达法则', level: 'high', count: 8, relatedChapter: '函数与极限' },
      { id: 'wp-002', keyword: '广义积分收敛', level: 'high', count: 6, relatedChapter: '积分学' },
      { id: 'wp-003', keyword: '隐函数求导', level: 'medium', count: 4, relatedChapter: '导数与微分' },
      { id: 'wp-004', keyword: '泰勒展开', level: 'medium', count: 3, relatedChapter: '函数与极限' },
      { id: 'wp-005', keyword: '分部积分', level: 'low', count: 2, relatedChapter: '积分学' },
    ],
    wordCloud: [
      { text: '极限', weight: 90, level: 'high' },
      { text: '导数', weight: 75, level: 'medium' },
      { text: '积分', weight: 85, level: 'high' },
      { text: '级数', weight: 60, level: 'medium' },
      { text: '微分方程', weight: 50, level: 'low' },
      { text: '洛必达', weight: 70, level: 'high' },
      { text: '泰勒', weight: 55, level: 'medium' },
      { text: '夹逼定理', weight: 45, level: 'low' },
    ],
    summary:
      '本阶段学习重点集中在极限和积分方向，洛必达法则和广义积分收敛性是主要薄弱点，建议加强这两部分的专项练习。',
    summaryGeneratedAt: '2025-04-15T10:00:00.000Z',
    updatedAt: '2025-04-15T10:00:00.000Z',
  },
  102: {
    userId: 'mock-user-001',
    subjectId: 102,
    subjectName: '线性代数',
    weakPoints: [
      { id: 'wp-101', keyword: '特征值与特征向量', level: 'high', count: 7, relatedChapter: '矩阵' },
      { id: 'wp-102', keyword: '矩阵的秩', level: 'medium', count: 4, relatedChapter: '矩阵' },
      { id: 'wp-103', keyword: '线性相关性', level: 'low', count: 2, relatedChapter: '行列式' },
    ],
    wordCloud: [
      { text: '特征值', weight: 80, level: 'high' },
      { text: '矩阵', weight: 90, level: 'high' },
      { text: '行列式', weight: 65, level: 'medium' },
      { text: '秩', weight: 55, level: 'medium' },
      { text: '向量空间', weight: 40, level: 'low' },
    ],
    summary: '线性代数方面特征值与特征向量是核心薄弱环节，建议结合几何意义加深理解。',
    summaryGeneratedAt: '2025-04-14T09:00:00.000Z',
    updatedAt: '2025-04-14T09:00:00.000Z',
  },
};

// ── Stream text segments (for mock chat streaming) ────────────────────────────

export const MOCK_STREAM_RESPONSE =
  '这是一个 **mock 模式** 下的模拟回答。\n\n' +
  '在真实环境中，AI 会根据您的问题结合知识库内容生成详细解答。\n\n' +
  '目前系统处于 **Mock 数据模式**，所有接口返回本地预设数据，不依赖后端服务。\n\n' +
  '您可以在 `src/mock/config.ts` 中将 `USE_MOCK` 改为 `false` 切换到真实接口。';
