/**
 * IIIF 路由
 *
 * 提供与 IIIF（International Image Interoperability Framework）相关的端点：
 * - /api/v1/iiif/volume-heads
 *
 * @module server/src/routes/iiifRoutes
 */

/**
 * 注册 IIIF 路由
 *
 * @param {object} app - Express 应用实例
 * @param {object} controllers - 控制器实例
 */
export function registerIiifRoutes(app, controllers) {
  app.get('/iiif/*', async (req, res, next) => {
    try {
      const upstream = await fetch(`http://127.0.0.1:8083${req.originalUrl}`)
      if (!upstream.ok) return next()

      const body = Buffer.from(await upstream.arrayBuffer())
      res.status(upstream.status)
      for (const [key, value] of upstream.headers.entries()) {
        if (['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) continue
        res.setHeader(key, value)
      }
      res.send(body)
    } catch {
      next()
    }
  })

  /**
   * GET /api/v1/iiif/volume-heads
   * 获取 IIIF 清单的卷首 Canvas 列表
   */
  app.get('/api/v1/iiif/volume-heads', controllers.detail.getIiifVolumeHeads)

  app.get('/iiif/manifests/:bookId/manifest.json', controllers.detail.getIiifDocument)
  app.get('/iiif/manifests/:bookId/collection.json', controllers.detail.getIiifDocument)
  app.get('/iiif/manifests/ancientBook/:bookId/:carrierId/manifest.json', controllers.detail.getIiifDocument)
  app.get('/iiif/3/collection/ancientBook/:bookId', controllers.detail.getIiifDocument)
  app.get('/iiif/3/collection/person/:personId', controllers.detail.getIiifDocument)
  app.get('/iiif/3/manifest/ancientBook/:bookId/:carrierId', controllers.detail.getIiifDocument)
  app.get('/iiif/3/search/ancientBook/:bookId/:carrierId', controllers.detail.searchIiifContent)
}

export default registerIiifRoutes
