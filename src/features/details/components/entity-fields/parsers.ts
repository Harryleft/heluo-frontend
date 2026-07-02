/**
 * 实体字段解析器
 *
 * 用于解析各类实体的字段信息，生成结构化的字段组。
 * 支持的实体类型：图书、地点、概念、人物、古籍
 */

import type { FieldGroup, FieldRow } from './types'
import { asArray, asRecord, normalizeText, parsePointWkt, pickNodeText, uniq } from './utils'

// ============================================================================
// 私有实现 - 工具函数
// ============================================================================

function sanitizeRows(rows: FieldRow[]): FieldRow[] {
  return rows.filter((row) => normalizeText(row.label) && normalizeText(row.value))
}

function createGroup(title: string, rows: FieldRow[]): FieldGroup | null {
  const sanitized = sanitizeRows(rows)
  if (!sanitized.length) return null
  return { title, rows: sanitized }
}

// ============================================================================
// 公共 API - 图书字段解析
// ============================================================================

interface BookFieldGroupOptions {
  summarySnippet?: string
}

function normalizeComparableText(value: string): string {
  return normalizeText(value).replace(/[\s，。；：？！,.!?;:]/g, '').toLowerCase()
}

function isSameBookDescription(left: string, right: string): boolean {
  if (!left || !right) return false
  return normalizeComparableText(left) === normalizeComparableText(right)
}

function containsChineseText(value: string): boolean {
  return /[\u4e00-\u9fff]/.test(value)
}

function hasIdentifierShape(value: string): boolean {
  return /[0-9]/.test(value) || /[A-Za-z]/.test(value) || value.includes('-') || value.includes('.')
}

function isTitleLikeIdentifier(typeLabel: string): boolean {
  const normalized = normalizeText(typeLabel).toLowerCase()
  if (!normalized) return false
  return (
    normalized.includes('primary name') ||
    normalized.includes('title') ||
    normalized.includes('书名') ||
    normalized.includes('题名') ||
    normalized.includes('名称')
  )
}

function shouldKeepIdentifier(identifier: string, typeLabel: string, title: string): boolean {
  const normalizedIdentifier = normalizeComparableText(identifier)
  const normalizedTitle = normalizeComparableText(title)
  if (!normalizedIdentifier) return false
  if (normalizedTitle && normalizedIdentifier === normalizedTitle) return false
  if (isTitleLikeIdentifier(typeLabel)) return false
  if (containsChineseText(identifier) && !hasIdentifierShape(identifier)) return false
  return true
}

function inferIdentifierFieldLabel(typeLabel: string, identifier: string): string {
  const normalizedType = normalizeText(typeLabel).toLowerCase()
  const compactIdentifier = normalizeText(identifier).replace(/\s+/g, '')

  if (normalizedType.includes('isbn') || /^97[89][0-9\-xX]+$/.test(compactIdentifier)) {
    return 'ISBN'
  }

  if (
    normalizedType.includes('索书号') ||
    normalizedType.includes('call number') ||
    normalizedType.includes('shelf') ||
    normalizedType.includes('classification') ||
    normalizedType.includes('馆藏')
  ) {
    return '馆藏检索号'
  }

  if (/^[A-Za-z]{1,3}\d+(?:\.\d+)?$/.test(compactIdentifier)) {
    return '馆藏检索号'
  }

  if (normalizedType.includes('issn')) return 'ISSN'
  if (normalizedType.includes('doi')) return 'DOI'
  if (typeLabel) return typeLabel
  return '编号'
}

function getIdentifierFieldOrder(label: string): number {
  if (label === 'ISBN') return 1
  if (label === '馆藏检索号') return 2
  if (label === 'ISSN') return 3
  if (label === 'DOI') return 4
  if (label === '编号') return 99
  return 50
}

function formatBookDimensionValue(record: Record<string, unknown>): string {
  const rawValue = pickNodeText(record.value)
  const unit = normalizeDimensionUnit(pickNodeText(record.unit))
  if (!rawValue) return ''
  if (!unit) return rawValue
  if (rawValue.includes(unit)) return rawValue
  return `${rawValue} ${unit}`
}

function normalizeDimensionUnit(unit: string): string {
  const normalized = normalizeText(unit)
  if (!normalized) return ''
  const lower = normalized.toLowerCase()
  if (lower === 'page' || lower === 'pages' || lower === 'p') return '页'
  return normalized
}

function isMonetaryDimension(record: Record<string, unknown>): boolean {
  const dimensionType = normalizeText(record.type).toLowerCase()
  if (dimensionType === 'monetaryamount' || dimensionType.includes('monetary')) return true
  return Boolean(pickNodeText(record.currency))
}

function normalizeCurrencyUnit(currency: string): string {
  const normalized = normalizeText(currency)
  if (!normalized) return ''
  const lower = normalized.toLowerCase()
  if (lower.includes('yuan') || lower.includes('cny') || normalized.includes('人民币')) return '元'
  return normalized
}

