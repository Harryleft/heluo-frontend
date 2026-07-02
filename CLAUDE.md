> **程序是写给人读的，只是顺便让机器执行。** — *Programs are written for people to read, only incidentally for machines to execute.*

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 回复要求

每次的回复开头都需要向我问好，称呼我为宇宙无敌大帅哥。

## 语言设置
- 始终使用中文回复和撰写报告
- 代码注释使用中文

## 测试设置

- 使用 Vitest 框架作为唯一的测试工具
- 测试文件统一放到 `tests/` 目录下相应的文件夹

## 代码实施要求

1. 理解当前代码的功能和结构
2. 确定需要实现的功能或修复的问题，可以使用 MCP 工具（例如深度思考、联网、视觉）进行分析
3. 首先形成分析文档放到 `docs\` 下相应的文件夹，使用 mermaid 图表分析，可以撰写伪代码，但是不要撰写任何细节的实现代码

**代码撰写的步骤**

- 先编写测试用例，确保覆盖所有功能和边界情况
- 运行测试用例，确保测试用例失败，验证测试用例的有效性
- 编写实现代码，确保代码符合设计原则和编码规范
- 运行测试用例，确保所有测试用例通过
- 进行代码审查，确保代码质量和可维护性

## Git 提交规范

### 提交单元：按功能逻辑划分
- 以**一个完整的功能点或修复**为一个提交单元，而非强制单文件。
- 同一个功能涉及的多个文件（类型定义、API、组件、测试等）可以一起提交。
- 单文件修改仍然优先——只有当多个文件属于同一个逻辑变更时才合并提交。

### 提交流程
1. 完成一个功能点或修复的所有文件修改。
2. `git diff` — 确认所有改动都在预期范围内。
3. `git add <文件1> <文件2> ...` — 用明确路径逐个暂存，禁止 `git add .` 或 `git add -A`。
4. `git commit -m “<提交信息>”`。
5. `git status` — 确认工作区干净后继续下一个任务。

### 提交信息格式（必须）
- 使用格式：`<类型>(<主要文件>): <简短祈使句摘要>`
- 类型可选：feat | fix | refactor | docs | test | chore
- 单文件：`fix(src/foo.ts): handle empty input`
- 多文件：`feat(src/features/search): add filter by dynasty`
- 当提交涉及多个文件时，`<主要文件>` 填写最能代表本次变更的文件路径。

### 硬性规则（保留）
- 禁止 `git add .` 或 `git add -A`，必须用明确路径暂存。
- 禁止在工作区积压大量未提交的修改——每完成一个功能点就提交。
- 禁止提交半成品——每次提交应该是一个可编译、可运行的完整状态。

## 导入约定
- 包导入使用绝对路径，不要使用相对路径

## 输出偏好
- 不要在代码中使用 emoji 字符
- 多用Markdown表格展示

## 文档撰写
- 说人话

## 项目启动方式

| 服务 | 端口 | 配置位置 |
|------|------|----------|
| **前端 (Vite)** | `3000` | `vite.config.ts:19` |
| **后端 (Express)** | `9011` | `server/src/index.js:9` |

| 命令 | 说明 |
|------|------|
| `npm run dev` | 一键启动全部服务 |
| `npm run dev:frontend` | 仅启动前端 `http://127.0.0.1:3000` |
| `npm run dev:server` | 仅启动后端 `http://127.0.0.1:9011` |
| `npm run test` | 运行全部测试（Vitest） |
| `npm run lint` | ESLint 检查 |
| `npm run typescript` | TypeScript 类型检查 |

## 关键目录结构

```
src/
  app/          # 应用入口与路由
  features/     # 功能模块（details/fusion/home/results/iiif/common）
  lib/          # 基础设施层（api/parse/dom/utils）
  providers/    # Providers 门面层（features 访问基础设施的唯一入口）
  types/        # TypeScript 类型定义
  styles/       # CSS-in-TS 样式文件
server/src/
  routes/       # HTTP 路由
  controllers/  # 控制器
  usecases/     # 用例层
  domain/       # 领域层（detail/fusion/retrieval/track）
  infra/        # 基础设施层
  services/     # 外部服务
  bootstrap/    # 应用启动引导
tests/          # 测试文件（与 src 目录结构对应）
docs/           # 分析文档与设计文档（索引见 docs/README.md）
```

## 环境注意事项

- **Windows 环境**：shell 使用 Git Bash，路径分隔符用 `/`
- **后端依赖 MarkLogic**：后端需要能连接到 MarkLogic 数据库
- **测试框架**：前端使用 **Vitest**

## 详细规范

详细工作规范已提取到独立文件：
- Git 提交规范 -> docs/standards/git-commit-convention.md
- 代码实施流程 -> docs/standards/code-implementation-workflow.md
- 工作流编排 -> docs/standards/workflow-orchestration.md
- 文档导航 -> docs/README.md
