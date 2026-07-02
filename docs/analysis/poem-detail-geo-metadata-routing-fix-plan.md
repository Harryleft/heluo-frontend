# 诗文详情页地理信息与元数据展示修复方案（分析文档）

## 1. 背景与目标

你在诗文详情页发现了 5 类问题：

| 编号 | 问题现象 | 期望结果 |
|---|---|---|
| P1 | Set 的 JSON-LD 已有 `took_place_at`，但页面未展示地理信息 | 基于 `took_place_at` 获取地理信息并用高德 JS API 展示 |
| P2 | 摘要区与其他区域信息重复 | 不再重复展示摘要 |
| P3 | `section.poem-detail-card__metadata`（更多 JSON-LD 信息）冗余 | 整块删除 |
| P4 | `div.entity-metadata` 中有“类型=集合”；“创作者: 杜甫”文案不符合预期 | 去掉“集合”字段；文案改为“作者”；仅显示人名 |
| P5 | 点击作者链接无法正常跳转，页面卡住 | 作者链接可稳定跳转到人物详情 |

---

## 2. 现状定位（代码入口）

| 模块 | 关键位置 | 当前行为 |
|---|---|---|
| 诗文卡片元数据区 | `src/features/details/PoemDetailCard.tsx:102` | 渲染“更多 JSON-LD 信息”整块（含作者/朝代/体裁/诗集/相关地理/来源） |
| 诗文地理展示 | `src/features/details/PoemDetailCard.tsx:217` | 仅展示地点名 + 高德搜索外链，不是嵌入式高德 JS 地图 |
| 摘要展示逻辑 | `src/features/details/OverviewTab.tsx:365` | 诗文资源走通用 summary 区，随后还渲染 `PoemDetailCard`，造成信息重复 |
| 通用元数据表 | `src/features/common/EntityMetadata.tsx:213` | 基础字段全量渲染，包含 `type` 行 |
| 创作者行渲染 | `src/features/common/EntityMetadata.tsx:299`、`314` | 标签“创作者”，并渲染 `role + ": " + name` |
| 创作者角色来源 | `src/lib/parse/data/EntityParser.ts:947-952` | Creation/Production 默认赋 role=`创作者` |
| 内部路由构建 | `src/lib/url/heluoUrl.ts:104` | 按实体 URI 生成 `/details?uri=...` |
| 内部链接组件 | `src/features/common/InternalLink.tsx:37-60` | 可导航时使用 `Link`，否则外链 `<a>` |

---

## 3. 根因分析

| 问题 | 根因 | 影响 |
|---|---|---|
| P1 地理信息缺失 | 诗文页未接入“地点名 -> 坐标 -> 地图渲染”的链路；当前仅高德搜索链接 | 无法直观看到地点位置 |
| P2 摘要重复 | 诗文场景仍复用通用 summary 区，同时存在诗文详情卡片 | 阅读重复、视觉噪声 |
| P3 冗余 JSON-LD 卡片 | `PoemDetailCard` 固定渲染 metadata section | 信息分散、重复 |
| P4 创作者展示不符合预期 | `EntityMetadata` 为通用策略：显示 `type` + `role` 前缀 | 诗文场景文案不自然（“创作者: 杜甫”） |
| P5 作者点击卡住 | 当前路由链路缺少对“异常 URI 形态”的兜底验证（如已编码/嵌套详情链接/绝对 URL 变体）；缺少专门回归测试 | 作者链接稳定性不可控 |

---

## 4. 修复方案总览

```mermaid
flowchart TD
  A[详情接口返回 detail + doc] --> B[诗文页 OverviewTab]
  B --> C{resourceType == poem}
  C -->|是| D[隐藏通用 summary 区]
  C -->|是| E[渲染 PoemDetailCard 精简版]
  E --> F[去掉 poem-detail-card__metadata 整块]
  B --> G[渲染 EntityMetadata(诗文定制参数)]
  G --> H[过滤 type=集合]
  G --> I[创作者标签改 作者]
  G --> J[仅显示作者名]
  A --> K[提取 took_place_at 名称]
  K --> L[高德 JS API 地理编码]
  L --> M[诗文地理地图组件渲染]
  J --> N[作者内链]
  N --> O[URI 归一化 + 路由跳转]
```

