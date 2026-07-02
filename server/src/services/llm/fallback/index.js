/**
 * 降级策略模块入口
 *
 * @module server/src/services/llm/fallback
 */

export {
  ensurePoemListCoverage,
} from './fusionFallback.js'

export { buildPersonAiIntroFallback } from './personIntroFallback.js'
