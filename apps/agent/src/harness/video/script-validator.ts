export function validateManimScript(script: string): string[] {
  const errors: string[] = [];
  const trimmed = script.trim();

  if (!trimmed) {
    return ['脚本为空'];
  }

  if (trimmed.length < 80) {
    errors.push('脚本内容过短，可能不完整');
  }

  const hasManimImport =
    /from\s+manim\s+import\s+/m.test(script) || /import\s+manim/m.test(script);
  if (!hasManimImport) {
    errors.push('缺少 manim 相关导入');
  }

  if (!/class\s+\w+\s*\(\s*Scene\s*\)\s*:/m.test(script)) {
    errors.push('缺少继承 Scene 的类定义');
  }

  if (!/def\s+construct\s*\(\s*self\s*\)\s*:/m.test(script)) {
    errors.push('缺少 construct(self) 方法');
  }

  return errors;
}
