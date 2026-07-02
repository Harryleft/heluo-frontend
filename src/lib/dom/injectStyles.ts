/**
 * 样式注入工具
 *
 * 提供统一的 CSS 样式注入能力，避免重复代码
 */

import { hasDOM } from '@/lib/env'

// ============================================================================
// 类型与常量
// ============================================================================

type StylesRegistry = Map<string, HTMLStyleElement>

const injectedStyles: StylesRegistry = new Map()

// ============================================================================
// 公共 API
// ============================================================================

/**
 * 将 CSS 样式注入到页面 head 中
 * @param id 样式标识符，用于避免重复注入
 * @param css CSS 内容
 */
export function injectStyles(id: string, css: string): void {
  if (!hasDOM) return
  const registered = injectedStyles.get(id)
  if (registered) {
    if (registered.textContent !== css) {
      registered.textContent = css
    }
    return
  }

  const existing = document.getElementById(id) as HTMLStyleElement | null
  if (existing) {
    if (existing.textContent !== css) {
      existing.textContent = css
    }
    injectedStyles.set(id, existing)
    return
  }

  const style = document.createElement('style')
  style.id = id
  style.textContent = css
  document.head.appendChild(style)

  injectedStyles.set(id, style)
}
