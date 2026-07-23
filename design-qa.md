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

## 2026-07-15 面包屑配色复验

- 需求来源：浏览器批注，专题页顶部 `.global-breadcrumb` 配色重设计。
- 源图：`output/audit/2026-07-15-breadcrumb-color/01-before.png`。
- 实现图：`output/audit/2026-07-15-breadcrumb-color/02-after.png`。
- 对照状态：同一路由 `/topics/dufu-from-gongxian`、页面顶部、595 × 861 视口。
- 可见变化：透明底改为暖宣纸底；上下边界改为低对比金线；链接使用暖棕，当前页使用深蓝并加粗。导航结构、字号与交互未改动。
- P0 / P1 / P2：无。
- 横向溢出：无；`scrollWidth` 与 `clientWidth` 均为 584px。
- 浏览器日志：仅 Vite 连接与 React DevTools 提示，无 error / warn。
- 自动化复验：Vitest 66 个测试文件、456 个测试全部通过；TypeScript + Vite 生产构建通过；全项目 ESLint 通过。

## 2026-07-15 墨色主导航带复验

- 需求来源：用户选定主导航重设计方案 3。
- 设计基准：`/Users/zhuanzmima0000/.codex/generated_images/019f4f22-767c-7790-b143-8780884c845c/exec-798579a1-9faf-418a-a9f3-4669f04a4ffa.png`。
- 改造前：`output/audit/2026-07-15-main-nav-redesign/01-source.png`。
- 实现图：`output/audit/2026-07-15-main-nav-redesign/02-implementation-711.png`（711 × 863）与 `output/audit/2026-07-15-main-nav-redesign/03-implementation-390.png`（390 × 844）。
- 对照状态：同一路由 `/topics/dufu-from-gongxian`、页面顶部；首轮全景与主导航聚焦对照通过，无需修正循环。
- 字体与层级：15px 无衬线导航文字；未选项白色，当前项金色且字重 600。
- 布局与间距：搜索栏下方为通栏深蓝导航带，三项等宽，点击区最小高度 48px；桌面端与移动端均无横向溢出。
- 色彩：导航底色使用项目深蓝主色，当前项使用金色 56 × 2px 短下划线；移除旧胶囊、渐变与阴影。
- 图像与文案：未新增图像资产，徽标、搜索框和三项导航文案保持不变。
- 交互复验：主导航“首页”“人物专题”“智能对话”分别到达 `/`、`/topics/dufu-from-gongxian`、`/chat`。
- P0 / P1 / P2：无。
- 浏览器日志：仅 Vite 连接与 React DevTools 提示，无 error / warn。
- 自动化复验：Vitest 67 个测试文件、458 个测试全部通过；TypeScript + Vite 生产构建通过；全项目 ESLint 通过。构建仅保留既有大 chunk 提示，不影响本次验收。

## 2026-07-15 智能对话输入优先重设计复验

- 需求来源：用户选定智能对话重设计方案 2，并要求重试实施。
- 设计基准：`~/.codex/generated_images/019f4f22-767c-7790-b143-8780884c845c/exec-cdcc264d-2bbf-4177-abe4-bab19670213e.png`。
- 实现图：`output/audit/2026-07-15-chat-input-first/06-implementation-599-final.png`（599 × 863）与 `output/audit/2026-07-15-chat-input-first/05-implementation-390-accessible.png`（390 × 844）。
- 对照方法：设计基准与最终桌面实现已放入同一次图像比较输入；标题、证据提示、输入框、发送按钮与三条问题索引在全景中均清晰可辨。
- 首轮偏差：移动端发送按钮落位偏左、输入框出现滚动条、页面底色偏冷；已修正为输入框内绝对定位、隐藏滚动条并恢复暖宣纸底色。第二轮对照通过。
- 视觉结构：删除头像、粒子和大卡片壳层；欢迎态改为标题、输入优先编辑器、证据承诺和三条扁平索引行，保留全站深蓝、暖金、宋体层级与细边框语言。
- 响应式：599px 与 390px 均无横向溢出；390px 发送按钮保持在输入框右侧，页面首次加载焦点停留在 `BODY`，不会主动唤起移动端软键盘。
- 可访问性：可见输入框具备 `aria-label="输入问题"`；小字号金色文本改用 `#8a6508`，在 `#faf8f5` 上对比度约 5.02:1。
- 交互：输入文字后发送按钮可用；点击示例问题会自动发送并进入非空线程；运行中清除会取消请求、卸载线程后重置运行时，再恢复标题与 3 条示例。修改前复现的 `tapClientLookup` 越界异常未再出现。
- P0 / P1 / P2：无。
- 自动化复验：Vitest 67 个测试文件、465 个测试全部通过；TypeScript + Vite 生产构建通过；全项目 ESLint 与 `git diff --check` 通过。构建仅保留既有大 chunk 提示，不影响本次验收。

## 2026-07-15 智能对话头像移除复验

- 需求来源：用户明确要求取消助手头像。
- 修改前证据：`output/audit/2026-07-15-chat-avatar/04-avatar-focus.jpg`；实现证据：`output/audit/2026-07-15-chat-no-avatar/01-no-avatar-734.png`（734 × 1044）与 `output/audit/2026-07-15-chat-no-avatar/02-no-avatar-390.png`（390 × 844）。
- 对照方法：修改前头像局部与无头像桌面、移动端实现已放入同一次图像比较输入；仅移除助手头像占位，消息卡片、检索状态、操作按钮、输入区与导航视觉保持不变。
- DOM 验证：两个视口下助手头像根节点、图片节点与字母 “A” 兜底节点数量均为 0；仍保留 1 条助手检索状态消息。
- 布局验证：助手消息内容在 734px 与 390px 视口自然左移，均无横向溢出；移动端消息内容左边界为 32px，与页面内容栅格对齐。
- 资源清理：组件不再引用头像图片，头像专用 CSS 与 `public/assets/chat/heluo-literature-assistant-avatar.jpg` 已移除；向 `Thread` 显式传入空头像配置，避免组件库恢复默认字母头像。
- 交互与日志：真实点击示例问题后正常进入检索状态；页面仅保留既有后端 `HTTP 500`，未出现头像相关资源、渲染或布局错误。
- P0 / P1 / P2：无。
- 自动化复验：Vitest 67 个测试文件、466 个测试全部通过；TypeScript + Vite 生产构建通过；全项目 ESLint 与 `git diff --check` 通过。构建仅保留既有大 chunk 提示。

final result: passed
