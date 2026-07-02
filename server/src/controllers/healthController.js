/**
 * 健康检查控制器
 *
 * 处理 /health 请求，返回服务健康状态
 *
 * @module server/src/controllers/healthController
 */

// ============================================================================
// 响应格式化工具
// ============================================================================

/**
 * API v1 统一响应格式
 *
 * @param {object} data - 响应数据
 * @param {object|null} meta - 元数据
 * @returns {object} 格式化响应
 */
export function apiV1Response(data, meta = null) {
  const response = {
    success: true,
    data: data,
    error: null,
  }
  if (meta) {
    response.meta = meta
  }
  return response
}

/**
 * API v1 错误响应格式
 *
 * @param {string} code - 错误码
 * @param {string} message - 错误消息
 * @param {object|null} details - 错误详情
 * @param {number} statusCode - HTTP 状态码
 * @returns {Error} 错误对象
 */
export function apiV1Error(code, message, details = null, statusCode = 400) {
  const error = {
    success: false,
    error: {
      code,
      message,
    },
  }
  if (details) {
    error.error.details = details
  }
  const errorObj = new Error(message)
  errorObj.statusCode = statusCode
  errorObj.response = error
  return errorObj
}

// ============================================================================
// 控制器工厂
// ============================================================================

/**
 * 创建健康检查控制器
 *
 * @param {object} dependencies - 依赖注入
 * @param {string} dependencies.marklogicBaseUrl - MarkLogic 基础 URL
 * @returns {object} 控制器方法
 */
export function createHealthController(dependencies) {
  const { marklogicBaseUrl } = dependencies

  return {
    /**
     * GET /health
     * 返回服务健康状态
     *
     * @param {object} _req - Express 请求对象
     * @param {object} res - Express 响应对象
     */
    health(_req, res) {
      res.json({
        ok: true,
        runtime: 'node',
        marklogic: marklogicBaseUrl,
      })
    },
  }
}

// ============================================================================
// 默认导出
// ============================================================================

export default {
  createHealthController,
  apiV1Response,
  apiV1Error,
}
