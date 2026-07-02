/**
 * 环境检测模块
 *
 * 集中管理运行时环境检测，避免分散的 typeof 检查
 */

// ============================================================================
// 浏览器环境检测
// ============================================================================

/** 是否在浏览器环境（有 window 和 document） */
export const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined'

/** 是否支持 DOM 操作 */
export const hasDOM = typeof document !== 'undefined'

/** 是否支持 window 对象 */
export const hasWindow = typeof window !== 'undefined'

// ============================================================================
// API 可用性检测
// ============================================================================

/** 是否支持 Clipboard API */
export const hasClipboard = typeof navigator !== 'undefined' && navigator.clipboard !== undefined

/** 是否支持 IntersectionObserver */
export const hasIntersectionObserver = typeof globalThis !== 'undefined'
  && typeof globalThis.IntersectionObserver !== 'undefined'

/** 是否支持 fetch */
export const hasFetch = typeof globalThis !== 'undefined'
  && typeof globalThis.fetch === 'function'

/** 是否支持 AbortController */
export const hasAbortController = typeof globalThis !== 'undefined'
  && typeof globalThis.AbortController === 'function'

/** 是否支持 URL API */
export const hasURL = typeof globalThis !== 'undefined'
  && typeof globalThis.URL === 'function'

/** 是否支持 URLSearchParams */
export const hasURLSearchParams = typeof globalThis !== 'undefined'
  && typeof globalThis.URLSearchParams === 'function'
