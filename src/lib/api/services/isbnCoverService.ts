/**
 * ISBN 封面服务
 *
 * 通过公开 API 拉取图书封面，优先 Google Books，其次 OpenLibrary。
 */

const GOOGLE_BOOKS_ENDPOINT = 'https://www.googleapis.com/books/v1/volumes'
const OPEN_LIBRARY_BOOKS_ENDPOINT = 'https://openlibrary.org/api/books'
const REQUEST_TIMEOUT_MS = 5000

interface GoogleBooksImageLinks {
  extraLarge?: string
  large?: string
  medium?: string
  small?: string
  thumbnail?: string
  smallThumbnail?: string
}

interface GoogleBooksVolume {
  volumeInfo?: {
    imageLinks?: GoogleBooksImageLinks
  }
}

interface GoogleBooksResponse {
  totalItems?: number
  items?: GoogleBooksVolume[]
}

interface OpenLibraryBookEntry {
  cover?: {
    large?: string
    medium?: string
    small?: string
  }
}

type OpenLibraryResponse = Record<string, OpenLibraryBookEntry>

/** 归一化 ISBN（移除非数字字符，转大写） */
export function normalizeIsbn(rawIsbn: string): string {
  return String(rawIsbn || '')
    .toUpperCase()
    .replace(/[^0-9X]/g, '')
    .trim()
}

function isLikelyValidIsbn(isbn: string): boolean {
  return /^\d{13}$/.test(isbn) || /^\d{9}[0-9X]$/.test(isbn)
}

function normalizeHttpsUrl(rawUrl: string | undefined): string {
  const value = String(rawUrl || '').trim()
  if (!value) return ''
  if (value.startsWith('https://')) return value
  if (value.startsWith('http://')) return `https://${value.slice(7)}`
  if (value.startsWith('//')) return `https:${value}`
  return ''
}

function pickCoverUrl(candidates: Array<string | undefined>): string {
  for (const candidate of candidates) {
    const normalized = normalizeHttpsUrl(candidate)
    if (normalized) return normalized
  }
  return ''
}

async function fetchJsonWithTimeout<T>(url: string): Promise<T | null> {
  if (typeof globalThis.fetch !== 'function') return null

  const controller = typeof globalThis.AbortController === 'function'
    ? new globalThis.AbortController()
    : null
  const timer = setTimeout(() => {
    controller?.abort()
  }, REQUEST_TIMEOUT_MS)

  try {
    const response = await globalThis.fetch(url, {
      ...(controller ? { signal: controller.signal } : {}),
    })
    if (!response.ok) return null
    return await response.json() as T
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function normalizeSearchTitle(rawTitle: string): string {
  return String(rawTitle || '').replace(/\s+/g, ' ').trim()
}

async function fetchGoogleBooksCoverByQuery(query: string): Promise<string> {
  const normalizedQuery = String(query || '').trim()
  if (!normalizedQuery) return ''

  const url = `${GOOGLE_BOOKS_ENDPOINT}?q=${encodeURIComponent(normalizedQuery)}&maxResults=5`
  const payload = await fetchJsonWithTimeout<GoogleBooksResponse>(url)
  if (!payload || !Array.isArray(payload.items)) return ''

  for (const item of payload.items) {
    const imageLinks = item?.volumeInfo?.imageLinks
    const cover = pickCoverUrl([
      imageLinks?.extraLarge,
      imageLinks?.large,
      imageLinks?.medium,
      imageLinks?.small,
      imageLinks?.thumbnail,
      imageLinks?.smallThumbnail,
    ])
    if (cover) return cover
  }

  return ''
}

async function fetchGoogleBooksCoverByIsbn(isbn: string): Promise<string> {
  return fetchGoogleBooksCoverByQuery(`isbn:${isbn}`)
}

async function fetchGoogleBooksCoverByTitle(title: string): Promise<string> {
  const normalizedTitle = normalizeSearchTitle(title)
  if (!normalizedTitle) return ''
  return fetchGoogleBooksCoverByQuery(`intitle:${normalizedTitle}`)
}

async function fetchOpenLibraryCover(isbn: string): Promise<string> {
  const url = `${OPEN_LIBRARY_BOOKS_ENDPOINT}?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`
  const payload = await fetchJsonWithTimeout<OpenLibraryResponse>(url)
  if (!payload) return ''

  const entry = payload[`ISBN:${isbn}`]
  const cover = pickCoverUrl([
    entry?.cover?.large,
    entry?.cover?.medium,
    entry?.cover?.small,
  ])

  return cover
}

/** 通过 ISBN 获取图书封面 URL（优先 Google Books，其次 OpenLibrary，最后按标题搜索） */
export async function fetchBookCoverByIsbn(rawIsbn: string, fallbackTitle = ''): Promise<string | null> {
  const isbn = normalizeIsbn(rawIsbn)
  if (!isLikelyValidIsbn(isbn)) return null

  const googleCover = await fetchGoogleBooksCoverByIsbn(isbn)
  if (googleCover) return googleCover

  const openLibraryCover = await fetchOpenLibraryCover(isbn)
  if (openLibraryCover) return openLibraryCover

  const titleCover = await fetchGoogleBooksCoverByTitle(fallbackTitle)
  if (titleCover) return titleCover

  return null
}
