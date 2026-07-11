# heluo-react-fullstack

河洛历史名人发现平台（JS 全栈版本）。

当前项目结构：
- 前端：根目录 `src/`（React + TypeScript + Vite）
- 后端：`server/`（Node.js + Express，直连 MarkLogic）

## 1. 环境要求

- Node.js 20+
- npm 10+
- 可访问的 MarkLogic 服务

## 2. 安装依赖

在仓库根目录执行：

```bash
npm install
```

## 3. 配置环境变量

后端配置（根目录 `.env`）：

```bash
cp .env.example .env
```

关键变量：
- `PORT`：后端端口（默认 `9011`）
- `MARKLOGIC_BASE_URL`：MarkLogic 地址（默认 `http://localhost:8003`）
- `MARKLOGIC_USER` / `MARKLOGIC_PASSWORD`

前端配置（同样写入根目录 `.env`，已包含在 `.env.example`）：

```bash
cp .env.example .env
```

- `REACT_BACKEND_URL` 默认 `http://127.0.0.1:9011`
- `REACT_LEAFLET_JS_URL` / `REACT_LEAFLET_CSS_URL` / `REACT_MAP_TILE_URL`：可选地图资源配置

## 4. 启动

一键安装依赖、生成本地配置、启动前端/后端/Embedding，并等待端到端健康检查通过：

```bash
npm run bootstrap
```

已有依赖时可运行 `npm run bootstrap:fast`。默认健康检查覆盖 MarkLogic 文档数、后端、统计、搜索、IIIF、Embedding 和前端首页；缺少任何依赖都会明确失败。只在诊断启动问题时使用 `bash scripts/start-all.sh --no-health`。

开发时也可以分别启动：

```bash
npm run dev:server
npm run dev:frontend
```

访问：
- 前端：`http://127.0.0.1:3000`
- 后端健康检查：`http://127.0.0.1:9011/health`

对已经运行的环境重新验收：

```bash
npm run smoke
```

## 5. 主要接口

- `GET /stats/entity-counts`
- `GET /api/v1/search?q=杜甫&type=poem&page=1&pageSize=5`
- `GET /api/v1/poems/poem_31848?format=set`
- `GET /api/v1/ancient-books/17270_303?uri=/processed/json-ld/ancient_book/ancient_book_set/book_entry/17270_303.json`
- `POST /api/v1/fusion/query`
- `POST /api/v1/fusion/stream`
- `GET /api/v1/iiif/volume-heads?manifest=<manifest-url>`
- `ALL /ml/*`（MarkLogic 代理）

## 6. 说明

- `poem` 检索已按“整组诗文（poem/set）”返回，不再按句子级分散。
- 详情接口对诗文支持 `poemDetail` 字段（标题、作者、全文）。
- IIIF 查看器采用 `Mirador`，不包含认证流程。

## 7. 注意

- 本仓库已切换为 JS 全栈，不再维护 Python 后端启动方式。

## 8. Commands

项目提供统一命令入口：

```bash
npm run cmd -- <子命令>
```

常用子命令：

- `npm run cmd:check`：执行 `eslint + tsc`
- `npm run cmd:build`：执行构建
- `npm run cmd:single-file-commit-check`：检查是否满足单文件提交流程
- `npm run cmd:docs-init -- <name>`：在 `docs/` 下生成分析模板
- `npm run cmd:server-health`：检查后端健康接口（默认 `http://127.0.0.1:9011/health`）
