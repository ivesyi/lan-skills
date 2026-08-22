import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import yaml from "js-yaml";
import { z } from "zod/v3";

const SERVER_NAME = "lan-wechat-setup";
const VERSION = "0.1.0";
const TEMPLATE_URI = "ui://lan-wechat-setup/credentials.html";
const CONFIG_DIR = path.join(os.homedir(), ".config", "wechat-draft");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.yaml");
const TOKEN_CACHE_PATH = path.join(CONFIG_DIR, ".wechat-draft-token.json");

const server = new McpServer(
  { name: SERVER_NAME, version: VERSION },
  { capabilities: { tools: {}, resources: {} } }
);

function readConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  return yaml.load(fs.readFileSync(CONFIG_PATH, "utf8")) || {};
}

function publicStatus() {
  const cfg = readConfig();
  const appid = cfg?.wechat?.appid;
  return {
    configured: Boolean(appid && cfg?.wechat?.secret),
    appid: appid || "",
    verifiedAt: cfg?.verification?.verified_at || null,
  };
}

function secretFingerprint(secret) {
  return crypto.createHash("sha256").update(secret).digest("hex").slice(0, 12);
}

function writeVerifiedConfig(appid, secret) {
  const cfg = readConfig();
  cfg.wechat = { ...(cfg.wechat || {}), appid, secret };
  cfg.convert = cfg.convert || { default_theme: "default", content_source_url: "" };
  cfg.defaults = cfg.defaults || { author: "" };
  cfg.verification = {
    verified_at: new Date().toISOString(),
    appid,
    secret_fingerprint: secretFingerprint(secret),
  };

  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  const tempPath = `${CONFIG_PATH}.tmp-${process.pid}`;
  fs.writeFileSync(tempPath, yaml.dump(cfg, { lineWidth: -1 }), { mode: 0o600 });
  fs.renameSync(tempPath, CONFIG_PATH);
  fs.chmodSync(CONFIG_PATH, 0o600);
  if (fs.existsSync(TOKEN_CACHE_PATH)) fs.rmSync(TOKEN_CACHE_PATH);
}

function extractIp(errmsg = "") {
  return errmsg.match(/invalid ip ((?:\d{1,3}\.){3}\d{1,3})/i)?.[1] || null;
}

