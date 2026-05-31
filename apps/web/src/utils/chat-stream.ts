export function normalizeAssistantStreamContent(raw: string): string {
  const source = typeof raw === 'string' ? raw : '';
  if (!source) return '';
  const withoutFence = source
    .replace(/^```ya?ml\s*/i, '')
    .replace(/\n```$/, '')
    .trim();
  const parsedAnswer = extractYamlAnswer(withoutFence);
  return parsedAnswer ? decodeEscapedText(parsedAnswer).trimEnd() : decodeEscapedText(withoutFence).trimEnd();
}

function extractYamlAnswer(source: string): string {
  const blockMarker = 'answer: |';
  const blockIdx = source.indexOf(blockMarker);
  if (blockIdx >= 0) {
    const tail = source.slice(blockIdx + blockMarker.length);
    const lines = tail.split('\n');
    const answerLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith('  ')) {
        answerLines.push(line.slice(2));
        continue;
      }
      if (line.trim() === '') {
        answerLines.push('');
        continue;
      }
      if (answerLines.length > 0) break;
    }
    return answerLines.join('\n');
  }

  const quotedPrefix = 'answer: "';
  const quotedIdx = source.indexOf(quotedPrefix);
  if (quotedIdx >= 0) {
    const tail = source.slice(quotedIdx + quotedPrefix.length);
    const stopKeys = ['\nknowledge_points:', '\nneeds_video:', '\ndifficulty:', '\nsubject:'];
    let endIdx = tail.length;
    for (const key of stopKeys) {
      const idx = tail.indexOf(key);
      if (idx >= 0 && idx < endIdx) endIdx = idx;
    }
    return tail.slice(0, endIdx).replace(/"\s*$/, '');
  }

  return '';
}

function decodeEscapedText(input: string): string {
  return input
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}
