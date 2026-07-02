/**
 * IIIF 配置与 URL 构建工具。
 */
import { rewriteKnownApiHost } from '@/lib/url/heluoUrl'
import { getRuntimeBackendBaseUrl } from '@/lib/runtime/runtimeConfig'

// 构建时默认值：运行时配置为空时的回退
const IIIF_FALLBACK_BASE_URL = String(import.meta.env.REACT_BACKEND_URL || 'http://127.0.0.1:9011').trim()

/** 动态解析 IIIF manifest 基础 URL：运行时配置优先，构建时值为兜底 */
function resolveIiifBaseUrl(): string {
  const runtimeUrl = getRuntimeBackendBaseUrl()
  return runtimeUrl || IIIF_FALLBACK_BASE_URL
}
const MIRADOR_VIEWER_BASE_PATH = '/mirador'

const HTTP_PROTOCOL = 'http://'
const HTTPS_PROTOCOL = 'https://'
const LEGACY_IIIF_ORIGIN = 'http://localhost:8083'

/** 向量索引 IIIF URI 匹配模式：/processed/json-ld-vector/iiif/manifests/{personId}_{bookId}_{volumeId}_{seq}.json */
const VECTOR_IIIF_URI_PATTERN = /\/processed\/json-ld-vector\/iiif\/manifests\/\d+_(\d+)_\d+_\d+\.json$/i

/** 将向量索引 URI 转换为可访问的 IIIF manifest 路径 */
function resolveVectorIiifUri(path: string): string {
  const text = String(path || '').trim()
  const match = text.match(VECTOR_IIIF_URI_PATTERN)
  if (!match) return ''
  return `${trimTrailingSlash(resolveIiifBaseUrl())}/iiif/manifests/${match[1]}/manifest.json`
}

function isAbsoluteHttpUrl(value: string): boolean {
  return value.startsWith(HTTP_PROTOCOL) || value.startsWith(HTTPS_PROTOCOL)
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/g, '')
}

function rewriteLegacyIiifOrigin(url: string): string {
  const text = String(url || '').trim()
  if (!text) return ''

  try {
    const parsed = new URL(text)
    const backendOrigin = trimTrailingSlash(resolveIiifBaseUrl())
    if (!backendOrigin) return text
    if (`${parsed.protocol}//${parsed.host}` !== LEGACY_IIIF_ORIGIN) return text
    if (!parsed.pathname.startsWith('/iiif/')) return text
    return `${backendOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return text
  }
}

/** 构建 IIIF Manifest URL */
export function buildManifestUrl(manifestPath: string): string {
  if (!manifestPath) return ''
  // 向量索引 URI（如 /processed/json-ld-vector/iiif/manifests/17270_304_766_1.json）需要转换为可访问的 manifest 路径
  const resolved = resolveVectorIiifUri(manifestPath)
  if (resolved) return resolved
  if (isAbsoluteHttpUrl(manifestPath)) return rewriteLegacyIiifOrigin(rewriteKnownApiHost(manifestPath))
  if (manifestPath.startsWith('/')) return `${trimTrailingSlash(resolveIiifBaseUrl())}${manifestPath}`
  return manifestPath
}

/** 构建 Mirador 查看器 URL */
export function buildMiradorViewerUrl(manifestPath: string, canvasId = ''): string {
  const manifestUrl = buildManifestUrl(manifestPath)
  if (!manifestUrl) return ''
  const baseUrl = trimTrailingSlash(MIRADOR_VIEWER_BASE_PATH)
  const params = new URLSearchParams({ manifest: manifestUrl })
  const safeCanvasId = canvasId.trim()
  if (safeCanvasId) params.set('canvas', safeCanvasId)
  return `${baseUrl}?${params.toString()}`
}
