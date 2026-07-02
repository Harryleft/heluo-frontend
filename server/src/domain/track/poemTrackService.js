/**
 * 人物诗文地理轨迹服务模块
 *
 * 提供按人物ID查询诗文创作轨迹的功能，包括：
 * - 按人物ID查询诗文
 * - 提取创作时间和地点信息
 * - 聚合数据为轨迹点格式
 *
 * @module server/src/domain/track/poemTrackService
 */

import { mlGetDoc, mlSearchByDirectory } from '../../infra/gateways/marklogicGateway.js'
import {
  poemTrackCache,
  makePoemTrackCacheKey,
} from '../../utils/cacheManager.js'

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 规范化文本
 *
 * @param {any} value - 输入值
 * @returns {string} 规范化后的文本
 */
function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

/**
 * 从节点中提取标签
 *
 * @param {object|string} node - 节点对象或字符串
 * @returns {string} 标签文本
 */
function pickNodeLabel(node) {
  if (typeof node === 'string') return node.trim()
  if (!node || typeof node !== 'object') return ''
  for (const key of ['_label', 'content', 'label', 'name', 'title', '@value', 'value']) {
    const value = node[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

/**
 * 从 URI 提取资源 ID
 *
 * @param {string} uri - 文档 URI
 * @returns {string} 资源 ID
 */
function extractIdFromUri(uri) {
  if (!uri) return ''
  const segments = uri.split('/')
  const lastSegment = segments[segments.length - 1] || ''
  return lastSegment.replace(/\.json$/i, '')
}

/**
 * 从 timespan 提取年份
 *
 * @param {object} timespan - 时间跨度对象
 * @returns {number|null} 年份或 null
 */
function extractYear(timespan) {
  if (!timespan || typeof timespan !== 'object') return null

  // 优先从 _label 解析（如 "754年"）
  if (timespan._label) {
    const match = timespan._label.match(/(\d{3,4})/)
    if (match) return parseInt(match[1], 10)
  }

  // 从 begin_of_the_begin 解析（如 "0754-01-01T00:00:00Z"）
  if (timespan.begin_of_the_begin) {
    const match = timespan.begin_of_the_begin.match(/(\d{4})/)
    if (match) return parseInt(match[1], 10)
  }

  return null
}

/**
 * 解析 WKT POINT 格式坐标
 *
 * @param {string} wkt - WKT 字符串，如 "POINT(108.946306 34.347436)"
 * @returns {{lng: number, lat: number}|null} 坐标对象或 null
 */
function parseWktPoint(wkt) {
  if (typeof wkt !== 'string') return null
  const match = wkt.match(/POINT\s*\(\s*([\d.-]+)\s+([\d.-]+)\s*\)/i)
  if (!match) return null
  return {
    lng: parseFloat(match[1]),
    lat: parseFloat(match[2]),
  }
}

// ============================================================================
// 核心查询函数
// ============================================================================

/**
 * 并发控制执行器
 *
 * 限制并发任务数量，避免压垮后端服务
 *
 * @param {Array} items - 待处理项数组
 * @param {Function} asyncFn - 异步处理函数
 * @param {number} concurrency - 最大并发数
 * @returns {Promise<Array>} 处理结果数组
 */
async function withConcurrency(items, asyncFn, concurrency = 50) {
  const results = []
  const executing = new Set()

  for (const item of items) {
    const promise = asyncFn(item).then((result) => {
      executing.delete(promise)
      return result
    })
    results.push(promise)
    executing.add(promise)

    if (executing.size >= concurrency) {
      await Promise.race(executing)
    }
  }

  return Promise.all(results)
}

/**
 * 验证诗文作者是否匹配指定人物
 *
 * @param {object} doc - 诗文文档
 * @param {string} personId - 人物ID
 * @returns {boolean} 是否匹配
 */
function checkPoemAuthorMatch(doc, personId) {
  if (!doc) return false

  const createdBy = Array.isArray(doc.created_by) ? doc.created_by : [doc.created_by]

  for (const created of createdBy) {
    if (!created || typeof created !== 'object') continue
    const carried = Array.isArray(created.carried_out_by)
      ? created.carried_out_by
      : [created.carried_out_by]
    const match = carried.some((actor) => {
      if (!actor || !actor.id) return false
      const actorId = String(actor.id).split('/').pop()
      return actorId === personId
    })
    if (match) return true
  }

  return false
}

/**
 * 查询某人物的所有诗文（并发版本）
 *
 * 在诗文集合目录中搜索包含人物ID的诗文，并验证作者匹配。
 * 使用并发查询优化性能，从串行 75秒 降低到 2-5秒。
 *
 * @param {string} personId - 人物ID（如 "17270"）
 * @returns {Promise<Array<{uri: string, doc: object}>>} 诗文列表
 */
export async function queryPoemsByPerson(personId) {
  const normalizedPersonId = String(personId || '').trim()
  if (!normalizedPersonId) return []

  console.log(`[PoemTrack] 开始查询人物 ${normalizedPersonId} 的诗文...`)
  const searchStartTime = Date.now()

  // 在诗文集合目录中搜索（支持大量诗文）
  const searchData = await mlSearchByDirectory(
    '/processed/json-ld/poem/set/',
    normalizedPersonId,
    2000
  )

  const uris = (searchData.results || [])
    .map((row) => row.uri)
    .filter(Boolean)

  console.log(`[PoemTrack] 搜索到 ${uris.length} 个候选诗文 URI`)

  // 并发获取所有诗文文档（最多 50 个并发）
  const docFetchStartTime = Date.now()
  const poemPromises = await withConcurrency(
    uris,
    async (uri) => {
      const doc = await mlGetDoc(uri)
      return { uri, doc }
    },
    50 // 最大并发数
  )

  console.log(
    `[PoemTrack] 并发获取 ${uris.length} 个文档耗时: ${Date.now() - docFetchStartTime}ms`
  )

  // 过滤出作者匹配的诗文
  const poems = poemPromises.filter(({ doc }) =>
    checkPoemAuthorMatch(doc, normalizedPersonId)
  )

  console.log(
    `[PoemTrack] 查询完成，共 ${poems.length} 首诗文匹配，总耗时: ${Date.now() - searchStartTime}ms`
  )

  return poems
}

/**
 * 从地点文档中提取历史名称
 *
 * @param {object} doc - 地点 JSON-LD 文档
 * @returns {Array<{name: string, period: string}>} 历史名称列表
 */
export function extractHistoricalNames(doc) {
  if (!doc || typeof doc !== 'object') return []

  const attributedBy = Array.isArray(doc.attributed_by) ? doc.attributed_by : [doc.attributed_by]

  return attributedBy
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      name: pickNodeLabel(item) || '',
      period: item.timespan ? pickNodeLabel(item.timespan) : '',
    }))
    .filter((item) => item.name)
}

