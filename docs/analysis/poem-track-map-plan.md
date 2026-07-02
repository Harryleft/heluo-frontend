# 人物诗文地理轨迹地图功能规划

> **文档版本**: v1.1 (评审修订版)
> **创建日期**: 2026-02-28
> **最后更新**: 2026-02-28
> **状态**: 规划中（待实施）

---

## 一、功能概述

### 1.1 背景

历史人物（如杜甫、李白）在不同地点创作了大量诗文，这些诗文包含了创作时间和地点信息。通过可视化展示人物的诗文创作者地理轨迹，可以帮助用户更好地理解人物的生平经历和创作历程。

### 1.2 目标

- 在人物详情页展示该人物所有诗文的地理分布
- 支持时间线动画，动态展示人物的创作轨迹
- 支持点击查看诗文详情
- 使用高德地图作为底图

### 1.3 用户故事

```
作为一个对中国古典文学感兴趣的用户，
我想要在地图上看到杜甫一生中在各地创作的诗文，
以便更直观地了解他的人生轨迹和创作历程。
```

---

## 二、数据模型

### 2.1 源数据结构

#### 诗文 JSON-LD
```json
{
  "_label": "雕赋",
  "classified_as": [{ "_label": "唐朝" }],
  "created_by": {
    "timespan": {
      "_label": "754年",
      "begin_of_the_begin": "0754-01-01T00:00:00Z",
      "end_of_the_end": "0754-12-31T23:59:59Z"
    },
    "carried_out_by": [
      { "_label": "杜甫", "id": "http://localhost:8003/person/17270" }
    ],
    "took_place_at": [
      { "_label": "西安市", "id": "http://localhost:8003/place/CN6101" }
    ]
  }
}
```

#### 地点 JSON-LD
```json
{
  "_label": "西安市",
  "defined_by": "POINT(108.946306 34.347436)",
  "attributed_by": [
    { "_label": "长安", "timespan": { "_label": "c. 202 BCE-581 CE" } }
  ]
}
```

### 2.2 数据提取路径

| 字段 | JSON-LD 路径 | 说明 |
|------|-------------|------|
| 诗文标题 | `_label` | 诗文名称 |
| 朝代 | `classified_as[0]._label` | 朝代信息 |
| 创作年份 | `created_by.timespan._label` | 如 "754年" |
| 精确时间 | `created_by.timespan.begin_of_the_begin` | ISO 格式 |
| 作者 | `created_by.carried_out_by[0]._label` | 人物名称 |
| 作者ID | `created_by.carried_out_by[0].id` | 人物 URI |
| 创作地点 | `created_by.took_place_at[0]._label` | 地点名称 |
| 地点ID | `created_by.took_place_at[0].id` | 地点 URI |
| 地点坐标 | Place 文档的 `defined_by` | WKT 格式 |

### 2.3 TypeScript 接口定义

```typescript
/**
 * 诗文轨迹点
 */
interface PoemTrackPoint {
  /** 年份（解析后的数字） */
  year: number
  /** 年份显示标签 */
  yearLabel: string
  /** 地点信息 */
  place: {
    uri: string
    label: string
    lat: number
    lng: number
    /** 历史地名（可选） */
    historicalNames?: Array<{
      name: string       // 历史名称，如"长安"
      period: string     // 历史时期，如"唐代"
    }>
  }
  /** 该地点/年份创作的诗文列表 */
  poems: Array<{
    id: string
    title: string
    uri: string
  }>
}

/**
 * 人物诗文地理轨迹
 */
interface PersonPoemTrack {
  /** 人物ID */
  personId: string
  /** 人物名称 */
  personName: string
  /** 生卒年 */
  lifespan: {
    birth: number | null
    death: number | null
    label: string
  }
  /** 朝代 */
  dynasty: string
  /** 轨迹点列表（按年份排序） */
  trackPoints: PoemTrackPoint[]
  /** 无时间信息的诗文（附加显示） */
  undatedPoems: Array<{
    id: string
    title: string
    place?: { label: string; lat: number; lng: number }
  }>
  /** 统计信息 */
  stats: {
    totalPoems: number
    datedPoems: number
    placesCount: number
    yearRange: { start: number; end: number } | null
  }
}
```

