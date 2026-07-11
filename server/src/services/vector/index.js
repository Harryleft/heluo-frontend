/**
 * MarkLogic 向量搜索服务
 * 使用 MarkLogic 的向量搜索功能进行语义相似度检索
 *
 * 增强功能：
 * - 对于 poem/text 结果，自动关联获取完整诗文信息
 * - 返回标题、作者、完整内容等丰富信息
 */

import { cosineSimilarity as cosineSimilarityUtil } from '../embeddingService.js'
import { VECTOR_CONFIG } from './config.js'
import {
  applyPoemLayeredQuota,
  buildVectorResultBase,
  resolveCandidatePoolSize,
  validateVectorDimension,
  vectorResultKey,
} from './resultUtils.js'
import { fetchLexicalCandidates, marklogicFetchWithTimeout } from './transport.js'
import { fetchDocumentJsonCached, getPoemFullInfo, getPoemFullText } from './documentEnrichment.js'

export { VECTOR_CONFIG }

async function mapWithConcurrency(items = [], limit = 4, iterator = async (item) => item) {
  const output = new Array(items.length)
  const queue = items.map((_, index) => index)
  const workerCount = Math.max(1, Math.min(Number(limit) || 1, queue.length || 1))

  const runWorker = async () => {
    while (queue.length) {
      const index = queue.shift()
      if (index == null) return
      output[index] = await iterator(items[index], index)
    }
  }

  await Promise.all(new Array(workerCount).fill(null).map(() => runWorker()))
  return output
}

/**
 * 执行向量相似度搜索（内部函数）
 *
 * @param {string} indexPath - 向量索引路径
 * @param {number[]} queryVector - 查询向量 (768维)
 * @param {object} options - 搜索选项
 * @param {function} marklogicFetch - MarkLogic fetch 函数
 * @param {string} marklogicBaseUrl - MarkLogic 基础 URL
 * @returns {Promise<Array>} 搜索结果
 */