/**
 * 获取地点详细信息（含坐标和历史名称）
 *
 * @param {string} placeUri - 地点 URI
 * @returns {Promise<{uri: string, label: string, lat: number, lng: number, historicalNames: Array}|null>}
 */
export async function getPlaceInfo(placeUri) {
  if (!placeUri) return null

  // 从 URI 提取地点 ID
  const placeId = extractIdFromUri(placeUri)

  // 尝试多个可能的 URI
  const possibleUris = [
    `/processed/json-ld/place/${placeId}.json`,
    `/processed/json-ld/place/${placeId}`,
    placeUri,
  ]

  for (const uri of possibleUris) {
    const doc = await mlGetDoc(uri)
    if (doc) {
      const label = pickNodeLabel(doc) || placeId
      const geo = parseWktPoint(doc.defined_by)
      const historicalNames = extractHistoricalNames(doc)

      if (geo) {
        return {
          uri: placeUri,
          label,
          lat: geo.lat,
          lng: geo.lng,
          historicalNames,
        }
      }
    }
  }

  return null
}

// ============================================================================
// 数据聚合函数
// ============================================================================

/**
 * 从诗文文档中提取轨迹信息
 *
 * @param {object} doc - 诗文文档
 * @returns {{year: number|null, placeUri: string|null, placeLabel: string|null}}
 */
function extractPoemTrackInfo(doc) {
  const createdBy = Array.isArray(doc.created_by) ? doc.created_by : [doc.created_by]
  let year = null
  let placeUri = null
  let placeLabel = null

  for (const created of createdBy) {
    if (!created || typeof created !== 'object') continue

    // 提取年份
    if (created.timespan && year === null) {
      year = extractYear(created.timespan)
    }

    // 提取地点
    if (created.took_place_at && placeUri === null) {
      const places = Array.isArray(created.took_place_at)
        ? created.took_place_at
        : [created.took_place_at]
      if (places[0] && places[0].id) {
        placeUri = places[0].id
        placeLabel = pickNodeLabel(places[0])
      }
    }
  }

  return { year, placeUri, placeLabel }
}