---

## 三、API 设计

### 3.1 端点定义

```
GET /api/v1/person/:id/poem-track
```

### 3.2 请求参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | string | 是 | - | 人物ID（URL参数） |
| `format` | string | 否 | json | 响应格式 |

### 3.3 响应格式

```json
{
  "success": true,
  "data": {
    "personId": "17270",
    "personName": "杜甫",
    "lifespan": {
      "birth": 712,
      "death": 770,
      "label": "712-770"
    },
    "dynasty": "唐朝",
    "trackPoints": [
      {
        "year": 747,
        "yearLabel": "747年",
        "place": {
          "uri": "http://localhost:8003/place/CN6101",
          "label": "西安市",
          "lat": 34.347436,
          "lng": 108.946306
        },
        "poems": [
          { "id": "1367111", "title": "天狗赋", "uri": "..." }
        ]
      },
      {
        "year": 754,
        "yearLabel": "754年",
        "place": {
          "uri": "http://localhost:8003/place/CN6101",
          "label": "西安市",
          "lat": 34.347436,
          "lng": 108.946306
        },
        "poems": [
          { "id": "1367110", "title": "雕赋", "uri": "..." }
        ]
      },
      {
        "year": 758,
        "yearLabel": "758年",
        "place": {
          "uri": "http://localhost:8003/place/CN610521",
          "label": "华县",
          "lat": 34.5128,
          "lng": 109.7689
        },
        "poems": [
          { "id": "1367112", "title": "乾元元年华州试进士策问五首", "uri": "..." }
        ]
      }
    ],
    "undatedPoems": [],
    "stats": {
      "totalPoems": 3,
      "datedPoems": 3,
      "placesCount": 2,
      "yearRange": { "start": 747, "end": 758 }
    }
  }
}
```

### 3.4 错误响应

```json
{
  "success": false,
  "error": {
    "code": "PERSON_NOT_FOUND",
    "message": "未找到该人物",
    "statusCode": 404
  }
}
```

---

## 四、前端组件设计

### 4.1 组件架构

```
PersonDetailPage
└── PersonPoemTrackSection (新增)
    ├── PersonPoemTrackMap (地图组件)
    │   ├── AMapContainer (高德地图容器)
    │   ├── TrackMarkers (轨迹标记点)
    │   └── TrackLines (轨迹连线)
    ├── TrackTimeline (时间线控件)
    │   ├── YearSlider (年份滑块)
    │   ├── PlayButton (播放/暂停)
    │   └── YearDisplay (当前年份显示)
    └── PoemListPanel (诗文列表)
        ├── PlaceHeader (地点标题)
        └── PoemCards (诗文卡片列表)
```

### 4.2 Props 接口

```typescript
interface PersonPoemTrackMapProps {
  /** 人物ID */
  personId: string
  /** 轨迹数据（可选，未提供时自动获取） */
  trackData?: PersonPoemTrack
  /** 初始选中年份 */
  initialYear?: number
  /** 是否自动播放 */
  autoPlay?: boolean
  /** 动画间隔（毫秒） */
  animationInterval?: number
  /** 点击诗文回调 */
  onPoemClick?: (poem: { id: string; title: string }) => void
}

interface TrackTimelineProps {
  /** 年份范围 */
  yearRange: { start: number; end: number }
  /** 当前年份 */
  currentYear: number
  /** 年份变化回调 */
  onYearChange: (year: number) => void
  /** 是否播放中 */
  isPlaying: boolean
  /** 播放状态变化回调 */
  onPlayStateChange: (isPlaying: boolean) => void
}
```

### 4.3 状态管理

```typescript
interface TrackMapState {
  // 数据
  trackData: PersonPoemTrack | null
  loading: boolean
  error: string | null

  // 交互状态
  currentYear: number | null
  isPlaying: boolean
  selectedPlace: PoemTrackPoint | null

  // 地图状态
  mapReady: boolean
  zoom: number
  center: [number, number]
}
```

---

## 五、UI 原型设计

### 5.1 桌面端布局

