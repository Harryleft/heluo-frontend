/**
 * 文本嵌入网关
 *
 * 封装文本向量化服务，提供统一的嵌入向量获取接口。
 * 底层使用 embeddingService 实现，支持缓存和批量操作。
 *
 * @module server/src/infra/gateways/embeddingGateway
 */

import {
  getEmbedding as serviceGetEmbedding,
  getEmbeddings as serviceGetEmbeddings,
  cosineSimilarity as serviceCosineSimilarity,
  getEmbeddingConfig,
  getEmbeddingCacheStats,
  clearEmbeddingCache,
} from '../../services/embeddingService.js'

// ============================================================================
// 公共接口
// ============================================================================

/**
 * 获取单个文本的嵌入向量
 *
 * @param {string} text - 输入文本
 * @returns {Promise<number[]>} 嵌入向量（768 维）
 * @throws {Error} 如果输入文本为空
 */
export async function getEmbedding(text) {
  return serviceGetEmbedding(text)
}

/**
 * 批量获取嵌入向量
 *
 * @param {string[]} texts - 文本数组
 * @returns {Promise<(number[]|null)[]>} 向量数组（与输入顺序对应，失败的项为 null）
 */
export async function getEmbeddings(texts) {
  return serviceGetEmbeddings(texts)
}

/**
 * 计算两个向量的余弦相似度
 *
 * @param {number[]} vec1 - 向量1
 * @param {number[]} vec2 - 向量2
 * @returns {number} 相似度（-1 到 1）
 */
export function cosineSimilarity(vec1, vec2) {
  return serviceCosineSimilarity(vec1, vec2)
}

/**
 * 获取嵌入服务配置信息
 *
 * @returns {object} 配置对象
 */
export function getEmbeddingGatewayConfig() {
  return getEmbeddingConfig()
}

/**
 * 获取缓存统计信息
 *
 * @returns {{size: number, maxSize: number}} 缓存统计
 */
export function getCacheStats() {
  return getEmbeddingCacheStats()
}

/**
 * 清空嵌入缓存
 */
export function clearCache() {
  clearEmbeddingCache()
}

// ============================================================================
// 默认导出
// ============================================================================

export default {
  getEmbedding,
  getEmbeddings,
  cosineSimilarity,
  getEmbeddingGatewayConfig,
  getCacheStats,
  clearCache,
}
