/**
 * 搜索路由
 *
 * 提供 /api/v1/search 统一搜索端点
 *
 * @module server/src/routes/searchRoutes
 */

/**
 * 注册搜索路由
 *
 * @param {object} app - Express 应用实例
 * @param {object} controllers - 控制器实例
 */
export function registerSearchRoutes(app, controllers) {
  /**
   * GET /api/v1/search
   * 统一搜索接口（支持关键字、向量、混合模式）
   */
  app.get('/api/v1/search', controllers.search.search)
}

export default registerSearchRoutes
