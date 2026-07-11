# Heluo API v1 运行契约

> 状态：当前实现
> 最后核验：2026-07-10

本文只记录当前可运行的 HTTP 边界。路由实现以 `server/src/routes/` 为准，前端数据类型以 `src/types/contracts/apiContracts.ts` 为准，不保留已删除的 `/api/mvp/*` 兼容口径。

## 基础地址

本地 Node API 默认监听：

```text
http://127.0.0.1:9011
```

业务接口统一使用 `/api/v1` 前缀。健康检查、统计和 IIIF 资源端点因既有部署边界保留独立路径。

## 当前端点

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/health` | Node API 与 MarkLogic 健康状态 |
| `GET` | `/stats/entity-counts` | 各类实体数量 |
| `GET` | `/api/v1/search` | 统一搜索，支持 `keyword`、`vector`、`hybrid` |
| `GET` | `/api/v1/persons` | 人物列表 |
| `GET` | `/api/v1/persons/:id` | 人物详情 |
| `GET` | `/api/v1/persons/:id/poem-track` | 人物诗文地理轨迹 |
| `GET` | `/api/v1/poems` | 诗文列表 |
| `GET` | `/api/v1/poems/:id` | 诗文详情 |
| `GET` | `/api/v1/books/:id` | 图书详情 |
| `GET` | `/api/v1/places/:id` | 地点详情 |
| `GET` | `/api/v1/concepts/:id` | 概念详情 |
| `GET` | `/api/v1/ancient-books/:id` | 古籍详情 |
| `POST` | `/api/v1/fusion/query` | 非流式融合问答 |
| `POST` | `/api/v1/fusion/stream` | SSE 流式融合问答 |
| `GET` | `/api/v1/iiif/volume-heads` | 古籍卷首 Canvas 列表 |
| `GET` | `/api/v1/vector/status` | 向量服务只读状态 |
| `GET` | `/api/v1/vector/cache` | Embedding 缓存统计 |

`DELETE /api/v1/vector/cache` 和 `POST /api/v1/vector/test` 仅在 `VECTOR_DEBUG_ENABLED=true` 时开放，不能作为生产业务接口依赖。

IIIF Manifest、Collection、Image 与 Search 资源由 `server/src/routes/iiifRoutes.js` 暴露在 `/iiif/*` 下。

## 通用响应

标准成功响应：

```json
{
  "success": true,
  "data": {}
}
```

标准错误响应：

```json
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMS",
    "message": "参数错误"
  }
}
```

当前错误码定义在 `src/types/contracts/apiContracts.ts`：`INVALID_PARAMS`、`NOT_FOUND`、`INTERNAL_ERROR`、`UPSTREAM_ERROR`、`RATE_LIMIT_EXCEEDED`。

## 搜索参数

`GET /api/v1/search` 的核心参数：

| 参数 | 必填 | 说明 |
|---|---|---|
| `q` | 是 | 查询文本；`*` 表示列表式查询 |
| `type` | 否 | `person`、`poem`、`book`、`ancient_book`、`place`、`concept` |
| `mode` | 否 | `keyword`、`vector`、`hybrid` |
| `page` | 否 | 从 1 开始 |
| `pageSize` | 否 | 每页数量 |

示例：

```text
GET /api/v1/search?q=苏轼&type=person&mode=hybrid&page=1&pageSize=20
```

## 数据与坐标约定

- API 返回的实体 URI 使用 `/processed/json-ld/*` 当前命名。
- 向量检索结果必须保留可回溯的实体 URI，前端详情统一进入 `/details?uri=...`。
- 人物轨迹字段、去重规则和 WGS84 经纬度顺序见 [`person-poem-track-contract.md`](person-poem-track-contract.md)。
- 前端不得直接依赖 MarkLogic collection 名称；collection 映射属于服务端和数据导入层。

## 变更检查

修改接口时必须同时更新并验证：

1. `server/src/routes/` 与对应 controller/use case。
2. `src/types/contracts/apiContracts.ts` 或专项契约文件。
3. `src/lib/api/repositories/v1Repository.ts` 与服务层。
4. `tests/server/api/` 的集成契约测试。
5. 本文；人物轨迹变更还要更新专项契约。

最小验收命令：

```bash
npm test
npm run typescript
npm run docs:check
npm run smoke
```
