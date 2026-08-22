# 公众号草稿发布 skill

把 Markdown 文章排版成微信公众号图文，推送到**草稿箱**。

- 排版本地做（markdown-it + CSS 内联），文章内容不出本机
- 发布走微信官方接口，不经过 md2wechat.cn 之类的第三方排版站
- 只发草稿，最后点「发布」永远是人自己在后台点

## 用法

第一次用，在 Codex 对话里说：

> 设置我的公众号账号

Codex 会打开 AppID / AppSecret 录入框，向微信验证通过后才保存。不要让顾问编辑
配置文件。录入后再做自检：

```bash
cd .codex/skills/wechat-draft-publisher
node scripts/doctor.mjs           # 自检；缺什么它会说，包括 IP 白名单该填哪个地址
```

通了之后：

```bash
# 先看排版
node scripts/md2wx.mjs convert 文章.md --out 预览.html

# 再推草稿（封面必需）
node scripts/md2wx.mjs publish 文章.md --title "标题" --author "署名" --cover 封面.png
```

## 文档

- [SKILL.md](SKILL.md) — agent 读的完整流程
- [references/setup.md](references/setup.md) — 首次配置：凭据、IP 白名单
- [references/troubleshooting.md](references/troubleshooting.md) — 错误码速查

## 注意

AppSecret 等于公众号的钥匙。配置文件默认在 `~/.config/wechat-draft/config.yaml`，
由设置界面写入版本库之外。**这个项目是公开仓库，凭据一旦提交就等于公开，只能重置补救。**

需要 Node ≥ 18。依赖已装在 `node_modules/`（纯 JS，无原生模块），重装跑 `npm install`。
