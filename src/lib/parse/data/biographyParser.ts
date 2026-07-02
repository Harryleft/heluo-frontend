/**
 * 人物介绍解析器
 *
 * 用于解析 referred_to_by.content 中的结构化信息，
 * 将堆积在一起的内容分解为来源、生卒、介绍等字段。
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 单个人物介绍来源的结构化数据
 */
export interface BiographySource {
  /** 来源名称 */
  source: string
  /** 生卒年 */
  birthDeath?: string
  /** 人物介绍 */
  introduction?: string
  /** 字号 */
  alias?: string
  /** 其他字段 */
  otherFields: Record<string, string>
  /** 原始内容（用于回退展示） */
  rawContent?: string
}

/**
 * 人物介绍的完整结构化数据
 */
export interface BiographyData {
  /** 是否成功解析出结构化数据 */
  hasStructuredData: boolean
  /** 各来源的介绍数据 */
  sources: BiographySource[]
  /** 原始文本（用于回退展示） */
  rawText: string
}

// ============================================================================
// 常量定义
// ============================================================================

/**
 * 字段名映射（中文 -> 标准字段名）
 */
const FIELD_MAPPINGS: Record<string, keyof Omit<BiographySource, 'source' | 'otherFields' | 'rawContent'>> = {
  生卒: 'birthDeath',
  卒年: 'birthDeath',
  生年: 'birthDeath',
  介绍: 'introduction',
  簡介: 'introduction',
  简介: 'introduction',
  字號: 'alias',
  字号: 'alias',
  別名: 'alias',
  别名: 'alias',
  本名: 'alias',
}

/**
 * 年份模式正则表达式
 * 匹配格式如：712-770、712—770（全角破折号）、712~770、712至770 等
 */
const YEAR_RANGE_PATTERN = /^(\d{1,4})\s*[-—~至]\s*(\d{1,4})/

// ============================================================================
// 私有实现 - 工具函数
// ============================================================================

/**
 * 分离生卒年字段中的年份和正文
 * 当生卒年字段包含额外正文时（如 "712—770 字子美，排行二..."），
 * 将年份和正文分离
 *
 * @param value 原始字段值
 * @returns 分离后的 { birthDeath, introduction } 或 null（无需分离）
 */
function splitBirthDeathAndIntroduction(value: string): { birthDeath: string; introduction: string } | null {
  if (!value || value.length <= 20) {
    return null
  }

  const match = value.match(YEAR_RANGE_PATTERN)
  if (!match) {
    return null
  }

  // 获取年份后的文本
  const afterYears = value.slice(match[0].length).trim()
  if (!afterYears || afterYears.length < 5) {
    return null
  }

  // 确保后续文本看起来像正文（以常见的中文字符开头）
  if (!/^[\u4e00-\u9fa5，。；、！？：]/.test(afterYears)) {
    return null
  }

  return {
    birthDeath: match[0].trim(),
    introduction: afterYears,
  }
}

/**
 * 从来源行中提取书名号内容，支持嵌套书名号
 */
function extractBracketTitle(text: string): string {
  const start = text.indexOf('《')
  if (start < 0) return ''

  let depth = 0
  for (let i = start; i < text.length; i++) {
    const char = text[i]
    if (char === '《') {
      depth += 1
    } else if (char === '》') {
      depth -= 1
      if (depth === 0) {
        return text.slice(start + 1, i).trim()
      }
    }
  }

  return ''
}

/**
 * 将 biography 文本按“来源”自动切分为多个来源块
 */
function splitIntoSourceBlocks(content: string): string[] {
  const normalized = content.replace(/\r\n/g, '\n')
  const blocks: string[] = []

  // 优先按空行（\n\n）切分来源块，再处理单块内可能出现的多个来源
  const chunks = normalized
    .split(/\n\n+/)
    .map((item) => item.trim())
    .filter(Boolean)

  for (const chunk of chunks) {
    const starts: number[] = []
    const sourceStartPattern = /来源[：:]\s*《/g
    let match: RegExpExecArray | null

    while ((match = sourceStartPattern.exec(chunk)) !== null) {
      starts.push(match.index)
    }

    if (starts.length <= 1) {
      blocks.push(chunk)
      continue
    }

    for (let i = 0; i < starts.length; i++) {
      const start = starts[i]
      const end = i + 1 < starts.length ? starts[i + 1] : chunk.length
      const block = chunk.slice(start, end).trim()
      if (block) blocks.push(block)
    }
  }

  return blocks
}

// ============================================================================
// 私有实现 - 解析逻辑
// ============================================================================

/**
 * 解析单个来源块的内容
 *
 * @param block 单个来源块文本，格式如：来源：《xxx》【生卒】：712-770【介绍】：...
 * @returns 解析后的来源数据
 */
