/**
 * MarkLogic 数据库网关
 *
 * 封装 MarkLogic 数据库操作，提供统一的数据访问接口。
 * 使用 Digest 认证与 MarkLogic REST API 通信。
 *
 * @module server/src/infra/gateways/marklogicGateway
 */

import DigestClient from 'digest-fetch'
import { marklogicConfig, searchConfig, isJsonLdDirectory } from '../../bootstrap/config.js'

// ============================================================================
// MarkLogic 客户端初始化
// ============================================================================

/**
 * MarkLogic Digest 认证客户端
 */
const mlClient = new DigestClient(marklogicConfig.user, marklogicConfig.password, {
  algorithm: marklogicConfig.algorithm,
})

/**
 * 默认 fetch 函数（使用 Digest 认证）
 */
const defaultMarklogicFetch = (...args) => mlClient.fetch(...args)

/**
 * 当前使用的 fetch 函数（可被测试替换）
 */
let marklogicFetch = defaultMarklogicFetch

// ============================================================================
// 公共接口
// ============================================================================

/**
 * 设置测试用的 mock fetch 函数
 *
 * @param {Function} fetchFn - 替代的 fetch 函数
 */
export function setMarklogicFetchForTest(fetchFn) {
  marklogicFetch = fetchFn
}

/**
 * 重置为默认的 MarkLogic fetch 函数
 */
export function resetMarklogicFetch() {
  marklogicFetch = defaultMarklogicFetch
}

/**
 * 获取 JSON 文档
 *
 * @param {string} url - 请求 URL
 * @param {object} init - fetch 初始化选项
 * @returns {Promise<object|null>} JSON 对象或 null（请求失败时）
 */
export async function mlGetJson(url, init = {}) {
  const response = await marklogicFetch(url, init)
  if (!response.ok) return null
  return response.json()
}

/**
 * 获取原始文档
 *
 * @param {string} uri - 文档 URI
 * @returns {Promise<object|null>} 文档对象或 null
 */
export async function mlGetDoc(uri, options = {}) {
  const { allowWhenJsonLdOnly = false } = options
  if (searchConfig.jsonLdOnly && !allowWhenJsonLdOnly && !String(uri || '').startsWith('/processed/json-ld/')) {
    return null
  }
  const params = new URLSearchParams({ uri, format: 'json' })
  const url = `${marklogicConfig.baseUrl}/v1/documents?${params.toString()}`
  return mlGetJson(url)
}

/**
 * 按目录搜索文档
 *
 * @param {string} directory - 目录路径
 * @param {string} query - 搜索关键词
 * @param {number} pageLength - 每页结果数
 * @returns {Promise<{total: number, results: Array}>} 搜索结果
 */
export async function mlSearchByDirectory(directory, query, pageLength, options = {}) {
  const { allowWhenJsonLdOnly = false } = options
  if (searchConfig.jsonLdOnly && !allowWhenJsonLdOnly && !isJsonLdDirectory(directory)) {
    return { total: 0, results: [] }
  }
  const params = new URLSearchParams({
    format: 'json',
    directory,
    q: query,
    pageLength: String(pageLength),
  })
  const url = `${marklogicConfig.baseUrl}/v1/search?${params.toString()}`
  return (await mlGetJson(url)) || { total: 0, results: [] }
}

/**
 * 按集合搜索文档
 *
 * @param {string} collection - 集合名称
 * @param {string} query - 搜索关键词
 * @param {number} pageLength - 每页结果数
 * @returns {Promise<{total: number, results: Array}>} 搜索结果
 */
export async function mlSearchByCollection(collection, query, pageLength, options = {}) {
  const { allowWhenJsonLdOnly = false } = options
  if (searchConfig.jsonLdOnly && !allowWhenJsonLdOnly) {
    return { total: 0, results: [] }
  }
  const params = new URLSearchParams({
    format: 'json',
    collection,
    q: query,
    pageLength: String(pageLength),
  })
  const url = `${marklogicConfig.baseUrl}/v1/search?${params.toString()}`
  return (await mlGetJson(url)) || { total: 0, results: [] }
}

/**
 * 获取 MarkLogic 配置信息（只读）
 *
 * @returns {object} 配置对象
 */
export function getMarklogicConfig() {
  return {
    baseUrl: marklogicConfig.baseUrl,
    user: marklogicConfig.user,
    algorithm: marklogicConfig.algorithm,
  }
}

// ============================================================================
// 默认导出
// ============================================================================

export default {
  setMarklogicFetchForTest,
  resetMarklogicFetch,
  mlGetJson,
  mlGetDoc,
  mlSearchByDirectory,
  mlSearchByCollection,
  getMarklogicConfig,
}