```
┌─────────────────────────────────────────────────────────────────────────┐
│  杜甫 (712-770) · 诗文创作轨迹                              [全屏 □]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────────────────────────────────┬───────────────────┐   │
│   │                                             │   当前: 758年     │   │
│   │                                             │   ┌─────────────┐ │   │
│   │              高 德 地 图                     │   │ ▶ 播放轨迹  │ │   │
│   │                                             │   └─────────────┘ │   │
│   │         ●━━━━━●━━━━━●━━━━━●                │                   │   │
│   │       西安    华县   洛阳   奉节             │   地点: 华县      │   │
│   │         747   758    765    766             │   诗作: 1首       │   │
│   │                                             │                   │   │
│   │   [标记点随时间线高亮]                       │   ┌───────────┐   │   │
│   │                                             │   │ 乾元元年  │   │   │
│   │                                             │   │ 华州试... │   │   │
│   │                                             │   │ [查看详情]│   │   │
│   │                                             │   └───────────┘   │   │
│   └─────────────────────────────────────────────┴───────────────────┘   │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  时间线                                                          │   │
│   │  ──●──────────●──────────●──────────●──────────●──────────●──  │   │
│   │  712        740        760        770                            │   │
│   │  出生      入长安     漂泊西南    去世                              │   │
│   │                          ▲                                       │   │
│   │                       [758]                                      │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 时间线播放动画流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          播放动画流程                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  初始状态              播放中                    选中状态               │
│  ┌─────────┐          ┌─────────┐              ┌─────────┐             │
│  │   ○     │    →     │   ●     │      →       │   ●     │             │
│  │  747年  │          │  758年  │              │  758年  │             │
│  │  灰色   │          │  高亮   │              │  选中框 │             │
│  └─────────┘          └─────────┘              └─────────┘             │
│                                                                         │
│  动画帧: 每个年份停留 1.5秒，平滑过渡到下一个标记点                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.3 标记点设计

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          标记点样式                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  普通状态                  高亮状态                  选中状态           │
│                                                                         │
│      ┌───┐                   ┌───┐                  ╔═══════╗          │
│      │ 2 │                   │ 2 │                  ║   2   ║          │
│      └─┬─┘                   └─┬─┘                  ╠═══════╣          │
│        │           →            │         →          ║ 华县  ║          │
│       ███                     ▓▓▓                    ╚═══════╝          │
│      灰色                    蓝色脉动               橙色边框             │
│                                                                         │
│  数字表示该地点创作的诗文数量                                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.4 移动端布局

```
┌─────────────────────────┐
│  杜甫 · 诗文轨迹        │
│  [◀ 返回]     [全屏 □] │
├─────────────────────────┤
│                         │
│      高 德 地 图        │
│                         │
│   ●━━━━●━━━━●          │
│  西安  华县  奉节       │
│                         │
├─────────────────────────┤
│  ◀ 712 ━━●━━ 770 ▶    │
│           758           │
├─────────────────────────┤
│  ┌─────────────────┐    │
│  │ 758年 · 华县    │    │
│  │ 乾元元年华州... │    │
│  │ [查看详情]      │    │
│  └─────────────────┘    │
└─────────────────────────┘
```

### 5.5 交互流程图

```
                              用户进入人物详情页
                                     │
                                     ▼
                         ┌──────────────────────┐
                         │  自动加载轨迹数据    │
                         │  地图显示所有标记点  │
                         └──────────┬───────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
     ┌────────────────┐    ┌────────────────┐    ┌────────────────┐
     │  拖动时间线    │    │  点击播放按钮  │    │  点击标记点    │
     └───────┬────────┘    └───────┬────────┘    └───────┬────────┘
             │                     │                     │
             ▼                     ▼                     ▼
     ┌────────────────┐    ┌────────────────┐    ┌────────────────┐
     │ 地图移到该年份 │    │ 自动播放动画   │    │ 显示诗文列表   │
     │ 标记点高亮     │    │ 逐年移动焦点   │    │ 高亮选中状态   │
     └────────────────┘    └───────┬────────┘    └───────┬────────┘
                                   │                     │
                                   │                     ▼
                                   │            ┌────────────────┐
                                   │            │ 点击诗文卡片   │
                                   │            └───────┬────────┘
                                   │                    │
                                   │                    ▼
                                   │            ┌────────────────┐
                                   │            │ 跳转诗文详情页 │
                                   │            └────────────────┘
                                   │
                                   ▼
                          播放完毕自动停止
