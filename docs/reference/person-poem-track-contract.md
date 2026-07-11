# 人物诗文轨迹与地图契约

本文是人物轨迹接口和三个地图面板的当前契约。历史分析文档只保留设计过程，不作为实现依据。

## 职责边界

| 层 | 责任 | 不负责 |
|---|---|---|
| `GET /api/v1/persons/:id` | 人物基本信息、关系和原始 JSON-LD | 诗文轨迹聚合、地图坐标 |
| `GET /api/v1/persons/:id/poem-track` | 按年份和地点聚合人物诗文 | 地图资源和瓦片加载 |
| `PersonPoemTrackMap` | 校验并展示轨迹、时间线、诗文列表 | 猜测或修复坏坐标 |
| `mapLoader.ts` | 把内部 `[lng, lat]` 转成 Leaflet `[lat, lng]` | 提供业务数据 |

## 成功响应

```typescript
interface PersonPoemTrack {
  personId: string
  personName: string
  lifespan: {
    birth: number | null
    death: number | null
    label: string
  }
  dynasty?: string
  trackPoints: Array<{
    year: number
    yearLabel: string
    place: {
      uri: string
      label: string
      lng: number
      lat: number
      historicalNames?: Array<{ name: string; period: string }>
    }
    poems: Array<{ id: string; title: string; uri: string }>
  }>
  undatedPoems: Array<{ id: string; title: string; uri: string }>
  stats: {
    totalPoems: number
    datedPoems: number
    placesCount: number
    yearRange: { start: number; end: number } | null
  }
}
```

外层响应遵循通用 v1 格式：`{ success: true, data, error: null }`。

## 坐标约定

- JSON-LD 地点坐标使用 WKT `POINT(lng lat)`。
- API 和前端业务层统一使用 WGS84 `{ lng, lat }`。
- 经度范围 `[-180, 180]`，纬度范围 `[-90, 90]`。
- Leaflet 只在适配层转换成 `[lat, lng]`。
- 缺失或越界坐标不进入 `trackPoints`，不得替换成默认城市坐标。
- `stats.placesCount` 只统计最终可展示的唯一地点。

## 地图资源

| 环境变量 | 默认值 | 用途 |
|---|---|---|
| `REACT_LEAFLET_JS_URL` | jsDelivr Leaflet 1.9.4 | Leaflet 脚本 |
| `REACT_LEAFLET_CSS_URL` | jsDelivr Leaflet 1.9.4 | Leaflet 样式和图标基址 |
| `REACT_MAP_TILE_URL` | OpenStreetMap 标准瓦片 | 地图底图 |
| `REACT_MAP_ATTRIBUTION` | OpenStreetMap contributors | 版权标注 |

这些资源均可通过 `.env` 替换成国内可达的自托管或代理地址。脚本、样式或瓦片不可达时，地图面板显示加载失败，不降级到高德兼容代码。

## 验收

```bash
npm test -- tests/lib/api/contracts/personPoemTrackContract.test.ts \
  tests/lib/geo/wkt.test.ts \
  tests/features/details/mapLoader.test.ts \
  tests/server/poemTrackService.test.ts \
  tests/server/api/v1DetailScopeAlignment.integration.test.ts

npm run build
```
