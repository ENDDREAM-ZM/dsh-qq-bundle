<div align="center">

# DSH QQ 三件套

**点歌 / 生图 / 语音 · 三个独立插件，一个仓库装齐（也可以只装其中一个）**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![DSH](https://img.shields.io/badge/DSH-%E2%89%A5%200.1-8A2BE2)
![OneBot](https://img.shields.io/badge/OneBot-v11-00A1D6)
![Node](https://img.shields.io/badge/Node-%E2%89%A5%2020-339933)
![点歌](https://img.shields.io/badge/%E7%82%B9%E6%AD%8C-%E2%9C%93-31C27C)
![生图](https://img.shields.io/badge/%E7%94%9F%E5%9B%BE-%E2%9C%93-FF6F61)
![语音](https://img.shields.io/badge/%E8%AF%AD%E9%9F%B3-%E2%9C%93-FF4081)

</div>

> 本仓库是**安装总入口**：一键装齐三个插件，也可以按名字只装一个。
>
> 单插件仓库：[dsh-qq-sing](https://github.com/ENDDREAM-ZM/dsh-qq-sing) · [dsh-qq-image](https://github.com/ENDDREAM-ZM/dsh-qq-image) · [dsh-qq-voice](https://github.com/ENDDREAM-ZM/dsh-qq-voice)

---

给 DSH（DeepSeek Harness）用的三个**独立** QQ 机器人插件：群里说一句话就点歌、出图、发语音。
三个插件互不依赖，可以只装其中一个。

| 插件 | 干什么 | 群里怎么说 |
|---|---|---|
| [`dsh-qq-sing`](dsh-qq-sing/README.md) | 三平台搜歌 → 列表选歌 → 发语音条/文件 | `点歌 晴天` |
| [`dsh-qq-image`](dsh-qq-image/README.md) | 文生图 / 小说封面 / 文生视频 | `画一只在雨里跑的柯基` · `给《深海余生》做个封面` |
| [`dsh-qq-voice`](dsh-qq-voice/README.md) | Edge TTS 说话，支持 9 种方言/语言 | `用粤语说 得闲饮茶` |

---

## 它和普通 skill 有什么不一样

普通 skill 是「把工具丢给模型，让模型自己决定要不要用」——工具一多模型就懒得用，
而且每次都要走一遍模型推理，慢且不稳定。

这三个插件走的是**确定性指令通道**：插件自己接 OneBot 的 WebSocket，
用正则认出指令就直接执行、直接回消息，完全不经过模型。所以：

- **必达**：说了「点歌」就一定点，不看模型心情；
- **快**：省掉一次模型往返；
- **不打扰**：认不出来的消息原样留给模型，它照常聊天。

---

## 环境要求

- **DSH**：0.1 以上（在 `0.2.1-rc.2` 上实测）；插件对宿主 API 做运行时探测，缺 `dsh-tools` / `schemastery` 会自动降级。
- **Node.js**：≥ 20（用到内置 `fetch` / `WebSocket`，无第三方依赖）。
- **一个 OneBot v11 实现**，并且开了 **HTTP API** 和 **正向 WebSocket**：NapCat / Lagrange.OneBot / LLOneBot / SnowLuma / go-cqhttp 都可以，常见端口 HTTP 3000、WS 3001。

### 协议与框架兼容

只做 **OneBot v11** 一种协议（不接 Satori、不接 QQ 官方 API）。各实现的差异全部在代码里做了兜底：

| 差异点 | 各家情况 | 插件怎么处理 |
|---|---|---|
| token 传法 | SnowLuma 认 `Authorization: Bearer`；NapCat / Lagrange / LLOneBot / go-cqhttp 认 `?access_token=` | HTTP 两种都试，401/403 自动换 |
| HTTP / WS 用两个 token | SnowLuma 是 `httpAccessToken` 与 `accessToken` 两个 | `onebotToken` + `onebotWsToken`，任何一个能通就行 |
| WS 路径 | `/`、`/ws`、`/api/ws`、`/onebot/v11/ws` 都有 | 连不上自动逐个试 |
| `selfId` | 忘了填就认不出 @ 和自己发的消息 | 留空自动 `get_login_info` 获取 |
| 语音条 | 上游没装 silk 转码会拒 `record` | 失败自动改发文件 |
| 实现识别 | — | 连上后打一行 `OneBot 实现：<名字> <版本>` |

实测状态：**SnowLuma 2.1.1-node** 真机跑通（QQ 号收发、语音条、图片、文件）；其余四个按同一套 OneBot v11 协议做兼容，未逐个真机验证，遇到问题看日志那行「OneBot 实现：…」贴给我。
- **语音插件额外要**：Python 3 + `pip install edge-tts`。
- **生图插件额外要**：先装 **`dsh-agnes-studio`**（生图/生视频能力由它提供）；apiKey 需通过 <https://agnes-ai.cn/> 注册后获取。没装的话 `install.sh` 会直接取消安装；`dsh-qq-image/README.md` 里有说明和跳过办法。

---

## 安装

> ⚠️ 装 `dsh-qq-image` 之前先装 `dsh-agnes-studio`，否则 `install.sh` 会取消安装（自建 OpenAI 兼容服务可加 `--allow-no-agnes` 跳过）。

### 方式一：脚本（推荐）

```bash
# 只装一个
bash dsh-qq-sing/install.sh

# 或者三个都装
for p in dsh-qq-sing dsh-qq-image dsh-qq-voice; do bash $p/install.sh; done
```

脚本做四件事：把插件拷到 `$DSH_HOME/plugin-src/<name>` → 建 `node_modules/@deepseek-ai/*` 软链 →
改 profile 的 `package.json`（`dsh.profile.bundles` + `dependencies["<name>"]="link:<dir>"`）→
在 `cordis.patch.yml` 末尾追加一份配置模板。

### 方式二：手动

插件能不能被 DSH 加载，取决于下面三处**同时**成立：

```jsonc
// /root/.dsh/profiles/web/package.json
{
  "dependencies": { "dsh-qq-sing": "link:/root/.dsh/plugin-src/dsh-qq-sing" },
  "dsh": { "profile": { "bundles": ["dsh-qq-sing"] } }
}
```

```bash
# 还要在 node_modules 里有同名软链
ln -sfn ../../../plugin-src/dsh-qq-sing /root/.dsh/profiles/web/node_modules/dsh-qq-sing
```

> 注意：`/root/.dsh/builtin-plugins.json` **不是**第三方插件的入口（那是内置插件的签名清单，写进去会被忽略）。

装完在 `cordis.patch.yml` 里填配置，然后**重启 DSH**（`patchReload: startup`）。
日志里出现 `[dsh-qq-sing] 点歌插件就绪…` 就算活了。

### 卸载

```bash
bash dsh-qq-sing/uninstall.sh
```

---

## 配置（三个插件共有的部分）

```yaml
# /root/.dsh/profiles/web/cordis.patch.yml
- id: dsh-qq-sing
  name: dsh-qq-sing
  config:
    onebotHttpUrl: http://127.0.0.1:3000
    onebotWsUrl: ws://127.0.0.1:3001
    onebotToken: ""        # HTTP 用的 token
    onebotWsToken: ""      # WS 用的 token；留空 = 与 onebotToken 相同
    selfId: ""             # 机器人自己的 QQ 号
```

> **两个 token 的情况**：SnowLuma 这类实现的 HTTP 和 WS 用的是**两个不同的** token
> （HTTP = `httpAccessToken`，WS = `accessToken`）。只填一个时日志会刷
> `OneBot WebSocket 被拒（多半是 token 不对）`，表现为「机器人在线但收不到消息」。
> 其它实现只有一个 token，`onebotWsToken` 留空即可。

各插件自己的字段见对应 README。

---

## 点歌：会员歌要先登录

三个平台的登录态都是 cookie，插件面板只能填字符串，所以仓库里带了个扫码小工具：

```bash
cd dsh-qq-sing

node tools/login.mjs --platform qq            # QQ 音乐（QQ 扫码）
node tools/login.mjs --platform qq --wechat   # QQ 音乐（微信扫码）
node tools/login.mjs --platform kugou         # 酷狗音乐
node tools/login.mjs --platform netease       # 网易云音乐（需 npm i qrcode）
```

脚本把二维码存成 PNG（加 `--serve` 会起个本地 http 方便手机扫），扫完直接打印 cookie 串，
复制到插件设置里即可：`qqMusicCookie` / `kugouCookie` / `neteaseCookie`。

不登录也能用：能搜、能放**免费歌**，会员歌会如实提示「这首歌需要会员」。

---

## 常见问题

**1. 机器人在线，但说什么都没反应**
先看 OneBot 日志有没有 `rejected unauthorized WebSocket upgrade` → 填 `onebotWsToken`（见上）。

**2. 群里 @ 它才理，不 @ 没反应**
点歌默认要求 @（怕吵），不 @ 也响应就设 `allowGroupWithoutAt: true`。
生图同理：`requireAtInGroup: false`。

**3. 生图报「没配」/ 401**
填 `apiBaseUrl` + `apiKey`（任何 OpenAI 兼容的 `/images/generations` 服务都行），
或者用环境变量 `AGNES_API_BASE_URL` / `AGNES_API_KEY`。

**4. 语音没声音 / 报 edge-tts 找不到**
`pip install edge-tts`，并把 `edgePython` 指向装了它的解释器（默认 `python3`）。
Edge 挂了插件会自动退到百度 / 有道免费 TTS。

**5. 换了 DSH 版本，工具全报错**
跑一下契约测试，它用**真实**的 `defineTool` 校验每个工具的 `output.render`：

```bash
node contract-test.mjs     # render 合法 N / 非法 0
node smoke-test.mjs        # 假 OneBot 服务，13 项全绿
```

---

## 目录

```
.
├── install.sh / uninstall.sh     # 三个一起装 / 卸
├── contract-test.mjs             # 用真 defineTool 校验工具契约
├── smoke-test.mjs                # 假 OneBot 跑一遍业务逻辑
├── compat-report.mjs             # 打印走了哪条兼容降级路径
├── dsh-qq-sing/                  # 点歌（QQ音乐 / 酷狗 / 网易云）
│   ├── lib/{index,onebot,qqmusic,kugou,netease}.js
│   └── tools/login.mjs           # 扫码拿 cookie
├── dsh-qq-image/                 # 生图 / 封面 / 视频
└── dsh-qq-voice/                 # Edge TTS 语音
```

---

## 许可与免责

MIT，仅供个人学习与自用。

插件里的音乐接口都是各平台**未公开的内部接口**，随时可能失效；登录 cookie 属于你自己的账号，
请自行承担使用风险，不要用于商业分发或大规模抓取。

---

## 免责声明

> [!WARNING]
> 本插件通过**非官方接口**访问 QQ，**可能违反腾讯服务条款并导致封号**。请使用**小号**测试。

| 风险 | 说明 |
|---|---|
| 账号 | 可能被限制、封禁或永久封号 |
| 数据 | 封号可能导致好友、群聊、记录不可恢复 |
| 接口 | 上游接口随时变更，功能可能突然失效 |
| 隐私 | 聊天内容会发送给你自行配置的模型服务商 |

**禁止用途**：违法违规、垃圾信息群发、诈骗骚扰、自动化养号、绕过腾讯安全风控、
大规模抓取他人数据、商业代挂代刷、侵犯他人隐私与著作权。

完整条款（含责任限制、合规检查清单、卸载方法）见 **[DISCLAIMER.md](DISCLAIMER.md)**。
