#!/usr/bin/env node
/**
 * 微信正文 HTML 红线检查。
 * 依据：微信公众平台编辑器插件开发规范
 *   https://developers.weixin.qq.com/doc/subscription/guide/product/plugin_spec.html
 * 以及暗色模式适配的社区共识（见 references/PLATFORM-LIMITS.md）。
 *
 * 用法：node scripts/lint-wx.mjs <生成的.html>
 * 退出码：0 = 无 ERROR；1 = 有 ERROR（不要推稿）
 */
import fs from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("用法: node scripts/lint-wx.mjs <生成的.html>");
  process.exit(2);
}
const html = fs.readFileSync(file, "utf8");
// 只检查正文片段（预览页外壳里的 <style> 不算）
const body = html.includes('<div class="page">')
  ? html.split('<div class="page">')[1].split(/<\/div>\s*<\/body>/)[0]
  : html;

const ERRORS = [
  [/<style[\s>]/i, "正文里有 <style> 标签——微信会剥掉，样式必须内联"],
  [/<script[\s>]/i, "正文里有 <script> 标签"],
  [/position\s*:\s*(fixed|absolute|sticky)/i, "用了 position fixed/absolute/sticky——暗色模式算法按 DOM 顺序处理，视觉顺序对不上会出错"],
  [/display\s*:\s*grid/i, "用了 display:grid——公众号里不稳"],
  [/@media[\s(]/i, "用了 @media——正文里没有 stylesheet 可挂"],
  [/@keyframes[\s{]/i, "用了 @keyframes 动画"],
  [/line-height\s*:\s*0\b/i, "line-height:0 会让字叠在一起（官方 §2.3）"],
  [/height\s*:\s*0(px)?\s*[;"]/i, "容器 height:0 在手机上看不见（官方 §2.5）"],
  [/text-align\s*:\s*(start|end)\b/i, "text-align:start/end 在 iOS 18+ 与编辑器不一致（官方 §2.6）"],
  [/caret-color\s*:\s*transparent/i, "caret-color:transparent 会让编辑光标消失（官方 §2.2）"],
  [/var\(--/, "用了 CSS 变量——内联后无处解析"],
  [/float\s*:\s*(left|right)/i, "用了 float 布局"],
];

const WARNINGS = [
  [/width\s*:\s*\d{3,}px/i, "容器写死了 px 宽度，小屏会出问题（官方 §2.4）；改成百分比或不写"],
  [/box-shadow\s*:/i, "用了 box-shadow——暗色模式会把黑影反成白影"],
  [/rgba\s*\(/i, "用了 rgba 半透明——暗色模式算法处理不确定，建议改 solid hex"],
  [/linear-gradient/i, "用了渐变——文字底下的渐变在暗色模式会被压成纯色"],
  [/<(div|table)[\s>]/i, "用了 div/table——社区惯例是用 section，被过滤的概率更低"],
  [/<pre[\s>]/i, "有 <pre>：确认只用于代码块，别用来包正文（官方 §2.8）"],
  [/href="(?!https?:\/\/mp\.weixin\.qq\.com)/i, "正文里有非公众号域名的外链——微信会让它变成不能点的纯文字，建议改成文末脚注"],
];

let errs = 0, warns = 0;
for (const [re, msg] of ERRORS) if (re.test(body)) { console.log(`❌ ERROR  ${msg}`); errs++; }
for (const [re, msg] of WARNINGS) if (re.test(body)) { console.log(`⚠️  WARN   ${msg}`); warns++; }

// 版式厚度检查：全是段落和图 = 没版式
const counts = {
  小标题: (body.match(/<h[23][\s>]/gi) || []).length,
  引用块: (body.match(/<blockquote[\s>]/gi) || []).length,
  加粗: (body.match(/<strong[\s>]/gi) || []).length,
  图注: (body.match(/wx-caption/gi) || []).length,
  分隔线: (body.match(/<hr[\s/>]/gi) || []).length,
  段落: (body.match(/<p[\s>]/gi) || []).length,
  图: (body.match(/<img[\s>]/gi) || []).length,
};
console.log(
  `\n版式厚度：小标题 ${counts.小标题} / 引用 ${counts.引用块} / 加粗 ${counts.加粗} / ` +
  `图注 ${counts.图注} / 分隔线 ${counts.分隔线}（段落 ${counts.段落}、图 ${counts.图}）`
);
if (counts.小标题 === 0 && counts.引用块 === 0 && counts.加粗 === 0) {
  console.log("⚠️  WARN   通篇只有段落和图，没有任何版式层次——回去给正文加小标题/引用/重点句");
  warns++;
}

console.log(errs === 0 ? `\n✅ 无红线问题（WARN ${warns} 条，看一眼即可）` : `\n❌ ${errs} 条红线问题，修完再推稿`);
process.exit(errs === 0 ? 0 : 1);
