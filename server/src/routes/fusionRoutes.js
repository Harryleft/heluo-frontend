/**
 * 融合问答路由
 *
 * 提供 /api/v1/fusion/query 和 /api/v1/fusion/stream 端点
 *
 * @module server/src/routes/fusionRoutes
 */

/**
 * 注册融合问答路由
 *
 * @param {object} app - Express 应用实例
 * @param {object} controllers - 控制器实例
 */
export function registerFusionRoutes(app, controllers) {
  /**
   * POST /api/v1/fusion/query
   * 融合问答（非流式）
   */
  app.post('/api/v1/fusion/query', controllers.fusion.query)

  /**
   * POST /api/v1/fusion/stream
   * 融合问答流式响应（SSE）
   */
  app.post('/api/v1/fusion/stream', controllers.fusion.stream)
}

export default registerFusionRoutes