```

---

## 六、技术实现要点

### 6.1 WKT 坐标解析

```typescript
/**
 * 解析 WKT POINT 格式坐标
 * @param wkt WKT 字符串，如 "POINT(108.946306 34.347436)"
 * @returns 坐标对象 { lng, lat } 或 null
 */
function parseWktPoint(wkt: string): { lng: number; lat: number } | null {
  const match = wkt.match(/POINT\s*\(\s*([\d.-]+)\s+([\d.-]+)\s*\)/i)
  if (!match) return null
  return {
    lng: parseFloat(match[1]),
    lat: parseFloat(match[2])
  }
}
```

### 6.2 年份解析

```typescript
/**
 * 从 timespan 提取年份
 */
function extractYear(timespan: { _label?: string; begin_of_the_begin?: string }): number | null {
  // 优先从 _label 解析
  if (timespan._label) {
    const match = timespan._label.match(/(\d{3,4})/)
    if (match) return parseInt(match[1], 10)
  }

  // 从 begin_of_the_begin 解析
  if (timespan.begin_of_the_begin) {
    const match = timespan.begin_of_the_begin.match(/(\d{4})/)
    if (match) return parseInt(match[1], 10)
  }

  return null
}
```

### 6.3 高德地图集成

```typescript
// 动态加载高德地图
const loadAMap = async () => {
  if (window.AMap) return window.AMap

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}`
    script.onload = () => resolve(window.AMap)
    script.onerror = reject
    document.head.appendChild(script)
  })
}

// 自动适配视野
const fitMapView = (map: AMap.Map, points: Array<{ lng: number; lat: number }>) => {
  if (points.length === 0) return

  const bounds = new AMap.Bounds()
  points.forEach(p => bounds.extend([p.lng, p.lat]))
  map.setBounds(bounds, false, [50, 50, 50, 50])
}
```

### 6.4 后端数据查询

**按人物ID查询诗文：**

```javascript
/**
 * 查询某人物的所有诗文
 * @param {string} personId - 人物ID（如 "17270"）
 * @returns {Promise<Array>} 诗文列表
 */
async function queryPoemsByPerson(personId) {
  const { mlSearchByDirectory, mlGetDoc } = require('../infra/gateways/marklogicGateway')

  // 在诗文集合目录中搜索
  const searchData = await mlSearchByDirectory(
    '/processed/json-ld/poem/set/',
    personId,
    500
  )

  // 过滤：只保留该人物创作的诗文
  const poems = []
  for (const row of searchData.results || []) {
    const doc = await mlGetDoc(row.uri)
    if (!doc) continue

    // 检查作者是否匹配
    const createdBy = Array.isArray(doc.created_by) ? doc.created_by : [doc.created_by]
    for (const created of createdBy) {
      const carried = Array.isArray(created.carried_out_by) ? created.carried_out_by : [created.carried_out_by]
      const isAuthor = carried.some(actor => {
        const actorId = String(actor?.id || '').split('/').pop()
        return actorId === personId
      })
      if (isAuthor) {
        poems.push({ uri: row.uri, doc })
        break
      }
    }
  }

  return poems
}
```

**历史地名提取（扩展现有 placeExtractor）：**

```javascript
/**
 * 从地点文档中提取历史名称
 * @param {object} doc - 地点 JSON-LD 文档
 * @returns {Array<{name: string, period: string}>}
 */
function extractHistoricalNames(doc) {
  if (!doc) return []

  const attributedBy = Array.isArray(doc.attributed_by)
    ? doc.attributed_by
    : [doc.attributed_by]

  return attributedBy
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      name: pickNodeLabel(item) || '',
      period: item.timespan ? pickNodeLabel(item.timespan) : ''
    }))
    .filter(item => item.name)
}
```

---

## 七、开发任务拆解（MVP 版本）

### 7.1 后端任务

