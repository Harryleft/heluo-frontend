# 古籍详情页直接内嵌 Mirador 与 303 Manifest 修正方案

## 问题背景
- 当前古籍详情页的 IIIF 区块虽然已经能打开查看器，但内嵌链路仍然是“详情页 -> `/mirador` 页面 -> Mirador 本体”，不符合“只嵌入 Mirador 浏览器本体”的目标。
- `杜诗捃` 当前使用的 `/iiif/manifests/303/manifest.json` 已不再是标准 IIIF Presentation Manifest，而是一份文本-图像对齐中间数据。
- `303` 的 `collection.json` 已经指向真正可用的 IIIF Manifest：
  `http://localhost:8083/iiif/manifests/ancientBook/303/17270_303/manifest.json`

## 目标范围
1. 修正 `杜诗捃` 等同类场景使用错误 manifest 的问题。
2. 将古籍详情页嵌入区块改为直接挂载 Mirador 本体，不再嵌套整个查看器页面。
3. 不处理页面视觉微调，容器尺寸和样式由后续人工继续调整。

## 现状链路
```mermaid
flowchart TD
  A[AncientBookDetailsPage] --> B[IIIFSection]
  B --> C[/mirador?manifest=...]
  C --> D[IiifPage]
  D --> E[Mirador.viewer]

  F[/iiif/manifests/303/manifest.json] --> G[非 IIIF 标准 Manifest]
  H[/iiif/manifests/303/collection.json] --> I[真正 Manifest URL]
```

## 核心判断
- `303` 问题不是单纯路径失效，而是“短路径 manifest 文件类型已变化”。
- 需要在前端查看器链路中增加“实际 manifest 解析”步骤：
  - 若原始 manifest 已是标准 IIIF Manifest，则直接使用。
  - 若原始 manifest 不是标准 IIIF Manifest，则回退读取同路径 `collection.json`，取 `items[0].id` 作为实际 Manifest。
- 内嵌 Mirador 应直接发生在 `IIIFSection` 内部，而不是通过 iframe 再加载 `/mirador` 页面。

## 设计方案
```mermaid
flowchart TD
  A[IIIFSection] --> B[resolveIiifManifest]
  B --> C{manifest 是否标准 IIIF}
  C -->|是| D[直接返回 manifest URL]
  C -->|否| E[读取 collection.json]
  E --> F[取 items[0].id]
  D --> G[直接挂载 Mirador.viewer]
  F --> G
```

## 实施要点
- 新增独立的 manifest 解析工具，统一处理：
  - 原始 manifest URL 规范化
  - 标准 IIIF Manifest 判定
  - collection 回退解析
- `IIIFSection`
  - 内嵌模式下直接挂载 Mirador 本体
  - 卷次定位接口使用解析后的真实 manifest URL
  - “新窗口打开 Mirador”也透传真实 manifest URL
- `IiifPage`
  - 继续保留为独立页面入口，但内部同样使用真实 manifest 解析逻辑

## 风险与边界
- 若 `collection.json` 不存在或 `items[0].id` 缺失，则仍需回退到原始 manifest URL，并向用户显示加载失败。
- 动态导入 `mirador` 后需在组件卸载时清空挂载容器，避免重复实例残留。
- 不在本次处理样式细节和版式优化。

## TODO
1. 新增 manifest 解析工具。
2. 修改详情页内嵌区块，直接挂载 Mirador。
3. 修改独立 `/mirador` 页面，共用解析逻辑。
4. 增加针对 `303 collection -> real manifest` 的测试。
5. 运行相关测试与构建验证。
