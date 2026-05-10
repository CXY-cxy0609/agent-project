---
name: manim-fix-task
requiredVars:
  - script
  - error
  - errorType
  - strategy
---

## 任务要求

分析以下 Manim 脚本的报错原因并修复，输出完整的修复后脚本，不得省略任何场景代码。

要求：

1. 优先做最小必要修改，避免无关重构
2. 保留原有教学内容与动画意图
3. 输出完整 Python 代码，可直接用于渲染

## 上下文信息

### 原始脚本

```python
{{script}}
```

### 错误信息

```
{{error}}
```

### 错误分类

{{errorType}}

### 修复策略

{{strategy}}

### 上轮校验反馈（如有）

{{validationFeedback}}
