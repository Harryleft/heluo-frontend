/**
 * 高德地图加载服务
 *
 * 负责动态加载高德地图 JS API
 */

import {
  AMAP_JS_API_URL,
  AMAP_JS_API_VERSION,
  AMAP_KEY,
  AMAP_SCRIPT_ID,
  AMAP_SECURITY_JS_CODE,
} from '@/features/details/components/PersonPoemTrackMap/constants'

/** 高德地图加载 Promise（单例） */
let amapLoadPromise: Promise<any> | null = null

/**
 * 构建高德地图 JS API URL
 */
export function buildAmapJsApiUrl(): string {
  const params = new globalThis.URLSearchParams({
    v: AMAP_JS_API_VERSION,
    key: AMAP_KEY,
  })
  return `${AMAP_JS_API_URL}?${params.toString()}`
}

/**
 * 加载高德地图 JS API
 *
 * 使用单例模式，确保只加载一次
 */
export function loadAmapJsApi(): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('当前环境不支持地图加载。'))
  }

  const windowAmap = (window as any).AMap
  if (windowAmap) {
    return Promise.resolve(windowAmap)
  }

  // 单例模式：如果已在加载中，返回现有 Promise
  if (amapLoadPromise) {
    return amapLoadPromise
  }

  // 检查配置
  if (!AMAP_KEY || !AMAP_SECURITY_JS_CODE) {
    return Promise.reject(new Error('缺少高德地图 Key 或安全密钥配置。'))
  }

  amapLoadPromise = new Promise<any>((resolve, reject) => {
    // 配置安全密钥
    window._AMapSecurityConfig = {
      securityJsCode: AMAP_SECURITY_JS_CODE,
    }

    const finishResolve = (): void => {
      const windowAmap = (window as any).AMap
      if (windowAmap) {
        resolve(windowAmap)
        return
      }
      amapLoadPromise = null
      reject(new Error('高德地图 JS API 加载成功但 AMap 对象不可用。'))
    }

    const handleError = (): void => {
      amapLoadPromise = null
      reject(new Error('高德地图 JS API 加载失败，请检查网络或 Key 配置。'))
    }

    // 检查是否已存在脚本标签
    const existing = document.getElementById(AMAP_SCRIPT_ID) as globalThis.HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', finishResolve, { once: true })
      existing.addEventListener('error', handleError, { once: true })
      return
    }

    // 创建新脚本标签
    const script = document.createElement('script')
    script.id = AMAP_SCRIPT_ID
    script.src = buildAmapJsApiUrl()
    script.async = true
    script.defer = true
    script.onload = finishResolve
    script.onerror = handleError
    document.head.appendChild(script)
  })

  return amapLoadPromise
}
