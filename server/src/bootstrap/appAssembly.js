/**
 * 应用装配模块
 *
 * 收敛 Express 应用的中间件注册与路由装配逻辑，
 * 让 app.js 保持为真正轻量的入口文件。
 *
 * @module server/src/bootstrap/appAssembly
 */

import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import { registerRoutes } from '../routes/index.js'
import { buildAppDependencies } from './dependencies.js'
import { urlRewriteConfig } from './config.js'
import { getMarklogicConfig } from '../infra/gateways/marklogicGateway.js'

const JSON_BODY_LIMIT = '2mb'
const KNOWN_HOST_FALLBACKS = [
  'http://localhost:8003',
  'http://127.0.0.1:8003',
  'https://api.heluo.site',
  'http://api.heluo.site',
]

/**
 * 解析本地目标 origin
 *
 * @param {object} req - Express 请求对象
 * @param {number} port - 服务端口
 * @returns {string} origin
 */
function resolveLocalTargetOrigin(req, port) {
  if (urlRewriteConfig.localBaseUrl) {
    try {
      return new URL(urlRewriteConfig.localBaseUrl).origin
    } catch {
      // 无效 URL 时使用请求头回退
    }
  }

  const host = String(req?.headers?.host || `127.0.0.1:${port}`).trim()
  const forwardedProto = String(req?.headers?.['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
  const protocol = forwardedProto || 'http'

  return `${protocol}://${host}`
}

/**
 * 构建 URL 重写规则
 *
 * @param {object} req - Express 请求对象
 * @param {number} port - 服务端口
 * @returns {Array<{pattern: string, replacement: string}>}
 */
function buildRewriteRules(req, port) {
  const localOrigin = resolveLocalTargetOrigin(req, port)
  const mlConfig = getMarklogicConfig()

  const rules = [
    { pattern: mlConfig.baseUrl, replacement: localOrigin },
  ]

  for (const fallback of KNOWN_HOST_FALLBACKS) {
    rules.push({ pattern: fallback, replacement: localOrigin })
  }

  return rules
}

/**
 * 重写字符串中的已知主机
 *
 * @param {string} raw - 原始字符串
 * @param {object} req - Express 请求对象
 * @param {number} port - 服务端口
 * @returns {string} 重写后字符串
 */
function rewriteKnownHostUrl(raw, req, port) {
  if (typeof raw !== 'string') return raw

  const rules = buildRewriteRules(req, port)
  let result = raw

  for (const { pattern, replacement } of rules) {
    const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    result = result.replace(new RegExp(escapedPattern, 'g'), replacement)
  }

  return result
}

/**
 * 递归重写 payload 中的已知主机
 *
 * @param {*} raw - 原始数据
 * @param {object} req - Express 请求对象
 * @param {number} port - 服务端口
 * @param {WeakMap} visited - 循环引用追踪
 * @returns {*} 重写后数据
 */
function rewriteKnownHostsInPayload(raw, req, port, visited = new WeakMap()) {
  if (raw === null || raw === undefined) return raw
  if (typeof raw !== 'object') {
    if (typeof raw === 'string') return rewriteKnownHostUrl(raw, req, port)
    return raw
  }

  if (visited.has(raw)) return raw
  visited.set(raw, true)

  if (Array.isArray(raw)) {
    return raw.map((item) => rewriteKnownHostsInPayload(item, req, port, visited))
  }

  const result = {}
  for (const [key, value] of Object.entries(raw)) {
    result[key] = rewriteKnownHostsInPayload(value, req, port, visited)
  }

  return result
}

/**
 * 注册应用中间件
 *
 * @param {object} app - Express 应用实例
 * @param {object} options - 选项
 * @param {number} options.port - 服务端口
 * @param {boolean} options.disableHostRewrite - 是否关闭主机重写
 */
export function registerAppMiddleware(app, options = {}) {
  const {
    port = 9011,
    disableHostRewrite = false,
  } = options

  app.use(cors())

  // 启用 trust proxy：Express 将从 X-Forwarded-Proto/X-Forwarded-For 头自动解析 req.protocol/req.ip
  // 这使得 getRequestOrigin() 等函数在 HTTPS 反代后能正确生成 https:// URL
  app.set('trust proxy', true)

  app.use(morgan('dev'))
  app.use(express.json({ limit: JSON_BODY_LIMIT }))

  app.use((req, res, next) => {
    const originalJson = res.json.bind(res)
    res.json = (body) => {
      if (disableHostRewrite) {
        return originalJson(body)
      }
      return originalJson(rewriteKnownHostsInPayload(body, req, port))
    }
    next()
  })
}

/**
 * 装配应用路由
 *
 * @param {object} app - Express 应用实例
 * @param {Function} marklogicFetch - MarkLogic fetch 函数
 */
export function assembleAppRoutes(app, marklogicFetch) {
  const appDependencies = buildAppDependencies(marklogicFetch)
  registerRoutes(app, appDependencies.controllers, appDependencies.routeDeps)
}

export default {
  registerAppMiddleware,
  assembleAppRoutes,
}
