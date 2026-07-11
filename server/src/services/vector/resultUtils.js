import { VECTOR_CONFIG } from './config.js'

export function resolveCandidatePoolSize(options = {}, topK = VECTOR_CONFIG.defaultTopK) {
  const rawCandidatePoolSize = Number(options.candidatePoolSize) || VECTOR_CONFIG.candidatePoolSize
  const minByTopK = Math.max(Number(topK) * 4, Number(topK) + 12)
  const lowerBound = Math.max(rawCandidatePoolSize, minByTopK)
  return Math.min(Math.floor(lowerBound), VECTOR_CONFIG.maxCandidatePoolSize)
}

function clampRatio(rawValue, fallbackValue) {
  const value = Number(rawValue)
  if (!Number.isFinite(value)) return fallbackValue
  return Math.min(0.8, Math.max(0.1, value))
}

function toResultDedupKey(row) {
  return String(row?.poemId || row?.uri || '').trim()
}

function getPoemResultBucket(row) {
  const uri = String(row?.uri || '')
  if (uri.includes('/poem/set/')) return 'set'
  if (uri.includes('/poem/text/')) return 'txt'
  return 'other'
}

/**
 * 诗文分层配额：保证 poem/set 与 poem/text 在 TopK 中都有最低占比。
 */
export function applyPoemLayeredQuota(sortedRows = [], topK = VECTOR_CONFIG.defaultTopK, config = VECTOR_CONFIG) {
  if (!Array.isArray(sortedRows) || sortedRows.length === 0) return []
  const safeTopK = Math.max(1, Math.floor(Number(topK) || config.defaultTopK))
  const setRows = []
  const txtRows = []

  for (const row of sortedRows) {
    const bucket = getPoemResultBucket(row)
    if (bucket === 'set') setRows.push(row)
    if (bucket === 'txt') txtRows.push(row)
  }

  const setRatio = clampRatio(config.poemSetQuotaRatio, 0.4)
  const txtRatio = clampRatio(config.poemTxtQuotaRatio, 0.4)
  let setQuota = Math.min(setRows.length, Math.max(1, Math.floor(safeTopK * setRatio)))
  let txtQuota = Math.min(txtRows.length, Math.max(1, Math.floor(safeTopK * txtRatio)))

  while (setQuota + txtQuota > safeTopK) {
    if (txtQuota >= setQuota && txtQuota > 0) {
      txtQuota -= 1
    } else if (setQuota > 0) {
      setQuota -= 1
    } else {
      break
    }
  }

  const selected = []
  const seen = new Set()
  const pick = (row) => {
    const key = toResultDedupKey(row)
    if (!key || seen.has(key)) return false
    seen.add(key)
    selected.push(row)
    return true
  }

  for (const row of setRows) {
    if (setQuota <= 0) break
    if (pick(row)) setQuota -= 1
  }
  for (const row of txtRows) {
    if (txtQuota <= 0) break
    if (pick(row)) txtQuota -= 1
  }

  for (const row of sortedRows) {
    if (selected.length >= safeTopK) break
    pick(row)
  }

  return selected.slice(0, safeTopK)
}

export function normalizeLexicalQuery(rawQueryText = '') {
  const text = String(rawQueryText || '')
    .replace(/[，。！？；：、,.!?;:]/g, ' ')
    .replace(/[“”"'‘’「」『』《》【】（）()]/g, ' ')
    .replace(/\[/g, ' ')
    .replace(/\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text || text === '*') return ''
  return text
}

export function validateVectorDimension(vector) {
  return Array.isArray(vector) && vector.length === VECTOR_CONFIG.vectorDimension
}

export function resolveVectorTypeByIndexPath(indexPath = '') {
  const path = String(indexPath || '')
  if (path.includes('/person/')) return 'person'
  if (path.includes('/book/')) return 'book'
  if (path.includes('/ancient-book/')) return 'ancient_book'
  if (path.includes('/place/')) return 'place'
  if (path.includes('/concept/')) return 'concept'
  if (path.includes('/iiif/')) return 'iiif'
  return 'poem'
}

export function buildVectorResultBase({ result, doc, indexPath, similarity }) {
  const uri = String(result?.uri || '').trim()
  const uriParts = uri.split('/')
  const fileName = uriParts[uriParts.length - 1] || ''
  const entityId = fileName.replace('.json', '')
  const isSet = doc?.scope === 'poem/set'
  const isTxt = doc?.scope === 'poem/text'

  let poemId = null
  if (isSet) {
    const iriMatch = doc?.entity_iri?.match?.(/\/poems\/(\d+)/)
    poemId = iriMatch ? iriMatch[1] : entityId.replace('poem_', '')
  } else if (isTxt) {
    poemId = doc?.evidence?.poem_id
  }

  return {
    uri,
    id: entityId,
    poemId,
    score: Number(result?.score || 0),
    confidence: Number(result?.confidence || 0),
    similarity,
    title: doc?.text_norm || `实体 ${entityId}`,
    snippet: doc?.text_norm || '',
    matchedText: doc?.text_norm || '',
    type: resolveVectorTypeByIndexPath(indexPath),
    source: 'vector',
    indexPath,
    modelId: doc?.model_id,
    _isTxt: isTxt,
    _frontendUrl: String(doc?.evidence?.frontend_url || '').trim(),
  }
}

export function vectorResultKey(row) {
  return String(row?.poemId || row?.uri || '').trim()
}
