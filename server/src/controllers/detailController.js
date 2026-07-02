/**
 * 详情接口控制器
 *
 * 处理各类实体详情接口：
 * - /api/v1/persons/:id
 * - /api/v1/poems/:id
 * - /api/v1/books/:id
 * - /api/v1/places/:id
 * - /api/v1/concepts/:id
 * - /api/v1/ancient-books/:id
 *
 * @module server/src/controllers/detailController
 */

import { apiV1Response, apiV1Error } from './healthController.js'
import { parsePaginationParams } from './searchController.js'
import { getPersonPoemTrack } from '../domain/track/poemTrackService.js'

// ============================================================================
// URI 工具函数
// ============================================================================

/**
 * 从 URI 提取资源 ID
 *
 * @param {string} uri - 文档 URI
 * @returns {string} 资源 ID
 */
export function extractIdFromUri(uri) {
  if (!uri) return ''
  const segments = uri.split('/')
  const lastSegment = segments[segments.length - 1] || ''
  return lastSegment.replace(/\.json$/i, '')
}

/**
 * 判断是否为向量或片段 URI
 *
 * @param {string} uri - URI
 * @returns {boolean}
 */
function isLikelyVectorOrFragmentUri(uri) {
  const value = String(uri || '').toLowerCase()
  if (!value) return false
  return value.includes('/json-ld-vector/') || value.includes('/heluo/vector/') || value.includes('/processed/vector/')
}

/**
 * 判断是否为人物主 URI
 *
 * @param {string} uri - URI
 * @returns {boolean}
 */
function isPersonPrimaryUri(uri) {
  const value = String(uri || '').toLowerCase()
  if (!value || isLikelyVectorOrFragmentUri(value)) return false
  return (
    value.includes('/processed/entities/person/') ||
    value.includes('/heluo/persons/') ||
    value.includes('/heluo/person/') ||
    value.includes('/person/') ||
    value.includes('/persons/')
  )
}

/**
 * 判断是否为诗文集合 URI
 *
 * @param {string} uri - URI
 * @returns {boolean}
 */
function isPoemSetUri(uri) {
  const value = String(uri || '')
  return value.startsWith('/processed/json-ld/poem/set/')
}

/**
 * 判断是否为诗文文本 URI
 *
 * @param {string} uri - URI
 * @returns {boolean}
 */
function isPoemTextUri(uri) {
  const value = String(uri || '')
  return value.startsWith('/processed/json-ld/poem/txt/')
}

/**
 * 判断是否为古籍条目 URI
 *
 * @param {string} uri - URI
 * @returns {boolean}
 */
function isAncientBookEntryUri(uri) {
  const value = String(uri || '')
  if (!value) return false
  if (value.startsWith('/processed/iiif/collections/') || value.startsWith('/heluo/iiif/collections/')) return false
  if (value.includes('/ancient_book_set/department/') || value.includes('/ancient_book_set/root/')) return false
  return value.startsWith('/processed/json-ld/ancient_book/ancient_book_set/book_entry/')
}

function getRequestOrigin(req) {
  const protocol = String(req.protocol || 'http').trim() || 'http'
  const host = String(req.get('host') || '').trim()
  return host ? `${protocol}://${host}` : ''
}

// ============================================================================
// 控制器工厂
// ============================================================================

/**
 * 创建详情控制器
 *
 * @param {object} dependencies - 依赖注入
 * @param {object} dependencies.useCases - 用例依赖
 * @param {object} dependencies.gateways - 网关依赖
 * @returns {object} 控制器方法
 */
