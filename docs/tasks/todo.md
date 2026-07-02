# TODOS

## 待办事项

### T0: Providers 单入口与单向分层试点

- **Why**: 当前前端只有 `types/config/repositories/services/runtime/features` 的分层雏形，但仍存在跨层直连；例如 `useAiServices.ts` 直接依赖 `http`、`iiif.ts` 直接依赖 `runtimeConfig`，与 OpenAI harness engineering 文中强调的“受限依赖图 + Providers 单入口”不一致
- **Pros**: 能把横切关注点收敛为统一入口，降低 AI 生成代码继续扩散架构漂移的概率；为后续自动化 lint / 结构测试建立清晰边界
- **Cons**: 前期需要先冻结依赖规则，再做域级试点，短期不会立刻带来用户可见功能
- **Depends on**: `docs/analysis/providers-layer-guard-assessment.md`
- **Scope**: `src/features/details/`, `src/lib/api/`, `src/lib/config/`, `src/lib/runtime/`, `src/app/`, `eslint.config.js`, `tests/`

### T1: OverviewTabView 按实体类型拆分为专属布局组件

- **Why**: `OverviewTabView.tsx` 当前约 660 行，虽然较历史峰值明显下降，但仍包含多实体布局分支，是前端最复杂的详情布局组件之一
- **Pros**: 每个实体类型独立维护，新增/修改实体无需触碰其他类型代码；V6 视觉重设计的前置条件
- **Cons**: 涉及 3-5 个新文件，需要仔细回归测试
- **Depends on**: V6 设计文档定稿 (`docs/design/v6/`)
- **Scope**: `src/features/details/components/overview/`

### T2: getDetailUseCase switch 语句重构为注册表模式

- **Why**: `getDetailUseCase.js` 当前约 880 行，仍包含 3 个 switch 语句 + 6 个 URI 类型检测函数，每新增一种实体类型需修改 4 处
- **Pros**: 新增实体类型只需注册一次；消除 switch 分支遗漏风险
- **Cons**: 仅在新增实体类型时 ROI 为正（当前 6 种类型稳定不变）
- **Depends on**: 无
- **Scope**: `server/src/usecases/getDetailUseCase.js`

### T3: 提取 streamFusionQuery 为独立模块

- **Why**: `FusionChat.tsx` 当前约 639 行，流式处理逻辑与 UI 状态管理仍然耦合，适合独立为 `fusionStreamClient.ts`
- **Pros**: FusionChat 组件专注于 UI；流式客户端可单独测试和复用
- **Cons**: 需要额外文件，但复杂度不增加
- **Depends on**: 无
- **Scope**: `src/features/fusion/fusionStreamClient.ts`（新建）

### T4: 移动端来源侧栏折叠交互

- **Why**: 当前移动端 (<768px) 来源侧栏与聊天区域垂直堆叠，无法折叠/隐藏，用户体验差
- **Pros**: 移动端可折叠来源栏，节省屏幕空间
- **Cons**: 需要额外 CSS + toggle 状态管理
- **Depends on**: 无
- **Scope**: `src/features/fusion/FusionChat.tsx`, `src/styles/_pages.css`

## 已完成

- [x] 删除 Redux 死代码（store.ts, appSlice.ts, main.tsx Provider）
- [x] 提取 relatedResource 业务逻辑到 searchService.ts（复用 createUnifiedCache）
- [x] v1Api.ts 精简为薄 Facade（497 行 → 118 行）
- [x] 融合问答真流式修复： async generator 替代回调，50ms 节流 yield 增量内容
- [x] localStorage 安全: saveSessionToStorage 返回 boolean，QuotaExceededError 不抛异常
- [x] OverviewTabView Phase 1-3 重构：1145 行 → 699 行，提取 hooks/utils/sub-components，tsc + ESLint 通过，无新回归

## 已知遗留项

### L1: 测试已通过，但仍存在需要治理的噪音输出

| 类型 | 位置 | 现状 |
|------|------|------|
| React act 警告 | 多个 `tests/features/details/*.test.tsx` | 测试通过，但存在 `The current testing environment is not configured to support act(...)` 警告 |
| React Router future flag 警告 | `resultsPageSearchMode.test.tsx` 等 | 测试通过，但仍输出 v7 future flag 提示 |
| 依赖层实验性警告 | 部分 jsdom/CSS 相关测试 | `css-color` / `css-calc` 的 ExperimentalWarning 仍会污染输出 |
| 文档状态漂移 | 本任务文档 | 历史上记录的“10 个失败测试”已不再符合当前事实，需要改以“警告治理”口径维护 |

### L2: OverviewTabView 架构优化空间（Phase 5，可选）

- `_buildSidebarAccordionItems` 接收 22 个参数 → 应拆为独立组件或用 context 传递
- `_renderXxxContent` 是函数非组件 → 无法独立 hooks / memo / DevTools
- 6 布尔标记 + if/else 链 → 可用策略模式/组件注册表替代

