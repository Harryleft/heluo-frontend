/**
 * 前端端口释放脚本
 *
 * 在 Vite 启动前检测并释放被占用的端口
 * 支持 Windows 和 Unix 系统
 */

import { createServer } from 'node:net'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { platform } from 'node:os'

const execAsync = promisify(exec)

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
 * 检测端口是否完全可用
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

  console.log(`[frontend] 检测到端口 ${port} 被进程 PID:${pid} 占用，正在释放...`)

  if (await killProcess(pid)) {
    if (await waitForPortRelease(port)) {
      console.log(`[frontend] 端口 ${port} 已成功释放`)
      return true
    }
  }

  console.warn(`[frontend] 释放端口 ${port} 失败`)
  return false
}

// 主函数
async function main() {
  const port = parseInt(process.argv[2], 10) || 3000
  await releasePort(port)
}

main().catch(console.error)
