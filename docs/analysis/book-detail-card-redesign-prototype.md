# 图书详情卡片重排原型（推荐资源）

## 目标
- 将右侧栏目从“相关资源”统一为“推荐资源”。
- 保持最小改动：不改数据来源，只改呈现结构与信息层级。
- 提升扫读效率：先看封面，再看可点击推荐列表。

## 原型图（线框）
```mermaid
graph TD
  Page[图书详情页] --> Main[左栏 主体内容]
  Page --> Side[右栏 侧边卡片]

  Side --> CoverCard[卡片A 图书封面]
  CoverCard --> CoverHeader[标题 图书封面]
  CoverCard --> CoverSub[副标题 基于 ISBN 外部公开信息]
  CoverCard --> CoverImg[封面图 3:4]
  CoverCard --> CoverTitle[书名]
  CoverCard --> CoverIsbn[ISBN]

  Side --> RecCard[卡片B 推荐资源]
  RecCard --> RecHeader[标题 推荐资源 + 数量]
  RecCard --> RecSub[副标题 向量语义推荐 支持点击]
  RecCard --> RecList[推荐列表 3-5 条]

  RecList --> Item1[序号 + 名称链接 + 类型标签]
  RecList --> Item2[序号 + 名称链接 + 类型标签]
  RecList --> ItemN[序号 + 名称链接 + 类型标签]
```

## 交互约定
- 推荐条目点击后，跳转到 `/details?uri=...`。
- 列表项显示：`序号`、`名称（可点击）`、`类型标签`。
- 空态文案：`暂无推荐资源`。
- 异常文案：`推荐资源加载失败，请稍后重试。`。

## 验收清单
- 页面出现“推荐资源”标题，不再出现“相关资源”。
- 图书详情右侧先展示封面卡，再展示推荐资源卡。
- 推荐列表每条都可点击跳转，且可看到名称。
- 移动端保持单列，不出现内容挤压。
