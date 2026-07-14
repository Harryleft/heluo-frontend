# 杜甫人物专题 Design QA

## 验收范围

- 首页专题入口：首页 Hero 下新增“杜甫：从巩县出发的诗史人生”策展卡片。
- 专题主页面：桌面端与 390px 移动端。
- 核心链路：首页进入专题、专题进入人物详情、专题进入智能对话。
- 检索失败语义：后端不可用时返回 503，前端只展示“检索服务暂不可用”。

## 视觉对照

- 设计基准：`output/audit/2026-07-14-topic-planning/01-home-viewport.png`
- 同视口实现：`output/audit/2026-07-14-topic-implementation/03-home-reference-viewport.png`
- 专题桌面端：`output/audit/2026-07-14-topic-implementation/01-topic-desktop.png`
- 专题移动端：`output/audit/2026-07-14-topic-implementation/04-topic-mobile.png`
- 结论：首页保留既有宣纸底色、深蓝标题、金色点缀、宋体层级与细边框语言；新增导航和专题卡片属于策划要求导致的有意内容变化。专题页复用同一套色彩、字体和间距体系，没有引入新的图标或伪造素材。

## 缺陷检查

- P0：无。
- P1：无。
- P2：无。
- 移动端横向溢出：无，页面 `scrollWidth` 与 `clientWidth` 均为 379px。
- 浏览器控制台错误：无。

## 功能与自动化证据

- Vitest：65 个测试文件、454 个测试全部通过。
- 生产构建：TypeScript 与 Vite 构建通过。
- ESLint：全项目 `npm run lint` 通过；测试输出目录已从源码扫描中排除。
- 真实后端：MarkLogic 不可用时 `/api/v1/search` 返回 HTTP 503 与 `SEARCH_BACKEND_UNAVAILABLE`。
- 真实前端：结果页展示“加载失败：检索服务暂不可用”，不再同时展示空结果或加载动画。

final result: passed
