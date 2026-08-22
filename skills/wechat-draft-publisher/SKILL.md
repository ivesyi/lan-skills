---
name: wechat-draft-publisher
description: 把 Markdown 文章排版成微信公众号图文并推送到公众号草稿箱。本地渲染 + 微信官方接口，不经过任何第三方排版服务。包含首次使用的凭据配置引导（AppID / AppSecret）、IP 白名单排查和连通性自检。当用户要发公众号、推公众号草稿、把文章排成公众号样式、预览公众号排版效果、或遇到公众号接口报错（40164 / 40125 等）时使用。只推送到草稿箱，从不代替用户群发。
---

# 公众号草稿发布

把一篇 Markdown 变成公众号后台草稿箱里排好版、配好图的图文。

排版在本地做（markdown-it 渲染 + CSS 内联），发布走微信官方接口
（`api.weixin.qq.com`）。不依赖 md2wechat.cn 之类的第三方排版站，文章内容不
出本机。

## 边界：只发草稿，不群发

这个 skill 的终点是**草稿箱**。它不会群发、不会推送给任何读者。最后那一下
「发布」永远由人在公众号后台自己点。

即使用户说「帮我发出去」，也只做到草稿，然后告诉他去后台点发布。不要去找
群发接口。

## 第一次用：先过配置这一关

**动手写文章之前，先确认链路是通的。** 排好半天版最后卡在凭据上，白费功夫。

```bash
# 本包目录 = 这份 SKILL.md 所在的目录（顾问机上通常是
# ~/lan-skills/skills/wechat-draft-publisher，被链接进 ~/.codex/skills/）。
# 不确定就先定位，别猜路径：
PUB=$(dirname "$(find ~/lan-skills ~/.codex/skills ~/.claude/skills \
      -maxdepth 3 -path '*wechat-draft-publisher/SKILL.md' 2>/dev/null | head -1)")
node "$PUB/scripts/doctor.mjs"
```

自检会逐项告诉你缺什么。三种结果：

| 输出 | 意思 | 怎么办 |
|---|---|---|
| 全部 ✅ | 链路通了 | 直接开始写文章 |
| 没找到配置文件 | 还没配凭据 | 见下面「配置凭据」 |
| 40164 / 40125 | 白名单或密钥的问题 | 自检里已经写了该做什么，照做 |

配置引导的完整版在 [references/setup.md](references/setup.md)，错误码速查在
[references/troubleshooting.md](references/troubleshooting.md)。

### 配置凭据

在 Codex Desktop 里调用随包安装的 `open_wechat_setup`，打开「设置公众号账号」
录入框。用户在界面里填写后点击「保存并验证」；只有微信验证通过才会替换本机
长期配置。**不要让顾问编辑 YAML，也不要把你的 AppID 当默认值。**

如果设置界面没有出现，先运行 `~/lan-skills/install.sh codex`，然后让用户新开一个
Codex 任务再试。非 Codex 客户端目前不提供顾问级凭据录入界面，不要退回手改配置。

引导用户去公众平台 `mp.weixin.qq.com`，左侧菜单最下面
「设置与开发 → 开发 → 基本配置」，那一页上取两样东西：

1. **开发者ID(AppID)** —— 直接复制。
2. **开发者密码(AppSecret)** —— 点「重置」，管理员扫码，新密码**只在弹出的
   那一刻显示一次**，关掉页面就再也看不到了。看到就立刻粘进录入框。

验证通过后，工具把凭据保存到本机 `~/.config/wechat-draft/config.yaml`（600
权限，在版本库之外）。后续任务从这里读取，不再依赖聊天记忆，也不会把
AppSecret 回显到对话里。

### IP 白名单

微信只接受白名单内的地址调接口。**不要让用户猜自己的 IP，也不要用
ipinfo.io / ipify 去查** —— 那些查到的可能是代理出口，跟微信看到的不是同一
个地址，填了也没用。

正确做法是直接跑自检，微信的报错里带着它看到的真实源地址，`doctor.mjs` 会
把它抠出来打印：

```
❌ IP 不在白名单（错误码 40164）
   微信看到这台机器的地址是：183.193.17.46
```

把这个地址填进「设置与开发 → 基本配置 → IP白名单」，编辑 → 填 → 确定 →
**保存**（会要管理员扫码，少扫一次等于没加）。

**加完不会立刻生效，微信那边大约要等 3 分钟。** 这一点很容易让人以为没加
上、反复重加。让它自己等：

```bash
node scripts/doctor.mjs --watch     # 每分钟重试，最多等 15 分钟
```

家用宽带的地址会变，一变就又是 40164，把新地址补进去即可（白名单能存多
个）。要一劳永逸就把发布挪到固定 IP 的机器上跑。

## 发一篇文章的流程

### 1. 写稿

Markdown。第一个 `#` 标题会成为默认文章标题。

公众号正文里**不要放外部链接**——微信会把它们变成不可点的纯文本。要引用来源
就在文末列出处，或者用「阅读原文」（`--source-url`）放唯一那个链接。

### 2. 先看排版，别直接发

```bash
node scripts/md2wx.mjs convert 文章.md --theme default --out 预览.html
```

生成的 HTML 在浏览器里就是公众号里的样子。给用户看这个，改到满意再发。

主题在 `themes/` 下，加一个同名 CSS 文件就是加一套主题，选择器以 `.wx-body`
为根。`node scripts/md2wx.mjs themes` 列出当前有哪些。

### 3. 准备封面

**封面是必需的**，微信的图文没封面创建不了。比例 2.35:1（例如 900×383）。

