# 古籍详情页 Mirador 本地化替换方案

## 问题概述
- 古籍详情页当前会把 IIIF manifest 交给 `http://localhost:8083/mirador`。
- 最新环境中，`/iiif/manifests/303/manifest.json` 与 `/iiif/manifests/304/manifest.json` 可访问，但 `http://localhost:8083/mirador` 返回 `404`。
- 结果是详情页中的 IIIF 区块仍然渲染，但 iframe 无法加载实际查看器。

## 现状链路
```mermaid
flowchart TD
  A[AncientBookDetailsPage] --> B[IIIFSection]
  B --> C[buildManifestUrl]
  C --> D[http://localhost:8083/iiif/manifests/{id}/manifest.json]
  B --> E[buildMiradorViewerUrl]
  E --> F[http://localhost:8083/mirador?manifest=...]
  F --> G[当前 404]
```

## 根因判断
- 问题不在 manifest 路径。
- 问题在前端把查看器入口硬编码为外部静态站点的 `/mirador`。
- 该外部站点当前仅保留集合浏览页与 IIIF 资源，不再提供 Mirador 查看器页面。

## 目标
1. 保持古籍详情页现有展示结构不变。
2. 保持 `manifest` 与 `canvas` 参数行为不变。
3. 去除对 `http://localhost:8083/mirador` 的依赖。
4. 改为使用项目内已安装的 `mirador` 包在前端本地渲染查看器。

## 设计方案
```mermaid
flowchart TD
  A[IIIFSection iframe] --> B[/mirador?manifest=...]
  B --> C[IiifPage]
  C --> D[Mirador.viewer]
  D --> E[直接加载 manifest URL]
```

## 实施要点
- `src/lib/config/iiif.ts`
  - 将查看器基址改为当前站点内的 `/mirador` 路由。
- `src/features/iiif/IiifPage.tsx`
  - 不再嵌套 iframe 指向外部 Mirador 页面。
  - 改为在本页挂载 Mirador 实例。
  - 继续保留页面标题与“新窗口打开”能力，避免交互习惯变化。
- 测试
  - 更新 IIIF URL 相关单测，确保查看器 URL 改为站内路由。

## 边界情况
- 未提供 `manifest` 时继续保留默认示例 manifest，避免空白页。
- 提供 `canvas` 时保持透传。
- 详情页嵌入模式下，外层 iframe 仍由 `IIIFSection` 控制尺寸与全屏，不改现有容器样式。

## TODO
1. 修改 IIIF URL 构建逻辑，查看器地址切换为站内 `/mirador`。
2. 修改 `IiifPage`，直接挂载 Mirador。
3. 更新 IIIF 配置测试。
4. 运行相关测试，确认古籍详情页嵌入效果不回归。
