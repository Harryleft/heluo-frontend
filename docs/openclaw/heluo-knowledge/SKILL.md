# 河洛知识图谱 (Heluo Knowledge Graph)

## 技能描述

河洛知识图谱是一个中国历史文化知识库，包含历史人物、古籍、地点、诗词、概念等实体信息。
通过此技能，你可以搜索和查询这些历史文化遗产的详细信息。

## 功能列表

### 1. 统一搜索
搜索历史人物、古籍、地点、诗词、概念等各类实体。

### 2. 实体详情
获取特定实体的详细信息，包括：
- 人物详情（Person）：生平、籍贯、作品等
- 诗文详情（Poem）：内容、作者、创作背景等
- 图书详情（Book）：现代图书信息
- 地点详情（Place）：地理位置、历史沿革等
- 概念详情（Concept）：历史文化概念解释
- 古籍详情（AncientBook）：古籍文献、版本、卷册等

### 3. AI 问答
基于知识库进行智能问答，生成人物介绍等。

## 触发词

- 搜索河洛、查询河洛、河洛搜索
- 历史人物、古代人物、查询人物
- 古籍查询、古籍检索
- 诗词搜索、诗文查询
- 地点查询、历史地名
- 融合问答、智能问答

## API 端点

### 基础地址
```
http://localhost:9011
```

> 注：此地址供 WSL 内的 OpenClaw 访问使用，需要启用 WSL localhost 转发功能。

### 搜索接口

**GET /api/v1/search**

搜索知识库中的实体。

参数：
- `q` (string, 必填): 搜索关键词
- `mode` (string, 可选): 搜索模式，可选值 `keyword` | `vector` | `hybrid`，默认 `keyword`
- `page` (number, 可选): 页码，默认 1
- `limit` (number, 可选): 每页数量，默认 20

示例请求：
```
GET /api/v1/search?q=李白&mode=keyword&page=1&limit=10
```

响应格式：
```json
{
  "data": {
    "results": [
      {
        "uri": "string",
        "type": "Person|Poem|Book|Place|Concept|AncientBook",
        "label": "实体名称",
        "score": 1.0
      }
    ],
    "total": 100,
    "page": 1,
    "limit": 10
  }
}
```

### 详情接口

**GET /api/v1/persons/:id**
获取人物详情，包括生平、籍贯、作品等信息。

**GET /api/v1/persons/:id/poem-track**
获取人物诗文地理轨迹（创作地点的时空分布）。

**GET /api/v1/poems/:id**
获取诗文详情，包括内容、作者、创作背景等。

**GET /api/v1/books/:id**
获取图书详情。

**GET /api/v1/places/:id**
获取地点详情，包括地理位置、历史沿革等。

**GET /api/v1/concepts/:id**
获取概念详情。

**GET /api/v1/ancient-books/:id**
获取古籍详情，包括版本、卷册、全文等。

### AI 问答接口

**POST /api/v1/fusion/query**
融合问答（非流式），基于知识库进行智能问答。

请求体：
```json
{
  "query": "用户问题"
}
```

**POST /api/v1/fusion/stream**
融合问答流式响应（SSE），实时返回答案。

**POST /api/v1/persons/ai-intro**
生成人物 AI 介绍。

请求体：
```json
{
  "name": "人物姓名",
  "referredContents": ["资料片段1", "资料片段2"]
}
```

### 列表接口

**GET /api/v1/persons**
获取人物列表。

**GET /api/v1/poems**
获取诗文列表。

### 健康检查

**GET /api/v1/health**
检查后端服务健康状态。

## 使用示例

### 示例 1：搜索历史人物
用户：搜索李白
操作：调用 GET /api/v1/search?q=李白

### 示例 2：获取人物详情
用户：告诉我杜甫的详细信息
操作：
1. 先调用 GET /api/v1/search?q=杜甫 获取人物 ID
2. 再调用 GET /api/v1/persons/{id} 获取详情

### 示例 3：智能问答
用户：李白和杜甫有什么关系？
操作：调用 POST /api/v1/fusion/query 传入问题

### 示例 4：查询古籍
用户：查找《诗经》相关的古籍
操作：调用 GET /api/v1/search?q=诗经&mode=keyword

## 注意事项

1. API 基础地址需要根据实际部署环境调整
2. 如果后端服务未启动，请先运行 `node server/src/index.js` 启动服务（端口 9011）
3. 融合问答功能需要配置 LLM 服务才能正常工作
4. ID 参数通常为 URI 格式，需要进行 URL 编码

## 错误处理

当 API 返回错误时，响应格式为：
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": "详细信息"
  }
}
```

常见错误码：
- `INVALID_PARAMS`: 参数无效
- `NOT_FOUND`: 资源不存在
- `INTERNAL_ERROR`: 服务器内部错误
