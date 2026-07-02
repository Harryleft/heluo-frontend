/**
 * 融合问答降级策略
 *
 * @module server/src/services/llm/fallback/fusionFallback
 */

import { normalizePlainText, clipEvidenceText } from '../utils/index.js'

/**
 * 检测是否为诗单列表意图
 */
export function isPoemListIntent(query) {
  const text = normalizePlainText(query)
  if (!text) return false
  return /(诗|诗作|诗文).*(有哪些|有哪几|哪几首|哪几篇)|给.+写.+诗|写给.+诗|赠.+诗/.test(text)
}

/**
 * 提取查询目标名称
 */
export function extractQueryTargetName(query) {
  const text = normalizePlainText(query)
  if (!text) return ''
  const writingToMatch = text.match(/给([\u4e00-\u9fa5]{1,6})写/)
  if (writingToMatch?.[1]) return writingToMatch[1]
  const rememberMatch = text.match(/忆([\u4e00-\u9fa5]{1,6})/)
  if (rememberMatch?.[1]) return rememberMatch[1]
  return ''
}

/**
 * 收集诗候选
 */
export function collectPoemCandidates(entities = [], citations = []) {
  const output = []
  const pushCandidate = (item, source = '') => {
    const title = normalizePlainText(item?.title)
    if (!title) return
    const type = normalizePlainText(item?.type || item?.sourceType)
    if (type !== 'poem') return
    const snippet = normalizePlainText(item?.snippet || item?.poemText || item?.fullText)
    const score = Number(item?.scoreDetail?.finalScore || item?.score || 0)
    output.push({
      title,
      snippet,
      score: Number.isFinite(score) ? score : 0,
      source,
    })
  }

  entities.forEach((item) => pushCandidate(item, 'entity'))
  citations.forEach((item) => pushCandidate(item, 'citation'))

  // 去重
  const deduped = new Map()
  for (const item of output) {
    const current = deduped.get(item.title)
    if (!current || item.score > current.score) {
      deduped.set(item.title, item)
    }
  }

  return Array.from(deduped.values()).sort((a, b) => b.score - a.score)
}

/**
 * 构建诗覆盖补充
 */
export function buildPoemCoverageSupplement(missingItems = [], targetName = '') {
  if (!missingItems.length) return ''

  const subject = targetName || '提问对象'
  const lines = missingItems.map((item) => {
    const quote = item.snippet
      ? `材料片段"${clipEvidenceText(item.snippet, 60)}"`
      : '材料已有该诗题命中'
    return `该诗与${subject}相关,${quote}，应纳入本题答案。`
  })
  return `为避免遗漏，基于当前命中材料应全量列出并解释以下诗作:${missingItems.map((item) => item.title).join('、')}。${lines.join('')}`
}

/**
 * 确保诗单覆盖（全量覆盖)
 */
export function ensurePoemListCoverage({ query, entities = [], citations = [], answerText = '' }) {
  const baseAnswer = normalizePlainText(answerText)
  if (!baseAnswer) return baseAnswer
  if (!isPoemListIntent(query)) return baseAnswer

  // 默认关闭“自动补齐诗单”文案，避免向用户输出流程性提示与无关扩展说明。
  const enableCoverageAppend = String(process.env.LLM_ENABLE_POEM_COVERAGE_APPEND || '')
    .trim()
    .toLowerCase() === 'true'
  if (!enableCoverageAppend) return baseAnswer

  const candidates = collectPoemCandidates(entities, citations)
  if (candidates.length < 2) return baseAnswer

  const targetName = extractQueryTargetName(query)
  const requiredCandidates = targetName
    ? candidates.filter((item) => item.title.includes(targetName))
    : candidates
  const required = requiredCandidates.length >= 2 ? requiredCandidates : candidates.slice(0, 3)
  if (required.length < 2) return baseAnswer

  const missing = required.filter((item) => !baseAnswer.includes(item.title))
  if (!missing.length) return baseAnswer

  const supplement = buildPoemCoverageSupplement(missing, targetName)
  if (!supplement) return baseAnswer
  return `${baseAnswer}\n\n${supplement}`
}