用户没给就问他要，或者用同目录的兄弟配图包生成一张——本包旁边有
`guizang-material-illustration`（知识图解、封面主视觉）和 `ian-illustrations`
（人物 IP 叙事插画），按内容性质选：要"讲清楚一个结构"用前者，要"IP 出场"
用后者。

### 4. 推草稿

```bash
node scripts/md2wx.mjs publish 文章.md \
  --title "标题" \
  --author "署名" \
  --digest "摘要，留空则微信自动取正文前 54 字" \
  --cover 封面.png \
  --source-url "https://…"     # 可选，「阅读原文」的链接
```

成功会返回 `media_id`。然后告诉用户去后台草稿箱看，重点确认两件事：**封面
缩略图在不在**、**正文里的图显示不显示**。

### 5. 收尾

告诉用户草稿已经在后台了，发不发由他决定。不要说「已发布」——没有发布。

## 两种形态：经典长文 / 图片消息（小绿书）

本包能推两种草稿，**开工前先确认走哪种**（字段、图片通道、内容形态都不一样，
详见 [`references/PLATFORM-LIMITS.md`](references/PLATFORM-LIMITS.md) 第五节）：

```bash
# 经典长文：Markdown → 内联样式 HTML → 图文草稿
node scripts/md2wx.mjs publish 文章.md --cover 封面.png

# 图片消息（小绿书）：一组 3:4 卡片 + 一段纯文本文案
node scripts/md2wx.mjs newspic 文案.md --images ./cards --dry-run   # 先看结构
node scripts/md2wx.mjs newspic 文案.md --images ./cards             # 再真推
```

图片消息这条的硬限制（接口层面，脚本会拦）：图 1~20 张、首张即封面、标题 ≤32 字、
正文纯文本、图必须是永久素材。**建议先跑 `--dry-run` 把结构给用户看一眼再推。**

### 第一次连通测试：复用内置小绿书素材

本包已经带了一张 3:4 测试图和固定文案。用户要求做首次草稿箱连通测试时，直接
复用，不要再调用画图工具：

```bash
node scripts/md2wx.mjs newspic assets/small-green-book-test/test-copy.md \
  --images test-card.png --dry-run
```

把预演结果给用户看；用户明确同意推测试草稿后，去掉 `--dry-run` 再执行。测试也
只到草稿箱。内置图只用于链路测试，不能冒充正式内容配图。

## 正文可用的版式写法

正文除了标准 Markdown（`##` 小标题、`>` 引用、`**加粗**`、`---` 分隔、有序列表），
还支持三种加强写法，转换时自动上样式：

```markdown
> [!tip] 提示内容        （另有 [!note] [!warning]）
> [!quote] 金句只留一句   （居中大字卡片，全文用一次）

图注：这张图在说什么      （小字居中灰；必须自成一段，前后留空行）
```

**版式与平台红线**：写样式前读 [`references/PLATFORM-LIMITS.md`](references/PLATFORM-LIMITS.md)
（微信官方规范的硬限制 + 暗色模式算法 + 本地实测结论）。转换完成后跑一次红线检查：

```bash
node scripts/lint-wx.mjs 生成的.html
```

它会扫官方点名的违规 CSS（`position:fixed`、`line-height:0`、写死 px 宽、自定义
字体栈等），并报一行「版式厚度」——小标题/引用/加粗/图注各几处。**ERROR 不为 0
不要推稿；厚度全是 0 说明正文写平了，回去补版式再来。**

## 这套东西在背后做了什么

微信对图文正文有两条硬规矩，排版必须绕开：

- **`<style>` 标签和 class 选择器会被剥掉。** 所以 CSS 必须内联到每一个元素
  上（用 `juice.inlineContent`）。在浏览器里好看不代表在微信里好看。
- **外链图片会被过滤。** 正文里的图必须先传到微信服务器换成
  `mmbiz.qpic.cn` 的地址（走 `media/uploadimg`）。

另外封面有单独要求：必须是**永久素材**才能当 `thumb_media_id`（走
`material/add_material`），跟正文图走的不是同一个接口。

`access_token` 有 2 小时有效期，脚本会缓存，不用每次重新取。

## 文件

- `scripts/doctor.mjs` — 配置引导 + 连通性自检（`--init` / `--watch`）
- `scripts/md2wx.mjs` — 主命令（convert / publish / token / themes）
- `scripts/convert.mjs` — Markdown → 内联样式的微信 HTML
- `scripts/wechat.mjs` — 微信官方接口客户端
- `scripts/config.mjs` — 配置查找与凭据校验
- `themes/*.css` — 排版主题
- `references/setup.md` — 首次配置的完整步骤
- `references/troubleshooting.md` — 错误码速查
- `assets/small-green-book-test/` — 首次连通测试用的固定图片和文案

依赖已经装在 `node_modules/`（纯 JS，无原生模块）。真要重装：在 skill 目录
跑 `npm install`。需要 Node ≥ 18。

## 机制与已发生问题

| 已发生的问题 | 防复发机制 | 落点 |
|---|---|---|
| 对话里明明给过凭据，后续任务却用了不一致的 AppID 或 AppSecret | 设置界面先向微信验证，成功后写入本机长期配置；后续任务只读这份配置，不依赖聊天记忆 | `lan-wechat-setup` 插件 / 配置凭据 |
| 顾问被要求打开 YAML，技术门槛过高 | Codex Desktop 对话内录入框；界面没出现先修复插件安装，不把手改文件当顾问降级方案 | 第一次用 / `wechat-credential-setup` |
| 每次做小绿书连通测试都先生成一张图，浪费时间且混淆故障来源 | 随包提供固定 3:4 测试图和文案，先验证发布链路，正式内容再生成新图 | 第一次连通测试 / `assets/small-green-book-test/` |
