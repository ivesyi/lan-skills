import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testHome = fs.mkdtempSync(path.join(os.tmpdir(), "lan-wechat-setup-smoke-"));
const child = spawn(process.execPath, [path.join(root, "mcp", "server.mjs")], {
  cwd: root,
  env: { ...process.env, HOME: testHome },
  stdio: ["pipe", "pipe", "pipe"],
});

let buffer = "";
let nextId = 1;
const pending = new Map();

child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  buffer += chunk;
  while (true) {
    const index = buffer.indexOf("\n");
    if (index < 0) break;
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    const message = JSON.parse(line);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  }
});

function request(method, params = {}) {
  const id = nextId++;
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  return new Promise((resolve) => pending.set(id, resolve));
}

const init = await request("initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "smoke", version: "0.1.0" },
});
if (!init.result?.serverInfo) throw new Error("MCP initialize failed");
child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n");

const tools = await request("tools/list");
const names = tools.result?.tools?.map((tool) => tool.name).sort() || [];
for (const required of ["open_wechat_setup", "save_wechat_credentials", "verify_saved_wechat_credentials"]) {
  if (!names.includes(required)) throw new Error(`Missing tool: ${required}`);
}
const saveTool = tools.result?.tools?.find((tool) => tool.name === "save_wechat_credentials");
if (JSON.stringify(saveTool?._meta?.ui?.visibility) !== JSON.stringify(["app"])) {
  throw new Error("Credential save tool must be app-only");
}

const resources = await request("resources/list");
const uiUri = "ui://lan-wechat-setup/credentials.html";
if (!resources.result?.resources?.some((resource) => resource.uri === uiUri)) {
  throw new Error("Missing credential UI resource");
}
const ui = await request("resources/read", { uri: uiUri });
const uiContent = ui.result?.contents?.[0];
if (uiContent?.mimeType !== "text/html;profile=mcp-app" || !uiContent?.text?.includes('type="password"')) {
  throw new Error("Credential UI is not a password form MCP App");
}

const rendered = await request("tools/call", { name: "open_wechat_setup", arguments: {} });
if (!rendered.result?.structuredContent) throw new Error("Render tool returned no structuredContent");

const verified = await request("tools/call", { name: "verify_saved_wechat_credentials", arguments: {} });
if (verified.result?.structuredContent?.status !== "missing") {
  throw new Error(`Cold-start status should be missing: ${JSON.stringify(verified.result?.structuredContent)}`);
}

console.log(JSON.stringify({ ok: true, tools: names, ui: uiUri, passwordInput: true, coldStartStatus: "missing" }, null, 2));
child.kill("SIGTERM");
fs.rmSync(testHome, { recursive: true, force: true });
