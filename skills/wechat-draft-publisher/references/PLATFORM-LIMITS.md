# 公众号正文的平台硬限制（写样式前必读）

公众号正文不是网页：`<style>` 标签和外链 CSS 进不去，样式必须**内联到每个元素**
（本包用 juice 做这件事），而且微信对标签和 CSS 属性有一套自己的限制与暗色模式
转换算法。下面分「官方明文」和「社区共识」两级——**官方的当红线，社区的当默认，
最终以真机粘贴结果为准**。

主要出处：
- 官方：[微信公众平台编辑器插件开发规范](https://developers.weixin.qq.com/doc/subscription/guide/product/plugin_spec.html)（下文标 §）
- 社区实践：mdnice 作者的[《和微信公众号编辑器战斗的日子》](https://product.mdnice.com/article/intro/battle-with-wechat/)、
  [135 编辑器暗黑模式适配指南](https://www.135editor.com/essences/4981.html)（2020，算法细节可能已变）
- 本包实测：见文末「本地实测结论」

## 一、官方明文的坑（当红线，`scripts/lint-wx.mjs` 会扫）

| 不要 | 后果 | 出处 |
|---|---|---|
| `line-height: 0` | 文字叠在一起 | §2.3 |
| 容器写死 `width: 586px` 这类 px 宽 | 大屏留白怪、小屏表现不一 | §2.4 |
| 容器 `height: 0` | 编辑器里看得见、手机上看不见 | §2.5 |
| `text-align: start / end` | iOS 18+ 与编辑器渲染不一致 | §2.6 |
| `caret-color: transparent` | 编辑光标消失，作者没法改稿 | §2.2 |
| `opacity: 0` + SVG 背景图 | 后台改不了图 | §2.1 |
| 用 `<pre>` 包普通段落 | 窄屏被截断（`<pre>` 只留给代码块） | §2.8 |
| `position: absolute / fixed / sticky`，或视觉顺序与 DOM 顺序不一致 | 暗色模式算法按 DOM 深度遍历，对不上就配错色 | §5.2.2 |
| 自定义 `font-family` | **官方不建议**：两套不同字体栈在 iOS 17+ 会让字号字距漂移 | §4 |
| 相同标签嵌套超过 15 层 | 超出部分被删除 | §3.1 |

官方默认字体栈（要写就写这个，本包 `themes/default.css` 已对齐）：

```
"mp-quote", "PingFang SC", system-ui, -apple-system, BlinkMacSystemFont,
"Helvetica Neue", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei",
Arial, sans-serif
```

官方还提供一个结构检测接口（本包**未实测**，需要时自行验证）：
`POST http://mp.weixin.qq.com/article-bin/verify_article_structure`，body `{"content": "<html>…"}`（§1）。

## 二、暗色模式（照官方算法反推，不是自己写 media query）

正文里没有地方挂 `@media (prefers-color-scheme: dark)`——**暗色是微信自己转换的**，
所以只能顺着它的算法写：

- 只有对比度不够或过于刺眼时它才改色，官方称尽量保留原色。
- **文字底下的渐变**会被压成纯色；纯装饰的渐变条（上面没字）会保留。§5.1.2
- 背景色写在容器上，别给每个文本节点各复制一份。
- **SVG 基本不参与转换** → 深色 SVG 在暗底上会看不见。
- `box-shadow` 会被反色（黑影变白影）→ 少用。
- 图片：不要用图片承载纯文字（暗色模式读不到图里的字，§5.3.1）；透明 PNG 上的
  黑字在暗底会看不见（§5.3.2）；白边图在暗底会露白框。
- 用低饱和色，避开纯 `#000` / `#fff`；半透明 `rgba()` 交给算法处理的结果不确定，
  **背景一律用 solid hex**。
- **发布前在微信里开一次暗色预览**——这一步不能省。

## 三、社区共识（当默认做法，非官方明令）

- 正文产出应是 `<section>…</section>` 片段，不带 `DOCTYPE/html/head/body`；
  多数实现用 `section` 而不是 `div`（被过滤概率更低）。class / id 复制进编辑器
  也会丢，别依赖。
- 原生 `<ul>/<ol>` 的样式会被微信重置——讲究的实现会改写成 `section` + 手写编号；
  本包目前直接用原生列表（简单文章够用，复杂排版再说）。
- 非 `mp.weixin.qq.com` 的外链会变成不可点的纯文字 → 要给链接就放「阅读原文」，
  或改成文末脚注。
- `display: grid`、CSS 变量、`@media`、`@keyframes` 在正文里都不要用。
- 图片最终要进微信 CDN（`mmbiz.qpic.cn`）；外链图床粘贴失败率高。

## 四、本地实测结论（本包，2026-08）

- **主题 CSS 一直支持小标题/引用/加粗/分隔线**，juice 能正确内联；出来像纯文本
  是因为**文章本身没写这些结构**（见 `../wechat-article/FIELD-NOTES.md` #9）。
- `enhanceLayout()` 的三种写法实测可用：`> [!tip]` / `> [!warning]` / `> [!note]`
  → 提示条；`> [!quote]` → 金句卡；`图注：xxx` → 图注小字。
- **图注必须自成一段（前后留空行）**：紧贴在 `<img>` 下一行会被 markdown 当成
  同一个 HTML 块吞掉，class 打不上。
- 中文图片文件名会被 markdown 图片语法百分号编码，导致推稿找不到图 → 图片
  文件名用 ASCII，正文用原生 `<img src="原始路径">`。

## 五、图片消息（民间叫「小绿书」）的接口限制

官方名称是**图片消息**，接口里是 `article_type: "newspic"`（官方文档里没有"小绿书"
这个词，那是运营圈的叫法）。它和经典长文是**两条不同的通道**，别混：

| | 经典长文 `news` | 图片消息 `newspic` |
|---|---|---|
| 正文 `content` | HTML（内联样式） | **纯文本**（另可夹商品标签；HTML 会被剥） |
| 图怎么进 | 正文 `<img>` 走 `media/uploadimg` 换 CDN 链接 | **必须走 `material/add_material` 拿永久 `media_id`** |
| 图片字段 | 无 | `image_info.image_list[].image_media_id`（字段名写成 `media_id` 会报 40007） |
| 张数 | 不限 | **1~20 张，首张即封面** |
| 封面 | `thumb_media_id` 必填 | **不传 `thumb_media_id`**，自动取首图 |
| 标题 | 接口 ≤32 字 | 接口 ≤32 字（后台编辑器能写更长，接口不行） |
| 可选裁剪 | `cover_info` 支持 `2.35_1`、`1_1` | `cover_info` 支持 `1_1`、`16_9`、`2.35_1`（**没有 `3_4`**） |

来源：[新增草稿接口](https://developers.weixin.qq.com/doc/subscription/api/draftbox/draftmanage/api_draft_add.html)、
[上传永久素材](https://developers.weixin.qq.com/doc/subscription/api/material/permanent/api_addmaterial.html)。

几条要留意的：

- **展示比例 3:4 是产品形态，不是接口字段**（常用 1080×1440）。接口不限上传像素比，
  也没有 3:4 的裁剪选项；列表/转发卡片是另外三种比例裁出来的，所以图上的字别贴边。
- **话题没有独立字段**：要带话题就写在正文末尾的 `#话题`，它就是普通文字。
  （所以正文转纯文本时不能把行首 `#` 当 markdown 标题吃掉——本包已按"井号后必须跟
  空格才算标题"处理。）
- 正文长度：官方那一格自己打架（一处写 2kb、一处写 2 万字符），**未能确认哪条对
  图片消息生效**；运营口径普遍说 1000 字上限。本包按 1000 字给警告，不硬拦。
- **建草稿**订阅号/服务号都能调；**API 发布**（`freepublish/submit`）按现行文档要
  企业主体已认证，2025-07 起个人主体与未认证账号的发布接口已被回收——所以图片
  消息同样**只做到草稿箱**，发布由人在后台点。
- 永久素材有配额（图文+图片共 10 万），一条图片消息最多吃掉 20 个，注意复用与清理。