---

## 5. 分项修复设计

### 5.1 诗文地理信息：从 `took_place_at` 到高德 JS 地图

1. 数据来源统一
- 一级来源：`detail.poemDetail.relatedPlaces`。
- 二级来源：`detail.doc.took_place_at[]`（补齐 `relatedPlaces` 缺口）。
- 去重键建议：`uri || label`。

2. 地图渲染策略
- 复用现有高德加载能力（参考 `BookLocationMapPanel` 与 `PlaceCoordinateMapPanel`）。
- 新增诗文地理地图组件（建议：`PoemPlaceMapPanel`），职责仅负责：
  - 接收地点列表（名称 + 可选 URI）
  - 使用高德 Geocoder 将名称转坐标
  - 标注点位并 `setFitView`

3. 失败兜底
- Geocoder 失败时，保留地点名文本展示。
- 地图加载失败时显示可读提示，不阻断页面。
- 无坐标结果时显示“未解析到可定位坐标”。

4. 配置要求
- 沿用现有环境变量：`REACT_AMAP_KEY`、`REACT_AMAP_SECURITY_JS_CODE`。

### 5.2 删除重复摘要

- 在诗文分支中禁止渲染通用 summary 区块（位置：`OverviewTab.tsx:365-370`）。
- 诗文仅保留标题 + 诗文主体（`PoemDetailCard`）作为主内容。

### 5.3 删除 `poem-detail-card__metadata` 整块

- 删除 `PoemDetailCard` 中 metadata section（`PoemDetailCard.tsx:101-133`）。
- 同步清理对应样式（`src/styles/features/details/PoemDetailCard.ts` 中 `.poem-detail-card__metadata*`）。

### 5.4 `entity-metadata` 卡片定制（仅诗文场景）

1. 去掉“类型=集合”
- 对 `EntityMetadata` 增加“字段过滤”能力（建议按字段 key 过滤 `type`），仅在诗文页启用。

2. 文案“创作者”改“作者”
- `CreatorsRow` 支持按场景传入 `creatorLabelZh`（诗文传“作者”）。

3. 值仅显示人名
- 关闭 role 前缀输出（目前在 `EntityMetadata.tsx:314`）。
- 诗文页只显示 `creator.label`，不显示 `creator.role`。

### 5.5 作者链接跳转稳定性

1. URI 归一化增强
- `buildDetailsRouteFromUri` 增加对以下输入的兜底识别：
  - 绝对 URL（含 localhost/多端口）
  - 已编码路径
  - 已是 `/details?uri=...` 的嵌套形态

2. InternalLink 行为收敛
- 内部可导航 URI 必须统一落到 React Router `Link`。
- 对不可识别 URI 给出外链回退，但需保留日志/告警点便于排查。

3. 回归验证
- 增加“从诗文页点作者进入人物页”的测试用例，覆盖 `/person/17270` 与 `http://localhost:8003/person/17270` 两类输入。

---

## 6. 实施步骤（TODO）

```text
[阶段 A] 数据与组件
A1. 新增诗文地理数据提取函数（合并 relatedPlaces + doc.took_place_at）
A2. 新增 PoemPlaceMapPanel，复用高德加载逻辑并支持地理编码
A3. 在诗文详情主区域接入地图组件

[阶段 B] 页面去重与信息精简
B1. 诗文分支关闭通用摘要区
B2. 删除 PoemDetailCard 的 metadata section 与对应样式

[阶段 C] 元数据文案与字段控制
C1. EntityMetadata 增加字段过滤能力（屏蔽 type）
C2. 创作者行支持文案覆盖（创作者 -> 作者）
C3. 创作者值展示去 role 前缀

[阶段 D] 路由稳定性
D1. 增强 URI 归一化与详情路由构建
D2. 修复/兜底 InternalLink 的内部跳转判断

[阶段 E] 回归测试
E1. 诗文详情：不重复摘要 + metadata 删除 + 地图渲染分支
E2. 元数据：无“集合”行 + 作者文案与值格式
E3. 链接：作者点击可跳转人物详情
```

