/**
 * 实体类型图标资源
 *
 * 使用 Bootstrap Icons 作为图标源，避免依赖外部 SVG 文件
 */

// Bootstrap Icons 类名映射
const BOOTSTRAP_ICONS = {
  person: 'bi-person',
  group: 'bi-people',
  place: 'bi-geo-alt',
  concept: 'bi-tag',
  event: 'bi-calendar-event',
  object: 'bi-box',
  work: 'bi-book',
  digitalObject: 'bi-file-earmark-binary',
  visualItem: 'bi-image',
  set: 'bi-collection',
  linguisticObject: 'bi-file-text',
} as const

/**
 * 实体类型到图标的映射
 */
const ENTITY_TYPE_ICONS: Record<string, [string, string]> = {
  // 人物和组织
  Person: [BOOTSTRAP_ICONS.person, '人物'],
  Group: [BOOTSTRAP_ICONS.group, '组织'],

  // 地理
  Place: [BOOTSTRAP_ICONS.place, '地理'],

  // 概念
  Currency: [BOOTSTRAP_ICONS.concept, '货币'],
  Language: [BOOTSTRAP_ICONS.concept, '语言'],
  Material: [BOOTSTRAP_ICONS.concept, '材质'],
  MeasurementUnit: [BOOTSTRAP_ICONS.concept, '计量单位'],
  Type: [BOOTSTRAP_ICONS.concept, '类型'],

  // 事件
  Activity: [BOOTSTRAP_ICONS.event, '活动'],
  Period: [BOOTSTRAP_ICONS.event, '时期'],
  Event: [BOOTSTRAP_ICONS.event, '事件'],

  // 物品和作品
  HumanMadeObject: [BOOTSTRAP_ICONS.object, '物品'],
  DigitalObject: [BOOTSTRAP_ICONS.digitalObject, '数字对象'],
  VisualItem: [BOOTSTRAP_ICONS.visualItem, '视觉作品'],
  Set: [BOOTSTRAP_ICONS.set, '集合'],
  LinguisticObject: [BOOTSTRAP_ICONS.linguisticObject, '语言对象'],
  ManMadeObject: [BOOTSTRAP_ICONS.work, '作品'],
}

/**
 * 获取实体类型对应的图标类名和说明文本
 * @param type 实体类型
 * @returns 包含 [图标类名, 说明文本] 的元组
 */
export function getEntityTypeIcon(type: string): [string, string] {
  return ENTITY_TYPE_ICONS[type] || ['', '']
}
