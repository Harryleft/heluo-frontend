/**
 * 古籍详情提取模块入口
 *
 * 统一导出所有子模块的公共 API
 *
 * @module server/src/domain/detail/ancientBook
 */

// 主提取器
export { extractAncientBookDetail } from './extractor.js'

// URI 解析
export {
  isAncientBookEntryUri,
  classifyAncientBookHierarchyLevel,
  extractAncientBookBookId,
  extractAncientBookVolumeMeta,
  extractAncientBookTxtBookMeta,
} from './uriParser.js'

// 层次结构
export {
  buildAncientBookHierarchy,
  pickAncientBookHierarchyParentNode,
  dedupeAncientBookHierarchy,
} from './hierarchy.js'

// 工具函数
export {
  normalizeText,
  extractIdFromUri,
  extractMarkText,
  pickNodeLabel,
  extractDocText,
  pickRowTitle,
} from './utils.js'

// Manifest 解析
export {
  buildAncientBookCollectionManifestUri,
  normalizeAncientBookManifestUri,
  resolveAncientBookManifestUris,
  extractIiifManifestUris,
} from './manifestResolver.js'

// 文本提取
export {
  extractAncientBookVolumeText,
  collectNestedTextFragments,
  resolveAncientBookVolumeText,
} from './textExtractor.js'

// 默认导出（兼容旧代码）
export { default } from './extractor.js'