export async function executeVectorSearch(indexPath, queryVector, options, marklogicFetch, marklogicBaseUrl) {
  const topK = options.topK || VECTOR_CONFIG.defaultTopK
  const candidatePoolSize = resolveCandidatePoolSize(options, topK)
  const lexicalCandidatePoolSize = Number(options.lexicalCandidatePoolSize) || VECTOR_CONFIG.lexicalCandidatePoolSize
  const docFetchConcurrency = Math.max(1, Number(options.docFetchConcurrency) || VECTOR_CONFIG.docFetchConcurrency)
  const enrichTopKFactor = Math.min(4, Math.max(1, Number(options.enrichTopKFactor) || VECTOR_CONFIG.enrichTopKFactor))
  const enrichTopNMax = Math.max(topK, Number(options.enrichTopNMax) || VECTOR_CONFIG.enrichTopNMax)
  const queryText = String(options.queryText || '').trim()

  // 确保目录路径以 '/' 结尾（MarkLogic 要求）
  const normalizedPath = indexPath.endsWith('/') ? indexPath : `${indexPath}/`

  // 步骤1：获取目录下的候选文档
  const requestBody = {
    search: {
      query: {
        queries: [
          {
            'directory-query': {
              uri: [normalizedPath],
            },
          },
        ],
      },
      options: {
        'return-results': true,
        'return-facets': false,
        'page-length': candidatePoolSize,
      },
    },
  }

  const searchResponse = await marklogicFetchWithTimeout(
    marklogicFetch,
    `${marklogicBaseUrl}/v1/search`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(requestBody),
    },
    `vectorCandidateSearch:${normalizedPath}`,
  )

  if (!searchResponse.ok) {
    const errorText = await searchResponse.text().catch(() => 'Unknown error')
    throw new Error(`向量搜索失败: ${searchResponse.status} - ${errorText}`)
  }

  const searchData = await searchResponse.json()
  const vectorCandidates = Array.isArray(searchData?.results) ? searchData.results : []
  let lexicalCandidates = []
  try {
    lexicalCandidates = await fetchLexicalCandidates(
      normalizedPath,
      queryText,
      lexicalCandidatePoolSize,
      marklogicFetch,
      marklogicBaseUrl,
    )
  } catch (error) {
    console.warn(
      `[VectorSearch] 关键词候选补充失败 path=${normalizedPath}: ${error?.message || String(error)}`,
    )
  }
  const mergedCandidatesMap = new Map()
  for (const row of [...vectorCandidates, ...lexicalCandidates]) {
    const uri = String(row?.uri || '').trim()
    if (!uri || mergedCandidatesMap.has(uri)) continue
    mergedCandidatesMap.set(uri, row)
  }
  const mergedCandidates = Array.from(mergedCandidatesMap.values())
  console.log(
    `[VectorSearch] 获取候选文档 path=${normalizedPath}, vector=${vectorCandidates.length}, lexical=${lexicalCandidates.length}, merged=${mergedCandidates.length}, total=${searchData.total || 0}`,
  )

  // 阶段1：并发读取文档并仅计算相似度，先完成粗排
  const stage1Rows = await mapWithConcurrency(mergedCandidates, docFetchConcurrency, async (result) => {
    try {
      const doc = await fetchDocumentJsonCached(
        result?.uri,
        marklogicFetch,
        marklogicBaseUrl,
        `vectorDoc:${normalizedPath}`,
      )
      if (!doc) return null

      const docEmbedding = doc.embedding
      if (!docEmbedding || !Array.isArray(docEmbedding)) return null

      const similarity = cosineSimilarityUtil(queryVector, docEmbedding)
      if (similarity < VECTOR_CONFIG.similarityThreshold) return null

      return buildVectorResultBase({
        result,
        doc,
        indexPath: normalizedPath,
        similarity,
      })
    } catch (error) {
      console.warn(`[VectorSearch] 获取文档 ${result?.uri || ''} 失败:`, error?.message || String(error))
      return null
    }
  })

  const dedupedStage1 = new Map()
  for (const row of stage1Rows.filter(Boolean)) {
    const key = vectorResultKey(row)
    if (!key) continue
    const existing = dedupedStage1.get(key)
    if (!existing || Number(row.similarity || 0) > Number(existing.similarity || 0)) {
      dedupedStage1.set(key, row)
    }
  }
  const coarseRanked = Array.from(dedupedStage1.values()).sort((a, b) => b.similarity - a.similarity)
  if (coarseRanked.length === 0) return []

  // 阶段2：仅对前置 TopN 候选执行详情/全文补查，避免全量重补查
  const enrichTopN = Math.min(
    coarseRanked.length,
    Math.max(topK, Math.ceil(topK * enrichTopKFactor), 1),
    enrichTopNMax,
  )
  const enrichTargets = coarseRanked.slice(0, enrichTopN)

  const enrichedTargets = await mapWithConcurrency(enrichTargets, Math.min(docFetchConcurrency, 8), async (row) => {
    const next = { ...row }
    const poemId = String(row?.poemId || '').trim()
    if (!poemId) return next

    const fullInfo = await getPoemFullInfo(poemId, marklogicFetch, marklogicBaseUrl)
    if (fullInfo) {
      next.title = fullInfo.title || next.title
      next.author = fullInfo.author
      next.dynasty = fullInfo.dynasty
      next.intro = fullInfo.intro
      if (fullInfo.fullText) {
        next.fullText = fullInfo.fullText
      }
    }

    if (next._isTxt && !next.fullText) {
      next.fullText = await getPoemFullText(poemId, marklogicFetch, marklogicBaseUrl)
    }

    if (next._frontendUrl?.startsWith('/details?')) {
      next.frontendUrl = next._frontendUrl
    } else {
      const detailUri = `/processed/json-ld/poem/set/poem_${poemId}.json`
      next.frontendUrl = `/details?uri=${encodeURIComponent(detailUri)}`
    }
    return next
  })

  const enrichedMap = new Map()
  for (const row of enrichedTargets) {
    const key = vectorResultKey(row)
    if (!key) continue
    enrichedMap.set(key, row)
  }

  const mergedRanked = coarseRanked.map((row) => {
    const key = vectorResultKey(row)
    if (!key || !enrichedMap.has(key)) return row
    return enrichedMap.get(key)
  })

  return mergedRanked
    .map((row) => {
      const output = { ...row }
      delete output._isTxt
      delete output._frontendUrl
      return output
    })
    .slice(0, topK)
}