async function fetchToken(appid, secret) {
  const url =
    "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential" +
    `&appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  return response.json();
}

const widgetHtml = String.raw`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; }
    body { margin: 0; padding: 16px; background: transparent; color: CanvasText; }
    .card { max-width: 520px; border: 1px solid color-mix(in srgb, CanvasText 16%, transparent); border-radius: 16px; padding: 18px; background: Canvas; }
    h2 { margin: 0 0 6px; font-size: 20px; }
    .hint { margin: 0 0 16px; color: color-mix(in srgb, CanvasText 65%, transparent); font-size: 14px; line-height: 1.5; }
    label { display: block; font-weight: 650; margin: 12px 0 6px; }
    input { box-sizing: border-box; width: 100%; padding: 11px 12px; border-radius: 10px; border: 1px solid color-mix(in srgb, CanvasText 22%, transparent); background: Field; color: FieldText; font: inherit; }
    .actions { display: flex; gap: 10px; margin-top: 16px; }
    button { appearance: none; border: 0; border-radius: 10px; padding: 10px 15px; font: inherit; font-weight: 700; cursor: pointer; }
    button.primary { background: #07c160; color: white; }
    button.secondary { background: color-mix(in srgb, CanvasText 10%, transparent); color: CanvasText; }
    button:disabled { opacity: .55; cursor: wait; }
    #status { margin-top: 14px; padding: 10px 12px; border-radius: 10px; background: color-mix(in srgb, CanvasText 6%, transparent); font-size: 14px; line-height: 1.5; }
    #status[data-kind="success"] { background: color-mix(in srgb, #07c160 14%, transparent); }
    #status[data-kind="error"] { background: color-mix(in srgb, #d93025 12%, transparent); }
    .privacy { margin-top: 12px; font-size: 12px; color: color-mix(in srgb, CanvasText 55%, transparent); }
  </style>
</head>
<body>
  <section class="card">
    <h2>设置公众号账号</h2>
    <p class="hint">填写公众平台“基本配置”页里的 AppID 和 AppSecret。点击后会先向微信验证，通过后才保存。</p>
    <form id="form">
      <label for="appid">AppID</label>
      <input id="appid" name="appid" autocomplete="off" placeholder="wx 开头，共 18 位" required />
      <label for="secret">AppSecret</label>
      <input id="secret" name="secret" type="password" autocomplete="new-password" placeholder="32 位" required />
      <div class="actions">
        <button class="primary" id="save" type="submit">保存并验证</button>
        <button class="secondary" id="check" type="button">检查当前配置</button>
      </div>
    </form>
    <div id="status" aria-live="polite">等待录入。</div>
    <div class="privacy">密码框不会回显；工具返回结果只包含验证状态，不包含 AppSecret。</div>
  </section>
  <script>
    const form = document.getElementById("form");
    const appid = document.getElementById("appid");
    const secret = document.getElementById("secret");
    const save = document.getElementById("save");
    const check = document.getElementById("check");
    const status = document.getElementById("status");
    const pending = new Map();
    let requestId = 1;

    function show(text, kind = "") {
      status.textContent = text;
      status.dataset.kind = kind;
    }

    function callTool(name, arguments_) {
      if (window.openai?.callTool) return window.openai.callTool(name, arguments_);
      const id = requestId++;
      window.parent.postMessage({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: arguments_ } }, "*");
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    }

    function resultData(result) {
      return result?.structuredContent || result?.result?.structuredContent || result?.content?.structuredContent || {};
    }

    function applyInitial(data) {
      if (data?.appid && !appid.value) appid.value = data.appid;
      if (data?.configured) show("当前已配置 " + (data.appid || "公众号账号") + "。可直接检查，或录入新凭据替换。");
    }

    window.addEventListener("message", (event) => {
      if (event.source !== window.parent) return;
      const message = event.data;
      if (!message || message.jsonrpc !== "2.0") return;
      if (message.id !== undefined && pending.has(message.id)) {
        const item = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) item.reject(message.error); else item.resolve(message.result);
        return;
      }
      if (message.method === "ui/notifications/tool-result") {
        applyInitial(message.params?.structuredContent);
      }
    }, { passive: true });

    applyInitial(window.openai?.toolOutput);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      save.disabled = true;
      show("正在向微信验证…");
      try {
        const result = await callTool("save_wechat_credentials", { appid: appid.value.trim(), appsecret: secret.value.trim() });
        secret.value = "";
        const data = resultData(result);
        if (data.status === "verified") show("验证成功，已保存 " + data.appid + "。以后新 Session 会读取这组凭据。", "success");
        else if (data.status === "needs_ip") show("凭据尚未保存。请先把 IP " + (data.ip || "（未识别）") + " 加入公众号白名单，再重试。", "error");
        else show(data.message || "验证失败，请检查后重试。", "error");
      } catch (error) {
        secret.value = "";
        show("设置失败：" + (error?.message || String(error)), "error");
      } finally {
        save.disabled = false;
      }
    });

    check.addEventListener("click", async () => {
      check.disabled = true;
      show("正在检查当前配置…");
      try {
        const result = await callTool("verify_saved_wechat_credentials", {});
        const data = resultData(result);
        if (data.status === "verified") show("当前配置可用：" + data.appid, "success");
        else if (data.status === "needs_ip") show("IP 白名单未通过，请加入：" + (data.ip || "（未识别）"), "error");
        else show(data.message || "当前配置不可用。", "error");
      } catch (error) {
        show("检查失败：" + (error?.message || String(error)), "error");
      } finally {
        check.disabled = false;
      }
    });
  </script>