function formatMonetaryDimensionValue(record: Record<string, unknown>): string {
  const amount = pickNodeText(record.value)
  if (!amount) return ''
  const unit = normalizeCurrencyUnit(pickNodeText(record.currency))
  if (!unit) return amount
  if (amount.includes(unit)) return amount
  return `${amount} ${unit}`
}

function extractBookIdentifierRows(entity: Record<string, unknown>, title: string): FieldRow[] {
  const identifiedBy = asArray(entity.identified_by).map((item) => asRecord(item))
  const groupedValues = new Map<string, string[]>()

  identifiedBy.forEach((item) => {
    const typeLabel = pickNodeText(item.classified_as)
    const identifier = pickNodeText(item.content || item.value || item)
    if (!shouldKeepIdentifier(identifier, typeLabel, title)) return

    const fieldLabel = inferIdentifierFieldLabel(typeLabel, identifier)
    if (!groupedValues.has(fieldLabel)) {
      groupedValues.set(fieldLabel, [])
    }

    const values = groupedValues.get(fieldLabel) || []
    if (!values.includes(identifier)) {
      values.push(identifier)
    }
    groupedValues.set(fieldLabel, values)
  })

  return Array.from(groupedValues.entries())
    .sort(([left], [right]) => getIdentifierFieldOrder(left) - getIdentifierFieldOrder(right))
    .map(([label, values]) => ({ label, value: values.join('；') }))
}

function isComposedByKnownValues(value: string, knownValues: Set<string>): boolean {
  const normalized = normalizeText(value)
  if (!normalized) return false

  const fragments = normalized
    .split(/[；;，,、/|]/)
    .map((part) => normalizeComparableText(part))
    .filter(Boolean)

  if (fragments.length < 2) return false
  return fragments.every((fragment) => knownValues.has(fragment))
}

function extractBookDescriptionRows(
  entity: Record<string, unknown>,
  options: BookFieldGroupOptions,
  knownValues: Set<string>,
): FieldRow[] {
  const summarySnippet = normalizeText(options.summarySnippet)
  const descriptions = uniq(
    asArray(entity.referred_to_by)
      .map((item) => pickNodeText(asRecord(item).content))
      .map((text) => normalizeText(text))
      .filter((text) => text && !text.startsWith('http')),
  ).filter((text) => {
    if (isSameBookDescription(text, summarySnippet)) return false
    const normalized = normalizeComparableText(text)
    if (normalized && knownValues.has(normalized)) return false
    if (isComposedByKnownValues(text, knownValues)) return false
    return true
  })

  return descriptions.map((value, index) => ({
    label: index === 0 ? '简介' : `补充说明 ${index + 1}`,
    value,
  }))
}

/** 解析图书实体的字段组 */
export function parseBookFieldGroups(
  entity: Record<string, unknown>,
  options: BookFieldGroupOptions = {},
): FieldGroup[] {
  const groups: FieldGroup[] = []
  const title = pickNodeText(entity._label || entity)
  const createdBy = asRecord(entity.created_by)
  const producedBy = asRecord(entity.produced_by)

  const authors = uniq(asArray(createdBy.carried_out_by).map((item) => pickNodeText(item)))
  const publishers = uniq(asArray(producedBy.carried_out_by).map((item) => pickNodeText(item)))
  const publishPlaces = uniq(asArray(producedBy.took_place_at).map((item) => pickNodeText(item)))
  const publishDate = pickNodeText(producedBy.timespan)
  const owners = uniq(asArray(entity.current_owner).map((item) => pickNodeText(item)))
  const identifierRows = extractBookIdentifierRows(entity, title)

  const knownValues = new Set<string>([
    normalizeComparableText(title),
    ...authors.map((item) => normalizeComparableText(item)),
    ...publishers.map((item) => normalizeComparableText(item)),
    ...publishPlaces.map((item) => normalizeComparableText(item)),
    ...owners.map((item) => normalizeComparableText(item)),
    ...identifierRows
      .flatMap((item) => item.value.split(/[；;]/))
      .map((item) => normalizeComparableText(item)),
  ].filter(Boolean))

  const dimensions = asArray(entity.dimension).map((item) => {
    const record = asRecord(item)
    const monetary = isMonetaryDimension(record)
    const label = monetary ? '金额' : pickNodeText(record.classified_as) || normalizeDimensionUnit(pickNodeText(record.unit)) || '尺寸'
    const value = monetary ? formatMonetaryDimensionValue(record) : formatBookDimensionValue(record)
    if (value) {
      knownValues.add(normalizeComparableText(value))
    }
    return { label, value }
  })

  const basicGroup = createGroup('基本信息', [
    { label: '名称', value: title },
    { label: '作者', value: authors.join('、') },
    ...identifierRows,
    ...dimensions,
    { label: '出版机构', value: publishers.join('、') },
    { label: '出版时间', value: publishDate },
    { label: '出版地', value: publishPlaces.join('、') },
    { label: '馆藏机构', value: owners.join('、') },
  ])
  if (basicGroup) groups.push(basicGroup)

  const introGroup = createGroup('内容介绍', extractBookDescriptionRows(entity, options, knownValues))
  if (introGroup) groups.push(introGroup)

  return groups
}

