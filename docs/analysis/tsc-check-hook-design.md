# TypeScript 增量编译验证 Hook 设计

## 背景

前端代码（`src/`）每次被 Edit/Write 修改后，自动运行 TypeScript 类型检查，
及时发现类型错误，避免问题累积。

## 核心机制

```mermaid
flowchart TD
    A[PostToolUse: Edit/Write] --> B{是 src/ 下的 .ts/.tsx?}
    B -- 否 --> Z[静默退出]
    B -- 是 --> C{缓存文件存在?}
    C -- 否 --> D[运行 tsc --noEmit 全量检查]
    C -- 是 --> E{缓存中所有 .ts 时间戳<br/>都早于 tsc 编译时间?}
    E -- 是 --> Z
    E -- 否 --> D
    D --> F{检查通过?}
    F -- 是 --> G[更新缓存时间戳<br/>输出通过信息]
    F -- 否 --> H[更新缓存时间戳<br/>输出错误详情]
    D --> G
```

## 缓存策略

- **缓存文件**: `.claude/cache/tsc-check.json`
- **内容**: `{ lastCheckTime: <epoch_ms>, lastExitCode: <number> }`
- **失效条件**: `src/` 下任意 `.ts`/`.tsx` 文件的 mtime > lastCheckTime
- **首次运行**: 缓存不存在，强制全量检查

### 为什么用文件时间戳而非 git status

- 能捕获未暂存的修改（工作区脏状态）
- 不依赖 git 状态，hook 在 git 操作前也能工作
- 性能开销极小（仅 stat 调用）

## 超时策略

| 场景 | 超时 |
|------|------|
| 首次全量检查 | 60s |
| 增量检查（缓存命中后不触发） | 不执行，0 开销 |
| tsc 进程被 kill | 视为失败，不更新缓存 |

## 与现有 hooks 的关系

```mermaid
flowchart LR
    subgraph PostToolUse
        A[auto-optimize.mjs<br/>优化建议]
        B[tsc-check.mjs<br/>类型检查]
    end
    A -- 已有 --> C[Edit/Write]
    B -- 新增 --> C
```

两个 hook 并行运行，互不依赖。tsc-check 始终 exit(0) 不阻塞。
