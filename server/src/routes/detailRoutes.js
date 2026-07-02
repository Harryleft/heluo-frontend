/**
 * 详情路由
 *
 * 提供各类实体详情端点：
 * - /api/v1/persons/:id
 * - /api/v1/persons/:id/poem-track
 * - /api/v1/persons
 * - /api/v1/poems/:id
 * - /api/v1/poems
 * - /api/v1/books/:id
 * - /api/v1/places/:id
 * - /api/v1/concepts/:id
 * - /api/v1/ancient-books/:id
 *
 * @module server/src/routes/detailRoutes
 */

/**
 * 注册详情路由
 *
 * @param {object} app - Express 应用实例
 * @param {object} controllers - 控制器实例
 */
export function registerDetailRoutes(app, controllers) {
  /**
   * GET /api/v1/persons/:id
   * 获取人物详情
   */
  app.get('/api/v1/persons/:id', controllers.detail.getPerson)

  /**
   * GET /api/v1/persons/:id/poem-track
   * 获取人物诗文地理轨迹
   */
  app.get('/api/v1/persons/:id/poem-track', controllers.detail.getPersonPoemTrack)

  /**
   * GET /api/v1/persons
   * 获取人物列表
   */
  app.get('/api/v1/persons', controllers.detail.listPersons)

  /**
   * GET /api/v1/poems/:id
   * 获取诗文详情
   */
  app.get('/api/v1/poems/:id', controllers.detail.getPoem)

  /**
   * GET /api/v1/poems
   * 获取诗文列表
   */
  app.get('/api/v1/poems', controllers.detail.listPoems)

  /**
   * GET /api/v1/books/:id
   * 获取图书详情
   */
  app.get('/api/v1/books/:id', controllers.detail.getBook)

  /**
   * GET /api/v1/places/:id
   * 获取地点详情
   */
  app.get('/api/v1/places/:id', controllers.detail.getPlace)

  /**
   * GET /api/v1/concepts/:id
   * 获取概念详情
   */
  app.get('/api/v1/concepts/:id', controllers.detail.getConcept)

  /**
   * GET /api/v1/ancient-books/:id
   * 获取古籍详情
   */
  app.get('/api/v1/ancient-books/:id', controllers.detail.getAncientBook)
}

export default registerDetailRoutes
