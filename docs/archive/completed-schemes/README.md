# 已完成方案归档

本目录存放已全部落地或被取代的技术方案文档。

这些文档记录了当时的决策过程和设计思路，具有历史参考价值，但不再是当前开发的有效指引。

## 归档清单

| 文档 | 归档原因 | 原始位置 | 归档日期 |
|------|----------|----------|----------|
| 答辩演示持久缓存方案.md | 已被「统一缓存方案」完全取代 | `docs/方案/` | 2026-04-10 |
| 统一缓存方案-检索推荐地理轨迹.md | Phase 1-2 已完成，代码已落地（`src/lib/cache/unifiedCache.ts`） | `docs/方案/` | 2026-04-10 |
| 融合问答通用化与GraphRAG升级方案.md | P0/P1 已落地（`queryPlanner.js` + `candidateReranker.js`），P2 待定 | `docs/方案/` | 2026-04-10 |

## 活代码对照

若需验证方案是否已落地，可对照以下代码文件：

- 统一缓存底座：`src/lib/cache/unifiedCache.ts`
- 融合检索槽位提取：`server/src/domain/fusion/queryPlanner.js`
- 约束感知重排：`server/src/domain/fusion/candidateReranker.js`
