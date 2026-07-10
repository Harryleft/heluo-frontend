/**
 * 详情获取用例
 *
 * 编排详情获取：根据实体类型选择提取器 → 获取数据 → 格式化输出
 * 支持人物/诗文/书籍/地点/概念/古籍等类型
 *
 * @module server/src/usecases/getDetailUseCase
 */

import { detailConfig } from '../bootstrap/config.js'
import {
  extractPersonDetail,
  extractPoemDetail,
  buildPoemDetailForLegacy,
  extractBookDetail,
  extractPlaceDetail,
  extractConceptDetail,
  extractAncientBookDetail,
  extractVolumeHeadsFromIiifManifest,
} from '../domain/detail/index.js'
import {
  extractIdFromUri,
  normalizeText,
  extractMarkText,
  extractDocText,
  pickRowTitle,
} from '../utils/textUtils.js'
import { createSimpleCache } from './detail/cache.js'
import {
  buildPossibleUris,
  extractCandidateUris,
  getDirectoriesForType,
  inferEntityType,
  isDataJsonLdUri,
  isLikelyVectorOrFragmentUri,
} from './detail/uri.js'
import {
  buildIiifMarklogicCandidates,
  buildIiifSearchResponse,
  extractIiifSearchMatches,
  loadIiifDocumentFromMarkLogicByCandidates,
  parseIiifPublicPath,
  rewriteIiifPublicDocument,
  trimTrailingSlash,
} from './detail/iiif.js'
import { createSearchWithFallback } from './detail/search.js'

// ============================================================================
// 用例类
// ============================================================================

/**
 * 创建详情获取用例
 *
 * @param {object} dependencies - 依赖注入
 * @param {object} dependencies.gateways - 网关依赖
 * @param {object} dependencies.retrievers - 检索器依赖（可选，用于向量推荐）
 * @returns {object} 用例方法
 */
