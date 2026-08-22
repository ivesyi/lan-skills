#!/bin/sh
# lan-skills 一键安装：安装 skills，并在 Codex 中安装随包插件。
# 用法：sh install.sh            —— 自动检测已装的 AI 工具，全部安装
#       sh install.sh codex     —— 只装给 Codex（~/.codex/skills）
#       sh install.sh claude    —— 只装给 Claude Code（~/.claude/skills）
# 重复运行安全（幂等）。更新脚本会再次运行本文件，把插件也一起更新。
# 用 POSIX sh 写：macOS 自带 bash 3.2 / zsh / dash 都能跑。

set -eu
REPO_DIR=$(cd "$(dirname "$0")" && pwd)
SKILLS_SRC="$REPO_DIR/skills"
WECHAT_PLUGIN="$REPO_DIR/plugins/lan-wechat-setup"
MARKETPLACE_NAME="lan-skills"
PLUGIN_NAME="lan-wechat-setup"

mode="${1:-auto}"
targets=""
install_codex_plugin=0
case "$mode" in
  codex)  targets="$HOME/.codex/skills"; install_codex_plugin=1 ;;
  claude) targets="$HOME/.claude/skills" ;;
  project) targets="$PWD/.codex/skills" ;;   # 装进当前项目（在项目根目录下执行）
  auto)
    if [ -d "$HOME/.codex" ]; then
      targets="$targets $HOME/.codex/skills"
      install_codex_plugin=1
    fi
    [ -d "$HOME/.claude" ] && targets="$targets $HOME/.claude/skills"
    ;;
  *) echo "用法: sh install.sh [codex|claude|project]"; exit 1 ;;
esac

if [ -z "${targets# }" ]; then
  echo "没检测到 Codex（~/.codex）或 Claude Code（~/.claude）。"
  echo "请先装好其中一个 AI 工具，或手动指定：sh install.sh codex / claude"
  exit 1
fi

n=$(ls "$SKILLS_SRC" | wc -l | tr -d ' ')
for t in $targets; do
  mkdir -p "$t"
  for s in "$SKILLS_SRC"/*/; do
    name=$(basename "$s")
    ln -sfn "${s%/}" "$t/$name"
  done
  echo "✓ 已安装到 ${t} (${n} 个 skill)"
done

# 公众号排版工具和账号设置插件都需要少量 Node 依赖，这里一次装好。
if command -v npm >/dev/null 2>&1; then
  if [ -f "$SKILLS_SRC/wechat-draft-publisher/package.json" ]; then
    if (cd "$SKILLS_SRC/wechat-draft-publisher" && npm install --silent >/dev/null 2>&1); then
      echo "✓ 公众号排版工具依赖已装好"
    else
      echo "✗ 公众号排版工具依赖安装失败"
      echo "  请让 AI 检查网络后，在 $SKILLS_SRC/wechat-draft-publisher 运行 npm install"
      exit 1
    fi
  fi
  if [ "$install_codex_plugin" = "1" ] && [ -f "$WECHAT_PLUGIN/package.json" ]; then
    if (cd "$WECHAT_PLUGIN" && npm install --silent --omit=dev >/dev/null 2>&1); then
      echo "✓ 公众号账号设置插件依赖已装好"
    else
      echo "✗ 公众号账号设置插件依赖安装失败"
      echo "  请让 AI 检查网络后，在 $WECHAT_PLUGIN 运行 npm install"
      exit 1
    fi
  fi
else
  echo "✗ 本机没有 node/npm：公众号推草稿和账号设置界面无法安装。"
  echo "  请先安装 Node.js ≥18，再重跑本脚本。"
  exit 1
fi

# Codex Desktop 的公众号设置录入框由插件提供。仓库本身就是团队插件源；
# 首装时登记，后续重复运行则直接重装当前版本，避免用户手动找插件。
if [ "$install_codex_plugin" = "1" ]; then
  if ! command -v codex >/dev/null 2>&1; then
    echo "✗ 检测到 Codex 配置，但找不到 codex 命令，公众号设置界面尚未安装。"
    echo "  请在 Codex Desktop 里把这段输出交给 Agent 继续处理。"
    exit 1
  fi

  current_root=$(codex plugin marketplace list --json 2>/dev/null | node -e '
    let input = "";
    process.stdin.on("data", chunk => input += chunk);
    process.stdin.on("end", () => {
      try {
        const data = JSON.parse(input);
        const item = (data.marketplaces || []).find(x => x.name === process.argv[1]);
        process.stdout.write(item?.root || "");
      } catch {}
    });
  ' "$MARKETPLACE_NAME")

  if [ -n "$current_root" ] && [ "$current_root" != "$REPO_DIR" ]; then
    echo "· 公众号插件仍指向旧的技能包位置，正在修正…"
    codex plugin marketplace remove "$MARKETPLACE_NAME" >/dev/null 2>&1
    current_root=""
  fi
  if [ -z "$current_root" ]; then
    codex plugin marketplace add "$REPO_DIR" >/dev/null
    echo "✓ 已登记 lan-skills 插件源"
  fi

  if codex plugin add "$PLUGIN_NAME@$MARKETPLACE_NAME" >/dev/null; then
    echo "✓ 公众号账号设置界面已安装"
  else
    echo "✗ 公众号账号设置界面安装失败"
    echo "  请让 AI 执行：codex plugin add $PLUGIN_NAME@$MARKETPLACE_NAME"
    exit 1
  fi
fi

echo ""
echo "全部装好。封面套图渲染（guizang-social-card-skill）依赖较大（含浏览器内核），"
echo "第一次用到它时 AI 会自动在该目录安装，不必现在处理。"
if [ "$install_codex_plugin" = "1" ]; then
  echo "下一步：关闭当前任务，新开一个 Codex 任务，再照 START-HERE-顾问.md 开工。"
else
  echo "下一步：打开 START-HERE-顾问.md 照着开工。"
fi
