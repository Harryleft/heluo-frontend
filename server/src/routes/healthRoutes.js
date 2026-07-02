/**
 * 健康检查路由
 *
 * 提供 /health 端点用于服务健康状态检查
 *
 * @module server/src/routes/healthRoutes
 */

/**
 * 注册健康检查路由
 *
 * @param {object} app - Express 应用实例
 * @param {object} controllers - 控制器实例
 */
export function registerHealthRoutes(app, controllers) {
  /**
   * GET /health
   * 服务健康检查
   */
  app.get('/health', controllers.health.health)
}

export default registerHealthRoutes
