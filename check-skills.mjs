#!/usr/bin/env node
/**
 * lan-skills 交付前自检：把人眼容易漏的机械问题一次扫掉。
 * 用法：node check-skills.mjs
 * 退出码：0 = 无 ERROR；1 = 有 ERROR（不要交付）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SKILLS = path.join(ROOT, "skills");
const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

const dirs = fs
  .readdirSync(SKILLS)
  .filter((d) => fs.statSync(path.join(SKILLS, d)).isDirectory());

for (const name of dirs) {
  const dir = path.join(SKILLS, name);
  const skillFile = path.join(dir, "SKILL.md");

  // 1. SKILL.md 必须存在且 frontmatter 合法
  if (!fs.existsSync(skillFile)) {
    err(`${name}: 缺 SKILL.md`);
    continue;
  }
  const text = fs.readFileSync(skillFile, "utf8");
  const lines = text.split("\n");
  if (lines[0] !== "---") err(`${name}: SKILL.md 第一行不是 ---`);
  const nameLine = lines.find((l) => l.startsWith("name:"));
  const descLine = lines.find((l) => l.startsWith("description:"));
  if (!nameLine) err(`${name}: frontmatter 缺 name`);
  else if (nameLine.slice(5).trim() !== name)
    err(`${name}: frontmatter name「${nameLine.slice(5).trim()}」与目录名不一致`);
  if (!descLine) err(`${name}: frontmatter 缺 description`);
  else if (descLine.length < 40) warn(`${name}: description 过短，冷启动可能选不中`);

  // 2. 引用的本包文件必须存在
  // 注意：只查"本包自己的"相对引用。`../别的包/...` 由下面第 3 条查；
  // skill-forge 是造 skill 的 skill，它文里的 references/CRAFT.md 说的是
  // **产出包**该有的文件，不是它自己的，所以豁免。
  const vendoredPkg = name.startsWith("guizang-");
  if (name !== "skill-forge") {
    const refs = [...text.matchAll(/(^|[^\/.\w])`((?:references|templates|scripts|assets)\/[^`\s]+)`/gm)];
    for (const m of refs) {
      const rel = m[2];
      if (rel.includes("*") || rel.includes("<")) continue; // 通配/占位不查
      if (fs.existsSync(path.join(dir, rel))) continue;
      // 第三方 vendored 包的缺件不是我们的账，降为提醒
      (vendoredPkg ? warn : err)(`${name}: 引用了不存在的文件 ${rel}`);
    }
  }

  // 3. 兄弟包引用必须能解析（同目录安装的前提）
  for (const m of text.matchAll(/`\.\.\/([a-z0-9-]+)\//g)) {
    if (!dirs.includes(m[1])) err(`${name}: 引用了不存在的兄弟包 ../${m[1]}/`);
  }

  // 4. 不许出现别人机器上的绝对家目录路径（顾问机上必然失效）
  for (const m of text.matchAll(/\/Users\/([A-Za-z0-9_.-]+)\//g)) {
    if (m[1] !== "yihu") warn(`${name}: 出现他人家目录路径 /Users/${m[1]}/（换机器会失效）`);
  }

  // 5. 密钥模式
  if (/wx[0-9a-f]{16}/.test(text)) err(`${name}: SKILL.md 里出现疑似真实 AppID`);
  if (/\b[0-9a-f]{32}\b/.test(text.replace(/[0-9a-f]{40}/g, ""))) {
    warn(`${name}: 出现 32 位十六进制串，确认不是 AppSecret`);
  }

  // 6. 自有 skill 应带翻车登记（第三方 vendored 包豁免）
  const vendored = name.startsWith("guizang-");
  if (!vendored && !fs.existsSync(path.join(dir, "FIELD-NOTES.md")))
    warn(`${name}: 没有 FIELD-NOTES.md（翻车登记）`);
}

// 7. 脚本语法检查（能跑的才算数）
const scripts = [];
for (const name of dirs) {
  const sdir = path.join(SKILLS, name, "scripts");
  if (!fs.existsSync(sdir)) continue;
  for (const f of fs.readdirSync(sdir)) if (f.endsWith(".mjs")) scripts.push(path.join(sdir, f));
}
for (const s of scripts) {
  try {
    execFileSync(process.execPath, ["--check", s], { stdio: "pipe" });
  } catch (e) {
    err(`${path.relative(ROOT, s)}: 语法错误 —— ${String(e.stderr || e).split("\n")[0]}`);
  }
}

// 8. 安装脚本存在且可读
for (const f of ["install.sh", "update.sh", "README.md", "START-HERE-顾问.md"]) {
  if (!fs.existsSync(path.join(ROOT, f))) err(`仓库根缺 ${f}`);
}

console.log(`扫了 ${dirs.length} 个 skill、${scripts.length} 个脚本\n`);
for (const w of warns) console.log(`⚠️  ${w}`);
for (const e of errors) console.log(`❌ ${e}`);
console.log(
  errors.length === 0
    ? `\n✅ 无 ERROR（WARN ${warns.length} 条，看一眼即可）`
    : `\n❌ ${errors.length} 条 ERROR，修完再交付`
);
process.exit(errors.length === 0 ? 0 : 1);
