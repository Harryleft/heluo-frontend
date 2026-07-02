/**
 * 向量搜索服务兼容入口
 *
 * 保持原导入路径不变，内部实现迁移到 services/vector 目录。
 */

export {
  VECTOR_CONFIG,
  executeVectorSearch,
  VectorSearchService,
  mlVectorSearch,
  isVectorSearchEnabled,
  getVectorSearchConfig,
} from './vector/index.js'

export { default } from './vector/index.js'
