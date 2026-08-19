import fs from "node:fs";
import path from "node:path";
import { TOKEN_CACHE_PATH } from "./config.mjs";

const API = "https://api.weixin.qq.com";

const EXT_MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".webp": "image/webp",
};

function mimeFromName(name) {
  return EXT_MIME[path.extname(name).toLowerCase()] || "image/jpeg";
}

function checkWxError(data, context) {
  if (data && typeof data.errcode === "number" && data.errcode !== 0) {
    const hints = {
      40013: "AppID 无效",
      40001: "AppSecret 无效或 access_token 错误",
      40164: "调用方 IP 不在公众号 IP 白名单中（在公众平台-基本配置-IP白名单添加本机出口IP）",
      45009: "接口调用频率超限",
      44003: "图文内容为空（content 至少要有一个标签）",
      40007: "media_id 无效",
    };
    const hint = hints[data.errcode] ? ` —— ${hints[data.errcode]}` : "";
    throw new Error(
      `微信API错误 [${context}] errcode=${data.errcode} errmsg=${data.errmsg}${hint}`
    );
  }
  return data;
}

async function readBytes(src, baseDir) {
  if (/^https?:\/\//i.test(src)) {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`下载图片失败 ${res.status}: ${src}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const name = path.basename(new URL(src).pathname) || "image.jpg";
    return { buf, name: name.includes(".") ? name : name + ".jpg" };
  }
  const abs = path.isAbsolute(src) ? src : path.resolve(baseDir || ".", src);
  if (!fs.existsSync(abs)) throw new Error(`找不到本地图片: ${abs}`);
  return { buf: fs.readFileSync(abs), name: path.basename(abs) };
}

async function postForm(url, buf, name) {
  const fd = new FormData();
  fd.append("media", new Blob([buf], { type: mimeFromName(name) }), name);
  const res = await fetch(url, { method: "POST", body: fd });
  return res.json();
}

// ---- access_token（带本地缓存，2 小时有效）----
export async function getAccessToken(appid, secret, { force = false } = {}) {
  if (!force && fs.existsSync(TOKEN_CACHE_PATH)) {
    try {
      const cache = JSON.parse(fs.readFileSync(TOKEN_CACHE_PATH, "utf8"));
      if (
        cache.appid === appid &&
        cache.access_token &&
        cache.expires_at > Date.now() + 60_000
      ) {
        return cache.access_token;
      }
    } catch {
      /* ignore corrupt cache */
    }
  }
  const url = `${API}/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(
    appid
  )}&secret=${encodeURIComponent(secret)}`;
  const data = checkWxError(await (await fetch(url)).json(), "token");
  if (!data.access_token) throw new Error("获取 access_token 失败：" + JSON.stringify(data));
  const payload = {
    appid,
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in || 7200) * 1000,
  };
  fs.writeFileSync(TOKEN_CACHE_PATH, JSON.stringify(payload), { mode: 0o600 });
  try {
    fs.chmodSync(TOKEN_CACHE_PATH, 0o600);
  } catch {
    /* best effort */
  }
  return data.access_token;
}

// ---- 上传正文图片，返回可用于 content 的微信 URL ----
export async function uploadContentImage(token, src, baseDir) {
  const { buf, name } = await readBytes(src, baseDir);
  const url = `${API}/cgi-bin/media/uploadimg?access_token=${token}`;
  const data = checkWxError(await postForm(url, buf, name), "media/uploadimg");
  if (!data.url) throw new Error("uploadimg 未返回 url：" + JSON.stringify(data));
  return data.url;
}

// ---- 上传永久图片素材，返回 media_id（用于封面 thumb_media_id）----
export async function uploadPermanentImage(token, src, baseDir) {
  const { buf, name } = await readBytes(src, baseDir);
  const url = `${API}/cgi-bin/material/add_material?access_token=${token}&type=image`;
  const data = checkWxError(await postForm(url, buf, name), "material/add_material");
  if (!data.media_id) throw new Error("add_material 未返回 media_id：" + JSON.stringify(data));
  return { media_id: data.media_id, url: data.url };
}

/**
 * 扫描正文 HTML 里的 <img>，把本地/外链图片上传到微信并替换 src。
 * 微信会过滤非微信域名的外链图片，所以必须全部重传。
 */
export async function processContentImages(token, html, baseDir, log = () => {}) {
  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  const seen = new Map(); // 原 src -> 微信 url
  let out = html;
  for (const tag of imgTags) {
    const m = tag.match(/\ssrc=["']([^"']+)["']/i);
    if (!m) continue;
    const src = m[1];
    if (/mmbiz\.qpic\.cn/i.test(src)) continue; // 已是微信图
    if (src.startsWith("data:")) continue; // 内联 data uri 跳过
    if (!seen.has(src)) {
      log(`  上传图片: ${src}`);
      const wxUrl = await uploadContentImage(token, src, baseDir);
      seen.set(src, wxUrl);
    }
    const wxUrl = seen.get(src);
    const newTag = tag.replace(/(\ssrc=["'])[^"']+(["'])/i, `$1${wxUrl}$2`);
    out = out.replace(tag, newTag);
  }
  return out;
}

// ---- 新增草稿（图文 news）----
export async function addDraft(token, article) {
  const url = `${API}/cgi-bin/draft/add?access_token=${token}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ articles: [article] }),
  });
  const data = checkWxError(await res.json(), "draft/add");
  if (!data.media_id) throw new Error("draft/add 未返回 media_id：" + JSON.stringify(data));
  return data.media_id;
}
