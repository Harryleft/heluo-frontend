/**
 * 环境变量加载模块
 *
 * 此模块必须在所有其他模块之前导入，以确保 .env 文件被正确加载。
 * ES Module 的 import 语句会被提升，因此不能在 app.js 中直接调用 dotenv.config()。
 *
 * @module server/src/bootstrap/env
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// 获取当前文件所在目录的绝对路径
const _currentDir = path.dirname(fileURLToPath(import.meta.url))
// 项目根目录（server/src/bootstrap 的上级目录）
const _projectRoot = path.resolve(_currentDir, '..', '..', '..')

// Test environment skips local .env to avoid config pollution
const _isTestRuntime =
  String(process.env.NODE_ENV || '').trim().toLowerCase() === 'test' ||
  String(process.env.VITEST || '').trim().toLowerCase() === 'true'

if (!_isTestRuntime) {
  // Load server/.env first (project convention), then root .env as fallback
  // 使用绝对路径确保无论从哪个目录启动都能正确加载配置
  const serverEnvPath = path.join(_projectRoot, 'server', '.env')
  const rootEnvPath = path.join(_projectRoot, '.env')

  // dotenv.config() 不会覆盖已存在的环境变量，所以先加载的优先级更高
  dotenv.config({ path: serverEnvPath })
  dotenv.config({ path: rootEnvPath })
}
