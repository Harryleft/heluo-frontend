/**
 * 前端运行时配置模块
 *
 * 提供 /env 配置拉取与读取能力，失败时保持静默回退，
 * 避免影响既有功能。
 */

// ============================================================================
// 类型
// ============================================================================

type RuntimeConfigPayload = {
  backendBaseUrl?: unknown
}

type RuntimeConfig = {
  backendBaseUrl?: string
}

type RuntimeWindow = Window & {
  __HELUO_RUNTIME_CONFIG__?: RuntimeConfig
}

type LoadRuntimeConfigOptions = {
  endpoint?: string
  timeoutMs?: number
  fetcher?: typeof fetch
}

// ============================================================================
// 常量
// ============================================================================

const DEFAULT_RUNTIME_ENDPOINT = '/env'
const DEFAULT_TIMEOUT_MS = 1500
const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = Object.freeze({})

// ============================================================================
// 模块状态
// ============================================================================

let hasLoadedRuntimeConfig = false
let runtimeConfigLoadingPromise: Promise<void> | null = null

// ============================================================================
// 私有实现
// ============================================================================

function ensureTrailingSlash(value: string): string {
  const text = String(value || '').trim()
  if (!text) return ''
  return text.endsWith('/') ? text : `${text}/`
}

function normalizeBackendBaseUrl(value: unknown): string {
  const text = String(value || '').trim()
  if (!text) return ''
  return ensureTrailingSlash(text)
}

function getRuntimeWindow(): RuntimeWindow | null {
  if (typeof window === 'undefined') return null
  return window as RuntimeWindow
}

function mergeRuntimeConfig(nextConfig: RuntimeConfig): void {
  const runtimeWindow = getRuntimeWindow()
  if (!runtimeWindow) return
  runtimeWindow.__HELUO_RUNTIME_CONFIG__ = {
    ...(runtimeWindow.__HELUO_RUNTIME_CONFIG__ || {}),
    ...nextConfig,
  }
}

// ============================================================================
// 公共 API
// ============================================================================

export function getRuntimeConfig(): RuntimeConfig {
  const runtimeWindow = getRuntimeWindow()
  if (!runtimeWindow?.__HELUO_RUNTIME_CONFIG__) return DEFAULT_RUNTIME_CONFIG
  return runtimeWindow.__HELUO_RUNTIME_CONFIG__
}

export function getRuntimeBackendBaseUrl(): string {
  return normalizeBackendBaseUrl(getRuntimeConfig().backendBaseUrl)
}

export async function loadRuntimeConfig(options: LoadRuntimeConfigOptions = {}): Promise<void> {
  if (hasLoadedRuntimeConfig) return
  if (runtimeConfigLoadingPromise) {
    await runtimeConfigLoadingPromise
    return
  }

  runtimeConfigLoadingPromise = (async () => {
    const runtimeWindow = getRuntimeWindow()
    if (!runtimeWindow) return

    const endpoint = String(options.endpoint || DEFAULT_RUNTIME_ENDPOINT).trim() || DEFAULT_RUNTIME_ENDPOINT
    const timeoutMs = Math.max(300, Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS)
    const fetcher = options.fetcher || runtimeWindow.fetch?.bind(runtimeWindow)
    if (!fetcher) return

    let timer: ReturnType<typeof setTimeout> | null = null
    const controller = typeof AbortController === 'function' ? new AbortController() : null

    try {
      if (controller) {
        timer = setTimeout(() => controller.abort(), timeoutMs)
      }

      const response = await fetcher(endpoint, {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller?.signal,
      })

      if (!response.ok) return

      const payload = await response.json() as RuntimeConfigPayload
      const backendBaseUrl = normalizeBackendBaseUrl(payload?.backendBaseUrl)
      if (!backendBaseUrl) return

      mergeRuntimeConfig({ backendBaseUrl })
      hasLoadedRuntimeConfig = true
    } catch {
      // 运行时配置读取失败时静默降级，不阻塞应用启动
    } finally {
      if (timer) clearTimeout(timer)
    }
  })()

  await runtimeConfigLoadingPromise
  if (!hasLoadedRuntimeConfig) {
    runtimeConfigLoadingPromise = null
  }
}
