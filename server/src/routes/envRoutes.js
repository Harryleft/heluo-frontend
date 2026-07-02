/**
 * 运行时配置路由
 *
 * 提供 /env 端点用于前端在运行时读取后端地址等安全配置。
 *
 * @module server/src/routes/envRoutes
 */

// ============================================================================
// 常量
// ============================================================================

const CACHE_CONTROL_VALUE = 'no-store'
const DEFAULT_BACKEND_BASE_URL = '/'

// ============================================================================
// 私有实现
// ============================================================================

function ensureTrailingSlash(value) {
  const text = String(value || '').trim()
  if (!text) return DEFAULT_BACKEND_BASE_URL
  return text.endsWith('/') ? text : `${text}/`
}

function resolveBackendBaseUrl() {
  const explicit = String(process.env.HELUO_RUNTIME_BACKEND_BASE_URL || '').trim()
  if (explicit) return ensureTrailingSlash(explicit)
  return DEFAULT_BACKEND_BASE_URL
}

// ============================================================================
// 公共 API
// ============================================================================

/**
 * 注册运行时配置路由
 *
 * @param {object} app - Express 应用实例
 */
export function registerEnvRoutes(app) {
  app.get('/env', (_req, res) => {
    res.set('Cache-Control', CACHE_CONTROL_VALUE)
    res.json({
      backendBaseUrl: resolveBackendBaseUrl(),
    })
  })
}

export default registerEnvRoutes
