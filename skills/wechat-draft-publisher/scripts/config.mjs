import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import yaml from "js-yaml";

/**
 * 配置查找顺序（先找到先用）：
 *   1. $WECHAT_DRAFT_CONFIG           —— 显式指定
 *   2. <项目根>/.local/wechat-draft.yaml —— 项目级（.local 已被 .gitignore 忽略）
 *   3. ~/.config/wechat-draft/config.yaml —— 用户级，跨项目共用（推荐）
 *
 * AppSecret 属于敏感凭据，三个位置都在版本库之外。永远不要把它写进仓库内被
 * 追踪的文件。
 */
const USER_DIR = path.join(os.homedir(), ".config", "wechat-draft");
const USER_PATH = path.join(USER_DIR, "config.yaml");

function findProjectRoot(start) {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function resolveConfigPath() {
  if (process.env.WECHAT_DRAFT_CONFIG) {
    return { path: process.env.WECHAT_DRAFT_CONFIG, scope: "env" };
  }
  const root = findProjectRoot(process.cwd());
  if (root) {
    const projectPath = path.join(root, ".local", "wechat-draft.yaml");
    if (fs.existsSync(projectPath)) return { path: projectPath, scope: "project" };
  }
  return { path: USER_PATH, scope: "user" };
}

export const CONFIG_PATH = resolveConfigPath().path;
export const CONFIG_DIR = path.dirname(CONFIG_PATH);
export const TOKEN_CACHE_PATH = path.join(CONFIG_DIR, ".wechat-draft-token.json");

export function configExists() {
  return fs.existsSync(CONFIG_PATH);
}

export function loadConfig() {
  const { path: p, scope } = resolveConfigPath();
  if (!fs.existsSync(p)) {
    throw new Error(
      `还没配置公众号凭据。\n` +
        `  期望位置: ${p}（${scope}）\n` +
        `  先跑一次: node scripts/doctor.mjs --init\n` +
        `  它会建好配置文件并告诉你下一步做什么。`
    );
  }
  const cfg = yaml.load(fs.readFileSync(p, "utf8")) || {};
  cfg.wechat = cfg.wechat || {};
  cfg.convert = cfg.convert || {};
  cfg.__path = p;
  cfg.__scope = scope;
  return cfg;
}

export function requireCredentials(cfg) {
  const { appid, secret } = cfg.wechat || {};
  const placeholder = (v) => !v || /^(your_|<|TODO|填)/i.test(String(v));
  if (placeholder(appid)) {
    throw new Error(`配置里还没填 AppID（${cfg.__path}）`);
  }
  if (placeholder(secret)) {
    throw new Error(`配置里还没填 AppSecret（${cfg.__path}）`);
  }
  return { appid, secret };
}

export function writeConfigTemplate() {
  const { path: p } = resolveConfigPath();
  const dir = path.dirname(p);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (fs.existsSync(p)) return { path: p, created: false };
  const tpl = `# 微信公众号发布凭据 —— 不要提交进任何仓库
wechat:
  # 公众平台 → 设置与开发 → 基本配置 → 开发者ID(AppID)
  appid: your_wechat_appid
  # 同一页 → 开发者密码(AppSecret) → 重置后只显示一次，立刻粘到这里
  secret: your_wechat_secret

convert:
  default_theme: default
  # 「阅读原文」默认链接，留空则不带
  content_source_url: ""

# 默认作者署名，发布时可用 --author 覆盖
defaults:
  author: ""
`;
  fs.writeFileSync(p, tpl, { mode: 0o600 });
  return { path: p, created: true };
}
