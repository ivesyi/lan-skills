# 小红书视觉卡片规范

## 轮播脚本

在未生成图片前，使用以下字段设计每页：

| 页码 | 页面类型 | 页面标题/短句 | 核心画面 | 辅助信息 | 中文标注 | 版式要点 |
| --- | --- | --- | --- | --- | --- | --- |

页面类型可选封面、痛点、判断、方法、对比、清单、总结或行动。核心画面必须是具体可画的对象、场景或关系，不只写抽象概念。

## 3:4 图片提示词骨架

```text
Generate one complete 3:4 vertical Xiaohongshu visual card.

Create a white-background, curated editorial hand-drawn information card. Make it rich enough to explain the point at a glance, while keeping visible whitespace and a clear reading order.

Page title: {短标题}
Core visual anchor: {清单、流程、对比、工具台或具体物件}
Supporting information: {2–4 组关键词、步骤、例子或标注}
Chinese labels: {短标题、关键词和少量批注}

No people, avatars, mascots, cartoon figures, or human faces. Place the title and main visual at the highest visual priority. Use short, mobile-readable Chinese text. Do not make a one-line poster, dense worksheet, generic motivational image, or a page where every label and card has equal weight.
```

## 信息层级

- 每页只有一个核心画面锚点。
- 辅助信息通常为 2–4 组，只解释主视觉，不与其竞争。
- 第一眼看标题和主视觉，第二眼看关键对象与关系，停留后再读标注。
- 允许箭头、便签、小卡片、关键词、步骤和对比，但不要把每个元素都加边框、标签和高亮。
- 保留可见白色呼吸感；避免四个以上同等权重的小面板和底部固定口号条。

## 验收清单

- 是完整 3:4 竖图，白色背景。
- 页面标题、核心画面与文章观点一致。
- 有一个视觉锚点及少量辅助信息，主次与阅读顺序明确。
- 没有人物、头像、吉祥物、卡通形象或人脸，除非用户已经提供并授权使用其素材。
- 文字短、清楚，适合手机端扫读。
- 既不是空白背景上的单句海报，也不是塞满组件的信息墙。
- 最终图片来自内置 `image_gen` 的位图输出。
