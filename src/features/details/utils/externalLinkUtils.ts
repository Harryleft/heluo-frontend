/**
 * 外部链接工具函数
 *
 * 从 URI 推断外部来源标签、检测 IIIF Manifest URI 等。
 * 纯函数，无 React 依赖。
 *
 * @module externalLinkUtils
 */

import type { DetailResourceType } from '@/features/details/utils/uriParser'

/**
 * 从 URI 中提取主机名标签
 *
 * @param uri - 外部链接 URI
 * @returns 主机名或截断后的 URI
 */
export function getExternalHostLabel(uri: string): string {
  const hostnameMatch = uri.match(/^https?:\/\/([^/]+)/)
  return hostnameMatch ? hostnameMatch[1] : uri.substring(0, 30)
}

/**
 * 根据域名推断等效数据源
 *
 * @param uri - 外部链接 URI
 * @param resourceType - 当前资源类型
 * @returns 数据源名称
 */
export function inferEquivalentSourceByDomain(
  uri: string,
  resourceType?: DetailResourceType,
): 'ULAN' | 'TGN' | '上海图书馆人名规范词表' | '上图地理名词表' | '其他来源' {
  const raw = String(uri || '').trim()
  if (!raw) return '其他来源'

  try {
    const parsed = new globalThis.URL(raw)
    const hostname = String(parsed.hostname || '').toLowerCase()
    const pathname = String(parsed.pathname || '').toLowerCase()

    if (hostname.includes('vocab.getty.edu') && pathname.includes('/ulan/')) {
      return 'ULAN'
    }
    if (hostname.includes('vocab.getty.edu') && pathname.includes('/tgn/')) {
      return 'TGN'
    }
    if (hostname.includes('library.sh.cn')) {
      if (resourceType === 'place') return '上图地理名词表'
      return '上海图书馆人名规范词表'
    }
  } catch {
    return '其他来源'
  }

  return '其他来源'
}

/**
 * 判断 URI 是否为 IIIF Manifest
 *
 * @param uri - 待检测 URI
 * @returns 是否为 IIIF Manifest URI
 */
export function isIiifManifestUri(uri: string): boolean {
  const raw = String(uri || '').trim()
  if (!raw) return false

  const normalized = raw.toLowerCase()
  if (normalized.includes('/iiif/manifests/')) return true
  if (normalized.includes('/iiif/3/manifest/')) return true
  if (normalized.includes('/manifest.json')) return true

  return false
}

/**
 * 获取外部来源的可读标签
 *
 * @param uri - 外部链接 URI
 * @param resourceType - 当前资源类型
 * @returns 可读的来源标签
 */
export function getExternalSourceLabel(uri: string, resourceType?: DetailResourceType): string {
  if (isIiifManifestUri(uri)) return 'IIIF Manifest（古籍影像）'
  const source = inferEquivalentSourceByDomain(uri, resourceType)
  if (source !== '其他来源') return source
  return getExternalHostLabel(uri)
}
