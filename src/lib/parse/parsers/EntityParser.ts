/**
 * 实体解析器
 *
 * 用于解析 JSON-LD 格式的实体数据，提供统一的实体信息提取接口。
 * 支持 CIDOC-CRM 和 Linked Art 数据模型。
 *
 * 主要功能：
 * - 实体类型判断（人物、地点、概念、古籍等）
 * - 元数据提取（出生/逝世日期、地点、朝代等）
 * - 关系提取（创作者、分类、IIIF 清单等）
 */

import { extractEntityInfo, extractLabel, forceArray, getName, isLikelyUrl, normalizeText, pickReadableText } from '@/lib/parse/data/helper'
import { getEntityTypeIcon } from '@/resources/entityIcons'

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 时间跨度信息
 */
export interface TimespanInfo {
  /** 开始时间（ISO 格式或原始字符串） */
  begin?: string
  /** 结束时间（ISO 格式或原始字符串） */
  end?: string
  /** 格式化的时间标签 */
  label?: string
}

/**
 * 创作者信息
 */
export interface CreatorInfo {
  /** 创作者 URI */
  uri: string
  /** 创作者名称 */
  label: string
  /** 角色标签（如"画家"、"作者"等） */
  role?: string
}

/**
 * 地点信息
 */
export interface PlaceInfo {
  /** 地点 URI */
  uri: string
  /** 地点名称 */
  label: string
}

/**
 * 分类信息
 */
export interface ClassificationInfo {
  /** 分类 URI */
  uri: string
  /** 分类标签 */
  label: string
  /** 分类类型 */
  type?: string
}

/**
 * 主题关系信息
 */
export interface AboutInfo {
  /** 主题 URI */
  uri: string
  /** 主题标签 */
  label: string
}

/**
 * 标识符信息
 */
export interface IdentifierInfo {
  /** 标识符类型 */
  type: string
  /** 标识符值 */
  value: string
  /** 分配机构（可选） */
  assignedBy?: string
}

/**
 * 元数据字段类型
 */
export interface MetadataField {
  /** 字段标签（中文） */
  labelZh: string
  /** 字段标签（英文） */
  labelEn: string
  /** 字段值 */
  value: string
  /** 是否为主要字段（影响显示顺序） */
  primary?: boolean
  /** 关联的 URI（用于显示为链接） */
  uri?: string
}

/**
 * 完整元数据接口
 */
export interface EntityMetadata {
  /** 实体类型 */
  type?: MetadataField
  /** 出生日期 */
  birthDate?: MetadataField
  /** 逝世日期 */
  deathDate?: MetadataField
  /** 出生地点 */
  birthPlace?: MetadataField
  /** 逝世地点 */
  deathPlace?: MetadataField
  /** 朝代 */
  dynasty?: MetadataField
  /** 国籍 */
  nationality?: MetadataField
  /** 职业 */
  occupation?: MetadataField
  /** 创作时间 */
  creationDate?: MetadataField
  /** 媒介 */
  medium?: MetadataField
  /** 尺寸 */
  dimensions?: MetadataField
  /** 馆藏 */
  collection?: MetadataField
  /** 时间跨度 */
  timespan?: TimespanInfo
  /** 创作者列表 */
  creators?: CreatorInfo[]
  /** 地点列表 */
  places?: PlaceInfo[]
  /** 分类列表 */
  classifications?: ClassificationInfo[]
  /** 所属集合（part_of） */
  partOf?: Array<{ uri: string; label: string }>
  /** 包含部分（has_part） */
  hasPart?: Array<{ uri: string; label: string }>
  /** "关于"主题关系 */
  about?: AboutInfo[]
  /** "展示/代表"关系 */
  shows?: AboutInfo[]
  /** 标识符列表 */
  identifiers?: IdentifierInfo[]
  /** IIIF 清单 URI */
  iiifManifests?: string[]
  /** 数字对象 URI */
  digitalSources?: string[]
}

// ============================================================================
// EntityParser 类
// ============================================================================

export class EntityParser {
  json: Record<string, unknown>

  constructor(json: Record<string, unknown>) {
    this.json = json || {}
  }

  /**
   * 获取实体类型（从 type 字段）
   * @returns 实体类型值，如 'Person', 'Set', 'HumanMadeObject' 等
   */
  getEntityType(): string {
    return String(this.json.type || '')
  }

  /**
   * 判断是否为人物实体
   */
  isPerson(): boolean {
    return this.getEntityType() === 'Person'
  }

  /**
   * 判断是否为集合实体（如诗集）
   */
  isSet(): boolean {
    return this.getEntityType() === 'Set'
  }

  /**
   * 判断是否为人工制品实体
   */
  isHumanMadeObject(): boolean {
    return this.getEntityType() === 'HumanMadeObject'
  }

  /**
   * 判断是否为语言对象实体
   */
  isLinguisticObject(): boolean {
    return this.getEntityType() === 'LinguisticObject'
  }

  /**
   * 判断是否为地点实体
   */
  isPlace(): boolean {
    return this.getEntityType() === 'Place'
  }

  /**
   * 判断是否为概念实体
   */
  isConcept(): boolean {
    const type = this.getEntityType()
    // Type 类型或包含概念相关的分类
    if (type === 'Type') return true
    const classifications = forceArray(this.json.classified_as as Record<string, unknown>[])
    return classifications.some((c) => {
      const label = normalizeText(c?._label || c?.label)
      return label?.includes('概念') || label?.includes('韵部') || label?.includes('体裁')
    })
  }

  /**
   * 判断是否为图书实体
   */
  isBook(): boolean {
    const classifications = forceArray(this.json.classified_as as Record<string, unknown>[])
    return classifications.some((c) => {
      const label = normalizeText(c?._label || c?.label)
      const id = String(c?.id || '')
      return label?.includes('图书') || id.includes('aat/300028051') || id.includes('/book')
    })
  }

  /**
   * 判断是否为古籍实体
   */
  isAncientBook(): boolean {
    const uri = String(this.json.id || this.json['@id'] || '')
    const classifications = forceArray(this.json.classified_as as Record<string, unknown>[])
    return (
      uri.includes('/ancient-book') ||
      classifications.some((c) => {
        const label = normalizeText(c?._label || c?.label)
        return label?.includes('古籍') || label?.includes('善本')
      })
    )
  }

