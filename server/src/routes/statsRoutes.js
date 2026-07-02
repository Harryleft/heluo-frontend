/**
 * 统计路由
 *
 * 提供 /stats/entity-counts 端点用于获取实体统计数据
 *
 * @module server/src/routes/statsRoutes
 */

/**
 * 注册统计路由
 *
 * @param {object} app - Express 应用实例
 * @param {object} controllers - 控制器实例
 */
export function registerStatsRoutes(app, controllers) {
  /**
   * GET /stats/entity-counts
   * 获取各类型实体的数量统计
   */
  app.get('/stats/entity-counts', controllers.stats.entityCounts)
}

export default registerStatsRoutes
