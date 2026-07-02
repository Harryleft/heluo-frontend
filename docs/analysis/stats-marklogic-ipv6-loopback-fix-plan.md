# 首页典藏概览全为 0 的 MarkLogic IPv6 回环问题分析

## 1. 现象

- 首页“典藏概览”中人物、诗文、图书、古籍、地理、概念全部显示 `0`
- 服务端日志出现：
  - `Error in GET /stats/entity-counts: TypeError: fetch failed`
  - `connect EACCES ::1:8003`

## 2. 根因

统计接口 `/stats/entity-counts` 会调用 MarkLogic 检索接口。

当前 MarkLogic 基础地址默认值是：

- `http://localhost:8003`

在当前机器网络环境中，`localhost` 被优先解析为 IPv6 回环地址 `::1`。
但当前环境下访问 `::1:8003` 被拒绝，因此统计接口整体进入降级分支，返回全 0。

## 3. 链路

```mermaid
flowchart TD
  A[HomePageClassic 调用 fetchEntityCounts] --> B[/stats/entity-counts]
  B --> C[statsController 调用 mlSearchByDirectory]
  C --> D[marklogicGateway 使用 MARKLOGIC_BASE_URL]
  D --> E[localhost:8003 解析为 ::1:8003]
  E --> F[connect EACCES]
  F --> G[statsController 降级返回 0]
  G --> H[首页典藏概览全部显示 0]
```

## 4. 修复策略

1. 将默认 `MARKLOGIC_BASE_URL` 从 `http://localhost:8003` 改为 `http://127.0.0.1:8003`
2. 将 `.env.example` 中的示例值同步改为 `127.0.0.1`
3. 保留显式环境变量覆盖能力，已有自定义配置不受影响

## 5. 边界说明

- 如果用户已在环境变量中显式设置 `MARKLOGIC_BASE_URL`，仍以环境变量为准
- 本次修复只改默认值，不改业务统计逻辑
- 该修复不仅影响首页统计，也会影响其他依赖 MarkLogic 默认地址的服务端读取路径