---

## 7. 边界情况清单

| 场景 | 预期 |
|---|---|
| `took_place_at` 只有名称无 URI | 仍可 geocode 并展示地图标记 |
| 多个地名重名 | 使用“名称 + 坐标”去重，避免重复 marker |
| 高德 Key 缺失 | 页面可用，地图区域显示配置缺失提示 |
| 地理编码全部失败 | 地图不崩溃，保留地点文本 |
| 作者 URI 为绝对 URL | 仍可转为 `/details?uri=...` 内部路由 |
| 作者 URI 已是内部详情链接 | 归一化后仍能正确导航 |

---

## 8. 验收标准（DoD）

1. 诗文详情可显示基于 `took_place_at` 的高德地图位置。
2. 页面不存在重复摘要。
3. `section.poem-detail-card__metadata` 不再渲染。
4. `entity-metadata` 中不展示“类型=集合”。
5. “创作者”文案改为“作者”，值只显示姓名。
6. 点击作者链接可稳定进入人物详情页，无卡住现象。

---

## 9. 风险与回滚

- 风险1：地理编码存在配额/网络波动 -> 采用非阻断降级策略（文本可见）。
- 风险2：`EntityMetadata` 为通用组件，改动可能影响其他详情页 -> 必须按“仅诗文场景启用参数”设计。
- 回滚策略：
  - 地图功能可通过组件开关回退为“地点 + 高德搜索链接”；
  - `EntityMetadata` 新增参数可默认关闭，确保旧行为可恢复。

---

## 10. 实施进度（执行中）

| 时间 | 状态 | 动作 | 结果 |
|---|---|---|---|
| 2026-02-27 | 已完成 | 建立分析文档与修复方案 | 文档已落地并提交 |
| 2026-02-27 | 进行中 | 进入测试先行实施阶段 | 将按“测试失败 -> 实现 -> 测试通过”推进 |
| 2026-02-27 | 已完成 | 增加回归测试：路由归一化、诗文地理回填、诗文详情 UI | 初始执行失败，验证用例有效 |
| 2026-02-27 | 已完成 | 修复 `details?uri=` 链路归一化与双重编码识别 | 作者链接路由稳定性提升 |
| 2026-02-27 | 已完成 | 修复诗文 `doc.took_place_at` 回填 `relatedPlaces` | 诗文地理信息来源补齐 |
| 2026-02-27 | 已完成 | 诗文页关闭重复摘要、定制作者元数据文案 | 去重与文案目标达成 |
| 2026-02-27 | 已完成 | PoemDetailCard 移除 JSON-LD 元卡片并接入高德 JS 地图 | 页面改为“地点列表 + 地图容器 + 状态提示” |
| 2026-02-27 | 已完成 | 目标测试回跑（3个文件，19个用例） | 全部通过 |
| 2026-02-27 | 已完成 | 诗文改动后跨详情页回归（7个文件，25个用例） | 全部通过，其他详情页行为未回归 |
| 2026-02-27 | 已完成 | TypeScript 类型检查 | `npm run -s typescript` 通过 |
| 2026-02-27 | 已完成 | 追加修复：诗文地点提取路径扩展与 set 文档回退 | 覆盖 `created_by.took_place_at`，并在主文档无地点时回退 set 文档 |

### 当前实施约束

1. 仅修改诗文详情相关链路，不改变人物/图书/地点/古籍/概念页面既有行为。
2. 每个文件独立提交，保持工作区整洁。
3. 每轮实现后执行类型检查与回归测试。

### 本轮已落地文件（实现）

1. `src/lib/url/heluoUrl.ts`
2. `src/lib/api/services/detailService.ts`
3. `src/features/common/EntityMetadata.tsx`
4. `src/features/details/OverviewTab.tsx`
5. `src/features/details/PoemDetailCard.tsx`
6. `src/styles/features/details/PoemDetailCard.ts`

### 本轮已落地文件（测试）

1. `tests/lib/url/heluoUrl.test.ts`
2. `tests/lib/api/services/detailService.test.ts`
3. `tests/features/details/poemDetailUiRegression.test.tsx`
