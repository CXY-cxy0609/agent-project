<template>
  <div class="welcome-page">
    <!-- Background decoration -->
    <div class="bg-decoration">
      <div class="bg-circle circle-1"></div>
      <div class="bg-circle circle-2"></div>
      <div class="bg-circle circle-3"></div>
      <div class="bg-grid"></div>
    </div>

    <!-- Navigation -->
    <nav class="welcome-nav">
      <div class="nav-brand">
        <div class="brand-icon">研</div>
        <span class="brand-name">研智辅导</span>
      </div>
      <div class="nav-actions">
        <a-button @click="$router.push('/login')">登录</a-button>
        <a-button type="primary" @click="$router.push('/register')">免费注册</a-button>
      </div>
    </nav>

    <!-- Hero Section -->
    <section class="hero-section">
      <div class="hero-content">
        <div class="hero-badge">
          <span class="badge-dot"></span>
          AI 驱动的考研智能辅导
        </div>
        <h1 class="hero-title">
          让考研复习<br />
          <span class="title-highlight">更聪明、更高效</span>
        </h1>
        <p class="hero-desc">
          基于大模型 AI，为考研学生提供知识点深度讲解、智能题目解析、
          个性化学情分析，让每一分钟复习都精准有效。
        </p>
        <div class="hero-actions">
          <a-button type="primary" size="large" class="cta-btn" @click="$router.push('/register')">
            立即开始学习
            <ArrowRightOutlined />
          </a-button>
          <a-button size="large" ghost class="demo-btn" @click="$router.push('/login')">
            已有账号，去登录
          </a-button>
        </div>
        <div class="hero-stats">
          <div v-for="stat in stats" :key="stat.label" class="stat-item">
            <div class="stat-value">{{ stat.value }}</div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
        </div>
      </div>

      <!-- Hero Visual -->
      <div class="hero-visual">
        <div class="chat-preview">
          <div class="preview-header">
            <div class="preview-dot red"></div>
            <div class="preview-dot yellow"></div>
            <div class="preview-dot green"></div>
            <span class="preview-title">问答中心 · 高等数学</span>
          </div>
          <div class="preview-messages">
            <div class="preview-msg user">
              <div class="msg-bubble">泰勒公式怎么理解？</div>
            </div>
            <div class="preview-msg assistant">
              <div class="msg-avatar">AI</div>
              <div class="msg-bubble">
                <div class="typing-line">泰勒公式是用多项式近似表示函数的工具...</div>
                <div class="typing-line partial">核心思想：在某点邻域内，用导数信息</div>
                <div class="typing-cursor">|</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Floating cards -->
        <div class="floating-card card-analytics">
          <BarChartOutlined class="card-icon" />
          <div>
            <div class="card-title">学情分析</div>
            <div class="card-sub">薄弱点已识别 3 个</div>
          </div>
        </div>
        <div class="floating-card card-knowledge">
          <BookOutlined class="card-icon" />
          <div>
            <div class="card-title">知识库</div>
            <div class="card-sub">已上传 12 份资料</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section class="features-section">
      <div class="section-header">
        <div class="section-tag">核心功能</div>
        <h2 class="section-title">三大场景，全面覆盖考研需求</h2>
      </div>
      <div class="features-grid">
        <div v-for="feature in features" :key="feature.title" class="feature-card">
          <div class="feature-icon" :style="{ background: feature.bg }">
            <component :is="feature.icon" />
          </div>
          <h3 class="feature-title">{{ feature.title }}</h3>
          <p class="feature-desc">{{ feature.desc }}</p>
          <ul class="feature-points">
            <li v-for="point in feature.points" :key="point">
              <CheckCircleFilled class="point-icon" />
              {{ point }}
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="cta-section">
      <div class="cta-content">
        <h2 class="cta-title">准备好开始你的智能备考之旅了吗？</h2>
        <p class="cta-desc">注册即可免费使用，支持多学科、多模型，随时随地备考</p>
        <a-button type="primary" size="large" class="cta-main-btn" @click="$router.push('/register')">
          免费注册，立即体验
        </a-button>
      </div>
    </section>

    <!-- Footer -->
    <footer class="welcome-footer">
      <span>© 2025 研智辅导 · 智能考研辅导平台</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import {
  ArrowRightOutlined,
  BarChartOutlined,
  BookOutlined,
  CheckCircleFilled,
  MessageOutlined,
  BulbOutlined,
  LineChartOutlined,
} from '@ant-design/icons-vue';

const stats = [
  { value: '10,000+', label: '考研学生使用' },
  { value: '50+', label: '学科知识库' },
  { value: '98%', label: '知识点讲解准确率' },
];