/**
 * 构建人物诗文地理轨迹（并发版本）
 *
 * 使用并发查询优化地点信息获取，从串行 2.5秒 降低到 100-300ms。
 *
 * @param {string} personId - 人物 ID
 * @param {string} personName - 人物名称
 * @param {Array} poems - 诗文列表（queryPoemsByPerson 返回）
 * @param {object} personDoc - 人物文档（可选，用于提取生卒年）
 * @returns {Promise<object>} PersonPoemTrack 数据结构
 */
export async function buildPersonPoemTrack(personId, personName, poems, personDoc = null) {
  console.log(`[PoemTrack] 开始构建 ${personName} 的轨迹数据，共 ${poems.length} 首诗文`)
  const buildStartTime = Date.now()

  // 提取人物生卒年
  let birth = null
  let death = null
  let dynasty = ''

  if (personDoc && typeof personDoc === 'object') {
    // 提取朝代
    const timespan = personDoc.timespan || personDoc.born_or_active
    if (timespan && typeof timespan === 'object') {
      dynasty = pickNodeLabel(timespan) || ''
    }

    // 提取生卒年
    if (timespan && typeof timespan === 'object') {
      const beginText = pickNodeLabel(timespan.begin_of_the_begin || timespan.begin)
      const endText = pickNodeLabel(timespan.end_of_the_end || timespan.end)

      if (beginText) {
        const match = String(beginText).match(/(\d{3,4})/)
        if (match) birth = parseInt(match[1], 10)
      }
      if (endText) {
        const match = String(endText).match(/(\d{3,4})/)
        if (match) death = parseInt(match[1], 10)
      }
    }
  }

  // 第一步：提取所有诗文的轨迹信息，收集需要查询的地点 URI
  const poemTrackInfos = new Map() // poemUri -> trackInfo
  const uniquePlaceUris = new Set()

  for (const { uri, doc } of poems) {
    const poemId = extractIdFromUri(uri)
    const title = pickNodeLabel(doc) || '未命名诗文'
    const trackInfo = extractPoemTrackInfo(doc)

    poemTrackInfos.set(uri, {
      poemId,
      title,
      year: trackInfo.year,
      placeUri: trackInfo.placeUri,
      placeLabel: trackInfo.placeLabel,
    })

    if (trackInfo.placeUri) {
      uniquePlaceUris.add(trackInfo.placeUri)
    }
  }

  console.log(
    `[PoemTrack] 提取到 ${uniquePlaceUris.size} 个唯一地点 URI，开始并发获取...`
  )

  // 第二步：并发获取所有地点信息
  const placeFetchStartTime = Date.now()
  const placeUriArray = Array.from(uniquePlaceUris)

  const placeInfoResults = await withConcurrency(
    placeUriArray,
    async (placeUri) => {
      const info = await getPlaceInfo(placeUri)
      return { placeUri, info }
    },
    20 // 地点并发数稍低，避免压垮服务
  )

  // 构建地点信息映射
  const placeInfoMap = new Map()
  for (const { placeUri, info } of placeInfoResults) {
    if (info) {
      placeInfoMap.set(placeUri, info)
    }
  }

  console.log(
    `[PoemTrack] 并发获取 ${placeUriArray.length} 个地点耗时: ${Date.now() - placeFetchStartTime}ms`
  )

  // 第三步：按年份和地点聚合诗文
  const trackMap = new Map() // key: `${year}_${placeUri}`
  const undatedPoems = []

  for (const { uri, doc } of poems) {
    const trackInfo = poemTrackInfos.get(uri)
    if (!trackInfo) continue

    const { poemId, title, year, placeUri } = trackInfo

    // 如果没有年份或地点，放入未分组列表
    if (year === null || placeUri === null) {
      undatedPoems.push({
        id: poemId,
        title,
        uri,
      })
      continue
    }

    // 从缓存中获取地点信息
    const placeInfo = placeInfoMap.get(placeUri)

    if (!placeInfo) {
      // 无法获取地点坐标，放入未分组列表
      undatedPoems.push({
        id: poemId,
        title,
        uri,
      })
      continue
    }

    // 按年份+地点聚合
    const key = `${year}_${placeUri}`
    if (!trackMap.has(key)) {
      trackMap.set(key, {
        year,
        yearLabel: `${year}年`,
        place: {
          uri: placeUri,
          label: placeInfo.label,
          lat: placeInfo.lat,
          lng: placeInfo.lng,
          historicalNames: placeInfo.historicalNames || [],
        },
        poems: [],
      })
    }

    trackMap.get(key).poems.push({
      id: poemId,
      title,
      uri,
    })
  }

  // 按年份排序轨迹点
  const trackPoints = Array.from(trackMap.values()).sort((a, b) => a.year - b.year)

  // 计算统计信息
  const totalPoems = poems.length
  const datedPoems = trackPoints.reduce((sum, point) => sum + point.poems.length, 0)
  const placesCount = placeInfoMap.size

  let yearRange = null
  if (trackPoints.length > 0) {
    const years = trackPoints.map((p) => p.year)
    yearRange = {
      start: Math.min(...years),
      end: Math.max(...years),
    }
  }

  console.log(
    `[PoemTrack] 轨迹构建完成: ${trackPoints.length} 个轨迹点, ${undatedPoems.length} 首无日期诗文, 耗时: ${Date.now() - buildStartTime}ms`
  )

  return {
    personId,
    personName,
    lifespan: {
      birth,
      death,
      label: birth || death ? `${birth || '?'}-${death || '?'}` : '',
    },
    dynasty: dynasty || undefined,
    trackPoints,
    undatedPoems,
    stats: {
      totalPoems,
      datedPoems,
      placesCount,
      yearRange,
    },
  }
}

