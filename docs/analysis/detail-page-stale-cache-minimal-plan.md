# 详情页返回体验最小优化方案

## 背景

当前详情页在 `uri` 变化或从其他页面返回时，会立即进入全屏 `loading` 状态，再重新请求详情数据。  
即使用户刚刚访问过同一个详情页，也不会先显示旧内容，因此体感上会出现“返回后还要重新等一遍”。

## 目标

用最小改动提升用户体验：

- 再次进入相同详情页时，优先显示上一次已加载成功的内容
- 后台继续请求最新数据
- 只有首次完全无缓存时，才显示全屏 `loading`

## 现状链路

```mermaid
flowchart LR
    A[/details?uri=...] --> B[useDetailPageViewModel]
    B --> C[useDetailData]
    C --> D[setPageState loading]
    D --> E[fetchDetailByResource]
    E --> F[setData]
    F --> G[parseDocSummary]
```

问题在于：

- `useDetailData` 没有前端缓存
- 每次重新进入详情页都先 `setPageState('loading')`
- 已有数据也会被新一轮加载态覆盖

## 最小方案

在 `useDetailData` 内增加一个模块级内存缓存，按 `uri + query` 存储：

- `data`
- `entitySummary`
- `entity`
- `externalUris`

行为规则：

| 场景 | 页面行为 |
| --- | --- |
| 首次访问，无缓存 | 保持现状，显示 `loading` |
| 再次访问，同一 `uri + query` 命中缓存 | 立即显示缓存内容，不切回全屏 `loading` |
| 命中缓存后后台请求成功 | 静默刷新页面数据 |
| 命中缓存后后台请求失败 | 保留旧数据，并可选择提示错误 |

## 边界

1. 缓存只做内存级，不做 localStorage  
原因：这次目标是最小实现，不引入持久化复杂度。

2. 只缓存成功结果  
错误态不缓存，避免把异常页面复用回来。

3. 键值包含 `query`  
避免同一 `uri` 在不同上下文下的摘要/链接状态串用。

## 实施步骤

| 步骤 | 文件 | 目标 |
| --- | --- | --- |
| 1 | `tests/features/details/useDetailDataLoadingFlow.test.tsx` | 增加缓存命中时不回全屏 loading 的测试 |
| 2 | `src/features/details/hooks/useDetailData.ts` | 增加模块级缓存与静默刷新逻辑 |
| 3 | `tests/features/details/*` | 回归关键详情加载流程 |

## 预期收益

- 返回详情页时，用户能立即看到旧内容
- 全屏加载闪烁明显减少
- 不需要引入新的状态管理库或复杂缓存框架