| 序号 | 任务 | 预估工时 | 依赖 |
|------|------|----------|------|
| B1 | 创建 `/api/v1/person/:id/poem-track` API 路由 | 2h | - |
| B2 | 实现按人物ID查询诗文（mlSearchByDirectory） | 3h | B1 |
| B3 | 实现地点坐标查询（复用 placeExtractor） | 1h | B1 |
| B4 | 扩展 placeExtractor：添加历史地名提取 | 1h | B3 |
| B5 | 实现数据聚合和排序逻辑 | 2h | B2, B3 |
| B6 | 添加 API 测试用例 | 2h | B5 |

**后端小计**: 11h

### 7.2 前端任务

| 序号 | 任务 | 预估工时 | 依赖 |
|------|------|----------|------|
| F1 | 创建 PersonPoemTrackMap 组件骨架 | 2h | - |
| F2 | 集成高德地图（显示标记点） | 4h | F1 |
| F3 | 创建 TrackTimeline 时间线组件 | 2h | F1 |
| F4 | 创建 PoemListPanel 诗文面板组件 | 2h | F1 |
| F5 | 实现历史地名 tooltip 显示 | 1h | F2 |
| F6 | 实现点击跳转诗文详情 | 1h | F4 |
| F7 | 空状态处理（无数据提示） | 0.5h | F2 |
| F8 | 集成到人物详情页 | 2h | F5, F6 |
| F9 | 添加组件测试用例 | 2h | F8 |

**前端小计**: 16.5h

### 7.3 总工时

| 阶段 | 工时 |
|------|------|
| 后端开发 | 11h |
| 前端开发 | 16.5h |
| 联调测试 | 3h |
| **总计** | **30.5h** |

---

## 八、风险评估

| 风险 | 等级 | 影响 | 缓解措施 |
|------|------|------|----------|
| 地点数据缺少坐标 | 中 | 无法在地图上显示 | 使用高德地理编码 API 动态解析 |
| 诗文无时间数据 | 低 | 不参与时间线 | 作为静态点显示在地图上 |
| 性能问题（诗文数量多） | 中 | 加载慢 | 实现分页或懒加载 |
| 高德 API 配额限制 | 低 | 服务不可用 | 监控使用量，考虑备用方案 |

---

## 九、验收标准（MVP）

### 必须达成

- [ ] API 能正确返回人物的诗文轨迹数据
- [ ] 地图正确显示所有创作地点标记
- [ ] 地图视野自动适配包含所有标记点
- [ ] 时间线可拖动，对应标记点高亮
- [ ] 播放按钮能自动播放轨迹动画
- [ ] 点击标记点显示诗文列表
- [ ] 点击诗文可跳转到详情页
- [ ] **历史地名可点击查看（tooltip 或面板）**
- [ ] 无诗文数据时显示空状态提示
- [ ] 无控制台错误

### 后续迭代

- [ ] 移动端响应式适配
- [ ] 键盘导航支持
- [ ] 全屏模式

---

## 十、附录

### 10.1 数据来源

**数据存储：MarkLogic 数据库**

| 数据类型 | 数据库目录 | 提取器 |
|----------|-----------|--------|
| 诗文集合 | `/processed/json-ld/poem/set/` | `poemExtractor.js` |
| 诗文文本 | `/processed/json-ld/poem/txt/` | `poemExtractor.js` |
| 地点 | `/processed/json-ld/place/` | `placeExtractor.js` |
| 人物 | `/processed/json-ld/person/` | `personExtractor.js` |

### 10.2 相关代码文件

| 文件 | 路径 | 说明 |
|------|------|------|
| MarkLogic 网关 | `server/src/infra/gateways/marklogicGateway.js` | 数据库访问层 |
| 地点提取器 | `server/src/domain/detail/placeExtractor.js` | 含 WKT 坐标解析 |
| 人物提取器 | `server/src/domain/detail/personExtractor.js` | 含生卒年提取 |
| 诗文提取器 | `server/src/domain/detail/poemExtractor.js` | 含作者/时间提取 |
| 地图组件参考 | `src/features/details/components/entity-fields/PlaceCoordinateMapPanel.tsx` | 现有地图实现 |

### 10.3 参考链接

- [高德地图 JS API 文档](https://lbs.amap.com/api/javascript-api-v2/summary)
- [CIDOC-CRM 规范](https://cidoc-crm.org/)
- [Linked.Art 数据模型](https://linked.art/)
