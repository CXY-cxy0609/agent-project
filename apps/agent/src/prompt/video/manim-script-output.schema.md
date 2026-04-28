---
name: manim-script-output
fields:
  - name: script
    type: string
    required: true
    description: 完整的 Manim Python 脚本
  - name: scene_class_name
    type: string
    required: true
    description: Manim Scene 类名
---

## Manim 脚本输出 Schema

用于 `VideoAgent` 的脚本生成节点（`generateScript`）和脚本修复节点（`fixScript`），输出可直接送入渲染服务的 Manim 代码。

```yaml
script: |
  from manim import *

  class DerivativeScene(Scene):
      def construct(self):
          ...
scene_class_name: DerivativeScene
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `script` | string | ✓ | 完整 Manim Python 脚本，包含 import 和 Scene 类定义 |
| `scene_class_name` | string | ✓ | Scene 子类名，渲染服务通过此字段定位入口类 |