const features = [
  {
    icon: MessageOutlined,
    bg: 'linear-gradient(135deg, #e8f0fe, #c7d7fc)',
    title: '知识点讲解',
    desc: '输入任意知识点，AI 自动讲解核心概念、易错点与应用场景',
    points: ['深度解析知识点结构', '自动关联真题考点', '支持公式渲染'],
  },
  {
    icon: BulbOutlined,
    bg: 'linear-gradient(135deg, #fff8e8, #fde8b0)',
    title: '智能答题',
    desc: '上传题目，AI 识别类型、拆解步骤，支持多轮追问深度学习',
    points: ['识别题目类型', '分步骤解题讲解', '支持图片/文件上传'],
  },
  {
    icon: LineChartOutlined,
    bg: 'linear-gradient(135deg, #e8fef0, #b0f0cc)',
    title: '学情分析',
    desc: '根据对话记录生成薄弱知识点图谱，给出个性化复习建议',
    points: ['词云展示薄弱点', '分学科深度分析', '一键生成复习报告'],
  },
];
</script>

<style scoped lang="less">
.welcome-page {
  min-height: 100vh;
  background: #fff;
  position: relative;
  overflow-x: hidden;
}

/* Background */
.bg-decoration {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.bg-circle {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.35;
}

.circle-1 {
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, #c7d7fc, transparent);
  top: -200px;
  right: -100px;
  animation: float 8s ease-in-out infinite;
}

.circle-2 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, #fde8b0, transparent);
  bottom: 100px;
  left: -100px;
  animation: float 10s ease-in-out infinite reverse;
}

.circle-3 {
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, #b0f0cc, transparent);
  top: 50%;
  left: 50%;
  animation: float 12s ease-in-out infinite 2s;
}

.bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(26, 58, 110, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(26, 58, 110, 0.03) 1px, transparent 1px);
  background-size: 40px 40px;
}

@keyframes float {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(5deg); }
}

/* Nav */
.welcome-nav {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 64px;
  height: 64px;
  border-bottom: 1px solid rgba(26, 58, 110, 0.06);
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.85);
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: default;
}

.brand-icon {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, @color-primary, @color-primary-light);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: @font-serif;
  font-size: 18px;
  font-weight: 700;
  color: #fff;
}

.brand-name {
  font-family: @font-serif;
  font-size: 18px;
  font-weight: 600;
  color: @color-primary;
}

.nav-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

/* Hero */
.hero-section {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 60px;
  padding: 80px 64px 100px;
  max-width: 1280px;
  margin: 0 auto;
}

.hero-content {
  flex: 1;
  max-width: 560px;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: rgba(26, 58, 110, 0.06);
  border: 1px solid rgba(26, 58, 110, 0.12);
  border-radius: 100px;
  font-size: 13px;
  color: @color-primary;
  font-weight: 500;
  margin-bottom: 24px;
}

.badge-dot {
  width: 7px;
  height: 7px;
  background: @color-accent;
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.8); }
}

.hero-title {
  font-family: @font-serif;
  font-size: 52px;
  line-height: 1.2;
  color: @color-text-primary;
  margin-bottom: 20px;
  font-weight: 700;
}

.title-highlight {
  background: linear-gradient(135deg, @color-primary, @color-primary-lighter);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-desc {
  font-size: 16px;
  line-height: 1.7;
  color: @color-text-secondary;
  margin-bottom: 36px;
}

.hero-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 48px;
  flex-wrap: wrap;
}

.cta-btn {
  background: linear-gradient(135deg, @color-primary, @color-primary-light) !important;
  border: none !important;
  height: 48px !important;
  padding: 0 28px !important;
  font-size: 15px !important;
  font-weight: 500 !important;
  border-radius: 10px !important;
  box-shadow: 0 8px 24px rgba(26, 58, 110, 0.25) !important;
}

.demo-btn {
  height: 48px !important;
  padding: 0 24px !important;
  font-size: 15px !important;
  border-radius: 10px !important;
  color: @color-primary !important;
  border-color: @color-primary !important;
}

.hero-stats {
  display: flex;
  gap: 40px;
}

.stat-item {
  text-align: left;
}

.stat-value {
  font-family: @font-serif;
  font-size: 28px;
  font-weight: 700;
  color: @color-primary;
  line-height: 1;
}

.stat-label {
  font-size: 12px;
  color: @color-text-muted;
  margin-top: 4px;
}

/* Hero Visual */
.hero-visual {
  flex: 1;
  max-width: 520px;
  position: relative;
}

