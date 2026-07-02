/**
 * 领域层统一入口
 *
 * 本模块是领域层的统一导出入口，包含三个子域：
 *
 * - **retrieval（检索域）**: 搜索流程编排、结果合并与排序
 * - **fusion（融合域）**: 查询规划、候选重排序、答案构建
 * - **detail（详情域）**: 各类实体的详情提取逻辑
 *
 * ## 架构原则
 *
 * 1. Domain 层不依赖 HTTP 层（routes/controllers）
 * 2. 可以依赖 infra/gateways 和 infra/retrievers
 * 3. 使用 bootstrap/config.js 中的配置
 * 4. 封装纯业务逻辑，不处理请求/响应
 *
 * @module server/src/domain
 */

import * as retrieval from './retrieval/index.js'
import * as fusion from './fusion/index.js'
import * as detail from './detail/index.js'

// ============================================================================
// 检索域
// ============================================================================

export {
  buildHybridMergeKey,
  mergeRowsByUri,
  mergeHybridRowsByRrf,
  entitySourceMap,
  isPoemSetUri,
  isPoemTextUri,
  isAncientBookEntryUri,
  createSearchOrchestrator,
} from './retrieval/index.js'

// ============================================================================
// 融合域
// ============================================================================

export {
  // 查询规划
  FUSION_ALL_TEXT_DIMS,
  normalizeFusionQuestion,
  parseFusionDims,
  parseFusionTopK,
  normalizeFusionMode,
  parseFusionBoolean,
  parseFusionConversationHistory,
  extractFusionQuotedAnchors,
  extractFusionKeywords,
  expandFusionTopicKeywords,
  inferFusionKeywordType,
  inferFusionPreferredScope,
  isFusionPoemListQuestion,
  applyFusionDimsPolicy,
  computeFusionScopeBoostMap,
  buildFusionQueryPlan,
  // 候选重排序
  rerankFusionCandidates,
  // 答案构建
  createFusionDetailLink,
  createFusionIiifOpenUrl,
  trimFusionTextForLlm,
  buildFusionPoemContext,
  buildFusionAnswerText,
  buildFusionSidebarItems,
} from './fusion/index.js'

// ============================================================================
// 详情域
// ============================================================================

export {
  // 人物
  extractPersonDetail,
  // 诗文
  extractPoemAuthor,
  extractPoemFullText,
  extractPoemDetail,
  buildPoemSetDetail,
  buildPoemDetailForLegacy,
  // 图书
  extractBookDetail,
  // 地点
  extractPlaceDetail,
  // 概念
  extractConceptDetail,
  // 古籍
  extractAncientBookBookId,
  extractAncientBookVolumeMeta,
  extractAncientBookTxtBookMeta,
  classifyAncientBookHierarchyLevel,
  buildAncientBookHierarchy,
  extractAncientBookDetail,
} from './detail/index.js'

// ============================================================================
// 子模块默认导出
// ============================================================================

export { retrieval, fusion, detail }

// 默认导出
export default {
  retrieval,
  fusion,
  detail,
}
