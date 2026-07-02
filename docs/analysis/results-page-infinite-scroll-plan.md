# 结果页“无限下滑”改造方案

## 背景

当前结果页只请求一次 `GET /api/v1/search`，即便返回 `total=1496`，前端只展示第一页，缺少持续加载能力，造成“命中多但看不到”。

## 目标

- 结果页支持无限下滑（自动加载下一页）。
- 保持现有 `keyword` 搜索模式不变，不引入向量检索。
- 保持类型安全：分页参数全链路有明确类型约束。

## 现状链路

```mermaid
flowchart LR
  A[ResultsPage] --> B[searchUnified(query,type,mode)]
  B --> C[searchUnifiedService]
  C --> D[searchUnifiedRepo]
  D --> E[/api/v1/search]
  E --> F[返回第一页 items]
  F --> G[页面仅渲染一次]
```

## 改造链路

```mermaid
flowchart LR
  A[ResultsPage 初次加载] --> B[page=1&pageSize=12]
  B --> C[/api/v1/search mode=keyword]
  C --> D[渲染列表 + 记录 total]
  D --> E{是否还有更多}
  E -- 否 --> F[停止观察]
  E -- 是 --> G[IntersectionObserver 监听底部哨兵]
  G --> H[触发下一页请求 page+1]
  H --> I[append 合并去重]
  I --> E
```

## 实施步骤

1. 扩展 `searchUnified` API 链路，支持可选分页参数 `{ page, pageSize }`。
2. 结果页改为分页加载：
   - 首次请求 `page=1`；
   - 哨兵进入视口时自动请求 `page+1`；
   - 合并列表并按 `type+id+uri` 去重。
3. 新增/更新测试：
   - repository/service/v1Api 的分页参数透传测试；
   - 结果页“触底加载下一页”测试。
4. 运行测试与类型检查。

## 风险与防护

- 风险：IntersectionObserver 频繁触发导致重复请求。
  - 防护：加 `loadingMore`、`hasMore` 双重门闩。
- 风险：翻页结果重复。
  - 防护：前端追加时做 key 去重。
- 风险：参数扩展导致调用方破坏。
  - 防护：分页参数全为可选，保持向后兼容。

## TODO

- [x] API 链路支持分页参数透传。
- [x] 结果页实现无限下滑。
- [x] 完成分页相关单元/集成测试。
- [x] 运行类型检查与相关测试并通过。
