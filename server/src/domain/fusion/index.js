/**
 * 融合领域模块入口
 *
 * 统一导出融合查询相关的业务逻辑：
 * - 查询规划（关键词提取、意图推断、维度规划）
 * - 候选重排序（作用域加权、来源评分）
 * - 答案构建（模板答案、侧边栏）
 *
 * @module server/src/domain/fusion
 */

// 查询规划
import {
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
} from './queryPlanner.js'

// 候选重排序
import { rerankFusionCandidates } from './candidateReranker.js'

// 答案构建
import {
  createFusionDetailLink,
  createFusionIiifOpenUrl,
  trimFusionTextForLlm,
  buildFusionPoemContext,
  buildFusionAnswerText,
  buildFusionSidebarItems,
} from './answerBuilder.js'

import queryPlanner from './queryPlanner.js'
import candidateReranker from './candidateReranker.js'
import answerBuilder from './answerBuilder.js'

// 命名导出
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
  // 子模块
  queryPlanner,
  candidateReranker,
  answerBuilder,
}

// 默认导出
export default {
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
  rerankFusionCandidates,
  createFusionDetailLink,
  createFusionIiifOpenUrl,
  trimFusionTextForLlm,
  buildFusionPoemContext,
  buildFusionAnswerText,
  buildFusionSidebarItems,
  queryPlanner,
  candidateReranker,
  answerBuilder,
}