  /**
   * 获取地理位置坐标
   * @returns 经纬度对象，格式为 { lat, lng }
   */
  getGeoLocation(): { lat: number; lng: number } | undefined {
    // 尝试从 defined_by 字段获取（POINT 格式）
    const definedBy = this.json.defined_by || this.json['crm:P168_place_is_defined_by']
    if (typeof definedBy === 'string' && definedBy.includes('POINT')) {
      const match = definedBy.match(/POINT\s*\(\s*([\d.-]+)\s+([\d.-]+)\s*\)/i)
      if (match) {
        return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) }
      }
    }

    // 尝试从 geo 字段获取
    const geo = this.json.geo as Record<string, unknown> | undefined
    if (geo) {
      const lat = parseFloat(String(geo.lat || geo.latitude || 0))
      const lng = parseFloat(String(geo.lng || geo.lon || geo.longitude || 0))
      if (lat && lng) return { lat, lng }
    }

    return undefined
  }

  /**
   * 获取概念类型
   * @returns 概念类型（韵部、体裁等）
   */
  getConceptType(): MetadataField | undefined {
    const scheme = this.json.in_scheme || this.json['skos:inScheme']
    if (scheme && typeof scheme === 'object') {
      const s = scheme as Record<string, unknown>
      const label = normalizeText(s._label || s.label)
      const id = String(s.id || '')

      if (label?.includes('韵部') || id.includes('rhyme')) {
        return { labelZh: '类型', labelEn: 'Type', value: '韵部' }
      }
      if (label?.includes('体裁') || label?.includes('诗体') || id.includes('poetic_form') || id.includes('poetic-form')) {
        return { labelZh: '类型', labelEn: 'Type', value: '体裁' }
      }
      if (id.includes('/concept/ancient-book') || id.includes('/ancient-book/concept')) {
        return { labelZh: '类型', labelEn: 'Type', value: '古籍概念' }
      }
    }

    // 默认根据 URI 判断
    const uri = String(this.json.id || this.json['@id'] || '')
    if (uri.includes('/rhyme')) {
      return { labelZh: '类型', labelEn: 'Type', value: '韵部' }
    }
    if (uri.includes('/poetic_form') || uri.includes('poetic-form')) {
      return { labelZh: '类型', labelEn: 'Type', value: '体裁' }
    }

    return undefined
  }

  /**
   * 获取 IIIF Manifest 列表
   * @returns IIIF Manifest URI 列表
   */
  getIIIFManifests(): string[] {
    const manifests: string[] = []

    // 从 carries 字段获取（古籍常见）
    const carries = forceArray(this.json.carries as Record<string, unknown>[])
    for (const item of carries) {
      const id = normalizeText(item?.id || item?.['@id'])
      this.pushManifestIfCandidate(manifests, id)
    }

    // 从 subject_of 字段获取（数字访问点和 digitally_carried_by）
    const subjectOf = forceArray(this.json.subject_of as Record<string, unknown>[])
    for (const item of subjectOf) {
      if (typeof item === 'object' && item) {
        const id = normalizeText(item?.id || item?.['@id'])
        this.pushManifestIfCandidate(manifests, id)

        // 嵌套的 digital 获取
        const digital = item?.digital as Record<string, unknown> | undefined
        if (digital) {
          const digitalId = normalizeText(digital.id || digital['@id'])
          this.pushUniqueValue(manifests, digitalId)
        }

        // 从 digitally_carried_by 获取（严格检查 conforms_to）
        const digitallyCarriedBy = forceArray(item.digitally_carried_by as Record<string, unknown>[])
        for (const digitalItem of digitallyCarriedBy) {
          if (!this.isIiifPresentationDigitalCarrier(digitalItem)) continue
          for (const accessPointId of this.collectAccessPointIds([digitalItem])) {
            this.pushUniqueValue(manifests, accessPointId)
          }
        }
      }
    }

    // 从 equivalent 字段获取
    const equivalent = forceArray(this.json.equivalent as Record<string, unknown>[])
    for (const item of equivalent) {
      const id = normalizeText(item?.id || item?.['@id'])
      this.pushManifestIfCandidate(manifests, id)
    }

    return manifests
  }

  /**
   * 获取地点别名
   * @returns 别名列表
   */
  getPlaceAliases(): string[] {
    const aliases: string[] = []
    const identifiedBy = forceArray(this.json.identified_by as Record<string, unknown>[])

    for (const item of identifiedBy) {
      const classifications = forceArray(item?.classified_as as Record<string, unknown>[])
      const isAlternate = classifications.some(
        (c) =>
          normalizeText(c?._label || c?.label)?.includes('Alternate') ||
          normalizeText(c?._label || c?.label)?.includes('别名') ||
          String(c?.id || '').includes('alternate')
      )
      if (isAlternate) {
        const content = normalizeText(item?.content)
        if (content) aliases.push(content)
      }
    }

    return aliases
  }

  /**
   * 获取内容简介/摘要
   * @returns 内容简介
   */
  getAbstract(): MetadataField | undefined {
    const referredToBy = forceArray(this.json.referred_to_by as Record<string, unknown>[])
    for (const row of referredToBy) {
      const classifications = forceArray(row?.classified_as as Record<string, unknown>[])
      const isAbstract = classifications.some(
        (c) =>
          normalizeText(c?._label || c?.label)?.includes('Abstract') ||
          normalizeText(c?._label || c?.label)?.includes('摘要') ||
          normalizeText(c?._label || c?.label)?.includes('简介')
      )
      if (isAbstract) {
        const content = normalizeText(row?.content)
        if (content) {
          return { labelZh: '内容简介', labelEn: 'Abstract', value: content }
        }
      }
    }

    // 如果没有专门的摘要，使用描述
    const description = this.getDescription()
    if (description) {
      return { labelZh: '内容简介', labelEn: 'Abstract', value: description }
    }

    return undefined
  }

  getPrimaryName(validatingLanguage = ''): string {
    return getName(this.json.identified_by, validatingLanguage)
  }

  getDescription(): string {
    const referredToBy = forceArray(this.json.referred_to_by as Record<string, unknown>[])
    for (const row of referredToBy) {
      const content = normalizeText(row?.content)
      if (content && !isLikelyUrl(content)) return content
    }
    const nested = referredToBy
      .map((row) => row?.identified_by)
      .flatMap((value) => forceArray(value as unknown[]))
      .map((item) => normalizeText((item as Record<string, unknown>)?.content))
      .filter(Boolean)
    const picked = pickReadableText(nested)
    return isLikelyUrl(picked) ? '' : picked
  }

  /**
   * 获取实体的超类型图标
   * @returns 包含 [图标类名, 说明文本] 的元组
   */
  getSupertypeIcon(): [string, string] {
    // 根据实体的 type 字段返回图标
    const type = String(this.json.type || '')
    return getEntityTypeIcon(type)
  }

  private pushUniqueValue(target: string[], value?: string): void {
    if (!value || target.includes(value)) return
    target.push(value)
  }

  private pushManifestIfCandidate(target: string[], value?: string): void {
    if (!value) return
    if (value.includes('manifest') || value.includes('iiif')) {
      this.pushUniqueValue(target, value)
    }
  }

  private isIiifPresentationDigitalCarrier(digitalCarrier: unknown): boolean {
    if (!digitalCarrier || typeof digitalCarrier !== 'object') return false
    const conformsTo = forceArray((digitalCarrier as Record<string, unknown>).conforms_to as Record<string, unknown>[])
    return conformsTo.some((conforms) => {
      if (!conforms || typeof conforms !== 'object') return false
      const conformsId = normalizeText(conforms.id)
      return Boolean(conformsId?.includes('iiif.io/api/presentation'))
    })
  }

  private collectAccessPointIds(digitalItems: Record<string, unknown>[]): string[] {
    const accessPointIds: string[] = []
    for (const digital of digitalItems) {
      if (!digital || typeof digital !== 'object') continue
      const accessPoint = forceArray(digital.access_point as Record<string, unknown>[])
      for (const point of accessPoint) {
        const id = normalizeText(point.id)
        this.pushUniqueValue(accessPointIds, id)
      }
    }
    return accessPointIds
  }

  /**
   * 从 timespan 对象中提取日期字符串
   */
  private extractTimespanDate(timespan: unknown): string {
    if (!timespan || typeof timespan !== 'object') return ''
    const ts = timespan as Record<string, unknown>

    // 优先使用 _label（真实数据使用）
    const label = normalizeText(ts._label)
    if (label) return label

    // 其次使用 formatted_value
    const formattedValue = normalizeText(ts.formatted_value)
    if (formattedValue) return formattedValue

    // 然后使用 begin_of_the_begin 或 end_of_the_end
    const begin = normalizeText(ts.begin_of_the_begin)
    const end = normalizeText(ts.end_of_the_end)

    if (begin && end) {
      // 提取年份部分
      const beginYear = begin.match(/^\d{4}/)?.[0] || begin
      const endYear = end.match(/^\d{4}/)?.[0] || end
      return beginYear === endYear ? beginYear : `${beginYear} - ${endYear}`
    }

    return begin || end || ''
  }

  /**
   * 从 Place 对象中提取名称
   */
  private extractPlaceName(place: unknown): string {
    if (!place || typeof place !== 'object') return ''
    const p = place as Record<string, unknown>

    // 优先使用 identified_by 中的名称
    const identifiedBy = forceArray(p.identified_by as Record<string, unknown>[])
    for (const identifier of identifiedBy) {
      if (identifier?.type === 'Name') {
        const name = normalizeText(identifier.content)
        if (name) return name
      }
    }

    // 其次使用 _label 或 label
    return normalizeText(p._label || p.label || '')
  }

  /**
   * 获取实体的类型（顶层类型，如 Person、Place 等）
   */
  getType(): MetadataField | undefined {
    const entityType = normalizeText(this.json.type)
    if (!entityType) return undefined

    // 类型映射为中文
    const typeLabels: Record<string, { zh: string; en: string }> = {
      Person: { zh: '人物', en: 'Person' },
      Place: { zh: '地点', en: 'Place' },
      Work: { zh: '作品', en: 'Work' },
      Set: { zh: '集合', en: 'Set' },
      Group: { zh: '团体', en: 'Group' },
      Activity: { zh: '活动', en: 'Activity' },
      Period: { zh: '时期', en: 'Period' },
      Concept: { zh: '概念', en: 'Concept' },
      Language: { zh: '语言', en: 'Language' },
      Material: { zh: '材料', en: 'Material' },
      Type: { zh: '类型', en: 'Type' },
      MeasurementUnit: { zh: '计量单位', en: 'Measurement Unit' },
    }

    const labels = typeLabels[entityType] || { zh: entityType, en: entityType }
    return { labelZh: '类型', labelEn: 'Type', value: labels.zh, primary: true }
  }

  /**
   * 获取朝代信息（从 classified_as 中提取，标识为 ULAN 朝代类型）
   */
  getDynasty(): MetadataField | undefined {
    const classifiedAs = forceArray(this.json.classified_as as Record<string, unknown>[])
    for (const item of classifiedAs) {
      if (typeof item === 'object' && item) {
        const uri = normalizeText(item.id)
        const label = normalizeText(item._label || item.label)
        // 朝代信息通常来自 ULAN 或包含"朝"字
        if (label && (uri?.includes('ulan') || label.includes('朝'))) {
          return { labelZh: '朝代', labelEn: 'Dynasty', value: label }
        }
      }
    }
    return undefined
  }

  /**
   * 获取出生日期（用于人物实体）
   * 支持两种数据结构：born (真实数据) 和 brought_into_existence (CIDOC-CRM)
   */
  getBirthDate(): MetadataField | undefined {
    // 优先从 born 字段获取（真实数据结构）
    const born = this.json.born as Record<string, unknown> | undefined
    if (born && typeof born === 'object') {
      const timespan = born.timespan
      const date = this.extractTimespanDate(timespan)
      if (date) {
        return { labelZh: '出生日期', labelEn: 'Birth Date', value: date }
      }
    }

    // 备用：从 brought_into_existence 获取（CIDOC-CRM 标准）
    const broughtIntoExistence = forceArray(this.json.brought_into_existence as Record<string, unknown>[])
    for (const event of broughtIntoExistence) {
      if (typeof event === 'object' && event?.type === 'Birth') {
        const timespan = (event as Record<string, unknown>).timespan
        const date = this.extractTimespanDate(timespan)
        if (date) {
          return { labelZh: '出生日期', labelEn: 'Birth Date', value: date }
        }
      }
    }
    return undefined
  }

  /**
   * 获取逝世日期（用于人物实体）
   * 支持两种数据结构：died (真实数据) 和 taken_out_of_existence (CIDOC-CRM)
   */
  getDeathDate(): MetadataField | undefined {
    // 优先从 died 字段获取（真实数据结构）
    const died = this.json.died as Record<string, unknown> | undefined
    if (died && typeof died === 'object') {
      const timespan = died.timespan
      const date = this.extractTimespanDate(timespan)
      if (date) {
        return { labelZh: '逝世日期', labelEn: 'Death Date', value: date }
      }
    }

    // 备用：从 taken_out_of_existence 获取（CIDOC-CRM 标准）
    const takenOutOfExistence = forceArray(this.json.taken_out_of_existence as Record<string, unknown>[])
    for (const event of takenOutOfExistence) {
      if (typeof event === 'object' && event?.type === 'Death') {
        const timespan = (event as Record<string, unknown>).timespan
        const date = this.extractTimespanDate(timespan)
        if (date) {
          return { labelZh: '逝世日期', labelEn: 'Death Date', value: date }
        }
      }
    }
    return undefined
  }

  /**
   * 获取出生地点
   * 支持两种数据结构：born.took_place_at (真实数据) 和 brought_into_existence
   */
  getBirthPlace(): MetadataField | undefined {
    // 优先从 born.took_place_at 获取（真实数据结构）
    const born = this.json.born as Record<string, unknown> | undefined
    if (born && typeof born === 'object') {
      const tookPlaceAt = forceArray(born.took_place_at as Record<string, unknown>[])
      for (const place of tookPlaceAt) {
        const name = this.extractPlaceName(place)
        const uri = normalizeText(place?.id)
        if (name) {
          return { labelZh: '出生地点', labelEn: 'Birth Place', value: name, uri }
        }
      }
    }

    // 备用：从 brought_into_existence 获取（CIDOC-CRM 标准）
    const broughtIntoExistence = forceArray(this.json.brought_into_existence as Record<string, unknown>[])
    for (const event of broughtIntoExistence) {
      if (typeof event === 'object' && event?.type === 'Birth') {
        const tookPlaceAt = forceArray((event as Record<string, unknown>).took_place_at as Record<string, unknown>[])
        for (const place of tookPlaceAt) {
          const name = this.extractPlaceName(place)
          const uri = normalizeText(place?.id)
          if (name) {
            return { labelZh: '出生地点', labelEn: 'Birth Place', value: name, uri }
          }
        }
      }
    }
    return undefined
  }

  /**
   * 获取逝世地点
   * 支持两种数据结构：died.took_place_at (真实数据) 和 taken_out_of_existence
   */
  getDeathPlace(): MetadataField | undefined {
    // 优先从 died.took_place_at 获取（真实数据结构）
    const died = this.json.died as Record<string, unknown> | undefined
    if (died && typeof died === 'object') {
      const tookPlaceAt = forceArray(died.took_place_at as Record<string, unknown>[])
      for (const place of tookPlaceAt) {
        const name = this.extractPlaceName(place)
        const uri = normalizeText(place?.id)
        if (name) {
          return { labelZh: '逝世地点', labelEn: 'Death Place', value: name, uri }
        }
      }
    }

    // 备用：从 taken_out_of_existence 获取（CIDOC-CRM 标准）
    const takenOutOfExistence = forceArray(this.json.taken_out_of_existence as Record<string, unknown>[])
    for (const event of takenOutOfExistence) {
      if (typeof event === 'object' && event?.type === 'Death') {
        const tookPlaceAt = forceArray((event as Record<string, unknown>).took_place_at as Record<string, unknown>[])
        for (const place of tookPlaceAt) {
          const name = this.extractPlaceName(place)
          const uri = normalizeText(place?.id)
          if (name) {
            return { labelZh: '逝世地点', labelEn: 'Death Place', value: name, uri }
          }
        }
      }
    }
    return undefined
  }

  /**
   * 获取国籍/归属地
   */
  getNationality(): MetadataField | undefined {
    const subjectOf = forceArray(this.json.subject_of as Record<string, unknown>[])
    for (const item of subjectOf) {
      if (typeof item === 'object' && item) {
        // 查找国籍相关信息
        const label = normalizeText((item as Record<string, unknown>)._label || (item as Record<string, unknown>).label)
        if (label && label.includes('国')) {
          return { labelZh: '国籍', labelEn: 'Nationality', value: label }
        }
      }
    }

    // 也从 classified_as 中查找国籍相关信息
    const classifiedAs = forceArray(this.json.classified_as as Record<string, unknown>[])
    for (const item of classifiedAs) {
      if (typeof item === 'object' && item) {
        const label = normalizeText((item as Record<string, unknown>)._label || (item as Record<string, unknown>).label)
        if (label && (label.includes('国') || label.includes('Nationality'))) {
          return { labelZh: '国籍', labelEn: 'Nationality', value: label }
        }
      }
    }

    return undefined
  }

  /**
   * 获取职业（从 carried_out 提取）
   */
  getOccupation(): MetadataField | undefined {
    // 优先从 carried_out 提取职业信息
    const carriedOut = forceArray(this.json.carried_out as Record<string, unknown>[])
    for (const item of carriedOut) {
      if (typeof item === 'object' && item) {
        // 检查是否标记为职业类型
        const classifiedAs = forceArray((item as Record<string, unknown>).classified_as as Record<string, unknown>[])
        const isOccupation = classifiedAs.some((c) => {
          const label = normalizeText(c._label || c.label)
          const uri = normalizeText(c.id)
          return label?.toLowerCase() === 'occupation' || uri?.includes('300263369')
        })

        if (isOccupation) {
          const label = normalizeText((item as Record<string, unknown>)._label || (item as Record<string, unknown>).label)
          if (label && !isLikelyUrl(label)) {
            return { labelZh: '官职', labelEn: 'Official Title', value: label }
          }
        }
      }
    }

    // 备用：从 subject_of 中查找职业信息
    const subjectOf = forceArray(this.json.subject_of as Record<string, unknown>[])
    for (const item of subjectOf) {
      if (typeof item === 'object' && item) {
        const label = normalizeText((item as Record<string, unknown>)._label || (item as Record<string, unknown>).label)
        if (label && !isLikelyUrl(label) && label.length > 1 && label.length < 50) {
          if (label.includes('诗') || label.includes('书') || label.includes('画') || label.includes('家') || label.includes('人')) {
            return { labelZh: '官职', labelEn: 'Official Title', value: label }
          }
        }
      }
    }

    return undefined
  }

  /**
   * 获取创作时间（用于作品）
   */
  getCreationDate(): MetadataField | undefined {
    const createdBy = forceArray(this.json.created_by as Record<string, unknown>[])
    for (const event of createdBy) {
      if (typeof event === 'object' && (event?.type === 'Creation' || event?.type === 'CreationEvent')) {
        const timespan = (event as Record<string, unknown>).timespan
        const date = this.extractTimespanDate(timespan)
        if (date) {
          return { labelZh: '创作时间', labelEn: 'Creation Date', value: date }
        }
      }
    }
    return undefined
  }

  /**
   * 获取媒介/材料
   */
  getMedium(): MetadataField | undefined {
    // 从 made_of 中提取材料信息
    const madeOf = forceArray(this.json.made_of as Record<string, unknown>[])
    const materials: string[] = []
    for (const item of madeOf) {
      if (typeof item === 'object' && item) {
        const label = normalizeText((item as Record<string, unknown>)._label || (item as Record<string, unknown>).label)
        if (label && !isLikelyUrl(label)) {
          materials.push(label)
        }
      }
    }
    if (materials.length > 0) {
      return { labelZh: '媒介', labelEn: 'Medium', value: materials.join('、') }
    }

    return undefined
  }

  /**
   * 获取尺寸信息
   */
  getDimensions(): MetadataField | undefined {
    // 从 dimension 属性中提取
    const dimensions = forceArray(this.json.dimension as Record<string, unknown>[])
    const dimensionParts: string[] = []
    for (const item of dimensions) {
      if (typeof item === 'object' && item) {
        const label = normalizeText((item as Record<string, unknown>)._label || (item as Record<string, unknown>).label)
        const value = normalizeText((item as Record<string, unknown>).value)
        if (value) {
          dimensionParts.push(label ? `${label}: ${value}` : value)
        }
      }
    }
    if (dimensionParts.length > 0) {
      return { labelZh: '尺寸', labelEn: 'Dimensions', value: dimensionParts.join(', ') }
    }

    return undefined
  }

  /**
   * 获取馆藏信息
   */
  getCollection(): MetadataField | undefined {
    const currentOwner = forceArray(this.json.current_owner as Record<string, unknown>[])
    for (const item of currentOwner) {
      if (typeof item === 'object' && item) {
        const label = normalizeText((item as Record<string, unknown>)._label || (item as Record<string, unknown>).label)
        if (label && !isLikelyUrl(label)) {
          return { labelZh: '馆藏', labelEn: 'Collection', value: label }
        }
      }
    }

    return undefined
  }

  /**
   * 获取时间跨度信息（从 timespan 或事件中的 timespan 提取）
   */
  getTimespan(): TimespanInfo | undefined {
    // 直接从 timespan 属性获取
    const timespan = this.json.timespan as Record<string, unknown> | undefined
    if (timespan) {
      return this.extractTimespanInfo(timespan)
    }

    // 从 created_by 事件中提取
    const createdBy = forceArray(this.json.created_by as Record<string, unknown>[])
    for (const event of createdBy) {
      if (typeof event === 'object' && event?.timespan) {
        const ts = this.extractTimespanInfo(event.timespan as Record<string, unknown>)
        if (ts.label) return ts
      }
    }

    // 从 brought_into_existence 事件中提取（人物出生时间）
    const broughtIntoExistence = forceArray(this.json.brought_into_existence as Record<string, unknown>[])
    for (const event of broughtIntoExistence) {
      if (typeof event === 'object' && event?.timespan) {
        const ts = this.extractTimespanInfo(event.timespan as Record<string, unknown>)
        if (ts.label) return { ...ts, label: `出生: ${ts.label}` }
      }
    }

    // 从 taken_out_of_existence 事件中提取（人物死亡时间）
    const takenOutOfExistence = forceArray(this.json.taken_out_of_existence as Record<string, unknown>[])
    for (const event of takenOutOfExistence) {
      if (typeof event === 'object' && event?.timespan) {
        const ts = this.extractTimespanInfo(event.timespan as Record<string, unknown>)
        if (ts.label) return { ...ts, label: `逝世: ${ts.label}` }
      }
    }

    return undefined
  }

  /**
   * 从 timespan 对象中提取时间跨度信息
   */
  private extractTimespanInfo(timespan: Record<string, unknown>): TimespanInfo {
    const info: TimespanInfo = {}

    // 优先使用 formatted_value
    const formattedValue = normalizeText(timespan.formatted_value)
    if (formattedValue) {
      info.label = formattedValue
    }

    // 提取 begin_of_the_begin 和 end_of_the_end
    const begin = normalizeText(timespan.begin_of_the_begin)
    const end = normalizeText(timespan.end_of_the_end)

    if (begin) {
      // 尝试提取年份
      const yearMatch = begin.match(/-?(\d{4})/)
      info.begin = yearMatch ? yearMatch[1] : begin
    }

    if (end) {
      const yearMatch = end.match(/-?(\d{4})/)
      info.end = yearMatch ? yearMatch[1] : end
    }

    // 如果没有 formatted_value，生成标签
    if (!info.label && (info.begin || info.end)) {
      if (info.begin && info.end && info.begin !== info.end) {
        info.label = `${info.begin} - ${info.end}`
      } else {
        info.label = info.begin || info.end || ''
      }
    }

    return info
  }

  /**
   * 获取创作者信息（从 created_by、carried_out_by 等属性提取）
   */
  getCreators(): CreatorInfo[] {
    const creators: CreatorInfo[] = []

    // 从 created_by 事件中提取
    const createdBy = forceArray(this.json.created_by as Record<string, unknown>[])
    for (const event of createdBy) {
      if (typeof event === 'object' && event) {
        // 提取 carried_out_by（执行者）
        const carriedOutBy = forceArray(event.carried_out_by as Record<string, unknown>[])
        for (const agent of carriedOutBy) {
          if (typeof agent === 'object' && agent) {
            const uri = normalizeText(agent.id)
            const label = normalizeText(agent._label || agent.label || agent.name)
            if (uri && label) {
              // 尝试从事件类型推断角色
              let role: string | undefined
              const eventType = normalizeText(event.type)
              if (eventType === 'Creation' || eventType === 'Production') {
                role = '创作者'
              }
              creators.push({ uri, label, role })
            }
          }
        }
      }
    }

    // 从 carried_out_by 直接提取
    const carriedOutBy = forceArray(this.json.carried_out_by as Record<string, unknown>[])
    for (const agent of carriedOutBy) {
      if (typeof agent === 'object' && agent) {
        const uri = normalizeText(agent.id)
        const label = normalizeText(agent._label || agent.label || agent.name)
        if (uri && label && !creators.some((c) => c.uri === uri)) {
          creators.push({ uri, label })
        }
      }
    }

    // 从 made_by 提取
    const madeBy = forceArray(this.json.made_by as Record<string, unknown>[])
    for (const agent of madeBy) {
      if (typeof agent === 'object' && agent) {
        const uri = normalizeText(agent.id)
        const label = normalizeText(agent._label || agent.label || agent.name)
        if (uri && label && !creators.some((c) => c.uri === uri)) {
          creators.push({ uri, label, role: '制作者' })
        }
      }
    }

    return creators
  }

  /**
   * 获取地点信息（从 took_place_at、current_location 等属性提取）
   */
  getPlaces(): PlaceInfo[] {
    const places: PlaceInfo[] = []

    // 从 took_place_at 提取
    const tookPlaceAt = forceArray(this.json.took_place_at as Record<string, unknown>[])
    for (const place of tookPlaceAt) {
      if (typeof place === 'object' && place) {
        const uri = normalizeText(place.id)
        const label = this.extractPlaceName(place)
        if (uri || label) {
          places.push({ uri: uri || '', label: label || uri || '' })
        }
      }
    }

    // 从 current_location 提取
    const currentLocation = forceArray(this.json.current_location as Record<string, unknown>[])
    for (const place of currentLocation) {
      if (typeof place === 'object' && place) {
        const uri = normalizeText(place.id)
        const label = this.extractPlaceName(place)
        if (uri || label) {
          const placeLabel = label || uri || ''
          if (!places.some((p) => p.label === placeLabel)) {
            places.push({ uri: uri || '', label: placeLabel })
          }
        }
      }
    }

    // 从 born/took_place_at 提取出生地
    const broughtIntoExistence = forceArray(this.json.brought_into_existence as Record<string, unknown>[])
    for (const event of broughtIntoExistence) {
      if (typeof event === 'object' && event?.type === 'Birth') {
        const eventTookPlaceAt = forceArray(event.took_place_at as Record<string, unknown>[])
        for (const place of eventTookPlaceAt) {
          if (typeof place === 'object' && place) {
            const uri = normalizeText(place.id)
            const label = this.extractPlaceName(place)
            if (uri || label) {
              const placeLabel = `${label || uri || ''}（出生地）`
              if (!places.some((p) => p.label === placeLabel)) {
                places.push({ uri: uri || '', label: placeLabel })
              }
            }
          }
        }
      }
    }

    return places
  }

  /**
   * 获取分类信息（从 classified_as 提取，排除朝代）
   */
  getClassifications(): ClassificationInfo[] {
    const classifications: ClassificationInfo[] = []

    const classifiedAs = forceArray(this.json.classified_as as Record<string, unknown>[])
    for (const item of classifiedAs) {
      if (typeof item === 'object' && item) {
        const uri = normalizeText(item.id)
        const label = normalizeText(item._label || item.label)

        // 排除朝代信息（朝代会单独显示）
        if (label && label.includes('朝')) {
          continue
        }

        // 过滤掉纯 URL 的标签
        if (uri && (!label || !isLikelyUrl(label))) {
          // 获取分类类型（从 equivalent 或 type）
          const equivalent = forceArray(item.equivalent as Record<string, unknown>[])
          let type: string | undefined
          for (const eq of equivalent) {
            if (typeof eq === 'object' && eq) {
              const eqType = normalizeText(eq.type)
              if (eqType && eqType !== 'Type') {
                type = eqType
                break
              }
            }
          }

          classifications.push({
            uri,
            label: label || uri,
            type,
          })
        }
      }
    }

    return classifications
  }

  /**
   * 获取所属集合信息（从 part_of 提取）
   */
  getPartOf(): Array<{ uri: string; label: string }> {
    const partOf: Array<{ uri: string; label: string }> = []

    const parts = forceArray(this.json.part_of as Record<string, unknown>[])
    for (const item of parts) {
      if (typeof item === 'object' && item) {
        const uri = normalizeText(item.id)
        const label = normalizeText(item._label || item.label || item.title || item.name)
        if (uri || label) {
          partOf.push({ uri: uri || '', label: label || uri || '' })
        }
      }
    }

    return partOf
  }

  /**
   * 获取包含部分信息（从 has_part 提取）
   */
  getHasPart(): Array<{ uri: string; label: string }> {
    const hasPart: Array<{ uri: string; label: string }> = []

    const parts = forceArray(this.json.has_part as Record<string, unknown>[])
    for (const item of parts) {
      if (typeof item === 'object' && item) {
        const uri = normalizeText(item.id)
        const label = normalizeText(item._label || item.label || item.title || item.name)
        if (uri || label) {
          hasPart.push({ uri: uri || '', label: label || uri || '' })
        }
      }
    }

    return hasPart
  }

  /**
   * 获取数字对象源 URI（从 digitally_carried_by、digitally_shown_by 等提取）
   */
  getDigitalSources(): string[] {
    const sources: string[] = []

    // 从 digitally_carried_by 提取
    const subjectOf = forceArray(this.json.subject_of as Record<string, unknown>[])
    for (const item of subjectOf) {
      if (typeof item === 'object' && item) {
        const digitallyCarriedBy = forceArray(item.digitally_carried_by as Record<string, unknown>[])
        for (const id of this.collectAccessPointIds(digitallyCarriedBy)) {
          this.pushUniqueValue(sources, id)
        }
      }
    }

    // 从 representation/digitally_shown_by 提取
    const representation = forceArray(this.json.representation as Record<string, unknown>[])
    for (const rep of representation) {
      if (typeof rep === 'object' && rep) {
        const digitallyShownBy = forceArray(rep.digitally_shown_by as Record<string, unknown>[])
        for (const id of this.collectAccessPointIds(digitallyShownBy)) {
          this.pushUniqueValue(sources, id)
        }
      }
    }

    return sources
  }

  /**
   * 获取"关于"主题关系（从 about 提取）
   * @returns 主题列表
   */
  getAbout(): AboutInfo[] {
    const about: AboutInfo[] = []
    const aboutItems = forceArray(this.json.about as Record<string, unknown>[])

    for (const item of aboutItems) {
      if (typeof item === 'object' && item) {
        const info = extractEntityInfo(item)
        if (info.uri || info.label) {
          about.push({ uri: info.uri || '', label: info.label || info.uri || '' })
        }
      }
    }

    return about
  }

  /**
   * 获取"展示/代表"关系（从 shows 和 represents 提取）
   * @returns 展示内容列表
   */
  getShows(): AboutInfo[] {
    const shows: AboutInfo[] = []

    // 从 shows 提取
    const showItems = forceArray(this.json.shows as Record<string, unknown>[])
    for (const item of showItems) {
      if (typeof item === 'object' && item) {
        const info = extractEntityInfo(item)
        if (info.uri || info.label) {
          shows.push({ uri: info.uri || '', label: info.label || info.uri || '' })
        }
      }
    }

    // 从 represents 提取
    const representItems = forceArray(this.json.represents as Record<string, unknown>[])
    for (const item of representItems) {
      if (typeof item === 'object' && item) {
        const info = extractEntityInfo(item)
        if (info.uri || info.label) {
          // 避免重复
          const exists = shows.some((s) => s.uri === info.uri || s.label === info.label)
          if (!exists) {
            shows.push({ uri: info.uri || '', label: info.label || info.uri || '' })
          }
        }
      }
    }

    return shows
  }

  /**
   * 获取标识符列表（从 identified_by[type="Identifier"] 提取）
   * @returns 标识符列表
   */
  getIdentifiers(): IdentifierInfo[] {
    const identifiers: IdentifierInfo[] = []
    const identifiedBy = forceArray(this.json.identified_by as Record<string, unknown>[])

    for (const item of identifiedBy) {
      if (typeof item === 'object' && item?.type === 'Identifier') {
        const value = normalizeText(item.content)
        if (!value) continue

        // 提取类型（从 classified_as）
        let type = ''
        const classifiedAs = forceArray(item.classified_as as Record<string, unknown>[])
        for (const ca of classifiedAs) {
          if (typeof ca === 'object' && ca) {
            const label = normalizeText(ca._label || ca.label)
            if (label && !isLikelyUrl(label)) {
              type = label
              break
            }
          }
        }

        // 提取分配机构（从 assigned_by）
        let assignedBy = ''
        const assignedByItems = forceArray(item.assigned_by as Record<string, unknown>[])
        for (const ab of assignedByItems) {
          if (typeof ab === 'object' && ab) {
            const label = extractLabel(ab.carried_out_by)
            if (label) {
              assignedBy = label
              break
            }
          }
        }

        identifiers.push({ type, value, assignedBy })
      }
    }

    return identifiers
  }

  /**
   * 获取实体的完整元数据
   * @returns 包含所有可用元数据的对象
   */
  getMetadata(): EntityMetadata {
    return {
      type: this.getType(),
      birthDate: this.getBirthDate(),
      deathDate: this.getDeathDate(),
      birthPlace: this.getBirthPlace(),
      deathPlace: this.getDeathPlace(),
      dynasty: this.getDynasty(),
      nationality: this.getNationality(),
      occupation: this.getOccupation(),
      creationDate: this.getCreationDate(),
      medium: this.getMedium(),
      dimensions: this.getDimensions(),
      collection: this.getCollection(),
      timespan: this.getTimespan(),
      creators: this.getCreators(),
      places: this.getPlaces(),
      classifications: this.getClassifications(),
      partOf: this.getPartOf(),
      hasPart: this.getHasPart(),
      about: this.getAbout(),
      shows: this.getShows(),
      identifiers: this.getIdentifiers(),
      iiifManifests: this.getIIIFManifests(),
      digitalSources: this.getDigitalSources(),
    }
  }

  /**
   * 获取元数据数组（按优先级排序）
   * @returns 包含所有可用元数据的数组
   */
  getMetadataArray(): MetadataField[] {
    const metadata = this.getMetadata()
    const fields: MetadataField[] = []

    // 辅助函数：检查值是否为 MetadataField 类型
    function isMetadataField(value: unknown): value is MetadataField {
      return (
        typeof value === 'object' &&
        value !== null &&
        'labelZh' in value &&
        'labelEn' in value &&
        'value' in value
      )
    }

    // 主要字段优先
    const primaryFields: (keyof EntityMetadata)[] = ['type', 'birthDate', 'deathDate', 'creationDate']
    const secondaryFields: (keyof EntityMetadata)[] = [
      'birthPlace',
      'deathPlace',
      'dynasty',
      'nationality',
      'occupation',
      'medium',
      'dimensions',
      'collection',
    ]

    // 添加主要字段
    for (const key of primaryFields) {
      const field = metadata[key]
      if (isMetadataField(field)) {
        fields.push(field)
      }
    }

    // 添加次要字段
    for (const key of secondaryFields) {
      const field = metadata[key]
      if (isMetadataField(field)) {
        fields.push(field)
      }
    }

    return fields
  }

  /**
   * 从事件中提取时间信息（内部方法）
   */
  private extractTimeFromEvent(event: Record<string, unknown> | undefined): { label?: string; begin?: string } {
    if (!event || !event.timespan) return {}
    const ts = event.timespan as Record<string, unknown>

    const label = normalizeText(ts._label || ts.formatted_value)
    const begin = normalizeText(ts.begin_of_the_begin)

    return { label, begin }
  }

  /**
   * 从事件中提取地点名称（内部方法）
   */
  private extractPlaceFromEvent(event: Record<string, unknown> | undefined): string {
    if (!event) return ''
    const places = forceArray(event.took_place_at as Record<string, unknown>[])
    for (const place of places) {
      if (place && typeof place === 'object') {
        const label = normalizeText(place._label || place.label)
        if (label) return label
      }
    }
    return ''
  }

  /**
   * 从事件中提取创作者列表（内部方法）
   */
  private extractCreatorsFromEvent(event: Record<string, unknown> | undefined): Array<{ label: string }> {
    if (!event) return []
    const agents = forceArray(event.carried_out_by as Record<string, unknown>[])
    return agents
      .filter((agent) => agent && typeof agent === 'object' && agent._label)
      .map((agent) => ({ label: normalizeText(agent._label) }))
  }

  /**
   * 智能获取日期信息（根据实体类型自动选择最佳数据源）
   * 优先级：Person: born > brought_into_existence > created_by
   *         Set/Work: created_by > timespan
   */
  getSmartDate(): MetadataField | undefined {
    // 优先级1: 人物出生日期
    if (this.isPerson()) {
      const birthDate = this.getBirthDate()
      if (birthDate) return birthDate
    }

    // 优先级2: 创作日期
    const creationDate = this.getCreationDate()
    if (creationDate) return creationDate

    // 优先级3: 直接的 timespan
    const timespan = this.json.timespan as Record<string, unknown> | undefined
    if (timespan) {
      const date = this.extractTimespanDate(timespan)
      if (date) {
        return { labelZh: '时间', labelEn: 'Date', value: date }
      }
    }

    // 优先级4: 人物逝世日期（作为最后备用）
    if (this.isPerson()) {
      const deathDate = this.getDeathDate()
      if (deathDate) return deathDate
    }

    return undefined
  }

  /**
   * 智能获取地点信息（根据实体类型自动选择最佳数据源）
   * 优先级：Person: born.took_place_at > brought_into_existence.took_place_at
   *         Set/Work: created_by.took_place_at > took_place_at
   */
  getSmartPlace(): MetadataField | undefined {
    // 优先级1: 人物出生地点
    if (this.isPerson()) {
      const birthPlace = this.getBirthPlace()
      if (birthPlace) return birthPlace
    }

    // 优先级2: 创作地点
    const createdBy = this.json.created_by as Record<string, unknown> | undefined
    if (createdBy && typeof createdBy === 'object') {
      const place = this.extractPlaceFromEvent(createdBy)
      if (place) {
        return { labelZh: '创作地点', labelEn: 'Creation Place', value: place }
      }
    }

    // 优先级3: 直接的 took_place_at
    const tookPlaceAt = forceArray(this.json.took_place_at as Record<string, unknown>[])
    for (const place of tookPlaceAt) {
      if (place && typeof place === 'object') {
        const label = normalizeText(place._label || place.label)
        if (label) {
          return { labelZh: '地点', labelEn: 'Place', value: label }
        }
      }
    }

    return undefined
  }

  /**
   * 智能获取创作者信息
   * 优先级：created_by.carried_out_by > carried_out_by > made_by
   */
  getSmartCreators(): { labelZh: string; labelEn: string; value: string } | undefined {
    // 优先级1: 创作事件中的执行者
    const createdBy = this.json.created_by as Record<string, unknown> | undefined
    if (createdBy && typeof createdBy === 'object') {
      const creators = this.extractCreatorsFromEvent(createdBy)
      if (creators.length > 0) {
        return {
          labelZh: '创作者',
          labelEn: 'Creator',
          value: creators.map((c) => c.label).join('、'),
        }
      }
    }

    // 优先级2: 直接的 carried_out_by
    const carriedOutBy = forceArray(this.json.carried_out_by as Record<string, unknown>[])
    if (carriedOutBy.length > 0) {
      const labels = carriedOutBy
        .filter((agent) => agent && typeof agent === 'object' && agent._label)
        .map((agent) => normalizeText(agent._label))
      if (labels.length > 0) {
        return {
          labelZh: '执行者',
          labelEn: 'Executor',
          value: labels.join('、'),
        }
      }
    }

    // 优先级3: made_by
    const madeBy = forceArray(this.json.made_by as Record<string, unknown>[])
    if (madeBy.length > 0) {
      const labels = madeBy
        .filter((agent) => agent && typeof agent === 'object' && agent._label)
        .map((agent) => normalizeText(agent._label))
      if (labels.length > 0) {
        return {
          labelZh: '制作者',
          labelEn: 'Maker',
          value: labels.join('、'),
        }
      }
    }

    return undefined
  }

  /**
   * 获取完整的出生信息（包含日期和地点）
   */
  getBirthInfo(): { date?: string; place?: string } | undefined {
    if (!this.isPerson()) return undefined

    const birthDate = this.getBirthDate()
    const birthPlace = this.getBirthPlace()

    if (!birthDate && !birthPlace) return undefined

    return {
      date: birthDate?.value,
      place: birthPlace?.value,
    }
  }

  /**
   * 获取完整的逝世信息（包含日期和地点）
   */
  getDeathInfo(): { date?: string; place?: string } | undefined {
    if (!this.isPerson()) return undefined

    const deathDate = this.getDeathDate()
    const deathPlace = this.getDeathPlace()

    if (!deathDate && !deathPlace) return undefined

    return {
      date: deathDate?.value,
      place: deathPlace?.value,
    }
  }

  /**
   * 获取完整的创作信息（包含时间、地点、创作者）
   */
  getCreationInfo(): { date?: string; place?: string; creators?: string } | undefined {
    const createdBy = this.json.created_by as Record<string, unknown> | undefined
    if (!createdBy) return undefined

    const creationDate = this.getCreationDate()
    const timeInfo = this.extractTimeFromEvent(createdBy)
    const place = this.extractPlaceFromEvent(createdBy)
    const creators = this.extractCreatorsFromEvent(createdBy)

    if (!creationDate && !place && creators.length === 0) return undefined

    return {
      date: creationDate?.value || timeInfo.label,
      place: place || undefined,
      creators: creators.map((c) => c.label).join('、') || undefined,
    }
  }
}

