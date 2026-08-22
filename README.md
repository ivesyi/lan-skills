# lan-skills

教育陪跑业务的 Agent Skills 全家桶——装到任何一台有 Codex / Claude Code
的电脑上即可使用。Codex 还会自动安装公众号账号设置界面。给顾问的入门看
[START-HERE-顾问.md](START-HERE-顾问.md)。

## 安装

```bash
git clone https://github.com/ivesyi/lan-skills.git ~/lan-skills
cd ~/lan-skills && bash install.sh        # 自动检测 Codex / Claude Code
```

安装=更新，同一条命令（幂等）：`sh -c "$(curl -fsSL https://raw.githubusercontent.com/ivesyi/lan-skills/main/update.sh)"`，或 `sh ~/lan-skills/update.sh`，或直接对
装好技能的 AI 说「更新一下 lan-skills 技能包」（`lan-update` skill 接管：
clone-or-pull + 重刷链接 + 更新 Codex 插件 + 本地翻车登记无损保留 + 白话汇报变更）。
项目级安装：在项目根目录 `sh ~/lan-skills/install.sh project`（装进该
项目的 `.codex/skills/`）。

## Skills 一览

**业务主线**

| skill | 干什么 | 状态 |
|---|---|---|
| `diagnosis-report` | 学校材料 → 单校诊断报告（白话、可溯源到原书、证据不足弃权、不打分）。需在「教育工作台」仓库内使用（判断标准在该仓库 knowledge/ 里） | 未验收——顾问首跑即首次试跑 |
| `wechat-article` | 诊断报告/素材 → 匿名化公众号文章 + 配图（归藏封面 + 封面套图 + Ian 正文插画）→ 推草稿箱（不代发） | 同上 |
| `xhs-post` | 素材 → 小红书图文（3:4 卡片 + 文案）落飞书文档，可整段复制去发布（不做自动发布） | 同上 |
| `methodology-distill` | 一次活动的工作产物 → 候选方法论条目（只出候选，入库由人审；永不改动现有方法论库） | 同上 |

**meta**

| skill | 干什么 |
|---|---|
| `skill-forge` | "做 skill 的 skill"：业务语言访谈 → 失败模式驱动组装 → 真实案例冷启动试跑验收。本仓库的业务 skill 都由它的方法论产出 |

**依赖（配图与排版三件套 + 小红书卡片）**

| skill | 干什么 | 备注 |
|---|---|---|
| `ian-illustrations` | Ian 顾问 IP 正文叙事插画（16:9 二次元） | 含 IP 素材 |
| `guizang-material-illustration` | 归藏 3D 瑞士风：封面主视觉 / 知识图解 | |
| `guizang-social-card-skill` | 封面套图版式（公众号 21:9+1:1、小红书 3:4），HTML→PNG | 第三方，vendored 自 [op7418/guizang-social-card-skill](https://github.com/op7418/guizang-social-card-skill)；首次使用需在其目录 `npm install`（含 Playwright，较大） |
| `wechat-draft-publisher` | Markdown 排版 → 公众号草稿箱（只到草稿，不代发） | 需 Node ≥18，install.sh 会顺手装依赖 |
| `xhs-visual-cards` | 小红书 3:4 视觉卡片 | |

**Codex 专用插件**

| plugin | 干什么 | 安装方式 |
|---|---|---|
| `lan-wechat-setup` | 在对话中弹出 AppID / AppSecret 录入框，向微信验证通过后保存到本机 | `install.sh` 自动安装；顾问不需要自己找插件 |

## 交付前自检

```bash
node check-skills.mjs
```

机械地扫一遍：frontmatter 是否合法、name 与目录是否一致、引用的文件和兄弟包
是否真实存在、有没有别人机器上的绝对路径、有没有疑似密钥、脚本语法是否通过。
**ERROR 不为 0 不要交付。** 第三方 vendored 包（`guizang-*`）的缺件只报提醒。

## 纪律（全仓库通用）

- 业务 skill 均为**未验收交付**：第一次真实使用就是它的首次试跑，
  用出的问题登记进各 skill 的 `FIELD-NOTES.md`——翻车是 skill 变强的原料。
- 学校真实材料与人名永不入本仓库；各 skill 的工作产物落在业务仓库的
  `.local/`（gitignored）。
- 发布类动作（公众号/小红书）永远停在草稿/图文，发布由人点。

## 维护

由 skill-forge 的流程维护：改任何 skill 前先看它 SKILL.md 附录的
「机制 ↔ 失败模式映射表」（设计图纸），删机制前先弄清它防什么坑；
修复走「定位问题层 → 修 → 用原案例重新试跑」。
