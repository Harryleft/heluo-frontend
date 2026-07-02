/**
 * 文本处理工具模块
 *
 * 统一管理文本归一化、URL 检测等通用文本处理函数
 */

// ============================================================================
// 文本归一化
// ============================================================================

/**
 * 归一化文本：转字符串、合并空白、去除首尾空白
 */
export function normalizeText(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

/**
 * 判断值是否可能是 URL
 */
export function isLikelyUrl(value: unknown): boolean {
  const text = normalizeText(value)
  return text.startsWith('http://') || text.startsWith('https://') || text.startsWith('/')
}

// ============================================================================
// 数组与对象转换
// ============================================================================

/**
 * 强制转换为数组
 */
export function forceArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

/**
 * 强制转换为 Record 对象
 */
export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>
  }
  return {}
}

// ============================================================================
// 去重
// ============================================================================

/**
 * 字符串数组去重
 */
export function uniq(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}
