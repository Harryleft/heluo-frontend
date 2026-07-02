/**
 * 路由注册入口
 *
 * 集中管理所有路由的注册，提供统一的路由挂载点。
 *
 * ## 架构原则
 *
 * 1. 每个路由模块只负责路由定义和控制器方法绑定
 * 2. 路由模块不包含业务逻辑
 * 3. 所有业务逻辑由控制器层处理
 * 4. 通过依赖注入解耦路由和实现
 *
 * ## 模块结构
 *
 * - healthRoutes: 健康检查路由
 * - statsRoutes: 统计路由
 * - searchRoutes: 统一搜索路由
 * - fusionRoutes: 融合问答路由
 * - detailRoutes: 实体详情路由
 * - iiifRoutes: IIIF 相关路由
 * - vectorRoutes: 向量搜索路由
 * - proxyRoutes: 代理路由
 * - indexRoutes: 根路由
 *
 * @module server/src/routes
 */

import { registerHealthRoutes } from './healthRoutes.js'
import { registerEnvRoutes } from './envRoutes.js'
import { registerStatsRoutes } from './statsRoutes.js'
import { registerSearchRoutes } from './searchRoutes.js'
import { registerFusionRoutes } from './fusionRoutes.js'
import { registerDetailRoutes } from './detailRoutes.js'
import { registerIiifRoutes } from './iiifRoutes.js'
import { registerVectorRoutes } from './vectorRoutes.js'
import { registerProxyRoutes } from './proxyRoutes.js'
import { registerIndexRoutes } from './indexRoutes.js'
import { registerPersonRoutes } from './personRoutes.js'
import { registerPoemRoutes } from './poemRoutes.js'

// ============================================================================
// 路由注册函数
// ============================================================================

/**
 * 注册所有应用路由
 *
 * @param {object} app - Express 应用实例
 * @param {object} controllers - 控制器实例
 * @param {object} deps - 额外依赖（用于向量搜索和代理路由）
 *
 * @example
 * const controllers = createControllers({ useCases, gateways, config })
 * const deps = {
 *   vectorService: { isVectorSearchEnabled, getEmbedding, mlVectorSearch },
 *   config: { searchMode, vectorConfig, marklogicFetch, marklogicBaseUrl },
 *   marklogicFetch,
 *   marklogicBaseUrl,
 * }
 * registerRoutes(app, controllers, deps)
 */
export function registerRoutes(app, controllers, deps = {}) {
  // 健康检查路由
  registerHealthRoutes(app, controllers)

  // 运行时配置路由
  registerEnvRoutes(app)

  // 统计路由
  registerStatsRoutes(app, controllers)

  // 统一搜索路由
  registerSearchRoutes(app, controllers)

  // 融合问答路由
  registerFusionRoutes(app, controllers)

  // 实体详情路由
  registerDetailRoutes(app, controllers)

  // IIIF 路由
  registerIiifRoutes(app, controllers)

  // 向量搜索路由（需要特殊依赖）
  if (deps.vectorService && deps.config) {
    registerVectorRoutes(app, {
      vectorService: deps.vectorService,
      config: deps.config,
    })
  }

  // 代理路由（需要特殊依赖）
  if (deps.marklogicFetch && deps.marklogicBaseUrl) {
    registerProxyRoutes(app, {
      marklogicFetch: deps.marklogicFetch,
      marklogicBaseUrl: deps.marklogicBaseUrl,
    })
  }

  // 根路由
  registerIndexRoutes(app)

  // AI 介绍路由（需要 LLM 服务依赖）
  if (deps.llmService && deps.apiV1Response && deps.apiV1Error) {
    registerPersonRoutes(app, {
      llmService: deps.llmService,
      apiV1Response: deps.apiV1Response,
      apiV1Error: deps.apiV1Error,
    })
    registerPoemRoutes(app, {
      llmService: deps.llmService,
      apiV1Response: deps.apiV1Response,
      apiV1Error: deps.apiV1Error,
    })
  }
}

// ============================================================================
// 导出
// ============================================================================

export {
  registerHealthRoutes,
  registerEnvRoutes,
  registerStatsRoutes,
  registerSearchRoutes,
  registerFusionRoutes,
  registerDetailRoutes,
  registerIiifRoutes,
  registerVectorRoutes,
  registerProxyRoutes,
  registerIndexRoutes,
  registerPersonRoutes,
  registerPoemRoutes,
}

export default {
  registerRoutes,
  registerHealthRoutes,
  registerEnvRoutes,
  registerStatsRoutes,
  registerSearchRoutes,
  registerFusionRoutes,
  registerDetailRoutes,
  registerIiifRoutes,
  registerVectorRoutes,
  registerProxyRoutes,
  registerIndexRoutes,
  registerPersonRoutes,
  registerPoemRoutes,
}

