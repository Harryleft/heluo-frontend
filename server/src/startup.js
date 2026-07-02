/**
 * 服务器启动模块
 *
 * 提供 HTTP 服务器启动功能：
 * - 端口可用性检测
 * - 自动释放被占用的端口
 * - 自动端口回退（作为备选）
 * - 优雅启动日志
 * - 优雅关闭（Ctrl+C 时释放端口）
 */

import { createServer } from 'node:net'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { platform } from 'node:os'
import { app, PORT } from './app.js'
import { serverConfig } from './bootstrap/config.js'

const execAsync = promisify(exec)

// ============================================================================
// 端口检测与释放
// ============================================================================

/**
 * 检测端口在指定地址上是否可用
 */
async function isPortAvailableOn(port, host) {
  return new Promise((resolve) => {
    const tester = createServer()
      .once('error', () => resolve(false))
      .once('listening', () => {
        tester.close(() => resolve(true))
      })
    tester.listen(port, host)
  })
}

/**
 * 检测端口是否完全可用（检测多个地址）
 */
async function isPortAvailable(port) {
  const hosts = ['0.0.0.0', '::', '::1', '127.0.0.1']
  for (const host of hosts) {
    if (!(await isPortAvailableOn(port, host))) {
      return false
    }
  }
  return true
}

/**
 * 查找占用指定端口的进程 PID
 */
async function findProcessByPort(port) {
  const isWindows = platform() === 'win32'
  try {
    if (isWindows) {
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`)
      for (const line of stdout.trim().split('\n').filter(Boolean)) {
        if (line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/)
          const pid = parseInt(parts[parts.length - 1], 10)
          if (!isNaN(pid) && pid > 0) return pid
        }
      }
    } else {
      const { stdout } = await execAsync(`lsof -i :${port} -t`)
      const pid = parseInt(stdout.trim().split('\n')[0], 10)
      if (!isNaN(pid) && pid > 0) return pid
    }
  } catch {
    // 命令执行失败，通常表示没有进程占用该端口
  }
  return null
}

/**
 * 终止指定 PID 的进程
 */
async function killProcess(pid) {
  const isWindows = platform() === 'win32'
  try {
    if (isWindows) {
      await execAsync(`taskkill /F /PID ${pid}`)
    } else {
      await execAsync(`kill -9 ${pid}`)
    }
    return true
  } catch {
    return false
  }
}

/**
 * 等待端口释放
 */
async function waitForPortRelease(port, timeout = 3000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await isPortAvailable(port)) return true
    await new Promise((r) => setTimeout(r, 100))
  }
  return false
}

/**
 * 尝试释放指定端口
 */
async function releasePort(port) {
  if (await isPortAvailable(port)) return true

  const pid = await findProcessByPort(port)
  if (!pid) return false

  console.log(`[server] 检测到端口 ${port} 被进程 PID:${pid} 占用，正在释放...`)

  if (await killProcess(pid)) {
    if (await waitForPortRelease(port)) {
      console.log(`[server] 端口 ${port} 已成功释放`)
      return true
    }
  }

  console.warn(`[server] 释放端口 ${port} 失败`)
  return false
}

/**
 * 查找可用端口
 */
async function findAvailablePort(basePort, limit = 10) {
  for (let offset = 0; offset <= limit; offset++) {
    const port = basePort + offset
    if (await isPortAvailable(port)) return port
  }
  throw new Error(`端口冲突：${basePort} 起始连续 ${limit + 1} 个端口均不可用`)
}

// ============================================================================
// 优雅关闭
// ============================================================================

let activeServer = null

function listenOnPort(port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      server.off('error', handleError)
      activeServer = server
      console.log(`heluo backend(js) listening at http://127.0.0.1:${port}`)
      resolve(server)
    })

    function handleError(error) {
      server.off('error', handleError)
      reject(error)
    }

    server.on('error', handleError)
  })
}

async function listenWithFallback(preferredPort) {
  try {
    await listenOnPort(preferredPort)
    return
  } catch (error) {
    if (error?.code !== 'EADDRINUSE') {
      throw error
    }

    if (!serverConfig.portAutoFallback) {
      throw new Error(`端口 ${preferredPort} 已被占用，请释放后重试`)
    }

    const fallbackPort = await findAvailablePort(preferredPort + 1, serverConfig.portRetryLimit)
    console.warn(`[server] 端口 ${preferredPort} 监听失败，自动回退到 ${fallbackPort}`)
    await listenOnPort(fallbackPort)
  }
}

function gracefulShutdown(signal) {
  if (!activeServer) {
    process.exit(0)
    return
  }
  console.log(`\n[server] 收到 ${signal} 信号，正在优雅关闭...`)
  activeServer.close(() => {
    console.log('[server] HTTP 服务器已关闭，端口已释放')
    process.exit(0)
  })
  setTimeout(() => {
    console.warn('[server] 优雅关闭超时，强制退出')
    process.exit(1)
  }, 5000)
}

function registerShutdownHandlers() {
  if (process.listeners('SIGINT').some((fn) => fn.name === 'gracefulShutdown')) return
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
}

// ============================================================================
// 启动服务器
// ============================================================================

export async function startServer() {
  registerShutdownHandlers()

  if (!(await isPortAvailable(PORT))) {
    if (!(await releasePort(PORT))) {
      await listenWithFallback(PORT)
      return
    }
  }

  await listenWithFallback(PORT)
}
