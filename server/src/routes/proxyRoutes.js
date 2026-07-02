/**
 * 代理路由
 *
 * 提供 MarkLogic 代理端点：
 * - /ml/*
 *
 * 注意：这个路由将请求代理到 MarkLogic 后端服务。
 *
 * @module server/src/routes/proxyRoutes
 */

/**
 * 注册代理路由
 *
 * @param {object} app - Express 应用实例
 * @param {object} deps - 依赖注入
 * @param {Function} deps.marklogicFetch - MarkLogic 请求函数
 * @param {string} deps.marklogicBaseUrl - MarkLogic 基础 URL
 */
export function registerProxyRoutes(app, deps) {
  const { marklogicFetch, marklogicBaseUrl } = deps

  /**
   * ALL /ml/*
   * 代理请求到 MarkLogic 后端
   */
  app.all('/ml/*', async (req, res) => {
    try {
      const path = req.path.replace(/^\/ml/, '')
      const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
      const targetUrl = `${marklogicBaseUrl}${path}${query}`
      const init = {
        method: req.method,
        headers: { accept: req.headers.accept || '*/*' },
      }
      if (!['GET', 'HEAD'].includes(req.method.toUpperCase())) {
        init.headers['content-type'] = req.headers['content-type'] || 'application/json'
        if (req.body && Object.keys(req.body).length) {
          init.body = JSON.stringify(req.body)
        }
      }
      const upstream = await marklogicFetch(targetUrl, init)
      const body = Buffer.from(await upstream.arrayBuffer())
      res.status(upstream.status)
      for (const [key, value] of upstream.headers.entries()) {
        if (['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) continue
        res.setHeader(key, value)
      }
      res.send(body)
    } catch (error) {
      res.status(502).json({ error: 'proxy_failed', detail: String(error) })
    }
  })
}

export default registerProxyRoutes