/**
 * 向量搜索服务类
 */
class VectorSearchService {
  constructor() {
    this.config = VECTOR_CONFIG
  }

  /**
   * 获取实体类型对应的向量索引路径
   * @param {string} scope - 实体类型
   * @returns {string[]} 向量索引路径数组
   */
  getIndexPaths(scope) {
    return this.config.indexPaths[scope] || []
  }

  /**
   * 执行向量搜索
   * @param {string} scope - 实体类型
   * @param {number[]} queryVector - 查询向量
   * @param {object} options - 搜索选项
   * @param {function} marklogicFetch - MarkLogic fetch 函数
   * @param {string} marklogicBaseUrl - MarkLogic 基础 URL
   * @returns {Promise<Array>} 搜索结果
   */
  async search(scope, queryVector, options, marklogicFetch, marklogicBaseUrl) {
    // 检查是否启用向量搜索
    if (!this.config.enabled) {
      return []
    }

    // 验证向量维度
    if (!validateVectorDimension(queryVector)) {
      console.warn(
        `[VectorSearch] 向量维度不匹配: 期望 ${this.config.vectorDimension}, 实际 ${queryVector?.length}`,
      )
      return []
    }

    // 获取索引路径
    const indexPaths = this.getIndexPaths(scope)
    console.log(`[VectorSearch] scope=${scope}, indexPaths=${JSON.stringify(indexPaths)}`)
    if (indexPaths.length === 0) {
      console.warn(`[VectorSearch] 未知的实体类型: ${scope}`)
      return []
    }

    // 对每个路径并行搜索，避免单一路径阻塞整个 scope
    const settledResults = await Promise.all(
      indexPaths.map(async (indexPath) => {
        const startedAt = Date.now()
        try {
          const results = await executeVectorSearch(indexPath, queryVector, options, marklogicFetch, marklogicBaseUrl)
          console.log(
            `[VectorSearch] path=${indexPath} status=ok elapsedMs=${Date.now() - startedAt} size=${results.length}`,
          )
          return results
        } catch (error) {
          console.error(
            `[VectorSearch] 查询 ${indexPath} 失败 elapsedMs=${Date.now() - startedAt}:`,
            error.message,
          )
          return []
        }
      }),
    )
    const allResults = settledResults.flat()

    // 按 poemId 去重（保留相似度最高的）
    const uniqueResults = new Map()
    for (const result of allResults) {
      const key = result.poemId || result.uri
      const existing = uniqueResults.get(key)
      if (!existing || result.similarity > existing.similarity) {
        uniqueResults.set(key, result)
      }
    }

    // 按相似度排序并返回
    const topK = options.topK || this.config.defaultTopK
    const sorted = Array.from(uniqueResults.values()).sort((a, b) => b.similarity - a.similarity)

    if (scope === 'poem') {
      return applyPoemLayeredQuota(sorted, topK, this.config)
    }

    return sorted.slice(0, topK)
  }

  /**
   * 检查向量搜索是否可用
   * @returns {boolean}
   */
  isEnabled() {
    return this.config.enabled
  }

  /**
   * 获取配置
   */
  getConfig() {
    return { ...this.config }
  }
}

// ========== 导出 ==========
const vectorSearchService = new VectorSearchService()

export { VectorSearchService }

export const mlVectorSearch = (scope, queryVector, options, marklogicFetch, marklogicBaseUrl) =>
  vectorSearchService.search(scope, queryVector, options, marklogicFetch, marklogicBaseUrl)

export const isVectorSearchEnabled = () => vectorSearchService.isEnabled()

export const getVectorSearchConfig = () => vectorSearchService.getConfig()

export default vectorSearchService

