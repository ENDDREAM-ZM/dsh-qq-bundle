#!/usr/bin/env bash
# 仓库级安装脚本：把仓库里的插件逐个装进 DSH。
#
#   bash install.sh                     # 装全部（sing / image / voice）
#   bash install.sh dsh-qq-sing         # 只装一个
#   DSH_HOME=/root/.dsh DSH_PROFILE=web bash install.sh
#   bash install.sh --allow-no-agnes    # 没装 dsh-agnes-studio 也硬装生图（自建接口时用）
#
# 单个插件的安装细节（profile 机制：plugin-src + profile/package.json + node_modules 软链）
# 在各个插件目录的 install.sh 里，这里只负责批量调度和前置检查。
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PROFILE="${DSH_PROFILE:-web}"
PROFILE_DIR="$DSH_HOME/profiles/$PROFILE"
PLUGIN_SRC="$DSH_HOME/plugin-src"

ALL=()
for d in dsh-qq-sing dsh-qq-image dsh-qq-voice; do [ -f "$SRC/$d/lib/index.js" ] && ALL+=("$d"); done
[ "${#ALL[@]}" -gt 0 ] || { echo "这个目录里没有可安装的插件（缺 lib/index.js）" >&2; exit 1; }

PASS=()
TARGETS=()
for arg in "$@"; do
  case "$arg" in
    --*) PASS+=("$arg") ;;
    *)   TARGETS+=("$(basename "$arg")") ;;
  esac
done
[ "${#TARGETS[@]}" -gt 0 ] || TARGETS=("${ALL[@]}")

say() { printf '\033[36m%s\033[0m\n' "$*"; }

# ───────── 前置：装生图插件要求先有 dsh-agnes-studio ─────────
has_agnes() {
  local f
  for f in "$PROFILE_DIR/node_modules/dsh-agnes-studio/package.json" \
           "$DSH_HOME/node_modules/dsh-agnes-studio/package.json" \
           "$PLUGIN_SRC/dsh-agnes-studio/package.json"; do
    [ -f "$f" ] && return 0
  done
  grep -rqs "dsh-agnes-studio" "$DSH_HOME"/profiles/*/package.json 2>/dev/null && return 0
  command -v npm >/dev/null 2>&1 && npm ls -g --depth=0 2>/dev/null | grep -q "dsh-agnes-studio" && return 0
  return 1
}

NEED_IMAGE=0
for t in "${TARGETS[@]}"; do [ "$t" = "dsh-qq-image" ] && NEED_IMAGE=1; done
ALLOW_NO_AGNES=0
for p in ${PASS[@]+"${PASS[@]}"}; do [ "$p" = "--allow-no-agnes" ] && ALLOW_NO_AGNES=1; done

if [ "$NEED_IMAGE" = "1" ] && ! has_agnes; then
  if [ "$ALLOW_NO_AGNES" = "1" ]; then
    say "没检测到 dsh-agnes-studio，但按 --allow-no-agnes 继续（稍后要自己填 apiBaseUrl + apiKey）"
  else
    cat >&2 <<'MSG'
  ┌──────────────────────────────────────────────────────────────┐
  │ 安装已取消：dsh-qq-image 需要先安装 dsh-agnes-studio          │
  └──────────────────────────────────────────────────────────────┘
  生图 / 生视频能力由 dsh-agnes-studio 提供，dsh-qq-image 只负责把 QQ 消息翻译成调用。
  apiKey 需通过 https://agnes-ai.cn/ 注册后获取，装完填到插件设置里。

  先装它：
      npm install -g dsh-agnes-studio
  确认已登记进 profile：
      grep dsh-agnes-studio "$DSH_HOME/profiles/"*/package.json

  只装点歌 / 语音（不需要 agnes）：
      bash install.sh dsh-qq-sing dsh-qq-voice

  自己有 OpenAI 兼容服务（POST /images/generations、POST /videos、GET /videos/{id}）：
      bash install.sh --allow-no-agnes

MSG
    exit 1
  fi
fi

for t in "${TARGETS[@]}"; do
  if [ ! -f "$SRC/$t/install.sh" ]; then
    echo "跳过 $t：找不到 $SRC/$t/install.sh" >&2
    continue
  fi
  say "── 安装 $t"
  bash "$SRC/$t/install.sh" ${PASS[@]+"${PASS[@]}"}
done

say "全部完成。别忘了重启 DSH（patchReload=startup）。"
