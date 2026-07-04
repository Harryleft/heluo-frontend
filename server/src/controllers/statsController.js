/**
 * 统计接口控制器
 *
 * 处理 /stats/entity-counts 请求，返回实体统计信息
 *
 * @module server/src/controllers/statsController
 */

import { getEntityDirectories } from '../bootstrap/config.js'

// ============================================================================
// 控制器工厂
// ============================================================================

/**
 * 创建统计控制器
 *
 * @param {object} dependencies - 依赖注入
 * @param {object} dependencies.gateways - 网关依赖
 * @returns {object} 控制器方法
 */
export function createStatsController(dependencies) {
  const { gateways } = dependencies
  const { mlSearchByDirectory, mlSearchByCollection } = gateways
  const conceptFallbackCollections = ['/heluo/concepts']

  /**
   * 统计各类实体数量
   *
   * @param {string} directory - 搜索目录
   * @returns {Promise<number>} 实体数量
   */
  async function countByDirectory(directory) {
    const data = await mlSearchByDirectory(directory, '*', 1)
    return Number(data?.total || 0)
  }

  async function countByCollection(collection) {
    const data = await mlSearchByCollection(collection, '*', 1, { allowWhenJsonLdOnly: true })
    return Number(data?.total || 0)
  }

  async function countByPrimaryDirectories(scope) {
    const directories = getEntityDirectories(scope)
    if (!directories.length) return 0
    const totals = await Promise.all(directories.map((directory) => countByDirectory(directory)))
    return totals.reduce((sum, total) => sum + total, 0)
  }

  async function countByDirectoriesOrCollections(scope, collections) {
    const directoryTotal = await countByPrimaryDirectories(scope)
    if (directoryTotal > 0) return directoryTotal

    const deduplicatedCollections = [...new Set(collections)]
    const values = await Promise.all(deduplicatedCollections.map((collection) => countByCollection(collection)))
    return Math.max(...values, 0)
  }

  /**
   * 统计古籍条目数量（支持回退到集合口径）
   *
   * @returns {Promise<number>} 古籍数量
   */
  async function countAncientBookEntries() {
    const directoryTotal = await countByDirectory('/processed/json-ld/ancient-book/set/book-entry/')
    if (directoryTotal > 0) return directoryTotal

    // 回退到集合口径，兼容仅有 collection 的历史环境
    const values = await Promise.all(
      [...new Set(['/heluo/ancient-books/sets'])].map(
        async (collection) => {
          const data = await mlSearchByCollection(collection, '*', 1, { allowWhenJsonLdOnly: true })
          return Number(data?.total || 0)
        }
      )
    )
    return Math.max(...values, 0)
  }

  async function countConceptEntries() {
    const directoryTotal = await countByPrimaryDirectories('concept')
    if (directoryTotal > 0) return directoryTotal

    const values = await Promise.all(
      conceptFallbackCollections.map(async (collection) => {
        const data = await mlSearchByCollection(collection, '*', 1, { allowWhenJsonLdOnly: true })
        return Number(data?.total || 0)
      }),
    )
    return Math.max(...values, 0)
  }

  return {
    /**
     * GET /stats/entity-counts
     * 返回各类实体统计数量
     *
     * @param {object} _req - Express 请求对象
     * @param {object} res - Express 响应对象
     */
    async entityCounts(_req, res) {
      try {
        const [person, poemSet, book, ancientBook, geography, concept] = await Promise.all([
          countByDirectoriesOrCollections('person', ['/heluo/persons']),
          countByDirectoriesOrCollections('poem', ['/heluo/poems/sets', '/heluo/poems/texts']),
          countByDirectoriesOrCollections('book', ['/heluo/books']),
          countAncientBookEntries(),
          countByDirectoriesOrCollections('place', ['/heluo/places']),
          countConceptEntries(),
        ])

        res.json({ person, poemSet, book, ancientBook, geography, concept })
      } catch (error) {
        console.error('Error in GET /stats/entity-counts:', error)
        res.json({
          person: 0,
          poemSet: 0,
          book: 0,
          ancientBook: 0,
          geography: 0,
          concept: 0,
          degraded: true,
        })
      }
    },
  }
}

// ============================================================================
// 默认导出
// ============================================================================

export default {
  createStatsController,
}
