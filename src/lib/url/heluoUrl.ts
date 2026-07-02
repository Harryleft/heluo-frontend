/**
 * 河洛 URL 处理模块
 *
 * 提供河洛系统专用的 URL 解析和构建功能：
 * - 实体路径提取（从各种格式的 URI）
 * - 详情页路由构建
 * - 已知 API 域名改写
 */

// ============================================================================
// 常量定义
// ============================================================================

const DEFAULT_SOURCE_HOSTS = ['api.heluo.site']
const HTTP_PROTOCOL = 'http://'
const HTTPS_PROTOCOL = 'https://'
const LOCAL_FALLBACK_ORIGIN = 'http://127.0.0.1:9011'
const DETAILS_PATH = '/details'
const DETAILS_URI_PARAM = 'uri'
const MAX_DECODE_DEPTH = 3

const ENTITY_PATH_PATTERNS = [
  /\/person\//i,
  /\/persons\//i,
  /\/place\//i,
  /\/places\//i,
  /\/poem\//i,
  /\/poems-/i,
  /\/book\//i,
  /\/books\//i,
  /\/marc\//i,
  /\/concept\//i,
  /\/concepts\//i,
  /\/ancient_book\//i,
  /\/ancient-book\//i,
  /\/txt\/ancient_book\//i,
  /\/object\/ancient_book\//i,
  /\/set\/ancient_book\//i,
]

// ============================================================================
// 私有实现
// ============================================================================

function getSourceHosts(): string[] {
  const raw = String(import.meta.env.REACT_HELUO_SOURCE_HOSTS || '').trim()
  if (!raw) return DEFAULT_SOURCE_HOSTS
  const hosts = raw.split(',').map((item) => item.trim()).filter(Boolean)
  return hosts.length ? hosts : DEFAULT_SOURCE_HOSTS
}

function isAbsoluteHttpUrl(uri: string): boolean {
  return uri.startsWith(HTTP_PROTOCOL) || uri.startsWith(HTTPS_PROTOCOL)
}

function parseUrlSafe(uri: string): globalThis.URL | null {
  try {
    return new globalThis.URL(uri)
  } catch {
    return null
  }
}

function parseRelativeOrAbsoluteUrl(uri: string): globalThis.URL | null {
  const absolute = parseUrlSafe(uri)
  if (absolute) return absolute
  try {
    return new globalThis.URL(uri, LOCAL_FALLBACK_ORIGIN)
  } catch {
    return null
  }
}

function resolveLocalTargetOrigin(): string {
  const envTarget = String(import.meta.env.REACT_HELUO_LOCAL_BASE_URL || '').trim()
  if (envTarget) {
    const parsed = parseUrlSafe(envTarget)
    if (parsed) return parsed.origin
  }
  return LOCAL_FALLBACK_ORIGIN
}

function isEntityPath(pathname: string): boolean {
  return ENTITY_PATH_PATTERNS.some((pattern) => pattern.test(pathname))
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function decodeRepeatedly(value: string): string {
  let current = String(value || '').trim()
  for (let i = 0; i < MAX_DECODE_DEPTH; i += 1) {
    const decoded = decodeURIComponentSafe(current).trim()
    if (!decoded || decoded === current) break
    current = decoded
  }
  return current
}

function normalizeDetailParamUri(value: string): string {
  return String(value || '').trim()
    .replace(/^[?&]*uri=/i, '')
    .trim()
}

function extractEntityPathFromDetailsUri(uri: string, depth: number): string {
  const parsed = parseRelativeOrAbsoluteUrl(uri)
  if (!parsed || parsed.pathname !== DETAILS_PATH) return ''

  const detailUri = normalizeDetailParamUri(parsed.searchParams.get(DETAILS_URI_PARAM) || '')
  if (!detailUri) return ''
  const decodedDetailUri = decodeRepeatedly(detailUri)
  return extractEntityPathFromUriInternal(decodedDetailUri, depth + 1)
}

function extractEntityPathFromAbsoluteUri(uri: string, depth: number): string {
  const normalized = rewriteKnownApiHost(uri)
  const parsed = parseUrlSafe(normalized)
  if (!parsed) return ''

  const pathname = parsed.pathname || ''
  if (isEntityPath(pathname)) return pathname
  if (pathname === DETAILS_PATH) {
    return extractEntityPathFromDetailsUri(normalized, depth)
  }
  return ''
}

function extractEntityPathFromUriInternal(uri: string, depth: number): string {
  if (depth > MAX_DECODE_DEPTH) return ''

  const raw = String(uri || '').trim()
  if (!raw) return ''

  if (raw.startsWith('/')) {
    if (isEntityPath(raw)) return raw
    if (raw.startsWith(`${DETAILS_PATH}?`) || raw === DETAILS_PATH) {
      return extractEntityPathFromDetailsUri(raw, depth)
    }
  }

  if (isAbsoluteHttpUrl(raw)) {
    return extractEntityPathFromAbsoluteUri(raw, depth)
  }

  const decodedRaw = decodeRepeatedly(raw)
  if (decodedRaw && decodedRaw !== raw) {
    return extractEntityPathFromUriInternal(decodedRaw, depth + 1)
  }

  return ''
}

// ============================================================================
// 公共 API
// ============================================================================

/**
 * 将已知 API 域名改写为本地域名（临时措施）
 */
export function rewriteKnownApiHost(uri: string): string {
  const raw = String(uri || '').trim()
  if (!raw) return ''
  if (!isAbsoluteHttpUrl(raw)) return raw

  const parsed = parseUrlSafe(raw)
  if (!parsed) return raw

  const sourceHosts = getSourceHosts()
  if (!sourceHosts.includes(parsed.hostname)) return raw

  const target = parseUrlSafe(resolveLocalTargetOrigin())
  if (!target) return raw

  parsed.protocol = target.protocol
  parsed.host = target.host
  return parsed.toString()
}

/**
 * 提取可导航的实体路径
 */
export function extractEntityPathFromUri(uri: string): string {
  return extractEntityPathFromUriInternal(uri, 0)
}

/**
 * 构建详情页内部链接
 */
export function buildDetailsRouteFromUri(uri: string): string {
  const entityPath = extractEntityPathFromUri(uri)
  if (!entityPath) return ''
  return `/details?uri=${encodeURIComponent(entityPath)}`
}
