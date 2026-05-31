import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';
import texmath from 'markdown-it-texmath';
import katex from 'katex';

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: true,
});

markdown.use(texmath, {
  engine: katex,
  delimiters: 'dollars',
  katexOptions: {
    throwOnError: false,
    strict: 'ignore',
  },
});

export function renderMarkdown(raw: string): string {
  const source = typeof raw === 'string' ? raw : '';
  const html = markdown.render(source);
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
  });
}
