---
name: lan-update
description: 更新 lan-skills 技能包（幂等 create-or-update，本地记录无损）。触发场景：用户说「更新技能包」「更新 skills」「更新手册」「升级 lan-skills」「有新版本吗」。没装过=安装，装过=拉最新并重刷链接；顾问设备上写过的翻车登记（FIELD-NOTES）不会丢。
---

# lan-update —— 技能包自更新

一句话把本机的 lan-skills 更到最新。**幂等**：装过没装过、重复跑多少遍
都安全；**无损**：本机记的翻车登记等本地内容不会被更新冲掉。

## 步骤

1. 跑更新脚本（它自带 clone-or-pull 判断，装没装过都能跑；Codex 上会同时安装或更新随包插件）：

   ```bash
   sh ~/lan-skills/update.sh 2>/dev/null || {
     git clone https://github.com/ivesyi/lan-skills.git ~/lan-skills \
       && sh ~/lan-skills/update.sh; }
   ```

2. **看脚本输出处理两种情况**：
   - 输出里有「本地记录与更新有重叠」→ 按提示合并：`git stash show -p`
     看暂存内容，把两边都并进对应文件（FIELD-NOTES 是追加型日志，
     **两段都保留**、按时间排即可），合并完 `git stash drop`。
   - 正常则记下"本次更新内容"那几行，待会讲给用户。
3. 确认输出里有「公众号账号设置界面已安装」（仅 Codex）。若插件安装失败，按
   输出修复后重跑，不要把“普通 skills 已链接”误报成全部安装成功。
4. **项目级安装的补链**：如果当前在某个项目里、且该项目 `.codex/skills/`
   下的技能是指向 `~/lan-skills` 的链接，则在项目根目录执行
   `sh ~/lan-skills/install.sh project`，把本次新增的技能也补上链接
   （已有链接会原样重建，无副作用）。不确定是不是链接就 `ls -la` 看一眼。
5. **向用户白话汇报**：更到了哪一版、更新了什么（把 git log 那几行翻成
   人话：哪个手册改了什么）、本地记录是否安好。不说 git 术语。

## 降级与异常

| 情况 | 处理 |
|---|---|
| 本机没有 git | 如实告诉用户：需要先装 git（macOS 终端跑一次 `xcode-select --install`），装好再说一遍"更新技能包" |
| clone/pull 报权限或 404 | 仓库是私有的，说明本机没有访问授权——告诉用户"联系维护者开通访问"，不要反复重试 |
| pull 报错非快进（本地历史分叉） | 停下告诉用户，不要强制覆盖——本地可能有维护者才能处置的改动 |

## 边界

- 只更新 `~/lan-skills` 与其链接，不碰用户的其它文件。
- Codex 上还会登记本仓库的插件源并安装 `lan-wechat-setup`；凭据仍只保存在用户
  本机 `~/.config/wechat-draft/`，不进入仓库。
- 永不 push、永不删除本地登记内容。

## 附录：机制 ↔ 失败模式映射表

| 失败模式 | 机制 | 落点 |
|---|---|---|
| 更新把顾问设备上的翻车登记冲掉 | stash 暂存→放回；冲突时"追加型日志两边都保留"合并规则 | update.sh / 步骤 2 |
| 装没装过要用户判断，报错劝退小白 | create-or-update 幂等入口（脚本自判） | update.sh / 步骤 1 |
| 插件只装在维护者电脑，顾问拿到仓库却没有录入界面 | 插件收进仓库 + 团队插件清单 + install 自动登记安装 | install.sh / `.agents/plugins/marketplace.json` |
| 更新后技能变了但插件仍是旧版 | update 末尾统一重跑 install，重装当前插件 | update.sh 末行 / 步骤 3 |
| 新增的 skill 更新后没被链接进 skills 目录 | 更新后强制重刷 install（幂等重建链接） | update.sh 末行 / 步骤 4 |
| 更新了什么用户不知道 | git log 摘要翻成白话汇报 | 步骤 5 |
