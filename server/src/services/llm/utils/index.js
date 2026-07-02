/**
 * 工具函数模块入口
 *
 * @module server/src/services/llm/utils
 */

/**
 * 标准化纯文本（去空白、截断)
 */
export function normalizePlainText(value, maxLength = 1200) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return text.slice(0, maxLength)
}
/**
 * 裁剪证据文本
 */
export function clipEvidenceText(value, maxLength = 1600) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}……`
}

/**
 * 提取人物关联内容（去重、限制数量)
 */
export function extractPersonReferredContents(input, maxItems = 24) {
  const list = Array.isArray(input) ? input : [input]
  const output = []

  for (const item of list) {
    if (output.length >= maxItems) break
    const text = normalizePlainText(item, 600)
    if (text) output.push(text)
  }

  return Array.from(new Set(output))
}
