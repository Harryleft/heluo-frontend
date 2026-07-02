/**
 * 后端服务入口模块
 *
 * 作为 Express 应用程序的主入口点：
 * - 检测是否为直接运行
 * - 启动 HTTP 服务器
 * - 导出应用程序供测试使用
 */

import { pathToFileURL } from 'url'
import { app, resetMarklogicFetch, setMarklogicFetchForTest } from './app.js'
import { startServer } from './startup.js'

// ============================================================================
// 入口点检测
// ============================================================================

const currentEntryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : ''
const isDirectRun = import.meta.url === currentEntryUrl

if (isDirectRun) {
  startServer().catch((error) => {
    console.error('[server] 启动失败:', error.message)
    process.exit(1)
  })
}

// ============================================================================
// 公共导出
// ============================================================================

export { app, resetMarklogicFetch, setMarklogicFetchForTest, startServer }
