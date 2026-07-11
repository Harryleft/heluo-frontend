/**
 * IIIF Manifest 解析工具。
 *
 * 用于兼容“短路径 manifest 实际是中间数据，但 collection.json 指向真实 IIIF Manifest”的场景。
 */

import { buildManifestUrl } from '@/lib/config/iiif'

const manifestResolutionCache = new Map<string, Promise<string>>()

interface IiifCollectionItem {
  id?: string
}

interface IiifCollectionDocument {
  type?: string
  items?: IiifCollectionItem[]
}

interface IiifManifestCanvas {
  type?: string
}

interface IiifManifestDocument {
  type?: string
  items?: IiifManifestCanvas[]
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

export function isIiifPresentationManifest(value: unknown): value is IiifManifestDocument {
  if (!isObjectRecord(value)) return false
  if (String(value.type || '').trim() !== 'Manifest') return false
  const items = Array.isArray(value.items) ? value.items : []
  if (!items.length) return false
  return items.some((item) => isObjectRecord(item) && String(item.type || '').trim() === 'Canvas')
}

export function buildIiifCollectionUrl(manifestUrl: string): string {
  const url = String(manifestUrl || '').trim()
  if (!url) return ''
  if (!/\/iiif\/manifests\/[^/]+\/manifest\.json(?:[?#].*)?$/i.test(url)) return ''
  return url.replace(/\/manifest\.json(?:[?#].*)?$/i, '/collection.json')
}

function isHtmlDocumentText(value: string): boolean {
  const text = String(value || '').trim().toLowerCase()
  if (!text) return false
  return text.startsWith('<!doctype html') || text.startsWith('<html')
}

async function fetchJsonDocument(url: string): Promise<unknown> {
  const response = await globalThis.fetch(url, {
    headers: { accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`iiif request failed: ${response.status}`)
  }

  const contentType = String(response.headers?.get?.('content-type') || '').toLowerCase()
  if (!contentType && typeof response.json === 'function') {
    return response.json()
  }

  if (contentType.includes('application/json') || contentType.includes('+json')) {
    return response.json()
  }

  const text = await response.text()
  if (isHtmlDocumentText(text)) {
    throw new Error(`iiif document returned html: ${url}`)
  }

  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`iiif document is not json: ${url}`)
  }
}

function readCollectionManifestId(value: unknown): string {
  if (!isObjectRecord(value)) return ''
  if (String(value.type || '').trim() !== 'Collection') return ''
  const rawItems = (value as IiifCollectionDocument).items
  const items = Array.isArray(rawItems) ? rawItems : []
  const firstItem = items.find((item) => isObjectRecord(item) && String(item.id || '').trim())
  return String(firstItem?.id || '').trim()
}

async function resolveIiifManifestUrlInternal(manifestPath: string): Promise<string> {
  const manifestUrl = buildManifestUrl(manifestPath)
  if (!manifestUrl) return ''
  let manifestFetchError: Error | null = null

  try {
    const manifestDoc = await fetchJsonDocument(manifestUrl)
    if (isIiifPresentationManifest(manifestDoc)) return manifestUrl
  } catch (error) {
    manifestFetchError = error instanceof Error ? error : new Error(String(error))
  }

  const collectionUrl = buildIiifCollectionUrl(manifestUrl)
  if (!collectionUrl) {
    if (manifestFetchError?.message.includes('returned html')) {
      throw new Error('IIIF manifest 返回了 HTML 页面，请检查 manifest 地址或后端代理配置。')
    }
    return manifestUrl
  }

  try {
    const collectionDoc = await fetchJsonDocument(collectionUrl)
    const realManifestId = readCollectionManifestId(collectionDoc)
    return realManifestId ? buildManifestUrl(realManifestId) : manifestUrl
  } catch (error) {
    const collectionFetchError = error instanceof Error ? error : new Error(String(error))
    if (
      manifestFetchError?.message.includes('returned html') ||
      collectionFetchError.message.includes('returned html')
    ) {
      throw new Error('IIIF manifest 返回了 HTML 页面，请检查 manifest 地址或后端代理配置。')
    }
    return manifestUrl
  }
}

export async function resolveIiifManifestUrl(manifestPath: string): Promise<string> {
  const manifestUrl = buildManifestUrl(manifestPath)
  if (!manifestUrl) return ''
  if (!manifestResolutionCache.has(manifestUrl)) {
    const task = resolveIiifManifestUrlInternal(manifestUrl)
    manifestResolutionCache.set(manifestUrl, task)
    void task.catch(() => {
      if (manifestResolutionCache.get(manifestUrl) === task) {
        manifestResolutionCache.delete(manifestUrl)
      }
    })
  }
  return manifestResolutionCache.get(manifestUrl) || Promise.resolve(manifestUrl)
}

export function clearIiifManifestResolutionCache(): void {
  manifestResolutionCache.clear()
}