</body>
</html>`;

server.registerResource("wechat-credential-form", TEMPLATE_URI, {}, async () => ({
  contents: [
    {
      uri: TEMPLATE_URI,
      mimeType: "text/html;profile=mcp-app",
      text: widgetHtml,
      _meta: { ui: { prefersBorder: true } },
    },
  ],
}));

server.registerTool(
  "open_wechat_setup",
  {
    title: "打开公众号账号设置",
    description: "在 Desktop 中打开公众号 AppID 与 AppSecret 的引导式设置表单。",
    inputSchema: {},
    outputSchema: {
      configured: z.boolean(),
      appid: z.string(),
      verifiedAt: z.string().nullable(),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: {
      ui: { resourceUri: TEMPLATE_URI },
      "openai/toolInvocation/invoking": "正在打开公众号设置…",
      "openai/toolInvocation/invoked": "公众号设置已打开",
    },
  },
  async () => {
    const snapshot = publicStatus();
    return {
      structuredContent: snapshot,
      content: [{ type: "text", text: "公众号账号设置表单已打开。" }],
    };
  }
);

server.registerTool(
  "save_wechat_credentials",
  {
    title: "保存并验证公众号凭据",
    description: "仅供设置界面调用：验证公众号凭据，通过后写入本机安全配置。",
    inputSchema: {
      appid: z.string().regex(/^wx[0-9a-fA-F]{16}$/, "AppID 应为 wx 开头的 18 位字符串"),
      appsecret: z.string().regex(/^[0-9a-fA-F]{32}$/, "AppSecret 应为 32 位字符串"),
    },
    outputSchema: {
      status: z.enum(["verified", "needs_ip", "invalid", "error"]),
      appid: z.string(),
      ip: z.string().nullable(),
      message: z.string(),
      verifiedAt: z.string().nullable(),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true, idempotentHint: true },
    _meta: {
      ui: { visibility: ["app"] },
      "openai/visibility": "private",
      "openai/widgetAccessible": true,
      "openai/toolInvocation/invoking": "正在验证公众号凭据…",
      "openai/toolInvocation/invoked": "公众号凭据验证完成",
    },
  },
  async ({ appid, appsecret }) => {
    try {
      const data = await fetchToken(appid, appsecret);
      if (data.access_token) {
        writeVerifiedConfig(appid, appsecret);
        const verifiedAt = readConfig()?.verification?.verified_at || null;
        const result = { status: "verified", appid, ip: null, message: "凭据验证成功并已保存。", verifiedAt };
        return { structuredContent: result, content: [{ type: "text", text: "公众号凭据已验证并保存。" }] };
      }
      if (data.errcode === 40164) {
        const result = { status: "needs_ip", appid, ip: extractIp(data.errmsg), message: "请先加入 IP 白名单，再重新提交。", verifiedAt: null };
        return { structuredContent: result, content: [{ type: "text", text: "公众号 IP 白名单尚未通过。" }] };
      }
      if (data.errcode === 40125 || data.errcode === 40001) {
        const result = { status: "invalid", appid, ip: null, message: "AppID 与 AppSecret 不匹配或 Secret 已失效。", verifiedAt: null };
        return { structuredContent: result, content: [{ type: "text", text: "公众号凭据验证失败。" }] };
      }
      const result = { status: "error", appid, ip: null, message: `微信返回错误 ${data.errcode || "unknown"}：${data.errmsg || "未知错误"}`, verifiedAt: null };
      return { structuredContent: result, content: [{ type: "text", text: "微信接口返回错误。" }] };
    } catch (error) {
      const result = { status: "error", appid, ip: null, message: error?.message || String(error), verifiedAt: null };
      return { structuredContent: result, content: [{ type: "text", text: "公众号凭据验证发生错误。" }] };
    }
  }
);

server.registerTool(
  "verify_saved_wechat_credentials",
  {
    title: "检查当前公众号配置",
    description: "仅供设置界面调用：检查本机已保存的公众号凭据是否仍然可用。",
    inputSchema: {},
    outputSchema: {
      status: z.enum(["verified", "needs_ip", "invalid", "missing", "error"]),
      appid: z.string(),
      ip: z.string().nullable(),
      message: z.string(),
      verifiedAt: z.string().nullable(),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    _meta: {
      ui: { visibility: ["app"] },
      "openai/visibility": "private",
      "openai/widgetAccessible": true,
    },
  },
  async () => {
    const cfg = readConfig();
    const appid = cfg?.wechat?.appid || "";
    const appsecret = cfg?.wechat?.secret || "";
    if (!appid || !appsecret) {
      const result = { status: "missing", appid, ip: null, message: "还没有保存公众号凭据。", verifiedAt: null };
      return { structuredContent: result, content: [{ type: "text", text: "尚未配置公众号凭据。" }] };
    }
    try {
      const data = await fetchToken(appid, appsecret);
      if (data.access_token) {
        const verifiedAt = new Date().toISOString();
        cfg.verification = { verified_at: verifiedAt, appid, secret_fingerprint: secretFingerprint(appsecret) };
        fs.writeFileSync(CONFIG_PATH, yaml.dump(cfg, { lineWidth: -1 }), { mode: 0o600 });
        const result = { status: "verified", appid, ip: null, message: "当前配置可用。", verifiedAt };
        return { structuredContent: result, content: [{ type: "text", text: "当前公众号配置可用。" }] };
      }
      if (data.errcode === 40164) {
        const result = { status: "needs_ip", appid, ip: extractIp(data.errmsg), message: "IP 白名单未通过。", verifiedAt: null };
        return { structuredContent: result, content: [{ type: "text", text: "IP 白名单未通过。" }] };
      }
      const result = { status: "invalid", appid, ip: null, message: "当前 AppSecret 已失效，请重新录入。", verifiedAt: null };
      return { structuredContent: result, content: [{ type: "text", text: "当前公众号凭据已失效。" }] };
    } catch (error) {
      const result = { status: "error", appid, ip: null, message: error?.message || String(error), verifiedAt: null };
      return { structuredContent: result, content: [{ type: "text", text: "检查公众号配置失败。" }] };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
