/**
 * 检索领域模块入口
 *
 * 统一导出检索相关的业务逻辑：
 * - 搜索编排（策略选择、流程控制）
 * - 结果合并（去重、排序、RRF 合并）
 *
 * @module server/src/domain/retrieval
 */

import {
  buildHybridMergeKey,
  mergeRowsByUri,
  mergeHybridRowsByRrf,
} from './resultMerger.js'

import {
  entitySourceMap,
  isPoemSetUri,
  isPoemTextUri,
  isAncientBookEntryUri,
  createSearchOrchestrator,
} from './searchOrchestrator.js'

import resultMerger from './resultMerger.js'
import searchOrchestrator from './searchOrchestrator.js'

// 命名导出
export {
  buildHybridMergeKey,
  mergeRowsByUri,
  mergeHybridRowsByRrf,
  entitySourceMap,
  isPoemSetUri,
  isPoemTextUri,
  isAncientBookEntryUri,
  createSearchOrchestrator,
  resultMerger,
  searchOrchestrator,
}

// 默认导出
export default {
  buildHybridMergeKey,
  mergeRowsByUri,
  mergeHybridRowsByRrf,
  entitySourceMap,
  isPoemSetUri,
  isPoemTextUri,
  isAncientBookEntryUri,
  createSearchOrchestrator,
  resultMerger,
  searchOrchestrator,
}
