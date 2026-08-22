#!/usr/bin/env node
/**
 * 配置与连通性自检。发布前的第一道关。
 *
 *   node scripts/doctor.mjs          自检一次
 *   node scripts/doctor.mjs --init   无界面环境的开发者降级入口
 *   node scripts/doctor.mjs --watch  反复重试，直到白名单生效（微信约 3 分钟延迟）
 *
 * 最有用的一点：当 IP 不在白名单时，微信的报错里带着它看到的**真实源 IP**。
 * 本脚本把它解析出来直接告诉你该填哪个地址 —— 不用猜，也不要用
 * ipinfo/ipify 之类的服务去查，那些查到的可能是代理出口，跟微信看到的不是
 * 同一个。
 */
import fs from "node:fs";
import {
  CONFIG_PATH,
  configExists,
  loadConfig,
  requireCredentials,
  writeConfigTemplate,
  resolveConfigPath,
  TOKEN_CACHE_PATH,
} from "./config.mjs";

const args = process.argv.slice(2);
const has = (f) => args.includes(f);

const OK = "✅";
const NO = "❌";
const WARN = "⚠️ ";
const DOT = "·";

function line(s = "") {
  console.log(s);
}

/** 从微信 40164 报错里抠出它看到的源 IP */
function extractIp(errmsg = "") {
  const m = errmsg.match(/invalid ip ((?:\d{1,3}\.){3}\d{1,3})/i);
  return m ? m[1] : null;
}

async function fetchToken(appid, secret) {
  const url =
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential` +
    `&appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  return res.json();
}

function reportInit() {
  const { path: p, created } = writeConfigTemplate();
  line();
  line(created ? `${OK} 已创建配置文件：${p}` : `${DOT} 配置文件已存在：${p}`);
  line();
  line(`${WARN}这是无界面环境的开发者降级入口，不是顾问默认流程。`);
  line("   Codex Desktop 用户请回到对话说：设置我的公众号账号");
  line();
  line("如果确实要在服务器等无界面环境手动配置，再做三件事：");
  line();
  line("  1. 打开公众平台 mp.weixin.qq.com，左侧菜单最下面");
  line("     「设置与开发 → 开发 → 基本配置」");
  line();
  line("  2. 那一页上有两样东西，都填进上面这个文件：");
  line("     · 开发者ID(AppID)   —— 直接复制");
  line("     · 开发者密码(AppSecret) —— 点「重置」，扫码确认，");
  line("       新密码只在弹出的那一刻显示一次，关掉就再也看不到了，");
  line("       所以看到就立刻粘进配置文件。");
  line();
  line("  3. 填完回来跑一次自检：node scripts/doctor.mjs");
  line("     它会告诉你 IP 白名单该填哪个地址。");
  line();
  line(`${WARN}这个文件里的 AppSecret 等于公众号的钥匙，不要提交进任何仓库、`);
  line("   不要贴进聊天窗口。它默认放在版本库之外。");
  line();
}

async function main() {
  if (has("--init") || has("init")) {
    reportInit();
    return;
  }

  line();
  line("公众号发布链路自检");
  line("─".repeat(48));

  // 1. 配置文件
  const { path: p, scope } = resolveConfigPath();
  if (!configExists()) {
    line(`${NO} 没找到配置文件`);
    line(`   期望位置：${p}`);
    line();
    line("   回到 Codex 对话说：设置我的公众号账号");
    line("   如果设置界面没出现，让 Agent 运行 ~/lan-skills/install.sh codex，");
    line("   然后新开一个 Codex 任务再试。");
    line();
    process.exit(1);
  }
  line(`${OK} 配置文件：${p}（${scope}）`);

  let cfg, appid, secret;
  try {
    cfg = loadConfig();
    ({ appid, secret } = requireCredentials(cfg));
  } catch (e) {
    line(`${NO} ${e.message}`);
    line();
    process.exit(1);
  }
  line(`${OK} AppID：${appid}`);
  line(`${OK} AppSecret：已填写（${secret.length} 位，不回显）`);

  // 2. 连通性 + token
  const maxRounds = has("--watch") ? 15 : 1;
  for (let round = 1; round <= maxRounds; round++) {
    let data;
    try {
      data = await fetchToken(appid, secret);
    } catch (e) {
      line(`${NO} 连不上 api.weixin.qq.com：${e.message}`);
      line("   检查这台机器的网络能不能出去。");
      line();
      process.exit(1);
    }

    if (data.access_token) {
      line(`${OK} 拿到 access_token —— 整条链路通了`);
      line();
      line("   可以发草稿了：");
      line("   node scripts/md2wx.mjs publish 文章.md --title \"标题\" --cover 封面.png");
      line();
      return;
    }

    const ip = extractIp(data.errmsg);
    if (data.errcode === 40164) {
      if (round === 1) {
        line(`${NO} IP 不在白名单（错误码 40164）`);
        line();
        line(`   微信看到这台机器的地址是：${ip || "（没能解析出来，见下方原始报错）"}`);
        line();
        line("   把它加进白名单：公众平台 →「设置与开发 → 基本配置」→");
        line("   往下滚到「IP白名单」→ 编辑 → 填进去 → 确定 → 保存（会要管理员扫码）。");
        line();
        line(`   ${WARN}加完不会马上生效，微信那边大概要等 3 分钟左右。`);
        line("   别以为没加上就反复重加 —— 用 --watch 让它自己等：");
        line("   node scripts/doctor.mjs --watch");
        line();
        line(`   ${WARN}只认这个地址。不要用 ipinfo.io / ipify 之类查到的 IP，`);
        line("   那查到的可能是代理出口，跟微信看到的不是一个。");
        line();
        line("   家用宽带的地址会变，一变就又是 40164，届时把新地址补进去即可");
        line("   （白名单能存多个）。要一劳永逸就把发布放到固定 IP 的服务器上跑。");
        line();
      }
      if (round < maxRounds) {
        process.stdout.write(`   ${DOT} 第 ${round} 次重试仍未生效，60 秒后再试…\r`);
        await new Promise((r) => setTimeout(r, 60000));
        continue;
      }
      if (maxRounds > 1) line(`\n${NO} 等了 ${maxRounds} 分钟仍未生效。`);
      line("   到这一步还不通，多半是这三种情况之一：");
      line("     · 白名单加到别的号上了 —— 核对那一页的 AppID 是不是 " + appid);
      line("     · 「确定」之后没点最外层的「保存」，或者管理员扫码没走完");
      line("     · 填的地址不是上面那个");
      line();
      process.exit(1);
    }

    if (data.errcode === 40125 || data.errcode === 40001) {
      line(`${NO} AppSecret 不对（错误码 ${data.errcode}）`);
      line();
      line("   常见原因：当初抄漏了，或者后来在后台重置过 —— 一旦重置，旧的立刻作废。");
      line("   微信的 AppSecret 只在生成那一刻显示一次，没法回去看，只能重新生成：");
      line("   「设置与开发 → 基本配置 → 开发者密码(AppSecret) → 重置」，");
      line(`   扫码确认后立刻把新密码粘进 ${p}`);
      line();
      line(`   ${WARN}重置会让旧密码立刻失效。如果还有别的系统在用这个公众号的接口，`);
      line("   它们会一起挂掉，记得同步换。");
      line();
      process.exit(1);
    }

    line(`${NO} 微信返回错误 errcode=${data.errcode} errmsg=${data.errmsg}`);
    line("   对照 references/troubleshooting.md 查这个码。");
    line();
    process.exit(1);
  }
}

main().catch((e) => {
  line(`${NO} ${e.message}`);
  process.exit(1);
});
