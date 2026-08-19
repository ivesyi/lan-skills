#!/usr/bin/env bash
# lan-skills 一键安装：把本仓库的 skills 链接进本机 AI 工具的 skills 目录。
# 用法：bash install.sh            —— 自动检测已装的 AI 工具，全部安装
#       bash install.sh codex     —— 只装给 Codex（~/.codex/skills）
#       bash install.sh claude    —— 只装给 Claude Code（~/.claude/skills）
# 重复运行安全（幂等）。更新：在仓库目录 git pull 即可，无需重装。

set -euo pipefail
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILLS_SRC="$REPO_DIR/skills"

targets=()
case "${1:-auto}" in
  codex)  targets=("$HOME/.codex/skills") ;;
  claude) targets=("$HOME/.claude/skills") ;;
  auto)
    [ -d "$HOME/.codex" ]  && targets+=("$HOME/.codex/skills")
    [ -d "$HOME/.claude" ] && targets+=("$HOME/.claude/skills")
    ;;
  *) echo "用法: bash install.sh [codex|claude]"; exit 1 ;;
esac

if [ ${#targets[@]} -eq 0 ]; then
  echo "没检测到 Codex（~/.codex）或 Claude Code（~/.claude）。"
  echo "请先装好其中一个 AI 工具，或手动指定：bash install.sh codex / claude"
  exit 1
fi

count=0
for t in "${targets[@]}"; do
  mkdir -p "$t"
  for s in "$SKILLS_SRC"/*/; do
    name="$(basename "$s")"
    ln -sfn "${s%/}" "$t/$name"
    count=$((count+1))
  done
  echo "✓ 已安装到 $t（$(ls "$SKILLS_SRC" | wc -l | tr -d ' ') 个 skill）"
done

# wechat-draft-publisher 的排版脚本需要少量 node 依赖，装得快，这里顺手装上
if command -v npm >/dev/null 2>&1; then
  if [ -f "$SKILLS_SRC/wechat-draft-publisher/package.json" ]; then
    (cd "$SKILLS_SRC/wechat-draft-publisher" && npm install --silent >/dev/null 2>&1) \
      && echo "✓ 公众号排版工具依赖已装好" \
      || echo "△ 公众号排版工具依赖安装失败——第一次用它时让 AI 在该目录跑 npm install"
  fi
else
  echo "△ 本机没有 node/npm：公众号推草稿、封面套图渲染这两个功能会用到。"
  echo "  不装也能用其它 skill；需要时装 Node.js ≥18 后重跑本脚本。"
fi

echo
echo "全部装好。封面套图渲染（guizang-social-card-skill）依赖较大（含浏览器内核），"
echo "第一次用到它时 AI 会自动在该目录安装，不必现在处理。"
echo "下一步：打开 START-HERE-顾问.md 照着开工。"
