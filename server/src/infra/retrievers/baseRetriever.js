/**
 * 检索器基类
 *
 * 定义所有检索器的通用接口和基础功能。
 * 所有具体检索器（Keyword/Vector/Hybrid）都应继承此基类。
 *
 * @module server/src/infra/retrievers/baseRetriever
 */

// ============================================================================
// 搜索结果类型定义
// ============================================================================

/**
 * @typedef {Object} SearchResult
 * @property {string} uri - 文档 URI
 * @property {string} id - 实体 ID
 * @property {string} title - 标题
 * @property {string} [name] - 名称（兼容字段）
 * @property {string} [_label] - 标签（兼容字段）
 * @property {string} [snippet] - 摘要片段
 * @property {string} [type] - 实体类型
 * @property {number} [score] - 关键词匹配分数
 * @property {number} [confidence] - 置信度
 * @property {number} [similarity] - 向量相似度
 * @property {number} [vectorScore] - 向量分数
 * @property {number} [keywordScore] - 关键词分数
 * @property {number} [hybridScore] - 混合分数
 * @property {number} [rrfScore] - RRF 排序分数
 * @property {string} source - 来源标识: 'keyword' | 'vector' | 'hybrid'
 */

/**
 * @typedef {Object} SearchOptions
 * @property {number} [pageLength=20] - 每页结果数
 * @property {string} [directoryMode='all'] - 目录搜索模式: 'all' | 'first_non_empty'
 * @property {string[]} [directories=[]] - 搜索目录列表
 * @property {string[]} [collections=[]] - 搜索集合列表
 */

/**
 * @typedef {Object} SearchResponse
 * @property {SearchResult[]} rows - 搜索结果列表
 * @property {number} total - 总结果数
 */

// ============================================================================
// 基类定义
// ============================================================================

/**
 * 检索器基类
 *
 * 提供检索器的通用接口定义和基础工具方法。
 * 子类必须实现 search 方法。
 */
export class BaseRetriever {
  /**
   * @param {object} gateways - 网关依赖
   * @param {object} gateways.marklogic - MarkLogic 网关
   * @param {object} gateways.embedding - Embedding 网关
   * @param {object} config - 配置对象
   */
  constructor(gateways, config) {
    /** @type {object} 网关依赖 */
    this.gateways = gateways

    /** @type {object} 配置对象 */
    this.config = config

    /** @type {string} 检索器名称 */
    this.name = 'base'
  }

  /**
   * 执行搜索
   *
   * 子类必须实现此方法。
   *
   * @param {string} query - 查询文本
   * @param {string} scope - 实体类型
   * @param {SearchOptions} options - 搜索选项
   * @returns {Promise<SearchResponse>} 搜索结果
   * @throws {Error} 如果未实现
   */
  async search(query, scope, options = {}) {
    throw new Error(`${this.name}.search() 未实现`)
  }

  /**
   * 获取检索器名称
   *
   * @returns {string} 检索器名称
   */
  getName() {
    return this.name
  }

  /**
   * 安全转换为浮点数
   *
   * @param {*} value - 输入值
   * @returns {number} 安全的浮点数
   */
  safeFloat(value) {
    const num = Number(value)
    return Number.isFinite(num) ? num : 0
  }

  /**
   * 归一化文本
   *
   * @param {*} value - 输入值
   * @returns {string} 归一化后的文本
   */
  normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim()
  }
}

// ============================================================================
// 默认导出
// ============================================================================

export default BaseRetriever
