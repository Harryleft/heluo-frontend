/**
 * 根路由
 *
 * 提供根路径端点：
 * - /
 *
 * @module server/src/routes/indexRoutes
 */

import path from 'path'

/**
 * 注册根路由
 *
 * @param {object} app - Express 应用实例
 */
export function registerIndexRoutes(app) {
  /**
   * GET /
   * 返回 index.html
   */
  app.get('/', (_req, res) => {
    res.sendFile(path.join(process.cwd(), 'index.html'))
  })
}

export default registerIndexRoutes
