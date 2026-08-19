#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { loadConfig, requireCredentials } from "./config.mjs";
import {
  convertToWechatHtml,
  buildPreviewHtml,
  extractTitle,
  listThemes,
} from "./convert.mjs";
import {
  getAccessToken,
  processContentImages,
  uploadPermanentImage,
  addDraft,
} from "./wechat.mjs";

function parseArgs(argv) {
  const positionals = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i++;
      }
    } else {
      positionals.push(a);
    }
  }
  return { positionals, flags };
}

function firstImageSrc(html) {
  const tags = html.match(/<img\b[^>]*>/gi) || [];
  for (const t of tags) {
    const m = t.match(/\ssrc=["']([^"']+)["']/i);
    if (m && !m[1].startsWith("data:")) return m[1];
  }
  return null;
}

function help() {
  console.log(`md2wechat-local — 本地 Markdown → 微信公众号（不依赖 md2wechat.cn）

用法:
  md2wx convert <文件.md> [--theme 主题] [--out 输出.html] [--title 标题]
      本地把 Markdown 转成内联样式的微信 HTML，生成可预览的网页文件。

  md2wx publish <文件.md> [选项]
      本地转换后，通过微信官方 API 上传图片并创建图文草稿。
      选项:
        --title <标题>        默认取 Markdown 第一个 # 标题或文件名
        --author <作者>
        --digest <摘要>       留空则微信自动抓取正文前 54 字
        --cover <图片路径/URL> 封面图（news 必需，永久素材）。未指定则用正文第一张图
        --theme <主题>        默认读配置 default_theme
        --source-url <URL>    “阅读原文”链接
        --no-upload-images    不自动重传正文图片（不推荐，外链会被微信过滤）

  md2wx token [--force]      测试获取 access_token（受 IP 白名单限制）
  md2wx themes               列出可用本地主题

可用主题: ${listThemes().join(", ")}
配置文件: ~/.config/md2wechat-local/config.yaml`);
}

async function cmdConvert(flags, pos) {
  const input = pos[0];
  if (!input) throw new Error("请提供 Markdown 文件路径");
  const cfg = loadConfig();
  const theme = flags.theme || cfg.convert.default_theme || "default";
  const mdText = fs.readFileSync(input, "utf8");
  const title = flags.title || extractTitle(mdText) || path.basename(input, path.extname(input));
  const inner = convertToWechatHtml(mdText, { theme });
  const out =
    flags.out ||
    path.join(process.cwd(), path.basename(input, path.extname(input)) + ".preview.html");
  fs.writeFileSync(out, buildPreviewHtml(inner, title), "utf8");
  console.log(`✅ 已生成预览: ${out}`);
  console.log(`   主题: ${theme}  标题: ${title}`);
}

async function cmdPublish(flags, pos) {
  const input = pos[0];
  if (!input) throw new Error("请提供 Markdown 文件路径");
  const cfg = loadConfig();
  const { appid, secret } = requireCredentials(cfg);
  const baseDir = path.dirname(path.resolve(input));
  const theme = flags.theme || cfg.convert.default_theme || "default";
  const mdText = fs.readFileSync(input, "utf8");
  const title = flags.title || extractTitle(mdText) || path.basename(input, path.extname(input));
  if (title.length > 64) console.warn(`⚠️  标题超过 64 字，可能被微信截断`);

  let content = convertToWechatHtml(mdText, { theme });
  const originalFirstImg = firstImageSrc(content);

  console.log("· 获取 access_token …");
  const token = await getAccessToken(appid, secret);

  if (!flags["no-upload-images"]) {
    console.log("· 处理正文图片（上传到微信）…");
    content = await processContentImages(token, content, baseDir, (m) => console.log(m));
  }

  // 封面（news 必填，必须是永久素材 media_id）
  const coverSrc = flags.cover || originalFirstImg;
  let thumbMediaId;
  if (coverSrc) {
    console.log(`· 上传封面: ${coverSrc}`);
    const cover = await uploadPermanentImage(token, coverSrc, baseDir);
    thumbMediaId = cover.media_id;
  } else {
    throw new Error(
      "图文草稿需要封面图。请用 --cover <图片路径/URL> 指定，或在正文里至少放一张图片。"
    );
  }

  const article = {
    article_type: "news",
    title,
    content,
    thumb_media_id: thumbMediaId,
    need_open_comment: 0,
    only_fans_can_comment: 0,
  };
  if (flags.author) article.author = flags.author;
  if (flags.digest) article.digest = flags.digest;
  const sourceUrl = flags["source-url"] || cfg.convert.content_source_url;
  if (sourceUrl) article.content_source_url = sourceUrl;

  console.log("· 创建草稿 …");
  const mediaId = await addDraft(token, article);
  console.log(`\n✅ 草稿已创建！media_id = ${mediaId}`);
  console.log("   打开 公众号后台 → 草稿箱 即可查看 / 编辑 / 群发。");
}

async function cmdToken(flags) {
  const cfg = loadConfig();
  const { appid, secret } = requireCredentials(cfg);
  const token = await getAccessToken(appid, secret, { force: !!flags.force });
  console.log(`✅ access_token 获取成功（已缓存，2 小时有效）。长度=${token.length}`);
}

async function main() {
  const { positionals, flags } = parseArgs(process.argv.slice(2));
  const cmd = positionals[0];
  const rest = positionals.slice(1);
  try {
    switch (cmd) {
      case "convert":
        await cmdConvert(flags, rest);
        break;
      case "publish":
        await cmdPublish(flags, rest);
        break;
      case "token":
        await cmdToken(flags);
        break;
      case "themes":
        console.log(listThemes().join("\n"));
        break;
      case undefined:
      case "help":
      case "--help":
      case "-h":
        help();
        break;
      default:
        console.error(`未知命令: ${cmd}\n`);
        help();
        process.exit(1);
    }
  } catch (err) {
    console.error(`\n❌ ${err.message}`);
    process.exit(1);
  }
}

main();