export function createDetailController(dependencies) {
  const { useCases, gateways } = dependencies
  const { getDetail } = useCases
  const { mlGetDoc, mlSearchByDirectory } = gateways

  /**
   * 通用实体查找逻辑
   *
   * @param {string} id - 实体 ID
   * @param {string[]} possibleUris - 可能的 URI 列表
   * @param {string[]} searchDirectories - 搜索目录列表
   * @returns {Promise<{doc: object|null, uri: string}>}
   */
  async function findEntity(id, possibleUris, searchDirectories) {
    let doc = null
    let uri = ''

    // 尝试直接获取
    for (const possibleUri of possibleUris) {
      doc = await mlGetDoc(possibleUri)
      if (doc) {
        uri = possibleUri
        break
      }
    }

    // 如果直接查找失败，尝试搜索
    if (!doc && searchDirectories.length > 0) {
      for (const directory of searchDirectories) {
        const searchData = await mlSearchByDirectory(directory, id, 10)
        const match = (searchData.results || []).find(
          (row) => String(row?.uri || '').includes(id) || extractIdFromUri(row?.uri) === id
        )
        if (match) {
          uri = match.uri
          doc = await mlGetDoc(uri)
          if (doc) break
        }
      }
    }

    return { doc, uri }
  }

  return {
    /**
     * GET /api/v1/persons/:id
     * 获取人物详情
     *
     * @param {object} req - Express 请求对象
     * @param {object} res - Express 响应对象
     */
    async getPerson(req, res) {
      const id = String(req.params.id || '').trim()
      try {
        if (!id) {
          throw apiV1Error('INVALID_PARAMS', '人物 ID 不能为空', null, 400)
        }

        const result = await getDetail.executeById({
          id,
          type: 'person',
        })

        if (!result) {
          throw apiV1Error('NOT_FOUND', `未找到 ID 为 ${id} 的人物`, { id }, 404)
        }

        res.json(apiV1Response(result))
      } catch (error) {
        if (error.response) {
          return res.status(error.statusCode).json(error.response)
        }
        console.error('Error in GET /api/v1/persons/:id:', error)
        res.status(500).json(apiV1Error('INTERNAL_ERROR', '服务器内部错误', String(error), 500).response)
      }
    },

    /**
     * GET /api/v1/persons/:id/poem-track
     * 获取人物诗文地理轨迹
     *
     * @param {object} req - Express 请求对象
     * @param {object} res - Express 响应对象
     */
    async getPersonPoemTrack(req, res) {
      const id = String(req.params.id || '').trim()
      try {
        if (!id) {
          throw apiV1Error('INVALID_PARAMS', '人物 ID 不能为空', null, 400)
        }

        const result = await getPersonPoemTrack(id, { mlGetDoc: gateways.mlGetDoc })

        res.json(apiV1Response(result))
      } catch (error) {
        const errorMessage = String(error?.message || error)
        if (errorMessage.includes('未找到') || errorMessage.includes('not found')) {
          return res.status(404).json(apiV1Error('PERSON_NOT_FOUND', errorMessage, { id }, 404).response)
        }

        if (error.response) {
          return res.status(error.statusCode).json(error.response)
        }
        console.error('Error in GET /api/v1/persons/:id/poem-track:', error)
        res.status(500).json(apiV1Error('INTERNAL_ERROR', '服务器内部错误', String(error), 500).response)
      }
    },

    /**
     * GET /api/v1/persons
     * 获取人物列表
     *
     * @param {object} req - Express 请求对象
     * @param {object} res - Express 响应对象
     */
    async listPersons(req, res) {
      try {
        const { page, pageSize } = parsePaginationParams(req.query, 20, 100)
        const q = String(req.query.q || '').trim() || '*'

        const result = await getDetail.listEntities({
          entityType: 'person',
          query: q,
          page,
          pageSize,
        })

        res.json(
          apiV1Response(
            {
              items: result.items,
              total: result.total,
              page,
              pageSize,
              totalPages: result.totalPages,
            },
            { total: result.total, page, pageLength: pageSize }
          )
        )
      } catch (error) {
        console.error('Error in GET /api/v1/persons:', error)
        res.status(500).json(apiV1Error('INTERNAL_ERROR', '服务器内部错误', String(error), 500).response)
      }
    },

    /**
     * GET /api/v1/poems/:id
     * 获取诗文详情
     *
     * @param {object} req - Express 请求对象
     * @param {object} res - Express 响应对象
     */
    async getPoem(req, res) {
      try {
        const id = String(req.params.id || '').trim()
        const format = String(req.query.format || 'set').trim()

        if (!id) {
          throw apiV1Error('INVALID_PARAMS', '诗文 ID 不能为空', null, 400)
        }

        const result = await getDetail.executeById({
          id,
          type: 'poem',
        })

        if (!result) {
          throw apiV1Error('NOT_FOUND', `未找到 ID 为 ${id} 的诗文`, { id }, 404)
        }

        res.json(apiV1Response(result))
      } catch (error) {
        if (error.response) {
          return res.status(error.statusCode).json(error.response)
        }
        console.error('Error in GET /api/v1/poems/:id:', error)
        res.status(500).json(apiV1Error('INTERNAL_ERROR', '服务器内部错误', String(error), 500).response)
      }
    },

    /**
     * GET /api/v1/poems
     * 获取诗文列表
     *
     * @param {object} req - Express 请求对象
     * @param {object} res - Express 响应对象
     */
    async listPoems(req, res) {
      try {
        const { page, pageSize } = parsePaginationParams(req.query, 20, 100)
        const q = String(req.query.q || '').trim() || '*'

        const result = await getDetail.listEntities({
          entityType: 'poem',
          query: q,
          page,
          pageSize,
        })

        res.json(
          apiV1Response(
            {
              items: result.items,
              total: result.total,
              page,
              pageSize,
              totalPages: result.totalPages,
            },
            { total: result.total, page, pageLength: pageSize }
          )
        )
      } catch (error) {
        console.error('Error in GET /api/v1/poems:', error)
        res.status(500).json(apiV1Error('INTERNAL_ERROR', '服务器内部错误', String(error), 500).response)
      }
    },

    /**
     * GET /api/v1/books/:id
     * 获取图书详情
     *
     * @param {object} req - Express 请求对象
     * @param {object} res - Express 响应对象
     */
    async getBook(req, res) {
      try {
        const id = String(req.params.id || '').trim()
        if (!id) {
          throw apiV1Error('INVALID_PARAMS', '图书 ID 不能为空', null, 400)
        }

        const result = await getDetail.executeById({
          id,
          type: 'book',
        })

        if (!result) {
          throw apiV1Error('NOT_FOUND', `未找到 ID 为 ${id} 的图书`, { id }, 404)
        }

        res.json(apiV1Response(result))
      } catch (error) {
        if (error.response) {
          return res.status(error.statusCode).json(error.response)
        }
        console.error('Error in GET /api/v1/books/:id:', error)
        res.status(500).json(apiV1Error('INTERNAL_ERROR', '服务器内部错误', String(error), 500).response)
      }
    },

    /**
     * GET /api/v1/places/:id
     * 获取地点详情
     *
     * @param {object} req - Express 请求对象
     * @param {object} res - Express 响应对象
     */
    async getPlace(req, res) {
      try {
        const id = String(req.params.id || '').trim()
        if (!id) {
          throw apiV1Error('INVALID_PARAMS', '地点 ID 不能为空', null, 400)
        }

        const result = await getDetail.executeById({
          id,
          type: 'place',
        })

        if (!result) {
          throw apiV1Error('NOT_FOUND', `未找到 ID 为 ${id} 的地点`, { id }, 404)
        }

        res.json(apiV1Response(result))
      } catch (error) {
        if (error.response) {
          return res.status(error.statusCode).json(error.response)
        }
        console.error('Error in GET /api/v1/places/:id:', error)
        res.status(500).json(apiV1Error('INTERNAL_ERROR', '服务器内部错误', String(error), 500).response)
      }
    },

    /**
     * GET /api/v1/concepts/:id
     * 获取概念详情
     *
     * @param {object} req - Express 请求对象
     * @param {object} res - Express 响应对象
     */
    async getConcept(req, res) {
      try {
        const id = String(req.params.id || '').trim()
        if (!id) {
          throw apiV1Error('INVALID_PARAMS', '概念 ID 不能为空', null, 400)
        }

        const result = await getDetail.executeById({
          id,
          type: 'concept',
        })

        if (!result) {
          throw apiV1Error('NOT_FOUND', `未找到 ID 为 ${id} 的概念`, { id }, 404)
        }

        res.json(apiV1Response(result))
      } catch (error) {
        if (error.response) {
          return res.status(error.statusCode).json(error.response)
        }
        console.error('Error in GET /api/v1/concepts/:id:', error)
        res.status(500).json(apiV1Error('INTERNAL_ERROR', '服务器内部错误', String(error), 500).response)
      }
    },

    /**
     * GET /api/v1/ancient-books/:id
     * 获取古籍详情
     *
     * @param {object} req - Express 请求对象
     * @param {object} res - Express 响应对象
     */
    async getAncientBook(req, res) {
      try {
        const id = String(req.params.id || '').trim()
        const sourceUri = String(req.query.uri || '').trim()

        if (!id) {
          throw apiV1Error('INVALID_PARAMS', '古籍 ID 不能为空', null, 400)
        }

        // 优先使用 query.uri
        if (sourceUri) {
          const result = await getDetail.execute({
            uri: sourceUri,
            useCache: false,
          })
          if (result) {
            return res.json(apiV1Response(result))
          }
        }

        // 否则按 ID 查找
        const result = await getDetail.executeById({
          id,
          type: 'ancient_book',
        })

        if (!result) {
          throw apiV1Error('NOT_FOUND', `未找到 ID 为 ${id} 的古籍`, { id }, 404)
        }

        res.json(apiV1Response(result))
      } catch (error) {
        if (error.response) {
          return res.status(error.statusCode).json(error.response)
        }
        console.error('Error in GET /api/v1/ancient-books/:id:', error)
        res.status(500).json(apiV1Error('INTERNAL_ERROR', '服务器内部错误', String(error), 500).response)
      }
    },

    /**
     * GET /api/v1/iiif/volume-heads
     * 获取 IIIF 清单的卷首 Canvas 列表
     *
     * @param {object} req - Express 请求对象
     * @param {object} res - Express 响应对象
     */
    async getIiifVolumeHeads(req, res) {
      try {
        const manifest = String(req.query.manifest || '').trim()
        if (!manifest) {
          throw apiV1Error('INVALID_PARAMS', 'manifest 参数不能为空', null, 400)
        }

        let manifestUrl
        try {
          manifestUrl = new URL(manifest)
        } catch {
          throw apiV1Error('INVALID_PARAMS', 'manifest 参数必须是合法 URL', { manifest }, 400)
        }

        if (!['http:', 'https:'].includes(manifestUrl.protocol)) {
          throw apiV1Error('INVALID_PARAMS', 'manifest 协议仅支持 http/https', { manifest }, 400)
        }

        const result = await getDetail.getIiifVolumeHeads(manifestUrl.toString())

        res.json(
          apiV1Response({
            manifest: manifestUrl.toString(),
            volumeHeads: result.volumeHeads,
          })
        )
      } catch (error) {
        if (error.response) {
          return res.status(error.statusCode).json(error.response)
        }
        console.error('Error in GET /api/v1/iiif/volume-heads:', error)
        res.status(500).json(apiV1Error('INTERNAL_ERROR', '服务器内部错误', String(error), 500).response)
      }
    },

    /**
     * GET /iiif/**
     * 读取公开 IIIF 文档。
     *
     * @param {object} req - Express 请求对象
     * @param {object} res - Express 响应对象
     */
    async getIiifDocument(req, res) {
      try {
        const result = await getDetail.getIiifDocumentByPath(req.path, getRequestOrigin(req))
        res.json(result)
      } catch (error) {
        const message = String(error?.message || error)
        if (message.includes('不存在')) {
          return res.status(404).json(apiV1Error('NOT_FOUND', 'IIIF 文档不存在', { path: req.path }, 404).response)
        }
        if (message.includes('无效')) {
          return res.status(400).json(apiV1Error('INVALID_PARAMS', 'IIIF 路径无效', { path: req.path }, 400).response)
        }
        console.error(`Error in GET ${req.path}:`, error)
        res.status(500).json(apiV1Error('INTERNAL_ERROR', '服务器内部错误', String(error), 500).response)
      }
    },

    /**
     * GET /iiif/3/search/ancientBook/:bookId/:carrierId
     * 搜索 IIIF manifest 文本内容。
     *
     * @param {object} req - Express 请求对象
     * @param {object} res - Express 响应对象
     */
    async searchIiifContent(req, res) {
      try {
        const bookId = String(req.params.bookId || '').trim()
        const carrierId = String(req.params.carrierId || '').trim()
        const query = String(req.query.q || '').trim()

        if (!bookId || !carrierId || !query) {
          throw apiV1Error('INVALID_PARAMS', 'bookId、carrierId、q 参数不能为空', { bookId, carrierId, query }, 400)
        }

        const result = await getDetail.searchIiifContent({
          bookId,
          carrierId,
          query,
          publicOrigin: getRequestOrigin(req),
        })
        res.json(result)
      } catch (error) {
        if (error.response) {
          return res.status(error.statusCode).json(error.response)
        }
        console.error(`Error in GET ${req.path}:`, error)
        res.status(500).json(apiV1Error('INTERNAL_ERROR', '服务器内部错误', String(error), 500).response)
      }
    },
  }
}

// ============================================================================
// 默认导出
// ============================================================================

export default {
  createDetailController,
  extractIdFromUri,
}
