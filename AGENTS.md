# heluo-frontend Agent 指南

本仓库负责河洛历史名人平台的 React 前端、Express API，以及本地 Embedding/LLM 服务入口。使用中文沟通和撰写项目文档；代码注释只解释非显然的约束。

## 仓库边界

- `src/`：React + TypeScript + Vite 前端。
- `server/src/`：Node.js + Express API，数据从 MarkLogic 和附加服务读取。
- `server/embedding-service/`：Embedding 服务。
- `server/llm-service/`：可选 LLM 服务。
- 数据采集、Linked Art JSON-LD、IIIF 和向量产物生成属于 `../heluo-history-famous-figures`。
- MarkLogic 导入、查询和库侧运维属于 `../heluo-marklogic`。
- 本仓库不再维护 Python Web 后端，也不直接读取 sibling 仓库的 `data/processed/`。

## 实施约束

- 前端功能放在 `src/features/`；跨功能基础设施放在 `src/lib/`；对上层暴露的稳定门面放在 `src/providers/`。
- 服务端按 `routes -> controllers -> usecases -> domain/infra` 保持依赖方向，路由和控制器不承载业务规则。
- 包导入使用项目既有别名或绝对路径，避免新增跨层相对路径。
- 测试只用 Vitest，放在 `tests/` 的对应目录。
- 非微小改动先在 `docs/analysis/` 写清问题、边界和验收条件；不要为简单修复制造文档。
- 优先补能复现缺陷或表达契约的测试，再实现最小修复并运行相关检查。
- 不改与任务无关的用户工作区变化，不使用 `git add .` 或 `git add -A`。
- 提交按可独立验证的逻辑变更组织；只有用户明确要求时才提交。

## 常用命令

```bash
npm install
npm run bootstrap          # 安装、配置、启动并执行健康检查
npm run bootstrap:fast     # 已有依赖时快速启动
npm run dev:server         # Express，默认 9011
npm run dev:frontend       # Vite，默认 3000
npm run test
npm run lint
npm run typescript
npm run build
npm run smoke              # 对已启动环境做端到端验收
npm run docs:check
```

`npm run smoke` 依赖 MarkLogic、后端、Embedding 和前端均已启动；单元测试不应依赖这些活服务。

## 环境变量

以 `.env.example` 为唯一清单。关键项：

- `PORT`：Express 端口，默认 `9011`。
- `MARKLOGIC_BASE_URL`、`MARKLOGIC_USER`、`MARKLOGIC_PASSWORD`：MarkLogic 连接。
- `REACT_BACKEND_URL`：前端访问后端的地址。
- `REACT_LEAFLET_*`、`REACT_MAP_*`：地图资源。
- `LLM_*`、`PHOENIX_*`：可选 LLM 与可观测性配置。

不要把本机绝对路径、临时截图路径、当前已安装工具或密钥写入项目文档。

## 权威文档

| 主题 | 文档 |
| --- | --- |
| 项目安装、接口与启动 | `README.md` |
| 文档分类和当前/历史边界 | `docs/README.md` |
| API 契约 | `docs/reference/api-contract-v1.md` |
| 部署与运行 | `docs/reference/deployment-plan.md` |
| Git 提交约定 | `docs/standards/git-commit-convention.md` |
| 代码实施流程 | `docs/standards/code-implementation-workflow.md` |

`docs/analysis/`、`docs/refactor/` 和 `docs/archive/` 中的计划、诊断与历史材料不是当前运行事实；与代码或上述权威文档冲突时，以代码和权威文档为准。
