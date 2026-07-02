/**
 * 详情领域模块入口
 *
 * 统一导出各类实体的详情提取逻辑：
 * - 人物详情提取
 * - 诗文详情提取
 * - 图书详情提取
 * - 地点详情提取
 * - 概念详情提取
 * - 古籍详情提取
 *
 * @module server/src/domain/detail
 */

// 人物详情
import { extractPersonDetail } from './personExtractor.js'

// 诗文详情
import {
  isPoemSetUri,
  isPoemTextUri,
  extractPoemAuthor,
  extractPoemFullText,
  extractPoemDetail,
  buildPoemSetDetail,
  buildPoemDetailForLegacy,
} from './poemExtractor.js'

// 图书详情
import { extractBookDetail } from './bookExtractor.js'

// 地点详情
import { extractPlaceDetail } from './placeExtractor.js'

// 概念详情
import { extractConceptDetail } from './conceptExtractor.js'

// 古籍详情
import {
  isAncientBookEntryUri,
  extractAncientBookBookId,
  extractAncientBookVolumeMeta,
  extractAncientBookTxtBookMeta,
  classifyAncientBookHierarchyLevel,
  buildAncientBookHierarchy,
  extractAncientBookDetail,
} from './ancientBookExtractor.js'

// IIIF 提取
import {
  extractVolumeHeadsFromIiifManifest,
  resolveCanvasMeta,
  extractCanvasThumbnails,
  normalizeManifestLikeWithCanvas,
  pickIiifLabelText,
} from './iiifExtractor.js'

// 子模块默认导出
import personExtractor from './personExtractor.js'
import poemExtractor from './poemExtractor.js'
import bookExtractor from './bookExtractor.js'
import placeExtractor from './placeExtractor.js'
import conceptExtractor from './conceptExtractor.js'
import ancientBookExtractor from './ancientBookExtractor.js'
import iiifExtractor from './iiifExtractor.js'

// 命名导出
export {
  // 人物
  extractPersonDetail,
  // 诗文
  isPoemSetUri,
  isPoemTextUri,
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
  isAncientBookEntryUri,
  extractAncientBookBookId,
  extractAncientBookVolumeMeta,
  extractAncientBookTxtBookMeta,
  classifyAncientBookHierarchyLevel,
  buildAncientBookHierarchy,
  extractAncientBookDetail,
  // IIIF
  extractVolumeHeadsFromIiifManifest,
  resolveCanvasMeta,
  extractCanvasThumbnails,
  normalizeManifestLikeWithCanvas,
  pickIiifLabelText,
  // 子模块
  personExtractor,
  poemExtractor,
  bookExtractor,
  placeExtractor,
  conceptExtractor,
  ancientBookExtractor,
  iiifExtractor,
}

// 默认导出
export default {
  extractPersonDetail,
  isPoemSetUri,
  isPoemTextUri,
  extractPoemAuthor,
  extractPoemFullText,
  extractPoemDetail,
  buildPoemSetDetail,
  buildPoemDetailForLegacy,
  extractBookDetail,
  extractPlaceDetail,
  extractConceptDetail,
  isAncientBookEntryUri,
  extractAncientBookBookId,
  extractAncientBookVolumeMeta,
  extractAncientBookTxtBookMeta,
  classifyAncientBookHierarchyLevel,
  buildAncientBookHierarchy,
  extractAncientBookDetail,
  extractVolumeHeadsFromIiifManifest,
  resolveCanvasMeta,
  extractCanvasThumbnails,
  normalizeManifestLikeWithCanvas,
  pickIiifLabelText,
  personExtractor,
  poemExtractor,
  bookExtractor,
  placeExtractor,
  conceptExtractor,
  ancientBookExtractor,
  iiifExtractor,
}