// ============================================================================
// 公共 API - 地点字段解析
// ============================================================================

/** 解析地点实体的字段组 */
export function parsePlaceFieldGroups(entity: Record<string, unknown>): FieldGroup[] {
  const groups: FieldGroup[] = []
  const coordinate = parsePointWkt(entity.defined_by || entity['crm:P168_place_is_defined_by'])
  const parentPlaces = uniq(asArray(entity.part_of).map((item) => pickNodeText(item)))

  const basicGroup = createGroup('地理核心信息', [
    { label: '名称', value: pickNodeText(entity._label || entity) },
    { label: '坐标', value: coordinate },
    { label: '上级区域', value: parentPlaces.join('、') },
  ])
  if (basicGroup) groups.push(basicGroup)

  const historicalRows = asArray(entity.attributed_by).map((item, index) => {
    const record = asRecord(item)
    const name = pickNodeText(record._label || record)
    const time = pickNodeText(record.timespan)
    return { label: `历史名称 ${index + 1}`, value: [name, time].filter(Boolean).join(' / ') }
  })
  const historicalGroup = createGroup('历史演变过程', historicalRows)
  if (historicalGroup) groups.push(historicalGroup)
  return groups
}

// ============================================================================
// 公共 API - 概念字段解析
// ============================================================================

/** 解析概念实体的字段组 */
export function parseConceptFieldGroups(entity: Record<string, unknown>): FieldGroup[] {
  const groups: FieldGroup[] = []
  const broaderRows = asArray(entity.broader).map((item, index) => ({
    label: `上位概念 ${index + 1}`,
    value: pickNodeText(item),
  }))
  const narrowerRows = asArray(entity.narrower).map((item, index) => ({
    label: `下位概念 ${index + 1}`,
    value: pickNodeText(item),
  }))
  const inScheme = pickNodeText(entity.in_scheme || entity['skos:inScheme'])

  const basicGroup = createGroup('概念核心字段', [
    { label: '名称', value: pickNodeText(entity._label || entity) },
    { label: '实体类型', value: normalizeText(entity.type) },
    { label: '所属体系', value: inScheme },
  ])
  if (basicGroup) groups.push(basicGroup)

  const relationGroup = createGroup('概念关系字段', [...broaderRows, ...narrowerRows])
  if (relationGroup) groups.push(relationGroup)
  return groups
}

// ============================================================================
// 公共 API - 古籍字段解析
// ============================================================================

interface AncientBookFieldGroupOptions {
  digitalResourceCount?: number
}

function pickAncientBookActorNames(event: Record<string, unknown>): string[] {
  return uniq(asArray(event.carried_out_by).map((item) => pickNodeText(item)).filter(Boolean))
}

function pickAncientBookTimespan(event: Record<string, unknown>): string {
  const eventTimespan = asArray(event.timespan).map((item) => pickNodeText(item)).find(Boolean)
  if (eventTimespan) return eventTimespan
  return pickNodeText(event.timespan)
}

function pickAncientBookSource(entity: Record<string, unknown>): string {
  return asArray(entity.referred_to_by)
    .map((item) => asRecord(item))
    .map((item) => pickNodeText(item.source || item.content))
    .find(Boolean) || ''
}

/** 解析古籍实体的字段组 */
export function parseAncientBookFieldGroups(
  entity: Record<string, unknown>,
  options: AncientBookFieldGroupOptions = {},
): FieldGroup[] {
  const groups: FieldGroup[] = []
  const createdBy = asRecord(entity.created_by)
  const producedBy = asRecord(entity.produced_by)
  const title = pickNodeText(entity._label || entity)
  const entityType = normalizeText(entity.type)
  const digitalResourceCount = Number(options.digitalResourceCount)
  const creators = uniq([
    ...pickAncientBookActorNames(createdBy),
    ...pickAncientBookActorNames(producedBy),
  ])
  const timespan =
    pickAncientBookTimespan(createdBy) ||
    pickAncientBookTimespan(producedBy) ||
    pickNodeText(entity.timespan)
  const source = pickAncientBookSource(entity)

  const basicGroup = createGroup('古籍核心字段', [
    { label: '名称', value: title },
    { label: '实体类型', value: entityType },
    { label: '数字资源数', value: Number.isFinite(digitalResourceCount) && digitalResourceCount > 0 ? String(digitalResourceCount) : '' },
    { label: '创作者', value: creators.join('、') },
    { label: '时间', value: timespan },
    { label: '版本/来源', value: source },
  ])
  if (basicGroup) groups.push(basicGroup)
  return groups
}