.chat-preview {
  background: #fff;
  border-radius: 16px;
  box-shadow: @shadow-lg, 0 0 0 1px rgba(26, 58, 110, 0.06);
  overflow: hidden;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 18px;
  background: @color-bg;
  border-bottom: 1px solid @color-border;
}

.preview-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.preview-dot.red { background: #ff5f57; }
.preview-dot.yellow { background: #ffbd2e; }
.preview-dot.green { background: #28ca41; }

.preview-title {
  font-size: 12px;
  color: @color-text-muted;
  margin-left: 4px;
  font-weight: 500;
}

.preview-messages {
  padding: 20px 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preview-msg {
  display: flex;
  gap: 10px;
}

.preview-msg.user {
  justify-content: flex-end;
}

.preview-msg.user .msg-bubble {
  background: @color-primary;
  color: #fff;
  border-radius: 12px 2px 12px 12px;
  max-width: 200px;
}

.preview-msg.assistant .msg-bubble {
  background: @color-bg;
  color: @color-text-primary;
  border-radius: 2px 12px 12px 12px;
  max-width: 320px;
  flex: 1;
}

.msg-bubble {
  padding: 10px 14px;
  font-size: 13px;
  line-height: 1.6;
}

.msg-avatar {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: linear-gradient(135deg, @color-primary, @color-primary-light);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
}

.typing-line {
  line-height: 1.7;
}

.typing-line.partial {
  color: @color-text-secondary;
}

.typing-cursor {
  display: inline-block;
  color: @color-accent;
  font-weight: 700;
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* Floating cards */
.floating-card {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: #fff;
  border-radius: 12px;
  box-shadow: @shadow-md;
  border: 1px solid @color-border-light;
}

.card-analytics {
  bottom: -30px;
  left: -50px;
  animation: float 6s ease-in-out infinite;
}

.card-knowledge {
  top: -20px;
  right: -40px;
  animation: float 8s ease-in-out infinite 1s;
}

.card-icon {
  font-size: 22px;
  color: @color-primary;
}

.card-title {
  font-size: 12px;
  font-weight: 600;
  color: @color-text-primary;
}

.card-sub {
  font-size: 11px;
  color: @color-text-muted;
  margin-top: 2px;
}

/* Features */
.features-section {
  position: relative;
  z-index: 1;
  padding: 100px 64px;
  background: @color-bg;
}

.section-header {
  text-align: center;
  margin-bottom: 56px;
}

.section-tag {
  display: inline-block;
  padding: 4px 12px;
  background: rgba(26, 58, 110, 0.08);
  color: @color-primary;
  border-radius: 100px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}

.section-title {
  font-family: @font-serif;
  font-size: 36px;
  font-weight: 700;
  color: @color-text-primary;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  max-width: 1100px;
  margin: 0 auto;
}

.feature-card {
  background: #fff;
  border-radius: 16px;
  padding: 32px;
  border: 1px solid @color-border-light;
  transition: box-shadow 0.3s, transform 0.3s;
}

.feature-card:hover {
  box-shadow: @shadow-md;
  transform: translateY(-4px);
}

.feature-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: @color-primary;
  margin-bottom: 20px;
}

.feature-title {
  font-family: @font-serif;
  font-size: 20px;
  font-weight: 600;
  color: @color-text-primary;
  margin-bottom: 10px;
}

.feature-desc {
  font-size: 14px;
  color: @color-text-secondary;
  line-height: 1.7;
  margin-bottom: 20px;
}

.feature-points {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.feature-points li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: @color-text-secondary;
}

.point-icon {
  color: @color-accent;
  font-size: 14px;
  flex-shrink: 0;
}

/* CTA Section */
.cta-section {
  position: relative;
  z-index: 1;
  padding: 100px 64px;
  text-align: center;
  background: linear-gradient(135deg, @color-primary-dark 0%, @color-primary 100%);
}

.cta-title {
  font-family: @font-serif;
  font-size: 36px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 16px;
}

.cta-desc {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 36px;
}

.cta-main-btn {
  height: 52px !important;
  padding: 0 36px !important;
  font-size: 16px !important;
  font-weight: 500 !important;
  background: @color-accent !important;
  border-color: @color-accent !important;
  color: #1a2744 !important;
  border-radius: 12px !important;
  box-shadow: 0 8px 24px rgba(212, 160, 23, 0.4) !important;
}

/* Footer */
.welcome-footer {
  position: relative;
  z-index: 1;
  text-align: center;
  padding: 24px;
  font-size: 12px;
  color: @color-text-muted;
  background: @color-bg;
  border-top: 1px solid @color-border;
}
</style>
