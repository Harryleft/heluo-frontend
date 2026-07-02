/**
 * HTTP 客户端模块
 *
 * 基于 axios 创建统一的 HTTP 客户端实例，自动处理：
 * - 环境变量配置的后端 URL
 * - 本地开发环境的兜底配置
 * - 统一的超时设置
 */

import axios from 'axios'
import { TIMEOUT } from '@/lib/config/constants'
import { getRuntimeBackendBaseUrl } from '@/lib/runtime/runtimeConfig'

// ============================================================================
// 常量定义
// ============================================================================

const LOCAL_DEV_BACKEND_BASE_URL = 'http://127.0.0.1:9011/'
const FALLBACK_BASE_URL = '/'
const LOCAL_HOST_NAMES = new Set(['127.0.0.1', 'localhost'])

// ============================================================================
// 私有实现
// ============================================================================

function ensureTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '/')
}

function resolveEnvBaseUrl(): string {
  const envBase = String(import.meta.env.REACT_BACKEND_URL || '').trim()
  return envBase ? ensureTrailingSlash(envBase) : ''
}

function isLocalBrowserHost(): boolean {
  if (typeof window === 'undefined') return false
  const host = String(window.location.hostname || '').trim()
  return LOCAL_HOST_NAMES.has(host)
}

function resolveBaseUrl(): string {
  const runtimeBaseUrl = getRuntimeBackendBaseUrl()
  if (runtimeBaseUrl) return runtimeBaseUrl

  const envBaseUrl = resolveEnvBaseUrl()
  if (envBaseUrl) return envBaseUrl

  // 本地开发兜底：避免前端端口变化时依赖代理导致 Network Error
  if (isLocalBrowserHost()) return LOCAL_DEV_BACKEND_BASE_URL

  return FALLBACK_BASE_URL
}

function shouldOverrideBaseUrl(requestBaseUrl: unknown): boolean {
  if (requestBaseUrl == null) return true
  const current = String(requestBaseUrl).trim()
  if (!current) return true
  const defaultBase = String(http.defaults.baseURL || '').trim()
  return current === defaultBase
}

// ============================================================================
// 公共 API
// ============================================================================

export const http = axios.create({
  baseURL: resolveBaseUrl(),
  timeout: TIMEOUT.HTTP_DEFAULT_MS,
})

http.interceptors.request.use((requestConfig) => {
  const latestBaseUrl = resolveBaseUrl()
  if (latestBaseUrl && shouldOverrideBaseUrl(requestConfig.baseURL)) {
    requestConfig.baseURL = latestBaseUrl
    if (http.defaults.baseURL !== latestBaseUrl) {
      http.defaults.baseURL = latestBaseUrl
    }
  }
  return requestConfig
})
