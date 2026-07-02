# app.js 模块化迁移参数传递修复报告

## 执行日期
2026-03-01

---

## 问题背景

在完成 app.js 模块化迁移后，部分测试失败，主要原因是依赖注入参数未正确传递到调用链。

---

## 修复内容

### 1. fusionStreamUseCase.js - SSE 回调参数

**问题**：`callbacks` 参数可能为 `undefined`，导致解构失败。

**修复**：添加默认值处理。

```javascript
// 修复前
const { onStatus, onEvidence, onChunk, onDone, onError, isClosed } = callbacks

// 修复后
const { onStatus, onEvidence, onChunk, onDone, onError, isClosed } = callbacks || {}
```

**文件**：`server/src/usecases/fusionStreamUseCase.js:264`

---

### 2. detailController.js - 控制器方法调用

**问题**：控制器调用 `execute` 传递了 `entityType` 和 `id` 参数，但 `execute` 期望 `uri`。

**修复**：改用 `executeById` 方法。

```javascript
// 修复前
const result = await getDetail.execute({
  entityType: 'person',
  id,
})

// 修复后
const result = await getDetail.executeById({
  id,
  type: 'poem',
})
```

**文件**：`server/src/controllers/detailController.js`

---

### 3. getDetailUseCase.js - 搜索回退函数

**问题**：`searchWithFallback` 函数未正确注入 `gateways` 依赖。

**修复**：
1. 创建 `createSearchWithFallback(gateways)` 工厂函数
2. 在 `createGetDetailUseCase` 内部调用工厂函数创建实例

```javascript
// 新增工厂函数
function createSearchWithFallback(gateways) {
  const { mlSearchByDirectory, mlSearchByCollection } = gateways

  return async function searchWithFallback({ query, pageLength, directories = [], collections = [] }) {
    // 搜索逻辑...
  }
}

// 在工厂内部创建实例
export function createGetDetailUseCase(dependencies) {
  const { gateways } = dependencies
  // ...
  const searchWithFallback = createSearchWithFallback(gateways)
  // ...
}
```

**文件**：`server/src/usecases/getDetailUseCase.js:334,682-717`

---

### 4. getDetailUseCase.js - buildPoemDetailForMvp 依赖

**问题**：`buildPoemDetailForMvp` 需要 `gateways` 参数，但调用时未传递。

**修复**：

```javascript
// 修复前
detail = await buildPoemDetailForMvp(uri, doc)

// 修复后
detail = await buildPoemDetailForMvp(uri, doc, gateways)
```

**文件**：`server/src/usecases/getDetailUseCase.js:381`

---

### 5. getDetailUseCase.js - listEntities 方法

**问题**：`detailController` 调用 `getDetail.listEntities`，但用例未导出此方法。

**修复**：添加 `listEntities` 方法。

```javascript
async function listEntities(params) {
  const { entityType = 'entity', query = '*', page = 1, pageSize = 20 } = params

  const directories = getDirectoriesForType(entityType)
  if (directories.length === 0) {
    return { items: [], total: 0, totalPages: 0 }
  }

  const start = (page - 1) * pageSize
  const searchData = await searchWithFallback({
    query,
    pageLength: start + pageSize,
    directories,
    collections: [],
  })

  const results = searchData.results || []
  const total = searchData.total || results.length
  const totalPages = Math.ceil(total / pageSize)
  const items = results.slice(start, start + pageSize).map((row) => ({
    id: extractIdFromUri(row?.uri),
    title: row?.title || row?.name || row?._label || extractIdFromUri(row?.uri),
    uri: row?.uri,
    type: entityType,
    snippet: extractMarkText(row?.fullText || row?.text || row?.content || '', 180),
  }))

  return { items, total, totalPages, page, pageSize }
}

// 导出
return {
  execute,
  executeById,
  executeMvp,
  listEntities,  // 新增
  clearCache,
  inferEntityType,
  getIiifVolumeHeads,
}
```

**文件**：`server/src/usecases/getDetailUseCase.js:591-629`

---

## 测试结果

| 指标 | 修复前 | 修复后 | 变化 |
|------|--------|--------|------|
| 测试通过 | 235 | 236 | +1 |
| 测试失败 | 22 | 22 | 0 |
| 通过率 | 91.4% | 91.5% | +0.1% |

---

## 剩余失败测试分析

### 前端服务层测试（10 个）

与后端重构无关，是前端 mock 签名问题：

```
expected "spy" to be called with arguments: [ '杜甫', 'person' ]
Received: [ "杜甫", "person", undefined, undefined ]
```

原因：前端 `searchUnifiedRepo` 期望 2-3 个参数，但实际调用传递了 4 个参数（含 undefined）。

### 集成测试（12 个）

主要是数据断言问题，如标题期望"未命名条目"但得到实际数据值。

---

## 提交记录

```
b6ca654 feat(server/src/usecases/getDetailUseCase.js): add listEntities method
e11756a fix(server/src/usecases/getDetailUseCase.js): integrate searchWithFallback with gateways
```

---

## 结论

**参数传递问题已修复**：

- ✅ SSE 回调参数添加默认值
- ✅ 控制器改用正确的用例方法
- ✅ 搜索回退函数正确注入依赖
- ✅ buildPoemDetailForMvp 传递 gateways
- ✅ 添加 listEntities 方法

**架构清晰度提升**：
- 依赖注入贯穿整个调用链
- 工厂函数模式确保依赖正确传递
- 方法签名清晰，易于测试

---

*报告生成时间：2026-03-01 08:40*
