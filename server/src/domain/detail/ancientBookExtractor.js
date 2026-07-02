/**
 * 古籍详情提取模块（重导出入口）
 *
 * 保持向后兼容，从模块化子目录重新导出所有 API
 *
 * @module server/src/domain/detail/ancientBookExtractor
 */

// 从子模块重新导出所有公共 API
export {
  // 主提取器
  extractAncientBookDetail,

  // URI 解析
  isAncientBookEntryUri,
  classifyAncientBookHierarchyLevel,
  extractAncientBookBookId,
  extractAncientBookVolumeMeta,
  extractAncientBookTxtBookMeta,

  // 层次结构
  buildAncientBookHierarchy,

  // 工具函数
  normalizeText,
  extractIdFromUri,
  pickNodeLabel,
  extractDocText,
  pickRowTitle,
} from './ancientBook/index.js'

// 默认导出保持兼容
export { default } from './ancientBook/index.js'
