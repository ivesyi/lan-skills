import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import MarkdownIt from "markdown-it";
import juice from "juice";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const THEMES_DIR = path.join(__dirname, "..", "themes");

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: false,
  typographer: false,
});

export function listThemes() {
  return fs
    .readdirSync(THEMES_DIR)
    .filter((f) => f.endsWith(".css"))
    .map((f) => f.replace(/\.css$/, ""));
}

export function loadTheme(theme = "default") {
  const file = path.join(THEMES_DIR, `${theme}.css`);
  if (!fs.existsSync(file)) {
    const available = listThemes().join(", ");
    throw new Error(`未找到主题 "${theme}"。可用主题: ${available}`);
  }
  return fs.readFileSync(file, "utf8");
}

// 提取第一个 H1 作为默认标题
export function extractTitle(mdText) {
  const m = mdText.match(/^\s*#\s+(.+?)\s*$/m);
  return m ? m[1].trim() : null;
}

/**
 * 把 Markdown 转成微信可用的内联 HTML 片段。
 * 微信会剥离 <style> 和 class 选择器，所以必须把 CSS 内联到每个元素。
 */
/**
 * 版式增强：渲染之后、juice 内联之前给块打 class。
 * 微信最终会剥掉 class，但那时样式已经被 juice 内联进 style 属性了。
 *
 * 支持的写法（都是标准 Markdown，别的编辑器里也不会坏）：
 *   > [!tip] 提示内容        → 提示条（还支持 note / warning）
 *   > [!quote] 金句          → 金句卡（居中大字，全文用一次）
 *   图注：这张图在说什么      → 图注（小字居中灰）
 */
export function enhanceLayout(html) {
  return html
    .replace(
      /<blockquote>\s*<p>\s*\[!(tip|note|warning|warn|quote)\]\s*/gi,
      (_m, kind) => {
        const k = kind.toLowerCase() === "warn" ? "warning" : kind.toLowerCase();
        return `<blockquote class="wx-callout wx-callout-${k}"><p>`;
      }
    )
    .replace(/<p>\s*图注[：:]\s*/g, '<p class="wx-caption">');
}

export function convertToWechatHtml(mdText, { theme = "default" } = {}) {
  const css = loadTheme(theme);
  const body = enhanceLayout(md.render(mdText));
  const fragment = `<section class="wx-body">${body}</section>`;
  // inlineContent：把 css 规则内联进 fragment 内的元素
  const inlined = juice.inlineContent(fragment, css, {
    inlinePseudoElements: false,
    preserveImportant: true,
  });
  return inlined;
}

/** 生成可在浏览器/手机预览的完整 HTML（所见即微信所得） */
export function buildPreviewHtml(innerHtml, title = "预览") {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body { margin: 0; background: #ededed; }
  .page { max-width: 677px; margin: 0 auto; background: #fff; padding: 20px 16px 60px; }
</style>
</head>
<body>
<div class="page">
${innerHtml}
</div>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