// ============================================================================
// 主入口函数
// ============================================================================

/**
 * 获取人物诗文地理轨迹（完整流程）
 *
 * @param {string} personId - 人物 ID
 * @param {object} dependencies - 依赖注入
 * @param {boolean} dependencies.skipCache - 是否跳过缓存
 * @returns {Promise<object>} PersonPoemTrack 数据结构
 */
export async function getPersonPoemTrack(personId, dependencies = {}) {
  const { mlGetDoc: customMlGetDoc = mlGetDoc, skipCache = false } = dependencies

  const normalizedPersonId = String(personId || '').trim()
  if (!normalizedPersonId) {
    throw new Error('人物 ID 不能为空')
  }

  // 检查缓存
  const cacheKey = makePoemTrackCacheKey(normalizedPersonId)
  if (!skipCache) {
    const cached = poemTrackCache.get(cacheKey)
    if (cached) {
      console.log(`[PoemTrack] 缓存命中: ${cacheKey}`)
      return cached
    }
    console.log(`[PoemTrack] 缓存未命中: ${cacheKey}`)
  }

  // 查询人物文档
  let personDoc = null
  let personName = ''

  const possiblePersonUris = [
    `/processed/json-ld/person/${normalizedPersonId}.json`,
    `/processed/json-ld/person/${normalizedPersonId}`,
    `/data/processed/json-ld/person/${normalizedPersonId}.json`,
    `/data/processed/json-ld/person/${normalizedPersonId}`,
  ]

  for (const uri of possiblePersonUris) {
    personDoc = await customMlGetDoc(uri, { allowWhenJsonLdOnly: true })
    if (personDoc) {
      personName = pickNodeLabel(personDoc) || normalizedPersonId
      break
    }
  }

  if (!personDoc) {
    throw new Error(`未找到 ID 为 ${normalizedPersonId} 的人物`)
  }

  // 查询诗文
  const poems = await queryPoemsByPerson(normalizedPersonId)

  // 构建轨迹
  const result = await buildPersonPoemTrack(normalizedPersonId, personName, poems, personDoc)

  // 存入缓存
  poemTrackCache.set(cacheKey, result)
  console.log(`[PoemTrack] 结果已缓存: ${cacheKey}`)

  return result
}

// ============================================================================
// 默认导出
// ============================================================================

export default {
  queryPoemsByPerson,
  extractHistoricalNames,
  getPlaceInfo,
  buildPersonPoemTrack,
  getPersonPoemTrack,
}