export function createGetDetailUseCase(dependencies) {
  const { gateways, retrievers } = dependencies
  const { mlGetDoc, mlGetJson, mlSearchByDirectory, mlSearchByCollection } = gateways

  // 详情缓存
  const detailCache = createSimpleCache(detailConfig.cacheTtlMs)

  // 创建搜索回退函数
  const searchWithFallback = createSearchWithFallback(gateways)
  const poemDetailDependencies = { mlGetDoc, searchWithFallback }
  const ancientBookGateways = {
    ...gateways,
    mlGetDoc: (uri) => mlGetDoc(uri, { allowWhenJsonLdOnly: true }),
    mlSearchByDirectory: (directory, query, pageLength) => mlSearchByDirectory(
      directory,
      query,
      pageLength,
      { allowWhenJsonLdOnly: true },
    ),
    mlSearchByCollection: (collection, query, pageLength) => mlSearchByCollection(
      collection,
      query,
      pageLength,
      { allowWhenJsonLdOnly: true },
    ),
  }

  /**
   * 获取实体详情
   *
   * @param {object} params - 查询参数
   * @param {string} params.uri - 文档 URI
   * @param {string} params.query - 关联查询（可选，用于推荐）
   * @param {boolean} params.useCache - 是否使用缓存
   * @returns {Promise<object>} 详情结果
   */
  /**
   * 将向量 URI 解析为对应的主实体 URI
   *
   * 向量文档通常包含 id 或 entity_iri 字段指向原始实体文档，
   * 从中提取主实体 URI 后可使用正确的提取器获取完整详情。
   *
   * @param {string} vectorUri - 向量 URI
   * @param {string} suggestedType - 从路径推断的实体类型
   * @returns {Promise<string|null>} 主实体 URI 或 null
   */
  async function resolveVectorToEntityUri(vectorUri, suggestedType) {
    const getDoc = suggestedType === 'ancient_book'
      ? ancientBookGateways.mlGetDoc
      : (docUri) => mlGetDoc(docUri, { allowWhenJsonLdOnly: true })

    const doc = await getDoc(vectorUri)
    if (!doc) return null

    // 从文档中提取候选主 URI（与 searchUnifiedUseCase / fusionShared 对齐）
    const candidates = [
      String(doc.entity_iri || '').trim(),
      String(doc.id || '').trim(),
      String(doc.evidence?.uri || '').trim(),
    ]

    for (const candidate of candidates) {
      if (!candidate || !candidate.startsWith('/') || isLikelyVectorOrFragmentUri(candidate)) continue
      // 验证候选 URI 的文档存在
      const candidateDoc = await getDoc(candidate)
      if (candidateDoc) return candidate
    }

    return null
  }

  async function execute(params) {
    const { uri, query = '', useCache = true } = params

    if (!uri) {
      throw new Error('URI 不能为空')
    }

    // 检查缓存
    const cacheKey = `${uri}::${query}`
    if (useCache) {
      const cached = detailCache.get(cacheKey)
      if (cached) {
        return { ...cached, _cached: true }
      }
    }

    // 向量 URI：尝试解析为实体主 URI 后递归获取
    const initialInferredType = inferEntityType(uri)
    if (isLikelyVectorOrFragmentUri(uri) && initialInferredType !== 'entity' && initialInferredType !== 'iiif') {
      const primaryUri = await resolveVectorToEntityUri(uri, initialInferredType)
      if (primaryUri) {
        return execute({ uri: primaryUri, query, useCache })
      }
    }

    // 获取文档
    const inferredType = initialInferredType
    const docOptions = isDataJsonLdUri(uri) ? { allowWhenJsonLdOnly: true } : undefined
    const doc = inferredType === 'ancient_book'
      ? await ancientBookGateways.mlGetDoc(uri)
      : await mlGetDoc(uri, docOptions)
    if (!doc) {
      return {
        uri,
        title: uri.split('/').pop() || '未命名条目',
        summary: '未读取到详情文档。',
        internalLinks: [],
        externalUris: [],
      }
    }

    // 推断实体类型
    const entityType = inferredType

    // 根据类型选择提取器
    let detail = null
    switch (entityType) {
      case 'person':
        detail = extractPersonDetail(uri, doc)
        break
      case 'poem':
        detail = await buildPoemDetailForLegacy(uri, doc, poemDetailDependencies)
        if (!detail) {
          detail = extractPoemDetail(uri, doc)
        }
        break
      case 'book':
        detail = extractBookDetail(uri, doc)
        break
      case 'place':
        detail = extractPlaceDetail(uri, doc)
        break
      case 'concept':
        detail = extractConceptDetail(uri, doc)
        break
      case 'ancient_book':
        detail = await extractAncientBookDetail(uri, doc, ancientBookGateways)
        break
      default:
        // 通用详情
        detail = {
          id: extractIdFromUri(uri),
          title: pickRowTitle({ uri }, doc),
          summary: extractMarkText(extractDocText(doc), 260) || '暂无摘要',
          uri,
        }
    }

    // 提取外部 URI
    const externalUris = Array.from(
      new Set(
        extractCandidateUris(doc, 40).filter(
          (item) => item.startsWith('http://') || item.startsWith('https://'),
        ),
      ),
    ).slice(0, 12)

    // 构建结果
    const result = {
      ...detail,
      uri,
      type: entityType,
      externalUris,
      doc,
      _cached: false,
    }

    // 写入缓存
    if (useCache) {
      detailCache.set(cacheKey, result)
    }

    return result
  }

  /**
   * 根据 ID 获取详情
   *
   * @param {object} params - 查询参数
   * @param {string} params.id - 实体 ID
   * @param {string} params.type - 实体类型
   * @returns {Promise<object>} 详情结果
   */
  async function executeById(params) {
    const { id, type = 'entity' } = params

    if (!id) {
      throw new Error('ID 不能为空')
    }

    // 构建可能的 URI 列表
    const possibleUris = buildPossibleUris(id, type)

    // 尝试每个 URI
    for (const uri of possibleUris) {
      const doc = await mlGetDoc(uri, { allowWhenJsonLdOnly: true })
      if (doc) {
        return execute({ uri, query: '' })
      }
    }

    // 如果直接查找失败，尝试搜索
    const searchData = await searchWithFallback({
      query: id,
      pageLength: 10,
      directories: getDirectoriesForType(type),
      collections: [],
    })

    const match = (searchData.results || []).find(
      (row) => String(row?.uri || '').includes(id) || extractIdFromUri(row?.uri) === id,
    )

    if (match) {
      return execute({ uri: match.uri, query: '' })
    }

    return null
  }

  /**
   * 清除缓存
   */
  function clearCache() {
    detailCache.clear()
  }

  /**
   * 获取 IIIF Manifest 的卷首列表
   *
   * @param {string} manifestUrl - Manifest URL
   * @returns {Promise<{manifest: string, volumeHeads: Array}>} 卷首列表
   */
  async function getIiifVolumeHeads(manifestUrl) {
    const parsedManifestPath = parseIiifPublicPath(manifestUrl)
    let response = null

    if (parsedManifestPath) {
      try {
        response = await getIiifDocumentByPath(parsedManifestPath)
      } catch {
        response = null
      }
    }

    if (!response) {
      response = await mlGetJson(manifestUrl, {
        headers: { accept: 'application/json' },
      })
    }
    if (!response) {
      throw new Error('IIIF manifest 拉取失败')
    }

    const volumeHeads = extractVolumeHeadsFromIiifManifest(response)
    return {
      manifest: manifestUrl,
      volumeHeads,
    }
  }

  /**
   * 按公开 IIIF 路径读取文档。
   *
   * @param {string} publicPath - 公开路径
   * @param {string} publicOrigin - 对外域名
   * @returns {Promise<object>}
   */
  async function getIiifDocumentByPath(publicPath, publicOrigin = '') {
    const normalizedPath = parseIiifPublicPath(publicPath)
    if (!normalizedPath) {
      throw new Error('IIIF 路径无效')
    }

    const document = await loadIiifDocumentFromMarkLogicByCandidates(
      buildIiifMarklogicCandidates(normalizedPath),
      mlGetDoc,
    )
    if (!document || typeof document !== 'object') {
      throw new Error('IIIF 文档不存在')
    }

    return rewriteIiifPublicDocument(document, publicOrigin)
  }

  /**
   * 搜索 IIIF manifest 文本内容。
   *
   * @param {object} params - 搜索参数
   * @param {string} params.bookId - 书籍 ID
   * @param {string} params.carrierId - 载体 ID
   * @param {string} params.query - 查询文本
   * @param {string} params.publicOrigin - 对外域名
   * @returns {Promise<object>}
   */
  async function searchIiifContent({ bookId, carrierId, query, publicOrigin = '' }) {
    const safeBookId = normalizeText(bookId)
    const safeCarrierId = normalizeText(carrierId)
    const safeQuery = normalizeText(query)

    if (!safeBookId || !safeCarrierId || !safeQuery) {
      throw new Error('IIIF 搜索参数不完整')
    }

    const manifest = await getIiifDocumentByPath(
      `/iiif/manifests/${safeBookId}/manifest.json`,
      publicOrigin,
    )
    const results = extractIiifSearchMatches(manifest, safeQuery)

    return buildIiifSearchResponse({
      query: safeQuery,
      searchUrl: `${trimTrailingSlash(publicOrigin)}/iiif/3/search/ancientBook/${safeBookId}/${safeCarrierId}`,
      results,
    })
  }

  /**
   * 列出实体列表
   *
   * @param {object} params - 查询参数
   * @param {string} params.entityType - 实体类型
   * @param {string} params.query - 查询文本
   * @param {number} params.page - 页码
   * @param {number} params.pageSize - 每页数量
   * @returns {Promise<object>} 列表结果
   */
  async function listEntities(params) {
    const { entityType = 'entity', query = '*', page = 1, pageSize = 20 } = params

    const directories = getDirectoriesForType(entityType)
    if (directories.length === 0) {
      return { items: [], total: 0, totalPages: 0 }
    }

    const start = (page - 1) * pageSize
    const searchData = await searchWithFallback({
      query,
      pageLength: start + pageSize,
      directories,
      collections: [],
    })

    const results = searchData.results || []
    const total = searchData.total || results.length
    const totalPages = Math.ceil(total / pageSize)
    const items = results.slice(start, start + pageSize).map((row) => ({
      id: extractIdFromUri(row?.uri),
      title: row?.title || row?.name || row?._label || extractIdFromUri(row?.uri),
      uri: row?.uri,
      type: entityType,
      snippet: extractMarkText(row?.fullText || row?.text || row?.content || '', 180),
    }))

    return { items, total, totalPages, page, pageSize }
  }

  return {
    execute,
    executeById,
    listEntities,
    clearCache,
    inferEntityType,
    getIiifVolumeHeads,
    getIiifDocumentByPath,
    searchIiifContent,
  }
}


// ============================================================================
// 默认导出
// ============================================================================

export default {
  createGetDetailUseCase,
}
