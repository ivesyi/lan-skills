#!/bin/sh
# lan-skills 幂等更新：装过没装过都能跑（create-or-update），本地改动无损。
# 用法：sh update.sh            —— 更新仓库 + 重刷全局安装
# 首次安装也可直接跑本脚本（等价于 clone + install）。
set -eu

REPO_URL="https://github.com/ivesyi/lan-skills.git"
DEST="$HOME/lan-skills"

if [ ! -d "$DEST/.git" ]; then
  echo "· 本机还没有 lan-skills，开始安装…"
  git clone "$REPO_URL" "$DEST"
else
  cd "$DEST"
  # 本地改动（通常是各 skill 的 FIELD-NOTES 翻车登记）先存起来，更新后再放回
  STASHED=0
  if [ -n "$(git status --porcelain)" ]; then
    git stash push -u -m "local-notes-$(date +%Y%m%d-%H%M%S)" >/dev/null
    STASHED=1
    echo "· 检测到本地记录（如翻车登记），已暂存，更新后自动放回"
  fi
  BEFORE=$(git rev-parse HEAD)
  git pull --ff-only
  AFTER=$(git rev-parse HEAD)
  if [ "$STASHED" = "1" ]; then
    if git stash pop >/dev/null 2>&1; then
      echo "· 本地记录已无损放回"
    else
      echo "△ 本地记录与更新有重叠（多半是 FIELD-NOTES 两头都加了内容）。"
      echo "  已保留在 git stash 里。请让 AI 执行：git stash show -p 查看后，"
      echo "  把两边内容都合并进对应文件（登记是追加型日志，两段都保留即可），"
      echo "  合并完 git stash drop。"
    fi
  fi
  if [ "$BEFORE" = "$AFTER" ]; then
    echo "· 已是最新版本"
  else
    echo "· 本次更新内容："
    git log --oneline "${BEFORE}..${AFTER}" | sed 's/^/    /'
  fi
fi

# 重刷安装（幂等；会把新增的 skill 也补上链接）
sh "$DEST/install.sh"