function parseSourceBlock(block: string): BiographySource {
  const result: BiographySource = {
    source: '',
    otherFields: {},
  }

  // 提取来源名称 - 匹配 "来源：《xxx》" 或 "来源: 《xxx》"
  // 注意：来源名称可能包含嵌套的书名号，如 《元稹《唐故...》》
  const sourceStart = block.search(/来源[：:]\s*/)
  if (sourceStart >= 0) {
    const sourceText = block.slice(sourceStart)
    result.source = extractBracketTitle(sourceText)
  }

  // 提取所有【字段】：内容 格式的内容
  const fieldPattern = /【([^】]+)】[：:]\s*/g
  let fieldMatch
  const fields: { name: string; startIndex: number }[] = []

  // 先找到所有字段的位置
  while ((fieldMatch = fieldPattern.exec(block)) !== null) {
    fields.push({
      name: fieldMatch[1].trim(),
      startIndex: fieldMatch.index + fieldMatch[0].length,
    })
  }

  // 提取每个字段的值
  let parsedTailEnd = 0
  for (let i = 0; i < fields.length; i++) {
    const fieldName = fields[i].name
    const startIndex = fields[i].startIndex
    // 字段值从当前位置到下一个字段开始（或块结束）
    const endIndex = i + 1 < fields.length ? fields[i + 1].startIndex - fields[i + 1].name.length - 3 : block.length
    let fieldValue = block.substring(startIndex, endIndex).trim()

    // 清理字段值末尾的空白、换行和【字符
    fieldValue = fieldValue.replace(/[\s\n\r]+$/g, '').trim()
    // 移除末尾可能残留的【
    fieldValue = fieldValue.replace(/【\s*$/g, '').trim()

    if (!fieldValue) continue

    parsedTailEnd = Math.max(parsedTailEnd, endIndex)

    // 映射到标准字段名
    const standardField = FIELD_MAPPINGS[fieldName]
    if (standardField) {
      // 特殊处理：生卒年字段可能包含额外的正文内容
      if (standardField === 'birthDeath') {
        const split = splitBirthDeathAndIntroduction(fieldValue)
        if (split) {
          result.birthDeath = split.birthDeath
          // 如果已有介绍内容，追加到后面
          if (result.introduction) {
            result.introduction = `${split.introduction}\n${result.introduction}`.trim()
          } else {
            result.introduction = split.introduction
          }
        } else {
          result.birthDeath = fieldValue
        }
      } else {
        result[standardField] = fieldValue
      }
    } else {
      result.otherFields[fieldName] = fieldValue
    }
  }

  // 处理“最后一个字段后还有正文”但未标注【介绍】的情况
  if (fields.length > 0) {
    const tailText = block.slice(parsedTailEnd).replace(/^[\s\n\r：:，。；、-]+/g, '').trim()
    if (tailText) {
      if (result.introduction) {
        result.introduction = `${result.introduction}\n${tailText}`.trim()
      } else if (tailText.length > 8) {
        result.introduction = tailText
      }
    }
  }

  // 如果没有解析出任何结构化字段，提取来源后的所有内容作为原始内容
  if (!result.birthDeath && !result.introduction && !result.alias && Object.keys(result.otherFields).length === 0) {
    // 移除来源标识行，获取剩余内容
    const lines = block.split('\n')
    const contentLines: string[] = []
    let foundSource = false

    for (const line of lines) {
      if (line.match(/^来源[：:]/)) {
        foundSource = true
        continue
      }
      if (foundSource) {
        contentLines.push(line)
      }
    }

    const rawContent = contentLines.join('\n').trim()
    if (rawContent && rawContent.length > 10) {
      result.rawContent = rawContent
    }
  }

  return result
}

// ============================================================================
// 公共 API
// ============================================================================

/**
 * 解析人物介绍内容
 *
 * 支持以下格式：
 * 1. 单个来源：{来源：《xxx》【生卒】：712-770【介绍】：...}
 * 2. 多个来源：用双换行符（\n\n）分隔的多个 来源：... 块
 * 3. 无格式纯文本：直接返回原始文本
 *
 * @param content referred_to_by.content 的内容
 * @returns 结构化的人物介绍数据
 */
export function parseBiographyContent(content: string): BiographyData {
  if (!content || typeof content !== 'string') {
    return {
      hasStructuredData: false,
      sources: [],
      rawText: '',
    }
  }

  const sources: BiographySource[] = []

  // 检查是否包含来源标识
  if (!content.includes('来源')) {
    return {
      hasStructuredData: false,
      sources: [],
      rawText: content,
    }
  }

  const blocks = splitIntoSourceBlocks(content)

  // 如果没有成功分割（没有找到来源块），尝试旧的正向预查方式
  if (blocks.length === 0) {
    const fallbackBlocks = content
      .split(/(?=来源[：:])/g)
      .map((block) => block.trim())
      .filter((block) => block.length > 0)
    blocks.push(...fallbackBlocks)
  }

  // 如果仍然没有成功分割，将整个内容作为一个块
  if (blocks.length === 0) {
    blocks.push(content)
  }

  // 解析每个块
  for (const block of blocks) {
    const parsed = parseSourceBlock(block)
    // 只添加有有效内容的来源
    if (
      parsed.source ||
      parsed.birthDeath ||
      parsed.introduction ||
      parsed.alias ||
      Object.keys(parsed.otherFields).length > 0 ||
      (parsed.rawContent && parsed.rawContent.length > 20)
    ) {
      sources.push(parsed)
    }
  }

  // 判断是否成功解析出结构化数据
  const hasStructuredData = sources.length > 0

  return {
    hasStructuredData,
    sources,
    rawText: content,
  }
}

/**
 * 从多个 referred_to_by 条目中提取并解析人物介绍
 *
 * @param referredToBy referred_to_by 数组
 * @returns 结构化的人物介绍数据
 */
export function parseBiographyFromReferredToBy(referredToBy: unknown[]): BiographyData {
  if (!Array.isArray(referredToBy) || referredToBy.length === 0) {
    return {
      hasStructuredData: false,
      sources: [],
      rawText: '',
    }
  }

  // 合并所有 content
  const allContent = referredToBy
    .map((item) => {
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>
        const content = obj.content
        if (typeof content === 'string' && !content.startsWith('http')) {
          return content
        }
      }
      return ''
    })
    .filter(Boolean)
    .join('\n\n')

  return parseBiographyContent(allContent)
}
